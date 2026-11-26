import {Loader2} from 'lucide-react';
import {useState} from 'react';
import Sheet from '../../components/Sheet';
import {toTopic, useBankFolders, useBankProblems, within, type BankProblem} from '../../lib/bank';
import {newId, problemNos, type Problem} from '../../lib/topics';
import {BankPath, BankProblemView, FolderButton} from './BankParts';

/**
 * «Сангаас нэмэх»: problems picked from the problem bank (folder by folder) and copied into the topic, their pictures
 * and right answers with them. The bank keeps its own; the topic is saved as usual.
 */
export default function BankPicker({tid, onAdd, onUploaded, onClose}: {tid: string; onAdd: (ps: Problem[], keys: Record<string, string>) => void; onUploaded: (iid: string) => void; onClose: () => void}) {
  const folders = useBankFolders();
  const problems = useBankProblems();
  const [at, setAt] = useState('');
  const [picked, setPicked] = useState<Map<string, BankProblem>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const here = problems?.[at] ?? [];
  const nos = problemNos(here);
  const kids = (folders ?? []).filter((f) => f.parent === at);
  const toggle = (p: BankProblem) =>
    setPicked((m) => {
      const n = new Map(m);
      if (!n.delete(p.id)) n.set(p.id, p);
      return n;
    });
  const add = async () => {
    setBusy(true);
    setError('');
    try {
      const {problems: ps, keys} = await toTopic(tid, [...picked.values()], newId, onUploaded);
      onAdd(ps, keys);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title="Сангаас нэмэх" sub="Хавтсаа нээгээд бодлогуудаа сонгоно. Зураг, зөв хариулттай нь сэдэвт хуулагдана." onClose={onClose} wide>
      {!folders || !problems ? (
        <div className="h-32 animate-pulse rounded-xl bg-neutral-800" />
      ) : !folders.length ? (
        <p className="rounded-xl bg-neutral-800/50 p-4 text-sm text-neutral-300">Сан хоосон байна. «Бодлого» хэсэгт хавтас үүсгээд бодлогоо оруулна.</p>
      ) : (
        <div className="space-y-3" data-bank-picker>
          <BankPath folders={folders} at={at} onGo={setAt} />
          {kids.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {kids.map((f) => (
                <FolderButton key={f.id} f={f} problems={(problems[f.id] ?? []).length} folders={within(folders, f.id).length} onOpen={() => setAt(f.id)} />
              ))}
            </div>
          )}
          {at && !here.length && <p className="text-sm text-neutral-400">Энэ хавтсанд бодлого алга.</p>}
          {here.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <button type="button" onClick={() => setPicked((m) => new Map([...m, ...here.map((p) => [p.id, p] as const)]))} className="rounded-full bg-neutral-800 px-3 py-1 hover:bg-neutral-700">
                  Бүгдийг сонгох
                </button>
                <button type="button" onClick={() => setPicked((m) => new Map([...m].filter(([id]) => !here.some((p) => p.id === id))))} className="rounded-full px-3 py-1 text-neutral-400 hover:bg-neutral-800">
                  Сонголтыг арилгах
                </button>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {here.map((p, i) => (
                  <li key={p.id}>
                    <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${picked.has(p.id) ? 'border-blue-500 bg-blue-500/10' : 'border-neutral-800 hover:bg-neutral-800/50'}`} data-bank-problem={p.id}>
                      <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p)} className="mt-1 h-4 w-4 shrink-0 accent-blue-500" aria-label={`${nos[i]}-р бодлогыг сонгох`} />
                      <span className="min-w-0 flex-1">
                        <span className="mb-1 block text-xs font-semibold text-neutral-400">{nos[i]}.</span>
                        <BankProblemView p={p} no={nos[i]} compact />
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      <div className="sticky -bottom-[max(1.25rem,env(safe-area-inset-bottom))] -mx-5 -mb-[max(1.25rem,env(safe-area-inset-bottom))] mt-4 flex items-center justify-end gap-2 border-t border-neutral-800 bg-neutral-900 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <span className="mr-auto text-sm text-neutral-400">{picked.size} сонгосон</span>
        <button type="button" onClick={onClose} className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700">
          Болих
        </button>
        <button type="button" onClick={add} disabled={!picked.size || busy} className="flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
          {busy && <Loader2 size={15} className="animate-spin" />} {picked.size} бодлого нэмэх
        </button>
      </div>
    </Sheet>
  );
}
