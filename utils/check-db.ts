import pool from '../models/db';

(async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected at:', result.rows[0].now);
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
})();
