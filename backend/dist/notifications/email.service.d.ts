import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
export interface EmailLogEntry {
    id?: number;
    recipients: string;
    subject: string;
    file_name?: string;
    file_size_bytes?: number;
    status: string;
    preview_url?: string;
    error?: string;
    sent_at?: Date;
}
export interface SmtpConfigDto {
    host: string;
    port: number;
    username: string;
    password?: string;
    fromAddress?: string;
}
export declare class EmailService {
    private configService;
    private readonly pool?;
    private readonly logger;
    private smtpTransporter;
    private currentFromAddress;
    constructor(configService: ConfigService, pool?: Pool | undefined);
    ensureTables(): Promise<void>;
    private initTransporter;
    getSmtpConfig(): Promise<{
        host: string;
        port: number;
        username: string;
        fromAddress: string;
        isConfigured: boolean;
    }>;
    saveSmtpConfig(dto: SmtpConfigDto): Promise<{
        ok: boolean;
        message: string;
    }>;
    sendReport(recipients: string[], subject: string, excelBuffer: Buffer, fileName: string): Promise<{
        status: string;
        previewUrl?: string;
    }>;
    private logEmailHistory;
    getEmailHistory(): Promise<EmailLogEntry[]>;
}
