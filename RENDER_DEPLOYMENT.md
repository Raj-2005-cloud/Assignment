# 🚀 Deploy ReachInbox Email Scheduler to Render

This comprehensive guide walks you through deploying the full ReachInbox Email Scheduler application to [Render](https://render.com/).

---

## 🏗️ Architecture Overview on Render

- **Web Service (Full-Stack Backend + Frontend)**: Express API, BullMQ Worker, and built React frontend served with SPA routing.
- **Redis Instance**: Redis 7 for BullMQ queues and atomic distributed rate limiting (via Render Redis or Upstash).
- **PostgreSQL Database**: Managed database for users, email jobs, senders, and metadata (via Render Postgres or Supabase/Neon).

---

## ⚡ Method 1: 1-Click Render Blueprint (Recommended)

Render Blueprints use the included [`render.yaml`](./render.yaml) file to automatically provision the Web Service, Redis, and PostgreSQL database in a single step.

### Step 1: Push Code to GitHub / GitLab
1. Create a repository on GitHub (e.g. `reachinbox-scheduler`).
2. Push your project code:
   ```bash
   git init
   git add .
   git commit -m "Deploy to Render"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/reachinbox-scheduler.git
   git push -u origin main
   ```

### Step 2: Create Blueprint on Render
1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** in the top navigation bar and select **Blueprint**.
3. Connect your GitHub/GitLab repository.
4. Render will detect [`render.yaml`](./render.yaml) and display the resources to be created:
   - `reachinbox-api` (Web Service)
   - `reachinbox-redis` (Redis Key-Value store)
   - `reachinbox-postgres` (PostgreSQL Database)
5. Click **Apply**. Render will automatically build the frontend, build the backend, synchronize the database schema, and launch the services!

---

## 🛠️ Method 2: Manual Service Setup (Step-by-Step)

If you prefer setting up the services manually via the Render UI:

### Step 1: Create a PostgreSQL Database
1. Go to [Render Dashboard](https://dashboard.render.com/) → **New +** → **PostgreSQL**.
2. **Name**: `reachinbox-db`
3. **Database**: `reachinbox_db`
4. **User**: `reachinbox`
5. **Plan**: Free (or Starter)
6. Click **Create Database**.
7. Copy the **Internal Database URL** (or **External Database URL** if using an external DB like Supabase/Neon).

---

### Step 2: Create a Redis Instance
1. Go to **New +** → **Redis**.
2. **Name**: `reachinbox-redis`
3. **Plan**: Free (or use [Upstash](https://upstash.com/) Serverless Redis for a permanent free tier).
4. Click **Create Redis**.
5. Copy the **Internal Redis URL** (e.g., `redis://red-xxxx:6379`).

---

### Step 3: Create the Web Service
1. Go to **New +** → **Web Service**.
2. Select your repository.
3. Configure the service settings:
   - **Name**: `reachinbox-scheduler`
   - **Region**: Same region as your Database & Redis (e.g. `Oregon`)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     cd frontend && npm install && npm run build && cd ../backend && npm install && npm run build && npx prisma db push
     ```
   - **Start Command**:
     ```bash
     cd backend && npm start
     ```
   - **Plan**: Free (or Starter)

---

### Step 4: Configure Environment Variables

In the **Environment** tab of your Web Service, add the following variables:

| Variable | Recommended Value / Source | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production optimizations & secure cookies |
| `PORT` | `3001` | Express server listening port |
| `DATABASE_URL` | *Paste PostgreSQL Internal Connection String* | Database connection URL |
| `REDIS_URL` | *Paste Redis Internal Connection String* | Redis connection URL |
| `JWT_SECRET` | *Click Generate or enter a 32+ char random string* | JWT token signing key |
| `SESSION_SECRET` | *Click Generate or enter a random string* | Session signing key |
| `WORKER_CONCURRENCY` | `5` | Concurrent BullMQ workers |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | `2000` | Minimum throttle delay between emails |
| `MAX_EMAILS_PER_HOUR` | `200` | Global hourly rate limit |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `50` | Per-sender hourly rate limit |
| `FRONTEND_URL` | `https://your-service-name.onrender.com` | Your deployed Render URL |
| `GOOGLE_CLIENT_ID` | *(Optional - leave empty for demo login)* | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | *(Optional - leave empty for demo login)* | Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | `https://your-service-name.onrender.com/api/auth/google/callback` | OAuth redirect URI |

4. Click **Save Changes** and trigger **Manual Deploy**.

---

## 🔍 Verification & Health Check

Once your service status changes to **Live**:

1. **Open the App**: Navigate to your Render URL (`https://your-app.onrender.com/`).
2. **Sign In**: Click **⚡ Instant Demo Login (Candidate Review)** to sign in immediately without configuring Google OAuth keys.
3. **API Health**: Visit `https://your-app.onrender.com/api/health` — you should receive:
   ```json
   { "status": "ok", "timestamp": "...", "uptime": 12.34 }
   ```
4. **BullMQ Queue Dashboard**: Access `https://your-app.onrender.com/admin/queues` to inspect queues, active workers, rate-limited jobs, and completed email tasks.
5. **Send / Schedule Email**:
   - Create an Ethereal sender in the **Senders** tab.
   - Schedule an email or upload a CSV in **Schedule Email**.
   - Check the **Dashboard** and click **View Email** to view real Ethereal email previews.

---

## 💡 Best Practices & Free Tier Tips

1. **Prevent Free Tier Spin-Down**:
   Render Free Web Services spin down after 15 minutes of inactivity. You can set up a free monitor using [UptimeRobot](https://uptimerobot.com/) or [Cron-Job.org](https://cron-job.org/) to ping `https://your-app.onrender.com/api/health` every 10 minutes.
2. **Persistent Queue Jobs**:
   All scheduled jobs are automatically persisted to PostgreSQL and re-synchronized on boot via `persistence.ts`, ensuring zero job loss even across container restarts or deployments.
3. **Upstash Redis (Alternative Free Tier)**:
   If Render free Redis expires (30-day limit on some free trials), create a free Redis database on [Upstash](https://upstash.com/) and paste its `rediss://...` connection URL into the `REDIS_URL` environment variable. The code automatically enables SSL/TLS for `rediss://`.
