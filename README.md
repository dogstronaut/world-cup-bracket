# Miranda & Friends Family World Cup Knockout Bracket

A family bracket prediction game for the 2026 FIFA World Cup knockout stage. Players fill out their bracket picks before the tournament begins, and results are synced automatically via the Anthropic API. A live leaderboard ranks everyone by points.

---

## Prerequisites

- **Node.js 18+**
- **Vercel account** — [vercel.com](https://vercel.com)
- **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com)

---

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/your-username/world-cup-bracket.git
cd world-cup-bracket
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Vercel KV — copy these from your KV database dashboard
KV_URL=your_vercel_kv_url
KV_REST_API_URL=your_vercel_kv_rest_api_url
KV_REST_API_TOKEN=your_vercel_kv_rest_api_token
KV_REST_API_READ_ONLY_TOKEN=your_vercel_kv_rest_api_read_only_token

ADMIN_PASSWORD=worldcup2026
CRON_SECRET=some_random_string
```

> **Tip:** For local development with a real KV database, use `vercel dev` (requires the Vercel CLI and a linked project). If you just want to run the UI without KV, `npm run dev` will start the dev server but storage operations will fail without valid KV credentials.

### 4. Run the development server

```bash
# Recommended: uses Vercel's local environment (includes KV tunnel)
npx vercel dev

# Or standard Next.js dev server (requires KV vars in .env.local)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deploy to Vercel

### Step 1 — Push to GitHub

Make sure your code is pushed to a GitHub repository (public or private).

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### Step 2 — Import project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and sign in.
2. Click **Add New > Project**.
3. Select your GitHub repository and click **Import**.
4. Leave the framework preset as **Next.js** — Vercel detects it automatically.
5. Do **not** click Deploy yet — set up KV and environment variables first.

### Step 3 — Set up Vercel KV

1. In your Vercel project dashboard, go to the **Storage** tab.
2. Click **Create Database** and choose **KV**.
3. Give it a name (e.g. `world-cup-kv`) and click **Create**.
4. On the KV database page, click **Connect to Project** and select your project.
5. Vercel automatically adds the four `KV_*` environment variables to your project — you do not need to set these manually.

### Step 4 — Set environment variables

In your Vercel project, go to **Settings > Environment Variables** and add:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your key from [console.anthropic.com](https://console.anthropic.com) |
| `ADMIN_PASSWORD` | `worldcup2026` (or any password you choose) |
| `CRON_SECRET` | A random string (e.g. output of `openssl rand -hex 16`) |

The four `KV_*` variables are added automatically when you connect the KV database (Step 3).

Set all variables for **Production**, **Preview**, and **Development** environments as needed.

### Step 5 — Deploy

Click **Deploy**. Vercel will build and deploy the app. When it finishes, you'll get a live URL like `https://world-cup-bracket.vercel.app`.

---

## Admin Panel

Visit `/admin` on your deployed site (e.g. `https://your-app.vercel.app/admin`).

- **Password:** `worldcup2026` (or whatever you set as `ADMIN_PASSWORD`)
- From the admin panel you can:
  - Manually trigger a results sync (calls the Anthropic API to fetch current match results)
  - View the sync log
  - Edit results directly

---

## Cron Job

The file `vercel.json` configures an automatic cron job:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

This calls `/api/cron` every 30 minutes to sync the latest World Cup results via the Anthropic API.

> **Important:** Vercel Cron Jobs require a **Vercel Pro** plan (or higher). On the free Hobby plan, the cron will not run automatically. You can still trigger syncs manually from the admin panel at any time, regardless of your plan.

The cron endpoint is protected by `CRON_SECRET` — Vercel passes this automatically as a Bearer token when it invokes the cron.

---

## How Scoring Works

Points are awarded for each correct match prediction. Later rounds are worth more:

| Round | Correct picks | Points each |
|---|---|---|
| Round of 32 | 16 matches | 1 pt |
| Round of 16 | 8 matches | 2 pts |
| Quarterfinals | 4 matches | 4 pts |
| Semifinals | 2 matches | 8 pts |
| Final | 1 match | 16 pts |
| Champion bonus | — | +32 pts |

The champion bonus is awarded if you correctly predicted the overall tournament winner. It does **not** count toward pick accuracy.

**Maximum possible score:** 16×1 + 8×2 + 4×4 + 2×8 + 1×16 + 32 = **128 points**

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | API key from [console.anthropic.com](https://console.anthropic.com). Used to sync match results. |
| `ADMIN_PASSWORD` | Yes | Password to access the `/admin` panel. Default: `worldcup2026`. |
| `CRON_SECRET` | Yes | Random secret used to authenticate Vercel's cron calls to `/api/cron`. |
| `KV_URL` | Yes | Auto-set by Vercel when you connect a KV database. |
| `KV_REST_API_URL` | Yes | Auto-set by Vercel when you connect a KV database. |
| `KV_REST_API_TOKEN` | Yes | Auto-set by Vercel when you connect a KV database. |
| `KV_REST_API_READ_ONLY_TOKEN` | Yes | Auto-set by Vercel when you connect a KV database. |

---

## Tech Stack

| Technology | Purpose |
|---|---|
| [Next.js 14](https://nextjs.org) | React framework with App Router and API routes |
| [Vercel KV](https://vercel.com/docs/storage/vercel-kv) | Redis-backed key-value store for brackets and results |
| [Anthropic API](https://docs.anthropic.com) | Fetches and parses live World Cup match results |
| [Tailwind CSS](https://tailwindcss.com) | Utility-first styling |
| [TypeScript](https://www.typescriptlang.org) | Type safety throughout |
