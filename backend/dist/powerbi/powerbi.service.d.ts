import { PowerBiAuthService } from '../auth/powerbi-auth.service';
export interface PbiGroup {
    id: string;
    name: string;
}
export interface PbiDashboard {
    id: string;
    displayName: string;
    groupId: string;
    groupName: string;
}
export interface PbiTile {
    id: string;
    title?: string;
    reportId?: string;
    datasetId?: string;
}
export interface ResolvedReportSource {
    groupId: string;
    groupName: string;
    dashboardId: string;
    dashboardName: string;
    datasetId: string;
}
export interface PbiAccessEntry {
    name: string;
    email: string;
    role: string;
    principalType: string;
    canDownload: boolean;
}
export interface PbiReportWithAccess {
    id: string;
    name: string;
    reportType: string;
    webUrl?: string;
    datasetId?: string;
    workspaceId: string;
    workspaceName: string;
    downloadable: boolean;
    access: PbiAccessEntry[];
}
export interface PbiWorkspaceUser {
    workspace_id: string;
    workspace_name: string;
    display_name: string;
    email: string;
    role: string;
    principal_type: string;
    can_download: boolean;
}
export interface DataFilter {
    dateColumn?: string;
    dateFrom?: string;
    dateTo?: string;
}
export declare class PowerBiService {
    private readonly auth;
    private readonly logger;
    constructor(auth: PowerBiAuthService);
    private client;
    listGroups(): Promise<PbiGroup[]>;
    listAllDashboards(): Promise<PbiDashboard[]>;
    listGroupUsers(groupId: string): Promise<PbiAccessEntry[]>;
    reportsWithAccess(): Promise<PbiReportWithAccess[]>;
    allWorkspaceUsers(): Promise<PbiWorkspaceUser[]>;
    findDashboardByName(name: string): Promise<PbiDashboard | null>;
    getDashboardTiles(groupId: string, dashboardId: string): Promise<PbiTile[]>;
    resolveDatasetsForDashboard(dashboard: PbiDashboard): Promise<ResolvedReportSource[]>;
    listDatasetTables(groupId: string, datasetId: string): Promise<string[]>;
    executeQuery(groupId: string, datasetId: string, dax: string): Promise<Record<string, any>[]>;
    private cleanRows;
    executeQueryByDataset(datasetId: string, dax: string): Promise<Record<string, any>[]>;
    getDatasetColumns(datasetId: string): Promise<{
        table: string;
        name: string;
        dataType: string;
        isKey: boolean;
    }[]>;
    getDatasetMeasures(datasetId: string): Promise<{
        table: string;
        name: string;
        dataType: string;
    }[]>;
    private buildMeasureQuery;
    private daxDate;
    private buildProjection;
    getReportData(datasetId: string, table: string, columns: string[], limit?: number, filter?: DataFilter, measures?: string[]): Promise<Record<string, any>[]>;
    getReportDataMulti(datasetId: string, tables: string[], columns: string[], limit?: number, filter?: DataFilter, measures?: string[]): Promise<Record<string, any>[]>;
}
