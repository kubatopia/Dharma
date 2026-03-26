# Dharma Automations

Turn scheduling request emails into ready-to-send replies, powered by Google Calendar and Claude AI.

---

## Prerequisites

Install these once on your machine before anything else.

| Tool | Version | Download |
|---|---|---|
| Node.js | 20 or higher | https://nodejs.org |
| npm | comes with Node | — |
| PostgreSQL | 15 or higher | https://www.postgresql.org/download/ |

> **Quick check** — open a terminal and run:
> ```
> node -v   # should print v20.x.x or higher
> psql --version
> ```

---

## First-time setup (do this once)

### 1. Clone the repo

```bash
git clone <repo-url>
cd dharma
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the database

```bash
createdb dharma
```

### 4. Set up environment variables

```bash
cp .env.example apps/web/.env.local
```

Open `apps/web/.env.local` and fill in the values. The file has comments explaining each one. The minimum you need to run locally:

- `DATABASE_URL` — leave the default if you used `createdb dharma` above
- `AUTH_SECRET` — run `openssl rand -base64 32` and paste the output
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — see [Google OAuth setup](#google-oauth-setup) below

### 5. Push the database schema

```bash
npm run db:push
```

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the login page.

---

## Google OAuth setup

1. Go to [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Under **Authorised redirect URIs**, add:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
5. Copy the **Client ID** and **Client secret** into your `.env.local`

---

## Daily development

```bash
npm run dev        # start the Next.js dev server (hot reload)
npm run build      # production build
npm run db:studio  # open Prisma Studio (visual database browser)
```

---

## Repo structure

```
dharma/
├── apps/
│   └── web/               # Next.js application
│       ├── app/           # pages and API routes (App Router)
│       ├── lib/           # auth.ts, prisma.ts
│       └── package.json
├── packages/
│   ├── types/             # shared TypeScript types (TimeSlot, SchedulingRequest, …)
│   ├── calendar-core/     # finds free slots given a provider + request
│   ├── providers-google/  # real + mock Google Calendar providers
│   └── reply-generation/  # template and AI reply generators
├── .env.example           # copy this to apps/web/.env.local
└── package.json           # workspace root
```

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | yes | Random string for signing session cookies |
| `GOOGLE_CLIENT_ID` | yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | yes | Google OAuth client secret |
| `ANTHROPIC_API_KEY` | no | Enables AI replies; falls back to template if missing |
