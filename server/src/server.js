const app = require('./app');
const env = require('./config/env');
const { testConnection } = require('./config/db');

async function startServer() {
  try {
    await testConnection();
    console.log(`[ClinicaWeb] Conexiunea la baza de date MySQL (${env.db.database}) a reușit.`);
  } catch (err) {
    console.error('[ClinicaWeb] ATENȚIE: Nu s-a putut conecta la MySQL:', err.message);
    console.error('[ClinicaWeb] Verificați variabilele din .env și starea serverului MySQL.');
  }

  app.listen(env.port, () => {
    console.log(`[ClinicaWeb] Serverul API rulează pe http://localhost:${env.port}`);
  });
}

startServer();
