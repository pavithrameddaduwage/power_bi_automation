import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Pool } from 'pg';
import { PG_POOL } from '../db/database.module';
import { DynamicTableService } from '../db/dynamic-table.service';
import { UpsertService } from '../db/upsert.service';
import { PowerBiService } from '../powerbi/powerbi.service';

export interface CreateJobDto {
  /** Friendly job name, unique. */
  name: string;
  reportName?: string;
  datasetId: string;
  /** The DAX table to read from. */
  sourceTable: string;
  columns: string[];
  /** Measures to compute (grouped by columns). */
  measures?: string[];
  /** Destination Postgres table (sanitised). */
  targetTable: string;
  mode?: 'append' | 'upsert';
  businessKeys?: string[];
  /** Rows cap; 0 or omitted with allRows means all rows. */
  limit?: number;
  owner?: string;
  /** Optional cron expression; when set + enabled the job runs on schedule. */
  cron?: string;
  /** Optional date-range filter. */
  dateColumn?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly powerbi: PowerBiService,
    private readonly dyn: DynamicTableService,
    private readonly upsert: UpsertService,
    private readonly registry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    await this.ensureTable();
    // Re-register schedules for all enabled jobs that have a cron.
    const jobs = await this.list();
    for (const j of jobs) {
      if (j.cron && j.enabled) this.schedule(j);
    }
    this.logger.log(`Registered ${jobs.filter((j) => j.cron && j.enabled).length} scheduled job(s).`);
  }

  private async ensureTable(): Promise<void> {
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
    // Date-range filter columns (added for existing installs).
    await this.pool.query(
      `ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS date_column text`,
    );
    await this.pool.query(
      `ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS date_from date`,
    );
    await this.pool.query(
      `ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS date_to date`,
    );
    await this.pool.query(
      `ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS measures jsonb`,
    );
  }

  async list(): Promise<any[]> {
    await this.ensureTable();
    const { rows } = await this.pool.query(
      `SELECT * FROM report_jobs ORDER BY created_at DESC`,
    );
    return rows;
  }

  async get(id: number): Promise<any> {
    const { rows } = await this.pool.query(
      `SELECT * FROM report_jobs WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) throw new NotFoundException(`Job ${id} not found.`);
    return rows[0];
  }

  async create(dto: CreateJobDto): Promise<any> {
    if (!dto?.name?.trim()) throw new BadRequestException('name is required.');
    if (!dto.datasetId || !dto.sourceTable) {
      throw new BadRequestException('datasetId and sourceTable are required.');
    }
    const hasCols = Array.isArray(dto.columns) && dto.columns.length > 0;
    const hasMeas = Array.isArray(dto.measures) && dto.measures.length > 0;
    if (!hasCols && !hasMeas) {
      throw new BadRequestException('At least one column or measure is required.');
    }
    let target: string;
    try {
      target = this.dyn.sanitizeTableName(dto.targetTable);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
    if (await this.dyn.isLocked(target)) {
      throw new BadRequestException(
        'The table has been created and cannot be edited.',
      );
    }
    const mode = dto.mode === 'upsert' ? 'upsert' : 'append';
    if (mode === 'upsert' && (!dto.businessKeys || dto.businessKeys.length === 0)) {
      throw new BadRequestException('Upsert mode needs at least one business key.');
    }
    if (dto.cron) this.validateCron(dto.cron);

    const { rows } = await this.pool.query(
      `INSERT INTO report_jobs
         (name, report_name, dataset_id, source_table, columns, target_table,
          mode, business_keys, row_limit, owner, cron, enabled,
          date_column, date_from, date_to, measures)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14,$15)
       RETURNING *`,
      [
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
      ],
    ).catch((e) => {
      if (String(e.message).includes('duplicate key')) {
        throw new BadRequestException(`A job named "${dto.name}" already exists.`);
      }
      throw e;
    });

    const job = rows[0];
    if (job.cron && job.enabled) this.schedule(job);
    return job;
  }

  async remove(id: number): Promise<void> {
    await this.get(id);
    this.unschedule(id);
    await this.pool.query(`DELETE FROM report_jobs WHERE id = $1`, [id]);
  }

  /** Pull the job's data from Power BI and write it to its target table. */
  async runJob(id: number): Promise<{ rowsWritten: number; totalRows: number }> {
    const job = await this.get(id);
    await this.upsert.ensureSyncLogTable();
    try {
      const data = await this.powerbi.getReportData(
        job.dataset_id,
        job.source_table,
        job.columns,
        job.row_limit,
        {
          dateColumn: job.date_column ?? undefined,
          dateFrom: job.date_from
            ? new Date(job.date_from).toISOString().slice(0, 10)
            : undefined,
          dateTo: job.date_to
            ? new Date(job.date_to).toISOString().slice(0, 10)
            : undefined,
        },
        job.measures ?? [],
      );
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
      await this.pool.query(
        `UPDATE report_jobs SET last_run_at = now(), last_status = 'success', last_rows = $2 WHERE id = $1`,
        [id, res.rowsWritten],
      );
      await this.upsert.logRun({
        request: `job: ${job.name}`,
        targetTable: job.target_table,
        rowsWritten: res.rowsWritten,
        status: 'success',
      });
      return { rowsWritten: res.rowsWritten, totalRows: res.totalRows };
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      await this.pool.query(
        `UPDATE report_jobs SET last_run_at = now(), last_status = 'error' WHERE id = $1`,
        [id],
      );
      await this.upsert.logRun({
        request: `job: ${job.name}`,
        targetTable: job.target_table,
        status: 'error',
        error: msg,
      });
      throw new BadRequestException(msg);
    }
  }

  // ── scheduling ──────────────────────────────────────────────────
  private validateCron(cron: string): void {
    try {
      // Constructing a CronJob validates the expression.
      // eslint-disable-next-line no-new
      new CronJob(cron, () => undefined, null, false, 'UTC');
    } catch {
      throw new BadRequestException(`Invalid cron expression: "${cron}".`);
    }
  }

  private cronName(id: number): string {
    return `report-job-${id}`;
  }

  private schedule(job: any): void {
    this.unschedule(job.id);
    const cronJob = new CronJob(
      job.cron,
      () => {
        this.runJob(job.id).catch((e) =>
          this.logger.error(`Scheduled job ${job.name} failed: ${e.message}`),
        );
      },
      null,
      false,
      'UTC',
    );
    this.registry.addCronJob(this.cronName(job.id), cronJob as any);
    cronJob.start();
    this.logger.log(`Scheduled job "${job.name}" with cron "${job.cron}".`);
  }

  private unschedule(id: number): void {
    const name = this.cronName(id);
    try {
      if (this.registry.doesExist('cron', name)) {
        this.registry.deleteCronJob(name);
      }
    } catch {
      /* not registered */
    }
  }
}
