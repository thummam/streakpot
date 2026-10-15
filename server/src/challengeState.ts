import { query } from './db.js';
import { toDay } from './dates.js';
import { notFound } from './http.js';
import { checkInStatus, computeStandings, type CheckInStatus } from './scoring.js';

export interface ChallengeRow {
  id: number;
  title: string;
  description: string;
  target_per_week: number;
  stake: number;
  start_date: string;
  weeks: number;
  invite_code: string;
  owner_id: number;
  created_at: Date;
}

export interface CheckInView {
  id: number;
  userId: number;
  userName: string;
  day: string;
  note: string;
  hasPhoto: boolean;
  createdAt: Date;
  approvals: number;
  rejections: number;
  myVote: boolean | null;
  status: CheckInStatus;
}

export function challengeJson(c: ChallengeRow) {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    targetPerWeek: c.target_per_week,
    stake: c.stake,
    startDate: c.start_date,
    weeks: c.weeks,
    inviteCode: c.invite_code,
    ownerId: c.owner_id,
  };
}

/** Loads a challenge the user belongs to, with every check-in's derived status and the standings. */
export async function loadChallengeState(challengeId: number, viewerId: number, now = new Date()) {
  const [challenge] = await query<ChallengeRow>(
    `SELECT c.* FROM challenges c
     JOIN memberships m ON m.challenge_id = c.id AND m.user_id = $2
     WHERE c.id = $1`,
    [challengeId, viewerId],
  );
  if (!challenge) throw notFound('Challenge not found.');

  const members = await query<{ user_id: number; name: string; joined_on: string }>(
    `SELECT m.user_id, u.name, m.joined_on FROM memberships m
     JOIN users u ON u.id = m.user_id
     WHERE m.challenge_id = $1 ORDER BY m.joined_on, u.name`,
    [challengeId],
  );

  const rows = await query(
    `SELECT ci.id, ci.user_id, u.name AS user_name, ci.day, ci.note, ci.created_at,
            ci.photo IS NOT NULL AS has_photo,
            COUNT(v.voter_id) FILTER (WHERE v.approve)     AS approvals,
            COUNT(v.voter_id) FILTER (WHERE NOT v.approve) AS rejections,
            BOOL_OR(v.approve) FILTER (WHERE v.voter_id = $2) AS my_vote
     FROM check_ins ci
     JOIN users u ON u.id = ci.user_id
     LEFT JOIN votes v ON v.check_in_id = ci.id
     WHERE ci.challenge_id = $1
     GROUP BY ci.id, u.name
     ORDER BY ci.created_at DESC`,
    [challengeId, viewerId],
  );

  const checkIns: CheckInView[] = rows.map((r) => {
    const approvals = Number(r.approvals);
    const rejections = Number(r.rejections);
    return {
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      day: r.day,
      note: r.note,
      hasPhoto: r.has_photo,
      createdAt: r.created_at,
      approvals,
      rejections,
      myVote: r.my_vote,
      // Judge against the members who had joined by the check-in's day.
      status: checkInStatus({
        approvals,
        rejections,
        otherMembers: members.filter((m) => m.user_id !== r.user_id && m.joined_on <= r.day).length,
        createdAt: r.created_at,
        now,
      }),
    };
  });

  const memberIds = new Set(members.map((m) => m.user_id));
  const scoring = computeStandings({
    challenge: {
      startDate: challenge.start_date,
      weeks: challenge.weeks,
      targetPerWeek: challenge.target_per_week,
      stake: challenge.stake,
    },
    members: members.map((m) => ({ userId: m.user_id, name: m.name, joinedOn: m.joined_on })),
    checkIns: checkIns.filter((c) => memberIds.has(c.userId)),
    today: toDay(now),
  });

  return { challenge, members, checkIns, scoring };
}
