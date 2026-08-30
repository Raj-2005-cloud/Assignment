export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface Sender {
  id: string;
  email: string;
  displayName: string;
  etherealUser: string;
  createdAt: string;
}

export type EmailStatus =
  | 'SCHEDULED'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'RATE_LIMITED';

export interface EmailJob {
  id: string;
  userId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: EmailStatus;
  bullJobId: string | null;
  idempotencyKey: string;
  errorMessage: string | null;
  etherealPreviewUrl: string | null;
  batchId: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: {
    email: string;
    displayName: string;
  };
}

export interface PaginatedResponse<T> {
  emails: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ScheduleEmailRequest {
  subject: string;
  body: string;
  senderId: string;
  scheduledAt: string;
  recipients?: string[];
  delayBetweenMs?: number;
  maxPerHour?: number;
}

export interface SearchResult {
  results: EmailJob[];
  total: number;
}

export interface SlackStatus {
  connected: boolean;
  teamName: string | null;
}

export interface ScheduleResponse {
  message: string;
  batchId: string;
  totalScheduled: number;
  jobs: {
    id: string;
    recipientEmail: string;
    scheduledAt: string;
    status: string;
    skipped: boolean;
  }[];
}
