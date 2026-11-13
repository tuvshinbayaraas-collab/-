// A frame around the student's picture (users/{uid}/frame; pub/{uid}/frame for classmates, like the photo). The plain
// ones anyone may take; the special ones open with a badge (lib/stats), a leaderboard medal or being a class leader.
// The site checks what is earned; the rules check the medal and the class leader (the rest is only how one looks).

export interface Frame {
  id: string;
  name: string;
  /** The ring's paint (a colour or a gradient). */
  bg: string;
  /** Shown on the ring of a big picture, for the special ones. */
  mark?: string;
  /** What opens it: a badge's id (lib/stats), or being a class leader. */
  earn?: {badge?: string; lead?: true; hint: string};
}

export const FRAMES: Frame[] = [
  {id: 'sky', name: 'Цэнхэр', bg: '#38bdf8'},
  {id: 'mint', name: 'Ногоон', bg: '#34d399'},
  {id: 'violet', name: 'Нил ягаан', bg: '#a78bfa'},
  {id: 'rose', name: 'Ягаан', bg: '#f472b6'},
  {id: 'amber', name: 'Шар', bg: '#fbbf24'},
  {id: 'white', name: 'Цагаан', bg: '#e5e5e5'},
  {id: 'fire', name: 'Галт', bg: 'conic-gradient(from 200deg, #f97316, #ef4444, #facc15, #f97316)', mark: '🔥', earn: {badge: 'streak7', hint: '7 өдөр дараалан өдрийн дасгал хийх'}},
  {id: 'perfect', name: 'Төгс', bg: 'conic-gradient(#22c55e, #14b8a6, #bef264, #22c55e)', mark: '💯', earn: {badge: 'perfect', hint: 'Тестэд бүх бодлогыг зөв бодох'}},
  {id: 'master', name: 'Мастер', bg: 'conic-gradient(#06b6d4, #3b82f6, #a5f3fc, #06b6d4)', mark: '🎯', earn: {badge: 'master', hint: 'Сэдвийн бүх бодлогыг эхний оролдлогоор зөв бодох'}},
  {id: 'rainbow', name: 'Солонго', bg: 'conic-gradient(#ef4444, #f97316, #facc15, #22c55e, #3b82f6, #8b5cf6, #ef4444)', mark: '📚', earn: {badge: 'topics5', hint: '5 сэдвийг бүрэн бодох'}},
  {id: 'gold', name: 'Алтан', bg: 'conic-gradient(#fde68a, #f59e0b, #fef3c7, #b45309, #fde68a)', mark: '🏅', earn: {badge: 'medal', hint: 'Leaderboard-оос медаль авах'}},
  {id: 'galaxy', name: 'Одот', bg: 'conic-gradient(#6366f1, #a855f7, #ec4899, #6366f1)', mark: '🌟', earn: {badge: 'streak30', hint: '30 өдөр дараалан өдрийн дасгал хийх'}},
  {id: 'lead', name: 'Ангийн дарга', bg: 'conic-gradient(#2dd4bf, #0f766e, #99f6e4, #2dd4bf)', mark: '🛡️', earn: {lead: true, hint: 'Багш таныг ангийн дарга болгоход'}},
];

export const frameOf = (id: string | null | undefined) => (id ? (FRAMES.find((f) => f.id === id) ?? null) : null);

/** Whether a frame is open to the student: a plain one always, a special one once its badge (ids) or role is theirs. */
export const isOpen = (f: Frame, badges: Set<string>, lead: boolean) => !f.earn || (f.earn.lead ? lead : !!f.earn.badge && badges.has(f.earn.badge));
