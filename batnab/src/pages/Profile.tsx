import {Camera, Check, Trash2} from 'lucide-react';
import {useRef, useState, type FormEvent} from 'react';
import Avatar from '../components/Avatar';
import {InactiveNote, LockedNote} from '../components/Notices';
import {saveNickname, savePhoto, squarePhoto} from '../lib/accounts';
import {authError, changePassword, shownName, useSession} from '../lib/session';

const field = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-blue-500';

export default function Profile() {
  const session = useSession();
  const {profile} = session;
  if (!session.ready) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  if (!session.user) return <LockedNote />;
  if (!profile || profile.disabled) return <InactiveNote blocked={!!profile?.disabled} />;

  return (
    <div className="mx-auto max-w-xl space-y-6 py-6">
      <h1 className="text-2xl font-bold">Миний профайл</h1>
      <PhotoAndName key={session.user.uid} />
      <PasswordForm />
    </div>
  );
}

function PhotoAndName() {
  const {profile} = useSession();
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!profile) return null;

  const run = async (job: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setStatus('');
    try {
      await job();
      setStatus(done);
    } catch (e) {
      setStatus(`Алдаа: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const pick = (file: File | undefined) => file && run(async () => savePhoto(await squarePhoto(file)), 'Зураг солигдлоо.');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => saveNickname(nickname), 'Хоч хадгалагдлаа.');
  };

  return (
    <section className="rounded-2xl bg-neutral-900 p-5">
      <div className="flex flex-wrap items-center gap-5">
        <Avatar name={shownName(profile)} photo={profile.photo} size={88} />
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button disabled={busy} onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-60">
            <Camera size={16} /> Зураг солих
          </button>
          {profile.photo && (
            <button disabled={busy} onClick={() => run(() => savePhoto(null), 'Зураг устлаа.')} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800 disabled:opacity-60">
              <Trash2 size={16} /> Устгах
            </button>
          )}
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-neutral-400">Нэр</dt>
        <dd>{profile.name}</dd>
        <dt className="text-neutral-400">Нэвтрэх нэр</dt>
        <dd>{profile.username}</dd>
      </dl>
      <form onSubmit={submit} className="mt-5">
        <label className="block text-sm text-neutral-300" htmlFor="nickname">
          Хоч нэр
        </label>
        <div className="mt-1 flex gap-2">
          <input id="nickname" className={field} value={nickname} maxLength={30} onChange={(e) => setNickname(e.target.value)} placeholder={profile.name} />
          <button disabled={busy || nickname.trim() === (profile.nickname ?? '')} className="shrink-0 rounded-full bg-blue-500 px-4 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
            Хадгалах
          </button>
        </div>
        <p className="mt-1 text-xs text-neutral-500">Сайт дээр хоч нэр тань харагдана. Багш таны жинхэнэ нэр болон хочийг хоёуланг нь харна.</p>
      </form>
      {status && <p className={`mt-3 text-sm ${status.startsWith('Алдаа') ? 'text-red-400' : 'text-green-400'}`}>{status}</p>}
    </section>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [status, setStatus] = useState<{ok: boolean; text: string} | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 6) return setStatus({ok: false, text: 'Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байна.'});
    if (next !== again) return setStatus({ok: false, text: 'Шинэ нууц үгүүд таарахгүй байна.'});
    setBusy(true);
    setStatus(null);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setAgain('');
      setStatus({ok: true, text: 'Нууц үг солигдлоо.'});
    } catch (err) {
      setStatus({ok: false, text: authError(err)});
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-neutral-900 p-5">
      <h2 className="font-semibold">Нууц үг солих</h2>
      <div className="mt-3 grid gap-3">
        <input className={field} type="password" placeholder="Одоогийн нууц үг" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        <input className={field} type="password" placeholder="Шинэ нууц үг" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        <input className={field} type="password" placeholder="Шинэ нууц үг дахин" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
      </div>
      {status && (
        <p className={`mt-3 flex items-center gap-1 text-sm ${status.ok ? 'text-green-400' : 'text-red-400'}`}>
          {status.ok && <Check size={16} />} {status.text}
        </p>
      )}
      <button disabled={busy || !current || !next} className="mt-4 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
        {busy ? 'Сольж байна…' : 'Солих'}
      </button>
    </form>
  );
}
