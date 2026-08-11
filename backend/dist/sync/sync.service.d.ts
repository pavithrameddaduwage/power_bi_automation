import { PowerBiService } from '../powerbi/powerbi.service';
import { UpsertService } from '../db/upsert.service';
export interface SyncResult {
    request: string;
    targetTable: string;
    snapshotDate: string;
    rowsWritten: number;
    dashboard: string;
    datasetId: string;
}
export declare class SyncService {
    private readonly powerbi;
    private readonly upsert;
    private readonly logger;
    constructor(powerbi: PowerBiService, upsert: UpsertService);
    private currentSnapshotDate;
    syncOne(request: string): Promise<SyncResult>;
    syncAll(): Promise<{
        results: SyncResult[];
        errors: string[];
    }>;
    private runEntry;
}
