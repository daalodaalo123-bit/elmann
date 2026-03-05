## Elman Crochet Sales, Inventory, CRM, Expenses

### Local setup (MongoDB + Auth)

1) Create `server/.env`:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=some_long_random_secret
BOOTSTRAP_SECRET=some_long_random_secret
NODE_ENV=development
```

2) Install deps:

```bash
npm install
```

3) Start dev servers:

```bash
npm run dev
```

4) Bootstrap the first owner user (one-time):

Send this request (replace values):

```bash
curl -X POST http://localhost:5050/api/auth/bootstrap ^
  -H "Content-Type: application/json" ^
  -H "x-bootstrap-secret: <BOOTSTRAP_SECRET>" ^
  -d "{\"username\":\"owner\",\"password\":\"ownerpass123\"}"
```

Then login at `http://localhost:5173/login`.

### If you forgot the password (already bootstrapped)

**Option 1: Using the helper script (recommended)**

Make sure the API server is running, then:

```bash
cd server
npm run reset-password owner newpassword123
```

**Option 2: Using curl**

Use the admin reset endpoint (protected by `BOOTSTRAP_SECRET`):

```bash
curl -X POST http://localhost:5050/api/auth/reset-password ^
  -H "Content-Type: application/json" ^
  -H "x-bootstrap-secret: <BOOTSTRAP_SECRET>" ^
  -d "{\"username\":\"owner\",\"new_password\":\"ownerpass123\"}"
```

**Note:** Make sure your `server/.env` file has the correct `BOOTSTRAP_SECRET` value.

### (Old) Local setup (PostgreSQL)
This section is outdated; the current backend uses MongoDB.

1) Start PostgreSQL (recommended via Docker):

```bash
docker compose up -d
```

2) Create `server/.env`:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/elman
NODE_ENV=development
```

3) Install and init DB:

```bash
npm install
npm run db:init
npm run db:seed
```

4) Run the app:

```bash
npm run start
```

Open: `http://localhost:5050`

### Render deployment

This backend uses **MongoDB** (Atlas recommended).

- Create a Render **Web Service** for the `server` (or a single service that serves both API + built web).
- Set these env vars on the Render service:
  - `MONGODB_URI`: paste **only the URI value** (must start with `mongodb://` or `mongodb+srv://`)
  - `JWT_SECRET`
  - `BOOTSTRAP_SECRET`
  - `NODE_ENV=production`
- MongoDB Atlas:
  - Ensure the DB user/password in `MONGODB_URI` are correct
  - Ensure **Network Access** allows Render’s IPs (for quick testing you can allow `0.0.0.0/0`, then tighten later)

Bootstrap the first owner user once (use your Render service URL):

```bash
curl -X POST https://<your-service>.onrender.com/api/auth/bootstrap \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-secret: <BOOTSTRAP_SECRET>" \
  -d "{\"username\":\"owner\",\"password\":\"ownerpass123\"}"
```

If production is already bootstrapped and you need to reset the password:

```bash
curl -X POST https://<your-service>.onrender.com/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-secret: <BOOTSTRAP_SECRET>" \
  -d "{\"username\":\"owner\",\"new_password\":\"ownerpass123\"}"
```