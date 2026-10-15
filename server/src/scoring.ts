import { addDays, diffDays } from './dates.js';

/**
 * Game rules (all derived from stored rows — nothing is mutated on a schedule):
 *
 * - A challenge runs for `weeks` weeks starting on `startDate`. Each member must log
 *   `targetPerWeek` approved check-ins per week.
 * - Every check-in is reviewed by the other members. It is rejected once a strict
 *   majority votes no, approved once at least half vote yes, and approved by default
 *   if it is still undecided after REVIEW_WINDOW_HOURS.
 * - A week is settled SETTLE_GRACE_DAYS after it ends (so late reviews can land).
 *   Missing a settled week costs `stake` points, which go into the pot.
 * - Joining closes JOIN_GRACE_DAYS after the start, and members can't leave once it
 *   starts, so everyone is judged on the same weeks and losses can't be erased.
 * - Members who never miss a week split the pot equally; any remainder from the
 *   division goes one point each to the top-ranked survivors so no points vanish.
 * - Each check-in is judged against the members who had joined by its day, so
 *   later membership changes can't flip a decided check-in.
 */

export const REVIEW_WINDOW_HOURS = 48;
export const SETTLE_GRACE_DAYS = 2;
export const JOIN_GRACE_DAYS = 2;

/** Last day anyone can join a challenge. */
export function joinDeadline(startDate: string): string {
  return addDays(startDate, JOIN_GRACE_DAYS);
}

export type CheckInStatus = 'pending' | 'approved' | 'rejected';

export function checkInStatus(args: {
  approvals: number;
  rejections: number;
  otherMembers: number;
  createdAt: Date;
  now: Date;
}): CheckInStatus {
  const { approvals, rejections, otherMembers, createdAt, now } = args;
  if (otherMembers <= 0) return 'approved';
  if (rejections * 2 > otherMembers) return 'rejected';
  if (approvals * 2 >= otherMembers) return 'approved';
  const ageHours = (now.getTime() - createdAt.getTime()) / 3_600_000;
  return ageHours >= REVIEW_WINDOW_HOURS ? 'approved' : 'pending';
}

export interface ScoringInput {
  challenge: { startDate: string; weeks: number; targetPerWeek: number; stake: number };
  members: { userId: number; name: string; joinedOn: string }[];
  checkIns: { userId: number; day: string; status: CheckInStatus }[];
  today: string;
}

export interface WeekResult {
  index: number;
  start: string;
  end: string;
  approved: number;
  pending: number;
  /** false if this member wasn't in the challenge yet for this week */
  counted: boolean;
  settled: boolean;
  /** true/false once known; null while the week is still open and the target isn't hit yet */
  met: boolean | null;
}

export interface Standing {
  userId: number;
  name: string;
  weeks: WeekResult[];
  weeksMet: number;
  weeksMissed: number;
  totalApproved: number;
  streak: number;
  lost: number;
  share: number;
  points: number;
  alive: boolean;
}

export type Phase = 'upcoming' | 'active' | 'settling' | 'finished';

export interface ScoringResult {
  phase: Phase;
  currentWeek: number | null;
  endDate: string;
  pot: number;
  survivors: number;
  standings: Standing[];
}

export function computeStandings({ challenge, members, checkIns, today }: ScoringInput): ScoringResult {
  const { startDate, weeks, targetPerWeek, stake } = challenge;
  const endDate = addDays(startDate, weeks * 7 - 1);

  const sinceStart = diffDays(today, startDate);
  const currentWeek = sinceStart >= 0 && sinceStart < weeks * 7 ? Math.floor(sinceStart / 7) : null;
  const phase: Phase =
    sinceStart < 0
      ? 'upcoming'
      : currentWeek !== null
        ? 'active'
        : diffDays(today, endDate) > SETTLE_GRACE_DAYS
          ? 'finished'
          : 'settling';

  const standings: Standing[] = members.map((m) => {
    const mine = checkIns.filter((c) => c.userId === m.userId);
    let streak = 0;
    let weeksMet = 0;
    let weeksMissed = 0;

    const weekResults: WeekResult[] = [];
    for (let i = 0; i < weeks; i++) {
      const start = addDays(startDate, i * 7);
      const end = addDays(start, 6);
      const inWeek = mine.filter((c) => c.day >= start && c.day <= end);
      const approved = inWeek.filter((c) => c.status === 'approved').length;
      const pending = inWeek.filter((c) => c.status === 'pending').length;
      const counted = diffDays(m.joinedOn, start) <= JOIN_GRACE_DAYS;
      const settled = diffDays(today, end) > SETTLE_GRACE_DAYS;
      const met = approved >= targetPerWeek ? true : settled ? false : null;

      if (counted && met === true) {
        weeksMet++;
        streak++;
      } else if (counted && met === false) {
        weeksMissed++;
        streak = 0;
      }
      weekResults.push({ index: i, start, end, approved, pending, counted, settled, met: counted ? met : null });
    }

    return {
      userId: m.userId,
      name: m.name,
      weeks: weekResults,
      weeksMet,
      weeksMissed,
      totalApproved: mine.filter((c) => c.status === 'approved').length,
      streak,
      lost: weeksMissed * stake,
      share: 0,
      points: 0,
      // Must have been judged on at least one week to be eligible for the pot.
      alive: weeksMissed === 0 && weekResults.some((w) => w.counted),
    };
  });

  const pot = standings.reduce((sum, s) => sum + s.lost, 0);
  const survivors = standings.filter((s) => s.alive).length;
  const share = survivors > 0 ? Math.floor(pot / survivors) : 0;
  let remainder = survivors > 0 ? pot - share * survivors : 0;

  // Hand out the remainder to the strongest survivors first, so the pot is fully paid out.
  const survivorOrder = standings
    .filter((s) => s.alive)
    .sort((a, b) => b.weeksMet - a.weeksMet || b.totalApproved - a.totalApproved || a.userId - b.userId);
  for (const s of standings) s.share = s.alive ? share : 0;
  for (const s of survivorOrder) {
    if (remainder-- <= 0) break;
    s.share += 1;
  }
  for (const s of standings) s.points = s.share - s.lost;

  standings.sort(
    (a, b) =>
      b.points - a.points ||
      b.weeksMet - a.weeksMet ||
      b.totalApproved - a.totalApproved ||
      a.name.localeCompare(b.name),
  );

  return { phase, currentWeek, endDate, pot, survivors, standings };
}
