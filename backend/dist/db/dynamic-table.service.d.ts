import { Pool } from 'pg';
import { DatabasesService } from '../databases/databases.service';
export type InferredType = 'text' | 'numeric' | 'integer' | 'boolean' | 'timestamptz';
export interface DynamicColumn {
    original: string;
    name: string;
    type: InferredType;
}
export interface UploadInput {
    label: string;
    table: string;
    kind: string;
    owner?: string;
    source: string;
    rows: Record<string, any>[];
    replaceSource?: boolean;
    mode?: 'append' | 'upsert';
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
export declare class DynamicTableService {
    private readonly primaryPool;
    private readonly dbs?;
    private readonly logger;
    constructor(primaryPool: Pool, dbs?: DatabasesService | undefined);
    private pool;
    tableNameFor(prefix: string, label: string): string;
    private static RESERVED;
    sanitizeTableName(raw: string): string;
    private deriveColumns;
    private ensureRegistry;
    isLocked(table: string): Promise<boolean>;
    private tableExists;
    private columnExists;
    private ensureTable;
    private rowCount;
    upload(input: UploadInput): Promise<UploadResult>;
    private widenTableColumnsToText;
    private ensureUniqueIndex;
    private dedupeByKeys;
    exportCsv(table: string): Promise<string>;
    listDatasets(): Promise<any[]>;
    previewRows(table: string, limit?: number): Promise<any[]>;
    getLastSyncAt(table: string): Promise<string | null>;
}
