import {CircleHelp, Clock, Forward, Medal, Trophy, Type} from 'lucide-react';
import {useState, type ReactNode} from 'react';
import {useGuideRole} from '../components/Guide';
import {LockedNote} from '../components/Notices';
import {showGuideAgain} from '../lib/guide';
import {grade, useKeys} from '../lib/keys';
import {compare, submitScore, withdraw, type Entry} from '../lib/leaderboard';
import {savePref, usePrefs, type PrefKey} from '../lib/prefs';
import {useMyResults} from '../lib/results';
import {Link} from '../lib/router';
import {useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {testInfo} from '../tests';

/** The menu's "Тохиргоо": the user's own settings, saved to their account. */
export default function SettingsPage() {
  const session = useSession();
  const settings = useSettings();
  const prefs = usePrefs();
  const results = useMyResults();
  const keys = useKeys(results ? results.map((r) => r.test) : []);
  const guideRole = useGuideRole();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<PrefKey | null>(null);

  if (session.ready && !session.user) return <LockedNote text="Тохиргоогоо өөрчлөхийн тулд нэвтэрнэ үү." />;
  if (!session.ready || !session.profile) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  const profile = session.profile;

  const change = async (key: PrefKey, on: boolean) => {
    setError('');
    setBusy(key);
    try {
      await savePref(key, on);
      if (key === 'lbOff' && on) await withdraw();
      // Back on the leaderboard: this week's best score of each test goes up again.
      if (key === 'lbOff' && !on) {
        const best = new Map<string, Entry>();
        for (const r of results ?? []) {
          const g = grade(r.answers, keys[r.test], testInfo(r.test)!.count);
          if (!g) continue;
          const e: Entry = {uid: r.uid, test: r.test, score: g.score, total: g.total, seconds: r.seconds, name: '', rid: r.id, at: r.at};
          const b = best.get(r.test);
          if (!b || compare(e, b) < 0) best.set(r.test, e);
        }
        const me = {...profile, prefs: {...profile.prefs, lbOff: false}};
        await Promise.all([...best.values()].map((e) => submitScore(e.test, {score: e.score, total: e.total, count: e.total}, e.seconds, e.rid, me)));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggle = (key: PrefKey, icon: ReactNode, title: string, text: string, invert = false) => (
    <Toggle icon={icon} title={title} text={text} on={invert ? !prefs[key] : prefs[key]} busy={busy === key} onChange={(on) => change(key, invert ? !on : on)} />
  );

  return (
    <div className="mx-auto max-w-xl space-y-6 py-4 sm:py-6">
      <h1 className="text-2xl font-bold">Тохиргоо</h1>

      {settings?.leaderboard && (
        <Group title="Leaderboard">
          {session.admin ? (
            <p className="px-4 py-3.5 text-sm text-neutral-400">
              Багш leaderboard-д оролцохгүй. Leaderboard-ийг бүхэлд нь{' '}
              <Link href="/admin?tab=settings" className="text-blue-400 hover:underline">
                багшийн самбарын Тохиргоо
              </Link>{' '}
              хэсгээс унтраана.
            </p>
          ) : (
            <>
              {toggle('lbOff', <Trophy size={18} />, 'Оноогоо leaderboard-д харуулах', 'Бусдад таны nickname (эсвэл нэвтрэх нэр), зураг, оноо харагдана, жинхэнэ нэр харагдахгүй. Унтраавал энэ долоо хоногийн оноо тань хасагдаж, медаль авахгүй.', true)}
              {toggle('lbHideRank', <Medal size={18} />, 'Тест дуусахад байраа харуулах', 'Тестээ дуусгасны дараа leaderboard-ийн хэддүгээрт явааг тань харуулна.', true)}
            </>
          )}
        </Group>
      )}

      <Group title="Тест өгөх">
        {toggle('hideTimer', <Clock size={18} />, 'Цаг харуулах', 'Тест өгөх үед зарцуулсан хугацаа дээд талд гүйж харагдана. Шалгалтын үлдсэн хугацаа үргэлж харагдана.', true)}
        {toggle('autoNext', <Forward size={18} />, 'Дараагийн бодлого руу шилжих', 'Хариултаа сонгоход дараагийн бодлого руу автоматаар гүйлгэнэ.')}
      </Group>

      <Group title="Харагдац">{toggle('bigText', <Type size={18} />, 'Том үсэг', 'Сайтын бүх бичгийг томруулж харуулна.')}</Group>

      {guideRole && (
        <Group title="Тусламж">
          <button onClick={() => showGuideAgain(guideRole)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-neutral-800/60">
            <Icon>
              <CircleHelp size={18} />
            </Icon>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Зааврыг дахин харуулах</span>
              <span className="block text-sm text-neutral-400">«Дахин харахгүй» гэж чагталсан зааврыг дахин нээнэ.</span>
            </span>
          </button>
        </Group>
      )}

      {error && <p className="text-sm text-red-400">Хадгалж чадсангүй: {error}</p>}
      <p className="text-center text-xs text-neutral-500">Тохиргоо таны бүртгэлд хадгалагдах тул өөр утас, компьютер дээр ч адилхан байна.</p>
    </div>
  );
}

function Group({title, children}: {title: string; children: ReactNode}) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">{title}</h2>
      <div className="divide-y divide-neutral-800 overflow-hidden rounded-2xl bg-neutral-900">{children}</div>
    </section>
  );
}

const Icon = ({children}: {children: ReactNode}) => <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">{children}</span>;

/** A setting with an on/off switch; the whole row is the control. */
function Toggle({icon, title, text, on, busy, onChange}: {icon: ReactNode; title: string; text: string; on: boolean; busy: boolean; onChange: (on: boolean) => void}) {
  return (
    <button role="switch" aria-checked={on} disabled={busy} onClick={() => onChange(!on)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-neutral-800/60 disabled:opacity-60">
      <Icon>{icon}</Icon>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-neutral-400">{text}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-blue-500' : 'bg-neutral-700'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${on ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}
