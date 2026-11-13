import {AtSign, Camera, Check, ChevronRight, Circle, Eye, EyeOff, KeyRound, Lock, Medal as MedalIcon, Sparkles} from 'lucide-react';
import {useState, type FormEvent, type ReactNode} from 'react';
import Avatar from '../components/Avatar';
import {BadgeGrid, useBadgeFacts} from '../components/Badges';
import {InactiveNote, LockedNote} from '../components/Notices';
import PhotoPicker from '../components/PhotoPicker';
import {ProgressChart, useWeeks} from '../components/Progress';
import Sheet from '../components/Sheet';
import {saveFrame, saveNickname, savePhoto} from '../lib/accounts';
import {FRAMES, frameOf, isOpen, type Frame} from '../lib/frames';
import {useClasses} from '../lib/classes';
import {useKeys} from '../lib/keys';
import {refreshMine, useMedals} from '../lib/leaderboard';
import {useMyResults} from '../lib/results';
import {Link} from '../lib/router';
import {authError, changePassword, shownName, useSession, type Profile as ProfileData} from '../lib/session';
import {useSettings} from '../lib/settings';
import {badges} from '../lib/stats';
import Loading from '../components/Loading';
import MedalBadge from '../components/MedalBadge';

const field = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500';
const card = 'rounded-2xl bg-neutral-900';
const primary = 'rounded-full bg-blue-500 py-2.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50';
const secondary = 'rounded-full bg-neutral-800 py-2.5 text-sm font-semibold hover:bg-neutral-700';

type Status = {ok: boolean; text: string} | null;
type Open = 'nickname' | 'password' | 'frame' | null;

/**
 * The student's profile: photo and names up top, then one row per setting. A row opens its own sheet (from the bottom
 * on a phone), so the page fits on one screen instead of a long form.
 */
export default function Profile() {
  const session = useSession();
  const {profile} = session;
  const [open, setOpen] = useState<Open>(null);
  if (!session.ready) return <Loading />;
  if (!session.user) return <LockedNote />;
  if (!profile || profile.disabled) return <InactiveNote blocked={!!profile?.disabled} />;

  const nickname = profile.nickname?.trim();
  return (
    <div className="mx-auto max-w-xl space-y-4 py-4 sm:py-6">
      <h1 className="sr-only">Миний профайл</h1>
      <Identity profile={profile} />
      <div className={`${card} divide-y divide-neutral-800 overflow-hidden`}>
        <Row icon={<AtSign size={18} />} label="Nickname" value={nickname || <span className="text-neutral-500">Тавиагүй</span>} onClick={() => setOpen('nickname')} />
        <Row icon={<Sparkles size={18} />} label="Хүрээ" value={frameOf(profile.frame)?.name ?? <span className="text-neutral-500">Хүрээгүй</span>} onClick={() => setOpen('frame')} />
        <Row icon={<KeyRound size={18} />} label="Нууц үг" value={<span className="tracking-widest">••••••</span>} onClick={() => setOpen('password')} />
      </div>
      {!session.admin && <Medals uid={session.user.uid} />}
      {!session.admin && <Growth uid={session.user.uid} />}
      {open === 'nickname' && <NicknameSheet key={session.user.uid} profile={profile} onClose={() => setOpen(null)} />}
      {open === 'password' && <PasswordSheet onClose={() => setOpen(null)} />}
      {open === 'frame' && <FrameSheet uid={session.user.uid} profile={profile} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** The progress chart, then the badges. */
function Growth({uid}: {uid: string}) {
  const results = useMyResults();
  const keys = useKeys(results ? results.map((r) => r.test) : []);
  const weeks = useWeeks(uid, results, keys);
  const facts = useBadgeFacts(uid, results, keys);
  return (
    <>
      {weeks && <ProgressChart points={weeks} />}
      {facts && <BadgeGrid facts={facts} />}
    </>
  );
}

/** Leaderboard medals: each week's tests' gold, silver and bronze (its animal's) and the «Шилдэг» orders. */
function Medals({uid}: {uid: string}) {
  const settings = useSettings();
  const medals = useMedals(uid, true);
  if (!medals || (!medals.length && !settings?.leaderboard)) return null;
  return (
    <section className={`${card} p-5`}>
      <h2 className="flex items-center gap-2 font-semibold">
        <MedalIcon size={18} className="text-amber-300" /> Медалиуд {medals.length > 0 && <span className="text-sm font-normal text-neutral-500">{medals.length}</span>}
      </h2>
      {medals.length ? (
        <ul className="mt-4 grid grid-cols-3 gap-3">
          {medals.map((m) => (
            <MedalBadge key={m.key} m={m} detail />
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-neutral-400">
          
          <Link href="/leaderboard" className="text-blue-400 hover:underline">
            leaderboard
          </Link>
          -д долоо хоногийн эцэст тестийн эхний 3-т орвол тэр долоо хоногийн амьтны медаль, «Шилдэг оноогоор»-ын эхний 3-т орвол Шилдэгийн одон энд нэмэгдэнэ.
        </p>
      )}
    </section>
  );
}

function Row({icon, label, value, onClick}: {icon: ReactNode; label: string; value: ReactNode; onClick: () => void}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-neutral-800/60">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</span>
        <span className="block truncate">{value}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-neutral-500" />
    </button>
  );
}

/** Photo, the name the site shows, the login name; tap the photo to change it. */
function Identity({profile}: {profile: ProfileData}) {
  const [picking, setPicking] = useState(false);
  const myClass = useClasses()?.find((c) => c.id === profile.class)?.name;
  const [status, setStatus] = useState<Status>(null);
  const name = shownName(profile);
  // Without a connection the change is kept on the device and sent once it's back; the sheet doesn't wait for that.
  const save = async (photo: string | null) => {
    const write = savePhoto(photo).then(() => refreshMine({...profile, photo: photo ?? undefined}).catch(() => {}));
    const sent = await Promise.race([write.then(() => true), new Promise<false>((r) => setTimeout(() => r(false), 6000))]);
    setStatus({ok: true, text: sent ? (photo ? 'Зураг солигдлоо.' : 'Зураг арилгалаа.') : 'Интернэт холболт сэргэхэд хадгалагдана.'});
    write.catch((e) => setStatus({ok: false, text: authError(e)}));
  };
  const pick = () => {
    setStatus(null);
    setPicking(true);
  };

  return (
    <section className={`${card} flex flex-col items-center px-5 pb-5 pt-7 text-center`}>
      <button onClick={pick} aria-label="Зураг солих" className="relative rounded-full">
        <Avatar name={name} photo={profile.photo} frame={profile.frame} size={104} />
        <span className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-4 border-neutral-900 bg-blue-500 text-black">
          <Camera size={16} />
        </span>
      </button>
      <p className="mt-4 max-w-full break-words text-2xl font-bold">{name}</p>
      <p className="text-sm text-neutral-400">
        @{profile.username}
        {myClass && ` · ${myClass}`}
      </p>
      {profile.nickname?.trim() && <p className="mt-1 text-sm text-neutral-500">Жинхэнэ нэр: {profile.name}</p>}
      <button onClick={pick} className="mt-4 flex items-center gap-2 rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700">
        <Camera size={16} /> Зураг солих
      </button>
      {status && (
        <p className={`mt-3 flex items-center gap-1 text-sm ${status.ok ? 'text-green-400' : 'text-red-400'}`}>
          {status.ok && <Check size={16} />} {status.text}
        </p>
      )}
      {picking && <PhotoPicker name={name} photo={profile.photo} frame={profile.frame} onSave={save} onClose={() => setPicking(false)} />}
    </section>
  );
}

/** A frame around the picture: the plain ones open to all, the special ones once earned (a tap on a shut one says how). */
function FrameSheet({uid, profile, onClose}: {uid: string; profile: ProfileData; onClose: () => void}) {
  const results = useMyResults();
  const keys = useKeys(results ? results.map((r) => r.test) : []);
  const facts = useBadgeFacts(uid, results, keys);
  const [pick, setPick] = useState<string | null>(frameOf(profile.frame)?.id ?? null);
  const [why, setWhy] = useState<Frame | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = shownName(profile);
  const got = new Set(facts ? badges(facts).flatMap((b) => (b.earned ? [b.id] : [])) : []);
  const open = (f: Frame) => isOpen(f, got, !!profile.lead);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await saveFrame(pick);
      await refreshMine({...profile, frame: pick ?? undefined}).catch(() => {});
      onClose();
    } catch (e) {
      setError(/permission/i.test((e as Error).message) ? 'Энэ хүрээ танд хараахан нээгдээгүй байна.' : authError(e));
      setBusy(false);
    }
  };
  const option = (f: Frame | null) => {
    const shut = !!f && !open(f);
    const on = pick === (f?.id ?? null);
    return (
      <button
        key={f?.id ?? 'none'}
        type="button"
        onClick={() => (shut ? setWhy(f) : (setPick(f?.id ?? null), setWhy(null)))}
        aria-pressed={on}
        aria-label={`${f?.name ?? 'Хүрээгүй'}${shut ? ' (түгжээтэй)' : ''}`}
        className={`flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 ${on ? 'bg-blue-500/15 ring-1 ring-blue-400' : 'hover:bg-neutral-800'}`}
      >
        <span className="relative">
          <Avatar name={name} photo={profile.photo} frame={f?.id} size={52} />
          {shut && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-neutral-200">
              <Lock size={16} />
            </span>
          )}
        </span>
        <span className={`text-xs ${shut ? 'text-neutral-500' : 'text-neutral-200'}`}>{f?.name ?? 'Хүрээгүй'}</span>
      </button>
    );
  };
  return (
    <Sheet title="Хүрээ" sub="Зургийн тань эргэн тойронд, сайтын хаа сайгүй харагдана. Тусгай хүрээ амжилтаар нээгдэнэ." onClose={onClose}>
      <div className="flex justify-center pb-3 pt-1">
        <Avatar name={name} photo={profile.photo} frame={pick} size={104} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Энгийн</p>
      <div className="mt-1 grid grid-cols-4 gap-1">
        {option(null)}
        {FRAMES.filter((f) => !f.earn).map(option)}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Тусгай</p>
      <div className="mt-1 grid grid-cols-4 gap-1">{FRAMES.filter((f) => f.earn).map(option)}</div>
      {why?.earn && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-neutral-800/60 px-3 py-2 text-sm text-neutral-300">
          <Lock size={15} className="mt-0.5 shrink-0 text-neutral-400" />
          <span>
            «{why.name}» хүрээ нээгдэх нь: {why.earn.hint}.
          </span>
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={onClose} className={secondary}>
          Болих
        </button>
        <button type="button" onClick={save} disabled={busy || pick === (frameOf(profile.frame)?.id ?? null)} className={primary}>
          {busy ? 'Хадгалж байна…' : 'Хадгалах'}
        </button>
      </div>
    </Sheet>
  );
}

function NicknameSheet({profile, onClose}: {profile: ProfileData; onClose: () => void}) {
  const [nickname, setNickname] = useState(profile.nickname ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (value: string) => {
    setBusy(true);
    setError('');
    try {
      await saveNickname(value);
      await refreshMine({...profile, nickname: value.trim().replace(/\s+/g, ' ').slice(0, 30) || undefined}).catch(() => {});
      onClose();
    } catch (e) {
      setError(authError(e));
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save(nickname);
  };
  const preview = nickname.trim() || profile.name;
  const unchanged = nickname.trim() === (profile.nickname ?? '').trim();

  return (
    <Sheet title="Nickname" sub="Сайт дээр бусдад nickname тань харагдана. Багш жинхэнэ нэрийг тань бас харна." onClose={onClose}>
      <form onSubmit={submit}>
        <div className="relative">
          <input autoFocus className={`${field} pr-14`} value={nickname} maxLength={30} onChange={(e) => setNickname(e.target.value)} placeholder={profile.name} aria-label="Nickname" />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs tabular-nums text-neutral-500">{nickname.length}/30</span>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-neutral-800/50 px-3 py-2.5">
          <Avatar name={preview} photo={profile.photo} frame={profile.frame} size={32} />
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">Ингэж харагдана</p>
            <p className="truncate font-medium">{preview}</p>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          {profile.nickname ? (
            <button type="button" disabled={busy} onClick={() => save('')} className={secondary}>
              Арилгах
            </button>
          ) : (
            <button type="button" onClick={onClose} className={secondary}>
              Болих
            </button>
          )}
          <button disabled={busy || unchanged} className={primary}>
            {busy ? 'Хадгалж байна…' : 'Хадгалах'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/** A password field with its own show/hide eye. */
function Secret({label, value, onChange, autoComplete, autoFocus}: {label: string; value: string; onChange: (v: string) => void; autoComplete: string; autoFocus?: boolean}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="text-sm text-neutral-300">{label}</span>
      <span className="relative mt-1 block">
        <input autoFocus={autoFocus} className={`${field} pr-11`} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Нууц үгийг нуух' : 'Нууц үгийг харах'}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-400 hover:text-neutral-200"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

function PasswordSheet({onClose}: {onClose: () => void}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const rules = [
    {ok: next.length >= 6, text: 'Хамгийн багадаа 6 тэмдэгт'},
    {ok: !!next && next === again, text: 'Хоёр шинэ нууц үг таарч байна'},
    {ok: !!next && next !== current, text: 'Одоогийнхоосоо өөр'},
  ];
  const ready = !!current && rules.every((r) => r.ok);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (err) {
      const code = (err as {code?: string}).code ?? '';
      setError(['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(code) ? 'Одоогийн нууц үг буруу байна.' : authError(err));
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <Sheet title="Нууц үг солих" onClose={onClose}>
        <div className="flex flex-col items-center py-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15 text-green-400">
            <Check size={32} />
          </span>
          <p className="mt-4 text-lg font-semibold">Нууц үг солигдлоо</p>
          <p className="mt-1 text-sm text-neutral-400">Дараагийн удаа шинэ нууц үгээрээ нэвтэрнэ.</p>
          <button onClick={onClose} className={`${primary} mt-6 w-full`}>
            Болсон
          </button>
        </div>
      </Sheet>
    );

  return (
    <Sheet title="Нууц үг солих" sub="Шинэ нууц үгээ хэнд ч бүү хэлээрэй." onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Secret label="Одоогийн нууц үг" value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
        <Secret label="Шинэ нууц үг" value={next} onChange={setNext} autoComplete="new-password" />
        <Secret label="Шинэ нууц үг дахин" value={again} onChange={setAgain} autoComplete="new-password" />
        <ul className="space-y-1 pt-1 text-sm">
          {rules.map((r) => (
            <li key={r.text} className={`flex items-center gap-2 ${r.ok ? 'text-green-400' : 'text-neutral-500'}`}>
              {r.ok ? <Check size={16} /> : <Circle size={16} />} {r.text}
            </li>
          ))}
        </ul>
        {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondary}>
            Болих
          </button>
          <button disabled={busy || !ready} className={primary}>
            {busy ? 'Сольж байна…' : 'Солих'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
