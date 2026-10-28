import http from 'http';
import dotenv from 'dotenv';
import app from './app.js';
import pool from './config/db.js';
import { initSocket } from './socket/index.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    const connection = await pool.getConnection();
    console.log('MySQL connected successfully');
    connection.release();

    const httpServer = http.createServer(app);
    initSocket(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to MySQL:', error.message);
    process.exit(1);
  }
}

startServer();
