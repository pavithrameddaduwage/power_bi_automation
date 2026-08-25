import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../db/database.module';
import {
  DynamicTableService,
  UploadResult,
} from '../db/dynamic-table.service';
import { UpsertService } from '../db/upsert.service';
import { PowerBiService } from '../powerbi/powerbi.service';
import { ExcelService } from '../exports/excel.service';
import { EmailService } from '../notifications/email.service';

export interface UploadReportDto {
  /** The report this data belongs to, e.g. "Inventory Amazon". */
  reportName: string;
  /** Optional Postgres table name chosen by the user. Sanitised server-side. */
  tableName?: string;
  /** The person creating/uploading the custom report. */
  owner?: string;
  /** 'append' (default) or 'upsert' (update rows matching businessKeys). */
  mode?: 'append' | 'upsert';
  /** Business keys used when mode = 'upsert'. */
  businessKeys?: string[];
  /** Optional recipients for emailing the exported Excel */
  recipients?: string[];
  /** Optional subject for the email */
  subject?: string;
  /** The rows. Keys become columns; the table grows to fit them. */
  rows: Record<string, any>[];
}

export interface UploadPrincipalsDto {
  owner?: string;
  rows: Record<string, any>[];
}

const PRINCIPALS_TABLE = 'principals';

@Injectable()
export class UploadsService {
  constructor(
    private readonly dyn: DynamicTableService,
    private readonly powerbi: PowerBiService,
    private readonly upsert: UpsertService,
    private readonly excelService: ExcelService,
    private readonly emailService: EmailService,
    @Inject(PG_POOL) private readonly db: Pool,
  ) {}

  /** Email an existing dataset */
  async emailDataset(
    table: string,
    recipients: string[],
    subject: string,
  ): Promise<void> {
    if (!recipients || recipients.length === 0) {
      throw new Error('No recipients provided.');
    }
    const result = await this.db.query(`SELECT * FROM "${table}" LIMIT 100000`);
    const rows = result.rows;
    const excelBuffer = await this.excelService.generateExcelBuffer(
      rows,
      table,
    );
    const fileName = `${table}_${new Date().toISOString().split('T')[0]}.xlsx`;
    await this.emailService.sendReport(
      recipients,
      subject || `Data export: ${table}`,
      excelBuffer,
      fileName,
      {
        reportName: table,
        rowCount: rows.length,
        source: 'Stored Dataset Export',
      },
    );
  }

  async getEmailHistory() {
    return this.emailService.getEmailHistory();
  }

  async getSmtpConfig() {
    return this.emailService.getSmtpConfig();
  }

  async saveSmtpConfig(dto: any) {
    return this.emailService.saveSmtpConfig(dto);
  }

  async sendTestEmail(dto: { toEmail: string }) {
    if (!dto?.toEmail?.trim()) {
      throw new BadRequestException('Recipient email address is required.');
    }
    return this.emailService.sendTestEmail(dto.toEmail.trim());
  }

  async sendEmailReport(dto: {
    reportName: string;
    rows: any[];
    recipients: string[];
    subject?: string;
  }): Promise<{ ok: boolean; count: number; status?: string; previewUrl?: string }> {
    if (!dto.recipients || dto.recipients.length === 0) {
      throw new BadRequestException('No recipients provided.');
    }
    if (!dto.rows || dto.rows.length === 0) {
      throw new BadRequestException('No rows provided to email.');
    }
    const name = dto.reportName?.trim() || 'Report';
    const excelBuffer = await this.excelService.generateExcelBuffer(dto.rows, name);
    const subject = dto.subject?.trim() || `Excel Report Export: ${name}`;
    const fileName = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

    const res = await this.emailService.sendReport(
      dto.recipients,
      subject,
      excelBuffer,
      fileName,
      {
        reportName: name,
        rowCount: dto.rows.length,
        source: 'Report Automation Direct Export',
      },
    );
    return { ok: true, count: dto.rows.length, status: res.status, previewUrl: res.previewUrl };
  }

  /** Generate Excel buffer for direct download */
  async exportExcelBuffer(reportName?: string, rows: any[] = []): Promise<Buffer> {
    if (!rows || rows.length === 0) {
      throw new BadRequestException('No rows available to export.');
    }
    const name = reportName?.trim() || 'Report';
    return this.excelService.generateExcelBuffer(rows, name);
  }

  /**
   * A person uploads (or appends to) a custom report. The destination table is
   * derived from the report name and created on first use; later uploads —
   * even with different/extra columns — are appended and the schema widened.
   */
  async uploadReport(dto: UploadReportDto): Promise<UploadResult> {
    if (!dto?.reportName?.trim()) {
      throw new BadRequestException('reportName is required.');
    }
    if (!Array.isArray(dto.rows)) {
      throw new BadRequestException('rows must be an array.');
    }
    // Use the user's chosen table name if given, otherwise derive one from the
    // report name.
    let table: string;
    try {
      table = dto.tableName?.trim()
        ? this.dyn.sanitizeTableName(dto.tableName)
        : this.dyn.tableNameFor('custom_report', dto.reportName);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
    // Once a table is created with primary keys it is locked from frontend edits.
    if (await this.dyn.isLocked(table)) {
      throw new BadRequestException(
        'The table has been created and cannot be edited.',
      );
    }
    await this.upsert.ensureSyncLogTable();
    try {
      const result = await this.dyn.upload({
        table,
        kind: 'report',
        label: dto.reportName.trim(),
        owner: dto.owner?.trim() || 'anonymous',
        source: 'upload',
        rows: dto.rows,
        mode: dto.mode === 'upsert' ? 'upsert' : 'append',
        keys: dto.businessKeys,
      });
      await this.upsert.logRun({
        request: `upload: ${dto.reportName.trim()}`,
        targetTable: table,
        rowsWritten: result.rowsWritten,
        status: 'success',
      });

      return result;
    } catch (e: any) {
      await this.upsert.logRun({
        request: `upload: ${dto.reportName.trim()}`,
        targetTable: table,
        status: 'error',
        error: e?.message ?? String(e),
      });
      throw new BadRequestException(e?.message ?? 'Upload failed.');
    }
  }

  exportCsv(table: string) {
    return this.dyn.exportCsv(table);
  }

  /** Upload custom principals (people/access) the same dynamic way. Appends. */
  async uploadPrincipals(dto: UploadPrincipalsDto): Promise<UploadResult> {
    if (!Array.isArray(dto?.rows)) {
      throw new BadRequestException('rows must be an array.');
    }
    return this.dyn.upload({
      table: PRINCIPALS_TABLE,
      kind: 'principals',
      label: 'principals',
      owner: dto.owner?.trim() || 'anonymous',
      source: 'upload',
      rows: dto.rows,
    });
  }

  /**
   * Sync principals from Power BI into the same `principals` table. Idempotent:
   * the previous Power BI rows are replaced, while any custom-uploaded
   * principals (source = 'upload') are left untouched.
   */
  async syncPrincipalsFromPowerBi(): Promise<UploadResult> {
    const users = await this.powerbi.allWorkspaceUsers();
    return this.dyn.upload({
      table: PRINCIPALS_TABLE,
      kind: 'principals',
      label: 'principals',
      owner: 'powerbi',
      source: 'powerbi',
      rows: users,
      replaceSource: true,
    });
  }

  listDatasets() {
    return this.dyn.listDatasets();
  }

  previewRows(table: string, limit?: number) {
    return this.dyn.previewRows(table, limit ?? 100);
  }

  getLastSyncAt(table: string): Promise<string | null> {
    return this.dyn.getLastSyncAt(table);
  }
}
