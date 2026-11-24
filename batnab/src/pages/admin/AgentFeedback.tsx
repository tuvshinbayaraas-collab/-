import {MessageSquarePlus, RotateCcw, Trash2} from 'lucide-react';
import {useId, useState} from 'react';
import {addNote, MAX_NOTES, NOTE_LEN, redoTask, removeNote, useAgentNotes, type AgentTask} from '../../lib/agents';
import {dayLabel} from '../../lib/time';

/** Examples of what helps the agent, shown in the empty box. */
const EXAMPLE = 'Жишээ: Графиктай сонголтуудыг бодлоготой нь нэг зураг болго.';

/** The box the teacher writes a note in, with how much is left. */
function NoteBox({value, onChange, label}: {value: string; onChange: (v: string) => void; label: string}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-neutral-200">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, NOTE_LEN))}
        rows={3}
        maxLength={NOTE_LEN}
        placeholder={EXAMPLE}
        className="mt-1.5 w-full rounded-xl bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500"
      />
      <p className="text-right text-xs tabular-nums text-neutral-500">
        {value.length}/{NOTE_LEN}
      </p>
    </div>
  );
}

/**
 * «Шүүмж өгөх» on what the agent split: what was wrong and how to do it, kept as a note every split reads from now on
 * (the agent learns it). While nothing of it is added yet, the same pages can be split again with it.
 */
export function AgentFeedback({task}: {task: AgentTask}) {
  const notes = useAgentNotes();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ok: boolean; text: string} | null>(null);
  const full = (notes?.length ?? 0) >= MAX_NOTES;
  const canRedo = task.status === 'review' && task.added === 0;
  const save = async (redo: boolean) => {
    setBusy(true);
    setSaid(null);
    try {
      await addNote(text, task.id);
      if (redo) await redoTask(task.id);
      setText('');
      setOpen(false);
      setSaid({ok: true, text: redo ? 'Хадгаллаа. Энэ хуудсыг Agent дахин хуваана.' : 'Хадгаллаа. Agent цаашид үүнийг дагана.'});
    } catch (e) {
      setSaid({ok: false, text: `Хадгалж чадсангүй: ${(e as Error).message}`});
    }
    setBusy(false);
  };
  if (!open)
    return (
      <div className="basis-full">
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800" data-feedback>
          <MessageSquarePlus size={15} /> Шүүмж өгөх
        </button>
        {said && (
          <p role="status" className={`px-3 text-sm ${said.ok ? 'text-green-300' : 'text-red-300'}`}>
            {said.text}
          </p>
        )}
      </div>
    );
  return (
    <div className="basis-full space-y-2 rounded-xl bg-neutral-950/60 p-3" data-feedback-form>
      <NoteBox value={text} onChange={setText} label="Юу буруу байсан, цаашид яаж хуваах вэ?" />
      {full ? (
        <p className="text-sm text-amber-200">
          Заавар {MAX_NOTES} болсон. «Agent» хэсгээс хэрэггүй болсныг устгаад дахин бичнэ үү.
        </p>
      ) : (
        <p className="text-xs text-neutral-500">Agent дараагийн хуудас бүрийг хуваахдаа үүнийг дагана.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {canRedo && (
          <button type="button" disabled={busy || full || !text.trim()} onClick={() => void save(true)} className="flex items-center gap-1.5 rounded-full bg-blue-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
            <RotateCcw size={14} /> Хадгалаад дахин хуваах
          </button>
        )}
        <button
          type="button"
          disabled={busy || full || !text.trim()}
          onClick={() => void save(false)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50 ${canRedo ? 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700' : 'bg-blue-500 font-semibold text-black hover:bg-blue-400'}`}
        >
          Хадгалах
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800">
          Болих
        </button>
      </div>
      {said && !said.ok && (
        <p role="alert" className="text-sm text-red-300">
          {said.text}
        </p>
      )}
    </div>
  );
}

/** The «Agent» tab's list of what the teacher has told the agent: read by every split; added to, or taken back. */
export function AgentNotes() {
  const notes = useAgentNotes();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!notes) return null;
  const full = notes.length >= MAX_NOTES;
  const add = async () => {
    setBusy(true);
    setError('');
    try {
      await addNote(text);
      setText('');
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5" data-notes>
      <h2 className="font-semibold">Agent-д өгсөн заавар</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Agent хуудас бүрийг хуваахдаа эндхийг бүгдийг нь дагана. Буруу хуваасан бол юу буруу байсныг, яаж хуваахыг бичээрэй: дараагийн удаа анхаарна. Хуваасан
        хуудас бүрийн «Шүүмж өгөх»-өөс ч нэмэгдэнэ.
      </p>
      {notes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-2 rounded-xl bg-neutral-800/60 px-3 py-2 text-sm" data-note={n.id}>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-neutral-100">{n.text}</span>
              <span className="shrink-0 text-xs text-neutral-500">{n.at ? dayLabel(n.at) : ''}</span>
              <button
                type="button"
                onClick={() => confirm('Энэ зааврыг устгах уу? Agent цаашид үүнийг дагахгүй.') && void removeNote(n.id).catch((e: Error) => setError(e.message))}
                aria-label="Зааврыг устгах"
                className="-my-1 shrink-0 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-700 hover:text-red-300"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 space-y-2">
        {full ? (
          <p className="text-sm text-amber-200">Заавар {MAX_NOTES} болсон. Шинийг нэмэхийн өмнө хэрэггүй болсныг устгана уу.</p>
        ) : (
          <>
            <NoteBox value={text} onChange={setText} label="Шинэ заавар" />
            <button type="button" disabled={busy || !text.trim()} onClick={() => void add()} className="rounded-full bg-blue-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
              Нэмэх
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-300">
            Болсонгүй: {error}
          </p>
        )}
      </div>
    </section>
  );
}
