// Ready-made pictures for students who don't want to put up a photo. Kept in the photo field as "avatar:<id>".
// Or the first letter of their name (what everyone starts with) in a colour of their own: "letter:<id>".
export const AVATARS: Record<string, {emoji: string; bg: string; name: string}> = {
  horse: {emoji: '🐎', bg: '#fde68a', name: 'Морь'},
  eagle: {emoji: '🦅', bg: '#bfdbfe', name: 'Бүргэд'},
  wolf: {emoji: '🐺', bg: '#c7d2fe', name: 'Чоно'},
  camel: {emoji: '🐫', bg: '#fed7aa', name: 'Тэмээ'},
  fox: {emoji: '🦊', bg: '#fecaca', name: 'Үнэг'},
  panda: {emoji: '🐼', bg: '#bbf7d0', name: 'Панда'},
  tiger: {emoji: '🐯', bg: '#fef08a', name: 'Бар'},
  lion: {emoji: '🦁', bg: '#fdba74', name: 'Арслан'},
  bear: {emoji: '🐻', bg: '#e7d3c0', name: 'Баавгай'},
  penguin: {emoji: '🐧', bg: '#a5f3fc', name: 'Оцон шувуу'},
  owl: {emoji: '🦉', bg: '#ddd6fe', name: 'Шар шувуу'},
  cat: {emoji: '🐱', bg: '#fbcfe8', name: 'Муур'},
  dog: {emoji: '🐶', bg: '#d9f99d', name: 'Нохой'},
  unicorn: {emoji: '🦄', bg: '#f5d0fe', name: 'Ганц эвэрт'},
  dragon: {emoji: '🐲', bg: '#a7f3d0', name: 'Луу'},
  robot: {emoji: '🤖', bg: '#cbd5e1', name: 'Робот'},
  rocket: {emoji: '🚀', bg: '#bae6fd', name: 'Пуужин'},
  ball: {emoji: '⚽', bg: '#99f6e4', name: 'Бөмбөг'},
};

export const avatarId = (id: string) => `avatar:${id}`;

/** The colours for the first letter: each deep enough for the white letter on it (4.5:1 and up, both ends of a two-colour one). */
export const LETTERS: {id: string; name: string; bg: string}[] = [
  {id: 'red', name: 'Улаан', bg: '#dc2626'},
  {id: 'rose', name: 'Час улаан', bg: '#be123c'},
  {id: 'orange', name: 'Улбар шар', bg: '#c2410c'},
  {id: 'amber', name: 'Шар', bg: '#b45309'},
  {id: 'brown', name: 'Хүрэн', bg: '#92400e'},
  {id: 'green', name: 'Ногоон', bg: '#15803d'},
  {id: 'teal', name: 'Оюу', bg: '#0f766e'},
  {id: 'cyan', name: 'Номин', bg: '#0e7490'},
  {id: 'sky', name: 'Цэнхэр', bg: '#0369a1'},
  {id: 'blue', name: 'Хөх', bg: '#2563eb'},
  {id: 'indigo', name: 'Индиго', bg: '#4f46e5'},
  {id: 'violet', name: 'Нил ягаан', bg: '#7c3aed'},
  {id: 'fuchsia', name: 'Ягаан нил', bg: '#a21caf'},
  {id: 'pink', name: 'Ягаан', bg: '#db2777'},
  {id: 'slate', name: 'Саарал', bg: '#334155'},
  {id: 'black', name: 'Хар', bg: '#262626'},
  {id: 'dawn', name: 'Үүр', bg: 'linear-gradient(135deg, #db2777, #c2410c)'},
  {id: 'fire', name: 'Гал', bg: 'linear-gradient(135deg, #dc2626, #b45309)'},
  {id: 'forest', name: 'Ой', bg: 'linear-gradient(135deg, #15803d, #0f766e)'},
  {id: 'sea', name: 'Далай', bg: 'linear-gradient(135deg, #0369a1, #4f46e5)'},
  {id: 'space', name: 'Сансар', bg: 'linear-gradient(135deg, #7c3aed, #2563eb)'},
  {id: 'candy', name: 'Чихэр', bg: 'linear-gradient(135deg, #a21caf, #db2777)'},
];

export const letterId = (id: string) => `letter:${id}`;

/** The colour a photo field picks for the first letter, if it picks one. */
export function letterOf(photo: string | null | undefined) {
  return photo?.startsWith('letter:') ? (LETTERS.find((l) => l.id === photo.slice(7)) ?? null) : null;
}

/** Not a photo: a ready-made picture or a coloured letter (kept while the teacher has photos off). */
export const isDrawn = (photo: string | null | undefined) => !!photo && (photo.startsWith('avatar:') || photo.startsWith('letter:'));

/** The ready-made picture a photo field stands for, if it is one. */
export function avatarOf(photo: string | null | undefined) {
  return photo?.startsWith('avatar:') ? (AVATARS[photo.slice(7)] ?? null) : null;
}
