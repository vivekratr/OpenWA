import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedContact } from './entities/saved-contact.entity';
import { UpsertSavedContactsDto } from './dto/upsert-saved-contacts.dto';
import { SessionService } from '../session/session.service';

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

@Injectable()
export class SavedContactService {
  constructor(
    @InjectRepository(SavedContact, 'data')
    private readonly savedContactRepository: Repository<SavedContact>,
    private readonly sessionService: SessionService,
  ) {}

  async findBySession(sessionId: string, search?: string): Promise<SavedContact[]> {
    await this.assertSession(sessionId);

    const qb = this.savedContactRepository
      .createQueryBuilder('c')
      .where('c.session_id = :sessionId', { sessionId })
      .orderBy('c.name', 'ASC');

    const q = search?.trim();
    if (q) {
      qb.andWhere('(c.name LIKE :q OR c.phone LIKE :q)', { q: `%${q}%` });
    }

    return qb.getMany();
  }

  async upsertMany(sessionId: string, dto: UpsertSavedContactsDto): Promise<SavedContact[]> {
    await this.assertSession(sessionId);

    const saved: SavedContact[] = [];
    for (const item of dto.contacts) {
      const phone = normalizePhone(item.phone);
      if (phone.length < 10) continue;

      const name = item.name?.trim() || phone;
      const existing = await this.savedContactRepository.findOne({ where: { sessionId, phone } });
      if (existing) {
        if (name !== phone && existing.name === existing.phone) {
          existing.name = name;
          saved.push(await this.savedContactRepository.save(existing));
        } else {
          saved.push(existing);
        }
        continue;
      }

      const created = this.savedContactRepository.create({ sessionId, phone, name });
      saved.push(await this.savedContactRepository.save(created));
    }

    return saved;
  }

  async remove(sessionId: string, id: string): Promise<void> {
    await this.assertSession(sessionId);

    const contact = await this.savedContactRepository.findOne({ where: { id, sessionId } });
    if (!contact) {
      throw new NotFoundException(`Saved contact '${id}' not found`);
    }

    await this.savedContactRepository.remove(contact);
  }

  private async assertSession(sessionId: string): Promise<void> {
    const session = await this.sessionService.findOne(sessionId);
    if (!session) {
      throw new NotFoundException(`Session '${sessionId}' not found`);
    }
  }
}
