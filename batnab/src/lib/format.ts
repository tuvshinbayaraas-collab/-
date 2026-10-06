export function formatViews(n: number): string {
  if (n >= 1_000_000) return `${trim(n / 1_000_000)} сая`;
  if (n >= 1_000) return `${trim(n / 1_000)} мян.`;
  return String(n);
}

const trim = (n: number) => (n >= 10 ? Math.floor(n).toString() : (Math.floor(n * 10) / 10).toString());

export function formatCount(n: number): string {
  return n.toLocaleString('en-US').replace(/,/g, ' ');
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  const units: Array<[number, string]> = [
    [365 * 86400, 'жилийн'],
    [30 * 86400, 'сарын'],
    [7 * 86400, 'долоо хоногийн'],
    [86400, 'өдрийн'],
    [3600, 'цагийн'],
    [60, 'минутын'],
  ];
  for (const [size, label] of units) {
    if (s >= size) return `${Math.floor(s / size)} ${label} өмнө`;
  }
  return 'саяхан';
}

export function formatDuration(total: number): string {
  if (!total) return '';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const pad = (x: number) => x.toString().padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

const AVATAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

export function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
