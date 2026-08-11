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
var DynamicTableService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicTableService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const database_module_1 = require("./database.module");
const databases_service_1 = require("../databases/databases.service");
const TYPE_SQL = {
    text: 'text',
    numeric: 'numeric',
    integer: 'bigint',
    boolean: 'boolean',
    timestamptz: 'timestamptz',
};
const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/;
function ident(name) {
    if (!SAFE_IDENT.test(name)) {
        throw new Error(`Unsafe SQL identifier: "${name}"`);
    }
    return `"${name}"`;
}
function slugifyIdent(raw, fallback = 'col') {
    let s = (raw ?? '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    if (!s)
        s = fallback;
    if (/^[0-9]/.test(s))
        s = '_' + s;
    return s.slice(0, 60);
}
function inferColumnType(values) {
    const present = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    if (present.length === 0)
        return 'text';
    const isBool = (v) => typeof v === 'boolean' || /^(true|false)$/i.test(String(v));
    const hasLeadingZero = (s) => /^0\d+/.test(s);
    const isInt = (v) => {
        const s = String(v).trim();
        if (hasLeadingZero(s))
            return false;
        if (!/^-?\d+$/.test(s))
            return false;
        const n = Number(s);
        return n >= -2147483648 && n <= 2147483647;
    };
    const isNum = (v) => {
        const s = String(v).trim();
        if (hasLeadingZero(s))
            return false;
        return s !== '' && !isNaN(Number(s));
    };
    const isDate = (v) => /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?/.test(String(v).trim()) &&
        !isNaN(Date.parse(String(v)));
    if (present.every(isBool))
        return 'boolean';
    if (present.every(isInt))
        return 'integer';
    if (present.every(isNum))
        return 'numeric';
    if (present.every(isDate))
        return 'timestamptz';
    return 'text';
}
function coerce(value, type) {
    if (value === undefined || value === '')
        return null;
    if (value === null)
        return null;
    if (type === 'boolean') {
        if (typeof value === 'boolean')
            return value;
        return /^true$/i.test(String(value));
    }
    return value;
}
let DynamicTableService = DynamicTableService_1 = class DynamicTableService {
    constructor(primaryPool, dbs) {
        this.primaryPool = primaryPool;
        this.dbs = dbs;
        this.logger = new common_1.Logger(DynamicTableService_1.name);
    }
    async pool() {
        if (this.dbs)
            return this.dbs.getActivePool();
        return this.primaryPool;
    }
    tableNameFor(prefix, label) {
        return slugifyIdent(`${prefix}_${label}`, `${prefix}_unnamed`);
    }
    sanitizeTableName(raw) {
        const name = slugifyIdent(raw, '');
        if (!name) {
            throw new Error('Table name is empty after sanitising.');
        }
        if (DynamicTableService_1.RESERVED.has(name)) {
            throw new Error(`"${name}" is reserved; choose another table name.`);
        }
        return name;
    }
    deriveColumns(rows) {
        const originalKeys = [];
        for (const r of rows) {
            for (const k of Object.keys(r ?? {})) {
                if (!originalKeys.includes(k))
                    originalKeys.push(k);
            }
        }
        const used = new Set();
        return originalKeys.map((key) => {
            let name = slugifyIdent(key);
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
    async ensureRegistry() {
        const pool = await this.pool();
        await pool.query(`
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
    `);
        await pool.query(`ALTER TABLE dynamic_datasets ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false`);
    }
    async isLocked(table) {
        await this.ensureRegistry();
        const pool = await this.pool();
        const { rows } = await pool.query(`SELECT locked FROM dynamic_datasets WHERE table_name = $1`, [table]);
        return rows[0]?.locked === true;
    }
    async tableExists(table) {
        const pool = await this.pool();
        const { rows } = await pool.query(`SELECT to_regclass($1) AS r`, [
            `public.${table}`,
        ]);
        return rows[0]?.r != null;
    }
    async columnExists(table, col) {
        const pool = await this.pool();
        const { rows } = await pool.query(`SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`, [table, col]);
        return rows.length > 0;
    }
    async ensureTable(table, columns, keyCols = []) {
        const t = ident(table);
        const pool = await this.pool();
        if (keyCols.length > 0) {
            const colDefs = columns
                .map((c) => `${ident(c.name)} ${TYPE_SQL[c.type]}${keyCols.includes(c.name) ? ' NOT NULL' : ''}`)
                .join(',\n        ');
            await pool.query(`
        CREATE TABLE IF NOT EXISTS ${t} (
        _owner text,
        _source text,
        _uploaded_at timestamptz NOT NULL DEFAULT now(),
        ${colDefs},
        PRIMARY KEY (${keyCols.map(ident).join(', ')})
        );
      `);
        }
        else {
            await pool.query(`
        CREATE TABLE IF NOT EXISTS ${t} (
          _id bigserial PRIMARY KEY,
          _owner text,
          _source text,
          _uploaded_at timestamptz NOT NULL DEFAULT now()
        );
      `);
        }
        for (const c of columns) {
            await pool.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS ${ident(c.name)} ${TYPE_SQL[c.type]};`);
            if (c.type === 'text') {
                try {
                    await pool.query(`ALTER TABLE ${t} ALTER COLUMN ${ident(c.name)} TYPE text USING ${ident(c.name)}::text;`);
                }
                catch (e) {
                }
            }
        }
    }
    async rowCount(table) {
        const pool = await this.pool();
        const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${ident(table)}`);
        return rows[0]?.n ?? 0;
    }
    async upload(input) {
        const rows = Array.isArray(input.rows) ? input.rows : [];
        const columns = this.deriveColumns(rows);
        const keyCols = input.mode === 'upsert'
            ? (input.keys ?? [])
                .map((k) => {
                const col = columns.find((c) => c.original === k || c.name === k);
                return col?.name;
            })
                .filter((n) => !!n)
            : [];
        if (input.mode === 'upsert' && keyCols.length === 0) {
            throw new Error('Upsert mode requires at least one valid business key.');
        }
        await this.ensureRegistry();
        const existed = await this.tableExists(input.table);
        await this.ensureTable(input.table, columns, existed ? [] : keyCols);
        if (input.mode === 'upsert' && keyCols.length > 0 && existed) {
            if (await this.columnExists(input.table, '_id')) {
                await this.ensureUniqueIndex(input.table, keyCols);
            }
        }
        if (input.replaceSource) {
            const pool = await this.pool();
            await pool.query(`DELETE FROM ${ident(input.table)} WHERE _source = $1`, [input.source]);
        }
        let workRows = rows;
        if (input.mode === 'upsert' && keyCols.length > 0) {
            workRows = this.dedupeByKeys(rows, columns, keyCols);
        }
        let written = 0;
        if (workRows.length > 0) {
            const colNames = ['_owner', '_source', ...columns.map((c) => c.name)];
            const colSql = colNames.map(ident).join(', ');
            const perRow = colNames.length;
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
            const batchSize = Math.max(1, Math.floor(60000 / perRow));
            for (let start = 0; start < workRows.length; start += batchSize) {
                const batch = workRows.slice(start, start + batchSize);
                const values = [];
                const tuples = [];
                let p = 1;
                for (const row of batch) {
                    const ph = [];
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
                const pool = await this.pool();
                try {
                    await pool.query(`INSERT INTO ${ident(input.table)} (${colSql}) VALUES ${tuples.join(', ')}${conflict}`, values);
                }
                catch (insertErr) {
                    if (insertErr.message &&
                        (/out of range for type/i.test(insertErr.message) ||
                            /invalid input syntax for type/i.test(insertErr.message) ||
                            /numeric field overflow/i.test(insertErr.message))) {
                        this.logger.warn(`Data type mismatch/overflow on ${input.table}: ${insertErr.message}. Automatically widening table columns to text...`);
                        await this.widenTableColumnsToText(input.table, columns);
                        await pool.query(`INSERT INTO ${ident(input.table)} (${colSql}) VALUES ${tuples.join(', ')}${conflict}`, values);
                    }
                    else {
                        throw insertErr;
                    }
                }
            }
            written = workRows.length;
        }
        const lockedNow = !existed && keyCols.length > 0;
        const total = await this.rowCount(input.table);
        const pool = await this.pool();
        await pool.query(`INSERT INTO dynamic_datasets (kind, label, table_name, owner, columns, last_rows, locked, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now())
       ON CONFLICT (table_name) DO UPDATE SET
         kind = EXCLUDED.kind,
         label = EXCLUDED.label,
         owner = EXCLUDED.owner,
         columns = EXCLUDED.columns,
         last_rows = EXCLUDED.last_rows,
         locked = dynamic_datasets.locked OR EXCLUDED.locked,
         updated_at = now()`, [
            input.kind,
            input.label,
            input.table,
            input.owner ?? null,
            JSON.stringify(columns),
            total,
            lockedNow,
        ]);
        this.logger.log(`Uploaded ${written} row(s) into ${input.table} (now ${total} total).`);
        return {
            table: input.table,
            kind: input.kind,
            label: input.label,
            rowsWritten: written,
            columns,
            totalRows: total,
        };
    }
    async widenTableColumnsToText(table, columns) {
        const pool = await this.pool();
        const t = ident(table);
        for (const c of columns) {
            try {
                await pool.query(`ALTER TABLE ${t} ALTER COLUMN ${ident(c.name)} TYPE text USING ${ident(c.name)}::text;`);
            }
            catch (e) {
            }
        }
    }
    async ensureUniqueIndex(table, keyCols) {
        const idxName = `ux_${table}`.slice(0, 60);
        const pool = await this.pool();
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${ident(idxName)} ON ${ident(table)} (${keyCols
            .map(ident)
            .join(', ')})`);
    }
    dedupeByKeys(rows, columns, keyCols) {
        const originalsForKey = keyCols.map((kc) => columns.find((c) => c.name === kc)?.original ?? kc);
        const byKey = new Map();
        for (const row of rows) {
            const k = originalsForKey.map((o) => String(row?.[o] ?? '')).join('');
            byKey.set(k, row);
        }
        return Array.from(byKey.values());
    }
    async exportCsv(table) {
        await this.ensureRegistry();
        const pool = await this.pool();
        const { rows: known } = await pool.query(`SELECT 1 FROM dynamic_datasets WHERE table_name = $1`, [table]);
        if (known.length === 0) {
            throw new Error(`Unknown dynamic table: ${table}`);
        }
        const { rows } = await pool.query(`SELECT * FROM ${ident(table)} ORDER BY _uploaded_at`);
        if (rows.length === 0)
            return '';
        const headers = Object.keys(rows[0]);
        const esc = (v) => {
            if (v === null || v === undefined)
                return '';
            const s = String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const lines = [headers.join(',')];
        for (const r of rows)
            lines.push(headers.map((h) => esc(r[h])).join(','));
        return lines.join('\n');
    }
    async listDatasets() {
        await this.ensureRegistry();
        const pool = await this.pool();
        const { rows } = await pool.query(`SELECT kind, label, table_name, owner, columns, last_rows, locked, updated_at
         FROM dynamic_datasets
        ORDER BY updated_at DESC`);
        return rows;
    }
    async previewRows(table, limit = 100) {
        await this.ensureRegistry();
        const pool = await this.pool();
        const { rows: known } = await pool.query(`SELECT 1 FROM dynamic_datasets WHERE table_name = $1`, [table]);
        if (known.length === 0) {
            throw new Error(`Unknown dynamic table: ${table}`);
        }
        const lim = Math.min(Math.max(parseInt(String(limit), 10) || 100, 1), 1000);
        const { rows } = await pool.query(`SELECT * FROM ${ident(table)} ORDER BY _uploaded_at DESC LIMIT $1`, [lim]);
        return rows;
    }
    async getLastSyncAt(table) {
        const pool = await this.pool();
        try {
            const { rows } = await pool.query(`SELECT MAX(_uploaded_at) AS last_at FROM ${ident(table)}`);
            return rows[0]?.last_at ?? null;
        }
        catch {
            return null;
        }
    }
};
exports.DynamicTableService = DynamicTableService;
DynamicTableService.RESERVED = new Set([
    'dynamic_datasets',
    'sync_runs',
]);
exports.DynamicTableService = DynamicTableService = DynamicTableService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [pg_1.Pool,
        databases_service_1.DatabasesService])
], DynamicTableService);
//# sourceMappingURL=dynamic-table.service.js.map