export type PgType = 'text' | 'numeric' | 'integer' | 'boolean' | 'timestamp' | 'date';
export interface ColumnMap {
    source: string;
    target: string;
    type: PgType;
}
export interface ReportMapEntry {
    request: string;
    dashboardName: string;
    daxTable?: string;
    daxQuery?: string;
    targetTable: string;
    businessKeys: string[];
    columns: ColumnMap[];
}
export declare const REPORT_MAP: ReportMapEntry[];
export declare function findReportEntry(request: string): ReportMapEntry | undefined;
