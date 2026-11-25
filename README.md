# ClinicaWeb — Sistem de Gestiune a unei Clinici Medicale

**ClinicaWeb** este o aplicație web full-stack pentru gestionarea completă a unei clinici medicale, dezvoltată cu **React (Vite) + Bootstrap 5**, **Node.js + Express.js** și **MySQL 8.0**.

---

## Funcționalități Principale

1. **Autentificare & Control al Accesului pe Roluri (RBAC):**
   - JWT (`jsonwebtoken`) + parole hash-uite cu `bcrypt`.
   - 4 roluri distincte cu protecție atât în Express API (`authenticateToken`, `authorizeRoles`), cât și în React (`ProtectedRoute`):
     - **Pacient (`PATIENT`)**: înregistrare, catalog medici, programări online pe sloturi libere, anulare programări, vizualizare istoric medical propriu și tipărire/export PDF pentru fișe și rețete.
     - **Recepționer (`RECEPTIONIST`)**: agenda completă a clinicii, filtrare pe zile/medici/status, confirmare, reprogramare, anulare, programări noi (fizic/telefonic), actualizare status plată (`UNPAID` / `PAID_AT_RECEPTION`).
     - **Medic (`DOCTOR`)**: calendar propriu de consultații, acces securizat la istoricul medical al pacienților programați, completare/editare **Fișă Medicală Electronică (EHR)** și emitere **Rețete electronice** cu tipărire/salvare PDF curată.
     - **Administrator (`ADMIN`)**: CRUD utilizatori, medici, specializări și orare Luni–Vineri; panou de rapoarte în timp real (total programări, rata de confirmare/anulare, grad de ocupare per medic și per specializare, încasări la recepție, export CSV).
2. **Prevenire Suprapuneri la Concurență:**
   - Tranzacție MySQL atomică (`BEGIN` / `SELECT ... FOR UPDATE` / `INSERT` / `COMMIT`) dublată de constrângere `UNIQUE` pe sloturile active (`uq_appointments_active_slot`), returnând HTTP `409 Conflict` la rezervări simultane pe același slot.
3. **Conformitate GDPR & Fără Dependențe Externe:**
   - Date demonstrative exclusiv sintetice (fără CNP sau date personale reale).
   - Notificări interne în aplicație (toast + clopoțel de notificări), fără SMTP extern.

---

## Structura Proiectului

```text
clinica-medicala/
├── database/
│   ├── schema.sql          # Schema relațională MySQL + constrângeri + indecși
│   └── seed.sql            # Date sintetice demo (conform GDPR)
├── server/                 # Back-end RESTful API (Node.js + Express + mysql2)
│   ├── src/
│   │   ├── config/         # Configurare env & pool MySQL
│   │   ├── middlewares/    # JWT, RBAC, validare, error handling
│   │   ├── services/       # Logică business & tranzacții atomice
│   │   ├── controllers/    # Controllere HTTP
│   │   ├── routes/         # Rute RESTful (/api/*)
│   │   └── scripts/        # Script automat initDb.js
│   └── tests/              # Teste automate Jest + Supertest (TC-01 ... TC-05)
├── client/                 # Front-end React + Vite + Bootstrap 5
│   └── src/
│       ├── components/     # Navbar, ProtectedRoute, StatusBadge, PrintableRecordModal
│       ├── context/        # AuthContext, ToastContext
│       ├── pages/          # Home, Login, Register, BookAppointment, 4 Dashboards, Profile
│       └── services/       # Client API REST
├── docker-compose.yml      # Pornire rapidă MySQL 8.0 cu auto-import schema & seed
├── .env.example            # Template variabile de mediu
└── README.md
```

---

## Cerințe de Sistem

- **Node.js** `>= 18.x` (recomandat Node.js 20 LTS) și **npm** `>= 9.x`
- **MySQL Server 8.0+** (local) **SAU** **Docker Desktop** (pentru pornirea MySQL prin `docker-compose.yml`)

---

## Instalare și Configurare Locală

### 1. Configurarea variabilelor de mediu (`.env`)

Copiați fișierul `.env.example` în `.env` în rădăcina proiectului (și/sau în `/server/.env`):

```bash
cp .env.example .env
```

Editați `.env` cu datele de conectare la serverul dumneavoastră MySQL (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) și setați un `JWT_SECRET` sigur.

### 2. Inițializarea Bazei de Date MySQL

**Varianta A — Cu Docker Compose (recomandat, import automat):**

```bash
docker compose up -d
```

MySQL va porni pe portul `3306` și va rula automat `database/schema.sql` și `database/seed.sql`.

**Varianta B — Cu MySQL instalat local (CLI):**

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

**Varianta C — Din Node.js (după instalarea dependențelor serverului):**

```bash
cd server
npm run db:init
```

### 3. Pornire rapidă cu un singur click / comandă (Windows)

Puteți porni întreaga aplicație (MySQL via Docker dacă este disponibil, instalare automată dependențe, Back-end + Front-end și deschidere în browser) folosind scriptul `start.bat` sau `start.ps1`:

```powershell
# Prima pornire (inițializează și populează baza de date cu parola demo Clinica2026!):
.\start.ps1 -InitDb

# Pornirile ulterioare (sau dublu-click pe start.bat):
.\start.ps1
```

### 4. Instalarea dependențelor și pornirea manuală

Deschideți **două terminale**:

**Terminal 1 — Back-end (`/server`):**
```bash
cd server
npm install
npm run dev
```
Serverul API va rula pe `http://localhost:5000` (healthcheck: `http://localhost:5000/api/health`).

**Terminal 2 — Front-end (`/client`):**
```bash
cd client
npm install
npm run dev
```
Aplicația React va rula pe `http://localhost:5173`.

---

## Rularea Testelor Automate (TC-01 … TC-05)

Testele verifică autentificarea și RBAC (`TC-01`), catalogul și sloturile (`TC-02`), rezervarea atomică și testul de concurență `Promise.all` (`TC-03`), fișele medicale + rețetele (`TC-04`) și fluxul recepție + rapoarte admin (`TC-05`):

```bash
cd server
npm test
```

> **Notă:** Suita de integrare `clinicaweb.test.js` necesită o instanță MySQL activă (configurată în `.env`) și resetează automat schema + datele demo înainte de rulare.

---

## Conturi Demo (Parolă unică: `Clinica2026!`)

Pe pagina de autentificare (`/login`) sunt disponibile și butoane rapide **„Demo Login”** pentru demonstrații.

| Rol | Nume Complet | Email | Parolă |
| :--- | :--- | :--- | :--- |
| **Administrator** (`ADMIN`) | Radu Marinescu | `admin@clinicaweb.ro` | `Clinica2026!` |
| **Recepționer** (`RECEPTIONIST`) | Alina Ionescu | `receptie@clinicaweb.ro` | `Clinica2026!` |
| **Medic — Cardiologie** (`DOCTOR`) | Dr. Elena Popescu | `elena.popescu@clinicaweb.ro` | `Clinica2026!` |
| **Medic — Dermatologie** (`DOCTOR`) | Dr. Mihai Georgescu | `mihai.georgescu@clinicaweb.ro` | `Clinica2026!` |
| **Medic — Pediatrie** (`DOCTOR`) | Dr. Ioana Stan | `ioana.stan@clinicaweb.ro` | `Clinica2026!` |
| **Medic — Medicină Internă** (`DOCTOR`) | Dr. Alexandru Moldovan | `alexandru.moldovan@clinicaweb.ro` | `Clinica2026!` |
| **Pacient Demo 1** (`PATIENT`) | Andrei Dumitrescu | `andrei.dumitrescu@demo.ro` | `Clinica2026!` |
| **Pacient Demo 2** (`PATIENT`) | Maria Vasilescu | `maria.vasilescu@demo.ro` | `Clinica2026!` |
| **Pacient Demo 3** (`PATIENT`) | Cristian Stoica | `cristian.stoica@demo.ro` | `Clinica2026!` |
| **Pacient Demo 4** (`PATIENT`) | Elena Rusu | `elena.rusu@demo.ro` | `Clinica2026!` |
| **Pacient Demo 5** (`PATIENT`) | George Munteanu | `george.munteanu@demo.ro` | `Clinica2026!` |
