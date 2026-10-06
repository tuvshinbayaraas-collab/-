import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import express, {type NextFunction, type Request, type Response} from 'express';
import multer from 'multer';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.BATNAB_DATA_DIR ?? path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT ?? 3000);
const MAX_VIDEO_MB = Number(process.env.MAX_VIDEO_MB ?? 500);
const isProd = process.env.NODE_ENV === 'production';

interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: number;
}

interface Video {
  id: string;
  title: string;
  description: string;
  channel: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: number;
  views: number;
  likes: number;
  dislikes: number;
  createdAt: number;
  comments: Comment[];
  // Secret handed to the uploader once; required to delete the video.
  ownerToken?: string;
}

// ---------- Storage ----------

fs.mkdirSync(UPLOAD_DIR, {recursive: true});

function loadDb(): Video[] {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Video[];
  } catch {
    return [];
  }
}

function saveDb(videos: Video[]) {
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(videos, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const videos = loadDb();
const persist = () => saveDb(videos);

function publicVideo(v: Video, withComments = false) {
  const {ownerToken: _token, comments, ...rest} = v;
  return withComments ? {...rest, comments, commentCount: comments.length} : {...rest, commentCount: comments.length};
}

function findVideo(req: Request, res: Response): Video | undefined {
  const video = videos.find((v) => v.id === req.params.id);
  if (!video) res.status(404).json({error: 'Бичлэг олдсонгүй'});
  return video;
}

const clampText = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

// ---------- Uploads ----------

const VIDEO_EXTS = new Set(['.mp4', '.m4v', '.webm', '.mov', '.mkv', '.ogv', '.avi', '.3gp']);

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8);
      cb(null, `${crypto.randomBytes(12).toString('hex')}${ext}`);
    },
  }),
  limits: {fileSize: MAX_VIDEO_MB * 1024 * 1024, files: 2},
  fileFilter: (_req, file, cb) => {
    // Some browsers/OSes send no MIME type (or octet-stream) for formats like .mkv, so fall back to the extension.
    const ext = path.extname(file.originalname).toLowerCase();
    const ok =
      (file.fieldname === 'video' && (file.mimetype.startsWith('video/') || VIDEO_EXTS.has(ext))) ||
      (file.fieldname === 'thumbnail' && file.mimetype.startsWith('image/'));
    if (ok) cb(null, true);
    else cb(new Error('Зөвхөн бичлэг (video) болон зураг (image) файл оруулна уу'));
  },
});

const removeUpload = (url: string | null) => {
  if (url?.startsWith('/uploads/')) {
    fs.rm(path.join(UPLOAD_DIR, path.basename(url)), {force: true}, () => {});
  }
};

// ---------- API ----------

const app = express();
app.use(express.json({limit: '100kb'}));
app.use('/uploads', express.static(UPLOAD_DIR, {maxAge: '7d'}));

app.get('/api/videos', (req, res) => {
  const q = clampText(req.query.q, 100).toLowerCase();
  const channel = clampText(req.query.channel, 100);
  let list = [...videos].sort((a, b) => b.createdAt - a.createdAt);
  if (channel) list = list.filter((v) => v.channel === channel);
  if (q) {
    const words = q.split(/\s+/);
    list = list.filter((v) => {
      const hay = `${v.title} ${v.description} ${v.channel}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  res.json(list.map((v) => publicVideo(v)));
});

app.get('/api/videos/:id', (req, res) => {
  const video = findVideo(req, res);
  if (video) res.json(publicVideo(video, true));
});

app.post(
  '/api/videos',
  upload.fields([
    {name: 'video', maxCount: 1},
    {name: 'thumbnail', maxCount: 1},
  ]),
  (req, res) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const videoFile = files?.video?.[0];
    const thumbFile = files?.thumbnail?.[0];
    const title = clampText(req.body.title, 120);
    const channel = clampText(req.body.channel, 50);

    if (!videoFile || !title || !channel) {
      if (videoFile) removeUpload(`/uploads/${videoFile.filename}`);
      if (thumbFile) removeUpload(`/uploads/${thumbFile.filename}`);
      res.status(400).json({error: 'Бичлэг, гарчиг, сувгийн нэр заавал шаардлагатай'});
      return;
    }

    const video: Video = {
      id: crypto.randomBytes(6).toString('base64url'),
      title,
      description: clampText(req.body.description, 5000),
      channel,
      videoUrl: `/uploads/${videoFile.filename}`,
      thumbnailUrl: thumbFile ? `/uploads/${thumbFile.filename}` : null,
      duration: Math.max(0, Math.round(Number(req.body.duration) || 0)),
      views: 0,
      likes: 0,
      dislikes: 0,
      createdAt: Date.now(),
      comments: [],
      ownerToken: crypto.randomBytes(24).toString('hex'),
    };
    videos.push(video);
    persist();
    res.status(201).json({...publicVideo(video), ownerToken: video.ownerToken});
  },
);

app.delete('/api/videos/:id', (req, res) => {
  const video = findVideo(req, res);
  if (!video) return;
  const token = req.get('x-owner-token');
  if (!video.ownerToken || !token || token !== video.ownerToken) {
    res.status(403).json({error: 'Энэ бичлэгийг устгах эрхгүй байна'});
    return;
  }
  videos.splice(videos.indexOf(video), 1);
  persist();
  removeUpload(video.videoUrl);
  removeUpload(video.thumbnailUrl);
  res.status(204).end();
});

app.post('/api/videos/:id/view', (req, res) => {
  const video = findVideo(req, res);
  if (!video) return;
  video.views += 1;
  persist();
  res.json({views: video.views});
});

// Body: {likes: -1|0|1, dislikes: -1|0|1} — deltas computed by the client from its saved reaction.
app.post('/api/videos/:id/react', (req, res) => {
  const video = findVideo(req, res);
  if (!video) return;
  const delta = (n: unknown) => Math.max(-1, Math.min(1, Math.trunc(Number(n) || 0)));
  video.likes = Math.max(0, video.likes + delta(req.body?.likes));
  video.dislikes = Math.max(0, video.dislikes + delta(req.body?.dislikes));
  persist();
  res.json({likes: video.likes, dislikes: video.dislikes});
});

app.post('/api/videos/:id/comments', (req, res) => {
  const video = findVideo(req, res);
  if (!video) return;
  const text = clampText(req.body?.text, 2000);
  if (!text) {
    res.status(400).json({error: 'Сэтгэгдэл хоосон байна'});
    return;
  }
  const comment: Comment = {
    id: crypto.randomBytes(6).toString('base64url'),
    author: clampText(req.body?.author, 50) || 'Зочин',
    text,
    createdAt: Date.now(),
  };
  video.comments.unshift(comment);
  persist();
  res.status(201).json(comment);
});

app.use('/api', (_req, res) => {
  res.status(404).json({error: 'Олдсонгүй'});
});

app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? `Файлын хэмжээ ${MAX_VIDEO_MB}MB-аас хэтэрсэн байна` : err.message;
    res.status(413).json({error: message});
    return;
  }
  res.status(400).json({error: err.message || 'Алдаа гарлаа'});
});

// ---------- Frontend ----------

if (isProd) {
  const dist = path.join(ROOT, 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const {createServer} = await import('vite');
  const vite = await createServer({root: ROOT, server: {middlewareMode: true}, appType: 'spa'});
  app.use(vite.middlewares);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Batnab ажиллаж байна: http://localhost:${PORT}`);
});
