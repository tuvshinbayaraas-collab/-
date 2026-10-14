import {LogIn} from 'lucide-react';
import {displayName, signIn, useUser} from '../lib/auth';

/** Placeholder until the new site's content is built. */
export default function Home() {
  const {user, ready} = useUser();
  if (!ready) return null;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      {user ? (
        <>
          <h1 className="text-2xl font-bold">Сайн байна уу, {displayName(user)}!</h1>
          <p className="mt-2 text-neutral-400">Та нэвтэрсэн байна. Сайтын агуулга удахгүй нэмэгдэнэ.</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">Batnab</h1>
          <p className="mt-2 text-neutral-400">Шинэ сайт бэлтгэгдэж байна. Google бүртгэлээрээ нэвтэрч бүртгүүлээрэй.</p>
          <button
            onClick={signIn}
            className="mt-6 flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2.5 font-semibold text-black hover:bg-blue-400"
          >
            <LogIn size={18} /> Google-ээр нэвтрэх
          </button>
        </>
      )}
    </div>
  );
}
