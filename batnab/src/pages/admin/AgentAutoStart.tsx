import {ChevronDown, Zap} from 'lucide-react';
import {useId, useState} from 'react';
import {NEW_KEY, REPO, removeDispatchKey, saveDispatchKey, useAgentDispatch} from '../../lib/agents';
import {dayLabel} from '../../lib/time';

/**
 * The «Agent» tab's «Автоматаар эхлүүлэх»: GitHub's every-5-minutes schedule is often hours late, so with a key the
 * teacher makes once on GitHub (this repository, Actions only), the site starts the agent the moment pages are sent.
 */
export default function AgentAutoStart() {
  const on = useAgentDispatch();
  const id = useId();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ok: boolean; text: string} | null>(null);
  const [change, setChange] = useState(false);
  if (on === null) return null;
  const code = 'rounded bg-neutral-800 px-1 text-neutral-200';
  const save = async () => {
    setBusy(true);
    setSaid(null);
    try {
      await saveDispatchKey(key);
      setKey('');
      setChange(false);
      setSaid({ok: true, text: 'Хадгаллаа. Шалгахын тулд Agent-ийг нэг удаа эхлүүллээ: одоо хуудас илгээх бүрт өөрөө эхэлнэ.'});
    } catch (e) {
      setSaid({ok: false, text: (e as Error).message});
    }
    setBusy(false);
  };
  const form = (
    <div className="mt-3 space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-neutral-200">
        GitHub-ийн түлхүүр
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="github_pat_…"
          className="min-w-0 flex-1 rounded-xl bg-neutral-800 px-3 py-2 font-mono text-sm text-neutral-100 placeholder:text-neutral-500"
        />
        <button type="button" disabled={busy || !key.trim()} onClick={() => void save()} className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
          {busy ? 'Шалгаж байна…' : 'Хадгалаад шалгах'}
        </button>
      </div>
    </div>
  );
  return (
    <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5" data-autostart={on ? 'on' : 'off'}>
      <h2 className="flex items-center gap-2 font-semibold">
        <Zap size={17} className={on ? 'text-green-300' : 'text-amber-300'} /> Автоматаар эхлүүлэх
      </h2>
      {on ? (
        <>
          <p className="mt-1 text-sm text-neutral-300">
            Хуудас илгээх бүрт Agent өөрөө тэр даруй эхэлнэ. Хэд хэдэн хуудас илгээвэл нэгийг дуусгаад дараагийнхаа руу шууд орно.
            {on.at > 0 && <span className="text-neutral-500"> Түлхүүр {dayLabel(on.at)} хадгалсан.</span>}
          </p>
          {change ? (
            form
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setChange(true)} className="rounded-full bg-neutral-800 px-4 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-700">
                Түлхүүрийг солих
              </button>
              <button
                type="button"
                onClick={() => confirm('Түлхүүрийг устгах уу? Agent дахиад GitHub-ийн хуваарийг (заримдаа хэдэн цаг) хүлээнэ.') && void removeDispatchKey()}
                className="rounded-full px-4 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-red-300"
              >
                Устгах
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-neutral-400">
            Одоо Agent GitHub-ийн хуваариар эхэлдэг ч тэр нь заримдаа хэдэн цагаар хоцордог. GitHub дээр нэг түлхүүр үүсгэж энд хадгалбал хуудас илгээх бүрт
            Agent өөрөө тэр даруй эхэлнэ.
          </p>
          <details className="group mt-2 text-sm text-neutral-400" open>
            <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-neutral-200">
              <ChevronDown size={16} className="transition-transform group-open:rotate-180" /> Түлхүүр үүсгэх (нэг удаа)
            </summary>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">
              <li>
                <a href={NEW_KEY} target="_blank" rel="noreferrer" className="text-blue-400 underline">
                  GitHub дээр шинэ түлхүүр үүсгэх
                </a>{' '}
                хуудсыг нээнэ (GitHub-т нэвтэрсэн байх).
              </li>
              <li>
                <b className="text-neutral-200">Expiration</b>: хамгийн урт хугацааг сонгоно.
              </li>
              <li>
                <b className="text-neutral-200">Repository access</b>: «Only select repositories» дараад{' '}
                <a href={REPO} target="_blank" rel="noreferrer" className={`${code} underline`}>
                  tuvshinbayaraas-collab/-
                </a>{' '}
                -ийг сонгоно.
              </li>
              <li>
                <b className="text-neutral-200">Permissions</b> → Repository permissions → <b className="text-neutral-200">Actions</b>: «Read and write». Өөр юу ч
                нэмэхгүй.
              </li>
              <li>
                Доод талын «Generate token» дараад гарч ирсэн <code className={code}>github_pat_</code>-аар эхэлсэн түлхүүрийг хуулж энд хадгална.
              </li>
            </ol>
            <p className="mt-2">Энэ түлхүүр зөвхөн энэ репогийн GitHub Actions-ийг ажиллуулж чадна: сайтын кодыг өөрчлөхгүй, нууц үгэнд хүрэхгүй. Сайтад зөвхөн та харна.</p>
          </details>
          {form}
        </>
      )}
      {said && (
        <p role={said.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${said.ok ? 'text-green-300' : 'text-red-300'}`}>
          {said.text}
        </p>
      )}
    </section>
  );
}
