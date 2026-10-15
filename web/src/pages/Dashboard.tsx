import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ChallengeSummary } from '../api';
import { useAuth } from '../auth';
import { formatDay } from '../util';

const PHASE_LABEL = { upcoming: 'Starts soon', active: 'Live', settling: 'Settling', finished: 'Finished' } as const;

export function Dashboard() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<ChallengeSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listChallenges()
      .then((r) => setChallenges(r.challenges))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!challenges) return <div className="center muted">Loading…</div>;

  return (
    <div>
      <div className="page-head">
        <h1>Hey {user?.name.split(' ')[0]} 👋</h1>
        <Link to="/new" className="btn">
          + New challenge
        </Link>
      </div>

      {challenges.length === 0 ? (
        <div className="card empty">
          <h3>No challenges yet</h3>
          <p className="muted">Start one and send the invite link to your group chat, or open an invite link a friend sent you.</p>
          <Link to="/new" className="btn">
            Start your first challenge
          </Link>
        </div>
      ) : (
        <div className="grid">
          {challenges.map((c) => {
            const week = c.me?.thisWeek;
            const pct = week ? Math.min(100, (week.approved / c.targetPerWeek) * 100) : 0;
            return (
              <Link to={`/c/${c.id}`} key={c.id} className="card challenge-card">
                <div className="row between">
                  <span className={`badge badge-${c.phase}`}>{PHASE_LABEL[c.phase]}</span>
                  <span className="muted small">
                    {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <h3>{c.title}</h3>
                <p className="muted small">
                  {c.targetPerWeek}× / week · {c.stake} pts a miss · {formatDay(c.startDate)} – {formatDay(c.endDate)}
                </p>

                {c.phase === 'active' && week && (
                  <div className="progress-wrap">
                    <div className="row between small">
                      <span>Week {c.currentWeek! + 1} of {c.weeks}</span>
                      <span>
                        <b>{week.approved}</b>/{c.targetPerWeek}
                        {week.pending > 0 && <span className="muted"> (+{week.pending} pending)</span>}
                      </span>
                    </div>
                    <div className="progress">
                      <div style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}

                <div className="stats-mini">
                  <div>
                    <b>#{c.rank}</b>
                    <span>rank</span>
                  </div>
                  <div>
                    <b>{c.pot}</b>
                    <span>pot</span>
                  </div>
                  <div>
                    <b className={c.me && c.me.points < 0 ? 'neg' : ''}>{c.me?.points ?? 0}</b>
                    <span>your pts</span>
                  </div>
                  <div>
                    <b>{c.me?.streak ?? 0}🔥</b>
                    <span>streak</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
