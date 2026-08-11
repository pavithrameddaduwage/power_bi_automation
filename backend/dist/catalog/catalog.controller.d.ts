import { PowerBiService } from '../powerbi/powerbi.service';
export declare class CatalogController {
    private readonly powerbi;
    constructor(powerbi: PowerBiService);
    dashboards(): Promise<import("../powerbi/powerbi.service").PbiDashboard[]>;
    reports(downloadableOnly?: string): Promise<import("../powerbi/powerbi.service").PbiReportWithAccess[]>;
    columns(datasetId: string, finalOnly?: string): Promise<{
        table: string;
        name: string;
        dataType: string;
        isKey: boolean;
    }[]>;
    private isSourceTable;
    measures(datasetId: string): Promise<{
        table: string;
        name: string;
        dataType: string;
    }[]>;
    data(body: {
        datasetId: string;
        table?: string;
        tables?: string[];
        columns: string[];
        measures?: string[];
        limit?: number;
        dateColumn?: string;
        dateFrom?: string;
        dateTo?: string;
    }): never[] | Promise<Record<string, any>[]>;
}
