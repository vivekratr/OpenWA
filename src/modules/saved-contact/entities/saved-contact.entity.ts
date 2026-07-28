import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('saved_contacts')
@Index('IDX_saved_contacts_session_phone', ['sessionId', 'phone'], { unique: true })
export class SavedContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'varchar' })
  sessionId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  phone: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
