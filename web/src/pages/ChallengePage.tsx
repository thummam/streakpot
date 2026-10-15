import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, type ChallengeDetail, type CheckIn } from '../api';
import { useAuth } from '../auth';
import { AuthImage } from '../components/AuthImage';
import { Avatar } from '../components/Avatar';
import { CheckInForm } from '../components/CheckInForm';
import { formatDay, localToday, timeAgo } from '../util';

const SETTLE_GRACE_DAYS = 2;

export function ChallengePage() {
  const { id } = useParams();
  const challengeId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ChallengeDetail | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api.getChallenge(challengeId).then(setData).catch((e) => setError(e.message));
  }, [challengeId]);

  useEffect(load, [load]);

  if (error) return <div className="card narrow"><p className="error">{error}</p><Link to="/">Back to dashboard</Link></div>;
  if (!data || !user) return <div className="center muted">Loading…</div>;

  const { challenge: c, standings, checkIns, phase, pot, survivors, currentWeek, endDate } = data;
  const me = standings.find((s) => s.userId === user.id);
  const isOwner = c.ownerId === user.id;
  const today = localToday();
  const checkedInToday = checkIns.some((ci) => ci.userId === user.id && ci.day === today);
  const canCheckIn = phase === 'active' && today >= c.startDate && today <= endDate && !checkedInToday;
  const toVote = checkIns.filter((ci) => ci.userId !== user.id && ci.myVote === null && ci.status === 'pending');
  const activity = checkIns.filter((ci) => !toVote.includes(ci));
  const thisWeek = currentWeek !== null ? me?.weeks[currentWeek] : undefined;
  const inviteUrl = `${window.location.origin}/join/${c.inviteCode}`;

  function weekOpen(day: string) {
    const weekIdx = Math.floor((Date.parse(day) - Date.parse(c.startDate)) / 86_400_000 / 7);
    const weekEnd = Date.parse(c.startDate) + (weekIdx * 7 + 6) * 86_400_000;
    return Date.parse(data!.today) - weekEnd <= SETTLE_GRACE_DAYS * 86_400_000;
  }

  async function copyInvite() {
    const text = `Join my StreakPot challenge "${c.title}": ${c.targetPerWeek}× a week for ${c.weeks} weeks. Miss a week and you pay ${c.stake} pts into the pot 😈 ${inviteUrl}`;
    try {
      if (navigator.share && /Mobi/.test(navigator.userAgent)) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user cancelled share sheet
    }
  }

  async function vote(ci: CheckIn, approve: boolean) {
    try {
      await api.vote(ci.id, approve);
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function removeCheckIn(ci: CheckIn) {
    if (!confirm('Delete this check-in?')) return;
    await api.deleteCheckIn(ci.id).catch((e) => alert(e.message));
    load();
  }

  async function deleteOrLeave() {
    if (isOwner) {
      if (!confirm(`Delete "${c.title}" for everyone? This can't be undone.`)) return;
      await api.deleteChallenge(c.id);
    } else {
      if (!confirm(`Leave "${c.title}"?`)) return;
      await api.leaveChallenge(c.id);
    }
    navigate('/');
  }

  return (
    <div className="challenge">
      {params.get('created') && standings.length === 1 && (
        <div className="card callout">
          <div>
            <h3>Challenge created 🎉</h3>
            <p className="muted">It's more fun with friends. Send the invite link to your group chat.</p>
          </div>
          <button className="btn" onClick={copyInvite}>{copied ? 'Copied!' : 'Copy invite link'}</button>
          <button className="link" onClick={() => setParams({})} aria-label="Dismiss">✕</button>
        </div>
      )}

      <section className="challenge-head">
        <div>
          <span className={`badge badge-${phase}`}>
            {phase === 'active' ? `Week ${currentWeek! + 1} of ${c.weeks}` : phase === 'upcoming' ? `Starts ${formatDay(c.startDate)}` : phase === 'settling' ? 'Final reviews' : 'Finished'}
          </span>
          <h1>{c.title}</h1>
          {c.description && <p className="muted">{c.description}</p>}
          <p className="muted small">
            {c.targetPerWeek}× per week · {c.stake} pts per missed week · {formatDay(c.startDate)} – {formatDay(endDate)}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={copyInvite}>{copied ? 'Copied!' : '🔗 Invite friends'}</button>
      </section>

      <section className="stats">
        <div className="stat card"><span>Pot</span><b>{pot}</b><small>{survivors} still in the running</small></div>
        <div className="stat card"><span>Your points</span><b className={me && me.points < 0 ? 'neg' : ''}>{me?.points ?? 0}</b><small>{phase === 'finished' ? 'final' : 'if it ended now'}</small></div>
        <div className="stat card"><span>Streak</span><b>{me?.streak ?? 0} 🔥</b><small>weeks in a row</small></div>
        <div className="stat card">
          <span>This week</span>
          <b>{thisWeek ? `${thisWeek.approved}/${c.targetPerWeek}` : '–'}</b>
          <small>{thisWeek?.pending ? `${thisWeek.pending} awaiting votes` : thisWeek && thisWeek.approved >= c.targetPerWeek ? 'target hit ✅' : 'approved check-ins'}</small>
        </div>
      </section>

      {canCheckIn && <CheckInForm challengeId={c.id} day={today} onDone={load} />}
      {phase === 'active' && checkedInToday && <p className="done-today">✅ You've checked in today. See you tomorrow.</p>}

      {toVote.length > 0 && (
        <section>
          <h2>Needs your vote <span className="count">{toVote.length}</span></h2>
          <div className="feed">
            {toVote.map((ci) => (
              <CheckInCard key={ci.id} ci={ci} mine={false} canAct onVote={vote} onDelete={removeCheckIn} highlight />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>Leaderboard</h2>
        <div className="card table-wrap">
          <table className="board">
            <thead>
              <tr>
                <th>#</th>
                <th>Member</th>
                <th>Weeks</th>
                <th className="num">Streak</th>
                <th className="num">Points</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.userId} className={s.userId === user.id ? 'me' : ''}>
                  <td>{i + 1}</td>
                  <td>
                    <span className="member">
                      <Avatar name={s.name} size={26} />
                      {s.name}
                      {!s.alive && <span className="badge badge-out">out of pot</span>}
                    </span>
                  </td>
                  <td>
                    <span className="weeks">
                      {s.weeks.map((w) => (
                        <span
                          key={w.index}
                          className={`wk ${!w.counted ? 'wk-na' : w.met === true ? 'wk-met' : w.met === false ? 'wk-miss' : currentWeek === w.index ? 'wk-now' : 'wk-future'}`}
                          title={`Week ${w.index + 1}: ${w.counted ? `${w.approved}/${c.targetPerWeek} approved${w.pending ? `, ${w.pending} pending` : ''}` : 'not joined yet'}`}
                        >
                          {currentWeek === w.index && w.met !== true ? w.approved : ''}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="num">{s.streak}</td>
                  <td className={`num ${s.points < 0 ? 'neg' : s.points > 0 ? 'pos' : ''}`}>{s.points > 0 ? `+${s.points}` : s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Activity</h2>
        {activity.length === 0 ? (
          <p className="muted">{toVote.length ? 'Nothing else yet.' : 'No check-ins yet. Be the first.'}</p>
        ) : (
          <div className="feed">
            {activity.map((ci) => (
              <CheckInCard key={ci.id} ci={ci} mine={ci.userId === user.id} canAct={weekOpen(ci.day)} onVote={vote} onDelete={removeCheckIn} />
            ))}
          </div>
        )}
      </section>

      <footer className="danger">
        <button className="link danger-link" onClick={deleteOrLeave}>
          {isOwner ? 'Delete challenge' : 'Leave challenge'}
        </button>
      </footer>
    </div>
  );
}

function CheckInCard({
  ci,
  mine,
  canAct,
  onVote,
  onDelete,
  highlight,
}: {
  ci: CheckIn;
  mine: boolean;
  canAct: boolean;
  onVote: (ci: CheckIn, approve: boolean) => void;
  onDelete: (ci: CheckIn) => void;
  highlight?: boolean;
}) {
  return (
    <article className={`card checkin ${highlight ? 'highlight' : ''}`}>
      <header className="row between">
        <span className="member">
          <Avatar name={ci.userName} size={30} />
          <span>
            <b>{ci.userName}</b>
            <br />
            <small className="muted">{formatDay(ci.day, { weekday: 'short', month: 'short', day: 'numeric' })} · {timeAgo(ci.createdAt)}</small>
          </span>
        </span>
        <span className={`badge badge-${ci.status}`}>{ci.status}</span>
      </header>
      {ci.hasPhoto && <AuthImage checkInId={ci.id} alt={`${ci.userName}'s proof`} />}
      {ci.note && <p>{ci.note}</p>}
      <footer className="row between">
        <small className="muted">
          👍 {ci.approvals} · 👎 {ci.rejections}
        </small>
        {canAct &&
          (mine ? (
            <button className="link small" onClick={() => onDelete(ci)}>Delete</button>
          ) : (
            <span className="row vote">
              <button className={`btn btn-small ${ci.myVote === true ? '' : 'btn-ghost'}`} onClick={() => onVote(ci, true)}>Legit 👍</button>
              <button className={`btn btn-small ${ci.myVote === false ? 'btn-bad' : 'btn-ghost'}`} onClick={() => onVote(ci, false)}>Cap 🧢</button>
            </span>
          ))}
      </footer>
    </article>
  );
}
