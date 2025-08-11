'use strict';
/* eslint-disable */

// Adds additional states to ride_status enum (no-op down)
exports.up = (pgm) => {
  pgm.sql(`ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'accepted';`);
  pgm.sql(`ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'enroute';`);
  pgm.sql(`ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'arrived';`);
};

exports.down = () => {
  // Removing enum values in Postgres is non-trivial and unsafe here.
  // Intentionally left as a no-op.
};
