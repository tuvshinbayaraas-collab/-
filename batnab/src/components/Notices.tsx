import {Lock, LogIn, UserX} from 'lucide-react';
import type {ReactNode} from 'react';
import {logOut} from '../lib/session';
import {Link} from '../lib/router';

export function CenterNote({icon, title, children}: {icon?: ReactNode; title: string; children?: ReactNode}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      {icon && <div className="mb-3 text-neutral-500">{icon}</div>}
      <h1 className="text-xl font-semibold">{title}</h1>
      {children && <div className="mt-2 text-neutral-400">{children}</div>}
    </div>
  );
}

export const loginHref = (next = location.pathname + location.search) => `/login?next=${encodeURIComponent(next)}`;

export function LoginButton({next, label = 'Нэвтрэх'}: {next?: string; label?: string}) {
  return (
    <Link href={loginHref(next)} className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 font-semibold text-black hover:bg-blue-400">
      <LogIn size={18} /> {label}
    </Link>
  );
}

/** For guests on a page that needs an account. */
export function LockedNote({title = 'Нэвтэрнэ үү', text, trial}: {title?: string; text?: string; trial?: string}) {
  return (
    <CenterNote icon={<Lock size={36} />} title={title}>
      <p>{text ?? 'Бүртгэлийг багш үүсгэж өгнө. Нэвтрэх нэр, нууц үгээ багшаасаа аваарай.'}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <LoginButton />
        {trial && (
          <Link href={`/test/${trial}`} className="rounded-full border border-neutral-700 px-5 py-2 font-medium text-blue-400 hover:bg-blue-500/10">
            Туршилтаар өгөх
          </Link>
        )}
      </div>
    </CenterNote>
  );
}

/** Signed in, but the teacher hasn't made (or has blocked) this account's profile. */
export function InactiveNote({blocked}: {blocked?: boolean}) {
  return (
    <CenterNote icon={<UserX size={36} />} title={blocked ? 'Таны бүртгэл түр хаагдсан байна' : 'Бүртгэл идэвхгүй байна'}>
      <p>Багшдаа хандана уу.</p>
      <button onClick={logOut} className="mt-5 rounded-full border border-neutral-700 px-5 py-2 text-sm font-medium hover:bg-neutral-800">
        Гарах
      </button>
    </CenterNote>
  );
}
