import {Camera, Check, ChevronRight, CircleHelp, Download, Eye, EyeOff, GraduationCap, ListChecks, LogOut, Trash2} from 'lucide-react';
import {useRef, useState, type FormEvent, type ReactNode} from 'react';
import Avatar from '../components/Avatar';
import {BetaBadge, useGetApp} from '../components/GetApp';
import {useGuideRole} from '../components/Guide';
import {InactiveNote, LockedNote} from '../components/Notices';
import {saveNickname, savePhoto, squarePhoto} from '../lib/accounts';
import {openGuide} from '../lib/guide';
import {Link, navigate} from '../lib/router';
import {authError, changePassword, logOut, shownName, useSession, type Profile as ProfileData} from '../lib/session';

const field = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500';
const card = 'rounded-2xl bg-neutral-900';

type Status = {ok: boolean; text: string} | null;

const StatusLine = ({status}: {status: Status}) =>
  status && (
    <p className={`mt-3 flex items-center justify-center gap-1 text-sm ${status.ok ? 'text-green-400' : 'text-red-400'}`}>
      {status.ok && <Check size={16} />} {status.text}
    </p>
  );

/** Runs a save, keeping a busy flag and a short result line. */
function useSave() {
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const run = async (job: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setStatus(null);
    try {
      await job();
      setStatus({ok: true, text: done});
    } catch (e) {
      setStatus({ok: false, text: authError(e)});
    } finally {
      setBusy(false);
    }
  };
  return {status, setStatus, busy, run};
}

export default function Profile() {
  const session = useSession();
  const {profile} = session;
  if (!session.ready) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  if (!session.user) return <LockedNote />;
  if (!profile || profile.disabled) return <InactiveNote blocked={!!profile?.disabled} />;

  return (
    <div className="mx-auto max-w-xl space-y-4 py-4 sm:py-6">
      <h1 className="sr-only">Миний профайл</h1>
      <Identity profile={profile} />
      <Shortcuts admin={session.admin} />
      <NicknameForm key={session.user.uid} profile={profile} />
      <PasswordForm />
      <button
        onClick={() => logOut().then(() => navigate('/'))}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-800 py-3 text-sm font-medium text-red-300 hover:bg-red-500/10"
      >
        <LogOut size={18} /> Гарах
      </button>
    </div>
  );
}

/** Photo, the name the site shows, the login name; tap the photo to change it. */
function Identity({profile}: {profile: ProfileData}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const {status, busy, run} = useSave();
  const name = shownName(profile);
  const pick = (file: File | undefined) => file && run(async () => savePhoto(await squarePhoto(file)), 'Зураг солигдлоо.');

  return (
    <section className={`${card} flex flex-col items-center px-5 pb-5 pt-7 text-center`}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button disabled={busy} onClick={() => fileRef.current?.click()} aria-label="Зураг солих" className="relative rounded-full disabled:opacity-60">
        <Avatar name={name} photo={profile.photo} size={104} />
        <span className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-4 border-neutral-900 bg-blue-500 text-black">
          <Camera size={16} />
        </span>
      </button>
      <p className="mt-4 max-w-full break-words text-2xl font-bold">{name}</p>
      <p className="text-sm text-neutral-400">@{profile.username}</p>
      {profile.nickname?.trim() && <p className="mt-1 text-sm text-neutral-500">Жинхэнэ нэр: {profile.name}</p>}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-60"
        >
          <Camera size={16} /> {busy ? 'Хадгалж байна…' : 'Зураг солих'}
        </button>
        {profile.photo && (
          <button
            disabled={busy}
            onClick={() => run(() => savePhoto(null), 'Зураг устлаа.')}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800 disabled:opacity-60"
          >
            <Trash2 size={16} /> Устгах
          </button>
        )}
      </div>
      <StatusLine status={status} />
    </section>
  );
}

/** The places students look for from here: their results, the guide, the app. */
function Shortcuts({admin}: {admin: boolean}) {
  const app = useGetApp();
  const guide = useGuideRole();
  const row = 'flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-neutral-800/60';
  const icon = (i: ReactNode) => <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">{i}</span>;
  const chevron = <ChevronRight size={18} className="ml-auto shrink-0 text-neutral-500" />;
  return (
    <nav className={`${card} divide-y divide-neutral-800 overflow-hidden`}>
      {admin ? (
        <Link href="/admin" className={row}>
          {icon(<GraduationCap size={18} />)} Багшийн самбар {chevron}
        </Link>
      ) : (
        <Link href="/results" className={row}>
          {icon(<ListChecks size={18} />)} Миний дүнгүүд {chevron}
        </Link>
      )}
      {guide && (
        <button onClick={openGuide} className={row}>
          {icon(<CircleHelp size={18} />)} Заавар {chevron}
        </button>
      )}
      {!app.installed && (
        <button onClick={app.start} className={row}>
          {icon(<Download size={18} />)} Апп татах <BetaBadge /> {chevron}
        </button>
      )}
    </nav>
  );
}

function NicknameForm({profile}: {profile: ProfileData}) {
  const [nickname, setNickname] = useState(profile.nickname ?? '');
  const {status, busy, run} = useSave();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => saveNickname(nickname), 'Хоч нэр хадгалагдлаа.');
  };

  return (
    <form onSubmit={submit} className={`${card} p-5`}>
      <label className="font-semibold" htmlFor="nickname">
        Хоч нэр
      </label>
      <p className="mt-0.5 text-sm text-neutral-400">Сайт дээр хоч нэр тань харагдана. Багш жинхэнэ нэр, хочийг тань хоёуланг нь харна.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input id="nickname" className={field} value={nickname} maxLength={30} onChange={(e) => setNickname(e.target.value)} placeholder={profile.name} />
        <button
          disabled={busy || nickname.trim() === (profile.nickname ?? '')}
          className="shrink-0 rounded-full bg-blue-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50"
        >
          {busy ? 'Хадгалж байна…' : 'Хадгалах'}
        </button>
      </div>
      <StatusLine status={status} />
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const {status, setStatus, busy, run} = useSave();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 6) return setStatus({ok: false, text: 'Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байна.'});
    if (next !== again) return setStatus({ok: false, text: 'Шинэ нууц үгүүд таарахгүй байна.'});
    run(async () => {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setAgain('');
    }, 'Нууц үг солигдлоо.');
  };

  const type = show ? 'text' : 'password';
  return (
    <form onSubmit={submit} className={`${card} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Нууц үг солих</h2>
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />} {show ? 'Нуух' : 'Харуулах'}
        </button>
      </div>
      <div className="mt-3 grid gap-3">
        <input className={field} type={type} placeholder="Одоогийн нууц үг" aria-label="Одоогийн нууц үг" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        <input className={field} type={type} placeholder="Шинэ нууц үг (6+ тэмдэгт)" aria-label="Шинэ нууц үг" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        <input className={field} type={type} placeholder="Шинэ нууц үг дахин" aria-label="Шинэ нууц үг дахин" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
      </div>
      <StatusLine status={status} />
      <button
        disabled={busy || !current || !next}
        className="mt-4 w-full rounded-full bg-blue-500 py-2.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50 sm:w-auto sm:px-6"
      >
        {busy ? 'Сольж байна…' : 'Солих'}
      </button>
    </form>
  );
}
