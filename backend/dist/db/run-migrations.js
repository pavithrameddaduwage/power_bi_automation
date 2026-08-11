"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const dotenv = __importStar(require("dotenv"));
const pg_1 = require("pg");
const report_map_config_1 = require("../sync/report-map.config");
dotenv.config();
const PG_TYPE_SQL = {
    text: 'text',
    numeric: 'numeric',
    integer: 'integer',
    boolean: 'boolean',
    timestamp: 'timestamptz',
    date: 'date',
};
const SAFE = /^[a-z_][a-z0-9_]*$/;
const id = (n) => {
    if (!SAFE.test(n))
        throw new Error(`Unsafe identifier: ${n}`);
    return `"${n}"`;
};
async function main() {
    const pool = new pg_1.Pool({
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
    for (const e of report_map_config_1.REPORT_MAP) {
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
//# sourceMappingURL=run-migrations.js.map