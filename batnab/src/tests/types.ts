import type {ReactNode} from 'react';

/** Choice labels as printed in the book. */
export const LETTERS = ['А', 'Б', 'В', 'Г', 'Д'] as const;
/** The same choices as stored in the database (answers and keys): A–E, '-' for none. */
export const CODES = 'ABCDE';

export interface Question {
  /** Question text; math goes between $…$ (KaTeX). */
  q: string;
  fig?: ReactNode;
  /** Five choices А–Д: text (math between $…$) or a figure. The answer key is entered by the teacher on the site. */
  c: (string | ReactNode)[];
}

export interface Test {
  id: string;
  title: string;
  questions: Question[];
}
