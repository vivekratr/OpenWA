import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
  ValidateNested,
  IsEnum,
  IsDateString,
  ArrayMinSize,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class ScheduledMessageContentDto {
  @ApiPropertyOptional({ description: 'Text content for text messages' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ description: 'Caption for media messages' })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  image?: { url?: string; base64?: string; mimetype?: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  video?: { url?: string; base64?: string; mimetype?: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  audio?: { url?: string; base64?: string; mimetype?: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  document?: { url?: string; base64?: string; mimetype?: string; filename?: string };
}

class ScheduledMessageOptionsDto {
  @ApiPropertyOptional({ description: 'Delay between messages in ms', default: 3000 })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  delayBetweenMessages?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  randomizeDelay?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  stopOnError?: boolean;
}

export class CreateScheduledMessageDto {
  @ApiProperty({ description: 'When to send the message', example: '2026-07-28T09:00:00+05:30' })
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({
    description: 'Recipient phone numbers or WhatsApp chat IDs',
    example: ['919820229230', '628123456789'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  recipients: string[];

  @ApiProperty({ enum: ['text', 'image', 'video', 'audio', 'document'] })
  @IsEnum(['text', 'image', 'video', 'audio', 'document'])
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document';

  @ApiProperty({ description: 'Message content based on type' })
  @ValidateNested()
  @Type(() => ScheduledMessageContentDto)
  content: ScheduledMessageContentDto;

  @ApiPropertyOptional({ description: 'Bulk send options when firing' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduledMessageOptionsDto)
  options?: ScheduledMessageOptionsDto;
}
