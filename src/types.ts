export type Format = 'mp4' | 'mp3';
export type Quality = 'best' | '1080p' | '720p' | 'audio-high' | 'audio-medium';
export type TaskStatus = 'idle' | 'queued' | 'fetching' | 'downloading' | 'processing' | 'done' | 'error';

export interface DownloadTask {
  id: string;
  url: string;
  title: string;
  format: Format;
  quality: Quality;
  progress: number;
  status: TaskStatus;
  createdAt: number;
  errorMessage?: string;
  previewUrl?: string; // Simulated file preview URL
  fileSizeBytes?: number; // Simulated downloaded file size
}
