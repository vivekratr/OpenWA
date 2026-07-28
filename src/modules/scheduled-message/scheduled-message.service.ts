import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ScheduledMessage,
  ScheduledMessageStatus,
  ScheduledMessageOptions,
} from './entities/scheduled-message.entity';
import { CreateScheduledMessageDto } from './dto/create-scheduled-message.dto';
import { QUEUE_NAMES } from '../queue/queue-names';
import { SCHEDULED_MESSAGE_JOB_NAME, ScheduledMessageJobData } from './scheduled-message-job.types';
import { normalizeRecipients } from './utils/recipient.util';
import { SessionService } from '../session/session.service';

@Injectable()
export class ScheduledMessageService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledMessageService.name);
  private readonly queueEnabled: boolean;

  constructor(
    @InjectRepository(ScheduledMessage, 'data')
    private readonly scheduledMessageRepository: Repository<ScheduledMessage>,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    @Optional()
    @InjectQueue(QUEUE_NAMES.MESSAGE)
    private readonly messageQueue?: Queue<ScheduledMessageJobData>,
  ) {
    this.queueEnabled = configService.get<boolean>('queue.enabled', false);
  }

  async onModuleInit(): Promise<void> {
    if (!this.queueEnabled || !this.messageQueue) {
      return;
    }

    const recoverable = await this.scheduledMessageRepository.find({
      where: {
        status: In([ScheduledMessageStatus.PENDING, ScheduledMessageStatus.QUEUED]),
      },
    });

    for (const scheduled of recoverable) {
      try {
        await this.enqueueScheduledMessage(scheduled);
        this.logger.log(`Recovered scheduled message ${scheduled.id} for session ${scheduled.sessionId}`);
      } catch (error) {
        this.logger.error(
          `Failed to recover scheduled message ${scheduled.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  async create(sessionId: string, dto: CreateScheduledMessageDto): Promise<ScheduledMessage> {
    if (!this.queueEnabled || !this.messageQueue) {
      throw new ServiceUnavailableException(
        'Message scheduling requires QUEUE_ENABLED=true and a running Redis instance',
      );
    }

    const session = await this.sessionService.findOne(sessionId);
    if (!session) {
      throw new NotFoundException(`Session '${sessionId}' not found`);
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt date');
    }

    const minLeadMs = 30_000;
    if (scheduledAt.getTime() < Date.now() + minLeadMs) {
      throw new BadRequestException('scheduledAt must be at least 30 seconds in the future');
    }

    const recipients = normalizeRecipients(dto.recipients);

    const options: ScheduledMessageOptions = {
      delayBetweenMessages: dto.options?.delayBetweenMessages ?? 3000,
      randomizeDelay: dto.options?.randomizeDelay ?? true,
      stopOnError: dto.options?.stopOnError ?? false,
    };

    const scheduled = this.scheduledMessageRepository.create({
      sessionId,
      scheduledAt,
      status: ScheduledMessageStatus.PENDING,
      messageType: dto.messageType,
      content: dto.content,
      recipients,
      options,
      batchId: null,
      bullJobId: null,
      errorMessage: null,
      completedAt: null,
    });

    await this.scheduledMessageRepository.save(scheduled);
    await this.enqueueScheduledMessage(scheduled);

    return scheduled;
  }

  async findBySession(
    sessionId: string,
    options?: { status?: ScheduledMessageStatus; limit?: number; offset?: number },
  ): Promise<{ data: ScheduledMessage[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const [data, total] = await this.scheduledMessageRepository.findAndCount({
      where: {
        sessionId,
        ...(options?.status ? { status: options.status } : {}),
      },
      order: { scheduledAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data, total };
  }

  async findOne(sessionId: string, id: string): Promise<ScheduledMessage> {
    const scheduled = await this.scheduledMessageRepository.findOne({
      where: { id, sessionId },
    });

    if (!scheduled) {
      throw new NotFoundException(`Scheduled message '${id}' not found`);
    }

    return scheduled;
  }

  async cancel(sessionId: string, id: string): Promise<ScheduledMessage> {
    const scheduled = await this.findOne(sessionId, id);

    if (
      scheduled.status !== ScheduledMessageStatus.PENDING &&
      scheduled.status !== ScheduledMessageStatus.QUEUED
    ) {
      throw new BadRequestException(`Scheduled message is already ${scheduled.status} and cannot be cancelled`);
    }

    if (this.messageQueue && scheduled.bullJobId) {
      try {
        const job = await this.messageQueue.getJob(scheduled.bullJobId);
        if (job) {
          await job.remove();
        }
      } catch (error) {
        this.logger.warn(
          `Could not remove Bull job ${scheduled.bullJobId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    scheduled.status = ScheduledMessageStatus.CANCELLED;
    scheduled.completedAt = new Date();
    await this.scheduledMessageRepository.save(scheduled);

    return scheduled;
  }

  private async enqueueScheduledMessage(scheduled: ScheduledMessage): Promise<void> {
    if (!this.messageQueue) {
      throw new ServiceUnavailableException('Message queue is not available');
    }

    const delay = Math.max(0, scheduled.scheduledAt.getTime() - Date.now());
    const jobId = `scheduled-${scheduled.id}`;

    try {
      const existingJob = await this.messageQueue.getJob(jobId);
      if (existingJob) {
        await existingJob.remove();
      }
    } catch {
      // ignore stale job lookup errors
    }

    const job = await this.messageQueue.add(
      SCHEDULED_MESSAGE_JOB_NAME,
      {
        scheduledMessageId: scheduled.id,
        sessionId: scheduled.sessionId,
      },
      {
        delay,
        jobId,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 1,
      },
    );

    scheduled.bullJobId = job.id ?? jobId;
    scheduled.status = ScheduledMessageStatus.QUEUED;
    await this.scheduledMessageRepository.save(scheduled);
  }
}
