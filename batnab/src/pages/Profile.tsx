import {
  AtSign,
  Camera,
  Check,
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  Image as ImageIcon,
  KeyRound,
  Lock,
  Medal as MedalIcon,
  MessageSquareText,
  Sparkles,
  UserRound,
} from 'lucide-react';
import {useEffect, useState, type FormEvent, type ReactNode} from 'react';
import Avatar from '../components/Avatar';
import {ORNAMENTED} from '../components/FrameOrnament';
import ProfileBanner from '../components/ProfileBanner';
import {BadgeGrid, useBadgeFacts} from '../components/Badges';
import {InactiveNote, LockedNote} from '../components/Notices';
import PhotoPicker from '../components/PhotoPicker';
import {ProgressChart, useWeeks} from '../components/Progress';
import Sheet from '../components/Sheet';
import {saveBanner, saveFrame, saveNickname, savePhoto} from '../lib/accounts';
import {BANNERS, bannerOf, type Banner} from '../lib/banners';
import {FRAMES, frameOf, isOpen, type Frame} from '../lib/frames';
import {useClasses} from '../lib/classes';
import {useKeys} from '../lib/keys';
import {refreshMine, useMedals} from '../lib/leaderboard';
import {ABOUT_MAX, saveAbout, syncMine, usePerson} from '../lib/people';
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
type Open = 'nickname' | 'password' | 'frame' | 'banner' | 'about' | null;

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
      <Identity profile={profile} onBanner={() => setOpen('banner')} />
      <div className={`${card} divide-y divide-neutral-800 overflow-hidden`}>
        <Row
          icon={<AtSign size={18} />}
          label="Nickname"
          value={nickname || <span className="text-neutral-500">Тавиагүй</span>}
          onClick={() => setOpen('nickname')}
        />
        <Row
          icon={<Sparkles size={18} />}
          label="Хүрээ"
          value={frameOf(profile.frame)?.name ?? <span className="text-neutral-500">Хүрээгүй</span>}
          onClick={() => setOpen('frame')}
        />
        <Row
          icon={<ImageIcon size={18} />}
          label="Баннер"
          value={bannerOf(profile.banner)?.name ?? <span className="text-neutral-500">Баннергүй</span>}
          onClick={() => setOpen('banner')}
        />
        {!session.admin && (
          <Row
            icon={<MessageSquareText size={18} />}
            label="Миний тухай"
            value={profile.about?.trim() || <span className="text-neutral-500">Бичээгүй — профайл дээр тань гарна</span>}
            onClick={() => setOpen('about')}
          />
        )}
        <Row icon={<KeyRound size={18} />} label="Нууц үг" value={<span className="tracking-widest">••••••</span>} onClick={() => setOpen('password')} />
      </div>
      {!session.admin && (
        <Link href={`/u/${session.user.uid}`} className={`${card} flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-800/60`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
            <UserRound size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Бусдад хэрхэн харагдах вэ?</span>
            <span className="block text-sm text-neutral-400">
              {profile.prefs?.profileHidden ? 'Профайлаа нуусан байна (Тохиргоо)' : 'Ангийнхан тань «Сурагчид» хэсгээс таныг олж харна'}
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-neutral-500" />
        </Link>
      )}
      {!session.admin && <Medals uid={session.user.uid} />}
      {!session.admin && <Growth uid={session.user.uid} />}
      {open === 'nickname' && <NicknameSheet key={session.user.uid} profile={profile} onClose={() => setOpen(null)} />}
      {open === 'password' && <PasswordSheet onClose={() => setOpen(null)} />}
      {open === 'frame' && <FrameSheet uid={session.user.uid} profile={profile} onClose={() => setOpen(null)} />}
      {open === 'banner' && <BannerSheet uid={session.user.uid} profile={profile} onClose={() => setOpen(null)} />}
      {open === 'about' && <AboutSheet profile={profile} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** The progress chart, then the badges. */
function Growth({uid}: {uid: string}) {
  const results = useMyResults();
  const keys = useKeys(results ? results.map((r) => r.test) : []);
  const weeks = useWeeks(uid, results, keys);
  const facts = useBadgeFacts(uid, results, keys);
  // The badges earned go on the public profile (lib/people).
  const {profile} = useSession();
  const person = usePerson(uid);
  const earned = facts
    ? badges(facts)
        .flatMap((b) => (b.earned ? [b.id] : []))
        .join(',')
    : null;
  useEffect(() => {
    if (earned === null || person === null || !profile || profile.prefs?.profileHidden || (person?.badges.join(',') ?? '') === earned) return;
    syncMine(profile, earned ? earned.split(',') : []).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earned, person?.badges.join(','), person === null]);
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
        <MedalIcon size={18} className="text-amber-300" /> Медалиуд{' '}
        {medals.length > 0 && <span className="text-sm font-normal text-neutral-500">{medals.length}</span>}
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

/** The banner, the photo over its lower edge, the name the site shows, the login name; tap the photo to change it. */
function Identity({profile, onBanner}: {profile: ProfileData; onBanner: () => void}) {
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
    <section className={`${card} overflow-hidden text-center`}>
      <ProfileBanner id={profile.banner} className="h-28 sm:h-32">
        <button
          type="button"
          onClick={onBanner}
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/60"
        >
          <ImageIcon size={14} /> Баннер
        </button>
      </ProfileBanner>
      <div className="flex flex-col items-center px-5 pb-5">
        <button onClick={pick} aria-label="Зураг солих" className="relative -mt-16 rounded-full bg-neutral-900 p-1.5">
          <Avatar name={name} photo={profile.photo} frame={profile.frame} size={104} />
          {/* Not over a special frame's ornament («Зураг солих» is just below). */}
          {!ORNAMENTED.has(profile.frame ?? '') && (
            <span className="absolute -right-2 bottom-0 flex h-9 w-9 items-center justify-center rounded-full border-4 border-neutral-900 bg-blue-500 text-black">
              <Camera size={16} />
            </span>
          )}
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
      </div>
    </section>
  );
}

/**
 * «Хүрээ сонгох»: the frame picked shows big at the top (and small, as in a list, at the bottom); the plain ones and
 * the special ones on two tabs. A special one not earned yet shows with a lock beside its name; a tap on it says how to
 * earn it.
 */
function FrameSheet({uid, profile, onClose}: {uid: string; profile: ProfileData; onClose: () => void}) {
  const results = useMyResults();
  const keys = useKeys(results ? results.map((r) => r.test) : []);
  const facts = useBadgeFacts(uid, results, keys);
  const now = frameOf(profile.frame)?.id ?? null;
  const [pick, setPick] = useState<string | null>(now);
  const [tab, setTab] = useState<'plain' | 'special'>(frameOf(now)?.earn ? 'special' : 'plain');
  const [why, setWhy] = useState<Frame | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = shownName(profile);
  const got = new Set(facts ? badges(facts).flatMap((b) => (b.earned ? [b.id] : [])) : []);
  const open = (f: Frame) => isOpen(f, got, !!profile.lead);
  const picked = frameOf(pick);
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
    const id = f?.id ?? null;
    const shut = !!f && !open(f);
    const on = pick === id;
    return (
      <button
        key={id ?? 'none'}
        type="button"
        onClick={() => (shut ? setWhy(f) : (setPick(id), setWhy(null)))}
        aria-pressed={on}
        aria-label={`${f?.name ?? 'Хүрээгүй'}${shut ? ' (түгжээтэй)' : ''}`}
        className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-1 pb-2.5 pt-4 ${on ? 'border-blue-400 bg-blue-500/10' : 'border-transparent hover:bg-neutral-800/60'}`}
      >
        {on && (
          <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-black">
            <Check size={14} strokeWidth={3} />
          </span>
        )}
        <Avatar name={name} photo={profile.photo} frame={id} size={64} />
        <span className={`mt-1 flex items-center gap-1 text-sm font-medium ${shut ? 'text-neutral-300' : 'text-neutral-100'}`}>
          {f?.name ?? 'Хүрээгүй'}
          {shut && <Lock size={13} className="text-neutral-400" />}
        </span>
        {id === now && <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-200">Одоогийн</span>}
      </button>
    );
  };
  return (
    <Sheet title="Хүрээ сонгох" sub="Таны зурагт тохирох жижиг чимэглэл." onClose={onClose}>
      {/* The one picked, as it will look. */}
      <div className="flex items-center gap-4 rounded-2xl bg-neutral-800/50 p-4">
        <span className="shrink-0 p-2">
          <Avatar name={name} photo={profile.photo} frame={pick} size={88} />
        </span>
        <span className="h-16 w-px shrink-0 bg-neutral-700" aria-hidden />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{picked?.name ?? 'Хүрээгүй'}</span>
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-200">Сонгосон</span>
          </span>
          <span className="mt-0.5 block text-sm text-neutral-400">Таны профайл дээр ингэж харагдана</span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 rounded-full bg-neutral-800/60 p-1 text-sm font-medium" role="tablist" aria-label="Хүрээний төрөл">
        {(
          [
            ['plain', 'Энгийн'],
            ['special', 'Тусгай'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => (setTab(id), setWhy(null))}
            className={`rounded-full py-2 ${tab === id ? 'bg-blue-500 text-white' : 'text-neutral-300 hover:text-neutral-100'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {tab === 'plain' ? [option(null), ...FRAMES.filter((f) => !f.earn).map(option)] : FRAMES.filter((f) => f.earn).map(option)}
      </div>
      {why?.earn && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-neutral-800/60 px-3 py-2 text-sm text-neutral-300">
          <Lock size={15} className="mt-0.5 shrink-0 text-neutral-400" />
          <span>
            «{why.name}» хүрээ нээгдэх нь: {why.earn.hint}.
          </span>
        </p>
      )}

      {/* Small, as in the students' list. */}
      <p className="mt-4 border-t border-neutral-800 pt-3 text-sm font-semibold">Жижиг хэмжээнд</p>
      <div className="mt-2 flex items-center gap-3 rounded-2xl bg-neutral-800/50 px-4 py-3" aria-hidden>
        <Avatar name={name} photo={profile.photo} frame={pick} size={44} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{profile.name}</span>
          <span className="block truncate text-sm text-neutral-400">@{profile.nickname?.trim() || profile.username}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-neutral-500" />
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-neutral-800 pt-4">
        <button type="button" onClick={onClose} className={secondary}>
          Болих
        </button>
        <button type="button" onClick={save} disabled={busy || pick === now} className={primary}>
          {busy ? 'Хадгалж байна…' : 'Хадгалах'}
        </button>
      </div>
    </Sheet>
  );
}

/** «Баннер сонгох»: as the frames are picked — the plain ones and the special ones on two tabs, a lock on one not earned. */
function BannerSheet({uid, profile, onClose}: {uid: string; profile: ProfileData; onClose: () => void}) {
  const results = useMyResults();
  const keys = useKeys(results ? results.map((r) => r.test) : []);
  const facts = useBadgeFacts(uid, results, keys);
  const now = bannerOf(profile.banner)?.id ?? null;
  const [pick, setPick] = useState<string | null>(now);
  const [tab, setTab] = useState<'plain' | 'special'>(bannerOf(now)?.earn ? 'special' : 'plain');
  const [why, setWhy] = useState<Banner | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = shownName(profile);
  const got = new Set(facts ? badges(facts).flatMap((b) => (b.earned ? [b.id] : [])) : []);
  const open = (b: Banner) => isOpen(b, got, !!profile.lead);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await saveBanner(pick);
      await syncMine({...profile, banner: pick ?? undefined}).catch(() => {});
      onClose();
    } catch (e) {
      setError(/permission/i.test((e as Error).message) ? 'Энэ баннер танд хараахан нээгдээгүй байна.' : authError(e));
      setBusy(false);
    }
  };
  const option = (b: Banner | null) => {
    const id = b?.id ?? null;
    const shut = !!b && !open(b);
    const on = pick === id;
    return (
      <button
        key={id ?? 'none'}
        type="button"
        onClick={() => (shut ? setWhy(b) : (setPick(id), setWhy(null)))}
        aria-pressed={on}
        aria-label={`${b?.name ?? 'Баннергүй'}${shut ? ' (түгжээтэй)' : ''}`}
        className={`relative flex flex-col gap-1.5 rounded-2xl border p-1.5 pb-2 text-left ${on ? 'border-blue-400 bg-blue-500/10' : 'border-transparent hover:bg-neutral-800/60'}`}
      >
        <ProfileBanner id={id} className="h-16 rounded-xl" />
        {on && (
          <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-black">
            <Check size={14} strokeWidth={3} />
          </span>
        )}
        <span className="flex flex-wrap items-center gap-1.5 px-1 text-sm font-medium">
          {b?.name ?? 'Баннергүй'}
          {shut && <Lock size={13} className="text-neutral-400" />}
          {id === now && <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-200">Одоогийн</span>}
        </span>
      </button>
    );
  };
  return (
    <Sheet title="Баннер сонгох" sub="Профайлын тань дээд талд, зургийн ард." onClose={onClose}>
      {/* The one picked, as the profile will look. */}
      <div className="overflow-hidden rounded-2xl bg-neutral-800/50">
        <ProfileBanner id={pick} className="h-20" />
        <div className="flex items-end gap-3 px-4 pb-3">
          <span className="-mt-8 shrink-0 rounded-full bg-neutral-900 p-1">
            <Avatar name={name} photo={profile.photo} frame={profile.frame} size={60} />
          </span>
          <span className="min-w-0 pb-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{bannerOf(pick)?.name ?? 'Баннергүй'}</span>
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-200">Сонгосон</span>
            </span>
            <span className="block text-sm text-neutral-400">Таны профайл дээр ингэж харагдана</span>
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 rounded-full bg-neutral-800/60 p-1 text-sm font-medium" role="tablist" aria-label="Баннерын төрөл">
        {(
          [
            ['plain', 'Энгийн'],
            ['special', 'Тусгай'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => (setTab(id), setWhy(null))}
            className={`rounded-full py-2 ${tab === id ? 'bg-blue-500 text-white' : 'text-neutral-300 hover:text-neutral-100'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {tab === 'plain' ? [option(null), ...BANNERS.filter((b) => !b.earn).map(option)] : BANNERS.filter((b) => b.earn).map(option)}
      </div>
      {why?.earn && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-neutral-800/60 px-3 py-2 text-sm text-neutral-300">
          <Lock size={15} className="mt-0.5 shrink-0 text-neutral-400" />
          <span>
            «{why.name}» баннер нээгдэх нь: {why.earn.hint}.
          </span>
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-neutral-800 pt-4">
        <button type="button" onClick={onClose} className={secondary}>
          Болих
        </button>
        <button type="button" onClick={save} disabled={busy || pick === now} className={primary}>
          {busy ? 'Хадгалж байна…' : 'Хадгалах'}
        </button>
      </div>
    </Sheet>
  );
}

/** «Миний тухай»: a few words on the public profile. */
function AboutSheet({profile, onClose}: {profile: ProfileData; onClose: () => void}) {
  const [text, setText] = useState(profile.about ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (value: string) => {
    setBusy(true);
    setError('');
    try {
      await saveAbout(profile, value);
      onClose();
    } catch (e) {
      setError(authError(e));
      setBusy(false);
    }
  };
  return (
    <Sheet title="Миний тухай" sub="Профайл дээр тань бусдад харагдана. Багш харж, хэрэгтэй бол арилгана." onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(text);
        }}
      >
        <div className="relative">
          <textarea
            autoFocus
            rows={3}
            className={`${field} resize-none pb-6`}
            value={text}
            maxLength={ABOUT_MAX}
            onChange={(e) => setText(e.target.value)}
            placeholder="Жишээ нь: Геометр хамгийн их таалагддаг. Шатар тоглох дуртай."
            aria-label="Миний тухай"
          />
          <span className="pointer-events-none absolute bottom-2.5 right-3 text-xs tabular-nums text-neutral-500">
            {text.length}/{ABOUT_MAX}
          </span>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          {profile.about ? (
            <button type="button" disabled={busy} onClick={() => save('')} className={secondary}>
              Арилгах
            </button>
          ) : (
            <button type="button" onClick={onClose} className={secondary}>
              Болих
            </button>
          )}
          <button disabled={busy || text.trim() === (profile.about ?? '').trim()} className={primary}>
            {busy ? 'Хадгалж байна…' : 'Хадгалах'}
          </button>
        </div>
      </form>
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
          <input
            autoFocus
            className={`${field} pr-14`}
            value={nickname}
            maxLength={30}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={profile.name}
            aria-label="Nickname"
          />
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
function Secret({
  label,
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="text-sm text-neutral-300">{label}</span>
      <span className="relative mt-1 block">
        <input
          autoFocus={autoFocus}
          className={`${field} pr-11`}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
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
      setError(
        ['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(code) ? 'Одоогийн нууц үг буруу байна.' : authError(err),
      );
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
