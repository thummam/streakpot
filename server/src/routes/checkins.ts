import { Router } from 'express';
import { z } from 'zod';
import { currentUser, requireAuth } from '../auth.js';
import { toDay } from '../dates.js';
import { query } from '../db.js';
import { HttpError, idParam, notFound, parse } from '../http.js';
import { weekStillOpen } from './challenges.js';

export const checkInsRouter = Router();
checkInsRouter.use(requireAuth);

/** Fetches a check-in only if the viewer is a member of its challenge. */
async function loadVisibleCheckIn(checkInId: number, viewerId: number) {
  const [row] = await query(
    `SELECT ci.id, ci.user_id, ci.day, c.start_date
     FROM check_ins ci
     JOIN challenges c ON c.id = ci.challenge_id
     JOIN memberships m ON m.challenge_id = ci.challenge_id AND m.user_id = $2
     WHERE ci.id = $1`,
    [checkInId, viewerId],
  );
  if (!row) throw notFound('Check-in not found.');
  return row as { id: number; user_id: number; day: string; start_date: string };
}

checkInsRouter.get('/:id/photo', async (req, res) => {
  const user = currentUser(req);
  await loadVisibleCheckIn(idParam(req), user.id);
  const [row] = await query('SELECT photo, photo_type FROM check_ins WHERE id = $1', [idParam(req)]);
  if (!row?.photo) throw notFound('No photo.');
  res.set('Content-Type', row.photo_type).set('Cache-Control', 'private, max-age=86400').send(row.photo);
});

checkInsRouter.put('/:id/vote', async (req, res) => {
  const user = currentUser(req);
  const { approve } = parse(z.object({ approve: z.boolean() }), req.body);
  const checkIn = await loadVisibleCheckIn(idParam(req), user.id);
  if (checkIn.user_id === user.id) throw new HttpError(403, "You can't vote on your own check-in.");
  if (!weekStillOpen(checkIn.start_date, checkIn.day, toDay(new Date()))) {
    throw new HttpError(400, 'That week is already settled.');
  }
  await query(
    `INSERT INTO votes (check_in_id, voter_id, approve) VALUES ($1, $2, $3)
     ON CONFLICT (check_in_id, voter_id) DO UPDATE SET approve = EXCLUDED.approve, created_at = now()`,
    [checkIn.id, user.id, approve],
  );
  res.status(204).end();
});

checkInsRouter.delete('/:id', async (req, res) => {
  const user = currentUser(req);
  const checkIn = await loadVisibleCheckIn(idParam(req), user.id);
  if (checkIn.user_id !== user.id) throw notFound('Check-in not found.');
  if (!weekStillOpen(checkIn.start_date, checkIn.day, toDay(new Date()))) {
    throw new HttpError(400, 'That week is already settled.');
  }
  await query('DELETE FROM check_ins WHERE id = $1', [checkIn.id]);
  res.status(204).end();
});
