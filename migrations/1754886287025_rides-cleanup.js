'use strict';
/* eslint-disable */

exports.up = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      CREATE TYPE ride_status AS ENUM ('pending','assigned','completed','cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE IF EXISTS rides
      ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT now();

    CREATE INDEX IF NOT EXISTS idx_rides_requested_at ON rides(requested_at);
  `);
};

exports.down = () => {
  // conservative no-op
};
