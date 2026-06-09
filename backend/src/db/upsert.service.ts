import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './database.module';
import { ReportMapEntry, PgType } from '../sync/report-map.config';

const PG_TYPE_SQL: Record<PgType, string> = {
  text: 'text',
  numeric: 'numeric',
  integer: 'integer',
  boolean: 'boolean',
  timestamp: 'timestamptz',
  date: 'date',
};

// Identifiers come from config (developer-controlled). Validate anyway.
const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/;
function ident(name: string): string {
  if (!SAFE_IDENT.test(name)) {
    throw new Error(`Unsafe SQL identifier: "${name}"`);
  }
  return `"${name}"`;
}

@Injectable()
export class UpsertService {
  private readonly logger = new Logger(UpsertService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Creates the target table (if absent) with a PK of businessKeys + snapshot_date. */
  async ensureTable(entry: ReportMapEntry): Promise<void> {
    const cols = entry.columns
      .map((c) => `${ident(c.target)} ${PG_TYPE_SQL[c.type]}`)
      .join(',\n  ');

    const pk = [...entry.businessKeys.map(ident), '"snapshot_date"'].join(', ');

    const sql = `
      CREATE TABLE IF NOT EXISTS ${ident(entry.targetTable)} (
        ${cols},
        snapshot_date date NOT NULL,
        synced_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (${pk})
      );
    `;
    await this.pool.query(sql);
  }

  /**
   * Upsert a batch of source rows for a given snapshot date.
   * - New (key, snapshot_date) -> inserted
   * - Existing (key, snapshot_date) -> measures updated in place
   * Returns the number of rows written.
   */
  async upsertRows(
    entry: ReportMapEntry,
    rows: Record<string, any>[],
    snapshotDate: string, // 'YYYY-MM-DD'
  ): Promise<number> {
    if (rows.length === 0) return 0;

    const targetCols = entry.columns.map((c) => c.target);
    const allCols = [...targetCols, 'snapshot_date'];
    const keyCols = [...entry.businessKeys, 'snapshot_date'];
    const updateCols = targetCols.filter((c) => !entry.businessKeys.includes(c));

    const colSql = allCols.map(ident).join(', ');
    const conflictSql = keyCols.map(ident).join(', ');
    const updateSql = updateCols
      .map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`)
      .concat('"synced_at" = now()')
      .join(', ');

    // Build a multi-row VALUES list with positional parameters.
    const values: any[] = [];
    const tuples: string[] = [];
    let p = 1;
    for (const row of rows) {
      const placeholders: string[] = [];
      for (const c of entry.columns) {
        values.push(row[c.source] ?? null);
        placeholders.push(`$${p++}`);
      }
      values.push(snapshotDate);
      placeholders.push(`$${p++}`);
      tuples.push(`(${placeholders.join(', ')})`);
    }

    const sql = `
      INSERT INTO ${ident(entry.targetTable)} (${colSql})
      VALUES ${tuples.join(', ')}
      ON CONFLICT (${conflictSql})
      DO UPDATE SET ${updateSql};
    `;

    await this.pool.query(sql, values);
    this.logger.log(
      `Upserted ${rows.length} rows into ${entry.targetTable} for snapshot ${snapshotDate}.`,
    );
    return rows.length;
  }

  /** Ensures the bookkeeping table used to record each sync run exists. */
  async ensureSyncLogTable(): Promise<void> {
    await this.pool.query(`
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
  }

  async logRun(run: {
    request: string;
    targetTable?: string;
    snapshotDate?: string;
    rowsWritten?: number;
    status: 'success' | 'error';
    error?: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO sync_runs
         (request, target_table, snapshot_date, rows_written, status, error, finished_at)
       VALUES ($1,$2,$3,$4,$5,$6, now())`,
      [
        run.request,
        run.targetTable ?? null,
        run.snapshotDate ?? null,
        run.rowsWritten ?? null,
        run.status,
        run.error ?? null,
      ],
    );
  }

  async recentRuns(limit = 50): Promise<any[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }
}
