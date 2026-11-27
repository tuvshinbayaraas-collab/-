// Answers that may have been copied: two students who got the same questions wrong with the same wrong choice, more
// often than chance (or a common mistake the whole class makes) would explain. Only a hint for the teacher to look at:
// a pair of friends who studied together can match too.
import {choiceAt} from './keys';

export interface Sheet {
  uid: string;
  /** A–E or '-' per question, book order. */
  answers: string;
  /** When it was handed in, and how long it took (seconds), when known. */
  at?: number;
  seconds?: number;
}

export interface CopyPair {
  a: string;
  b: string;
  /** Questions both got wrong, and those of them with the same wrong choice (book indexes). */
  bothWrong: number;
  sameWrong: number[];
  /** Of the same wrong choices, the ones few in the class picked (a shared, rare mistake). */
  rare: number[];
  /** Questions both answered, and with the same choice (right or wrong). */
  both: number;
  same: number;
  /** How far apart they handed in (ms), when known. */
  apart?: number;
}

/** A wrong choice picked by fewer than this share of those who answered is rare. */
const RARE = 0.25;

/**
 * The pairs worth a look, most suspicious first. The same wrong choice is common between honest students (the one
 * tempting wrong answer most who slip pick), so only rare ones count: 3+ shared rare wrong choices on sheets much alike
 * overall (60 %+ the same where both answered), or 5+ however alike the rest.
 */
export function copyPairs(sheets: Sheet[], key: string | undefined, count: number): CopyPair[] {
  if (!key || sheets.length < 2) return [];
  // How many picked each choice of each question.
  const picks: Record<string, number>[] = Array.from({length: count}, () => ({}));
  const answered: number[] = Array(count).fill(0);
  for (const s of sheets)
    for (let q = 0; q < count; q++) {
      const c = choiceAt(s.answers, q);
      if (c === null) continue;
      picks[q][c] = (picks[q][c] ?? 0) + 1;
      answered[q]++;
    }
  const out: CopyPair[] = [];
  for (let i = 0; i < sheets.length; i++)
    for (let j = i + 1; j < sheets.length; j++) {
      const A = sheets[i];
      const B = sheets[j];
      let bothWrong = 0;
      let both = 0;
      let same = 0;
      const sameWrong: number[] = [];
      const rare: number[] = [];
      for (let q = 0; q < count; q++) {
        const k = choiceAt(key, q);
        const a = choiceAt(A.answers, q);
        const b = choiceAt(B.answers, q);
        if (k === null || a === null || b === null) continue;
        both++;
        if (a === b) same++;
        if (a === k || b === k) continue;
        bothWrong++;
        if (a !== b) continue;
        sameWrong.push(q);
        // Picked by them two and few others.
        if ((picks[q][a] ?? 0) / Math.max(1, answered[q]) < RARE || (picks[q][a] ?? 0) <= 2) rare.push(q);
      }
      const alike = both > 0 && same / both >= 0.6;
      const flagged = rare.length >= 5 || (alike && rare.length >= 3);
      if (!flagged) continue;
      const apart = A.at && B.at ? Math.abs(A.at - B.at) : undefined;
      out.push({a: A.uid, b: B.uid, bothWrong, sameWrong, rare, both, same, ...(apart !== undefined ? {apart} : {})});
    }
  return out.sort((x, y) => y.rare.length - x.rare.length || y.sameWrong.length - x.sameWrong.length || y.same / y.both - x.same / x.both);
}
