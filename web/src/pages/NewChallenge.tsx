import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { localToday } from '../util';

const IDEAS = ['Gym 3× a week', 'Run 5k twice a week', 'No phone after 11pm', 'Read 20 pages a day', 'Cook at home 4× a week'];

export function NewChallenge() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetPerWeek, setTarget] = useState(3);
  const [stake, setStake] = useState(50);
  const [weeks, setWeeks] = useState(4);
  const [startDate, setStartDate] = useState(localToday());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { challenge } = await api.createChallenge({ title, description, targetPerWeek, stake, weeks, startDate });
      navigate(`/c/${challenge.id}?created=1`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="narrow">
      <h1>New challenge</h1>
      <form className="form card" onSubmit={onSubmit}>
        <label>
          What's the habit?
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={60} placeholder="Gym 3× a week" />
        </label>
        <div className="chips">
          {IDEAS.map((idea) => (
            <button type="button" key={idea} className="chip" onClick={() => setTitle(idea)}>
              {idea}
            </button>
          ))}
        </div>
        <label>
          Rules / what counts as proof <span className="muted">(optional)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} placeholder="Gym selfie or a screenshot of your workout. At least 30 min." />
        </label>

        <div className="form-grid">
          <label>
            Check-ins per week
            <select value={targetPerWeek} onChange={(e) => setTarget(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}× {n === 7 ? '(daily)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Length
            <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'week' : 'weeks'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Points lost per missed week
            <input type="number" min={1} max={1000} value={stake} onChange={(e) => setStake(Number(e.target.value))} required />
          </label>
          <label>
            Start date
            <input type="date" value={startDate} min={localToday()} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
        </div>

        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>
          {busy ? 'Creating…' : 'Create & get invite link'}
        </button>
      </form>
    </div>
  );
}
