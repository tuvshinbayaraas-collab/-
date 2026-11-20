// A profile's own colours and an effect over it, as on Discord: the card under the banner goes from one colour at the
// top to another at the bottom (users/{uid}/theme), and small things drift over it (users/{uid}/effect). Others see
// them from people/{uid} (lib/people). Like the frames and banners (lib/frames, lib/banners): most are open to all, the
// special ones open with a badge (lib/stats); the rules check the medal.

export interface Earn {
  badge: string;
  hint: string;
}

export interface Theme {
  id: string;
  name: string;
  /** Top and bottom on the dark look: deep enough for the site's grey text (4.5:1 or more). */
  dark: [string, string];
  /** The same on the light look: pale enough for its dark text. */
  light: [string, string];
  earn?: Earn;
}

export const THEMES: Theme[] = [
  {id: 'night', name: 'Шөнө', dark: ['#1e1b4b', '#2e1065'], light: ['#e0e7ff', '#ede9fe']},
  {id: 'ocean', name: 'Далай', dark: ['#062a42', '#172554'], light: ['#e0f2fe', '#dbeafe']},
  {id: 'forest', name: 'Ой', dark: ['#052e16', '#022c22'], light: ['#dcfce7', '#d1fae5']},
  {id: 'sunset', name: 'Жаргал', dark: ['#500724', '#431407'], light: ['#fce7f3', '#ffedd5']},
  {id: 'fire', name: 'Гал', dark: ['#450a0a', '#431407'], light: ['#fee2e2', '#ffedd5']},
  {id: 'candy', name: 'Чихэр', dark: ['#500724', '#2e1065'], light: ['#fce7f3', '#ede9fe']},
  {id: 'mint', name: 'Гаа', dark: ['#042f2e', '#062a42'], light: ['#ccfbf1', '#e0f2fe']},
  {id: 'galaxy', name: 'Сансар', dark: ['#2e1065', '#062b38'], light: ['#ede9fe', '#cffafe']},
  {id: 'berry', name: 'Нэрс', dark: ['#4a044e', '#1e1b4b'], light: ['#fae8ff', '#e0e7ff']},
  {id: 'mono', name: 'Хар цагаан', dark: ['#262626', '#0a0a0a'], light: ['#f5f5f5', '#e5e5e5']},
  {id: 'gold', name: 'Алтан', dark: ['#422006', '#451a03'], light: ['#fef9c3', '#fef3c7'], earn: {badge: 'medal', hint: 'Тест эсвэл тоглоомоос медаль авах'}},
];

export interface Effect {
  id: string;
  name: string;
  /** How the bits move: down, up, in place, or across. */
  motion: 'fall' | 'rise' | 'twinkle' | 'shoot';
  /** What each bit is: a dot, a ring, a strip of paper, a streak, a heart, or one of the signs in `glyphs`. */
  shape: 'dot' | 'ring' | 'rect' | 'streak' | 'heart' | 'text';
  glyphs?: string[];
  colors: string[];
  /** Seconds for one bit to cross (each a little different). */
  speed: number;
  /** The bits' size in pixels (each a little different). */
  size: number;
  /** Swaying side to side as they go, or turning over. */
  extra?: 'sway' | 'spin';
  glow?: true;
  earn?: Earn;
}

export const EFFECTS: Effect[] = [
  {id: 'snow', name: 'Цас', motion: 'fall', shape: 'dot', colors: ['#ffffff', '#e0f2fe', '#bae6fd'], speed: 9, size: 5, extra: 'sway'},
  {id: 'stars', name: 'Гялбаа', motion: 'twinkle', shape: 'text', glyphs: ['✦', '✧', '✦'], colors: ['#fef9c3', '#ffffff', '#c7d2fe'], speed: 3, size: 11},
  {id: 'bubbles', name: 'Бөмбөлөг', motion: 'rise', shape: 'ring', colors: ['#7dd3fc', '#a5f3fc', '#c4b5fd'], speed: 10, size: 9, extra: 'sway'},
  {id: 'hearts', name: 'Зүрх', motion: 'rise', shape: 'heart', colors: ['#f472b6', '#fb7185', '#f9a8d4'], speed: 9, size: 10, extra: 'sway'},
  {id: 'math', name: 'Томьёо', motion: 'rise', shape: 'text', glyphs: ['π', '√', '∑', '∫', '∞', 'x²', 'Δ', '÷'], colors: ['#c7d2fe', '#a5f3fc', '#fde68a'], speed: 14, size: 13},
  {id: 'embers', name: 'Оч', motion: 'rise', shape: 'dot', colors: ['#fb923c', '#facc15', '#f87171'], speed: 7, size: 4, extra: 'sway', glow: true, earn: {badge: 'streak7', hint: '7 өдөр дараалан өдрийн дасгал хийх'}},
  {id: 'confetti', name: 'Конфетти', motion: 'fall', shape: 'rect', colors: ['#f472b6', '#facc15', '#34d399', '#60a5fa', '#a78bfa'], speed: 8, size: 9, extra: 'spin', earn: {badge: 'perfect', hint: 'Тестэд бүх бодлогыг зөв бодох'}},
  {id: 'comets', name: 'Од харвах', motion: 'shoot', shape: 'streak', colors: ['#ffffff', '#c7d2fe', '#a5f3fc'], speed: 6, size: 10, earn: {badge: 'streak30', hint: '30 өдөр дараалан өдрийн дасгал хийх'}},
  {id: 'gold', name: 'Алтан гялбаа', motion: 'twinkle', shape: 'text', glyphs: ['✦', '✧', '✦'], colors: ['#fde68a', '#fbbf24', '#fef3c7'], speed: 2.6, size: 12, glow: true, earn: {badge: 'medal', hint: 'Тест эсвэл тоглоомоос медаль авах'}},
];

export const themeOf = (id: string | null | undefined) => (id ? (THEMES.find((t) => t.id === id) ?? null) : null);
export const effectOf = (id: string | null | undefined) => (id ? (EFFECTS.find((e) => e.id === id) ?? null) : null);

/** Open to the student: a plain one always, a special one once its badge (ids) is theirs. */
export const isOpenTo = (x: {earn?: Earn}, badges: Set<string>) => !x.earn || badges.has(x.earn.badge);
