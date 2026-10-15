import { initials } from '../util';

const HUES = [12, 32, 160, 200, 260, 300, 340];

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = HUES[h % HUES.length];
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${hue} 70% 88%)`, color: `hsl(${hue} 60% 28%)` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
