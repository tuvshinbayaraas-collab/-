import {Download, Eye, EyeOff, LogIn} from 'lucide-react';
import {useEffect, useState, type FormEvent} from 'react';
import {BetaBadge, useGetApp} from '../components/GetApp';
import {Link, navigate, useLocation} from '../lib/router';
import {authError, logIn, useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {testInfo} from '../tests';

export default function Login() {
  const {query} = useLocation();
  const next = query.get('next')?.startsWith('/') ? query.get('next')! : '/';
  const session = useSession();
  const settings = useSettings();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const app = useGetApp();

  useEffect(() => {
    if (session.ready && session.user) navigate(next);
  }, [session.ready, session.user, next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return setError('Нэвтрэх нэр, нууц үгээ оруулна уу.');
    setBusy(true);
    setError('');
    try {
      await logIn(username, password);
    } catch (err) {
      setError(authError(err));
    } finally {
      setBusy(false);
    }
  };

  const trial = settings?.trial ? testInfo(settings.trial) : undefined;
  const field = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500';

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-2xl font-bold">Нэвтрэх</h1>
      <p className="mt-1 text-sm text-neutral-400">Нэвтрэх нэр, нууц үгээ багшаасаа аваарай.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-neutral-300">Нэвтрэх нэр</span>
          <input
            className={`${field} mt-1`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-sm text-neutral-300">Нууц үг</span>
          <div className="relative mt-1">
            <input className={`${field} pr-11`} type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-400 hover:text-neutral-200"
              aria-label={show ? 'Нууц үгийг нуух' : 'Нууц үгийг харах'}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-500 py-2.5 font-semibold text-black hover:bg-blue-400 disabled:opacity-60">
          <LogIn size={18} /> {busy ? 'Нэвтэрч байна…' : 'Нэвтрэх'}
        </button>
      </form>
      {!app.installed && (
        <div className="mt-8 rounded-2xl border border-neutral-800 p-4">
          <button onClick={app.start} className="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-800 py-2.5 text-sm font-semibold hover:bg-neutral-700">
            <Download size={18} /> Апп татах <BetaBadge />
          </button>
          <p className="mt-2 text-center text-xs text-neutral-500">Утасныхаа нүүр дэлгэцэд нэмээд апп шиг нээж ашиглана.</p>
        </div>
      )}
      {trial && (
        <p className="mt-8 text-center text-sm text-neutral-400">
          Бүртгэлгүй юу?{' '}
          <Link href={`/test/${trial.id}`} className="text-blue-400 hover:underline">
            {trial.title}-ийг туршилтаар өгөх
          </Link>
        </p>
      )}
    </div>
  );
}
