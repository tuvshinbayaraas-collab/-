import {Download, Eye, EyeOff, ListChecks, LogIn, NotebookPen, RefreshCw, Zap} from 'lucide-react';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {BetaBadge, useGetApp} from '../components/GetApp';
import {LogoMark} from '../components/Logo';
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

  // Signing in that takes long (a slow or broken connection): said so, with a way to try again.
  const [slow, setSlow] = useState(false);
  const tries = useRef(0);
  const go = async () => {
    if (!username.trim() || !password) return setError('Нэвтрэх нэр, нууц үгээ оруулна уу.');
    const n = ++tries.current;
    setBusy(true);
    setSlow(false);
    setError('');
    const t = setTimeout(() => n === tries.current && setSlow(true), 7000);
    try {
      await logIn(username, password);
    } catch (err) {
      if (n === tries.current) setError(authError(err));
    } finally {
      clearTimeout(t);
      if (n === tries.current) {
        setBusy(false);
        setSlow(false);
      }
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void go();
  };

  const trial = settings?.trial ? testInfo(settings.trial) : undefined;
  const field = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500';

  return (
    // On a computer: the site's panel beside the form.
    <div className="mx-auto max-w-sm py-10 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center lg:gap-16 lg:py-14">
      <BrandPanel />
      <div>
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
          {slow && (
            <div role="status" className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <p>{navigator.onLine ? 'Нэвтрэхэд удаж байна. Интернэт сул эсвэл сервер ачаалалтай байж магадгүй.' : 'Интернэт холболт алга байна. Холбогдоод дахин оролдоно уу.'}</p>
              <button type="button" onClick={() => void go()} className="mt-2 inline-flex items-center gap-1.5 font-semibold text-amber-200 underline underline-offset-2">
                <RefreshCw size={14} /> Дахин оролдох
              </button>
            </div>
          )}
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
    </div>
  );
}

/** What Batnab is, in the site's colours (a computer's login page only). */
function BrandPanel() {
  const points: [typeof ListChecks, string, string][] = [
    [ListChecks, 'Тест, шалгалт', 'Бодлого бүр холилдож, дуусгахад оноо, алдаа тэр даруй.'],
    [NotebookPen, 'Алдааны дэвтэр', 'Алдсан бодлого өөрөө орж, давтах өдөр нь эргэж гарна.'],
    [Zap, 'Шууд тэмцээн', 'Ангиараа, багаараа утсаар уралдана.'],
  ];
  return (
    <section className="relative hidden overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-600/30 via-blue-500/10 to-transparent p-10 lg:block">
      <span aria-hidden className="pointer-events-none absolute -right-6 -top-10 select-none font-serif text-[11rem] leading-none text-blue-300/10">
        √
      </span>
      <LogoMark size={56} />
      <p className="mt-5 text-4xl font-extrabold tracking-tight">Batnab</p>
      <p className="mt-2 text-lg text-neutral-300">Ангийн математикийн тест, дасгал</p>
      <ul className="mt-8 space-y-5">
        {points.map(([Icon, title, text]) => (
          <li key={title} className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
              <Icon size={20} />
            </span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-neutral-400">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
