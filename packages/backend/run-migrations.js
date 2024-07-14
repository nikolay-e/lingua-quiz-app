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
  const migrationFiles = fs
    .readdirSync(path.join(__dirname, 'migrations'))
    .sort((a, b) => a.localeCompare(b));

  const runMigration = async (file) => {
    if (path.extname(file) === '.sql') {
      const filePath = path.join(__dirname, 'migrations', file);
      const sql = fs.readFileSync(filePath, 'utf8');
      process.stdout.write(`Running migration: ${file}\n`);
      await pool.query(sql);
      process.stdout.write(`Completed migration: ${file}\n`);
    }
  };

  await Promise.all(migrationFiles.map(runMigration));
  await pool.end();
}

runMigrations().catch((error) => {
  process.stderr.write(`${error}\n`);
  process.exit(1);
});
