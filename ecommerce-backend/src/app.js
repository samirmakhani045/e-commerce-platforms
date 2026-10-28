import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './config/db.js';
import apiRoutes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminPublicDir = path.join(__dirname, '../public/admin');

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:4200',
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.use('/admin', express.static(adminPublicDir));

app.get('/admin/*splat', (req, res) => {
  res.sendFile(path.join(adminPublicDir, 'index.html'));
});

app.get('/', (req, res) => {
  res.json({
    message: 'Ecommerce API is running',
    adminPanel: '/admin',
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