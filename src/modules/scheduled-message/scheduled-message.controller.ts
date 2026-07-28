import { Controller, Post, Get, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ScheduledMessageService } from './scheduled-message.service';
import { CreateScheduledMessageDto } from './dto/create-scheduled-message.dto';
import { ScheduledMessageStatus } from './entities/scheduled-message.entity';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';

@ApiTags('scheduled-messages')
@Controller('sessions/:sessionId/scheduled-messages')
export class ScheduledMessageController {
  constructor(private readonly scheduledMessageService: ScheduledMessageService) {}

  @Post()
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a broadcast message to multiple recipients' })
  @ApiParam({ name: 'sessionId', description: 'Session ID (personal WhatsApp number)' })
  @ApiResponse({ status: 201, description: 'Message scheduled' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 503, description: 'Queue not enabled' })
  async create(@Param('sessionId') sessionId: string, @Body() dto: CreateScheduledMessageDto) {
    const scheduled = await this.scheduledMessageService.create(sessionId, dto);
    return {
      id: scheduled.id,
      sessionId: scheduled.sessionId,
      scheduledAt: scheduled.scheduledAt,
      status: scheduled.status,
      messageType: scheduled.messageType,
      recipientCount: scheduled.recipients.length,
      batchId: scheduled.batchId,
      createdAt: scheduled.createdAt,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List scheduled messages for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiQuery({ name: 'status', required: false, enum: ScheduledMessageStatus })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async list(
    @Param('sessionId') sessionId: string,
    @Query('status') status?: ScheduledMessageStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.scheduledMessageService.findBySession(sessionId, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return {
      data: result.data.map(item => ({
        id: item.id,
        sessionId: item.sessionId,
        scheduledAt: item.scheduledAt,
        status: item.status,
        messageType: item.messageType,
        recipientCount: item.recipients.length,
        recipients: item.recipients,
        content: item.content,
        batchId: item.batchId,
        errorMessage: item.errorMessage,
        createdAt: item.createdAt,
        completedAt: item.completedAt,
      })),
      total: result.total,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get scheduled message details' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'id', description: 'Scheduled message ID' })
  async getOne(@Param('sessionId') sessionId: string, @Param('id') id: string) {
    const scheduled = await this.scheduledMessageService.findOne(sessionId, id);
    return {
      id: scheduled.id,
      sessionId: scheduled.sessionId,
      scheduledAt: scheduled.scheduledAt,
      status: scheduled.status,
      messageType: scheduled.messageType,
      content: scheduled.content,
      recipients: scheduled.recipients,
      options: scheduled.options,
      batchId: scheduled.batchId,
      errorMessage: scheduled.errorMessage,
      createdAt: scheduled.createdAt,
      updatedAt: scheduled.updatedAt,
      completedAt: scheduled.completedAt,
    };
  }

  @Delete(':id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending scheduled message' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'id', description: 'Scheduled message ID' })
  async cancel(@Param('sessionId') sessionId: string, @Param('id') id: string) {
    const scheduled = await this.scheduledMessageService.cancel(sessionId, id);
    return {
      id: scheduled.id,
      status: scheduled.status,
      completedAt: scheduled.completedAt,
    };
  }
}
