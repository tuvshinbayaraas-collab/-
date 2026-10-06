export interface Comment {
  id: string;
  uid: string;
  author: string;
  photo?: string;
  text: string;
  createdAt: number;
  editedAt?: number;
  /** Set on replies: the top-level comment this answers (one level deep, like YouTube). */
  parentId?: string;
  /** The video's creator gave this comment a heart. */
  hearted?: boolean;
}

export interface CommentThread {
  comments: Comment[];
  /** commentId -> uids who liked it */
  likes: Record<string, string[]>;
  pinnedId?: string;
}

export interface Video {
  id: string;
  uid: string;
  title: string;
  description: string;
  channel: string;
  channelPhoto?: string;
  /** Google Drive file id of the video (in the uploader's Drive). */
  driveId: string;
  /** Google Drive file id of the custom/auto-captured thumbnail. */
  thumbDriveId?: string;
  duration: number;
  /** Vertical clip shown in the Shorts feed. */
  short?: boolean;
  pinnedComment?: string;
  views: number;
  createdAt: number;
}

export type Reaction = 'like' | 'dislike' | null;

export interface Subscription {
  uid: string;
  name: string;
  photo?: string;
  at: number;
}

export interface VideoStats {
  video: Video;
  likes: number;
  dislikes: number;
  comments: number;
  /** Views per local day, keyed YYYYMMDD. */
  daily: Record<string, number>;
}
