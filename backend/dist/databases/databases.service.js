"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DatabasesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabasesService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const database_module_1 = require("../db/database.module");
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
let DatabasesService = DatabasesService_1 = class DatabasesService {
    constructor(primaryPool) {
        this.primaryPool = primaryPool;
        this.logger = new common_1.Logger(DatabasesService_1.name);
        this.poolCache = new Map();
        this.activePool = null;
        this.activeId = null;
    }
    async onModuleDestroy() {
        for (const p of this.poolCache.values()) {
            await p.end().catch(() => { });
        }
    }
    async ensureRegistry() {
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
    async list() {
        await this.ensureRegistry();
        const { rows } = await this.primaryPool.query(`SELECT id, label, host, port, dbname, username, is_active, created_at
         FROM target_databases
        ORDER BY created_at`);
        return rows;
    }
    async testConnection(dto) {
        const client = new pg_1.Client({
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
        }
        catch (err) {
            return { ok: false, error: err?.message ?? String(err) };
        }
        finally {
            await client.end().catch(() => { });
        }
    }
    async createAndRegister(dto) {
        const port = dto.port ?? 5432;
        await this.createDatabaseIfAbsent(dto.host, port, dto.username, dto.password, dto.dbname);
        await this.bootstrapSchema(dto.host, port, dto.dbname, dto.username, dto.password);
        await this.ensureRegistry();
        const { rows } = await this.primaryPool.query(`INSERT INTO target_databases (label, host, port, dbname, username, password, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING id, label, host, port, dbname, username, is_active, created_at`, [dto.label || `${dto.host}:${port}/${dto.dbname}`, dto.host, port, dto.dbname, dto.username, dto.password]);
        const saved = rows[0];
        await this.activate(saved.id);
        return { ...saved, is_active: true };
    }
    async activate(id) {
        await this.ensureRegistry();
        const { rows } = await this.primaryPool.query(`SELECT id, host, port, dbname, username, password FROM target_databases WHERE id = $1`, [id]);
        if (!rows.length)
            throw new common_1.BadRequestException(`No DB connection with id ${id}`);
        const row = rows[0];
        await this.primaryPool.query(`UPDATE target_databases SET is_active = false`);
        await this.primaryPool.query(`UPDATE target_databases SET is_active = true WHERE id = $1`, [id]);
        if (!this.poolCache.has(id)) {
            this.poolCache.set(id, new pg_1.Pool({
                host: row.host,
                port: row.port,
                database: row.dbname,
                user: row.username,
                password: row.password,
                max: 10,
            }));
        }
        this.activePool = this.poolCache.get(id);
        this.activeId = id;
        this.logger.log(`Active DB switched to id=${id} (${row.host}:${row.port}/${row.dbname})`);
    }
    async deactivate(id) {
        await this.ensureRegistry();
        await this.primaryPool.query(`UPDATE target_databases SET is_active = false WHERE id = $1`, [id]);
        if (this.activeId === id) {
            this.activePool = null;
            this.activeId = null;
        }
    }
    async remove(id) {
        await this.ensureRegistry();
        if (this.activeId === id) {
            this.activePool = null;
            this.activeId = null;
        }
        const pool = this.poolCache.get(id);
        if (pool) {
            await pool.end().catch(() => { });
            this.poolCache.delete(id);
        }
        await this.primaryPool.query(`DELETE FROM target_databases WHERE id = $1`, [id]);
    }
    async getActivePool() {
        if (!this.activePool) {
            await this.ensureRegistry();
            const { rows } = await this.primaryPool.query(`SELECT id, host, port, dbname, username, password
           FROM target_databases
          WHERE is_active = true
          LIMIT 1`);
            if (rows.length) {
                const r = rows[0];
                const pool = new pg_1.Pool({
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
    async createDatabaseIfAbsent(host, port, user, password, dbname) {
        const client = new pg_1.Client({
            host,
            port,
            database: 'postgres',
            user,
            password,
            connectionTimeoutMillis: 8000,
        });
        try {
            await client.connect();
            const { rows } = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbname]);
            if (rows.length === 0) {
                const safe = dbname.replace(/[^a-zA-Z0-9_]/g, '_');
                await client.query(`CREATE DATABASE "${safe}"`);
                this.logger.log(`Created database "${safe}" on ${host}:${port}`);
            }
            else {
                this.logger.log(`Database "${dbname}" already exists on ${host}:${port}`);
            }
        }
        finally {
            await client.end().catch(() => { });
        }
    }
    async bootstrapSchema(host, port, dbname, user, password) {
        const client = new pg_1.Client({ host, port, database: dbname, user, password, connectionTimeoutMillis: 8000 });
        try {
            await client.connect();
            await client.query(BOOTSTRAP_DDL);
            this.logger.log(`Schema bootstrapped in ${host}:${port}/${dbname}`);
        }
        finally {
            await client.end().catch(() => { });
        }
    }
};
exports.DatabasesService = DatabasesService;
exports.DatabasesService = DatabasesService = DatabasesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [pg_1.Pool])
], DatabasesService);
//# sourceMappingURL=databases.service.js.map