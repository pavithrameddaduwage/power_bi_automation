import { Pool } from 'pg';
import { ReportMapEntry } from '../sync/report-map.config';
export declare class UpsertService {
    private readonly pool;
    private readonly logger;
    constructor(pool: Pool);
    ensureTable(entry: ReportMapEntry): Promise<void>;
    upsertRows(entry: ReportMapEntry, rows: Record<string, any>[], snapshotDate: string): Promise<number>;
    ensureSyncLogTable(): Promise<void>;
    logRun(run: {
        request: string;
        targetTable?: string;
        snapshotDate?: string;
        rowsWritten?: number;
        status: 'success' | 'error';
        error?: string;
    }): Promise<void>;
    recentRuns(limit?: number): Promise<any[]>;
}
