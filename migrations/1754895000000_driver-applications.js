'use strict';
/* eslint-disable */

exports.up = (pgm) => {
  // enum for application status
  pgm.sql(`
    DO $$ BEGIN
      CREATE TYPE driver_app_status AS ENUM ('applied','approved','rejected');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // table to store applications
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS driver_applications (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      license_number TEXT,
      vehicle        TEXT,
      notes          TEXT,
      status         driver_app_status NOT NULL DEFAULT 'applied',
      submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      reviewed_at    TIMESTAMPTZ,
      reviewed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      review_notes   TEXT
    );
  `);

  // indexes
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_driver_apps_user   ON driver_applications(user_id);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_driver_apps_status ON driver_applications(status);`);

  // at most one pending/applied app per user
  pgm.sql(`
    DO $$ BEGIN
      CREATE UNIQUE INDEX uq_driver_apps_user_pending
        ON driver_applications(user_id)
        WHERE status = 'applied';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
};

exports.down = (pgm) => {
  // Drop partial unique and normal indexes
  pgm.sql(`DROP INDEX IF EXISTS uq_driver_apps_user_pending;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_driver_apps_user;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_driver_apps_status;`);

  // Drop table
  pgm.sql(`DROP TABLE IF EXISTS driver_applications;`);

  // Try to drop enum type if not referenced anymore
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'driver_app_status'
      ) THEN
        DROP TYPE IF EXISTS driver_app_status;
      END IF;
    END $$;
  `);
};
