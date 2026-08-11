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
exports.CatalogController = void 0;
const common_1 = require("@nestjs/common");
const powerbi_service_1 = require("../powerbi/powerbi.service");
let CatalogController = class CatalogController {
    constructor(powerbi) {
        this.powerbi = powerbi;
    }
    dashboards() {
        return this.powerbi.listAllDashboards();
    }
    async reports(downloadableOnly) {
        const all = await this.powerbi.reportsWithAccess();
        if (downloadableOnly === 'true') {
            return all.filter((r) => r.downloadable);
        }
        return all;
    }
    async columns(datasetId, finalOnly) {
        const cols = await this.powerbi.getDatasetColumns(datasetId);
        if (finalOnly === 'true') {
            const curated = cols.filter((c) => !this.isSourceTable(c.table));
            const counts = new Map();
            for (const c of curated) {
                counts.set(c.table, (counts.get(c.table) ?? 0) + 1);
            }
            const MIN_FINAL_COLUMNS = 1;
            return curated.filter((c) => (counts.get(c.table) ?? 0) >= MIN_FINAL_COLUMNS);
        }
        return cols;
    }
    isSourceTable(table) {
        const n = table.toLowerCase();
        return (n.startsWith('localdatetable_') ||
            n.startsWith('datetabletemplate_') ||
            n === 'measures table' ||
            n.endsWith(' measures') ||
            n.startsWith('_'));
    }
    measures(datasetId) {
        return this.powerbi.getDatasetMeasures(datasetId);
    }
    data(body) {
        const tableList = body.tables?.length
            ? body.tables
            : body.table
                ? [body.table]
                : [];
        if (tableList.length === 0) {
            return [];
        }
        if (tableList.length === 1) {
            return this.powerbi.getReportData(body.datasetId, tableList[0], body.columns, body.limit ?? 500, {
                dateColumn: body.dateColumn,
                dateFrom: body.dateFrom,
                dateTo: body.dateTo,
            }, body.measures ?? []);
        }
        return this.powerbi.getReportDataMulti(body.datasetId, tableList, body.columns, body.limit ?? 500, {
            dateColumn: body.dateColumn,
            dateFrom: body.dateFrom,
            dateTo: body.dateTo,
        }, body.measures ?? []);
    }
};
exports.CatalogController = CatalogController;
__decorate([
    (0, common_1.Get)('dashboards'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "dashboards", null);
__decorate([
    (0, common_1.Get)('reports'),
    __param(0, (0, common_1.Query)('downloadableOnly')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "reports", null);
__decorate([
    (0, common_1.Get)('datasets/:datasetId/columns'),
    __param(0, (0, common_1.Param)('datasetId')),
    __param(1, (0, common_1.Query)('finalOnly')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "columns", null);
__decorate([
    (0, common_1.Get)('datasets/:datasetId/measures'),
    __param(0, (0, common_1.Param)('datasetId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "measures", null);
__decorate([
    (0, common_1.Post)('data'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "data", null);
exports.CatalogController = CatalogController = __decorate([
    (0, common_1.Controller)('api/catalog'),
    __metadata("design:paramtypes", [powerbi_service_1.PowerBiService])
], CatalogController);
//# sourceMappingURL=catalog.controller.js.map