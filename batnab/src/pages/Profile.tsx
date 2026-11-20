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
  Palette,
  Lock,
  Medal as MedalIcon,
  MessageSquareText,
  Sparkles,
  UserRound,
  WandSparkles,
} from 'lucide-react';
import {useState, type CSSProperties, type FormEvent, type ReactNode} from 'react';
import Avatar from '../components/Avatar';
import {ORNAMENTED} from '../components/FrameOrnament';
import {LooksName, TitleChip} from '../components/Looks';
import ProfileBanner, {BANNER_SHAPE} from '../components/ProfileBanner';
import {ProfileCard, ProfileEffect, themeVars} from '../components/ProfileCard';
import {BadgeGrid, useBadgeFacts, useEarned} from '../components/Badges';
import {InactiveNote, LockedNote} from '../components/Notices';
import PhotoPicker from '../components/PhotoPicker';
import {ProgressChart, useWeeks} from '../components/Progress';
import Sheet from '../components/Sheet';
import {saveBanner, saveFrame, saveLooks, saveNickname, savePhoto, saveStyle} from '../lib/accounts';
import {ACCENTS, MOODS, titleOf} from '../lib/looks';
import {EFFECTS, effectOf, isOpenTo, THEMES, themeOf, type Effect, type Theme} from '../lib/themes';
import {BADGES} from '../lib/stats';
import {BANNERS, bannerOf, type Banner} from '../lib/banners';
import {FRAMES, frameOf, isOpen, type Frame} from '../lib/frames';
import {useClasses} from '../lib/classes';
import {useKeys} from '../lib/keys';
import {publicName, refreshMine, useMedals} from '../lib/leaderboard';
import {ABOUT_MAX, saveAbout, syncMine} from '../lib/people';
import {useMyResults} from '../lib/results';
import {Link} from '../lib/router';
import {authError, changePassword, shownName, useSession, type Profile as ProfileData} from '../lib/session';
import {useSettings} from '../lib/settings';
import Loading from '../components/Loading';
import MedalBadge from '../components/MedalBadge';

const field = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500';
const card = 'rounded-2xl bg-neutral-900';
const primary = 'rounded-full bg-blue-500 py-2.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50';
const secondary = 'rounded-full bg-neutral-800 py-2.5 text-sm font-semibold hover:bg-neutral-700';

type Status = {ok: boolean; text: string} | null;
type Open = 'nickname' | 'password' | 'frame' | 'banner' | 'looks' | 'style' | 'about' | null;

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
      <Identity profile={profile} onOpen={setOpen} meter={!session.admin} />
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
            icon={<Palette size={18} />}
            label="Нэрийн өнгө, тэмдэг, цол"
            value={
              [ACCENTS.find((x) => x.id === profile.accent)?.name, MOODS.find((x) => x.id === profile.mood)?.emoji, titleOf(profile.title)?.name].filter(Boolean).join(' · ') || (
                <span className="text-neutral-500">Сонгоогүй</span>
              )
            }
            onClick={() => setOpen('looks')}
          />
        )}
        {!session.admin && (
          <Row
            icon={<WandSparkles size={18} />}
            label="Профайлын өнгө, эффект"
            value={[themeOf(profile.theme)?.name, effectOf(profile.effect)?.name].filter(Boolean).join(' · ') || <span className="text-neutral-500">Сонгоогүй</span>}
            onClick={() => setOpen('style')}
          />
        )}
        {!session.admin && (
          <Row
            icon={<MessageSquareText size={18} />}
            label="Миний тухай"
            value={profile.about?.trim() || <span className="text-neutral-500">Бичээгүй байна</span>}
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
              {profile.prefs?.profileHidden ? 'Профайлаа нуусан байна' : 'Ангийнхан Сурагчид хэсгээс таныг олж харна'}
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
      {open === 'looks' && <LooksSheet uid={session.user.uid} profile={profile} onClose={() => setOpen(null)} />}
      {open === 'style' && <StyleSheet uid={session.user.uid} profile={profile} onClose={() => setOpen(null)} />}
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
          -д долоо хоногийн эхний 3-т орж авсан медаль, одон энд гарна.
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

/**
 * The profile card as others see it, laid out like Discord's: the banner whole across the top, the picture over its lower
 * edge on the left, the name under it, «Миний тухай» in a panel; in the student's colours, their effect over it. Tap the
 * picture to change it.
 */
function Identity({profile, onOpen, meter}: {profile: ProfileData; onOpen: (o: Open) => void; meter: boolean}) {
  const [picking, setPicking] = useState(false);
  const myClass = useClasses()?.find((c) => c.id === profile.class)?.name;
  const [status, setStatus] = useState<Status>(null);
  const name = shownName(profile);
  // Without a connection the change is kept on the device and sent once it's back; the sheet doesn't wait for that.
  const save = async (photo: string | null) => {
    const write = savePhoto(photo).then(() => refreshMine({...profile, photo: photo ?? undefined}).catch(() => {}));
    const sent = await Promise.race([write.then(() => true), new Promise<false>((r) => setTimeout(() => r(false), 6000))]);
    setStatus({ok: true, text: sent ? (photo ? 'Зураг солигдлоо.' : 'Зураг арилгалаа.') : 'Интернэт орж ирэхэд хадгалагдана.'});
    write.catch((e) => setStatus({ok: false, text: authError(e)}));
  };
  const pick = () => {
    setStatus(null);
    setPicking(true);
  };
  const about = profile.about?.trim();
  const pill = 'on-card flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium hover:brightness-125';

  return (
    <ProfileCard
      theme={profile.theme}
      effect={profile.effect}
      className="rounded-2xl"
      banner={
        <ProfileBanner id={profile.banner} seed={publicName(profile)} className={BANNER_SHAPE}>
          <button
            type="button"
            onClick={() => onOpen('banner')}
            className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/60"
          >
            <ImageIcon size={14} /> Баннер
          </button>
        </ProfileBanner>
      }
    >
      <div className="relative px-4 pb-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <button onClick={pick} aria-label="Зураг солих" className="profile-ring relative -mt-14 shrink-0 rounded-full p-1.5 sm:-mt-16">
            <Avatar name={name} photo={profile.photo} frame={profile.frame} size={104} />
            {/* Not over a special frame's ornament («Зураг солих» is beside it). */}
            {!ORNAMENTED.has(profile.frame ?? '') && (
              <span className="profile-ring absolute -right-1.5 bottom-0.5 rounded-full p-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-black">
                  <Camera size={16} />
                </span>
              </span>
            )}
          </button>
          <div className="flex flex-wrap justify-end gap-2 pt-3">
            <button type="button" onClick={pick} className={pill}>
              <Camera size={15} /> Зураг солих
            </button>
            {meter && (
              <button type="button" onClick={() => onOpen('style')} className={pill}>
                <WandSparkles size={15} /> Өнгө, эффект
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 break-words text-2xl font-bold">
          <LooksName name={name} accent={profile.accent} mood={profile.mood} />
        </p>
        <p className="text-sm text-neutral-400">
          @{profile.username}
          {myClass && ` · ${myClass}`}
        </p>
        <TitleChip id={profile.title} className="mt-2" />
        {profile.nickname?.trim() && <p className="mt-1 text-sm text-neutral-500">Жинхэнэ нэр: {profile.name}</p>}
        {about && (
          <div className="on-card mt-3 rounded-xl px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Миний тухай</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px]">{about}</p>
          </div>
        )}
        {status && (
          <p className={`mt-3 flex items-center gap-1 text-sm ${status.ok ? 'text-green-400' : 'text-red-400'}`}>
            {status.ok && <Check size={16} />} {status.text}
          </p>
        )}
        {meter && <Completeness profile={profile} onPhoto={pick} onOpen={onOpen} />}
        {picking && <PhotoPicker name={name} photo={profile.photo} frame={profile.frame} onSave={save} onClose={() => setPicking(false)} />}
      </div>
    </ProfileCard>
  );
}

/**
 * How much of the profile is filled in (picture, frame, banner, «Миний тухай», nickname): a bar, and a tap on what is
 * missing opens it. Gone once all five are there.
 */
function Completeness({profile, onPhoto, onOpen}: {profile: ProfileData; onPhoto: () => void; onOpen: (o: Open) => void}) {
  const parts: [string, boolean, () => void][] = [
    ['Зураг', !!profile.photo, onPhoto],
    ['Хүрээ', !!frameOf(profile.frame), () => onOpen('frame')],
    ['Баннер', !!bannerOf(profile.banner), () => onOpen('banner')],
    ['Миний тухай', !!profile.about?.trim(), () => onOpen('about')],
    ['Nickname', !!profile.nickname?.trim(), () => onOpen('nickname')],
  ];
  const done = parts.filter(([, ok]) => ok).length;
  if (done === parts.length) return null;
  return (
    <div className="on-card mt-4 w-full rounded-xl p-3 text-left" data-profile-meter>
      <p className="flex items-center gap-2 text-sm font-medium">
        <span className="shrink-0">
          Профайл {done}/{parts.length}
        </span>
        <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-700" aria-hidden>
          <span className="block h-full rounded-full bg-blue-500" style={{width: `${(done / parts.length) * 100}%`}} />
        </span>
      </p>
      <p className="mt-0.5 text-xs text-neutral-400">Дутуу байгаа хэсгүүд:</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {parts
          .filter(([, ok]) => !ok)
          .map(([label, , open]) => (
            <button key={label} type="button" onClick={open} className="rounded-full border border-blue-500/40 px-2.5 py-1 text-xs font-medium text-blue-200 hover:bg-blue-500/10">
              + {label}
            </button>
          ))}
      </div>
    </div>
  );
}

/**
 * «Хүрээ сонгох»: the frame picked shows big at the top (and small, as in a list, at the bottom); the plain ones and
 * the special ones on two tabs. A special one not earned yet shows with a lock beside its name; a tap on it says how to
 * earn it.
 */
function FrameSheet({uid, profile, onClose}: {uid: string; profile: ProfileData; onClose: () => void}) {
  const earned = useEarned(uid);
  const now = frameOf(profile.frame)?.id ?? null;
  const [pick, setPick] = useState<string | null>(now);
  const [tab, setTab] = useState<'plain' | 'special'>(frameOf(now)?.earn ? 'special' : 'plain');
  const [why, setWhy] = useState<Frame | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = shownName(profile);
  const got = earned?.open ?? new Set<string>();
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
    <Sheet title="Хүрээ сонгох" sub="Зургийн эргэн тойронд гарах чимэглэл." onClose={onClose}>
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
  const earned = useEarned(uid);
  const now = bannerOf(profile.banner)?.id ?? null;
  const [pick, setPick] = useState<string | null>(now);
  const [tab, setTab] = useState<'plain' | 'special'>(bannerOf(now)?.earn ? 'special' : 'plain');
  const [why, setWhy] = useState<Banner | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = shownName(profile);
  const got = earned?.open ?? new Set<string>();
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
        <ProfileBanner id={id} className={`${BANNER_SHAPE} rounded-xl`} />
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
    <Sheet title="Баннер сонгох" sub="Профайлын дээд талд, зургийн ард гарна." onClose={onClose}>
      {/* The one picked, as the profile will look. */}
      <ProfileCard as="div" theme={profile.theme} className="rounded-2xl" banner={<ProfileBanner id={pick} seed={publicName(profile)} className={BANNER_SHAPE} />}>
        <div className="relative flex items-end gap-3 px-4 pb-3">
          <span className="profile-ring relative -mt-8 shrink-0 rounded-full p-1">
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
      </ProfileCard>

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

/**
 * «Профайлын өнгө, эффект», as Discord's profile themes and effects: the card in two colours (top and bottom) and bits
 * drifting over it, with the profile as it will look at the top. The special ones open with a badge (a lock beside
 * their name; a tap says how).
 */
function StyleSheet({uid, profile, onClose}: {uid: string; profile: ProfileData; onClose: () => void}) {
  const earned = useEarned(uid);
  const [theme, setTheme] = useState<string | null>(themeOf(profile.theme)?.id ?? null);
  const [effect, setEffect] = useState<string | null>(effectOf(profile.effect)?.id ?? null);
  const [why, setWhy] = useState<Theme | Effect | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = shownName(profile);
  const got = earned?.open ?? new Set<string>();
  const same = theme === (themeOf(profile.theme)?.id ?? null) && effect === (effectOf(profile.effect)?.id ?? null);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await saveStyle({theme, effect});
      await syncMine({...profile, theme: theme ?? undefined, effect: effect ?? undefined}).catch(() => {});
      onClose();
    } catch (e) {
      setError(/permission/i.test((e as Error).message) ? 'Энэ нь танд хараахан нээгдээгүй байна.' : authError(e));
      setBusy(false);
    }
  };
  const head = 'mt-4 text-xs font-semibold uppercase tracking-wider text-neutral-500';
  const tick = (
    <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-black">
      <Check size={12} strokeWidth={3} />
    </span>
  );
  const tile = (on: boolean) =>
    `relative flex flex-col gap-1 rounded-xl border p-1 pb-1.5 text-left text-xs font-medium ${on ? 'border-blue-400 bg-blue-500/10' : 'border-transparent hover:bg-neutral-800/60'}`;
  const label = (text: string, shut: boolean) => (
    <span className="flex items-center gap-1 px-0.5">
      <span className="truncate">{text}</span>
      {shut && <Lock size={11} className="shrink-0 text-neutral-400" />}
    </span>
  );
  // The tiles of the effects show them on the colours picked.
  const ground = theme ? 'profile-theme' : 'bg-neutral-800';
  return (
    <Sheet title="Профайлын өнгө, эффект" sub="Профайлын картаа хоёр өнгөөр будаж, эффект нэмж болно." onClose={onClose}>
      {/* The profile as it will look. */}
      <div data-style-preview>
        <ProfileCard as="div" theme={theme} effect={effect} className="rounded-2xl" banner={<ProfileBanner id={profile.banner} seed={publicName(profile)} className={BANNER_SHAPE} />}>
          <div className="relative px-4 pb-4">
            <span className="profile-ring relative -mt-9 inline-block rounded-full p-1">
              <Avatar name={name} photo={profile.photo} frame={profile.frame} size={64} />
            </span>
            <p className="mt-1 break-words text-lg font-bold">
              <LooksName name={name} accent={profile.accent} mood={profile.mood} />
            </p>
            <p className="text-sm text-neutral-400">@{profile.username}</p>
            <div className="on-card mt-2 rounded-xl px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Миний тухай</p>
              <p className="mt-0.5 truncate text-sm">{profile.about?.trim() || 'Энд таны тухай бичвэр гарна.'}</p>
            </div>
          </div>
        </ProfileCard>
      </div>

      <p className={head}>Профайлын өнгө</p>
      <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6" role="group" aria-label="Профайлын өнгө">
        <button type="button" onClick={() => (setTheme(null), setWhy(null))} aria-pressed={!theme} aria-label="Энгийн өнгө" className={tile(!theme)}>
          <span className="block h-11 rounded-lg border border-neutral-700 bg-neutral-900" />
          {label('Энгийн', false)}
          {!theme && tick}
        </button>
        {THEMES.map((t) => {
          const shut = !isOpenTo(t, got);
          const on = theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => (shut ? setWhy(t) : (setTheme(t.id), setWhy(null)))}
              aria-pressed={on}
              aria-label={`${t.name}${shut ? ' (түгжээтэй)' : ''}`}
              className={tile(on)}
            >
              <span className="profile-theme block h-11 rounded-lg" style={themeVars(t.id)} />
              {label(t.name, shut)}
              {on && tick}
            </button>
          );
        })}
      </div>

      <p className={head}>Эффект</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-5" role="group" aria-label="Эффект">
        <button type="button" onClick={() => (setEffect(null), setWhy(null))} aria-pressed={!effect} aria-label="Эффектгүй" className={tile(!effect)}>
          <span className={`${ground} block h-14 rounded-lg`} style={themeVars(theme)} />
          {label('Эффектгүй', false)}
          {!effect && tick}
        </button>
        {EFFECTS.map((e) => {
          const shut = !isOpenTo(e, got);
          const on = effect === e.id;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => (shut ? setWhy(e) : (setEffect(e.id), setWhy(null)))}
              aria-pressed={on}
              aria-label={`${e.name}${shut ? ' (түгжээтэй)' : ''}`}
              className={tile(on)}
            >
              <span className={`${ground} relative block h-14 overflow-hidden rounded-lg`} style={themeVars(theme)}>
                <ProfileEffect id={e.id} count={8} />
              </span>
              {label(e.name, shut)}
              {on && tick}
            </button>
          );
        })}
      </div>
      {why?.earn && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-neutral-800/60 px-3 py-2 text-sm text-neutral-300">
          <Lock size={15} className="mt-0.5 shrink-0 text-neutral-400" />
          <span>
            «{why.name}» нээгдэх нь: {why.earn.hint}.
          </span>
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-neutral-800 pt-4">
        <button type="button" onClick={onClose} className={secondary}>
          Болих
        </button>
        <button type="button" onClick={save} disabled={busy || same} className={primary}>
          {busy ? 'Хадгалж байна…' : 'Хадгалах'}
        </button>
      </div>
    </Sheet>
  );
}

/** The colour of the name, a sign beside it and a title under it (a badge earned): each picked from what is there. */
function LooksSheet({uid, profile, onClose}: {uid: string; profile: ProfileData; onClose: () => void}) {
  const earned = useEarned(uid);
  const [accent, setAccent] = useState<string | null>(profile.accent ?? null);
  const [mood, setMood] = useState<string | null>(profile.mood ?? null);
  const [title, setTitle] = useState<string | null>(profile.title ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = shownName(profile);
  const titles = BADGES.filter((b) => earned?.all.includes(b.id));
  const same = accent === (profile.accent ?? null) && mood === (profile.mood ?? null) && title === (profile.title ?? null);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await saveLooks({accent, mood, title});
      await syncMine({...profile, accent: accent ?? undefined, mood: mood ?? undefined, title: title ?? undefined}).catch(() => {});
      onClose();
    } catch (e) {
      setError(authError(e));
      setBusy(false);
    }
  };
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm ${on ? 'border-blue-400 bg-blue-500/15 text-neutral-50' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'}`;
  const head = 'mt-4 text-xs font-semibold uppercase tracking-wider text-neutral-500';
  return (
    <Sheet title="Нэрийн өнгө, тэмдэг, цол" sub="Профайл дээр нэр ингэж харагдана." onClose={onClose}>
      <div className="flex flex-col items-center rounded-2xl bg-neutral-800/50 px-4 py-4 text-center" data-looks-preview>
        <Avatar name={name} photo={profile.photo} frame={profile.frame} size={64} />
        <p className="mt-2 max-w-full break-words text-xl font-bold">
          <LooksName name={name} accent={accent} mood={mood} />
        </p>
        <TitleChip id={title} className="mt-1" />
      </div>
      <p className={head}>Нэрийн өнгө</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Нэрийн өнгө">
        <button type="button" onClick={() => setAccent(null)} aria-pressed={!accent} className={chip(!accent)}>
          Энгийн
        </button>
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAccent(a.id)}
            aria-pressed={accent === a.id}
            aria-label={a.name}
            title={a.name}
            className={`accent-swatch h-9 w-9 rounded-full ${accent === a.id ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-neutral-900' : ''}`}
            style={{'--accent': a.color, '--accent-light': a.light} as CSSProperties}
          />
        ))}
      </div>
      <p className={head}>Тэмдэг</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Тэмдэг">
        <button type="button" onClick={() => setMood(null)} aria-pressed={!mood} className={chip(!mood)}>
          Тэмдэггүй
        </button>
        {MOODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMood(m.id)}
            aria-pressed={mood === m.id}
            aria-label={`Тэмдэг ${m.emoji}`}
            className={`h-9 w-9 rounded-full text-lg ${mood === m.id ? 'bg-blue-500/20 ring-2 ring-blue-400' : 'bg-neutral-800 hover:bg-neutral-700'}`}
          >
            {m.emoji}
          </button>
        ))}
      </div>
      <p className={head}>Цол</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Цол">
        <button type="button" onClick={() => setTitle(null)} aria-pressed={!title} className={chip(!title)}>
          Цолгүй
        </button>
        {titles.map((b) => (
          <button key={b.id} type="button" onClick={() => setTitle(b.id)} aria-pressed={title === b.id} className={chip(title === b.id)}>
            {b.icon} {b.name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        {titles.length ? 'Амжилт авах бүрд шинэ цол нээгдэнэ.' : 'Цол амжилтаар нээгдэнэ. Эхний тестээ өгөхөд «Анхны алхам» цол нээгдэнэ.'}
      </p>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-neutral-800 pt-4">
        <button type="button" onClick={onClose} className={secondary}>
          Болих
        </button>
        <button type="button" onClick={save} disabled={busy || same} className={primary}>
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
    <Sheet title="Миний тухай" sub="Бусад сурагчид профайл дээрээс уншина. Зохисгүй зүйлийг багш арилгана." onClose={onClose}>
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
    <Sheet title="Nickname" sub="Бусад сурагчид энэ нэрийг харна. Багш жинхэнэ нэрийг тань бас харна." onClose={onClose}>
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
