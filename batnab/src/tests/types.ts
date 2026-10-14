import type {ReactNode} from 'react';

export const LETTERS = ['А', 'Б', 'В', 'Г', 'Д'] as const;
export type Letter = (typeof LETTERS)[number];

export interface Question {
  /** Question text; math goes between $…$ (KaTeX). */
  q: string;
  fig?: ReactNode;
  /** Five choices А–Д: text (math between $…$) or a figure. */
  c: (string | ReactNode)[];
  /** The correct choice. */
  a: Letter;
}

export interface Test {
  id: string;
  title: string;
  questions: Question[];
}
