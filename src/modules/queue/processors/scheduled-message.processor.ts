import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createLogger } from '../../../common/services/logger.service';
import { QUEUE_NAMES } from '../queue-names';
import {
  ScheduledMessage,
  ScheduledMessageStatus,
} from '../../scheduled-message/entities/scheduled-message.entity';
import {
  SCHEDULED_MESSAGE_JOB_NAME,
  ScheduledMessageJobData,
} from '../../scheduled-message/scheduled-message-job.types';
import { BulkMessageService } from '../../message/bulk-message.service';
import { BatchStatus } from '../../message/entities/message-batch.entity';
import { chunkArray } from '../../scheduled-message/utils/recipient.util';
import { SendBulkMessageDto } from '../../message/dto/bulk-message.dto';
import { SessionService } from '../../session/session.service';

const BULK_CHUNK_SIZE = 100;
const BATCH_POLL_INTERVAL_MS = 2000;
const BATCH_TIMEOUT_MS = 3600000;

@Processor(QUEUE_NAMES.MESSAGE)
export class ScheduledMessageProcessor extends WorkerHost {
  private readonly logger = createLogger('ScheduledMessageProcessor');

  constructor(
    @InjectRepository(ScheduledMessage, 'data')
    private readonly scheduledMessageRepository: Repository<ScheduledMessage>,
    private readonly bulkMessageService: BulkMessageService,
    private readonly sessionService: SessionService,
  ) {
    super();
  }

  async process(job: Job<ScheduledMessageJobData>): Promise<void> {
    if (job.name !== SCHEDULED_MESSAGE_JOB_NAME) {
      return;
    }

    const { scheduledMessageId, sessionId } = job.data;
    const scheduled = await this.scheduledMessageRepository.findOne({
      where: { id: scheduledMessageId, sessionId },
    });

    if (!scheduled) {
      this.logger.warn(`Scheduled message ${scheduledMessageId} not found`);
      return;
    }

    if (scheduled.status === ScheduledMessageStatus.CANCELLED) {
      this.logger.log(`Scheduled message ${scheduledMessageId} was cancelled, skipping`);
      return;
    }

    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      await this.markFailed(scheduled, 'Session not ready');
      return;
    }

    scheduled.status = ScheduledMessageStatus.SENDING;
    await this.scheduledMessageRepository.save(scheduled);

    try {
      const chatIds = scheduled.recipients;
      const chunks = chunkArray(chatIds, BULK_CHUNK_SIZE);
      let firstBatchId: string | null = null;

      for (const chunk of chunks) {
        const dto: SendBulkMessageDto = {
          messages: chunk.map(chatId => ({
            chatId,
            type: scheduled.messageType,
            content: scheduled.content,
          })),
          options: scheduled.options ?? undefined,
        };

        const batch = await this.bulkMessageService.createBatch(sessionId, dto);
        if (!firstBatchId) {
          firstBatchId = batch.batchId;
        }

        const completedBatch = await this.waitForBatch(sessionId, batch.batchId);
        if (completedBatch.status === BatchStatus.FAILED) {
          throw new Error(`Bulk batch ${batch.batchId} failed`);
        }
        if (completedBatch.status === BatchStatus.CANCELLED) {
          throw new Error(`Bulk batch ${batch.batchId} was cancelled`);
        }
      }

      scheduled.status = ScheduledMessageStatus.COMPLETED;
      scheduled.batchId = firstBatchId;
      scheduled.completedAt = new Date();
      scheduled.errorMessage = null;
      await this.scheduledMessageRepository.save(scheduled);

      this.logger.log(`Scheduled message ${scheduledMessageId} completed`, {
        sessionId,
        batchId: firstBatchId,
        recipientCount: chatIds.length,
        action: 'scheduled_message_completed',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.markFailed(scheduled, message);
    }
  }

  private async markFailed(scheduled: ScheduledMessage, errorMessage: string): Promise<void> {
    scheduled.status = ScheduledMessageStatus.FAILED;
    scheduled.errorMessage = errorMessage;
    scheduled.completedAt = new Date();
    await this.scheduledMessageRepository.save(scheduled);
    this.logger.error(`Scheduled message ${scheduled.id} failed: ${errorMessage}`);
  }

  private async waitForBatch(sessionId: string, batchId: string): Promise<{ status: BatchStatus }> {
    const start = Date.now();

    while (Date.now() - start < BATCH_TIMEOUT_MS) {
      const batch = await this.bulkMessageService.getBatchStatus(sessionId, batchId);
      if (
        batch.status === BatchStatus.COMPLETED ||
        batch.status === BatchStatus.FAILED ||
        batch.status === BatchStatus.CANCELLED
      ) {
        return batch;
      }
      await this.sleep(BATCH_POLL_INTERVAL_MS);
    }

    throw new Error(`Batch ${batchId} timed out after ${BATCH_TIMEOUT_MS}ms`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
