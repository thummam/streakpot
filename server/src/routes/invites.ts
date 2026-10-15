import { Router } from 'express';
import { currentUser, optionalAuth, requireAuth } from '../auth.js';
import { addDays, diffDays, toDay } from '../dates.js';
import { query } from '../db.js';
import { HttpError, notFound } from '../http.js';

export const invitesRouter = Router();

async function findByCode(code: string) {
  const [row] = await query(
    `SELECT c.id, c.title, c.description, c.target_per_week, c.stake, c.weeks, c.start_date,
            u.name AS owner_name,
            (SELECT COUNT(*) FROM memberships m WHERE m.challenge_id = c.id)::int AS member_count
     FROM challenges c JOIN users u ON u.id = c.owner_id
     WHERE c.invite_code = $1`,
    [code.toUpperCase()],
  );
  if (!row) throw notFound('That invite link is not valid.');
  return row;
}

invitesRouter.get('/:code', optionalAuth, async (req, res) => {
  const c = await findByCode(String(req.params.code));
  const alreadyMember = req.user
    ? (await query('SELECT 1 FROM memberships WHERE challenge_id = $1 AND user_id = $2', [c.id, req.user.id])).length > 0
    : false;
  res.json({
    challenge: {
      id: c.id,
      title: c.title,
      description: c.description,
      targetPerWeek: c.target_per_week,
      stake: c.stake,
      weeks: c.weeks,
      startDate: c.start_date,
      ownerName: c.owner_name,
      memberCount: c.member_count,
    },
    alreadyMember,
  });
});

invitesRouter.post('/:code/join', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const c = await findByCode(String(req.params.code));
  const endDate = addDays(c.start_date, c.weeks * 7 - 1);
  if (diffDays(toDay(new Date()), endDate) > 0) throw new HttpError(400, 'This challenge has already ended.');
  await query(
    `INSERT INTO memberships (challenge_id, user_id, joined_on) VALUES ($1, $2, GREATEST($3::date, CURRENT_DATE))
     ON CONFLICT DO NOTHING`,
    [c.id, user.id, c.start_date],
  );
  res.json({ challengeId: c.id });
});
