import {ref, serverTimestamp, set, update} from 'firebase/database';
import {useEffect, useState} from 'react';
import {useAssignments} from '../lib/classroom';
import {openKeys} from '../lib/cosmetics';
import {db} from '../lib/firebase';
import {setMyWork, useMyWork, type Work} from '../lib/lead';
import {pubOf} from '../lib/leaderboard';
import {useLive} from '../lib/live';
import {entryOf, fieldsOf, syncMine, usePerson} from '../lib/people';
import {useMyResults} from '../lib/results';
import {isStudent, useSession, type Profile} from '../lib/session';
import {useLocation} from '../lib/router';
import {useNow} from '../lib/time';
import {useProgress, useTopics} from '../lib/topics';
import {useEarned} from './Badges';
import {assignmentFor, assignmentState} from './Today';

const DAY = 86_400_000;

/**
 * Kept from whatever page a student is on (nothing on screen): how far they are with each of their class's assignments
 * (lib/lead: started / done), so one who did it from a link straight to the topic or test isn't on the leader's
 * «not started» list; their own directory entry and picture for others (lib/people); the badges they have earned, and
 * the frames and banners those open.
 */
export default function WorkSync() {
  const session = useSession();
  const uid = isStudent(session) ? session.user!.uid : undefined;
  const cls = uid ? session.profile?.class : undefined;
  // The badges wait a moment after the page is up, and stay out of a test, an exam or a live quiz.
  const {path} = useLocation();
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 3000);
    return () => clearTimeout(t);
  }, []);
  const busy = /^\/(test|live|print)(\/|$)/.test(path);
  return uid ? (
    <>
      {cls && <Marks uid={uid} cls={cls} />}
      <Mine uid={uid} profile={session.profile!} />
      {late && !busy && <Earned uid={uid} profile={session.profile!} />}
    </>
  ) : null;
}

/**
 * The badges the student has earned, published on their profile (lib/people); and each special frame or banner that
 * has just opened to them noted with the time (lib/cosmetics), for the bell to say so.
 */
function Earned({uid, profile}: {uid: string; profile: Profile}) {
  const earned = useEarned(uid);
  const person = usePerson(uid);
  const sig = earned ? earned.all.join(',') : null;
  const published = person === null ? null : (person?.badges.join(',') ?? '');
  const hidden = !!profile.prefs?.profileHidden;
  useEffect(() => {
    if (sig === null || published === null || hidden || published === sig) return;
    syncMine(profile, sig ? sig.split(',') : []).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, published, hidden]);
  const noted = profile.prefs?.unlocked ?? {};
  const fresh = earned
    ? openKeys(earned.open, !!profile.lead)
        .filter((k) => !noted[k])
        .join(',')
    : '';
  useEffect(() => {
    if (!fresh) return;
    update(ref(db, `users/${uid}/prefs/unlocked`), Object.fromEntries(fresh.split(',').map((k) => [k, serverTimestamp()]))).catch(() => {});
  }, [fresh, uid]);
  return null;
}

/**
 * The student's own directory entry and picture for others (lib/people), kept as their profile is (the teacher's page
 * does it for everyone too, but only when it is opened).
 */
function Mine({uid, profile}: {uid: string; profile: Profile}) {
  const person = usePerson(uid);
  const pic = useLive(`pub/${uid}`, (v) => (v ?? {}) as {photo?: string; frame?: string});
  const hidden = !!profile.prefs?.profileHidden;
  const want = hidden ? null : entryOf(profile);
  const entry = want && JSON.stringify(want);
  const have = person === null ? null : person ? JSON.stringify(fieldsOf(person)) : '';
  useEffect(() => {
    if (have === null || (entry ?? '') === have) return;
    syncMine(profile).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, have]);
  // Their picture: while the profile is open (the podium's, for one hiding it, is the leaderboard's to keep).
  const wantPic = hidden ? undefined : pubOf(profile.photo, profile.frame);
  const picSig = JSON.stringify(wantPic ?? null);
  const havePic = pic === null ? null : JSON.stringify(pic.photo || pic.frame ? {...(pic.photo ? {photo: pic.photo} : {}), ...(pic.frame ? {frame: pic.frame} : {})} : null);
  useEffect(() => {
    if (wantPic === undefined || havePic === null || havePic === picSig) return;
    set(ref(db, `pub/${uid}`), wantPic).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picSig, havePic, uid]);
  return null;
}

function Marks({uid, cls}: {uid: string; cls: string}) {
  const now = useNow(60_000);
  const assignments = useAssignments();
  const topics = useTopics();
  const progress = useProgress(uid);
  const results = useMyResults();
  if (!assignments || !topics || !progress || !results) return null;
  return (
    <>
      {assignments
        .filter((a) => a.due > now - 3 * DAY && assignmentFor(a, topics, cls))
        .map((a) => {
          const s = assignmentState(a, topics, progress, results);
          return <Mark key={a.id} cls={cls} aid={a.id} uid={uid} want={s.done ? 'done' : s.count > 0 ? 'started' : null} />;
        })}
    </>
  );
}

/** Keeps the student's own «started / done» of one assignment as it is. */
function Mark({cls, aid, uid, want}: {cls: string; aid: string; uid: string; want: Work | null}) {
  const have = useMyWork(cls, aid, uid);
  useEffect(() => {
    if (have === null || have === (want ?? '')) return;
    setMyWork(cls, aid, want).catch(() => {});
  }, [cls, aid, have, want]);
  return null;
}
