import {ArrowLeft, Menu, Search, Upload} from 'lucide-react';
import {useEffect, useState, type FormEvent} from 'react';
import {Link, navigate} from '../lib/router';
import {storage} from '../lib/storage';
import Avatar from './Avatar';
import Logo from './Logo';

export default function Header({query, onMenu}: {query: string; onMenu: () => void}) {
  const [text, setText] = useState(query);
  const [mobileSearch, setMobileSearch] = useState(false);
  const channel = storage.getChannel();

  useEffect(() => setText(query), [query]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    setMobileSearch(false);
    navigate(`/results?search_query=${encodeURIComponent(q)}`);
  };

  const searchForm = (
    <form onSubmit={submit} className="flex flex-1 max-w-xl items-center">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Хайх"
        aria-label="Хайх"
        autoFocus={mobileSearch}
        className="h-10 w-full min-w-0 rounded-l-full border border-neutral-700 bg-neutral-950 px-4 text-[15px] outline-none focus:border-blue-500"
      />
      <button
        type="submit"
        aria-label="Хайх"
        className="h-10 w-16 shrink-0 rounded-r-full border border-l-0 border-neutral-700 bg-neutral-800 flex items-center justify-center hover:bg-neutral-700"
      >
        <Search size={20} />
      </button>
    </form>
  );

  if (mobileSearch) {
    return (
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-[#0f0f0f] px-2">
        <button onClick={() => setMobileSearch(false)} className="p-2 rounded-full hover:bg-neutral-800" aria-label="Буцах">
          <ArrowLeft size={22} />
        </button>
        {searchForm}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 bg-[#0f0f0f] px-2 sm:px-4">
      <div className="flex items-center gap-2">
        <button onClick={onMenu} className="p-2 rounded-full hover:bg-neutral-800" aria-label="Цэс">
          <Menu size={22} />
        </button>
        <Logo />
      </div>

      <div className="hidden sm:flex flex-1 justify-center">{searchForm}</div>

      <div className="flex items-center gap-1 sm:gap-3">
        <button
          onClick={() => setMobileSearch(true)}
          className="sm:hidden p-2 rounded-full hover:bg-neutral-800"
          aria-label="Хайх"
        >
          <Search size={22} />
        </button>
        <Link
          href="/upload"
          className="flex items-center gap-2 rounded-full bg-neutral-800 px-3 py-2 text-sm font-medium hover:bg-neutral-700"
        >
          <Upload size={18} />
          <span className="hidden md:inline">Бичлэг оруулах</span>
        </Link>
        {channel && (
          <Link href={`/channel/${encodeURIComponent(channel)}`} aria-label="Миний суваг">
            <Avatar name={channel} size={32} />
          </Link>
        )}
      </div>
    </header>
  );
}
