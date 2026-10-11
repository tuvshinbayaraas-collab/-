import {Clock, Globe, Link2, ListPlus, Lock, Plus, X} from 'lucide-react';
import {useEffect, useState, type FormEvent} from 'react';
import {errorMessage} from '../lib/api';
import {playlists, watchLater, type Playlist} from '../lib/library';
import type {Video, Visibility} from '../lib/types';

const ICON: Record<Visibility, typeof Globe> = {public: Globe, unlisted: Link2, private: Lock};

/** "Save to…" dialog: Watch later plus the viewer's playlists, with inline playlist creation. */
export default function SaveToPlaylist({video, onClose}: {video: Video; onClose: () => void}) {
  const [later, setLater] = useState(false);
  const [lists, setLists] = useState<Playlist[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [error, setError] = useState('');

  useEffect(() => {
    watchLater.has(video.id).then(setLater, () => {});
    playlists.mine().then(setLists, (e) => setError(errorMessage(e)));
  }, [video.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleLater = async () => {
    const on = !later;
    setLater(on);
    try {
      await watchLater.set(video.id, on);
    } catch (e) {
      setLater(!on);
      setError(errorMessage(e));
    }
  };

  const toggle = async (p: Playlist) => {
    const on = !p.items[video.id];
    const apply = (add: boolean) =>
      setLists((ls) =>
        ls!.map((x) => {
          if (x.id !== p.id) return x;
          const items = {...x.items};
          if (add) items[video.id] = Date.now();
          else delete items[video.id];
          return {...x, items};
        }),
      );
    apply(on);
    try {
      await playlists.setItem(p.id, video.id, on);
    } catch (e) {
      apply(!on);
      setError(errorMessage(e));
    }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await playlists.create(title, visibility, video.id);
      setLists(await playlists.mine());
      setCreating(false);
      setTitle('');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-t-2xl bg-neutral-900 sm:rounded-2xl"
        role="dialog"
        aria-label="Хадгалах"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="font-semibold">Хадгалах…</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-neutral-800" aria-label="Хаах">
            <X size={20} />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto px-3 pb-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-neutral-800">
            <input type="checkbox" checked={later} onChange={toggleLater} className="h-4 w-4 accent-blue-500" />
            <Clock size={18} className="text-neutral-300" />
            <span className="flex-1 text-sm">Дараа үзэх</span>
          </label>
          {lists === null ? (
            <p className="px-2 py-2 text-sm text-neutral-400">Ачаалж байна…</p>
          ) : (
            lists.map((p) => {
              const Icon = ICON[p.visibility] ?? Lock;
              return (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-neutral-800">
                  <input type="checkbox" checked={!!p.items[video.id]} onChange={() => toggle(p)} className="h-4 w-4 accent-blue-500" />
                  <ListPlus size={18} className="text-neutral-300" />
                  <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                  <Icon size={14} className="text-neutral-500" />
                </label>
              );
            })
          )}
        </div>
        {error && <p className="px-5 pb-2 text-sm text-red-400">{error}</p>}
        <div className="border-t border-neutral-800 px-5 py-3">
          {creating ? (
            <form onSubmit={create} className="space-y-3">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="Жагсаалтын нэр"
                className="w-full border-b border-neutral-600 bg-transparent pb-1 text-sm outline-none focus:border-white"
              />
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as Visibility)}
                className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm"
                aria-label="Хэн харах вэ"
              >
                <option value="private">Хувийн — зөвхөн та</option>
                <option value="unlisted">Холбоосоор — холбоос авсан хүн</option>
                <option value="public">Нийтийн — хүн бүр</option>
              </select>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreating(false)} className="rounded-full px-4 py-2 text-sm hover:bg-neutral-800">
                  Цуцлах
                </button>
                <button
                  type="submit"
                  disabled={!title.trim()}
                  className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50"
                >
                  Үүсгэх
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setCreating(true)} className="flex items-center gap-3 text-sm font-medium hover:text-white">
              <Plus size={20} /> Шинэ жагсаалт үүсгэх
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
