import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScheduledMessages1780000000000 implements MigrationInterface {
  name = 'ScheduledMessages1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      await queryRunner.query(
        `CREATE TABLE "scheduled_messages" (
          "id" varchar PRIMARY KEY NOT NULL,
          "session_id" varchar NOT NULL,
          "scheduled_at" timestamp NOT NULL,
          "status" varchar NOT NULL DEFAULT 'pending',
          "message_type" varchar NOT NULL,
          "content" jsonb NOT NULL,
          "recipients" jsonb NOT NULL,
          "options" jsonb,
          "batch_id" varchar,
          "bull_job_id" varchar,
          "error_message" text,
          "created_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW(),
          "completed_at" timestamp
        )`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_scheduled_messages_session_id" ON "scheduled_messages" ("session_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_scheduled_messages_status" ON "scheduled_messages" ("status")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_scheduled_messages_scheduled_at" ON "scheduled_messages" ("scheduled_at")`,
      );
    } else {
      await queryRunner.query(
        `CREATE TABLE "scheduled_messages" (
          "id" varchar PRIMARY KEY NOT NULL,
          "session_id" varchar NOT NULL,
          "scheduled_at" datetime NOT NULL,
          "status" varchar NOT NULL DEFAULT ('pending'),
          "message_type" varchar NOT NULL,
          "content" text NOT NULL,
          "recipients" text NOT NULL,
          "options" text,
          "batch_id" varchar,
          "bull_job_id" varchar,
          "error_message" text,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
          "completed_at" datetime
        )`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_scheduled_messages_session_id" ON "scheduled_messages" ("session_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_scheduled_messages_status" ON "scheduled_messages" ("status")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_scheduled_messages_scheduled_at" ON "scheduled_messages" ("scheduled_at")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_scheduled_messages_scheduled_at"`);
    await queryRunner.query(`DROP INDEX "IDX_scheduled_messages_status"`);
    await queryRunner.query(`DROP INDEX "IDX_scheduled_messages_session_id"`);
    await queryRunner.query(`DROP TABLE "scheduled_messages"`);
  }
}
