// The part of the syllabus each test question is on (book order), to say after a test what to go over: the
// wrong ones grouped by topic. Tagged by hand from the questions (src/tests/test*.tsx).
export type Skill = 'num' | 'eq' | 'func' | 'log' | 'trig' | 'seq' | 'calc' | 'geo' | 'solid';

export const SKILLS: Record<Skill, string> = {
  num: 'Тоо, илэрхийлэл',
  eq: 'Тэгшитгэл, тэнцэтгэл биш',
  func: 'Функц, график',
  log: 'Илтгэгч, логарифм',
  trig: 'Тригонометр',
  seq: 'Дараалал, хязгаар',
  calc: 'Уламжлал, интеграл',
  geo: 'Хавтгайн геометр',
  solid: 'Огторгуйн геометр',
};

const S: Record<string, Skill[]> = {
  '1A': ['log', 'eq', 'num', 'func', 'trig', 'geo', 'log', 'num', 'num', 'eq', 'func', 'num', 'geo', 'calc', 'eq', 'geo', 'log', 'eq', 'num', 'num', 'calc', 'geo', 'log', 'seq', 'geo', 'solid', 'eq', 'num', 'trig', 'solid'],
  '1B': ['log', 'eq', 'num', 'func', 'trig', 'geo', 'log', 'num', 'num', 'eq', 'func', 'num', 'geo', 'calc', 'eq', 'geo', 'log', 'eq', 'num', 'num', 'calc', 'geo', 'log', 'seq', 'geo', 'solid', 'eq', 'num', 'trig', 'solid'],
  '2A': ['num', 'log', 'eq', 'num', 'num', 'geo', 'func', 'trig', 'log', 'eq', 'seq', 'seq', 'geo', 'num', 'trig', 'log', 'calc', 'func', 'geo', 'func', 'log', 'calc', 'solid', 'func', 'num', 'eq', 'geo', 'func', 'func', 'solid'],
  '2B': ['num', 'log', 'eq', 'num', 'num', 'geo', 'func', 'trig', 'log', 'eq', 'seq', 'seq', 'geo', 'num', 'trig', 'log', 'calc', 'func', 'geo', 'func', 'log', 'calc', 'solid', 'func', 'num', 'eq', 'geo', 'func', 'func', 'solid'],
  '3A': ['num', 'num', 'eq', 'num', 'geo', 'log', 'trig', 'num', 'num', 'eq', 'geo', 'log', 'seq', 'log', 'func', 'num', 'eq', 'trig', 'geo', 'num', 'num', 'seq', 'geo', 'calc', 'trig', 'solid', 'calc', 'trig', 'log', 'solid'],
  '3B': ['num', 'num', 'eq', 'num', 'geo', 'log', 'trig', 'num', 'num', 'eq', 'geo', 'log', 'seq', 'log', 'func', 'num', 'eq', 'trig', 'geo', 'num', 'num', 'seq', 'geo', 'calc', 'trig', 'solid', 'calc', 'trig', 'log', 'solid'],
  '8A': ['num', 'eq', 'num', 'num', 'log', 'eq', 'num', 'trig', 'geo', 'seq', 'func', 'trig', 'eq', 'eq', 'geo', 'num', 'calc', 'geo', 'calc', 'seq', 'trig', 'geo', 'func', 'log', 'eq', 'solid', 'trig', 'num', 'geo', 'log'],
};

/** The topic of question `q` (book order) of test `test`; undefined for a test without tags. */
export const skillOf = (test: string, q: number): Skill | undefined => S[test]?.[q];
