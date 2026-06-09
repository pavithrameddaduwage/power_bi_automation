# Power BI → PostgreSQL backup

Backs up the data behind your Power BI dashboards into your own PostgreSQL
database, so you keep a copy even if a report or dataset is lost upstream.

- **Backend:** NestJS (auth, Power BI REST, sync, upsert, weekly cron)
- **Frontend:** Angular 17 (trigger syncs, view configured reports + run history)

> This project was hand-scaffolded, so it ships as source you install and run
> locally. There was no network where it was generated, meaning `npm install`,
> the Nest/Angular CLIs, and the live Power BI calls were **not** run or tested
> here — treat it as a working starter, install it, and verify against your
> tenant.

## How it works

```
request ("inventory amazon")
  → find the dashboard by name
  → resolve the dataset(s) behind its tiles   (data lives in the dataset, not the dashboard)
  → EVALUATE the table via DAX (executeQueries)
  → ensure the Postgres table exists
  → UPSERT keyed on (business keys + snapshot_date)
```

### The snapshot + upsert model

Every target table has a primary key of **your business key(s) + `snapshot_date`**.
`snapshot_date` is the most recent Wednesday (your refresh day).

- A **new week** produces a new `snapshot_date`, so a fresh set of rows is
  **inserted** and prior weeks are untouched → full history is preserved.
- **Re-running the same week**, or a correction to an already-pulled week,
  **upserts** (updates the measures in place via `ON CONFLICT … DO UPDATE`).
- **Deletes upstream are ignored on purpose** — a backup should not lose rows
  just because Power BI did. Old snapshots always remain.

This makes every run idempotent: run it as often as you like, it converges.

## Setup

### 0. Prerequisites
- Node.js 18+, PostgreSQL 14+
- In the **Power BI Admin portal**, allow service principals to use the REST
  APIs, and add your app's service principal as a **member of each workspace**
  you want to read.

### 1. Backend
```bash
cd backend
cp .env.example .env        # then fill in real values
npm install
createdb powerbi_backup     # or create it however you prefer
npm run migrate             # optional: pre-creates tables
npm run start:dev
```
Backend runs on `http://localhost:3000`.

> **Security:** rotate the client secret you shared earlier in Azure
> (App registrations → Certificates & secrets) and put the new one only in
> `.env`. `.env` is gitignored.

### 2. Frontend
```bash
cd frontend
npm install
npm start
```
Open `http://localhost:4200`.

## Configuring your reports

Edit `backend/src/sync/report-map.config.ts`. One object per table you want
backed up:

| Field          | Meaning |
|----------------|---------|
| `request`      | What you type/select, e.g. `inventory amazon` |
| `dashboardName`| Power BI dashboard to find (fuzzy match) |
| `daxTable`     | Table to `EVALUATE` (or use `daxQuery` for a custom DAX) |
| `targetTable`  | Postgres table to write |
| `businessKeys` | Columns that uniquely identify a row (the upsert key) |
| `columns`      | Source→target column mapping + Postgres type |

The two entries provided (`inventory amazon`, `amazon sales`) are **examples** —
replace the column names, keys, and DAX table names with your real ones.
`GET /api/dashboards` (or the UI) lists your live dashboards to help fill these in.

## API

| Method | Path                   | Purpose |
|--------|------------------------|---------|
| GET    | `/api/reports`         | Configured requests |
| GET    | `/api/dashboards`      | Live dashboards from Power BI |
| POST   | `/api/sync/:request`   | Sync one request |
| POST   | `/api/sync`            | Sync everything |
| GET    | `/api/runs`            | Recent sync history |

The weekly cron (`SYNC_CRON`, default Wednesday 06:00 UTC) runs `/api/sync`.

## Things to verify against your tenant
- Power BI REST endpoint paths and the `executeQueries` request/response shape
  (Microsoft occasionally changes these) — see the official Power BI REST docs.
- `executeQueries` has per-query row limits; for large tables add paging or a
  filtered DAX query in `daxQuery`.
- Confirm each dataset actually exposes the DAX table name you reference.
```
