import type { Timestamp } from 'firebase/firestore';

export type WhatsAppMessageType =
  | 'image'
  | 'text'
  | 'audio'
  | 'document'
  | 'unknown';

export type WhatsAppProcessingStatus =
  | 'received'
  | 'processing'
  | 'processed'
  | 'ignored'
  | 'failed';

export interface WhatsAppMessageRecord {
  id: string;
  messageId: string; // Unique Meta WhatsApp message ID
  senderNumber: string; // E.164 normalized
  messageType: WhatsAppMessageType;
  mediaId?: string;
  receivedAt: Timestamp;
  processed: boolean;
  processingStatus: WhatsAppProcessingStatus;
  attendanceSessionId?: string;
  createdAt: Timestamp;
}
