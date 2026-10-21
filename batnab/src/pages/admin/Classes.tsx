import {Pencil, Plus, School, Trash2} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import Sheet from '../../components/Sheet';
import {createClass, deleteClass, pickClass, renameClass, useClasses, type ClassInfo} from '../../lib/classes';
import type {AdminData} from './data';

const field = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500';
const primary = 'rounded-full bg-blue-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50';
const secondary = 'rounded-full bg-neutral-800 px-5 py-2.5 text-sm font-semibold hover:bg-neutral-700';

/** Only the picked class's students, with their results and exam answers. */
export function forClass(data: AdminData, id: string): AdminData {
  if (!id) return data;
  const students = data.students.filter((s) => s.profile.class === id);
  const uids = new Set(students.map((s) => s.uid));
  return {
    ...data,
    students,
    results: data.results.filter((r) => uids.has(r.uid)),
    examAnswers: Object.fromEntries(Object.entries(data.examAnswers).map(([test, byUid]) => [test, Object.fromEntries(Object.entries(byUid).filter(([uid]) => uids.has(uid)))])),
  };
}

/** The class picker at the top of the dashboard: all classes, each class, and "Шинэ анги". */
export function ClassBar({data, picked}: {data: AdminData; picked: string}) {
  const classes = useClasses();
  const [creating, setCreating] = useState(false);
  if (!classes) return null;
  const count = (id: string) => data.students.filter((s) => s.profile.class === id).length;
  const loose = data.students.filter((s) => !s.profile.class || !classes.some((c) => c.id === s.profile.class));

  const chip = (active: boolean) =>
    `flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${active ? 'bg-blue-500 text-black' : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'}`;
  return (
    <>
      {!classes.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-neutral-700 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
            <School size={20} />
          </span>
          <p className="min-w-0 flex-1 text-sm text-neutral-300">
            Ангиа үүсгээрэй. {data.students.length > 0 && `Одоо бүртгэлтэй ${data.students.length} сурагч тэр ангид орно.`}
          </p>
          <button onClick={() => setCreating(true)} className={`${primary} flex items-center gap-1.5`}>
            <Plus size={16} /> Шинэ анги үүсгэх
          </button>
        </div>
      ) : (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Анги">
          <button role="tab" aria-selected={!picked} onClick={() => pickClass('')} className={chip(!picked)}>
            Бүх анги <span className="opacity-60">{data.students.length}</span>
          </button>
          {classes.map((c) => (
            <button key={c.id} role="tab" aria-selected={picked === c.id} onClick={() => pickClass(c.id)} className={chip(picked === c.id)}>
              <School size={14} /> {c.name} <span className="opacity-60">{count(c.id)}</span>
            </button>
          ))}
          <button onClick={() => setCreating(true)} className={`${chip(false)} border border-dashed border-neutral-700`}>
            <Plus size={14} /> Шинэ анги
          </button>
        </div>
      )}
      {creating && <CreateClass loose={loose.map((s) => s.uid)} first={!classes.length} onClose={() => setCreating(false)} />}
    </>
  );
}

function CreateClass({loose, first, onClose}: {loose: string[]; first: boolean; onClose: () => void}) {
  const [name, setName] = useState('');
  const [take, setTake] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      pickClass(await createClass(name, take ? loose : []));
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <Sheet title="Шинэ анги үүсгэх" sub={first ? 'Эхний ангиа үүсгэхэд одоо бүртгэлтэй сурагчид бүгд тэр ангид орно.' : undefined} onClose={onClose}>
      <form onSubmit={submit}>
        <label className="block">
          <span className="text-sm text-neutral-300">Ангийн нэр</span>
          <input autoFocus className={`${field} mt-1`} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="Жишээ: 11_6 анги" />
        </label>
        {loose.length > 0 && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-neutral-800/60 p-3 text-sm">
            <input type="checkbox" checked={take} onChange={(e) => setTake(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-500" />
            <span>
              {first ? `Одоо бүртгэлтэй ${loose.length} сурагчийг` : `Ангигүй ${loose.length} сурагчийг`} энэ ангид оруулах
              <span className="mt-0.5 block text-xs text-neutral-400">Дараа нь сурагч бүрийн хуудаснаас өөр анги руу шилжүүлж болно.</span>
            </span>
          </label>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className={secondary}>
            Болих
          </button>
          <button disabled={busy || !name.trim()} className={primary}>
            {busy ? 'Үүсгэж байна…' : 'Үүсгэх'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/** The picked class's name with rename and delete, above its student list. */
export function ClassHeader({info, members}: {info: ClassInfo; members: string[]}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(info.name);
  const remove = () => {
    if (!confirm(`«${info.name}» ангийг устгах уу? ${members.length} сурагч ангигүй болно; бүртгэл, дүн нь хэвээр үлдэнэ.`)) return;
    deleteClass(info.id, members)
      .then(() => pickClass(''))
      .catch((e) => alert(`Алдаа: ${(e as Error).message}`));
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-neutral-900 px-4 py-3">
      <School size={18} className="text-blue-300" />
      <h2 className="min-w-0 flex-1 font-semibold">
        {info.name} <span className="font-normal text-neutral-400">· {members.length} сурагч</span>
      </h2>
      <button onClick={() => setRenaming(true)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
        <Pencil size={14} /> Нэр солих
      </button>
      <button onClick={remove} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10">
        <Trash2 size={14} /> Анги устгах
      </button>
      {renaming && (
        <Sheet title="Ангийн нэр солих" onClose={() => setRenaming(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              renameClass(info.id, name)
                .then(() => setRenaming(false))
                .catch((err) => alert(`Алдаа: ${(err as Error).message}`));
            }}
          >
            <input autoFocus className={field} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label="Ангийн нэр" />
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRenaming(false)} className={secondary}>
                Болих
              </button>
              <button disabled={!name.trim() || name.trim() === info.name} className={primary}>
                Хадгалах
              </button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  );
}
