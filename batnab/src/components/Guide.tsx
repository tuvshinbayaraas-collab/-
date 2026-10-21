import {lazy, Suspense, useEffect} from 'react';
import {guideHidden, guideSeen, openGuide, useGuideOpen, type GuideRole} from '../lib/guide';
import {useLocation} from '../lib/router';
import {isStudent, useSession} from '../lib/session';

const GuideDialog = lazy(() => import('./GuideDialog'));

/** Who the guide is for right now (null for an account that can't use the site). */
export function useGuideRole(): GuideRole | null {
  const session = useSession();
  if (!session.ready) return null;
  if (session.admin) return 'teacher';
  if (isStudent(session)) return 'student';
  return session.user ? null : 'guest';
}

/** Opens the welcome guide on the first page of a visit (never in the middle of a test), and shows it when asked. */
export default function GuideHost() {
  const role = useGuideRole();
  const {path} = useLocation();
  const open = useGuideOpen();

  useEffect(() => {
    if (!role) return;
    const start = role === 'teacher' ? path === '/' || path === '/admin' : path === '/' || path === '/login';
    if (start && !guideHidden(role) && !guideSeen(role)) openGuide();
  }, [role, path]);

  if (!open || !role) return null;
  return (
    <Suspense fallback={null}>
      <GuideDialog key={role} role={role} />
    </Suspense>
  );
}
