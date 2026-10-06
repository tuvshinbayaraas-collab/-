export interface Comment {
  id: string;
  uid: string;
  author: string;
  photo?: string;
  text: string;
  createdAt: number;
}

export interface Video {
  id: string;
  uid: string;
  title: string;
  description: string;
  channel: string;
  channelPhoto?: string;
  videoUrl: string;
  videoPath: string;
  thumbnailUrl?: string;
  thumbPath?: string;
  duration: number;
  views: number;
  createdAt: number;
}

export type Reaction = 'like' | 'dislike' | null;
