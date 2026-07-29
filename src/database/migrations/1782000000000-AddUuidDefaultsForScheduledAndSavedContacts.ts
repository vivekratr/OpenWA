import { MigrationInterface, QueryRunner } from 'typeorm';

/** Postgres DEFAULT for tables added after AddUuidDefaultsForPostgres1779235200000. */
export class AddUuidDefaultsForScheduledAndSavedContacts1782000000000 implements MigrationInterface {
  name = 'AddUuidDefaultsForScheduledAndSavedContacts1782000000000';

  private readonly tables = ['scheduled_messages', 'saved_contacts'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    for (const table of this.tables) {
      const exists = await queryRunner.hasTable(table);
      if (!exists) continue;
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::varchar`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    for (const table of this.tables) {
      const exists = await queryRunner.hasTable(table);
      if (!exists) continue;
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "id" DROP DEFAULT`);
    }
  }
}
