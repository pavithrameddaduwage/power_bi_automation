import { SyncService } from './sync.service';
import { PowerBiService } from '../powerbi/powerbi.service';
import { UpsertService } from '../db/upsert.service';
export declare class SyncController {
    private readonly sync;
    private readonly powerbi;
    private readonly upsert;
    constructor(sync: SyncService, powerbi: PowerBiService, upsert: UpsertService);
    reports(): {
        request: string;
        dashboardName: string;
        targetTable: string;
        businessKeys: string[];
    }[];
    dashboards(): Promise<import("../powerbi/powerbi.service").PbiDashboard[]>;
    syncOne(request: string): Promise<import("./sync.service").SyncResult>;
    syncAll(): Promise<{
        results: import("./sync.service").SyncResult[];
        errors: string[];
    }>;
    runs(): Promise<any[]>;
}
