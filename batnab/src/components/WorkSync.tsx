import {useEffect} from 'react';
import {useAssignments} from '../lib/classroom';
import {setMyWork, useMyWork, type Work} from '../lib/lead';
import {useMyResults} from '../lib/results';
import {isStudent, useSession} from '../lib/session';
import {useNow} from '../lib/time';
import {useProgress, useTopics} from '../lib/topics';
import {assignmentFor, assignmentState} from './Today';

const DAY = 86_400_000;

/**
 * How far a student is with each of their class's assignments (lib/lead: started / done), kept for the class leaders
 * from whatever page they are on, so one who did it from a link straight to the topic or test isn't on the leader's
 * «not started» list. Once everything it depends on is here; nothing on screen.
 */
export default function WorkSync() {
  const session = useSession();
  const uid = isStudent(session) ? session.user!.uid : undefined;
  const cls = uid ? session.profile?.class : undefined;
  return uid && cls ? <Marks uid={uid} cls={cls} /> : null;
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
