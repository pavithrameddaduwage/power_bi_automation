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
exports.SyncController = void 0;
const common_1 = require("@nestjs/common");
const sync_service_1 = require("./sync.service");
const powerbi_service_1 = require("../powerbi/powerbi.service");
const upsert_service_1 = require("../db/upsert.service");
const report_map_config_1 = require("./report-map.config");
let SyncController = class SyncController {
    constructor(sync, powerbi, upsert) {
        this.sync = sync;
        this.powerbi = powerbi;
        this.upsert = upsert;
    }
    reports() {
        return report_map_config_1.REPORT_MAP.map((e) => ({
            request: e.request,
            dashboardName: e.dashboardName,
            targetTable: e.targetTable,
            businessKeys: e.businessKeys,
        }));
    }
    dashboards() {
        return this.powerbi.listAllDashboards();
    }
    syncOne(request) {
        return this.sync.syncOne(decodeURIComponent(request));
    }
    syncAll() {
        return this.sync.syncAll();
    }
    async runs() {
        await this.upsert.ensureSyncLogTable();
        return this.upsert.recentRuns();
    }
};
exports.SyncController = SyncController;
__decorate([
    (0, common_1.Get)('reports'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SyncController.prototype, "reports", null);
__decorate([
    (0, common_1.Get)('dashboards'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SyncController.prototype, "dashboards", null);
__decorate([
    (0, common_1.Post)('sync/:request'),
    __param(0, (0, common_1.Param)('request')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SyncController.prototype, "syncOne", null);
__decorate([
    (0, common_1.Post)('sync'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SyncController.prototype, "syncAll", null);
__decorate([
    (0, common_1.Get)('runs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "runs", null);
exports.SyncController = SyncController = __decorate([
    (0, common_1.Controller)('api'),
    __metadata("design:paramtypes", [sync_service_1.SyncService,
        powerbi_service_1.PowerBiService,
        upsert_service_1.UpsertService])
], SyncController);
//# sourceMappingURL=sync.controller.js.map