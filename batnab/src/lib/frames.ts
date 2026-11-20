// A frame around the student's picture (users/{uid}/frame; pub/{uid}/frame for classmates, like the photo). The plain
// ones anyone may take; the special ones open with a badge (lib/stats), a leaderboard medal or being a class leader.
// The site checks what is earned; the rules check the medal and the class leader (the rest is only how one looks).

export interface Frame {
  id: string;
  name: string;
  /** The ring's paint (a colour or a gradient). */
  bg: string;
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
  {id: 'dawn', name: 'Үүр', bg: 'linear-gradient(135deg, #f472b6, #fb923c, #fde047)'},
  {id: 'aqua', name: 'Ус', bg: 'linear-gradient(135deg, #22d3ee, #6366f1)'},
  // The special ones carry an ornament too (components/FrameOrnament).
  {id: 'fire', name: 'Галт', bg: 'conic-gradient(from 200deg, #f97316, #ef4444, #facc15, #f97316)', earn: {badge: 'streak7', hint: '7 өдөр дараалан өдрийн дасгал хийх'}},
  {id: 'perfect', name: 'Төгс', bg: 'linear-gradient(135deg, #86efac, #16a34a)', earn: {badge: 'perfect', hint: 'Тестэд бүх бодлогыг зөв бодох'}},
  {id: 'master', name: 'Мастер', bg: 'linear-gradient(135deg, #67e8f9, #2563eb)', earn: {badge: 'master', hint: 'Сэдвийн бүх бодлогыг эхний оролдлогоор зөв бодох'}},
  {id: 'rainbow', name: 'Солонго', bg: 'conic-gradient(#ef4444, #f97316, #facc15, #22c55e, #3b82f6, #8b5cf6, #ef4444)', earn: {badge: 'topics5', hint: '5 сэдвийг бүрэн бодох'}},
  {id: 'gold', name: 'Алтан', bg: 'linear-gradient(135deg, #fde68a, #d97706, #fef3c7)', earn: {badge: 'medal', hint: 'Leaderboard-оос медаль авах'}},
  {id: 'galaxy', name: 'Одот', bg: 'linear-gradient(135deg, #a78bfa, #6366f1, #f0abfc)', earn: {badge: 'streak30', hint: '30 өдөр дараалан өдрийн дасгал хийх'}},
  {id: 'lead', name: 'Ангийн дарга', bg: 'linear-gradient(135deg, #5eead4, #0f766e)', earn: {lead: true, hint: 'Багш таныг ангийн дарга болгоход'}},
];

export const frameOf = (id: string | null | undefined) => (id ? (FRAMES.find((f) => f.id === id) ?? null) : null);

/** Whether a frame is open to the student: a plain one always, a special one once its badge (ids) or role is theirs. */
export const isOpen = (f: Frame, badges: Set<string>, lead: boolean) => !f.earn || (f.earn.lead ? lead : !!f.earn.badge && badges.has(f.earn.badge));
