import {ChevronRight, CircleHelp, Clock, Forward, Medal, Settings2, Trophy, Type} from 'lucide-react';
import {useState, type ReactNode} from 'react';
import {useGuideRole} from '../components/Guide';
import {InactiveNote, LockedNote} from '../components/Notices';
import Switch, {SavedNote, useSavedNote} from '../components/Switch';
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
  const [saved, flash] = useSavedNote();

  if (session.ready && !session.user) return <LockedNote text="Тохиргоогоо өөрчлөхийн тулд нэвтэрнэ үү." />;
  if (!session.ready) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  if (!session.profile || session.profile.disabled) return <InactiveNote blocked={!!session.profile?.disabled} />;
  const profile = session.profile;

  const change = async (key: PrefKey, on: boolean) => {
    setError('');
    // The switch flips at once: the database applies the change on this device straight away and sends it as soon
    // as it can (also when offline). Only the leaderboard one waits, as it takes this week's scores off or back on.
    const save = savePref(key, on);
    if (key !== 'lbOff') return void save.then(flash, (e) => setError((e as Error).message));
    setBusy(key);
    try {
      await save;
      if (on) await withdraw();
      // Back on the leaderboard: this week's best score of each test goes up again.
      if (!on) {
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
      flash();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggle = (key: PrefKey, tone: Tone, icon: ReactNode, title: string, text: string, invert = false) => (
    <Switch on={invert ? !prefs[key] : prefs[key]} busy={busy === key} onChange={(on) => change(key, invert ? !on : on)} className="px-4 py-4">
      <Icon tone={tone}>{icon}</Icon>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-neutral-400">{text}</span>
      </span>
    </Switch>
  );

  return (
    <div className="mx-auto max-w-xl space-y-6 py-4 sm:py-6">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
          <Settings2 size={24} />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Тохиргоо</h1>
          <p className="text-sm text-neutral-400">Шууд хадгалагдана. Өөр утас, компьютер дээр ч адилхан.</p>
        </div>
      </header>

      {settings?.leaderboard && (
        <Group title="Leaderboard">
          {session.admin ? (
            <p className="px-4 py-4 text-sm text-neutral-400">
              Багш leaderboard-д оролцохгүй. Leaderboard-ийг бүхэлд нь{' '}
              <Link href="/admin?tab=settings" className="text-blue-400 hover:underline">
                багшийн самбарын Тохиргоо
              </Link>{' '}
              хэсгээс унтраана.
            </p>
          ) : (
            <>
              {toggle('lbOff', 'amber', <Trophy size={18} />, 'Оноогоо leaderboard-д харуулах', 'Асаалттай үед бусад сурагчид таны nickname, зураг, оноог харна. Жинхэнэ нэр тань харагдахгүй. Унтраавал энэ долоо хоногийн оноо тань leaderboard-оос хасагдаж, медаль авахгүй.', true)}
              {toggle('lbHideRank', 'amber', <Medal size={18} />, 'Тест дуусахад байраа харуулах', 'Тестээ дуусгасны дараа leaderboard-ийн хэддүгээрт явааг тань харуулна.', true)}
            </>
          )}
        </Group>
      )}

      <Group title="Тест өгөх">
        {toggle('hideTimer', 'green', <Clock size={18} />, 'Цаг харуулах', 'Тест өгөх үед зарцуулсан хугацаа дээд талд харагдана. Шалгалтын үлдсэн хугацаа үргэлж харагдана.', true)}
        {toggle('autoNext', 'green', <Forward size={18} />, 'Дараагийн бодлого руу шилжих', 'Хариултаа сонгомогц дараагийн бодлого руу өөрөө гүйлгэнэ.')}
      </Group>

      <Group title="Харагдац">{toggle('bigText', 'violet', <Type size={18} />, 'Том үсэг', 'Сайтын бүх бичгийг томруулж харуулна.')}</Group>

      {guideRole && (
        <Group title="Тусламж">
          <button
            onClick={() => showGuideAgain(guideRole)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left outline-none transition-colors hover:bg-neutral-800/50 focus-visible:bg-neutral-800/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
          >
            <Icon tone="blue">
              <CircleHelp size={18} />
            </Icon>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Зааврыг дахин үзэх</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-neutral-400">Сайтыг хэрхэн ашиглахыг алхам алхмаар дахин үзүүлнэ.</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black">
              Үзэх <ChevronRight size={16} />
            </span>
          </button>
        </Group>
      )}

      {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">Хадгалж чадсангүй: {error}</p>}
      <SavedNote show={saved} />
    </div>
  );
}

const TONES = {
  amber: 'bg-amber-500/15 text-amber-300',
  green: 'bg-green-500/15 text-green-300',
  violet: 'bg-violet-500/15 text-violet-300',
  blue: 'bg-blue-500/15 text-blue-300',
};
type Tone = keyof typeof TONES;

function Group({title, children}: {title: string; children: ReactNode}) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">{title}</h2>
      <div className="divide-y divide-neutral-800 overflow-hidden rounded-2xl bg-neutral-900">{children}</div>
    </section>
  );
}

const Icon = ({tone, children}: {tone: Tone; children: ReactNode}) => (
  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>{children}</span>
);
