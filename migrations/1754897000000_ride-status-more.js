'use strict';
/* eslint-disable */

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'accepted';
    ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'enroute';
    ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'arrived';
  `);
};

exports.down = () => {
  // cannot easily remove enum values
};
