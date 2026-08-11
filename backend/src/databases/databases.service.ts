import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool, Client } from 'pg';
import { PG_POOL } from '../db/database.module';

export interface DbConnectionDto {
  label: string;
  host: string;
  port?: number;
  dbname: string;
  username: string;
  password: string;
}

export interface DbConnection {
  id: number;
  label: string;
  host: string;
  port: number;
  dbname: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

const BOOTSTRAP_DDL = `
  CREATE TABLE IF NOT EXISTS dynamic_datasets (
    id bigserial PRIMARY KEY,
    kind text NOT NULL,
    label text NOT NULL,
    table_name text NOT NULL UNIQUE,
    owner text,
    columns jsonb,
    last_rows integer,
    locked boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS sync_runs (
    id bigserial PRIMARY KEY,
    request text,
    target_table text,
    snapshot_date text,
    rows_written integer,
    status text NOT NULL DEFAULT 'pending',
    error text,
    started_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id bigserial PRIMARY KEY,
    name text NOT NULL,
    report_name text,
    dataset_id text NOT NULL,
    source_table text NOT NULL,
    columns jsonb NOT NULL DEFAULT '[]',
    measures jsonb NOT NULL DEFAULT '[]',
    target_table text NOT NULL,
    mode text NOT NULL DEFAULT 'append',
    business_keys jsonb,
    row_limit integer NOT NULL DEFAULT 0,
    owner text,
    cron text,
    enabled boolean NOT NULL DEFAULT true,
    date_column text,
    date_from text,
    date_to text,
    recipients text,
    email_subject text,
    last_run_at timestamptz,
    last_status text,
    last_rows integer,
    created_at timestamptz NOT NULL DEFAULT now()
  );
`;

@Injectable()
export class DatabasesService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabasesService.name);
  private readonly poolCache = new Map<number, Pool>();
  private activePool: Pool | null = null;
  private activeId: number | null = null;

  constructor(@Inject(PG_POOL) private readonly primaryPool: Pool) {}

  async onModuleDestroy() {
    for (const p of this.poolCache.values()) {
      await p.end().catch(() => {});
    }
  }

  // ── Schema bootstrap for internal registry table ──────────────────

  private async ensureRegistry(): Promise<void> {
    await this.primaryPool.query(`
      CREATE TABLE IF NOT EXISTS target_databases (
        id        bigserial PRIMARY KEY,
        label     text NOT NULL,
        host      text NOT NULL,
        port      integer NOT NULL DEFAULT 5432,
        dbname    text NOT NULL,
        username  text NOT NULL,
        password  text NOT NULL,
        is_active boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  // ── Public API ────────────────────────────────────────────────────

  /** List all saved connections (passwords redacted). */
  async list(): Promise<DbConnection[]> {
    await this.ensureRegistry();
    const { rows } = await this.primaryPool.query(
      `SELECT id, label, host, port, dbname, username, is_active, created_at
         FROM target_databases
        ORDER BY created_at`,
    );
    return rows;
  }

  /**
   * Test connectivity without saving anything.
   * Returns { ok: true } or { ok: false, error: string }.
   */
  async testConnection(
    dto: DbConnectionDto,
  ): Promise<{ ok: boolean; error?: string }> {
    const client = new Client({
      host: dto.host,
      port: dto.port ?? 5432,
      database: dto.dbname,
      user: dto.username,
      password: dto.password,
      connectionTimeoutMillis: 5000,
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? String(err) };
    } finally {
      await client.end().catch(() => {});
    }
  }

  /**
   * Connect to the target Postgres server, CREATE the database if it does
   * not exist, bootstrap the schema, save credentials, and activate.
   */
  async createAndRegister(dto: DbConnectionDto): Promise<DbConnection> {
    const port = dto.port ?? 5432;

    // Step 1 — connect to the built-in "postgres" DB on the target server to
    // create a new database (you can't CREATE DATABASE while connected to it).
    await this.createDatabaseIfAbsent(dto.host, port, dto.username, dto.password, dto.dbname);

    // Step 2 — connect to the newly created DB and bootstrap schema.
    await this.bootstrapSchema(dto.host, port, dto.dbname, dto.username, dto.password);

    // Step 3 — save to registry.
    await this.ensureRegistry();
    const { rows } = await this.primaryPool.query(
      `INSERT INTO target_databases (label, host, port, dbname, username, password, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING id, label, host, port, dbname, username, is_active, created_at`,
      [dto.label || `${dto.host}:${port}/${dto.dbname}`, dto.host, port, dto.dbname, dto.username, dto.password],
    );
    const saved: DbConnection = rows[0];

    // Step 4 — make it the active target.
    await this.activate(saved.id);
    return { ...saved, is_active: true };
  }

  /** Switch the active target database. */
  async activate(id: number): Promise<void> {
    await this.ensureRegistry();
    // Confirm it exists.
    const { rows } = await this.primaryPool.query(
      `SELECT id, host, port, dbname, username, password FROM target_databases WHERE id = $1`,
      [id],
    );
    if (!rows.length) throw new BadRequestException(`No DB connection with id ${id}`);
    const row = rows[0];

    // Flip active flag.
    await this.primaryPool.query(`UPDATE target_databases SET is_active = false`);
    await this.primaryPool.query(
      `UPDATE target_databases SET is_active = true WHERE id = $1`,
      [id],
    );

    // Build / reuse pool.
    if (!this.poolCache.has(id)) {
      this.poolCache.set(
        id,
        new Pool({
          host: row.host,
          port: row.port,
          database: row.dbname,
          user: row.username,
          password: row.password,
          max: 10,
        }),
      );
    }
    this.activePool = this.poolCache.get(id)!;
    this.activeId = id;
    this.logger.log(`Active DB switched to id=${id} (${row.host}:${row.port}/${row.dbname})`);
  }

  /** Deactivate — fall back to the primary pool. */
  async deactivate(id: number): Promise<void> {
    await this.ensureRegistry();
    await this.primaryPool.query(
      `UPDATE target_databases SET is_active = false WHERE id = $1`,
      [id],
    );
    if (this.activeId === id) {
      this.activePool = null;
      this.activeId = null;
    }
  }

  /** Delete a saved connection. */
  async remove(id: number): Promise<void> {
    await this.ensureRegistry();
    if (this.activeId === id) {
      this.activePool = null;
      this.activeId = null;
    }
    const pool = this.poolCache.get(id);
    if (pool) {
      await pool.end().catch(() => {});
      this.poolCache.delete(id);
    }
    await this.primaryPool.query(`DELETE FROM target_databases WHERE id = $1`, [id]);
  }

  /**
   * The pool all write operations should use.
   * Falls back to the primary pool when no external DB is active.
   */
  async getActivePool(): Promise<Pool> {
    // Lazy-load: if the server restarted, re-hydrate from the DB.
    if (!this.activePool) {
      await this.ensureRegistry();
      const { rows } = await this.primaryPool.query(
        `SELECT id, host, port, dbname, username, password
           FROM target_databases
          WHERE is_active = true
          LIMIT 1`,
      );
      if (rows.length) {
        const r = rows[0];
        const pool = new Pool({
          host: r.host,
          port: r.port,
          database: r.dbname,
          user: r.username,
          password: r.password,
          max: 10,
        });
        this.poolCache.set(r.id, pool);
        this.activePool = pool;
        this.activeId = r.id;
      }
    }
    return this.activePool ?? this.primaryPool;
  }

  // ── Private helpers ───────────────────────────────────────────────

  private async createDatabaseIfAbsent(
    host: string,
    port: number,
    user: string,
    password: string,
    dbname: string,
  ): Promise<void> {
    // Connect to "postgres" (always exists) on the target server.
    const client = new Client({
      host,
      port,
      database: 'postgres',
      user,
      password,
      connectionTimeoutMillis: 8000,
    });
    try {
      await client.connect();
      const { rows } = await client.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [dbname],
      );
      if (rows.length === 0) {
        // Database name cannot be parameterised — sanitise manually.
        const safe = dbname.replace(/[^a-zA-Z0-9_]/g, '_');
        await client.query(`CREATE DATABASE "${safe}"`);
        this.logger.log(`Created database "${safe}" on ${host}:${port}`);
      } else {
        this.logger.log(`Database "${dbname}" already exists on ${host}:${port}`);
      }
    } finally {
      await client.end().catch(() => {});
    }
  }

  private async bootstrapSchema(
    host: string,
    port: number,
    dbname: string,
    user: string,
    password: string,
  ): Promise<void> {
    const client = new Client({ host, port, database: dbname, user, password, connectionTimeoutMillis: 8000 });
    try {
      await client.connect();
      await client.query(BOOTSTRAP_DDL);
      this.logger.log(`Schema bootstrapped in ${host}:${port}/${dbname}`);
    } finally {
      await client.end().catch(() => {});
    }
  }
}
