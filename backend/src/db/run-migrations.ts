import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { REPORT_MAP, PgType } from './sync/report-map.config';

dotenv.config();

const PG_TYPE_SQL: Record<PgType, string> = {
  text: 'text',
  numeric: 'numeric',
  integer: 'integer',
  boolean: 'boolean',
  timestamp: 'timestamptz',
  date: 'date',
};
const SAFE = /^[a-z_][a-z0-9_]*$/;
const id = (n: string) => {
  if (!SAFE.test(n)) throw new Error(`Unsafe identifier: ${n}`);
  return `"${n}"`;
};

async function main() {
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'powerbi_backup',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sync_runs (
      id bigserial PRIMARY KEY,
      request text NOT NULL,
      target_table text,
      snapshot_date date,
      rows_written integer,
      status text NOT NULL,
      error text,
      started_at timestamptz NOT NULL DEFAULT now(),
      finished_at timestamptz
    );
  `);
  console.log('Ensured sync_runs.');

  for (const e of REPORT_MAP) {
    const cols = e.columns
      .map((c) => `${id(c.target)} ${PG_TYPE_SQL[c.type]}`)
      .join(',\n  ');
    const pk = [...e.businessKeys.map(id), '"snapshot_date"'].join(', ');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${id(e.targetTable)} (
        ${cols},
        snapshot_date date NOT NULL,
        synced_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (${pk})
      );
    `);
    console.log(`Ensured ${e.targetTable}.`);
  }

  await pool.end();
  console.log('Migrations complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
