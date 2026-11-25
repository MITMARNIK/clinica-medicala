const mysql = require('mysql2/promise');
const env = require('../config/env');

async function isDatabaseReady() {
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password
  });

  try {
    const [dbs] = await conn.query('SHOW DATABASES LIKE ?', [env.db.database]);
    if (!dbs.length) return false;

    await conn.query(`USE \`${env.db.database}\``);
    const [tables] = await conn.query("SHOW TABLES LIKE 'users'");
    if (!tables.length) return false;

    const [rows] = await conn.query('SELECT COUNT(*) AS cnt FROM users');
    return Number(rows[0].cnt) > 0;
  } finally {
    await conn.end();
  }
}

isDatabaseReady()
  .then((ready) => {
    if (ready) {
      console.log('[db:check] Baza de date clinicaweb este deja initializata.');
      process.exit(0);
    } else {
      console.log('[db:check] Baza de date nu este initializata. Se ruleaza db:init...');
      process.exit(2);
    }
  })
  .catch((err) => {
    console.error('[db:check] Nu s-a putut conecta la MySQL:', err.message);
    process.exit(1);
  });
