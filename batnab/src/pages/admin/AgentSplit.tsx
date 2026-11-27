import {AlertTriangle, Bot, Loader2, RotateCcw, ScanSearch, X} from 'lucide-react';
import {useRef, useState} from 'react';
import type {PDFDocumentProxy} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {dropTask, MAX_PAGES, pageData, retryTask, RUN_NOW, sendPages, startAgent, useAgentDispatch, useAgentRunner, useAgentTasks, type AgentTarget, type AgentTask} from '../../lib/agents';
import {preparePage} from '../../lib/pageSplit';
import {eachPage, isPdf} from '../../lib/pdf';
import {Link} from '../../lib/router';
import {useNow} from '../../lib/time';
import {AgentFeedback} from './AgentFeedback';
import PdfRange from './PdfRange';

/** What a file picker for pages to cut takes: photos and PDFs. */
export const PAGE_FILES = 'image/*,application/pdf,.pdf';

/**
 * «Agent-аар хуваах»: photographed pages (made straight and white here) or a PDF's pages (the teacher picks which) sent
 * to the agent, ten pages to a request.
 */
export function AgentSplitButton({target, className}: {target: AgentTarget; className: string}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState<{ok: boolean; warn?: boolean; text: string} | null>(null);
  const [pdf, setPdf] = useState<{file: File; photos: File[]} | null>(null);
  const runner = useAgentRunner();
  const send = async (photos: File[], range?: {doc: PDFDocumentProxy; from: number; to: number}) => {
    setNote(null);
    let requests = 0;
    let pages = 0;
    try {
      let batch: string[] = [];
      const flush = async () => {
        if (!batch.length) return;
        setBusy('Илгээж байна');
        await sendPages(target, batch);
        requests++;
        pages += batch.length;
        batch = [];
      };
      const take = async (url: string) => {
        batch.push(url);
        if (batch.length >= MAX_PAGES) await flush();
      };
      for (const [i, f] of photos.entries()) {
        setBusy(`Зургийг бэлдэж байна ${i + 1}/${photos.length}`);
        const c = await preparePage(f);
        await take(pageData(c));
        c.width = c.height = 0;
      }
      if (range)
        await eachPage(range.doc, range.from, range.to, async (c, i, total) => {
          setBusy(`PDF-ийн хуудас бэлдэж байна ${i + 1}/${total}`);
          const url = pageData(c);
          c.width = c.height = 0;
          await take(url);
        });
      await flush();
      const off = !runner || !runner.claude;
      const what = requests > 1 ? `${pages} хуудсыг ${requests} хэсэг болгож илгээлээ.` : `${pages} хуудас илгээлээ.`;
      if (off) setNote({ok: true, text: `${what} Agent тохируулагдсаны дараа хуваагдана («Agent» хэсэг).`});
      else {
        setBusy('Agent-ийг эхлүүлж байна');
        const start = await startAgent();
        setNote(
          !start.ok
            ? {ok: true, warn: true, text: `${what} ${start.error}`}
            : start.how === 'started'
              ? {ok: true, text: `${what} Agent эхэллээ: хэдэн минутын дараа энд гарна.`}
              : {ok: true, text: `${what} Agent уншаад энд гаргана. Удвал «Одоо эхлүүлэх» дарна («Agent» хэсэгт автоматаар эхлүүлэхийг тохируулж болно).`},
        );
      }
    } catch (e) {
      setNote({ok: false, text: `${pages ? `${pages} хуудас илгээгдсэн. ` : ''}Үлдсэнийг илгээж чадсангүй: ${(e as Error).message}`});
    } finally {
      setBusy('');
      void range?.doc.loadingTask.destroy();
    }
  };
  const chosen = (files: File[]) => {
    const pdfs = files.filter(isPdf);
    const photos = files.filter((f) => !isPdf(f) && f.type.startsWith('image/')).slice(0, 30);
    if (pdfs.length) setPdf({file: pdfs[0], photos});
    else if (photos.length) void send(photos);
    if (pdfs.length > 1) setNote({ok: false, text: 'Нэг удаад нэг PDF оруулна. Эхнийхийг нь авлаа.'});
  };
  return (
    <>
      <button type="button" onClick={() => input.current?.click()} disabled={!!busy} className={`${className} disabled:opacity-60`}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />} {busy || 'Agent-аар хуваах'}
      </button>
      <input
        ref={input}
        type="file"
        accept={PAGE_FILES}
        multiple
        hidden
        data-agent-input
        onChange={(e) => {
          chosen([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
      {pdf && (
        <PdfRange
          file={pdf.file}
          action="Agent-д илгээх"
          onPick={(doc, from, to) => {
            const photos = pdf.photos;
            setPdf(null);
            void send(photos, {doc, from, to});
          }}
          onClose={() => setPdf(null)}
        />
      )}
      {note && (
        <p role="status" className={`col-span-full text-sm ${!note.ok ? 'text-red-300' : note.warn ? 'text-amber-200' : 'text-green-300'}`}>
          {note.text}
        </p>
      )}
    </>
  );
}

/** A topic's or a folder's pages with the agent: being split, ready to check and add, or failed. */
export function AgentSplits({target, onOpen}: {target: {topic: string} | {folder: string}; onOpen: (t: AgentTask) => void}) {
  const mine = (t: AgentTask) => ('topic' in target ? t.topic === target.topic : t.folder === target.folder);
  const tasks = (useAgentTasks() ?? []).filter((t) => mine(t) && ['new', 'working', 'review', 'failed'].includes(t.status)).sort((a, b) => a.at - b.at);
  const auto = useAgentDispatch();
  const now = useNow(30_000);
  // «Одоо эхлүүлэх» when the agent does not start by itself, or has not for a while.
  const byHand = (t: AgentTask) => t.status === 'new' && (!auto || now - t.at >= 10 * 60_000);
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
              <AgentFeedback task={t} />
            </>
          ) : t.status === 'failed' ? (
            <>
              <span className="flex min-w-0 flex-1 items-start gap-1.5 text-red-200">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {t.error ?? 'Agent хувааж чадсангүй.'}
              </span>
              <button type="button" onClick={() => void retryTask(t.id).then(startAgent)} className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 font-medium hover:bg-neutral-700">
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
                {t.status === 'working' ? `Agent ${t.pages} хуудсыг уншиж байна.` : `${t.pages} хуудас Agent-ийг хүлээж байна.`}
              </span>
              {t.status === 'new' && (
                <>
                  {byHand(t) && (
                    <a href={RUN_NOW} target="_blank" rel="noreferrer" className="rounded-full bg-neutral-800 px-3 py-1.5 font-medium hover:bg-neutral-700" data-run-now>
                      Одоо эхлүүлэх
                    </a>
                  )}
                  <button type="button" onClick={() => void dropTask(t.id)} className="rounded-full px-3 py-1.5 text-neutral-400 hover:bg-neutral-800">
                    Болих
                  </button>
                </>
              )}
            </>
          )}
        </li>
      ))}
      <li className="px-1 text-xs text-neutral-500">
        {tasks.some(byHand) && 'Agent өөрөө эхлээгүй байна. «Одоо эхлүүлэх» нь GitHub-ийг нээнэ: тэнд «Run workflow», дараа нь ногоон «Run workflow» дарна. '}
        Agent-ийн ажлыг{' '}
        <Link href="/admin?tab=agent" className="text-blue-400 underline">
          «Agent» хэсгээс
        </Link>{' '}
        харна.
      </li>
    </ul>
  );
}
