# 🚀 ReachInbox Email Scheduler

A production-grade, full-stack email scheduler service + dashboard built for the ReachInbox / Outbox Labs hiring assignment.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Setup & Installation](#setup--installation)
- [How Scheduling Works](#how-scheduling-works)
- [Persistence on Restart](#persistence-on-restart)
- [Rate Limiting & Concurrency](#rate-limiting--concurrency)
- [Slack Integration](#slack-integration)
- [API Documentation](#api-documentation)
- [Assumptions & Trade-offs](#assumptions--trade-offs)

---

## ✅ Features

### Backend
| Feature | Status | Details |
|---------|--------|---------|
| Email Scheduling via API | ✅ | POST `/api/emails/schedule` with JSON or CSV |
| BullMQ Delayed Jobs | ✅ | No cron — pure BullMQ delayed jobs |
| PostgreSQL Persistence | ✅ | Prisma ORM with full schema |
| Ethereal Email (SMTP) | ✅ | Multi-sender support, auto-generated credentials |
| Elasticsearch Search | ✅ | Full-text search on subject, body, recipient |
| BullMQ Dashboard | ✅ | Live at `/admin/queues` |
| Restart Recovery | ✅ | Recovers pending jobs on server startup |
| Idempotency | ✅ | SHA256 idempotency keys prevent duplicates |
| Worker Concurrency | ✅ | Configurable via `WORKER_CONCURRENCY` env |
| Rate Limiting | ✅ | Redis-backed, per-sender + global |
| Delay Between Sends | ✅ | Configurable `MIN_DELAY_BETWEEN_EMAILS_MS` |
| Slack Notifications | ✅ | Real OAuth + webhook on rate limit hit |
| Google OAuth | ✅ | Real Google login with JWT sessions |

### Frontend
| Feature | Status | Details |
|---------|--------|---------|
| Google Login | ✅ | Real OAuth with avatar/name/email display |
| Dashboard | ✅ | Stats cards, quick views |
| Scheduled Emails Tab | ✅ | Table with pagination, cancel action |
| Sent Emails Tab | ✅ | Table with Ethereal preview links |
| Compose Email Modal | ✅ | Subject, body, CSV upload, sender selection |
| Elasticsearch Search | ✅ | Debounced search bar in header |
| Slack Connect | ✅ | OAuth flow in sidebar |
| Loading States | ✅ | Skeleton loaders on all tables |
| Empty States | ✅ | Custom messages when no data |
| Error Handling | ✅ | Toast notifications for all operations |
| TypeScript | ✅ | Full type safety across the app |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │  Login   │ │Dashboard │ │ Compose  │ │   Search   │  │
│  │  (OAuth) │ │ (Tables) │ │ (Modal)  │ │   (ES)     │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘  │
│       │             │            │              │         │
│       └─────────────┴────────────┴──────────────┘         │
│                          │ HTTP/REST                      │
└──────────────────────────┼────────────────────────────────┘
                           │
┌──────────────────────────┼────────────────────────────────┐
│              Backend (Express.js + TypeScript)             │
│                          │                                │
│  ┌─────────┐  ┌─────────▼──────┐  ┌──────────────────┐   │
│  │ Google  │  │   REST API     │  │  BullMQ Board    │   │
│  │ OAuth   │  │  (/api/*)      │  │  (/admin/queues) │   │
│  └────┬────┘  └───────┬────────┘  └──────────────────┘   │
│       │               │                                   │
│  ┌────▼────┐  ┌───────▼────────┐  ┌──────────────────┐   │
│  │  JWT    │  │   Scheduler    │  │  Slack Service   │   │
│  │  Auth   │  │   Service      │  │  (OAuth+Notify)  │   │
│  └─────────┘  └───────┬────────┘  └──────────────────┘   │
│                       │                                   │
│              ┌────────▼────────┐                          │
│              │  BullMQ Queue   │                          │
│              │  (email-send)   │                          │
│              └────────┬────────┘                          │
│                       │                                   │
│              ┌────────▼────────┐                          │
│              │  BullMQ Worker  │◄── Concurrency: N        │
│              │  ┌────────────┐ │                          │
│              │  │Idempotency │ │                          │
│              │  │Rate Limit  │ │◄── Redis Counters        │
│              │  │SMTP Send   │ │◄── Ethereal              │
│              │  │ES Index    │ │◄── Elasticsearch          │
│              │  │Delay       │ │◄── Configurable ms        │
│              │  └────────────┘ │                          │
│              └─────────────────┘                          │
│                                                           │
└───────────────────────────────────────────────────────────┘
         │              │              │
    ┌────▼────┐  ┌──────▼──────┐  ┌───▼───────────┐
    │  Redis  │  │ PostgreSQL  │  │ Elasticsearch │
    │  7      │  │    15       │  │    8.12       │
    └─────────┘  └─────────────┘  └───────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | TypeScript, Express.js |
| Queue | BullMQ + Redis 7 |
| Database | PostgreSQL 15 + Prisma ORM |
| SMTP | Ethereal Email (fake SMTP) |
| Search | Elasticsearch 8.12 |
| Auth | Google OAuth 2.0 + JWT |
| Notifications | Slack OAuth + Webhooks |
| Frontend | React 18, Vite, TypeScript |
| Styling | Tailwind CSS 3 |
| State | React Query (TanStack) |
| Infra | Docker Compose |

---

## 🚀 Setup & Installation

### Prerequisites
- **Node.js** ≥ 18
- **Docker** & Docker Compose
- **Google Cloud Console** OAuth 2.0 credentials
- **(Optional)** Slack App credentials for notifications

### 1. Clone & Install

```bash
git clone <repo-url>
cd reachinbox-scheduler

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Start Infrastructure (Docker)

```bash
# From project root
docker-compose up -d
```

This starts:
- **Redis** on port 6379
- **PostgreSQL** on port 5432
- **Elasticsearch** on port 9200

### 3. Configure Environment

```bash
# Copy the template
cd backend
cp .env.example .env
```

Edit `.env` with your credentials:
- **Google OAuth**: Get from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
  - Create OAuth 2.0 Client ID (Web Application)
  - Authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
- **Slack** (optional): Create a [Slack App](https://api.slack.com/apps)
  - OAuth redirect URI: `http://localhost:3001/api/slack/callback`
  - Scopes: `incoming-webhook`, `chat:write`

### 4. Setup Database

```bash
cd backend
npx prisma db push
npx prisma generate
```

### 5. Run the Application

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- BullMQ Dashboard: http://localhost:3001/admin/queues

### 6. Ethereal Email Setup

Ethereal credentials are **auto-generated** when you create a sender in the app. No manual setup needed!

Each sender gets unique Ethereal SMTP credentials. After sending, you can click "View" in the Sent Emails tab to see the email preview on Ethereal.

---

## ⏰ How Scheduling Works

### No Cron — BullMQ Delayed Jobs Only

1. **User submits** schedule request via API (subject, body, recipients, scheduledAt)
2. **Backend creates** `EmailJob` records in PostgreSQL with unique idempotency keys
3. **Backend adds** BullMQ delayed jobs with `delay = scheduledAt - Date.now()`
4. **BullMQ stores** delayed jobs in Redis sorted sets (ZSET) — survives Redis restarts with AOF
5. **When time arrives**, BullMQ promotes the job from delayed → active
6. **Worker picks it up**, checks rate limits, sends via Ethereal SMTP
7. **Status updates**: DB updated to SENT, email indexed in Elasticsearch

```
Schedule Request
       │
       ▼
  ┌──────────┐     ┌──────────┐
  │  Create   │────▶│  Add to  │
  │  DB Row   │     │  BullMQ  │
  │  (PG)     │     │  (Redis) │
  └──────────┘     └────┬─────┘
                        │ delay = scheduledAt - now
                        ▼
                   ┌──────────┐
                   │  Worker  │ (at scheduled time)
                   │  Process │
                   └────┬─────┘
                        │
           ┌────────────┼────────────┐
           ▼            ▼            ▼
     Rate Limit    Send Email    Index ES
     Check         (Ethereal)
```

---

## 🔄 Persistence on Restart

### How it works:

1. **PostgreSQL** is the source of truth — every email job has a DB record
2. **Redis (AOF enabled)** persists BullMQ queue data to disk
3. **On server startup**, a recovery sweep runs:
   - Queries all `SCHEDULED`/`QUEUED`/`RATE_LIMITED` jobs from DB
   - For each, checks if a BullMQ job exists (by idempotencyKey = jobId)
   - If missing, re-creates the delayed job with correct delay
   - Past-due jobs are queued immediately with slight stagger
4. **Idempotency keys** (SHA256 hash) prevent any duplicates

### What survives restart:
✅ Future scheduled emails → still sent at correct time
✅ Past-due emails → sent immediately after restart
✅ Rate limit counters → stored in Redis, survive independently
❌ In-flight emails → retried by BullMQ's built-in retry mechanism

---

## ⚡ Rate Limiting & Concurrency

### Worker Concurrency
- **Configurable** via `WORKER_CONCURRENCY` env (default: 5)
- BullMQ worker processes N jobs in parallel
- Each job is independent — safe concurrent execution

### Delay Between Sends
- **Minimum 2 seconds** between individual email sends (configurable via `MIN_DELAY_BETWEEN_EMAILS_MS`)
- Implemented as `await sleep(delayMs)` in the worker after each send
- Mimics real email provider throttling

### Rate Limiting
- **Redis atomic counters** for thread safety:
  - Key pattern: `ratelimit:sender:{senderId}:{hourWindow}`
  - `hourWindow = Math.floor(Date.now() / 3600000)`
  - Atomic `INCR` + `EXPIRE(3600)` in pipeline
- **Per-sender limit**: `MAX_EMAILS_PER_HOUR_PER_SENDER` (default: 50)
- **Global limit**: `MAX_EMAILS_PER_HOUR` (default: 200)
- Both limits checked for every send attempt

### When Rate Limit is Hit:
1. Job is **NOT dropped or permanently failed**
2. Calculate `retryAfterMs = nextHourWindow - now`
3. **Reschedule** the job with the new delay
4. Update DB status to `RATE_LIMITED` → then back to `SCHEDULED`
5. **Send Slack notification** (if connected)
6. Order is preserved as much as possible

### Behavior Under Load (1000+ emails at same time):
- BullMQ processes `WORKER_CONCURRENCY` jobs concurrently
- Rate limiter caps at `MAX_EMAILS_PER_HOUR_PER_SENDER` per sender
- Excess jobs are automatically rescheduled to next hour window
- No jobs are dropped — they queue up and drain over multiple windows

---

## 💬 Slack Integration

### Connect Slack (Real OAuth):
1. Click "Connect Slack" in the sidebar
2. OAuth authorize flow → redirected to Slack → select workspace/channel
3. Backend stores access token + webhook URL per user
4. Rate limit notifications are sent to the connected channel

### Notifications:
- Triggered when a sender's hourly limit is reached
- Rich Slack message with sender email, count, limit
- If Slack is not connected → silently skipped (no crash)
- Connect/disconnect at any time without redeploy

---

## 📡 API Documentation

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/google` | Initiate Google OAuth |
| GET | `/api/auth/google/callback` | OAuth callback |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout |

### Emails
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/emails/schedule` | Schedule batch of emails |
| GET | `/api/emails/scheduled` | List scheduled emails (paginated) |
| GET | `/api/emails/sent` | List sent emails (paginated) |
| GET | `/api/emails/search?q=` | Search via Elasticsearch |
| DELETE | `/api/emails/:id` | Cancel a scheduled email |

### Senders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/senders` | List senders |
| POST | `/api/senders` | Create sender (auto Ethereal) |
| DELETE | `/api/senders/:id` | Delete sender |

### Slack
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/slack/connect` | Get Slack OAuth URL |
| GET | `/api/slack/callback` | OAuth callback |
| GET | `/api/slack/status` | Connection status |
| POST | `/api/slack/disconnect` | Disconnect |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/admin/queues` | BullMQ Dashboard (web UI) |

---

## 📝 Assumptions & Trade-offs

1. **Ethereal Email**: Using fake SMTP for testing. Each sender gets auto-generated Ethereal credentials — preview URLs are available in the Sent tab.

2. **Single-server deployment**: Rate limiting uses Redis counters which are safe across multiple workers in one process. For multi-server deployment, the same Redis instance would need to be shared.

3. **Idempotency key**: Based on `SHA256(senderId + recipient + subject + scheduledAt)`. This means scheduling the same email to the same recipient at the same time is correctly deduplicated.

4. **Rate limit rescheduling**: When rescheduled, a new BullMQ job is created (with a retry suffix on the key). The original job completes successfully to avoid BullMQ retries.

5. **Elasticsearch**: Used for search functionality. If ES is down, the app still works — search returns empty results and indexing failures are logged but non-fatal.

6. **JWT tokens**: Stored in httpOnly cookies for security. 7-day expiry.

7. **CSV parsing**: Supports any CSV/TXT file with email addresses anywhere in the content. Uses regex extraction for flexibility.

---

## 📁 Project Structure

```
├── docker-compose.yml          # Redis, PostgreSQL, Elasticsearch
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   ├── src/
│   │   ├── index.ts            # Express server entry
│   │   ├── config/             # Config, Redis, ES, BullBoard
│   │   ├── auth/               # Google OAuth + JWT middleware
│   │   ├── routes/             # API routes (auth, email, sender, slack)
│   │   ├── queue/              # BullMQ queue, worker, persistence
│   │   └── services/           # Rate limiter, Slack, Elasticsearch
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx            # React entry
│   │   ├── App.tsx             # Router
│   │   ├── index.css           # Tailwind + custom styles
│   │   ├── api/                # Axios client
│   │   ├── contexts/           # Auth context
│   │   ├── hooks/              # React Query hooks
│   │   ├── pages/              # Login, Dashboard
│   │   ├── components/
│   │   │   ├── layout/         # Sidebar, Header
│   │   │   ├── email/          # ComposeModal, Tables
│   │   │   └── ui/             # Button, Input, Modal, Badge, etc.
│   │   └── types/              # TypeScript interfaces
│   ├── package.json
│   └── tailwind.config.js
└── README.md
```
