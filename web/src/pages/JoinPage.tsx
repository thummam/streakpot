import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type InvitePreview } from '../api';
import { useAuth } from '../auth';
import { formatDay } from '../util';

export function JoinPage() {
  const { code = '' } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    api.previewInvite(code).then(setInvite).catch((e) => setError(e.message));
  }, [code, loading, user]);

  async function join() {
    setBusy(true);
    try {
      const { challengeId } = await api.joinInvite(code);
      navigate(`/c/${challengeId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (error) return <div className="narrow card"><p className="error">{error}</p><Link to="/">Go home</Link></div>;
  if (!invite) return <div className="center muted">Loading…</div>;
  const c = invite.challenge;

  return (
    <div className="narrow card join">
      <p className="eyebrow">{c.ownerName} invited you</p>
      <h1>{c.title}</h1>
      {c.description && <p className="muted">{c.description}</p>}
      <ul className="facts">
        <li><b>{c.targetPerWeek}×</b> check-ins a week</li>
        <li><b>{c.weeks}</b> {c.weeks === 1 ? 'week' : 'weeks'}, starting {formatDay(c.startDate, { month: 'long', day: 'numeric' })}</li>
        <li><b>{c.stake}</b> points into the pot for each missed week</li>
        <li><b>{c.memberCount}</b> {c.memberCount === 1 ? 'person has' : 'people have'} joined</li>
      </ul>
      {invite.alreadyMember ? (
        <Link className="btn" to={`/c/${c.id}`}>You're in, open challenge</Link>
      ) : user ? (
        <button className="btn btn-big" onClick={join} disabled={busy}>
          {busy ? 'Joining…' : "I'm in"}
        </button>
      ) : (
        <div className="row">
          <Link className="btn btn-big" to={`/signup?next=/join/${code}`}>Sign up to join</Link>
          <Link className="link" to={`/login?next=/join/${code}`}>Log in</Link>
        </div>
      )}
    </div>
  );
}
