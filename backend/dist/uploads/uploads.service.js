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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const database_module_1 = require("../db/database.module");
const dynamic_table_service_1 = require("../db/dynamic-table.service");
const upsert_service_1 = require("../db/upsert.service");
const powerbi_service_1 = require("../powerbi/powerbi.service");
const excel_service_1 = require("../exports/excel.service");
const email_service_1 = require("../notifications/email.service");
const PRINCIPALS_TABLE = 'principals';
let UploadsService = class UploadsService {
    constructor(dyn, powerbi, upsert, excelService, emailService, db) {
        this.dyn = dyn;
        this.powerbi = powerbi;
        this.upsert = upsert;
        this.excelService = excelService;
        this.emailService = emailService;
        this.db = db;
    }
    async emailDataset(table, recipients, subject) {
        if (!recipients || recipients.length === 0) {
            throw new Error('No recipients provided.');
        }
        const result = await this.db.query(`SELECT * FROM "${table}" LIMIT 100000`);
        const rows = result.rows;
        const excelBuffer = await this.excelService.generateExcelBuffer(rows, table);
        const fileName = `${table}_${new Date().toISOString().split('T')[0]}.xlsx`;
        await this.emailService.sendReport(recipients, subject || `Data export: ${table}`, excelBuffer, fileName);
    }
    async getEmailHistory() {
        return this.emailService.getEmailHistory();
    }
    async getSmtpConfig() {
        return this.emailService.getSmtpConfig();
    }
    async saveSmtpConfig(dto) {
        return this.emailService.saveSmtpConfig(dto);
    }
    async sendEmailReport(dto) {
        if (!dto.recipients || dto.recipients.length === 0) {
            throw new common_1.BadRequestException('No recipients provided.');
        }
        if (!dto.rows || dto.rows.length === 0) {
            throw new common_1.BadRequestException('No rows provided to email.');
        }
        const name = dto.reportName?.trim() || 'Report';
        const excelBuffer = await this.excelService.generateExcelBuffer(dto.rows, name);
        const subject = dto.subject?.trim() || `Excel Report Export: ${name}`;
        const fileName = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        await this.emailService.sendReport(dto.recipients, subject, excelBuffer, fileName);
        return { ok: true, count: dto.rows.length };
    }
    async uploadReport(dto) {
        if (!dto?.reportName?.trim()) {
            throw new common_1.BadRequestException('reportName is required.');
        }
        if (!Array.isArray(dto.rows)) {
            throw new common_1.BadRequestException('rows must be an array.');
        }
        let table;
        try {
            table = dto.tableName?.trim()
                ? this.dyn.sanitizeTableName(dto.tableName)
                : this.dyn.tableNameFor('custom_report', dto.reportName);
        }
        catch (e) {
            throw new common_1.BadRequestException(e.message);
        }
        if (await this.dyn.isLocked(table)) {
            throw new common_1.BadRequestException('The table has been created and cannot be edited.');
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
            if (dto.recipients && dto.recipients.length > 0) {
                try {
                    const excelBuffer = await this.excelService.generateExcelBuffer(dto.rows, dto.reportName.trim());
                    const subject = dto.subject || `New Report: ${dto.reportName.trim()}`;
                    const fileName = `${dto.reportName.trim().replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
                    await this.emailService.sendReport(dto.recipients, subject, excelBuffer, fileName);
                }
                catch (exportErr) {
                    console.error('Failed to export/email report:', exportErr);
                }
            }
            return result;
        }
        catch (e) {
            await this.upsert.logRun({
                request: `upload: ${dto.reportName.trim()}`,
                targetTable: table,
                status: 'error',
                error: e?.message ?? String(e),
            });
            throw new common_1.BadRequestException(e?.message ?? 'Upload failed.');
        }
    }
    exportCsv(table) {
        return this.dyn.exportCsv(table);
    }
    async uploadPrincipals(dto) {
        if (!Array.isArray(dto?.rows)) {
            throw new common_1.BadRequestException('rows must be an array.');
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
    async syncPrincipalsFromPowerBi() {
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
    previewRows(table, limit) {
        return this.dyn.previewRows(table, limit ?? 100);
    }
    getLastSyncAt(table) {
        return this.dyn.getLastSyncAt(table);
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [dynamic_table_service_1.DynamicTableService,
        powerbi_service_1.PowerBiService,
        upsert_service_1.UpsertService,
        excel_service_1.ExcelService,
        email_service_1.EmailService,
        pg_1.Pool])
], UploadsService);
//# sourceMappingURL=uploads.service.js.map