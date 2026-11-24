import {AlertTriangle, Bot, Loader2, RotateCcw, ScanSearch, X} from 'lucide-react';
import {useRef, useState} from 'react';
import {dropTask, MAX_PAGES, pageData, retryTask, sendPages, useAgentRunner, useAgentTasks, type AgentTask} from '../../lib/agents';
import {preparePage} from '../../lib/pageSplit';
import {Link} from '../../lib/router';

/** «Agent-аар хуваах»: the topic's photographed pages, made straight and white here, sent to the agent to split. */
export function AgentSplitButton({topic, className}: {topic: {id: string; title: string}; className: string}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState<{ok: boolean; text: string} | null>(null);
  const runner = useAgentRunner();
  const send = async (files: File[]) => {
    setNote(null);
    try {
      const pages: string[] = [];
      for (const [i, f] of files.slice(0, MAX_PAGES).entries()) {
        setBusy(`Зургийг бэлдэж байна ${i + 1}/${Math.min(files.length, MAX_PAGES)}`);
        const c = await preparePage(f);
        pages.push(pageData(c));
        c.width = c.height = 0;
      }
      setBusy('Илгээж байна');
      await sendPages(topic, pages);
      const off = !runner || !runner.claude;
      const more = files.length > MAX_PAGES ? ` Эхний ${MAX_PAGES} хуудсыг илгээсэн. Үлдсэнийг дараа нь илгээнэ үү.` : '';
      setNote({ok: true, text: (off ? 'Илгээлээ. Agent тохируулагдсаны дараа хуваагдана («Agent» хэсэг).' : 'Илгээлээ. 5–15 минутын дотор хуваагдаад энд гарна.') + more});
    } catch (e) {
      setNote({ok: false, text: `Илгээж чадсангүй: ${(e as Error).message}`});
    } finally {
      setBusy('');
    }
  };
  return (
    <>
      <button type="button" onClick={() => input.current?.click()} disabled={!!busy} className={`${className} disabled:opacity-60`}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />} {busy || 'Agent-аар хуваах'}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const fs = [...(e.target.files ?? [])].filter((f) => f.type.startsWith('image/'));
          if (fs.length) void send(fs);
          e.target.value = '';
        }}
      />
      {note && (
        <p role="status" className={`col-span-full text-sm ${note.ok ? 'text-green-300' : 'text-red-300'}`}>
          {note.text}
        </p>
      )}
    </>
  );
}

/** The topic's pages with the agent: being split, ready to check and add, or failed. */
export function AgentSplits({topic, onOpen}: {topic: string; onOpen: (t: AgentTask) => void}) {
  const tasks = (useAgentTasks() ?? []).filter((t) => t.topic === topic && ['new', 'working', 'review', 'failed'].includes(t.status));
  if (!tasks.length) return null;
  return (
    <ul className="space-y-2" data-agent-splits>
      {tasks.map((t) => (
        <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-neutral-900 px-3 py-2.5 text-sm" data-split={t.id} data-status={t.status}>
          <Bot size={16} className="shrink-0 text-blue-300" />
          {t.status === 'review' ? (
            <>
              <span className="min-w-0 flex-1">
                Agent {t.pages} хуудаснаас {t.problems.length} бодлого хуваасан.
                {t.added > 0 && ` ${t.added} хуудсыг нь нэмсэн.`}
              </span>
              <button type="button" onClick={() => onOpen(t)} className="flex items-center gap-1.5 rounded-full bg-blue-500 px-4 py-1.5 font-semibold text-black hover:bg-blue-400">
                <ScanSearch size={15} /> Шалгаж нэмэх
              </button>
              <button type="button" onClick={() => confirm('Agent-ийн хуваасныг нэмэлгүй хаях уу?') && void dropTask(t.id)} className="rounded-full px-3 py-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-red-300">
                Хаях
              </button>
            </>
          ) : t.status === 'failed' ? (
            <>
              <span className="flex min-w-0 flex-1 items-start gap-1.5 text-red-200">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {t.error ?? 'Agent хувааж чадсангүй.'}
              </span>
              <button type="button" onClick={() => void retryTask(t.id)} className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 font-medium hover:bg-neutral-700">
                <RotateCcw size={14} /> Дахин оролдох
              </button>
              <button type="button" onClick={() => void dropTask(t.id)} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-neutral-400 hover:bg-neutral-800">
                <X size={14} /> Болих
              </button>
            </>
          ) : (
            <>
              <span className="flex min-w-0 flex-1 items-center gap-2 text-neutral-300">
                <Loader2 size={14} className="animate-spin" />
                {t.status === 'working' ? `Agent ${t.pages} хуудсыг уншиж байна.` : `${t.pages} хуудас дараалалд байна. 5–15 минутын дотор хуваагдана.`}
              </span>
              {t.status === 'new' && (
                <button type="button" onClick={() => void dropTask(t.id)} className="rounded-full px-3 py-1.5 text-neutral-400 hover:bg-neutral-800">
                  Болих
                </button>
              )}
            </>
          )}
        </li>
      ))}
      <li className="px-1 text-xs text-neutral-500">
        Agent-ийн ажлыг <Link href="/admin?tab=agent" className="text-blue-400 underline">«Agent» хэсгээс</Link> харна.
      </li>
    </ul>
  );
}
