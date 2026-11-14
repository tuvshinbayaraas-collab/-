// Ready-made pictures for students who don't want to put up a photo. Kept in the photo field as "avatar:<id>".
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

/** The ready-made picture a photo field stands for, if it is one. */
export function avatarOf(photo: string | null | undefined) {
  return photo?.startsWith('avatar:') ? (AVATARS[photo.slice(7)] ?? null) : null;
}
