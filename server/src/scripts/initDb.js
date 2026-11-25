const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const env = require('../config/env');

async function initDatabase() {
  const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
  const seedPath = path.resolve(__dirname, '../../../database/seed.sql');

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  let seedSql = fs.readFileSync(seedPath, 'utf8');

  // Generate a real bcrypt hash for the demo password 'Clinica2026!'
  const demoHash = await bcrypt.hash('Clinica2026!', 10);
  seedSql = seedSql.replace(
    /SET @demo_password_hash = '[^']+';/,
    `SET @demo_password_hash = '${demoHash}';`
  );

  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true
  });

  try {
    console.log('[db:init] Se execută database/schema.sql...');
    await connection.query(schemaSql);
    console.log('[db:init] Se execută database/seed.sql (cu parole bcrypt hash-uite)...');
    await connection.query(seedSql);
    console.log('[db:init] Baza de date ClinicaWeb a fost inițializată și populată cu succes!');
  } finally {
    await connection.end();
  }
}

initDatabase().catch((err) => {
  console.error('[db:init] Eroare la inițializarea bazei de date:', err.message);
  process.exit(1);
});
