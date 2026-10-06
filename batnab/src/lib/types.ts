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
  /** Google Drive file id of the video (in the uploader's Drive). */
  driveId: string;
  /** Google Drive file id of the custom/auto-captured thumbnail. */
  thumbDriveId?: string;
  duration: number;
  views: number;
  createdAt: number;
}

export type Reaction = 'like' | 'dislike' | null;
