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
var SyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncService = void 0;
const common_1 = require("@nestjs/common");
const powerbi_service_1 = require("../powerbi/powerbi.service");
const upsert_service_1 = require("../db/upsert.service");
const report_map_config_1 = require("./report-map.config");
let SyncService = SyncService_1 = class SyncService {
    constructor(powerbi, upsert) {
        this.powerbi = powerbi;
        this.upsert = upsert;
        this.logger = new common_1.Logger(SyncService_1.name);
    }
    currentSnapshotDate() {
        const d = new Date();
        const day = d.getUTCDay();
        const back = (day - 3 + 7) % 7;
        d.setUTCDate(d.getUTCDate() - back);
        return d.toISOString().slice(0, 10);
    }
    async syncOne(request) {
        const entry = (0, report_map_config_1.findReportEntry)(request);
        if (!entry) {
            throw new Error(`No report-map entry for request "${request}".`);
        }
        await this.upsert.ensureSyncLogTable();
        try {
            const result = await this.runEntry(entry);
            await this.upsert.logRun({
                request: entry.request,
                targetTable: entry.targetTable,
                snapshotDate: result.snapshotDate,
                rowsWritten: result.rowsWritten,
                status: 'success',
            });
            return result;
        }
        catch (err) {
            await this.upsert.logRun({
                request: entry.request,
                targetTable: entry.targetTable,
                status: 'error',
                error: err?.message ?? String(err),
            });
            throw err;
        }
    }
    async syncAll() {
        const results = [];
        const errors = [];
        for (const entry of report_map_config_1.REPORT_MAP) {
            try {
                results.push(await this.syncOne(entry.request));
            }
            catch (err) {
                errors.push(`${entry.request}: ${err?.message ?? err}`);
            }
        }
        return { results, errors };
    }
    async runEntry(entry) {
        const dashboard = await this.powerbi.findDashboardByName(entry.dashboardName);
        if (!dashboard) {
            throw new Error(`Dashboard "${entry.dashboardName}" not found.`);
        }
        const sources = await this.powerbi.resolveDatasetsForDashboard(dashboard);
        if (sources.length === 0) {
            throw new Error(`No datasets resolved for dashboard "${dashboard.displayName}".`);
        }
        const dax = entry.daxQuery ?? `EVALUATE '${entry.daxTable}'`;
        let rows = null;
        let usedDatasetId = '';
        for (const src of sources) {
            try {
                rows = await this.powerbi.executeQuery(src.groupId, src.datasetId, dax);
                usedDatasetId = src.datasetId;
                break;
            }
            catch (e) {
                this.logger.warn(`DAX failed on dataset ${src.datasetId}, trying next. ${e}`);
            }
        }
        if (rows === null) {
            throw new Error(`Could not run DAX for "${entry.request}" on any dataset.`);
        }
        const snapshotDate = this.currentSnapshotDate();
        await this.upsert.ensureTable(entry);
        const rowsWritten = await this.upsert.upsertRows(entry, rows, snapshotDate);
        return {
            request: entry.request,
            targetTable: entry.targetTable,
            snapshotDate,
            rowsWritten,
            dashboard: dashboard.displayName,
            datasetId: usedDatasetId,
        };
    }
};
exports.SyncService = SyncService;
exports.SyncService = SyncService = SyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [powerbi_service_1.PowerBiService,
        upsert_service_1.UpsertService])
], SyncService);
//# sourceMappingURL=sync.service.js.map