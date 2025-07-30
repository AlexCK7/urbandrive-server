import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes';
import rideRoutes from './routes/rideRoutes';
import adminRoutes from './routes/adminRoutes';
import publicRoutes from './routes/publicRoutes';
import driverRoutes from './routes/driverRoutes';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/rides', rideRoutes);
app.use('/admin', adminRoutes);
app.use('/', publicRoutes); // Health check, landing, open routes
app.use('/api/drivers', driverRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ UrbanDrive backend is running on http://localhost:${PORT}`);
});
