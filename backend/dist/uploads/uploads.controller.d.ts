import { Response } from 'express';
import { UploadsService, UploadReportDto, UploadPrincipalsDto } from './uploads.service';
export declare class UploadsController {
    private readonly uploads;
    constructor(uploads: UploadsService);
    uploadReport(dto: UploadReportDto): Promise<import("../db/dynamic-table.service").UploadResult>;
    uploadPrincipals(dto: UploadPrincipalsDto): Promise<import("../db/dynamic-table.service").UploadResult>;
    syncPrincipals(): Promise<import("../db/dynamic-table.service").UploadResult>;
    datasets(): Promise<any[]>;
    rows(table: string, limit?: string): Promise<any[]>;
    lastSync(table: string): Promise<{
        lastSyncAt: string | null;
    }>;
    emailDataset(table: string, body: {
        recipients: string[];
        subject: string;
    }): Promise<void>;
    emailHistory(): Promise<import("../notifications/email.service").EmailLogEntry[]>;
    smtpConfig(): Promise<{
        host: string;
        port: number;
        username: string;
        fromAddress: string;
        isConfigured: boolean;
    }>;
    saveSmtpConfig(body: any): Promise<{
        ok: boolean;
        message: string;
    }>;
    sendEmailReport(body: {
        reportName: string;
        rows: any[];
        recipients: string[];
        subject?: string;
    }): Promise<{
        ok: boolean;
        count: number;
    }>;
    exportExcel(body: {
        reportName?: string;
        rows: any[];
    }, res: Response): Promise<void>;
    export(table: string, res: Response): Promise<void>;
}
