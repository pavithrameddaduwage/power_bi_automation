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
var UpsertService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpsertService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const database_module_1 = require("./database.module");
const PG_TYPE_SQL = {
    text: 'text',
    numeric: 'numeric',
    integer: 'integer',
    boolean: 'boolean',
    timestamp: 'timestamptz',
    date: 'date',
};
const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/;
function ident(name) {
    if (!SAFE_IDENT.test(name)) {
        throw new Error(`Unsafe SQL identifier: "${name}"`);
    }
    return `"${name}"`;
}
let UpsertService = UpsertService_1 = class UpsertService {
    constructor(pool) {
        this.pool = pool;
        this.logger = new common_1.Logger(UpsertService_1.name);
    }
    async ensureTable(entry) {
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
    async upsertRows(entry, rows, snapshotDate) {
        if (rows.length === 0)
            return 0;
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
        const values = [];
        const tuples = [];
        let p = 1;
        for (const row of rows) {
            const placeholders = [];
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
        this.logger.log(`Upserted ${rows.length} rows into ${entry.targetTable} for snapshot ${snapshotDate}.`);
        return rows.length;
    }
    async ensureSyncLogTable() {
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
    async logRun(run) {
        await this.pool.query(`INSERT INTO sync_runs
         (request, target_table, snapshot_date, rows_written, status, error, finished_at)
       VALUES ($1,$2,$3,$4,$5,$6, now())`, [
            run.request,
            run.targetTable ?? null,
            run.snapshotDate ?? null,
            run.rowsWritten ?? null,
            run.status,
            run.error ?? null,
        ]);
    }
    async recentRuns(limit = 50) {
        const { rows } = await this.pool.query(`SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT $1`, [limit]);
        return rows;
    }
};
exports.UpsertService = UpsertService;
exports.UpsertService = UpsertService = UpsertService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [pg_1.Pool])
], UpsertService);
//# sourceMappingURL=upsert.service.js.map