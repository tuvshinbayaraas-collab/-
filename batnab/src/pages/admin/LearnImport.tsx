import {BookOpenCheck, Check, FileUp, Trash2} from 'lucide-react';
import {useState} from 'react';
import {parseLearnFile, removeSolutions, saveSolutions, useLearnIndex, type Solutions} from '../../lib/learn';
import {Link} from '../../lib/router';
import {testInfo, type TestInfo} from '../../tests';
import {CODES, LETTERS} from '../../tests/types';

const day = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * A test's step-by-step solutions for «Сурах», loaded from a file: read and checked against the key before they are
 * kept (a solution whose answer isn't the key's is pointed out), then shown to the students who have handed the test in.
 */
export default function LearnImport({info, keyString}: {info: TestInfo; keyString: string}) {
  const index = useLearnIndex();
  const have = index?.[info.id];
  const [loaded, setLoaded] = useState<{name: string; items: Solutions} | null>(null);
  const [status, setStatus] = useState<{ok: boolean; text: string} | null>(null);
  const [busy, setBusy] = useState(false);

  const read = async (file: File | undefined) => {
    setStatus(null);
    setLoaded(null);
    if (!file) return;
    const parsed = parseLearnFile(await file.text());
    if ('error' in parsed) return setStatus({ok: false, text: parsed.error});
    if (parsed.test !== info.id) return setStatus({ok: false, text: `Энэ файл ${testInfo(parsed.test)?.title ?? parsed.test}-гийн бодолт байна. Дээрээс тэр тестийг сонгоно уу.`});
    setLoaded({name: file.name, items: parsed.items});
  };

  // What the file says against the key: problems whose answer differs, and whether the key is whole enough to tell.
  const numbers = loaded ? Object.keys(loaded.items).map(Number) : [];
  const keyed = numbers.filter((n) => CODES.includes(keyString[n - 1] ?? '-') && keyString[n - 1] !== '-');
  const differ = loaded ? keyed.filter((n) => keyString[n - 1] !== loaded.items[n].a) : [];
  const letter = (code: string) => LETTERS[CODES.indexOf(code)] ?? code;

  const save = async () => {
    if (!loaded) return;
    setBusy(true);
    try {
      await saveSolutions(info.id, loaded.items);
      setLoaded(null);
      setStatus({ok: true, text: 'Хадгалагдлаа.'});
    } catch (e) {
      setStatus({ok: false, text: `Хадгалж чадсангүй: ${(e as Error).message}`});
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!confirm(`${info.title}-гийн бодолтыг устгах уу?`)) return;
    setBusy(true);
    try {
      await removeSolutions(info.id);
      setStatus({ok: true, text: 'Бодолтыг устгалаа.'});
    } catch (e) {
      setStatus({ok: false, text: `Устгаж чадсангүй: ${(e as Error).message}`});
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5" data-learn-import>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <BookOpenCheck size={18} /> {info.title} · бодолт
      </h2>
      <p className="mt-1 text-sm text-neutral-400">Бодлого бүрийн бодолт «Сурах» хэсэгт гарна. Сурагч энэ тестийг өгсний дараа харна.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {index === null ? (
          <span className="text-neutral-400">Ачаалж байна…</span>
        ) : have ? (
          <>
            <span className="flex items-center gap-1 text-green-300">
              <Check size={16} /> {have.n} бодлогын бодолт оруулсан{have.at ? ` · ${day(have.at)}` : ''}
            </span>
            <Link href={`/learn/${info.id}`} className="rounded-full px-3 py-1 font-medium text-blue-400 hover:bg-blue-500/10">
              Харах
            </Link>
            <button onClick={remove} disabled={busy} className="flex items-center gap-1 rounded-full px-3 py-1 font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50">
              <Trash2 size={14} /> Устгах
            </button>
          </>
        ) : (
          <span className="text-neutral-400">Бодолт оруулаагүй байна.</span>
        )}
      </div>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700 focus-within:ring-2 focus-within:ring-blue-400">
        <FileUp size={16} /> {have ? 'Шинэ файлаар солих' : 'Бодолтын файл сонгох'}
        <input
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => {
            void read(e.target.files?.[0]);
            e.target.value = '';
          }}
          data-learn-file
        />
      </label>
      {status && <p className={`mt-3 text-sm ${status.ok ? 'text-green-400' : 'text-red-400'}`}>{status.text}</p>}
      {loaded && (
        <div className="mt-3 rounded-xl border border-neutral-800 p-3 text-sm" data-learn-loaded>
          <p>
            <b>{loaded.name}</b>: {numbers.length}/{info.count} бодлогын бодолт уншлаа.
          </p>
          {differ.length > 0 ? (
            <p className="mt-1 text-amber-300">
              {differ.length} бодлогын хариу түлхүүрээс өөр байна:{' '}
              {differ.map((n) => `${n} (бодолтод ${letter(loaded.items[n].a)}, түлхүүрт ${letter(keyString[n - 1])})`).join(', ')}. Хадгалахаас өмнө шалгана уу.
            </p>
          ) : keyed.length === numbers.length ? (
            <p className="mt-1 text-green-300">Хариунууд түлхүүртэй таарч байна.</p>
          ) : (
            <p className="mt-1 text-neutral-400">Түлхүүр бүрэн оруулаагүй тул {numbers.length - keyed.length} бодлогын хариуг тулгаж шалгасангүй.</p>
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={save} disabled={busy} className="rounded-full bg-blue-500 px-5 py-1.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-60">
              {busy ? 'Хадгалж байна…' : 'Хадгалах'}
            </button>
            <button onClick={() => setLoaded(null)} className="rounded-full px-4 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
              Болих
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
