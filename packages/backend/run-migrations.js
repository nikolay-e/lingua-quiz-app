// packages/backend/run-migrations.js

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function runMigrations() {
  const migrationFiles = fs.readdirSync(path.join(__dirname, 'migrations'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of migrationFiles) {
    if (path.extname(file) === '.sql') {
      const filePath = path.join(__dirname, 'migrations', file);
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`Running migration: ${file}`);
      await pool.query(sql);
      console.log(`Completed migration: ${file}`);
    }
  }

  await pool.end();
}

runMigrations().catch(console.error);