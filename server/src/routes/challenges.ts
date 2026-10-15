import { randomInt } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { currentUser, requireAuth } from '../auth.js';
import { challengeJson, loadChallengeState, type ChallengeRow } from '../challengeState.js';
import { addDays, diffDays, isValidDay, toDay } from '../dates.js';
import { query, withTransaction } from '../db.js';
import { HttpError, idParam, notFound, parse } from '../http.js';
import { SETTLE_GRACE_DAYS } from '../scoring.js';

export const challengesRouter = Router();
challengesRouter.use(requireAuth);

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newInviteCode(): string {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

const day = z.string().refine(isValidDay, 'must be a YYYY-MM-DD date');

const createSchema = z.object({
  title: z.string().trim().min(3, 'must be at least 3 characters').max(60),
  description: z.string().trim().max(500).default(''),
  targetPerWeek: z.number().int().min(1).max(7),
  stake: z.number().int().min(1).max(1000),
  weeks: z.number().int().min(1).max(12),
  startDate: day,
});

const updateSchema = z.object({
  title: z.string().trim().min(3).max(60).optional(),
  description: z.string().trim().max(500).optional(),
});

challengesRouter.get('/', async (req, res) => {
  const user = currentUser(req);
  const ids = await query<{ challenge_id: number }>(
    `SELECT m.challenge_id FROM memberships m JOIN challenges c ON c.id = m.challenge_id
     WHERE m.user_id = $1 ORDER BY c.start_date DESC, c.id DESC`,
    [user.id],
  );

  const challenges = await Promise.all(
    ids.map(async ({ challenge_id }) => {
      const { challenge, members, scoring } = await loadChallengeState(challenge_id, user.id);
      const rank = scoring.standings.findIndex((s) => s.userId === user.id);
      const me = scoring.standings[rank];
      const thisWeek = scoring.currentWeek !== null ? me?.weeks[scoring.currentWeek] : undefined;
      return {
        ...challengeJson(challenge),
        memberCount: members.length,
        phase: scoring.phase,
        currentWeek: scoring.currentWeek,
        endDate: scoring.endDate,
        pot: scoring.pot,
        rank: rank + 1,
        me: me && {
          points: me.points,
          streak: me.streak,
          alive: me.alive,
          thisWeek: thisWeek && { approved: thisWeek.approved, pending: thisWeek.pending },
        },
      };
    }),
  );
  res.json({ challenges });
});

challengesRouter.post('/', async (req, res) => {
  const user = currentUser(req);
  const body = parse(createSchema, req.body);
  const today = toDay(new Date());
  if (diffDays(body.startDate, today) < -1) throw new HttpError(400, 'startDate: cannot be in the past');
  if (diffDays(body.startDate, today) > 60) throw new HttpError(400, 'startDate: must be within 60 days');

  const challenge = await withTransaction(async (client) => {
    const { rows } = await client.query<ChallengeRow>(
      `INSERT INTO challenges (title, description, target_per_week, stake, weeks, start_date, invite_code, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [body.title, body.description, body.targetPerWeek, body.stake, body.weeks, body.startDate, newInviteCode(), user.id],
    );
    await client.query('INSERT INTO memberships (challenge_id, user_id, joined_on) VALUES ($1, $2, $3)', [
      rows[0].id,
      user.id,
      body.startDate < today ? body.startDate : today,
    ]);
    return rows[0];
  });
  res.status(201).json({ challenge: challengeJson(challenge) });
});

challengesRouter.get('/:id', async (req, res) => {
  const user = currentUser(req);
  const { challenge, checkIns, scoring } = await loadChallengeState(idParam(req), user.id);
  res.json({
    challenge: challengeJson(challenge),
    ...scoring,
    checkIns,
    today: toDay(new Date()),
  });
});

challengesRouter.patch('/:id', async (req, res) => {
  const user = currentUser(req);
  const body = parse(updateSchema, req.body);
  const [row] = await query<ChallengeRow>(
    `UPDATE challenges SET title = COALESCE($3, title), description = COALESCE($4, description)
     WHERE id = $1 AND owner_id = $2 RETURNING *`,
    [idParam(req), user.id, body.title ?? null, body.description ?? null],
  );
  if (!row) throw notFound('Challenge not found.');
  res.json({ challenge: challengeJson(row) });
});

challengesRouter.delete('/:id', async (req, res) => {
  const user = currentUser(req);
  const rows = await query('DELETE FROM challenges WHERE id = $1 AND owner_id = $2 RETURNING id', [idParam(req), user.id]);
  if (!rows[0]) throw notFound('Challenge not found.');
  res.status(204).end();
});

challengesRouter.delete('/:id/membership', async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req);
  const [c] = await query<ChallengeRow>('SELECT owner_id FROM challenges WHERE id = $1', [id]);
  if (c?.owner_id === user.id) throw new HttpError(400, 'The creator cannot leave. Delete the challenge instead.');
  const rows = await query('DELETE FROM memberships WHERE challenge_id = $1 AND user_id = $2 RETURNING user_id', [id, user.id]);
  if (!rows[0]) throw notFound('Challenge not found.');
  res.status(204).end();
});

const checkInSchema = z.object({
  day,
  note: z.string().trim().max(280).default(''),
  photo: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'must be a JPEG, PNG or WebP image')
    .optional(),
});

challengesRouter.post('/:id/checkins', async (req, res) => {
  const user = currentUser(req);
  const body = parse(checkInSchema, req.body);
  const { challenge, scoring } = await loadChallengeState(idParam(req), user.id);

  if (!body.photo && !body.note) throw new HttpError(400, 'Add a photo or a note as proof.');
  if (body.day < challenge.start_date || body.day > scoring.endDate) {
    throw new HttpError(400, 'That day is outside the challenge dates.');
  }
  // Allow ±1 day around the server's UTC date so every time zone can log "today".
  if (Math.abs(diffDays(body.day, toDay(new Date()))) > 1) {
    throw new HttpError(400, 'You can only check in for today.');
  }

  let photo: Buffer | null = null;
  let photoType: string | null = null;
  if (body.photo) {
    const [meta, data] = body.photo.split(',');
    photo = Buffer.from(data, 'base64');
    photoType = meta.slice(5, meta.indexOf(';'));
    if (photo.length > 1_500_000) throw new HttpError(413, 'Photo is too large (max 1.5 MB).');
  }

  const rows = await query(
    `INSERT INTO check_ins (challenge_id, user_id, day, note, photo, photo_type)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (challenge_id, user_id, day) DO NOTHING
     RETURNING id`,
    [challenge.id, user.id, body.day, body.note, photo, photoType],
  );
  if (!rows[0]) throw new HttpError(409, 'You already checked in for that day.');
  res.status(201).json({ id: rows[0].id });
});

/** A check-in can still be voted on or removed until its week is settled. */
export function weekStillOpen(challengeStart: string, checkInDay: string, today: string): boolean {
  const weekIndex = Math.floor(diffDays(checkInDay, challengeStart) / 7);
  const weekEnd = addDays(challengeStart, weekIndex * 7 + 6);
  return diffDays(today, weekEnd) <= SETTLE_GRACE_DAYS;
}
