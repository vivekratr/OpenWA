import { Controller, Get, Post, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SavedContactService } from './saved-contact.service';
import { UpsertSavedContactsDto } from './dto/upsert-saved-contacts.dto';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';

@ApiTags('saved-contacts')
@Controller('sessions/:sessionId/saved-contacts')
export class SavedContactController {
  constructor(private readonly savedContactService: SavedContactService) {}

  @Get()
  @ApiOperation({ summary: 'List saved contacts for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiQuery({ name: 'q', required: false, description: 'Search by name or phone' })
  async list(@Param('sessionId') sessionId: string, @Query('q') q?: string) {
    const contacts = await this.savedContactService.findBySession(sessionId, q);
    return {
      data: contacts.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        createdAt: c.createdAt,
      })),
    };
  }

  @Post()
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save contacts (upsert by phone)' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  async upsert(@Param('sessionId') sessionId: string, @Body() dto: UpsertSavedContactsDto) {
    const contacts = await this.savedContactService.upsertMany(sessionId, dto);
    return {
      data: contacts.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        createdAt: c.createdAt,
      })),
    };
  }

  @Delete(':id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a saved contact' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'id', description: 'Saved contact ID' })
  async remove(@Param('sessionId') sessionId: string, @Param('id') id: string) {
    await this.savedContactService.remove(sessionId, id);
  }
}
