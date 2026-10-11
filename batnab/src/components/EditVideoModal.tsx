import {ImagePlus, X} from 'lucide-react';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {api, errorMessage} from '../lib/api';
import {driveThumbUrl} from '../lib/drive';
import type {Video, Visibility} from '../lib/types';
import {VisibilityPicker} from './Visibility';

/** Owner's editor for a published video: title, description, thumbnail and who can watch it. */
export default function EditVideoModal({video, onClose, onSaved}: {video: Video; onClose: () => void; onSaved: (v: Video) => void}) {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description ?? '');
  const [visibility, setVisibility] = useState<Visibility>(video.visibility ?? 'public');
  const [thumb, setThumb] = useState<{blob: Blob; url: string} | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => void (thumb && URL.revokeObjectURL(thumb.url)), [thumb]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Гарчиг оруулна уу');
    setBusy(true);
    setError('');
    try {
      const updated = await api.updateVideo(video, {title, description, visibility, thumbnail: thumb?.blob});
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-neutral-900 sm:rounded-2xl"
        aria-label="Бичлэг засах"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
          <h2 className="text-lg font-bold">Бичлэг засах</h2>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full p-2 hover:bg-neutral-800" aria-label="Хаах">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <label className="block rounded-lg border border-neutral-700 px-3 py-2 focus-within:border-white">
            <span className="flex justify-between text-xs text-neutral-400">
              Гарчиг <span>{title.length}/120</span>
            </span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="mt-1 w-full bg-transparent outline-none" />
          </label>
          <label className="block rounded-lg border border-neutral-700 px-3 py-2 focus-within:border-white">
            <span className="flex justify-between text-xs text-neutral-400">
              Тайлбар <span>{description.length}/5000</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={5}
              className="mt-1 w-full resize-y bg-transparent text-sm outline-none"
            />
          </label>
          <div>
            <p className="mb-2 font-semibold">Нүүр зураг</p>
            <div className="flex flex-wrap items-center gap-3">
              <img
                src={thumb?.url ?? driveThumbUrl(video.thumbDriveId ?? video.driveId)}
                alt="Нүүр зураг"
                referrerPolicy="no-referrer"
                className="aspect-video w-40 rounded-lg bg-neutral-800 object-cover"
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex items-center gap-2 rounded-full bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
              >
                <ImagePlus size={18} /> Солих
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f?.type.startsWith('image/')) setThumb({blob: f, url: URL.createObjectURL(f)});
                }}
              />
            </div>
          </div>
          <VisibilityPicker value={visibility} onChange={setVisibility} disabled={busy} />
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-800 px-5 py-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full px-4 py-2 text-sm hover:bg-neutral-800">
            Цуцлах
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
          >
            {busy ? 'Хадгалж байна…' : 'Хадгалах'}
          </button>
        </div>
      </form>
    </div>
  );
}
