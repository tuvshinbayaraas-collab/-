import {BadgeCheck, Bell, Bug, Check, ChevronDown, ExternalLink, HandHelping, Megaphone, Trash2, X} from 'lucide-react';
import {useState, type ReactNode} from 'react';
import Switch from '../../components/Switch';
import {setLead} from '../../lib/accounts';
import {useAllQuestions, useAssignments, type Question} from '../../lib/classroom';
import {useClasses} from '../../lib/classes';
import {useFolded} from '../../lib/fold';
import {approveHelp, deleteClassNote, deleteReport, markReport, rejectHelp, useAllClassNotes, useAllHelpAnswers, useAllReports, type HelpAnswer} from '../../lib/lead';
import {useLive} from '../../lib/live';
import {Link} from '../../lib/router';
import {saveSetting, useSettings, type Settings} from '../../lib/settings';
import {clock, dayLabel, useNow} from '../../lib/time';
import {useTopics} from '../../lib/topics';
import {assignmentTitle} from '../../components/Today';
import type {AdminData} from './data';

const btn = 'flex items-center gap-1 rounded-full px-3 py-1.5 text-sm';

/**
 * «Ангийн дарга», on the teacher's tasks page: who the class leaders are, which of their powers are on, and what they
 * did — answers to classmates waiting for the teacher's «yes», mistakes reported, notes put up, reminders sent.
 */
export default function LeadsAdmin({data, picked}: {data: AdminData; picked: string}) {
  const [folded, fold] = useFolded('admin.leads');
  const help = useAllHelpAnswers(!folded);
  const reports = useAllReports(!folded);
  const waiting = Object.entries(help ?? {}).flatMap(([cls, byQ]) => (!picked || cls === picked ? Object.values(byQ) : [])).length;
  const open = (reports ?? []).filter((r) => !r.done && (!picked || data.students.find((s) => s.uid === r.uid)?.profile.class === picked)).length;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">
        <button type="button" onClick={fold} aria-expanded={!folded} className="flex w-full items-center gap-2 rounded-lg text-left hover:opacity-80">
          <BadgeCheck size={18} className="shrink-0 text-teal-300" /> Ангийн дарга
          {waiting > 0 && <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-xs font-semibold text-teal-200">{waiting} тайлбар хүлээж байна</span>}
          {open > 0 && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">{open} алдааны мэдээлэл</span>}
          <ChevronDown size={18} aria-hidden className={`ml-auto shrink-0 text-neutral-500 transition-transform ${folded ? '' : 'rotate-180'}`} />
        </button>
      </h2>
      {!folded && (
        <>
          <div className="overflow-hidden rounded-2xl bg-neutral-900">
            <Leads data={data} picked={picked} />
            <Powers />
          </div>
          <HelpWaiting data={data} picked={picked} help={help} />
          <ReportsList data={data} picked={picked} />
          <NotesList data={data} picked={picked} />
          <RemindersList data={data} picked={picked} />
        </>
      )}
    </section>
  );
}

/** The leaders' four powers, each on or off for every class. */
function Powers() {
  const settings = useSettings();
  const [busy, setBusy] = useState('');
  const row = (name: 'leadRemind' | 'leadNotes' | 'leadReports' | 'leadHelp', icon: ReactNode, title: string, text: string) => (
    <Switch
      on={settings?.[name] !== false}
      busy={busy === name || !settings}
      onChange={(on) => (setBusy(name), saveSetting(name, on as Settings[typeof name]).catch((e) => alert(`Хадгалж чадсангүй: ${(e as Error).message}`)).finally(() => setBusy('')))}
      className="items-start border-t border-neutral-800 px-4 py-3"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {icon} {title}
        </span>
        <span className="mt-0.5 block text-xs text-neutral-400">{text}</span>
      </span>
    </Switch>
  );
  return (
    <>
      {row('leadRemind', <Bell size={14} className="text-teal-300" />, 'Даалгаврын сануулга', 'Хэд нь дуусгасныг (хэн гэдгийг биш) харж, дуусгаагүй ангийнхныхаа хонхонд сануулга илгээнэ (3 цагт нэг удаа).')}
      {row('leadNotes', <Megaphone size={14} className="text-teal-300" />, 'Ангийн зарлал', 'Ангийнхаа нүүр хуудсанд нэрээрээ богино зарлал тавина (зэрэг 3 хүртэл, 7 хоног).')}
      {row('leadReports', <Bug size={14} className="text-teal-300" />, 'Бодлогын алдаа мэдээлэх', 'Тест, сэдвийн бодлогын алдааг танд мэдээлнэ.')}
      {row('leadHelp', <HandHelping size={14} className="text-teal-300" />, 'Ангийнхандаа туслах', 'Ангийнхных нь «Багшаас асуух» асуултыг (хэн асуусныг биш, асуусан хүн зөвшөөрсөн бол) харж тайлбар бичнэ; та зөвшөөрвөл л асуусан хүнд очно.')}
    </>
  );
}

/** The leaders' answers to classmates' questions, for the teacher's «yes» (then the asker gets it) or «no». */
function HelpWaiting({data, picked, help}: {data: AdminData; picked: string; help: Record<string, Record<string, HelpAnswer>> | null}) {
  const questions = useAllQuestions();
  const classes = useClasses() ?? [];
  const [busy, setBusy] = useState('');
  const byId = new Map((questions ?? []).map((q) => [q.id, q]));
  const name = (uid: string) => data.students.find((s) => s.uid === uid)?.profile.name ?? 'устгагдсан сурагч';
  const list = Object.entries(help ?? {}).flatMap(([cls, byQ]) => (!picked || cls === picked ? Object.values(byQ).map((a) => ({cls, a, q: byId.get(a.qid)})) : []));
  if (!list.length) return null;
  const run = (key: string, f: () => Promise<unknown>) => (setBusy(key), f().catch((e) => alert((e as Error).message)).finally(() => setBusy('')));
  return (
    <Block icon={<HandHelping size={16} className="text-teal-300" />} title={`Зөвшөөрөл хүлээж буй тайлбар (${list.length})`}>
      {list.map(({cls, a, q}) => (
        <li key={`${cls}/${a.qid}`} className="rounded-2xl bg-neutral-900 p-4 text-sm">
          {q ? (
            <>
              <p className="text-xs text-neutral-500">
                {name(q.uid)} асуусан · {q.ctx.label} · {classes.find((c) => c.id === cls)?.name ?? ''}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-neutral-100 break-words">{q.text}</p>
            </>
          ) : (
            <p className="text-xs text-neutral-500">Асуулт нь устсан байна.</p>
          )}
          <div className="mt-3 rounded-xl bg-teal-500/10 p-3">
            <p className="text-xs font-semibold text-teal-300">
              Ангийн дарга {a.name}-ийн тайлбар · {dayLabel(a.at)} {clock(a.at)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-neutral-100 break-words">{a.text}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {q && !q.reply && (
              <button type="button" disabled={busy === a.qid} onClick={() => run(a.qid, () => approveHelp(q as Question, a))} className={`${btn} bg-teal-500 font-semibold text-black hover:bg-teal-400 disabled:opacity-50`}>
                <Check size={14} /> Зөвшөөрч илгээх
              </button>
            )}
            <button type="button" disabled={busy === a.qid} onClick={() => run(a.qid, () => rejectHelp(cls, a.qid))} className={`${btn} text-neutral-400 hover:bg-neutral-800 hover:text-red-300`}>
              <X size={14} /> {q ? 'Татгалзах' : 'Арилгах'}
            </button>
          </div>
        </li>
      ))}
    </Block>
  );
}

function ReportsList({data, picked}: {data: AdminData; picked: string}) {
  const reports = useAllReports();
  const [showDone, setShowDone] = useState(false);
  const name = (uid: string) => data.students.find((s) => s.uid === uid)?.profile.name ?? 'устгагдсан сурагч';
  const mine = (reports ?? []).filter((r) => !picked || data.students.find((s) => s.uid === r.uid)?.profile.class === picked);
  const list = mine.filter((r) => showDone || !r.done);
  if (!mine.length) return null;
  return (
    <Block icon={<Bug size={16} className="text-amber-300" />} title={`Бодлогын алдааны мэдээлэл (${mine.filter((r) => !r.done).length})`}>
      {list.map((r) => (
        <li key={`${r.uid}/${r.rid}`} className={`rounded-2xl bg-neutral-900 p-4 text-sm ${r.done ? 'opacity-70' : ''}`}>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
            <span className="font-medium text-neutral-300">{r.label}</span> · {name(r.uid)} · {dayLabel(r.at)} {clock(r.at)}
            {r.done > 0 && <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-300">Зассан</span>}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-neutral-100 break-words">{r.text}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={r.kind === 'topic' ? `/admin/topic/${r.ref}` : `/test/${r.ref}`} className={`${btn} text-sky-300 hover:bg-neutral-800`}>
              <ExternalLink size={14} /> Нээх
            </Link>
            <button type="button" onClick={() => markReport(r, !r.done).catch((e) => alert(e.message))} className={`${btn} text-neutral-300 hover:bg-neutral-800`}>
              <Check size={14} /> {r.done ? 'Зассан гэснийг болих' : 'Зассан'}
            </button>
            <button type="button" onClick={() => confirm('Энэ мэдээллийг устгах уу?') && deleteReport(r).catch((e) => alert(e.message))} className={`${btn} ml-auto text-neutral-500 hover:bg-neutral-800 hover:text-red-400`}>
              <Trash2 size={14} /> Устгах
            </button>
          </div>
        </li>
      ))}
      {mine.some((r) => r.done) && (
        <li>
          <button type="button" onClick={() => setShowDone(!showDone)} className="rounded-full px-3 py-1 text-xs text-neutral-400 hover:bg-neutral-800">
            {showDone ? 'Зассаныг нуух' : `Зассаныг харах (${mine.filter((r) => r.done).length})`}
          </button>
        </li>
      )}
    </Block>
  );
}

function NotesList({data, picked}: {data: AdminData; picked: string}) {
  const notes = useAllClassNotes();
  const classes = useClasses() ?? [];
  void data;
  const list = Object.entries(notes ?? {})
    .flatMap(([cls, ns]) => (!picked || cls === picked ? ns.map((n) => ({cls, n})) : []))
    .sort((a, b) => b.n.at - a.n.at);
  if (!list.length) return null;
  return (
    <Block icon={<Megaphone size={16} className="text-teal-300" />} title={`Ангийн даргын зарлал (${list.length})`}>
      {list.map(({cls, n}) => (
        <li key={`${cls}/${n.nid}`} className="flex items-start gap-2 rounded-2xl bg-neutral-900 p-4 text-sm">
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-neutral-500">
              {n.name} · {classes.find((c) => c.id === cls)?.name ?? ''} · {dayLabel(n.at)} {clock(n.at)}
            </span>
            <span className="mt-1 block whitespace-pre-wrap text-neutral-100 break-words">{n.text}</span>
          </span>
          <button type="button" onClick={() => confirm('Энэ зарлалыг устгах уу?') && deleteClassNote(cls, n.nid).catch((e) => alert(e.message))} aria-label="Зарлалыг устгах" className="shrink-0 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400">
            <Trash2 size={15} />
          </button>
        </li>
      ))}
    </Block>
  );
}

/** Reminders the leaders sent this week. */
function RemindersList({data, picked}: {data: AdminData; picked: string}) {
  const now = useNow(60_000);
  const all = useLive('classReminders', (v) => (v ?? {}) as Record<string, Record<string, {by?: string; at?: number}>>);
  const assignments = useAssignments();
  const topics = useTopics();
  const classes = useClasses() ?? [];
  const name = (uid?: string) => data.students.find((s) => s.uid === uid)?.profile.name ?? 'устгагдсан сурагч';
  const list = Object.entries(all ?? {})
    .flatMap(([cls, byA]) => (!picked || cls === picked ? Object.entries(byA ?? {}).map(([aid, r]) => ({cls, aid, by: r?.by, at: Number(r?.at) || 0})) : []))
    .filter((r) => r.at > now - 7 * 86_400_000)
    .sort((a, b) => b.at - a.at);
  if (!list.length || !assignments || !topics) return null;
  return (
    <Block icon={<Bell size={16} className="text-teal-300" />} title={`Илгээсэн сануулга (${list.length})`}>
      {list.map((r) => {
        const a = assignments.find((x) => x.id === r.aid);
        return (
          <li key={`${r.cls}/${r.aid}`} className="rounded-2xl bg-neutral-900 px-4 py-3 text-sm">
            <span className="font-medium">{a ? assignmentTitle(a, topics) : 'Устгасан даалгавар'}</span>
            <span className="block text-xs text-neutral-500">
              {name(r.by)} · {classes.find((c) => c.id === r.cls)?.name ?? ''} · {dayLabel(r.at)} {clock(r.at)}
            </span>
          </li>
        );
      })}
    </Block>
  );
}

function Block({icon, title, children}: {icon: ReactNode; title: string; children: ReactNode}) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 pt-1 text-sm font-semibold">
        {icon} {title}
      </h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

/** The class leaders (of the picked class): added from a menu, taken off with ✕. */
function Leads({data, picked}: {data: AdminData; picked: string}) {
  const classes = useClasses() ?? [];
  const [busy, setBusy] = useState('');
  const cls = (id?: string) => classes.find((c) => c.id === id)?.name ?? '';
  const students = data.students
    .filter((s) => !s.profile.disabled && s.profile.class && (!picked || s.profile.class === picked))
    .sort((a, b) => cls(a.profile.class).localeCompare(cls(b.profile.class), 'mn', {numeric: true}) || a.profile.name.localeCompare(b.profile.name, 'mn'));
  const leads = students.filter((s) => s.profile.lead === true);
  const others = students.filter((s) => s.profile.lead !== true);
  const change = async (uid: string, on: boolean) => {
    setBusy(uid);
    try {
      await setLead(uid, on);
    } catch (e) {
      alert(`Хадгалж чадсангүй: ${(e as Error).message}`);
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="space-y-2 border-t border-neutral-800 p-4">
      <p className="text-sm font-semibold">Ангийн дарга ({leads.length})</p>
      <p className="text-xs text-neutral-400">Зөвхөн тэдэнд «Ангийн даргын хэсэг» гарна, ангидаа санал асуулга гаргана. Бусад сурагчид эдгээр нь харагдахгүй.</p>
      <div className="flex flex-wrap gap-1.5">
        {leads.map((s) => (
          <span key={s.uid} className="flex items-center gap-1 rounded-full bg-sky-500/15 py-1 pl-3 pr-1 text-sm text-sky-100">
            {s.profile.name}
            {!picked && <span className="text-xs text-sky-300/80">· {cls(s.profile.class)}</span>}
            <button type="button" disabled={busy === s.uid} onClick={() => change(s.uid, false)} aria-label={`${s.profile.name}-ийг ангийн даргаас хасах`} className="rounded-full p-1 text-sky-300 hover:bg-sky-500/20 hover:text-white disabled:opacity-50">
              <X size={13} />
            </button>
          </span>
        ))}
        {!leads.length && <span className="text-sm text-neutral-500">Одоохондоо алга.</span>}
      </div>
      {others.length > 0 && (
        <select
          value=""
          disabled={!!busy}
          onChange={(e) => e.target.value && change(e.target.value, true)}
          aria-label="Ангийн дарга нэмэх"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-sky-400 sm:w-auto"
        >
          <option value="">+ Ангийн дарга нэмэх…</option>
          {others.map((s) => (
            <option key={s.uid} value={s.uid}>
              {s.profile.name}
              {picked ? '' : ` · ${cls(s.profile.class)}`}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
