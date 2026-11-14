// A banner across the top of the student's profile (users/{uid}/banner; people/{uid}/banner for others, lib/people),
// behind their picture. Like the frames (lib/frames): the plain ones anyone may take, the special ones open with a badge
// (lib/stats), a leaderboard medal or being a class leader; the rules check the medal and the class leader.

export interface Banner {
  id: string;
  name: string;
  /** The CSS background (gradients and drawn patterns only: nothing to download). */
  bg: string;
  /** What opens it: a badge's id (lib/stats), or being a class leader. */
  earn?: {badge?: string; lead?: true; hint: string};
}

/** A small SVG as a CSS image. */
const svg = (body: string, w: number, h: number) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`;

const SYMBOLS = svg(
  `<g fill='rgba(255,255,255,0.16)' font-family='serif' font-size='20'><text x='6' y='26'>π</text><text x='52' y='18' font-size='16'>√x</text><text x='96' y='34'>∑</text><text x='20' y='66' font-size='15'>x²</text><text x='70' y='62'>∞</text><text x='108' y='72' font-size='15'>∫</text></g>`,
  130,
  84,
);
const STARS = svg(
  `<g fill='white'><circle cx='12' cy='14' r='1.1' opacity='.9'/><circle cx='58' cy='32' r='.8' opacity='.6'/><circle cx='96' cy='10' r='1.3' opacity='.85'/><circle cx='130' cy='44' r='.9' opacity='.7'/><circle cx='34' cy='58' r='.7' opacity='.5'/><circle cx='80' cy='70' r='1.2' opacity='.8'/><circle cx='150' cy='18' r='.7' opacity='.55'/></g>`,
  160,
  80,
);
const GRID = 'repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 18px), repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 18px)';
const STRIPES = 'repeating-linear-gradient(135deg, rgba(255,255,255,0.07) 0 10px, transparent 10px 20px)';

export const BANNERS: Banner[] = [
  {id: 'dusk', name: 'Үдэш', bg: 'linear-gradient(135deg, #1e3a8a, #7c3aed)'},
  {id: 'sea', name: 'Далай', bg: 'linear-gradient(135deg, #0e7490, #1d4ed8)'},
  {id: 'forest', name: 'Ой', bg: 'linear-gradient(135deg, #065f46, #65a30d)'},
  {id: 'sunset', name: 'Нар жаргах', bg: 'linear-gradient(135deg, #be185d, #f59e0b)'},
  {id: 'night', name: 'Шөнө', bg: 'linear-gradient(135deg, #0b1023, #312e81)'},
  {id: 'notebook', name: 'Дэвтэр', bg: `${GRID}, linear-gradient(135deg, #1e293b, #334155)`},
  {id: 'flame', name: 'Галт', bg: 'radial-gradient(circle at 80% 120%, #facc15 0, transparent 45%), linear-gradient(135deg, #7f1d1d, #ea580c)', earn: {badge: 'streak7', hint: '7 өдөр дараалан өдрийн дасгал хийх'}},
  {id: 'formulas', name: 'Томьёо', bg: `${SYMBOLS}, linear-gradient(135deg, #312e81, #0f766e)`, earn: {badge: 'perfect', hint: 'Тестэд бүх бодлогыг зөв бодох'}},
  {id: 'aurora', name: 'Туяа', bg: 'radial-gradient(ellipse at 20% 0%, #22d3ee 0, transparent 55%), radial-gradient(ellipse at 80% 100%, #a855f7 0, transparent 60%), linear-gradient(135deg, #064e3b, #1e1b4b)', earn: {badge: 'topics5', hint: '5 сэдвийг бүрэн бодох'}},
  {id: 'gold', name: 'Алтан', bg: 'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%), linear-gradient(135deg, #92400e, #f59e0b, #fde68a)', earn: {badge: 'medal', hint: 'Leaderboard-оос медаль авах'}},
  {id: 'stars', name: 'Од эрхэс', bg: `${STARS}, radial-gradient(ellipse at 70% 30%, #4c1d95 0, transparent 60%), linear-gradient(135deg, #020617, #1e1b4b)`, earn: {badge: 'streak30', hint: '30 өдөр дараалан өдрийн дасгал хийх'}},
  {id: 'lead', name: 'Ангийн дарга', bg: `${STRIPES}, linear-gradient(135deg, #134e4a, #0d9488)`, earn: {lead: true, hint: 'Багш таныг ангийн дарга болгоход'}},
];

export const bannerOf = (id: string | null | undefined) => (id ? (BANNERS.find((b) => b.id === id) ?? null) : null);

/** The banner without one picked: a quiet one (its colours from the look, index.css). */
export const NO_BANNER = 'var(--banner-none)';
