import { MigrationInterface, QueryRunner } from 'typeorm';

export class SavedContacts1781000000000 implements MigrationInterface {
  name = 'SavedContacts1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      await queryRunner.query(
        `CREATE TABLE "saved_contacts" (
          "id" varchar PRIMARY KEY NOT NULL,
          "session_id" varchar NOT NULL,
          "name" varchar NOT NULL,
          "phone" varchar NOT NULL,
          "created_at" timestamp NOT NULL DEFAULT NOW()
        )`,
      );
    } else {
      await queryRunner.query(
        `CREATE TABLE "saved_contacts" (
          "id" varchar PRIMARY KEY NOT NULL,
          "session_id" varchar NOT NULL,
          "name" varchar NOT NULL,
          "phone" varchar NOT NULL,
          "created_at" datetime NOT NULL DEFAULT (datetime('now'))
        )`,
      );
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_saved_contacts_session_phone" ON "saved_contacts" ("session_id", "phone")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_saved_contacts_session_id" ON "saved_contacts" ("session_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_saved_contacts_session_id"`);
    await queryRunner.query(`DROP INDEX "IDX_saved_contacts_session_phone"`);
    await queryRunner.query(`DROP TABLE "saved_contacts"`);
  }
}
