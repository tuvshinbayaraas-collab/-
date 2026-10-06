import {Film, ImagePlus, LogIn, Upload as UploadIcon, X} from 'lucide-react';
import {useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode} from 'react';
import {api, errorMessage} from '../lib/api';
import {displayName, signIn, useUser} from '../lib/auth';
import {formatBytes, formatDuration} from '../lib/format';
import {navigate} from '../lib/router';
import Avatar from '../components/Avatar';

const MAX_MB = 500;
const VIDEO_EXT = /\.(mp4|m4v|webm|mov|mkv|ogv|avi|3gp)$/i;

interface Picked {
  file: File;
  url: string;
  duration: number;
}

// Grab a frame ~1s in (or 10% for short clips) to use as the default thumbnail.
function captureFrame(url: string): Promise<{blob: Blob | null; duration: number}> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'auto';
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    const fail = () => resolve({blob: null, duration: Number.isFinite(v.duration) ? v.duration : 0});
    v.onerror = fail;
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(1, (v.duration || 0) * 0.1);
    };
    v.onseeked = () => {
      try {
        const w = Math.min(v.videoWidth, 1280);
        const h = Math.round((v.videoHeight / v.videoWidth) * w) || 720;
        const canvas = document.createElement('canvas');
        canvas.width = w || 1280;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(v, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve({blob, duration: v.duration}), 'image/jpeg', 0.85);
      } catch {
        fail();
      }
    };
    setTimeout(fail, 15000);
  });
}

export default function Upload() {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [thumb, setThumb] = useState<{blob: Blob; url: string; custom: boolean} | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const {user, ready} = useUser();
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const thumbInput = useRef<HTMLInputElement>(null);

  const pickedUrl = picked?.url;
  const thumbUrl = thumb?.url;
  useEffect(() => () => void (pickedUrl && URL.revokeObjectURL(pickedUrl)), [pickedUrl]);
  useEffect(() => () => void (thumbUrl && URL.revokeObjectURL(thumbUrl)), [thumbUrl]);

  const pickVideo = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('video/') && !VIDEO_EXT.test(file.name)) {
      setError('Зөвхөн бичлэгийн файл сонгоно уу (mp4, webm, mov…)');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Файлын хэмжээ ${MAX_MB}MB-аас ихгүй байх ёстой`);
      return;
    }
    const url = URL.createObjectURL(file);
    setPicked({file, url, duration: 0});
    setTitle((t) => t || file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 120));
    const frame = await captureFrame(url);
    setPicked((p) => (p?.url === url ? {...p, duration: frame.duration} : p));
    if (frame.blob) {
      const blob = frame.blob;
      setThumb((t) => (t?.custom ? t : {blob, url: URL.createObjectURL(blob), custom: false}));
    }
  };

  const pickThumb = (file: File | undefined) => {
    if (!file?.type.startsWith('image/')) return;
    setThumb({blob: file, url: URL.createObjectURL(file), custom: true});
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pickVideo(e.dataTransfer.files[0]);
  };

  const reset = () => {
    setPicked(null);
    setThumb(null);
    setTitle('');
    setDescription('');
    setError('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!picked || progress !== null) return;
    if (!title.trim()) return setError('Гарчиг оруулна уу');
    setError('');
    setProgress(0);
    try {
      const id = await api.upload(
        {file: picked.file, thumbnail: thumb?.blob ?? null, title, description, duration: picked.duration},
        setProgress,
      );
      navigate(`/watch?v=${id}`);
    } catch (err) {
      setError(errorMessage(err));
      setProgress(null);
    }
  };

  if (!ready) return null;

  if (!user) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-neutral-800">
          <UploadIcon size={48} className="text-neutral-400" />
        </div>
        <h1 className="mt-6 text-2xl font-bold">Бичлэг оруулахын тулд нэвтэрнэ үү</h1>
        <p className="mt-2 max-w-md text-neutral-400">Google бүртгэлээрээ нэвтэрч өөрийн сувгаа үүсгээрэй.</p>
        <button
          onClick={signIn}
          className="mt-6 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-neutral-200"
        >
          <LogIn size={18} /> Google-ээр нэвтрэх
        </button>
      </div>
    );
  }

  if (!picked) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold">Бичлэг оруулах</h1>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
            dragging ? 'border-blue-400 bg-blue-500/10' : 'border-neutral-700'
          }`}
        >
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-neutral-800">
            <UploadIcon size={56} className="text-neutral-400" />
          </div>
          <p className="mt-6 text-lg">Бичлэгийн файлаа энд чирж оруулна уу</p>
          <p className="mt-1 text-sm text-neutral-400">
            Таны бичлэг нийтлэгдэх хүртэл бусдад харагдахгүй. MP4, WebM, MOV — {MAX_MB}MB хүртэл.
          </p>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="mt-6 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-neutral-200"
          >
            Файл сонгох
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="video/*,.mkv,.mov,.avi,.3gp"
            hidden
            onChange={(e) => pickVideo(e.target.files?.[0])}
          />
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  const uploading = progress !== null;

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Дэлгэрэнгүй мэдээлэл</h1>
        {!uploading && (
          <button type="button" onClick={reset} className="rounded-full p-2 hover:bg-neutral-800" aria-label="Цуцлах">
            <X size={22} />
          </button>
        )}
      </div>

      <div className="flex flex-col-reverse gap-8 lg:flex-row">
        <div className="flex-1 space-y-5">
          <Field label="Гарчиг (заавал)" count={`${title.length}/120`}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              disabled={uploading}
              placeholder="Бичлэгээ тайлбарлах гарчиг нэмнэ үү"
              className="w-full bg-transparent outline-none"
            />
          </Field>
          <Field label="Тайлбар" count={`${description.length}/5000`}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={6}
              disabled={uploading}
              placeholder="Үзэгчдэдээ бичлэгийнхээ тухай хэлээрэй"
              className="w-full resize-y bg-transparent outline-none"
            />
          </Field>
          <div className="flex items-center gap-3 rounded-lg border border-neutral-800 px-3 py-2.5">
            <Avatar name={displayName(user)} photo={user.photoURL} size={32} />
            <div className="text-sm">
              <p className="text-xs text-neutral-400">Суваг</p>
              <p className="font-medium">{displayName(user)}</p>
            </div>
          </div>

          <div>
            <p className="font-semibold">Нүүр зураг</p>
            <p className="mb-3 text-sm text-neutral-400">
              Бичлэгээс автоматаар зураг авсан. Өөрийн зургийг оруулж болно.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={uploading}
                onClick={() => thumbInput.current?.click()}
                className="flex aspect-video w-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-600 text-xs text-neutral-400 hover:border-neutral-400"
              >
                <ImagePlus size={22} />
                Зураг оруулах
              </button>
              {thumb && <img src={thumb.url} alt="Нүүр зураг" className="aspect-video w-40 rounded-lg object-cover ring-2 ring-white" />}
              <input
                ref={thumbInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => pickThumb(e.target.files?.[0])}
              />
            </div>
          </div>
        </div>

        <div className="w-full shrink-0 lg:w-[360px]">
          <div className="overflow-hidden rounded-xl bg-neutral-800">
            <video src={picked.url} controls className="aspect-video w-full bg-black" />
            <div className="space-y-2 p-4 text-sm">
              <p className="flex items-center gap-2 text-neutral-400">
                <Film size={16} /> Файлын нэр
              </p>
              <p className="break-all">{picked.file.name}</p>
              <p className="text-neutral-400">
                {formatBytes(picked.file.size)}
                {picked.duration > 0 && ` • ${formatDuration(picked.duration)}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-800 bg-[#0f0f0f] py-4">
        <div className="min-w-0 flex-1">
          {uploading ? (
            <div>
              <p className="mb-1 text-sm text-neutral-300">
                {progress < 1 ? `Байршуулж байна… ${Math.round(progress * 100)}%` : 'Боловсруулж байна…'}
              </p>
              <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full bg-red-500 transition-[width]" style={{width: `${progress * 100}%`}} />
              </div>
            </div>
          ) : (
            error && <p className="text-sm text-red-400">{error}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
        >
          Нийтлэх
        </button>
      </div>
    </form>
  );
}

function Field({label, count, children}: {label: string; count?: string; children: ReactNode}) {
  return (
    <label className="block rounded-lg border border-neutral-700 px-3 py-2 focus-within:border-white">
      <span className="flex justify-between text-xs text-neutral-400">
        {label}
        {count && <span>{count}</span>}
      </span>
      <div className="mt-1 text-[15px]">{children}</div>
    </label>
  );
}
