import { describe, expect, it } from 'vitest';
import { checkInStatus, computeStandings } from '../src/scoring.js';

const now = new Date('2026-03-10T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe('checkInStatus', () => {
  it('auto-approves when nobody else can vote', () => {
    expect(checkInStatus({ approvals: 0, rejections: 0, otherMembers: 0, createdAt: now, now })).toBe('approved');
  });
  it('approves once half the other members say yes', () => {
    expect(checkInStatus({ approvals: 2, rejections: 0, otherMembers: 4, createdAt: now, now })).toBe('approved');
  });
  it('rejects only on a strict majority of no votes', () => {
    expect(checkInStatus({ approvals: 0, rejections: 2, otherMembers: 4, createdAt: now, now })).toBe('pending');
    expect(checkInStatus({ approvals: 0, rejections: 3, otherMembers: 4, createdAt: now, now })).toBe('rejected');
  });
  it('approves undecided check-ins after the review window', () => {
    expect(checkInStatus({ approvals: 0, rejections: 1, otherMembers: 4, createdAt: hoursAgo(47), now })).toBe('pending');
    expect(checkInStatus({ approvals: 0, rejections: 1, otherMembers: 4, createdAt: hoursAgo(49), now })).toBe('approved');
  });
});

describe('computeStandings', () => {
  const challenge = { startDate: '2026-03-02', weeks: 2, targetPerWeek: 2, stake: 10 };
  const members = [
    { userId: 1, name: 'Ana', joinedOn: '2026-03-01' },
    { userId: 2, name: 'Ben', joinedOn: '2026-03-01' },
    { userId: 3, name: 'Cy', joinedOn: '2026-03-01' },
  ];
  const ok = (userId: number, day: string) => ({ userId, day, status: 'approved' as const });

  it('settles finished challenges and splits the pot among survivors', () => {
    const checkIns = [
      ok(1, '2026-03-02'), ok(1, '2026-03-03'), ok(1, '2026-03-09'), ok(1, '2026-03-10'),
      ok(2, '2026-03-02'), ok(2, '2026-03-04'), ok(2, '2026-03-11'), // Ben misses week 2
      ok(3, '2026-03-05'), // Cy misses both weeks
    ];
    const result = computeStandings({ challenge, members, checkIns, today: '2026-03-20' });
    expect(result.phase).toBe('finished');
    expect(result.pot).toBe(30);
    expect(result.survivors).toBe(1);
    expect(result.standings.map((s) => [s.name, s.points])).toEqual([
      ['Ana', 30],
      ['Ben', -10],
      ['Cy', -20],
    ]);
    expect(result.standings[0].streak).toBe(2);
  });

  it('does not judge the current week until it is settled', () => {
    const result = computeStandings({ challenge, members, checkIns: [ok(1, '2026-03-02')], today: '2026-03-04' });
    expect(result.phase).toBe('active');
    expect(result.currentWeek).toBe(0);
    expect(result.pot).toBe(0);
    expect(result.standings.every((s) => s.weeks[0].met === null || s.weeks[0].met === true)).toBe(true);
  });

  it('gives a grace period after a week ends before charging the stake', () => {
    expect(computeStandings({ challenge, members, checkIns: [], today: '2026-03-10' }).pot).toBe(0);
    expect(computeStandings({ challenge, members, checkIns: [], today: '2026-03-11' }).pot).toBe(30);
  });

  it('ignores weeks before a late joiner joined', () => {
    const late = [{ userId: 4, name: 'Dee', joinedOn: '2026-03-08' }];
    const result = computeStandings({
      challenge,
      members: late,
      checkIns: [ok(4, '2026-03-09'), ok(4, '2026-03-10')],
      today: '2026-03-20',
    });
    expect(result.standings[0].weeks[0].counted).toBe(false);
    expect(result.standings[0].weeksMissed).toBe(0);
    expect(result.standings[0].alive).toBe(true);
  });
});
