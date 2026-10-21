import type {Test} from './types';

export interface TestInfo {
  id: string;
  title: string;
  /** Test number; the variants А and Б share it. */
  group: number;
  count: number;
}

export const TESTS: TestInfo[] = [
  {id: '1A', title: 'Тест 1.А', group: 1, count: 30},
  {id: '1B', title: 'Тест 1.Б', group: 1, count: 30},
  {id: '2A', title: 'Тест 2.А', group: 2, count: 30},
  {id: '2B', title: 'Тест 2.Б', group: 2, count: 30},
  {id: '3A', title: 'Тест 3.А', group: 3, count: 30},
  {id: '3B', title: 'Тест 3.Б', group: 3, count: 30},
];

// Each test (with its figures) loads only when it is opened.
const loaders: Record<string, () => Promise<{default: Test}>> = {
  '1A': () => import('./test1A'),
  '1B': () => import('./test1B'),
  '2A': () => import('./test2A'),
  '2B': () => import('./test2B'),
  '3A': () => import('./test3A'),
  '3B': () => import('./test3B'),
};

export const testInfo = (id: string) => TESTS.find((t) => t.id === id);
export const loadTest = (id: string) => loaders[id]?.().then((m) => m.default);
