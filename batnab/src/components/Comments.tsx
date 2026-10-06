import {ChevronDown, ChevronUp, Heart, MoreVertical, Pencil, Pin, PinOff, ThumbsUp, Trash2} from 'lucide-react';
import {useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {api, errorMessage} from '../lib/api';
import {displayName, signIn, useUser} from '../lib/auth';
import {formatViews, timeAgo} from '../lib/format';
import type {Comment, Video} from '../lib/types';
import Avatar from './Avatar';

type Sort = 'top' | 'new';

/** YouTube-style handle: the display name without spaces, so @mentions stay one token. */
const handle = (name: string) => `@${name.replace(/\s+/g, '')}`;

export default function Comments({video, onCount}: {video: Video; onCount?: (n: number) => void}) {
  const {user} = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState<Record<string, string[]>>({});
  const [pinnedId, setPinnedId] = useState<string | undefined>(video.pinnedComment);
  const [sort, setSort] = useState<Sort>('top');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    api.comments(video.id).then(
      (t) => {
        if (!alive) return;
        setComments(t.comments);
        setLikes(t.likes);
        setPinnedId(t.pinnedId);
        setLoaded(true);
      },
      () => alive && setLoaded(true),
    );
    return () => {
      alive = false;
    };
  }, [video.id]);

  useEffect(() => onCount?.(comments.length), [comments.length, onCount]);

  const isCreator = user?.uid === video.uid;
  const replies = useMemo(() => {
    const map: Record<string, Comment[]> = {};
    for (const c of comments) if (c.parentId) (map[c.parentId] ??= []).push(c);
    for (const list of Object.values(map)) list.sort((a, b) => a.createdAt - b.createdAt);
    return map;
  }, [comments]);

  const topLevel = useMemo(() => {
    const score = (c: Comment) => (likes[c.id]?.length ?? 0) * 2 + (replies[c.id]?.length ?? 0) + (c.hearted ? 3 : 0);
    const list = comments.filter((c) => !c.parentId && c.id !== pinnedId);
    list.sort((a, b) => (sort === 'top' ? score(b) - score(a) || b.createdAt - a.createdAt : b.createdAt - a.createdAt));
    const pinned = comments.find((c) => c.id === pinnedId && !c.parentId);
    return pinned ? [pinned, ...list] : list;
  }, [comments, likes, replies, pinnedId, sort]);

  // ----- mutations shared by every comment row -----
  const actions: Actions = {
    add: async (text, parentId) => {
      const c = await api.comment(video.id, text, parentId);
      setComments((list) => [...list, c]);
    },
    edit: async (c, text) => {
      const editedAt = await api.editComment(video.id, c.id, text);
      setComments((list) => list.map((x) => (x.id === c.id ? {...x, text: text.trim(), editedAt} : x)));
    },
    remove: async (c) => {
      const replyIds = (replies[c.id] ?? []).map((r) => r.id);
      const msg = replyIds.length ? `Сэтгэгдэл болон ${replyIds.length} хариултыг устгах уу?` : 'Сэтгэгдлийг устгах уу?';
      if (!confirm(msg)) return;
      try {
        await api.deleteComment(video.id, c.id, replyIds);
        const gone = new Set([c.id, ...replyIds]);
        setComments((list) => list.filter((x) => !gone.has(x.id)));
        if (pinnedId === c.id) setPinnedId(undefined);
      } catch (e) {
        alert(errorMessage(e));
      }
    },
    like: async (c) => {
      if (!user) return signIn();
      const on = !(likes[c.id] ?? []).includes(user.uid);
      const apply = (add: boolean) =>
        setLikes((l) => ({...l, [c.id]: add ? [...(l[c.id] ?? []), user.uid] : (l[c.id] ?? []).filter((u) => u !== user.uid)}));
      apply(on);
      try {
        await api.likeComment(video.id, c.id, on);
      } catch (e) {
        apply(!on);
        alert(errorMessage(e));
      }
    },
    heart: async (c) => {
      const on = !c.hearted;
      const apply = (v: boolean) => setComments((list) => list.map((x) => (x.id === c.id ? {...x, hearted: v || undefined} : x)));
      apply(on);
      try {
        await api.heartComment(video.id, c.id, on);
      } catch (e) {
        apply(!on);
        alert(errorMessage(e));
      }
    },
    pin: async (c) => {
      const next = pinnedId === c.id ? null : c.id;
      const prev = pinnedId;
      setPinnedId(next ?? undefined);
      try {
        await api.pinComment(video.id, next);
      } catch (e) {
        setPinnedId(prev);
        alert(errorMessage(e));
      }
    },
  };

  return (
    <section className="mt-6">
      <div className="flex items-center gap-6">
        <h2 className="text-lg font-bold">{comments.length} сэтгэгдэл</h2>
        <SortMenu sort={sort} onChange={setSort} />
      </div>

      <div className="mt-4">
        {user ? (
          <Composer
            placeholder="Сэтгэгдэл бичих…"
            submitLabel="Сэтгэгдэл үлдээх"
            avatar={<Avatar name={displayName(user)} photo={user.photoURL} size={40} />}
            onSubmit={(text) => actions.add(text)}
          />
        ) : (
          <p className="text-sm text-neutral-400">
            <button onClick={signIn} className="font-semibold text-blue-400 hover:underline">
              Нэвтэрч
            </button>{' '}
            сэтгэгдэл үлдээнэ үү.
          </p>
        )}
      </div>

      {!loaded ? (
        <p className="mt-6 text-sm text-neutral-400">Сэтгэгдэл ачаалж байна…</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {topLevel.map((c) => (
            <CommentThreadItem
              key={c.id}
              comment={c}
              replies={replies[c.id] ?? []}
              video={video}
              likes={likes}
              pinned={c.id === pinnedId}
              isCreator={isCreator}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface Actions {
  add: (text: string, parentId?: string) => Promise<void>;
  edit: (c: Comment, text: string) => Promise<void>;
  remove: (c: Comment) => Promise<void>;
  like: (c: Comment) => Promise<void>;
  heart: (c: Comment) => Promise<void>;
  pin: (c: Comment) => Promise<void>;
}

interface ItemProps {
  video: Video;
  likes: Record<string, string[]>;
  isCreator: boolean;
  actions: Actions;
}

function CommentThreadItem({comment, replies, pinned, ...rest}: ItemProps & {comment: Comment; replies: Comment[]; pinned: boolean}) {
  const {user} = useUser();
  const [showReplies, setShowReplies] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [lastPosted, setLastPosted] = useState(0);

  const openReply = (target: Comment) => {
    if (!user) return signIn();
    setReplyTo(target);
  };

  const replyComposer = replyTo && user && (
    <div className="mt-3">
      <Composer
        key={`${replyTo.id}-${lastPosted}`}
        autoFocus
        small
        initial={replyTo.id !== comment.id ? `${handle(replyTo.author)} ` : ''}
        placeholder="Хариулт бичих…"
        submitLabel="Хариулах"
        avatar={<Avatar name={displayName(user)} photo={user.photoURL} size={24} />}
        onCancel={() => setReplyTo(null)}
        onSubmit={async (text) => {
          await rest.actions.add(text, comment.id);
          setReplyTo(null);
          setShowReplies(true);
          setLastPosted(Date.now());
        }}
      />
    </div>
  );

  return (
    <li>
      <CommentRow comment={comment} pinned={pinned} onReply={() => openReply(comment)} {...rest} />
      <div className="ml-[52px]">
        {replyTo?.id === comment.id && replyComposer}
        {replies.length > 0 && (
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="mt-2 flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-blue-400 hover:bg-blue-500/10"
          >
            {showReplies ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            {replies.length} хариулт
          </button>
        )}
        {showReplies && (
          <ul className="mt-2 space-y-4">
            {replies.map((r) => (
              <li key={r.id}>
                <CommentRow comment={r} small onReply={() => openReply(r)} {...rest} />
                {replyTo?.id === r.id && <div className="ml-9">{replyComposer}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function CommentRow({
  comment: c,
  video,
  likes,
  isCreator,
  actions,
  pinned = false,
  small = false,
  onReply,
}: ItemProps & {comment: Comment; pinned?: boolean; small?: boolean; onReply: () => void}) {
  const {user} = useUser();
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const liked = !!user && (likes[c.id] ?? []).includes(user.uid);
  const likeCount = likes[c.id]?.length ?? 0;
  const byCreator = c.uid === video.uid;
  const mine = user?.uid === c.uid;
  const canDelete = mine || isCreator;

  return (
    <div className="group flex gap-3">
      <Avatar name={c.author} photo={c.photo} size={small ? 24 : 40} />
      <div className="min-w-0 flex-1">
        {pinned && (
          <p className="mb-1 flex items-center gap-1 text-xs text-neutral-400">
            <Pin size={12} /> {video.channel} тогтоосон
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
          {byCreator ? (
            <span className="rounded-full bg-neutral-700 px-2 py-0.5 font-semibold" title="Сувгийн эзэн">
              {handle(c.author)}
            </span>
          ) : (
            <span className="font-semibold">{handle(c.author)}</span>
          )}
          <span className="text-neutral-400">
            {timeAgo(c.createdAt)}
            {c.editedAt ? ' (засварласан)' : ''}
          </span>
        </p>

        {editing ? (
          <div className="mt-2">
            <Composer
              autoFocus
              small
              initial={c.text}
              placeholder="Сэтгэгдэл засах…"
              submitLabel="Хадгалах"
              onCancel={() => setEditing(false)}
              onSubmit={async (text) => {
                await actions.edit(c, text);
                setEditing(false);
              }}
            />
          </div>
        ) : (
          <CommentText text={c.text} />
        )}

        {!editing && (
          <div className="mt-1 flex items-center gap-1 text-xs">
            <button
              onClick={() => actions.like(c)}
              aria-pressed={liked}
              className="flex items-center gap-1.5 rounded-full p-2 hover:bg-neutral-800"
              title="Таалагдлаа"
            >
              <ThumbsUp size={16} fill={liked ? 'currentColor' : 'none'} />
            </button>
            {likeCount > 0 && <span className="-ml-1 mr-1 text-neutral-400">{formatViews(likeCount)}</span>}
            {isCreator ? (
              <button
                onClick={() => actions.heart(c)}
                aria-pressed={!!c.hearted}
                className="rounded-full p-2 hover:bg-neutral-800"
                title={c.hearted ? 'Зүрх авах' : 'Зүрх өгөх'}
              >
                <Heart size={16} className={c.hearted ? 'text-red-500' : ''} fill={c.hearted ? 'currentColor' : 'none'} />
              </button>
            ) : (
              c.hearted && (
                <span className="relative mx-1.5" title={`${video.channel}-д таалагдсан`}>
                  <Avatar name={video.channel} photo={video.channelPhoto} size={18} />
                  <Heart size={10} className="absolute -bottom-1 -right-1 text-red-500" fill="currentColor" />
                </span>
              )
            )}
            <button onClick={onReply} className="rounded-full px-3 py-1.5 font-semibold hover:bg-neutral-800">
              Хариулах
            </button>
          </div>
        )}
      </div>

      {(canDelete || (isCreator && !c.parentId)) && !editing && (
        <div className="relative self-start">
          <button
            onClick={() => setMenu(!menu)}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
            aria-label="Сэтгэгдлийн цэс"
          >
            <MoreVertical size={18} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-9 z-50 w-48 overflow-hidden rounded-xl bg-neutral-800 py-2 text-sm shadow-xl">
                {isCreator && !c.parentId && (
                  <MenuItem
                    icon={pinned ? <PinOff size={18} /> : <Pin size={18} />}
                    label={pinned ? 'Тогтоохыг болих' : 'Дээр тогтоох'}
                    onClick={() => {
                      setMenu(false);
                      actions.pin(c);
                    }}
                  />
                )}
                {mine && (
                  <MenuItem
                    icon={<Pencil size={18} />}
                    label="Засах"
                    onClick={() => {
                      setMenu(false);
                      setEditing(true);
                    }}
                  />
                )}
                {canDelete && (
                  <MenuItem
                    icon={<Trash2 size={18} />}
                    label="Устгах"
                    onClick={() => {
                      setMenu(false);
                      actions.remove(c);
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({icon, label, onClick}: {icon: ReactNode; label: string; onClick: () => void}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-neutral-700">
      {icon}
      {label}
    </button>
  );
}

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/** Text with clickable links, @mentions highlighted, and "Цааш унших" for long comments. */
function CommentText({text}: {text: string}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  const parts = text.split(URL_RE).map((part, i) => {
    if (i % 2 === 1)
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-400 hover:underline">
          {part}
        </a>
      );
    return part.split(/(^|\s)(@[^\s@]+)/g).map((p, j) =>
      p.startsWith('@') ? (
        <span key={`${i}-${j}`} className="text-blue-400">
          {p}
        </span>
      ) : (
        p
      ),
    );
  });

  return (
    <div className="mt-0.5">
      <p ref={ref} className={`whitespace-pre-wrap break-words text-sm ${open ? '' : 'line-clamp-4'}`}>
        {parts}
      </p>
      {(clamped || open) && (
        <button onClick={() => setOpen(!open)} className="mt-1 text-sm font-semibold text-neutral-300 hover:text-white">
          {open ? 'Хураах' : 'Цааш унших'}
        </button>
      )}
    </div>
  );
}

const EMOJI = ['😀', '😂', '😍', '🔥', '👍', '👏', '🙏', '❤️', '😢', '😮', '🎉', '💯'];

function Composer({
  avatar,
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  initial = '',
  autoFocus = false,
  small = false,
}: {
  avatar?: ReactNode;
  placeholder: string;
  submitLabel: string;
  onSubmit: (text: string) => Promise<void>;
  onCancel?: () => void;
  initial?: string;
  autoFocus?: boolean;
  small?: boolean;
}) {
  const [text, setText] = useState(initial);
  const [focused, setFocused] = useState(autoFocus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [emoji, setEmoji] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    if (autoFocus) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [autoFocus]);

  // Grow with the content.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(text);
      setText('');
      setFocused(false);
      setEmoji(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setText(initial);
    setFocused(false);
    setEmoji(false);
    onCancel?.();
  };

  const insert = (e: string) => {
    const el = area.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + e + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + e.length, start + e.length);
    });
  };

  const changed = text.trim() && text.trim() !== initial.trim();

  return (
    <form onSubmit={submit} className="flex gap-3">
      {avatar}
      <div className="flex-1">
        <textarea
          ref={area}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
            if (e.key === 'Escape') cancel();
          }}
          placeholder={placeholder}
          rows={1}
          maxLength={2000}
          className={`w-full resize-none overflow-hidden border-b border-neutral-700 bg-transparent pb-1 outline-none focus:border-white ${
            small ? 'text-sm' : 'text-sm'
          }`}
        />
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
        {(focused || text) && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setEmoji(!emoji)}
                className="rounded-full p-1.5 text-lg leading-none hover:bg-neutral-800"
                aria-label="Эможи"
              >
                🙂
              </button>
              {emoji && (
                <div className="absolute left-0 top-10 z-30 grid w-56 grid-cols-6 gap-1 rounded-xl bg-neutral-800 p-2 shadow-xl">
                  {EMOJI.map((e) => (
                    <button key={e} type="button" onClick={() => insert(e)} className="rounded-lg p-1 text-xl hover:bg-neutral-700">
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-neutral-500 sm:inline">{text.length}/2000</span>
              <button type="button" onClick={cancel} className="rounded-full px-4 py-2 text-sm hover:bg-neutral-800">
                Цуцлах
              </button>
              <button
                type="submit"
                disabled={!changed || busy}
                className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:bg-neutral-800 disabled:text-neutral-500"
              >
                {submitLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}

function SortMenu({sort, onChange}: {sort: Sort; onChange: (s: Sort) => void}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm font-semibold">
        <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M3 6h18M6 12h12M10 18h4" strokeLinecap="round" />
        </svg>
        Эрэмбэлэх
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-8 z-50 w-44 overflow-hidden rounded-xl bg-neutral-800 py-2 text-sm shadow-xl">
            {(
              [
                ['top', 'Шилдэг сэтгэгдэл'],
                ['new', 'Хамгийн шинэ'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className={`block w-full px-4 py-2.5 text-left hover:bg-neutral-700 ${sort === key ? 'bg-neutral-700' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
