import { Pool } from 'pg';
import { DynamicTableService, UploadResult } from '../db/dynamic-table.service';
import { UpsertService } from '../db/upsert.service';
import { PowerBiService } from '../powerbi/powerbi.service';
import { ExcelService } from '../exports/excel.service';
import { EmailService } from '../notifications/email.service';
export interface UploadReportDto {
    reportName: string;
    tableName?: string;
    owner?: string;
    mode?: 'append' | 'upsert';
    businessKeys?: string[];
    recipients?: string[];
    subject?: string;
    rows: Record<string, any>[];
}
export interface UploadPrincipalsDto {
    owner?: string;
    rows: Record<string, any>[];
}
export declare class UploadsService {
    private readonly dyn;
    private readonly powerbi;
    private readonly upsert;
    private readonly excelService;
    private readonly emailService;
    private readonly db;
    constructor(dyn: DynamicTableService, powerbi: PowerBiService, upsert: UpsertService, excelService: ExcelService, emailService: EmailService, db: Pool);
    emailDataset(table: string, recipients: string[], subject: string): Promise<void>;
    getEmailHistory(): Promise<import("../notifications/email.service").EmailLogEntry[]>;
    getSmtpConfig(): Promise<{
        host: string;
        port: number;
        username: string;
        fromAddress: string;
        isConfigured: boolean;
    }>;
    saveSmtpConfig(dto: any): Promise<{
        ok: boolean;
        message: string;
    }>;
    sendEmailReport(dto: {
        reportName: string;
        rows: any[];
        recipients: string[];
        subject?: string;
    }): Promise<{
        ok: boolean;
        count: number;
    }>;
    uploadReport(dto: UploadReportDto): Promise<UploadResult>;
    exportCsv(table: string): Promise<string>;
    uploadPrincipals(dto: UploadPrincipalsDto): Promise<UploadResult>;
    syncPrincipalsFromPowerBi(): Promise<UploadResult>;
    listDatasets(): Promise<any[]>;
    previewRows(table: string, limit?: number): Promise<any[]>;
    getLastSyncAt(table: string): Promise<string | null>;
}
