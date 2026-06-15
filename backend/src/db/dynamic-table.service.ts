import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './database.module';

/**
 * Dynamic, schema-on-write storage.
 *
 * Unlike the fixed REPORT_MAP pipeline (which needs columns declared up front),
 * this service takes whatever rows it is handed, infers a Postgres column for
 * each field, CREATEs the table if missing, ALTERs in any new columns it has
 * not seen before, and appends/upserts the rows. That is what lets one person
 * upload a custom report with 5 extra rows (or extra columns) and have the
 * backend table grow to fit it — no migration required.
 */

export type InferredType =
  | 'text'
  | 'numeric'
  | 'integer'
  | 'boolean'
  | 'timestamptz';

const TYPE_SQL: Record<InferredType, string> = {
  text: 'text',
  numeric: 'numeric',
  integer: 'integer',
  boolean: 'boolean',
  timestamptz: 'timestamptz',
};

export interface DynamicColumn {
  /** The original key as it arrived in the row JSON. */
  original: string;
  /** Sanitised Postgres column name. */
  name: string;
  type: InferredType;
}

const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/;
function ident(name: string): string {
  if (!SAFE_IDENT.test(name)) {
    throw new Error(`Unsafe SQL identifier: "${name}"`);
  }
  return `"${name}"`;
}

/** Turn any string into a safe snake_case Postgres identifier. */
function slugifyIdent(raw: string, fallback = 'col'): string {
  let s = (raw ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!s) s = fallback;
  if (/^[0-9]/.test(s)) s = '_' + s;
  return s.slice(0, 60);
}

function inferColumnType(values: any[]): InferredType {
  const present = values.filter(
    (v) => v !== null && v !== undefined && String(v).trim() !== '',
  );
  if (present.length === 0) return 'text';

  const isBool = (v: any) =>
    typeof v === 'boolean' || /^(true|false)$/i.test(String(v));
  const isInt = (v: any) => /^-?\d+$/.test(String(v).trim());
  const isNum = (v: any) =>
    String(v).trim() !== '' && !isNaN(Number(v));
  const isDate = (v: any) =>
    /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?/.test(String(v).trim()) &&
    !isNaN(Date.parse(String(v)));

  if (present.every(isBool)) return 'boolean';
  if (present.every(isInt)) return 'integer';
  if (present.every(isNum)) return 'numeric';
  if (present.every(isDate)) return 'timestamptz';
  return 'text';
}

function coerce(value: any, type: InferredType): any {
  if (value === undefined || value === '' ) return null;
  if (value === null) return null;
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value;
    return /^true$/i.test(String(value));
  }
  return value;
}

export interface UploadInput {
  /** Logical name used to derive the table, e.g. a report name. */
  label: string;
  /** Final table name (already prefixed). Computed via tableNameFor(). */
  table: string;
  /** 'report' | 'principals' — for the dataset registry. */
  kind: string;
  /** Who/what produced these rows. */
  owner?: string;
  /** 'upload' (a person) or 'powerbi' (a sync). */
  source: string;
  rows: Record<string, any>[];
  /**
   * If true, every row from this `source` is deleted before inserting, making
   * re-syncs idempotent (used for the Power BI principals pull). Defaults to
   * append-only so custom uploads accumulate.
   */
  replaceSource?: boolean;
  /** 'append' (default) just inserts; 'upsert' updates rows matching `keys`. */
  mode?: 'append' | 'upsert';
  /** Business-key column names (original or sanitised) for upsert dedup. */
  keys?: string[];
}

export interface UploadResult {
  table: string;
  kind: string;
  label: string;
  rowsWritten: number;
  columns: DynamicColumn[];
  totalRows: number;
}

@Injectable()
export class DynamicTableService {
  private readonly logger = new Logger(DynamicTableService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Build a safe, prefixed table name from a free-text label. */
  tableNameFor(prefix: string, label: string): string {
    return slugifyIdent(`${prefix}_${label}`, `${prefix}_unnamed`);
  }

  /** Tables the app manages internally and must not be overwritten by a user. */
  private static RESERVED = new Set([
    'dynamic_datasets',
    'sync_runs',
  ]);

  /**
   * Sanitise a user-supplied table name into a safe Postgres identifier and
   * reject names that would collide with the app's own bookkeeping tables.
   */
  sanitizeTableName(raw: string): string {
    const name = slugifyIdent(raw, '');
    if (!name) {
      throw new Error('Table name is empty after sanitising.');
    }
    if (DynamicTableService.RESERVED.has(name)) {
      throw new Error(`"${name}" is reserved; choose another table name.`);
    }
    return name;
  }

  /** Union of all keys across rows, each mapped to a safe column + inferred type. */
  private deriveColumns(rows: Record<string, any>[]): DynamicColumn[] {
    const originalKeys: string[] = [];
    for (const r of rows) {
      for (const k of Object.keys(r ?? {})) {
        if (!originalKeys.includes(k)) originalKeys.push(k);
      }
    }
    const used = new Set<string>();
    return originalKeys.map((key) => {
      let name = slugifyIdent(key);
      // Reserved meta columns / collisions get suffixed.
      let candidate = name;
      let i = 2;
      while (used.has(candidate) || candidate.startsWith('_meta')) {
        candidate = `${name}_${i++}`;
      }
      used.add(candidate);
      return {
        original: key,
        name: candidate,
        type: inferColumnType(rows.map((r) => r?.[key])),
      };
    });
  }

  private async ensureRegistry(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS dynamic_datasets (
        id bigserial PRIMARY KEY,
        kind text NOT NULL,
        label text NOT NULL,
        table_name text NOT NULL UNIQUE,
        owner text,
        columns jsonb,
        last_rows integer,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  private async ensureTable(
    table: string,
    columns: DynamicColumn[],
  ): Promise<void> {
    const t = ident(table);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${t} (
        _id bigserial PRIMARY KEY,
        _owner text,
        _source text,
        _uploaded_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    // Add any newly-seen columns. IF NOT EXISTS makes this safe to repeat.
    for (const c of columns) {
      await this.pool.query(
        `ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS ${ident(c.name)} ${TYPE_SQL[c.type]};`,
      );
    }
  }

  private async rowCount(table: string): Promise<number> {
    const { rows } = await this.pool.query(
      `SELECT count(*)::int AS n FROM ${ident(table)}`,
    );
    return rows[0]?.n ?? 0;
  }

  /**
   * The one entry point: ensure the table fits the rows, (optionally clear the
   * source), insert, and record the dataset in the registry.
   */
  async upload(input: UploadInput): Promise<UploadResult> {
    const rows = Array.isArray(input.rows) ? input.rows : [];
    const columns = this.deriveColumns(rows);

    await this.ensureRegistry();
    await this.ensureTable(input.table, columns);

    if (input.replaceSource) {
      await this.pool.query(
        `DELETE FROM ${ident(input.table)} WHERE _source = $1`,
        [input.source],
      );
    }

    // Resolve business keys (original or sanitised names) to column names.
    const keyCols =
      input.mode === 'upsert'
        ? (input.keys ?? [])
            .map((k) => {
              const col = columns.find(
                (c) => c.original === k || c.name === k,
              );
              return col?.name;
            })
            .filter((n): n is string => !!n)
        : [];
    if (input.mode === 'upsert' && keyCols.length === 0) {
      throw new Error('Upsert mode requires at least one valid business key.');
    }

    let workRows = rows;
    if (input.mode === 'upsert' && keyCols.length > 0) {
      await this.ensureUniqueIndex(input.table, keyCols);
      workRows = this.dedupeByKeys(rows, columns, keyCols);
    }

    let written = 0;
    if (workRows.length > 0) {
      const colNames = ['_owner', '_source', ...columns.map((c) => c.name)];
      const colSql = colNames.map(ident).join(', ');
      const values: any[] = [];
      const tuples: string[] = [];
      let p = 1;
      for (const row of workRows) {
        const ph: string[] = [];
        values.push(input.owner ?? null);
        ph.push(`$${p++}`);
        values.push(input.source);
        ph.push(`$${p++}`);
        for (const c of columns) {
          values.push(coerce(row?.[c.original], c.type));
          ph.push(`$${p++}`);
        }
        tuples.push(`(${ph.join(', ')})`);
      }

      let conflict = '';
      if (input.mode === 'upsert' && keyCols.length > 0) {
        const updateCols = columns
          .map((c) => c.name)
          .filter((n) => !keyCols.includes(n));
        const setSql = [
          ...updateCols.map((n) => `${ident(n)} = EXCLUDED.${ident(n)}`),
          `"_owner" = EXCLUDED."_owner"`,
          `"_source" = EXCLUDED."_source"`,
          `"_uploaded_at" = now()`,
        ].join(', ');
        conflict = ` ON CONFLICT (${keyCols
          .map(ident)
          .join(', ')}) DO UPDATE SET ${setSql}`;
      }

      await this.pool.query(
        `INSERT INTO ${ident(input.table)} (${colSql}) VALUES ${tuples.join(', ')}${conflict}`,
        values,
      );
      written = workRows.length;
    }

    const total = await this.rowCount(input.table);
    await this.pool.query(
      `INSERT INTO dynamic_datasets (kind, label, table_name, owner, columns, last_rows, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6, now())
       ON CONFLICT (table_name) DO UPDATE SET
         kind = EXCLUDED.kind,
         label = EXCLUDED.label,
         owner = EXCLUDED.owner,
         columns = EXCLUDED.columns,
         last_rows = EXCLUDED.last_rows,
         updated_at = now()`,
      [
        input.kind,
        input.label,
        input.table,
        input.owner ?? null,
        JSON.stringify(columns),
        total,
      ],
    );

    this.logger.log(
      `Uploaded ${written} row(s) into ${input.table} (now ${total} total).`,
    );
    return {
      table: input.table,
      kind: input.kind,
      label: input.label,
      rowsWritten: written,
      columns,
      totalRows: total,
    };
  }

  /** Ensure a unique index on the key columns so ON CONFLICT can target them. */
  private async ensureUniqueIndex(
    table: string,
    keyCols: string[],
  ): Promise<void> {
    const idxName = `ux_${table}`.slice(0, 60);
    await this.pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${ident(idxName)} ON ${ident(table)} (${keyCols
        .map(ident)
        .join(', ')})`,
    );
  }

  /** Keep only the last row per key within a batch (ON CONFLICT can't hit a key twice). */
  private dedupeByKeys(
    rows: Record<string, any>[],
    columns: DynamicColumn[],
    keyCols: string[],
  ): Record<string, any>[] {
    const originalsForKey = keyCols.map(
      (kc) => columns.find((c) => c.name === kc)?.original ?? kc,
    );
    const byKey = new Map<string, Record<string, any>>();
    for (const row of rows) {
      const k = originalsForKey.map((o) => String(row?.[o] ?? '')).join('');
      byKey.set(k, row);
    }
    return Array.from(byKey.values());
  }

  /** Export a dynamic table as CSV text (only tables we created). */
  async exportCsv(table: string): Promise<string> {
    await this.ensureRegistry();
    const { rows: known } = await this.pool.query(
      `SELECT 1 FROM dynamic_datasets WHERE table_name = $1`,
      [table],
    );
    if (known.length === 0) {
      throw new Error(`Unknown dynamic table: ${table}`);
    }
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ident(table)} ORDER BY _id`,
    );
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const esc = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(',')];
    for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(','));
    return lines.join('\n');
  }

  /** List every dynamically-created dataset for the UI. */
  async listDatasets(): Promise<any[]> {
    await this.ensureRegistry();
    const { rows } = await this.pool.query(
      `SELECT kind, label, table_name, owner, columns, last_rows, updated_at
         FROM dynamic_datasets
        ORDER BY updated_at DESC`,
    );
    return rows;
  }

  /** Preview rows from a dynamic table (only tables we created). */
  async previewRows(table: string, limit = 100): Promise<any[]> {
    await this.ensureRegistry();
    const { rows: known } = await this.pool.query(
      `SELECT 1 FROM dynamic_datasets WHERE table_name = $1`,
      [table],
    );
    if (known.length === 0) {
      throw new Error(`Unknown dynamic table: ${table}`);
    }
    const lim = Math.min(Math.max(parseInt(String(limit), 10) || 100, 1), 1000);
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ident(table)} ORDER BY _uploaded_at DESC, _id DESC LIMIT $1`,
      [lim],
    );
    return rows;
  }
}
