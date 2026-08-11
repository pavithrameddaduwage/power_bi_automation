import { OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Pool } from 'pg';
import { DynamicTableService } from '../db/dynamic-table.service';
import { UpsertService } from '../db/upsert.service';
import { PowerBiService } from '../powerbi/powerbi.service';
import { EmailService } from '../notifications/email.service';
import { ExcelService } from '../exports/excel.service';
export interface CreateJobDto {
    name: string;
    reportName?: string;
    datasetId: string;
    sourceTable: string;
    columns: string[];
    measures?: string[];
    targetTable: string;
    mode?: 'append' | 'upsert';
    businessKeys?: string[];
    limit?: number;
    owner?: string;
    cron?: string;
    dateColumn?: string;
    dateFrom?: string;
    dateTo?: string;
    recipients?: string;
    emailSubject?: string;
}
export declare class JobsService implements OnModuleInit {
    private readonly pool;
    private readonly powerbi;
    private readonly dyn;
    private readonly upsert;
    private readonly registry;
    private readonly emailService;
    private readonly excelService;
    private readonly logger;
    constructor(pool: Pool, powerbi: PowerBiService, dyn: DynamicTableService, upsert: UpsertService, registry: SchedulerRegistry, emailService: EmailService, excelService: ExcelService);
    onModuleInit(): Promise<void>;
    private ensureTable;
    list(): Promise<any[]>;
    get(id: number): Promise<any>;
    create(dto: CreateJobDto): Promise<any>;
    remove(id: number): Promise<void>;
    runJob(id: number): Promise<{
        rowsWritten: number;
        totalRows: number;
    }>;
    private validateCron;
    private cronName;
    private schedule;
    private unschedule;
}
