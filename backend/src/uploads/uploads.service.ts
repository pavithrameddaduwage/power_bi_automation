import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DynamicTableService,
  UploadResult,
} from '../db/dynamic-table.service';
import { UpsertService } from '../db/upsert.service';
import { PowerBiService } from '../powerbi/powerbi.service';

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
  ) {}

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
}
