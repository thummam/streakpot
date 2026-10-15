import { useEffect, useState } from 'react';
import { fetchPhoto } from '../api';

/** Photos are private to challenge members, so they're fetched with the auth header. */
export function AuthImage({ checkInId, alt }: { checkInId: number; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    fetchPhoto(checkInId)
      .then((u) => {
        url = u;
        if (!cancelled) setSrc(u);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [checkInId]);

  if (failed) return <div className="photo photo-missing">Photo unavailable</div>;
  if (!src) return <div className="photo photo-loading" />;
  return <img className="photo" src={src} alt={alt} loading="lazy" />;
}
