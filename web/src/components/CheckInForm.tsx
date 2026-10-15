import { useRef, useState, type FormEvent } from 'react';
import { api } from '../api';
import { compressImage } from '../util';

export function CheckInForm({ challengeId, day, onDone }: { challengeId: number; day: string; onDone: () => void }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file?: File) {
    if (!file) return;
    setError('');
    try {
      setPhoto(await compressImage(file));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!photo && !note.trim()) {
      setError('Add a photo or a note as proof.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.checkIn(challengeId, { day, note, photo: photo ?? undefined });
      setPhoto(null);
      setNote('');
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card checkin-form" onSubmit={onSubmit}>
      <h3>Check in for today</h3>
      <div className="checkin-body">
        <button type="button" className={`photo-pick ${photo ? 'has' : ''}`} onClick={() => fileRef.current?.click()}>
          {photo ? <img src={photo} alt="Your proof" /> : <span>📸<br />Add photo</span>}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="grow">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you do? (e.g. 45 min push day)" maxLength={280} rows={3} />
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={busy}>
            {busy ? 'Posting…' : 'Post proof'}
          </button>
        </div>
      </div>
    </form>
  );
}
