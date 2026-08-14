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
exports.UploadsController = void 0;
const common_1 = require("@nestjs/common");
const uploads_service_1 = require("./uploads.service");
const public_decorator_1 = require("../auth/decorators/public.decorator");
let UploadsController = class UploadsController {
    constructor(uploads) {
        this.uploads = uploads;
    }
    uploadReport(dto) {
        return this.uploads.uploadReport(dto);
    }
    uploadPrincipals(dto) {
        return this.uploads.uploadPrincipals(dto);
    }
    syncPrincipals() {
        return this.uploads.syncPrincipalsFromPowerBi();
    }
    datasets() {
        return this.uploads.listDatasets();
    }
    rows(table, limit) {
        return this.uploads.previewRows(table, limit ? parseInt(limit, 10) : undefined);
    }
    async lastSync(table) {
        const lastSyncAt = await this.uploads.getLastSyncAt(table);
        return { lastSyncAt };
    }
    emailDataset(table, body) {
        return this.uploads.emailDataset(table, body.recipients, body.subject);
    }
    emailHistory() {
        return this.uploads.getEmailHistory();
    }
    smtpConfig() {
        return this.uploads.getSmtpConfig();
    }
    saveSmtpConfig(body) {
        return this.uploads.saveSmtpConfig(body);
    }
    sendEmailReport(body) {
        return this.uploads.sendEmailReport(body);
    }
    async exportExcel(body, res) {
        const buffer = await this.uploads.exportExcelBuffer(body.reportName, body.rows);
        const safeName = (body.reportName || 'report').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${safeName}_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(buffer);
    }
    async export(table, res) {
        const csv = await this.uploads.exportCsv(table);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${table}.csv"`);
        res.send(csv);
    }
};
exports.UploadsController = UploadsController;
__decorate([
    (0, common_1.Post)('report'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "uploadReport", null);
__decorate([
    (0, common_1.Post)('principals'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "uploadPrincipals", null);
__decorate([
    (0, common_1.Post)('principals/sync'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "syncPrincipals", null);
__decorate([
    (0, common_1.Get)('datasets'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "datasets", null);
__decorate([
    (0, common_1.Get)('datasets/:table/rows'),
    __param(0, (0, common_1.Param)('table')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "rows", null);
__decorate([
    (0, common_1.Get)('datasets/:table/last-sync'),
    __param(0, (0, common_1.Param)('table')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "lastSync", null);
__decorate([
    (0, common_1.Post)('datasets/:table/email'),
    __param(0, (0, common_1.Param)('table')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "emailDataset", null);
__decorate([
    (0, common_1.Get)('email-history'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "emailHistory", null);
__decorate([
    (0, common_1.Get)('smtp-config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "smtpConfig", null);
__decorate([
    (0, common_1.Post)('smtp-config'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "saveSmtpConfig", null);
__decorate([
    (0, common_1.Post)('send-email-report'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "sendEmailReport", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('export-excel'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "exportExcel", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('datasets/:table/export'),
    __param(0, (0, common_1.Param)('table')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "export", null);
exports.UploadsController = UploadsController = __decorate([
    (0, common_1.Controller)('api/uploads'),
    __metadata("design:paramtypes", [uploads_service_1.UploadsService])
], UploadsController);
//# sourceMappingURL=uploads.controller.js.map