// Test script to verify database connection
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Load environment variables
dotenv.config();

async function testConnection() {
  console.log('Testing database connection...');
  console.log('Connection details:');
  console.log(`Host: ${process.env.DB_HOST}`);
  console.log(`Port: ${process.env.DB_PORT}`);
  console.log(`Database: ${process.env.POSTGRES_DB}`);
  console.log(`User: ${process.env.POSTGRES_USER}`);

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    const result = await pool.query('SELECT version()');
    console.log('Database connection successful!');
    console.log('PostgreSQL version:', result.rows[0].version);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  testConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = testConnection;
