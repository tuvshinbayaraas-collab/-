import {ChevronRight, Trophy} from 'lucide-react';
import {PLACES, ranking, useWeekBoard} from '../lib/leaderboard';
import {Link} from '../lib/router';

/** After a test: where the student's best score this week puts them on that test's leaderboard. */
export default function RankLine({test, uid, rid}: {test: string; uid: string; rid: string}) {
  const board = useWeekBoard();
  if (!board) return null;
  const list = ranking(board[test] ?? []);
  const i = list.findIndex((e) => e.uid === uid);
  if (i < 0) return null; // still being added
  const me = list[i];
  const place = i + 1;
  const medal = place <= 3 ? PLACES[place as 1 | 2 | 3] : null;
  const gap = list[2] ? list[2].score - me.score : 0;

  return (
    <Link href={`/leaderboard?test=${test}`} className="mt-4 flex items-center gap-3 rounded-xl bg-neutral-800/60 px-3 py-2.5 hover:bg-neutral-800">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${medal ? medal.badge : 'bg-neutral-700 text-neutral-200'}`}>
        {medal ? <Trophy size={16} /> : place}
      </span>
      <span className="min-w-0 flex-1 text-sm">
        {medal ? (
          <span className={`font-semibold ${medal.text}`}>Leaderboard: та энэ тестээр {place}-р байрт байна!</span>
        ) : (
          <>
            <span className="font-semibold">
              Leaderboard: {place}-р байр <span className="font-normal text-neutral-400">({list.length} сурагчаас)</span>
            </span>
            <span className="block text-neutral-400">{gap > 0 ? `Эхний 3-т орохын тулд ${gap} оноо дутуу.` : 'Оноо тэнцүү, гэхдээ тэр оноог өмнө нь авсан сурагч дээр байна.'}</span>
          </>
        )}
        {me.rid !== rid && <span className="block text-xs text-neutral-500">Энэ долоо хоногийн шилдэг оноо тань ({me.score}/{me.total}) тооцогдоно.</span>}
      </span>
      <ChevronRight size={18} className="shrink-0 text-neutral-500" />
    </Link>
  );
}
