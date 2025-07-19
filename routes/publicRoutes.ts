import express from 'express';
const router = express.Router();

// Public health check endpoint
router.get('/', (_req, res) => {
  res.send('🌍 Welcome to the UrbanDrive API. Server is running.');
});

// Optional: Ping
router.get('/ping', (_req, res) => {
  res.json({ message: 'pong 🏓' });
});

export default router;
