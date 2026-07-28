import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { DateTransformer } from '../../../common/transformers/date.transformer';
import { jsonColumnType, dateColumnType } from '../../../common/utils/column-types';

export enum ScheduledMessageStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SENDING = 'sending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export type ScheduledMessageType = 'text' | 'image' | 'video' | 'audio' | 'document';

export interface ScheduledMessageContent {
  text?: string;
  caption?: string;
  image?: { url?: string; base64?: string; mimetype?: string };
  video?: { url?: string; base64?: string; mimetype?: string };
  audio?: { url?: string; base64?: string; mimetype?: string };
  document?: { url?: string; base64?: string; mimetype?: string; filename?: string };
}

export interface ScheduledMessageOptions {
  delayBetweenMessages: number;
  randomizeDelay: boolean;
  stopOnError: boolean;
}

@Entity('scheduled_messages')
export class ScheduledMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'varchar' })
  sessionId: string;

  @Column({ name: 'scheduled_at', type: dateColumnType(), transformer: DateTransformer })
  scheduledAt: Date;

  @Column({ type: 'varchar', default: ScheduledMessageStatus.PENDING })
  status: ScheduledMessageStatus;

  @Column({ name: 'message_type', type: 'varchar' })
  messageType: ScheduledMessageType;

  @Column({ type: jsonColumnType() })
  content: ScheduledMessageContent;

  @Column({ type: jsonColumnType() })
  recipients: string[];

  @Column({ type: jsonColumnType(), nullable: true })
  options: ScheduledMessageOptions | null;

  @Column({ name: 'batch_id', type: 'varchar', nullable: true })
  batchId: string | null;

  @Column({ name: 'bull_job_id', type: 'varchar', nullable: true })
  bullJobId: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  completedAt: Date | null;
}
