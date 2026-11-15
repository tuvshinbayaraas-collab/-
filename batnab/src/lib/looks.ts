// More of a student's own on their profile, all picked from what is there (nothing typed): the colour of their name
// (users/{uid}/accent), a small sign beside it (mood) and a title under it (title: a badge they earned, lib/stats).
// Shown on their profile and, for others, from people/{uid} (lib/people).
import {BADGES} from './stats';

export const ACCENTS = [
  {id: 'sky', name: 'Цэнхэр', color: '#38bdf8', light: '#0369a1'},
  {id: 'mint', name: 'Ногоон', color: '#34d399', light: '#047857'},
  {id: 'violet', name: 'Нил ягаан', color: '#a78bfa', light: '#6d28d9'},
  {id: 'rose', name: 'Ягаан', color: '#f472b6', light: '#be185d'},
  {id: 'amber', name: 'Шар', color: '#fbbf24', light: '#b45309'},
  {id: 'orange', name: 'Улбар шар', color: '#fb923c', light: '#c2410c'},
  {id: 'red', name: 'Улаан', color: '#f87171', light: '#b91c1c'},
  {id: 'teal', name: 'Оюу', color: '#2dd4bf', light: '#0f766e'},
] as const;

export const MOODS = [
  {id: 'star', emoji: '⭐'},
  {id: 'fire', emoji: '🔥'},
  {id: 'rocket', emoji: '🚀'},
  {id: 'brain', emoji: '🧠'},
  {id: 'book', emoji: '📚'},
  {id: 'pencil', emoji: '✏️'},
  {id: 'target', emoji: '🎯'},
  {id: 'bolt', emoji: '⚡'},
  {id: 'crown', emoji: '👑'},
  {id: 'smile', emoji: '😎'},
  {id: 'heart', emoji: '💙'},
  {id: 'clover', emoji: '🍀'},
] as const;

/** The colour on the dark look; `light` is the same hue, deep enough to read on the light look's white. */
export const accentOf = (id: string | null | undefined) => ACCENTS.find((a) => a.id === id);
export const moodOf = (id: string | null | undefined) => MOODS.find((m) => m.id === id)?.emoji;
/** The title's words and sign: the badge's. */
export const titleOf = (id: string | null | undefined) => BADGES.find((b) => b.id === id) ?? null;
