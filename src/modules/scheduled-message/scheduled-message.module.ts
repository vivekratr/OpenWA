import { Module, DynamicModule, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduledMessage } from './entities/scheduled-message.entity';
import { ScheduledMessageService } from './scheduled-message.service';
import { ScheduledMessageController } from './scheduled-message.controller';
import { SessionModule } from '../session/session.module';
import { MessageModule } from '../message/message.module';
import { ScheduledMessageProcessor } from '../queue/processors/scheduled-message.processor';

const queueModules: Array<Type | DynamicModule> = [];
if (process.env.QUEUE_ENABLED === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const queueModule = require('../queue/queue.module') as {
    QueueModule: Type;
  };
  queueModules.push(queueModule.QueueModule);
}

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduledMessage], 'data'),
    SessionModule,
    MessageModule,
    ...queueModules,
  ],
  controllers: [ScheduledMessageController],
  providers: [ScheduledMessageService, ScheduledMessageProcessor],
  exports: [ScheduledMessageService],
})
export class ScheduledMessageModule {}