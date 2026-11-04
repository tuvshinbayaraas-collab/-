import {AlertTriangle, Radio} from 'lucide-react';
import {formatDuration} from '../../lib/attempt';
import {Link} from '../../lib/router';
import {useTestLive} from '../../lib/testLive';
import {useNow} from '../../lib/time';
import {testInfo} from '../../tests';
import type {AdminData} from './data';
import {StudentName} from './Overview';

/** Not heard from for this long, a test left open is no longer "now". */
const STALE = 3 * 3_600_000;

/**
 * "Одоо тест өгч байна": the students taking a practice test right now — which test, how far, how long, and (counted
 * quietly: the student isn't shown it) how often and how long they left the page, out now in red first.
 */
export default function TestsNow({data}: {data: AdminData}) {
  const live = useTestLive();
  const now = useNow(5000);
  const byUid = new Map(data.students.map((s) => [s.uid, s]));
  const rows = (live ?? []).filter((x) => byUid.has(x.uid) && now - x.at < STALE && testInfo(x.test)).sort((a, b) => Number(!!b.out) - Number(!!a.out) || b.leaves - a.leaves || b.at - a.at);
  if (!rows.length) return null;
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-semibold">
        <Radio size={18} className="text-green-400" /> Одоо тест өгч байна ({rows.length})
      </h2>
      <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
        {rows.map((x) => {
          const away = x.away + (x.out ? Math.max(0, now - x.out) : 0);
          return (
            <li key={x.uid} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 ${x.out ? 'bg-red-500/10' : ''}`}>
              <Link href={`/admin/student/${x.uid}`} className="min-w-0 basis-full hover:opacity-80 sm:flex-1 sm:basis-auto">
                <StudentName student={byUid.get(x.uid)!} sub={`${testInfo(x.test)!.title} • ${x.n}/${x.total} хариулсан • ${formatDuration(Math.max(0, now - x.started) / 1000)}`} />
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
      <p className="mt-1.5 text-xs text-neutral-500">Хуудаснаас гарсныг сурагчид харуулахгүйгээр тоолно. Дуусгасны дараа дүнгийн хамт харагдана.</p>
    </section>
  );
}
