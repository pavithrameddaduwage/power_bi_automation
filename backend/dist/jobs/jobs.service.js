"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var JobsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const cron_1 = require("cron");
const pg_1 = require("pg");
const database_module_1 = require("../db/database.module");
const dynamic_table_service_1 = require("../db/dynamic-table.service");
const upsert_service_1 = require("../db/upsert.service");
const powerbi_service_1 = require("../powerbi/powerbi.service");
const email_service_1 = require("../notifications/email.service");
const excel_service_1 = require("../exports/excel.service");
let JobsService = JobsService_1 = class JobsService {
    constructor(pool, powerbi, dyn, upsert, registry, emailService, excelService) {
        this.pool = pool;
        this.powerbi = powerbi;
        this.dyn = dyn;
        this.upsert = upsert;
        this.registry = registry;
        this.emailService = emailService;
        this.excelService = excelService;
        this.logger = new common_1.Logger(JobsService_1.name);
    }
    async onModuleInit() {
        await this.ensureTable();
        const jobs = await this.list();
        for (const j of jobs) {
            if (j.cron && j.enabled)
                this.schedule(j);
        }
        this.logger.log(`Registered ${jobs.filter((j) => j.cron && j.enabled).length} scheduled job(s).`);
    }
    async ensureTable() {
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS report_jobs (
        id bigserial PRIMARY KEY,
        name text NOT NULL UNIQUE,
        report_name text,
        dataset_id text NOT NULL,
        source_table text NOT NULL,
        columns jsonb NOT NULL,
        target_table text NOT NULL,
        mode text NOT NULL DEFAULT 'append',
        business_keys jsonb,
        row_limit integer NOT NULL DEFAULT 500,
        owner text,
        cron text,
        enabled boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_run_at timestamptz,
        last_status text,
        last_rows integer
      );
    `);
        await this.pool.query(`ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS date_column text`);
        await this.pool.query(`ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS date_from date`);
        await this.pool.query(`ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS date_to date`);
        await this.pool.query(`ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS measures jsonb`);
        await this.pool.query(`ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS recipients text`);
        await this.pool.query(`ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS email_subject text`);
    }
    async list() {
        await this.ensureTable();
        const { rows } = await this.pool.query(`SELECT * FROM report_jobs ORDER BY created_at DESC`);
        return rows;
    }
    async get(id) {
        const { rows } = await this.pool.query(`SELECT * FROM report_jobs WHERE id = $1`, [id]);
        if (rows.length === 0)
            throw new common_1.NotFoundException(`Job ${id} not found.`);
        return rows[0];
    }
    async create(dto) {
        if (!dto?.name?.trim())
            throw new common_1.BadRequestException('name is required.');
        if (!dto.datasetId || !dto.sourceTable) {
            throw new common_1.BadRequestException('datasetId and sourceTable are required.');
        }
        const hasCols = Array.isArray(dto.columns) && dto.columns.length > 0;
        const hasMeas = Array.isArray(dto.measures) && dto.measures.length > 0;
        if (!hasCols && !hasMeas) {
            throw new common_1.BadRequestException('At least one column or measure is required.');
        }
        let target;
        try {
            target = this.dyn.sanitizeTableName(dto.targetTable);
        }
        catch (e) {
            throw new common_1.BadRequestException(e.message);
        }
        if (await this.dyn.isLocked(target)) {
            throw new common_1.BadRequestException('The table has been created and cannot be edited.');
        }
        const mode = dto.mode === 'upsert' ? 'upsert' : 'append';
        if (mode === 'upsert' && (!dto.businessKeys || dto.businessKeys.length === 0)) {
            throw new common_1.BadRequestException('Upsert mode needs at least one business key.');
        }
        if (dto.cron)
            this.validateCron(dto.cron);
        const { rows } = await this.pool.query(`INSERT INTO report_jobs
         (name, report_name, dataset_id, source_table, columns, target_table,
          mode, business_keys, row_limit, owner, cron, enabled,
          date_column, date_from, date_to, measures, recipients, email_subject)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14,$15,$16,$17)
       RETURNING *`, [
            dto.name.trim(),
            dto.reportName ?? null,
            dto.datasetId,
            dto.sourceTable,
            JSON.stringify(dto.columns ?? []),
            target,
            mode,
            dto.businessKeys ? JSON.stringify(dto.businessKeys) : null,
            dto.limit ?? 0,
            dto.owner ?? null,
            dto.cron ?? null,
            dto.dateColumn ?? null,
            dto.dateFrom ?? null,
            dto.dateTo ?? null,
            dto.measures ? JSON.stringify(dto.measures) : null,
            dto.recipients ?? null,
            dto.emailSubject ?? null,
        ]).catch((e) => {
            if (String(e.message).includes('duplicate key')) {
                throw new common_1.BadRequestException(`A job named "${dto.name}" already exists.`);
            }
            throw e;
        });
        const job = rows[0];
        if (job.cron && job.enabled)
            this.schedule(job);
        return job;
    }
    async remove(id) {
        await this.get(id);
        this.unschedule(id);
        await this.pool.query(`DELETE FROM report_jobs WHERE id = $1`, [id]);
    }
    async runJob(id) {
        const job = await this.get(id);
        await this.upsert.ensureSyncLogTable();
        try {
            const data = await this.powerbi.getReportData(job.dataset_id, job.source_table, job.columns, job.row_limit, {
                dateColumn: job.date_column ?? undefined,
                dateFrom: job.date_from
                    ? new Date(job.date_from).toISOString().slice(0, 10)
                    : undefined,
                dateTo: job.date_to
                    ? new Date(job.date_to).toISOString().slice(0, 10)
                    : undefined,
            }, job.measures ?? []);
            const res = await this.dyn.upload({
                table: job.target_table,
                kind: 'report',
                label: job.name,
                owner: job.owner ?? 'job',
                source: 'job',
                rows: data,
                mode: job.mode,
                keys: job.business_keys ?? undefined,
            });
            await this.pool.query(`UPDATE report_jobs SET last_run_at = now(), last_status = 'success', last_rows = $2 WHERE id = $1`, [id, res.rowsWritten]);
            await this.upsert.logRun({
                request: `job: ${job.name}`,
                targetTable: job.target_table,
                rowsWritten: res.rowsWritten,
                status: 'success',
            });
            if (job.recipients && job.recipients.trim() !== '') {
                try {
                    const excelBuffer = await this.excelService.generateExcelBuffer(data, job.target_table);
                    const subject = job.email_subject || `Scheduled Report: ${job.name}`;
                    const fileName = `${job.target_table}_${new Date().toISOString().slice(0, 10)}.xlsx`;
                    await this.emailService.sendReport(job.recipients, subject, excelBuffer, fileName);
                    this.logger.log(`Emailed scheduled report ${job.name} to ${job.recipients}`);
                }
                catch (emailErr) {
                    this.logger.error(`Failed to send scheduled email for ${job.name}: ${emailErr.message}`);
                }
            }
            return { rowsWritten: res.rowsWritten, totalRows: res.totalRows };
        }
        catch (e) {
            const msg = e?.message ?? String(e);
            await this.pool.query(`UPDATE report_jobs SET last_run_at = now(), last_status = 'error' WHERE id = $1`, [id]);
            await this.upsert.logRun({
                request: `job: ${job.name}`,
                targetTable: job.target_table,
                status: 'error',
                error: msg,
            });
            throw new common_1.BadRequestException(msg);
        }
    }
    validateCron(cron) {
        try {
            new cron_1.CronJob(cron, () => undefined, null, false, 'UTC');
        }
        catch {
            throw new common_1.BadRequestException(`Invalid cron expression: "${cron}".`);
        }
    }
    cronName(id) {
        return `report-job-${id}`;
    }
    schedule(job) {
        this.unschedule(job.id);
        const cronJob = new cron_1.CronJob(job.cron, () => {
            this.runJob(job.id).catch((e) => this.logger.error(`Scheduled job ${job.name} failed: ${e.message}`));
        }, null, false, 'UTC');
        this.registry.addCronJob(this.cronName(job.id), cronJob);
        cronJob.start();
        this.logger.log(`Scheduled job "${job.name}" with cron "${job.cron}".`);
    }
    unschedule(id) {
        const name = this.cronName(id);
        try {
            if (this.registry.doesExist('cron', name)) {
                this.registry.deleteCronJob(name);
            }
        }
        catch {
        }
    }
};
exports.JobsService = JobsService;
exports.JobsService = JobsService = JobsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [pg_1.Pool,
        powerbi_service_1.PowerBiService,
        dynamic_table_service_1.DynamicTableService,
        upsert_service_1.UpsertService,
        schedule_1.SchedulerRegistry,
        email_service_1.EmailService,
        excel_service_1.ExcelService])
], JobsService);
//# sourceMappingURL=jobs.service.js.map