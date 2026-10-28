import express from 'express';
import cors from 'cors';
import pool from './config/db.js';
import apiRoutes from './routes/index.js';

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:4200',
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Ecommerce API is running',
  });
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.status(200).json({
      success: true,
      message: 'API and database are connected',
    });
  } catch (error) {
    console.error('Database health check failed:', error.message);

    res.status(503).json({
      success: false,
      message: 'Database connection failed',
    });
  }
});

export default app;