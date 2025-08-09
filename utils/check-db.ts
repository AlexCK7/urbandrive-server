// utils/check-db.ts
import { pool } from './db';

export const checkDbConnection = async (): Promise<boolean> => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful:', res.rows[0]);
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    return false;
  }
};
