import {AlertTriangle, ChevronDown, CircleSlash, Radio} from 'lucide-react';
import {useState} from 'react';
import {formatDuration} from '../../lib/attempt';
import {Link} from '../../lib/router';
import {useTestLive} from '../../lib/testLive';
import {clock, useNow} from '../../lib/time';
import {testTimeKey, useAllTimeOn} from '../../lib/timeOn';
import {testInfo} from '../../tests';
import type {AdminData} from './data';
import {StudentName} from './Overview';

/** Not heard from for this long, a test left open is no longer "now". */
const STALE = 3 * 3_600_000;
/** Off the page this long: they've stopped working on it (as the time counted takes it, lib/timeOn): off the list, with
 * a note «Бодохоо больсон» for as long again, then not shown. Back on the page, they're on the list again. */
const STOPPED = 30 * 60_000;

// Folded or not, kept on this device.
const FOLD = 'batnab.admin.testsNow.folded';
const readFold = () => {
  try {
    return localStorage.getItem(FOLD) === '1';
  } catch {
    return false;
  }
};

/**
 * "Одоо тест өгч байна": the students taking a practice test right now — which test, how far, how long (the time
 * counted: away over 30 minutes left out), and (counted quietly: the student isn't shown it) how often and how long
 * they left the page, out now in red first. Out over 30 minutes: stopped (a note below for half an hour).
 */
export default function TestsNow({data}: {data: AdminData}) {
  const live = useTestLive();
  const now = useNow(5000);
  const [folded, setFolded] = useState(readFold);
  const fold = () => {
    setFolded(!folded);
    try {
      localStorage.setItem(FOLD, folded ? '0' : '1');
    } catch {
      // storage blocked: for this visit only
    }
  };
  const byUid = new Map(data.students.map((s) => [s.uid, s]));
  const going = (live ?? []).filter((x) => byUid.has(x.uid) && now - x.at < STALE && testInfo(x.test));
  const gone = (x: (typeof going)[number]) => (x.out ? now - x.out : 0);
  const rows = going.filter((x) => gone(x) < STOPPED).sort((a, b) => Number(!!b.out) - Number(!!a.out) || b.leaves - a.leaves || b.at - a.at);
  const stopped = going.filter((x) => gone(x) >= STOPPED && gone(x) < 2 * STOPPED).sort((a, b) => b.out - a.out);
  // How long each has spent on it: the time counted (lib/timeOn), else since it started.
  const times = useAllTimeOn(going.length > 0);
  const took = (x: (typeof going)[number]) => times?.[x.uid]?.[testTimeKey(x.test, x.started)]?.all || Math.max(0, now - x.started) / 1000;
  if (!rows.length && !stopped.length) return null;
  const out = rows.filter((x) => x.out).length;
  return (
    <section>
      <h2 className="mb-2 font-semibold">
        {/* Folds away; folded, who is off the page right now still shows. */}
        <button type="button" onClick={fold} aria-expanded={!folded} className="flex w-full items-center gap-2 rounded-lg text-left hover:opacity-80">
          <Radio size={18} className="shrink-0 text-green-400" /> Одоо тест өгч байна ({rows.length})
          {folded && out > 0 && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">{out} нь одоо гадуур</span>}
          <ChevronDown size={18} className={`ml-auto shrink-0 text-neutral-500 transition-transform ${folded ? '' : 'rotate-180'}`} />
        </button>
      </h2>
      {!folded && (
        <>
          {!rows.length && <p className="rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-neutral-400">Одоо тест өгч буй хүн алга.</p>}
          <ul className={`divide-y divide-neutral-800 rounded-2xl bg-neutral-900 ${rows.length ? '' : 'hidden'}`}>
            {rows.map((x) => {
              const away = x.away + (x.out ? Math.max(0, now - x.out) : 0);
              return (
                <li key={x.uid} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 ${x.out ? 'bg-red-500/10' : ''}`}>
                  <Link href={`/admin/student/${x.uid}`} className="min-w-0 basis-full hover:opacity-80 sm:flex-1 sm:basis-auto">
                    <StudentName student={byUid.get(x.uid)!} sub={`${testInfo(x.test)!.title} • ${x.n}/${x.total} хариулсан • ${formatDuration(took(x))}`} />
                  </Link>
                  {x.out > 0 && (
                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300" title="Тестийн хуудаснаас гарсан (өөр таб, апп эсвэл хуудсаа хаасан)">
                      Одоо гадуур · {formatDuration(Math.max(0, now - x.out) / 1000)}
                    </span>
                  )}
                  {x.leaves > 0 ? (
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300" title="Тест өгөх үеэр хуудаснаас гарсан тоо, нийт хугацаа. Сурагчид харагдахгүй.">
                      <AlertTriangle size={12} /> {x.leaves} удаа гарсан{away >= 1000 ? ` · ${formatDuration(away / 1000)}` : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-500">гараагүй</span>
                  )}
                </li>
              );
            })}
          </ul>
          {stopped.length > 0 && (
            <div className="mt-2 rounded-2xl border border-dashed border-neutral-700 px-4 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
                <CircleSlash size={13} /> Бодохоо больсон — 30 минутаас удаан гарсан (хагас цагийн дараа энд харагдахаа болино)
              </p>
              <ul className="mt-1.5 space-y-1 text-sm">
                {stopped.map((x) => (
                  <li key={x.uid} className="flex flex-wrap items-center gap-x-2">
                    <Link href={`/admin/student/${x.uid}`} className="font-medium hover:underline">
                      {byUid.get(x.uid)!.profile.name}
                    </Link>
                    <span className="text-xs text-neutral-500">
                      {testInfo(x.test)!.title} · {x.n}/{x.total} хариулсан · {clock(x.out)}-д гарсан
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-1.5 text-xs text-neutral-500">Хуудаснаас гарсныг сурагчид харуулахгүйгээр тоолно. Дуусгасны дараа дүнгийн хамт харагдана.</p>
        </>
      )}
    </section>
  );
}
