import {DatabaseBackup, Download, Loader2, Upload} from 'lucide-react';
import {useRef, useState} from 'react';
import Sheet from '../../components/Sheet';
import {lastBackup, makeBackup, markBackedUp, partCounts, PARTS, readBackup, restoreBackup, type Backup, type PartId} from '../../lib/backup';
import {download, timeAgo} from './data';

const DAY = 86_400_000;
const two = (n: number) => String(n).padStart(2, '0');
/** "2026.11.01 09:38" (the same everywhere: not every browser knows the Mongolian date format). */
const when = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}.${two(d.getMonth() + 1)}.${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
};

/** Тохиргоо → "Нөөц": everything saved as one file, and chosen parts of such a file put back. */
export default function BackupSection() {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [last, setLast] = useState(lastBackup);
  const [file, setFile] = useState<Backup | null>(null);
  const [done, setDone] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const save = async () => {
    setError('');
    setDone('');
    setBusy('Нөөцийг бэлдэж байна…');
    try {
      const b = await makeBackup((n, total) => setBusy(`Нөөцийг бэлдэж байна… ${Math.round((n / total) * 100)}%`));
      download(`batnab-noots-${new Date(b.at).toISOString().slice(0, 10)}.json`, JSON.stringify(b), 'application/json');
      markBackedUp(b.at);
      setLast(b.at);
    } catch (e) {
      setError(`Нөөц татаж чадсангүй: ${(e as Error).message}`);
    } finally {
      setBusy('');
    }
  };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    setDone('');
    const b = readBackup(await f.text());
    if (typeof b === 'string') setError(b);
    else setFile(b);
  };
  const old = !last || Date.now() - last > 7 * DAY;

  return (
    <section className="rounded-2xl bg-neutral-900 p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <DatabaseBackup size={18} className="text-sky-300" /> Нөөц
      </h2>
      <p className="mt-1 text-sm text-neutral-400">
        Сэдэв, бодлого, зураг, сурагчдын бүртгэл, дүн, хариулт, тохиргоо — бүгдийг нэг файлаар компьютертээ хадгална. Санамсаргүй
        устгасан зүйлээ хэрэгтэй үед тэр файлаас буцааж сэргээнэ.
      </p>
      <p className={`mt-2 text-sm ${old ? 'text-amber-300' : 'text-neutral-400'}`}>
        {last ? `Энэ төхөөрөмжөөс сүүлд татсан: ${timeAgo(last)} (${when(last)}).` : 'Энэ төхөөрөмжөөс нөөц татаж байгаагүй.'}
        {old && ' Долоо хоногт нэг удаа татаж байхыг зөвлөж байна.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={save} disabled={!!busy} className="flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
          <Download size={16} /> Нөөц татах
        </button>
        <button onClick={() => input.current?.click()} disabled={!!busy} className="flex items-center gap-2 rounded-full bg-neutral-800 px-5 py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50">
          <Upload size={16} /> Нөөцөөс сэргээх
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {busy && (
        <p className="mt-3 flex items-center gap-2 text-sm text-neutral-300" role="status">
          <Loader2 size={15} className="animate-spin" /> {busy}
        </p>
      )}
      {done && <p className="mt-3 rounded-xl bg-green-500/10 px-4 py-3 text-sm text-green-300" role="status">{done}</p>}
      {error && <p className="mt-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {file && (
        <Restore
          file={file}
          onClose={() => setFile(null)}
          onDone={(n) => {
            setFile(null);
            setDone(`${n} зүйл нөөцөөс сэргээгдлээ.`);
          }}
        />
      )}
    </section>
  );
}

function Restore({file, onClose, onDone}: {file: Backup; onClose: () => void; onDone: (n: number) => void}) {
  const counts = partCounts(file);
  const [chosen, setChosen] = useState<Set<PartId>>(() => new Set(counts.topics ? ['topics'] : []));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const toggle = (id: PartId) =>
    setChosen((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const run = async () => {
    const labels = PARTS.filter((p) => chosen.has(p.id)).map((p) => p.label);
    if (!confirm(`${labels.join(', ')}: нөөцөд байгаа бүх зүйл ${when(file.at)}-ийн байдал руугаа буцна. Үргэлжлүүлэх үү?`)) return;
    setError('');
    setBusy('Сэргээж байна…');
    try {
      const n = await restoreBackup(file, [...chosen], (i, total) => setBusy(`Сэргээж байна… ${Math.round((i / total) * 100)}%`));
      onDone(n);
    } catch (e) {
      setError(`Сэргээж чадсангүй: ${(e as Error).message}. Хэсэг нь сэргээгдсэн байж магадгүй: дахин оролдож болно.`);
    } finally {
      setBusy('');
    }
  };
  return (
    <Sheet title="Нөөцөөс сэргээх" sub={`Нөөц: ${when(file.at)}`} onClose={() => !busy && onClose()}>
      <p className="text-sm text-neutral-400">Сэргээх хэсгээ сонгоно. Сонгосон хэсгийн нөөцөд байгаа зүйлс тэр үеийн байдал руугаа буцна; нөөцөөс хойш нэмсэн зүйлс хэвээр үлдэнэ.</p>
      <ul className="mt-3 divide-y divide-neutral-800 rounded-xl bg-neutral-800/40">
        {PARTS.map((p) => (
          <li key={p.id}>
            <label className={`flex items-center gap-3 px-3 py-2.5 ${counts[p.id] ? 'cursor-pointer' : 'opacity-40'}`}>
              <input type="checkbox" checked={chosen.has(p.id)} disabled={!counts[p.id] || !!busy} onChange={() => toggle(p.id)} className="h-4 w-4 accent-blue-500" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{p.label}</span>
                {p.sub && <span className="block text-xs text-neutral-500">{p.sub}</span>}
              </span>
              <span className="text-xs tabular-nums text-neutral-400">{counts[p.id]}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-neutral-500">Сурагчдын алдааны дэвтэр, дасгалын цуваа зөвхөн нөөцөд хадгалагдана (тэдгээрийг сурагч өөрөө бичдэг).</p>
      {busy && (
        <p className="mt-3 flex items-center gap-2 text-sm text-neutral-300" role="status">
          <Loader2 size={15} className="animate-spin" /> {busy}
        </p>
      )}
      {error && <p className="mt-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} disabled={!!busy} className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50">
          Болих
        </button>
        <button onClick={run} disabled={!chosen.size || !!busy} className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
          Сэргээх
        </button>
      </div>
    </Sheet>
  );
}
