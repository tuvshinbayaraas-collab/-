// A banner across the top of the student's profile (users/{uid}/banner; people/{uid}/banner for others, lib/people),
// behind their picture. Like the frames (lib/frames): the plain ones anyone may take, the special ones open with a badge
// (lib/stats), a leaderboard medal or being a class leader; the rules check the medal and the class leader.

export interface Banner {
  id: string;
  name: string;
  /** The CSS background (gradients and drawn patterns only: nothing to download). */
  bg: string;
  /** How it moves, where motion is welcome (index.css): its first layer drifts or shines, or the whole glows. */
  fx?: 'drift' | 'shine' | 'glow';
  /** What opens it: a badge's id (lib/stats), or being a class leader. */
  earn?: {badge?: string; lead?: true; hint: string};
}

/** A small SVG as a CSS image. */
const svg = (body: string, w: number, h: number) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`;

const SYMBOLS = svg(
  `<g fill='rgba(255,255,255,0.16)' font-family='serif' font-size='20'><text x='6' y='26'>π</text><text x='52' y='18' font-size='16'>√x</text><text x='96' y='34'>∑</text><text x='20' y='66' font-size='15'>x²</text><text x='70' y='62'>∞</text><text x='108' y='72' font-size='15'>∫</text><text x='136' y='30' font-size='15'>Δ</text></g>`,
  160,
  84,
);
const STARS = svg(
  `<g fill='white'><circle cx='12' cy='14' r='1.1' opacity='.9'/><circle cx='58' cy='32' r='.8' opacity='.6'/><circle cx='96' cy='10' r='1.3' opacity='.85'/><circle cx='130' cy='44' r='.9' opacity='.7'/><circle cx='34' cy='58' r='.7' opacity='.5'/><circle cx='80' cy='70' r='1.2' opacity='.8'/><circle cx='150' cy='18' r='.7' opacity='.55'/></g>`,
  160,
  80,
);
/** A drawn scene along the bottom, stretched to the banner's width. */
const scene = (body: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 100' preserveAspectRatio='xMidYMax slice'>${body}</svg>`)}") bottom / 100% 100% no-repeat`;
const MOUNTAINS = scene(`<path d='M0 100 L0 70 L60 38 L110 66 L170 22 L240 68 L290 44 L350 72 L400 50 L400 100Z' fill='rgba(15,23,42,0.45)'/><path d='M0 100 L0 84 L80 60 L150 82 L230 56 L320 84 L400 66 L400 100Z' fill='rgba(15,23,42,0.5)'/><circle cx='320' cy='22' r='9' fill='rgba(255,255,255,0.75)'/>`);
const WAVES = scene(`<path d='M0 62 Q25 50 50 62 T100 62 T150 62 T200 62 T250 62 T300 62 T350 62 T400 62 V100 H0Z' fill='rgba(255,255,255,0.14)'/><path d='M0 76 Q25 66 50 76 T100 76 T150 76 T200 76 T250 76 T300 76 T350 76 T400 76 V100 H0Z' fill='rgba(255,255,255,0.16)'/><path d='M0 90 Q25 82 50 90 T100 90 T150 90 T200 90 T250 90 T300 90 T350 90 T400 90 V100 H0Z' fill='rgba(255,255,255,0.18)'/>`);
const tree = (x: number, h: number) => `<path d='M${x} ${100 - h} L${x + h * 0.32} 100 L${x - h * 0.32} 100Z'/>`;
const TREES = scene(`<g fill='rgba(6,40,30,0.55)'>${[20, 55, 95, 140, 180, 225, 262, 300, 345, 385].map((x, i) => tree(x, 34 + ((i * 17) % 26))).join('')}</g><g fill='rgba(6,40,30,0.75)'>${[38, 118, 205, 280, 365].map((x, i) => tree(x, 22 + ((i * 11) % 14))).join('')}</g>`);
const SUN = scene(`<circle cx='200' cy='78' r='34' fill='rgba(255,236,170,0.85)'/><path d='M0 100 L0 80 Q100 62 200 80 T400 78 L400 100Z' fill='rgba(80,20,50,0.55)'/>`);
const MOON = scene(`<circle cx='318' cy='30' r='15' fill='rgba(254,249,195,0.9)'/><circle cx='311' cy='26' r='13' fill='rgb(22,24,60)'/><g fill='white'><circle cx='40' cy='20' r='1.6' opacity='.8'/><circle cx='110' cy='44' r='1.2' opacity='.6'/><circle cx='180' cy='16' r='1.5' opacity='.7'/><circle cx='250' cy='52' r='1.1' opacity='.5'/><circle cx='372' cy='62' r='1.3' opacity='.6'/></g>`);
const EMBERS = svg(`<g fill='rgba(253,224,71,0.8)'><circle cx='14' cy='60' r='1.6'/><circle cx='52' cy='24' r='1.1'/><circle cx='88' cy='70' r='1.3'/><circle cx='126' cy='36' r='1'/><circle cx='150' cy='66' r='1.5'/></g>`, 160, 80);

const GRID = 'repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 18px), repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 18px)';
const STRIPES = 'repeating-linear-gradient(135deg, rgba(255,255,255,0.07) 0 10px, transparent 10px 20px)';

export const BANNERS: Banner[] = [
  {id: 'dusk', name: 'Үдэш', bg: `${MOUNTAINS}, linear-gradient(135deg, #1e3a8a, #7c3aed)`},
  {id: 'sea', name: 'Далай', bg: `${WAVES}, linear-gradient(135deg, #0e7490, #1d4ed8)`},
  {id: 'forest', name: 'Ой', bg: `${TREES}, linear-gradient(135deg, #065f46, #65a30d)`},
  {id: 'sunset', name: 'Нар жаргах', bg: `${SUN}, linear-gradient(180deg, #be185d, #f59e0b)`},
  {id: 'night', name: 'Шөнө', bg: `${MOON}, linear-gradient(135deg, #0b1023, #312e81)`},
  {id: 'notebook', name: 'Дэвтэр', bg: `${GRID}, linear-gradient(135deg, #1e293b, #334155)`},
  {id: 'flame', name: 'Галт', fx: 'drift', bg: `${EMBERS}, radial-gradient(circle at 80% 120%, #facc15 0, transparent 45%), linear-gradient(135deg, #7f1d1d, #ea580c)`, earn: {badge: 'streak7', hint: '7 өдөр дараалан өдрийн дасгал хийх'}},
  {id: 'formulas', name: 'Томьёо', fx: 'drift', bg: `${SYMBOLS}, linear-gradient(135deg, #312e81, #0f766e)`, earn: {badge: 'perfect', hint: 'Тестэд бүх бодлогыг зөв бодох'}},
  {id: 'aurora', name: 'Туяа', fx: 'glow', bg: 'radial-gradient(ellipse at 20% 0%, #22d3ee 0, transparent 55%), radial-gradient(ellipse at 80% 100%, #a855f7 0, transparent 60%), linear-gradient(135deg, #064e3b, #1e1b4b)', earn: {badge: 'topics5', hint: '5 сэдвийг бүрэн бодох'}},
  {id: 'gold', name: 'Алтан', fx: 'shine', bg: 'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%) 160% 0 / 220% 100% no-repeat, linear-gradient(135deg, #92400e, #f59e0b, #fde68a)', earn: {badge: 'medal', hint: 'Leaderboard-оос медаль авах'}},
  {id: 'stars', name: 'Од эрхэс', fx: 'drift', bg: `${STARS}, radial-gradient(ellipse at 70% 30%, #4c1d95 0, transparent 60%), linear-gradient(135deg, #020617, #1e1b4b)`, earn: {badge: 'streak30', hint: '30 өдөр дараалан өдрийн дасгал хийх'}},
  {id: 'lead', name: 'Ангийн дарга', bg: `${STRIPES}, linear-gradient(135deg, #134e4a, #0d9488)`, earn: {lead: true, hint: 'Багш таныг ангийн дарга болгоход'}},
];

export const bannerOf = (id: string | null | undefined) => (id ? (BANNERS.find((b) => b.id === id) ?? null) : null);

/** The banner without one picked: a quiet one (its colours from the look, index.css). */
export const NO_BANNER = 'var(--banner-none)';
