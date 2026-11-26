import {ChevronRight, Eye, Folder, Home} from 'lucide-react';
import {Rich} from '../../components/TopicParts';
import {pathTo, useBankImage, type BankFolder, type BankProblem} from '../../lib/bank';
import {LETTER_CODES, LETTER_LABELS} from '../../lib/topics';

/** A bank problem as a card shows it: its number, picture or text, choices, and right answer. */
export function BankProblemView({p, compact}: {p: BankProblem; compact?: boolean}) {
  const url = useBankImage(p.img);
  const key = p.key ? (p.kind === 'choice' ? (LETTER_LABELS[p.key as keyof typeof LETTER_LABELS] ?? p.key) : p.key) : null;
  return (
    <div className="min-w-0 space-y-2">
      {p.img &&
        (url ? (
          <img src={url} alt={`${p.no ?? ''}-р бодлогын зураг`.trim()} className={`w-full rounded-lg bg-white object-contain ${compact ? 'max-h-40' : 'max-h-72'}`} />
        ) : (
          <div className="h-24 animate-pulse rounded-lg bg-neutral-800" />
        ))}
      {p.text && (!p.img || !compact) && <Rich text={p.text} className="text-sm [overflow-wrap:anywhere]" />}
      {p.choices && !p.img && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-300">
          {LETTER_CODES.filter((k) => p.choices?.[k]).map((k) => (
            <li key={k} className="flex gap-1">
              <span className="font-semibold">{LETTER_LABELS[k]})</span>
              <Rich text={p.choices![k]!} className="min-w-0" />
            </li>
          ))}
        </ul>
      )}
      {key && <p className="text-xs text-green-300">Зөв хариулт: {key}</p>}
    </div>
  );
}

/** Where a folder is: «Сан» › … › the folder, each a button back up. */
export function BankPath({folders, at, onGo, top = 'Сан'}: {folders: BankFolder[]; at: string; onGo: (fid: string) => void; top?: string}) {
  const path = pathTo(folders, at);
  return (
    <nav aria-label="Хавтас" className="flex flex-wrap items-center gap-1 text-sm">
      <button type="button" onClick={() => onGo('')} className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${at ? 'text-blue-400 hover:bg-neutral-800' : 'font-semibold'}`} aria-current={at ? undefined : 'location'}>
        <Home size={14} /> {top}
      </button>
      {path.map((f, i) => (
        <span key={f.id} className="flex items-center gap-1">
          <ChevronRight size={14} className="text-neutral-500" />
          <button
            type="button"
            onClick={() => onGo(f.id)}
            aria-current={i === path.length - 1 ? 'location' : undefined}
            className={`rounded-full px-2.5 py-1 ${i === path.length - 1 ? 'font-semibold' : 'text-blue-400 hover:bg-neutral-800'}`}
          >
            {f.name}
          </button>
        </span>
      ))}
    </nav>
  );
}

/** A folder to open: its name and how much is in it (`shared`: the teacher sees which are open to students). */
export function FolderButton({f, problems, folders, onOpen, shared}: {f: BankFolder; problems?: number; folders: number; onOpen: () => void; shared?: boolean}) {
  const what = [problems !== undefined ? `${problems} бодлого` : '', folders ? `${folders} хавтас` : ''].filter(Boolean).join(' · ');
  return (
    <button type="button" onClick={onOpen} className="flex w-full min-w-0 items-center gap-3 rounded-xl bg-neutral-900 px-3 py-3 text-left hover:bg-neutral-800" data-folder={f.id}>
      <Folder size={20} className="shrink-0 text-amber-300" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{f.name}</span>
        {(what || (shared && f.published)) && (
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-400">
            {what}
            {shared && f.published && (
              <span className="flex items-center gap-1 text-green-300">
                <Eye size={12} /> Нийтэлсэн
              </span>
            )}
          </span>
        )}
      </span>
      <ChevronRight size={16} className="shrink-0 text-neutral-500" />
    </button>
  );
}
