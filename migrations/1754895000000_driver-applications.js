'use strict';
/* eslint-disable */

exports.up = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      CREATE TYPE driver_app_status AS ENUM ('applied','approved','rejected');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

    CREATE INDEX IF NOT EXISTS idx_driver_apps_user   ON driver_applications(user_id);
    CREATE INDEX IF NOT EXISTS idx_driver_apps_status ON driver_applications(status);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_apps_user_pending
      ON driver_applications(user_id) WHERE status='applied';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS uq_driver_apps_user_pending;
    DROP INDEX IF EXISTS idx_driver_apps_user;
    DROP INDEX IF EXISTS idx_driver_apps_status;
    DROP TABLE IF EXISTS driver_applications;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'driver_app_status'
      ) THEN
        DROP TYPE IF EXISTS driver_app_status;
      END IF;
    END $$;
  `);
};
