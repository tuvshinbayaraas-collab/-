import {AtSign, Camera, Check, ChevronRight, Circle, Eye, EyeOff, KeyRound, Trash2, X} from 'lucide-react';
import {useEffect, useId, useRef, useState, type FormEvent, type ReactNode} from 'react';
import Avatar from '../components/Avatar';
import {InactiveNote, LockedNote} from '../components/Notices';
import {saveNickname, savePhoto, squarePhoto} from '../lib/accounts';
import {authError, changePassword, shownName, useSession, type Profile as ProfileData} from '../lib/session';

const field = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500';
const card = 'rounded-2xl bg-neutral-900';
const primary = 'rounded-full bg-blue-500 py-2.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50';
const secondary = 'rounded-full bg-neutral-800 py-2.5 text-sm font-semibold hover:bg-neutral-700';

type Status = {ok: boolean; text: string} | null;
type Open = 'nickname' | 'password' | null;

/**
 * The student's profile: photo and names up top, then one row per setting. A row opens its own sheet (from the bottom
 * on a phone), so the page fits on one screen instead of a long form.
 */
export default function Profile() {
  const session = useSession();
  const {profile} = session;
  const [open, setOpen] = useState<Open>(null);
  if (!session.ready) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  if (!session.user) return <LockedNote />;
  if (!profile || profile.disabled) return <InactiveNote blocked={!!profile?.disabled} />;

  const nickname = profile.nickname?.trim();
  return (
    <div className="mx-auto max-w-xl space-y-4 py-4 sm:py-6">
      <h1 className="sr-only">Миний профайл</h1>
      <Identity profile={profile} />
      <div className={`${card} divide-y divide-neutral-800 overflow-hidden`}>
        <Row icon={<AtSign size={18} />} label="Nickname" value={nickname || <span className="text-neutral-500">Тавиагүй</span>} onClick={() => setOpen('nickname')} />
        <Row icon={<KeyRound size={18} />} label="Нууц үг" value={<span className="tracking-widest">••••••</span>} onClick={() => setOpen('password')} />
      </div>
      {open === 'nickname' && <NicknameSheet key={session.user.uid} profile={profile} onClose={() => setOpen(null)} />}
      {open === 'password' && <PasswordSheet onClose={() => setOpen(null)} />}
    </div>
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const name = shownName(profile);
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
      {status && (
        <p className={`mt-3 flex items-center gap-1 text-sm ${status.ok ? 'text-green-400' : 'text-red-400'}`}>
          {status.ok && <Check size={16} />} {status.text}
        </p>
      )}
    </section>
  );
}

/** A panel over the page: slides up from the bottom on a phone, centered on a wider screen. Escape or the backdrop closes it. */
function Sheet({title, sub, onClose, children}: {title: string; sub?: string; onClose: () => void; children: ReactNode}) {
  const id = useId();
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={id}>
      <div
        className="max-h-[90dvh] w-full max-w-md animate-[sheet-up_.22s_ease-out] motion-reduce:animate-none overflow-y-auto rounded-t-3xl bg-neutral-900 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:animate-none sm:rounded-3xl sm:pt-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-neutral-700 sm:hidden" />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={id} className="text-lg font-semibold">
              {title}
            </h2>
            {sub && <p className="mt-0.5 text-sm text-neutral-400">{sub}</p>}
          </div>
          <button onClick={onClose} aria-label="Хаах" className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
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
          <Avatar name={preview} photo={profile.photo} size={32} />
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
