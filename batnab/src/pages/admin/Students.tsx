import {ChevronRight, Copy, Download, RefreshCw, Search, UserPlus} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {createStudent, randomPassword, suggestUsername} from '../../lib/accounts';
import {percent} from '../../lib/keys';
import {Link} from '../../lib/router';
import {authError} from '../../lib/session';
import {download, gradeOf, mean, type AdminData} from './data';
import {StudentName} from './Overview';

interface Created {
  name: string;
  username: string;
  password: string;
}

const field = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-blue-500';

export default function Students({data}: {data: AdminData}) {
  const [created, setCreated] = useState<Created[]>([]);
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(!data.students.length);
  const add = (c: Created) => setCreated((list) => [...list, c]);

  const q = filter.trim().toLowerCase();
  const shown = data.students.filter((s) => !q || [s.profile.name, s.profile.nickname ?? '', s.profile.username].some((x) => x.toLowerCase().includes(q)));

  return (
    <div className="space-y-6">
      {adding ? (
        <div className="space-y-3">
          <div className="grid gap-4 lg:grid-cols-2">
            <CreateOne onCreated={add} />
            <CreateMany onCreated={add} />
          </div>
          {data.students.length > 0 && (
            <button onClick={() => setAdding(false)} className="text-sm text-neutral-400 hover:text-neutral-200">
              Хаах
            </button>
          )}
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400">
          <UserPlus size={18} /> Сурагч нэмэх
        </button>
      )}
      {created.length > 0 && <CreatedList list={created} />}

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Бүх сурагч ({data.students.length})</h2>
          <label className="relative w-full sm:w-56">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Нэр, nickname, нэвтрэх нэрээр хайх" className="w-full rounded-full border border-neutral-700 bg-neutral-950 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
          </label>
        </div>
        {!data.students.length ? (
          <p className="text-sm text-neutral-400">Одоогоор сурагч алга. Дээрх хэсгээс нэмнэ үү.</p>
        ) : (
          <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
            {shown.map((s) => {
              const mine = data.results.filter((r) => r.uid === s.uid);
              const tests = new Set(mine.map((r) => r.test)).size;
              const avg = mean(mine.flatMap((r) => (gradeOf(r, data.keys) ? [percent(gradeOf(r, data.keys)!)] : [])));
              return (
                <li key={s.uid}>
                  <Link href={`/admin/student/${s.uid}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-800/50">
                    <span className="min-w-0 flex-1">
                      <StudentName student={s} sub={`@${s.profile.username} • ${tests ? `${tests} тест өгсөн` : 'тест өгөөгүй'}`} />
                    </span>
                    {s.profile.disabled && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">Хаалттай</span>}
                    <span className="w-14 shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular-nums">{avg === null ? '—' : `${Math.round(avg)}%`}</span>
                      <span className="block text-[11px] text-neutral-500">дундаж</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-neutral-500" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function CreateOne({onCreated}: {onCreated: (c: Created) => void}) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [touched, setTouched] = useState(false);
  const [password, setPassword] = useState(randomPassword);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const changeName = (v: string) => {
    setName(v);
    if (!touched) setUsername(v.trim() ? suggestUsername(v) : '');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createStudent(name, username, password);
      onCreated({name: name.trim(), username: username.trim().toLowerCase(), password});
      setName('');
      setUsername('');
      setTouched(false);
      setPassword(randomPassword());
    } catch (err) {
      setError(authError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <UserPlus size={18} /> Сурагч нэмэх
      </h2>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="text-sm text-neutral-300">Овог нэр</span>
          <input className={`${field} mt-1`} value={name} onChange={(e) => changeName(e.target.value)} placeholder="Жишээ: Батын Болд" maxLength={60} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-neutral-300">Нэвтрэх нэр</span>
            <input
              className={`${field} mt-1`}
              value={username}
              onChange={(e) => {
                setTouched(true);
                setUsername(e.target.value.toLowerCase().replace(/\s/g, ''));
              }}
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-300">Нууц үг</span>
            <div className="relative mt-1">
              <input className={`${field} pr-10`} value={password} onChange={(e) => setPassword(e.target.value)} spellCheck={false} />
              <button type="button" onClick={() => setPassword(randomPassword())} aria-label="Шинэ нууц үг" className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-neutral-400 hover:text-neutral-200">
                <RefreshCw size={16} />
              </button>
            </div>
          </label>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <button disabled={busy || !name.trim() || !username || password.length < 6} className="mt-4 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
        {busy ? 'Үүсгэж байна…' : 'Үүсгэх'}
      </button>
    </form>
  );
}

/** One name per line; login names and passwords are made up and shown afterwards. */
function CreateMany({onCreated}: {onCreated: (c: Created) => void}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const names = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const run = async () => {
    setBusy(true);
    setLog([]);
    const left: string[] = [];
    for (const name of names) {
      let done = false;
      for (let tries = 0; tries < 4 && !done; tries++) {
        const c = {name, username: suggestUsername(name), password: randomPassword()};
        try {
          await createStudent(c.name, c.username, c.password);
          onCreated(c);
          done = true;
        } catch (e) {
          if ((e as {code?: string}).code === 'auth/email-already-in-use') continue; // try another number
          setLog((l) => [...l, `${name}: ${authError(e)}`]);
          break;
        }
      }
      if (!done) left.push(name);
    }
    setText(left.join('\n'));
    setBusy(false);
  };

  return (
    <div className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
      <h2 className="font-semibold">Олноор нэмэх</h2>
      <p className="mt-1 text-sm text-neutral-400">Нэг мөрөнд нэг сурагчийн овог нэр. Нэвтрэх нэр, нууц үг автоматаар үүснэ.</p>
      <textarea className={`${field} mt-3 h-28 resize-y`} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Батын Болд\nДоржийн Сараа'} disabled={busy} />
      {log.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm text-red-400">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
      <button onClick={run} disabled={busy || !names.length} className="mt-3 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
        {busy ? 'Үүсгэж байна…' : names.length ? `${names.length} сурагч үүсгэх` : 'Үүсгэх'}
      </button>
    </div>
  );
}

function CreatedList({list}: {list: Created[]}) {
  const [copied, setCopied] = useState(false);
  const asText = ['Нэр\tНэвтрэх нэр\tНууц үг', ...list.map((c) => `${c.name}\t${c.username}\t${c.password}`)].join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(asText);
    }
  };
  const csv = '﻿' + ['Нэр,Нэвтрэх нэр,Нууц үг', ...list.map((c) => `"${c.name.replace(/"/g, '""')}",${c.username},${c.password}`)].join('\r\n');

  return (
    <section className="rounded-2xl border border-green-500/30 bg-green-500/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Шинээр үүсгэсэн бүртгэл ({list.length})</h2>
          <p className="text-sm text-amber-300">Нууц үгийг дахин харах боломжгүй тул одоо хуулж эсвэл татаж аваад сурагчдад өгөөрэй.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={copy} className="flex items-center gap-2 rounded-full bg-neutral-800 px-4 py-1.5 text-sm font-medium hover:bg-neutral-700">
            <Copy size={15} /> {copied ? 'Хуулагдлаа' : 'Хуулах'}
          </button>
          <button onClick={() => download('batnab-burtgel.csv', csv)} className="flex items-center gap-2 rounded-full bg-neutral-800 px-4 py-1.5 text-sm font-medium hover:bg-neutral-700">
            <Download size={15} /> Татах
          </button>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-400">
            <tr>
              <th className="py-1.5 pr-4 font-medium">Нэр</th>
              <th className="py-1.5 pr-4 font-medium">Нэвтрэх нэр</th>
              <th className="py-1.5 font-medium">Нууц үг</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {list.map((c) => (
              <tr key={c.username} className="border-t border-neutral-800">
                <td className="py-1.5 pr-4 font-sans">{c.name}</td>
                <td className="py-1.5 pr-4">{c.username}</td>
                <td className="py-1.5">{c.password}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
