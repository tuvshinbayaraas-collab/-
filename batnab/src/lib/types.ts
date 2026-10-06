export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: number;
}

export interface Video {
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
  commentCount: number;
  comments?: Comment[];
}
