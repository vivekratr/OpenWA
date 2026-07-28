import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedContact } from './entities/saved-contact.entity';
import { SavedContactService } from './saved-contact.service';
import { SavedContactController } from './saved-contact.controller';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [TypeOrmModule.forFeature([SavedContact], 'data'), SessionModule],
  controllers: [SavedContactController],
  providers: [SavedContactService],
  exports: [SavedContactService],
})
export class SavedContactModule {}
