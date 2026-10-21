import {MessageCircleQuestion, Send, Trash2} from 'lucide-react';
import {useState} from 'react';
import {deleteQuestion, replyQuestion, useAllQuestions, type Question} from '../../lib/classroom';
import {formatDate} from '../../lib/results';
import {Link} from '../../lib/router';
import {Rich} from '../../components/TopicParts';
import type {AdminData} from './data';

/** Students' questions about problems: unanswered first; the answer shows on the student's "Асуултууд" page. */
export default function QuestionsTab({data}: {data: AdminData}) {
  const all = useAllQuestions();
  if (!all) return <p className="py-10 text-center text-neutral-400">Ачаалж байна…</p>;
  const names = new Map(data.students.map((s) => [s.uid, s.profile.name]));
  const list = all.filter((q) => names.has(q.uid));
  const open = list.filter((q) => !q.reply).length;
  return (
    <div className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <MessageCircleQuestion size={18} className="text-sky-300" /> Сурагчдын асуулт
          {open > 0 && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">{open} хариулаагүй</span>}
        </h2>
        <p className="text-sm text-neutral-400">Сурагчид бодлого бүрийн доорх «Багшаас асуух» товчоор асууна. Хариулахад сурагчийн нүүр хуудсанд мэдэгдэл гарна.</p>
      </div>
      {!list.length ? (
        <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">Одоогоор асуулт алга.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((q) => (
            <Item key={`${q.uid}/${q.id}`} q={q} name={names.get(q.uid)!} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Item({q, name}: {q: Question; name: string}) {
  const [text, setText] = useState(q.reply?.text ?? '');
  const [editing, setEditing] = useState(!q.reply);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await replyQuestion(q.uid, q.id, text);
      setEditing(false);
    } catch (e) {
      alert(`Алдаа: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const where = q.ctx.s === 'p' ? `/topics/${q.ctx.t}` : `/admin?tab=keys&test=${q.ctx.t}`;
  return (
    <li className={`rounded-2xl bg-neutral-900 p-4 ${!q.reply ? 'ring-1 ring-sky-400/40' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
        <Link href={`/admin/student/${q.uid}`} className="font-semibold hover:underline">
          {name}
        </Link>
        <span className="text-neutral-600">·</span>
        <Link href={where} className="min-w-0 truncate text-blue-300 hover:underline">
          {q.ctx.label}
        </Link>
        <span className="ml-auto text-xs text-neutral-500">{formatDate(q.at)}</span>
      </div>
      <Rich text={q.text} className="mt-2" />
      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea value={text} maxLength={1000} rows={3} onChange={(e) => setText(e.target.value)} placeholder="Хариулт… (томьёо: $2^3 = 8$)" className="w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          <div className="flex flex-wrap gap-2">
            <button onClick={send} disabled={busy || !text.trim()} className="flex items-center gap-1.5 rounded-full bg-blue-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
              <Send size={15} /> {busy ? 'Илгээж байна…' : 'Хариулах'}
            </button>
            {q.reply && (
              <button onClick={() => setEditing(false)} className="rounded-full bg-neutral-800 px-4 py-1.5 text-sm hover:bg-neutral-700">
                Болих
              </button>
            )}
            <button
              onClick={() => confirm('Энэ асуултыг устгах уу?') && deleteQuestion(q.uid, q.id).catch((e) => alert(e.message))}
              className="ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
            >
              <Trash2 size={14} /> Устгах
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-sky-500/10 p-3 text-sm">
          <p className="text-xs font-semibold text-sky-300">
            Таны хариу · {formatDate(q.reply!.at)} {q.seen ? '· сурагч уншсан' : ''}
          </p>
          <Rich text={q.reply!.text} className="mt-1" />
          <button onClick={() => setEditing(true)} className="mt-2 text-xs text-neutral-400 hover:text-neutral-200">
            Засах
          </button>
        </div>
      )}
    </li>
  );
}
