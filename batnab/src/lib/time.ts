// The database server's clock. Exam start and end are checked by the security rules with the server's time, so
// countdowns use it too rather than a phone clock that may be a few minutes off.
import {onValue, ref} from 'firebase/database';
import {useEffect, useState} from 'react';
import {db} from './firebase';

let offset = 0;
onValue(ref(db, '.info/serverTimeOffset'), (s) => {
  offset = Number(s.val()) || 0;
});

export const serverNow = () => Date.now() + offset;

/** Server time, refreshed every `ms` milliseconds (0: not refreshed). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    if (!ms) return;
    setNow(serverNow());
    const t = setInterval(() => setNow(serverNow()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'];

/** "09:00" in the device's time. */
export const clock = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "10.16 (Ба)" in the device's time. */
export const dayLabel = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${WEEKDAYS[d.getDay()]})`;
};

/** "2 өдөр 3 цаг", "1 цаг 5 мин", "12 мин", "40 сек". */
export function span(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} сек`;
  const m = Math.round(s / 60);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d) return `${d} өдөр${h ? ` ${h} цаг` : ''}`;
  if (h) return `${h} цаг${m % 60 ? ` ${m % 60} мин` : ''}`;
  return `${m} мин`;
}
