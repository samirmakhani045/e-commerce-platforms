import dotenv from 'dotenv';
import app from './app.js';
import pool from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Verify MySQL before starting the server
    const connection = await pool.getConnection();
    console.log('MySQL connected successfully');
    connection.release();

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to MySQL:', error.message);
    process.exit(1);
  }
}

startServer();