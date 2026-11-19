// What a test result says to go over: the questions grouped by topic (tests/skills.ts), right of those with a key.
import {SKILLS, skillOf, type Skill} from '../tests/skills';
import {choiceAt} from './keys';

export interface SkillStat {
  skill: Skill;
  name: string;
  /** Questions of this topic with a right answer set, and how many of them were right. */
  total: number;
  right: number;
  /** Book indexes of the ones got wrong (or left out). */
  wrong: number[];
}

/**
 * One or more attempts (answers A–E/'-' in book order, with their test's key), topic by topic, weakest first (lowest
 * share right, then most wrong). Topics with no keyed question are left out.
 */
export function skillStats(sheets: {test: string; answers: string; key: string | null | undefined}[]): SkillStat[] {
  const by = new Map<Skill, SkillStat>();
  for (const {test, answers, key} of sheets) {
    if (!key) continue;
    for (let q = 0; q < key.length; q++) {
      const k = choiceAt(key, q);
      const skill = skillOf(test, q);
      if (k === null || !skill) continue;
      const s = by.get(skill) ?? {skill, name: SKILLS[skill], total: 0, right: 0, wrong: []};
      s.total++;
      if (choiceAt(answers, q) === k) s.right++;
      else s.wrong.push(q);
      by.set(skill, s);
    }
  }
  return [...by.values()].sort((a, b) => a.right / a.total - b.right / b.total || b.wrong.length - a.wrong.length);
}

/** The topics to go over first: up to `n` of the weakest that have a mistake, under 80 % right. */
export const toReview = (stats: SkillStat[], n = 2) => stats.filter((s) => s.wrong.length > 0 && s.right / s.total < 0.8).slice(0, n);

/** A word on a score: what it means, and where to go from here. */
export function verdict(percent: number, review: SkillStat[]) {
  const first = review.map((s) => s.name).join(', ');
  if (percent >= 90) return review.length ? `Маш сайн! Бараг бүгдийг зөв бодсон. ${first} сэдэвт гаргасан алдаагаа хараарай.` : 'Маш сайн! Бүх сэдвээр сайн бодсон байна.';
  if (percent >= 70) return `Сайн байна. ${first ? `${first} сэдвээ давтвал` : 'Цөөн алдаагаа засвал'} дүн улам өснө.`;
  if (percent >= 40) return `Дунд зэрэг. ${first ? `Хамгийн их алдсан ${first} сэдвээ эхэлж давтаарай.` : 'Алдсан бодлогуудаа давтаарай.'}`;
  return `Суурь мэдлэгээ сайн давтах хэрэгтэй. ${first ? `${first} сэдвээс эхлээд` : 'Алдсан бодлогуудаасаа эхлээд'} алдааны дэвтрээ өдөр бүр давтаарай.`;
}
