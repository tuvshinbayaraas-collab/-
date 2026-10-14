import {ArrowLeft, Ban, Check, Pencil, Trash2, X} from 'lucide-react';
import {useState} from 'react';
import Avatar from '../../components/Avatar';
import {formatTime} from '../../lib/attempt';
import {deleteResult, deleteStudent, renameStudent, setBlocked} from '../../lib/accounts';
import {percent} from '../../lib/keys';
import {formatDate} from '../../lib/results';
import {Link, navigate} from '../../lib/router';
import {shownName} from '../../lib/session';
import {TESTS} from '../../tests';
import {gradeOf, mean, type AdminData} from './data';
import {Stat} from './Overview';

export default function StudentDetail({uid, data}: {uid: string; data: AdminData}) {
  const student = data.students.find((s) => s.uid === uid);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!student)
    return (
      <div className="py-16 text-center text-neutral-400">
        Сурагч олдсонгүй.{' '}
        <Link href="/admin?tab=students" className="text-blue-400 hover:underline">
          Сурагчид
        </Link>
      </div>
    );

  const p = student.profile;
  const results = data.results.filter((r) => r.uid === uid);
  const graded = results.map((r) => ({r, g: gradeOf(r, data.keys)}));
  const avg = mean(graded.flatMap(({g}) => (g ? [percent(g)] : [])));

  const act = async (job: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await job();
    } catch (e) {
      alert(`Алдаа: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!confirm(`${p.name}-ийн бүртгэл болон бүх дүнг устгах уу? Буцаах боломжгүй.`)) return;
    act(async () => {
      await deleteStudent(uid);
      navigate('/admin?tab=students');
    });
  };

  return (
    <div className="space-y-6">
      <Link href="/admin?tab=students" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
        <ArrowLeft size={16} /> Сурагчид
      </Link>
      <section className="flex flex-wrap items-center gap-5 rounded-2xl bg-neutral-900 p-5">
        <Avatar name={shownName(p)} photo={p.photo} size={72} />
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(() => renameStudent(uid, name)).then(() => setEditing(false));
              }}
              className="flex gap-2"
            >
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-1.5 outline-none focus:border-blue-500" />
              <button disabled={busy || !name.trim()} aria-label="Хадгалах" className="rounded-full bg-blue-500 px-3 text-black disabled:opacity-50">
                <Check size={16} />
              </button>
              <button type="button" onClick={() => setEditing(false)} aria-label="Болих" className="rounded-full bg-neutral-800 px-3">
                <X size={16} />
              </button>
            </form>
          ) : (
            <h2 className="flex items-center gap-2 text-xl font-bold">
              {p.name}
              <button
                onClick={() => {
                  setName(p.name);
                  setEditing(true);
                }}
                aria-label="Нэр засах"
                className="rounded-full p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
              >
                <Pencil size={15} />
              </button>
            </h2>
          )}
          <p className="text-neutral-400">
            Хоч: {p.nickname || <span className="text-neutral-500">тавиагүй</span>} • @{p.username}
          </p>
          {p.createdAt && <p className="text-sm text-neutral-500">Бүртгэсэн: {formatDate(p.createdAt)}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => act(() => setBlocked(uid, !p.disabled))}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50 ${p.disabled ? 'bg-green-500/15 text-green-300 hover:bg-green-500/25' : 'bg-neutral-800 hover:bg-neutral-700'}`}
          >
            <Ban size={15} /> {p.disabled ? 'Нээх' : 'Түр хаах'}
          </button>
          <button disabled={busy} onClick={remove} className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50">
            <Trash2 size={15} /> Устгах
          </button>
        </div>
      </section>
      {p.disabled && <p className="rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300">Энэ бүртгэл түр хаагдсан: сурагч нэвтэрсэн ч тест өгч чадахгүй.</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Өгсөн тест" value={`${new Set(results.map((r) => r.test)).size}/${TESTS.length}`} />
        <Stat label="Оролдлого" value={results.length} />
        <Stat label="Дундаж оноо" value={avg === null ? '—' : `${Math.round(avg)}%`} />
      </div>

      <section>
        <h3 className="mb-2 font-semibold">Бүх оролдлого</h3>
        {!results.length ? (
          <p className="text-sm text-neutral-400">Одоогоор тест өгөөгүй байна.</p>
        ) : (
          <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
            {graded.map(({r, g}) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <Link href={`/review/${r.test}/${r.id}?u=${uid}`} className="min-w-0 flex-1 hover:underline">
                  <span className="font-medium">{TESTS.find((t) => t.id === r.test)?.title}</span>
                  <span className="block text-sm text-neutral-400">
                    {formatDate(r.at)} • {formatTime(r.seconds)}
                  </span>
                </Link>
                <span className="text-right tabular-nums">{g ? `${g.score}/${g.total} • ${percent(g)}%` : <span className="text-sm text-neutral-500">түлхүүргүй</span>}</span>
                <button
                  disabled={busy}
                  onClick={() => confirm('Энэ оролдлогыг устгах уу?') && act(() => deleteResult(uid, r.test, r.id))}
                  aria-label="Оролдлогыг устгах"
                  className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
