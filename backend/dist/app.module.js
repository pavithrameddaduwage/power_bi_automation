"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const configuration_1 = __importDefault(require("./config/configuration"));
const database_module_1 = require("./db/database.module");
const upsert_service_1 = require("./db/upsert.service");
const dynamic_table_service_1 = require("./db/dynamic-table.service");
const powerbi_auth_service_1 = require("./auth/powerbi-auth.service");
const powerbi_service_1 = require("./powerbi/powerbi.service");
const sync_service_1 = require("./sync/sync.service");
const sync_controller_1 = require("./sync/sync.controller");
const sync_scheduler_1 = require("./sync/sync.scheduler");
const catalog_controller_1 = require("./catalog/catalog.controller");
const uploads_controller_1 = require("./uploads/uploads.controller");
const uploads_service_1 = require("./uploads/uploads.service");
const jobs_controller_1 = require("./jobs/jobs.controller");
const jobs_service_1 = require("./jobs/jobs.service");
const auth_module_1 = require("./auth/auth.module");
const databases_module_1 = require("./databases/databases.module");
const excel_service_1 = require("./exports/excel.service");
const email_service_1 = require("./notifications/email.service");
const usage_controller_1 = require("./usage/usage.controller");
const usage_service_1 = require("./usage/usage.service");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, load: [configuration_1.default] }),
            schedule_1.ScheduleModule.forRoot(),
            database_module_1.DatabaseModule,
            databases_module_1.DatabasesModule,
            auth_module_1.AuthModule,
        ],
        controllers: [
            sync_controller_1.SyncController,
            catalog_controller_1.CatalogController,
            uploads_controller_1.UploadsController,
            jobs_controller_1.JobsController,
            usage_controller_1.UsageController,
        ],
        providers: [
            powerbi_auth_service_1.PowerBiAuthService,
            powerbi_service_1.PowerBiService,
            upsert_service_1.UpsertService,
            dynamic_table_service_1.DynamicTableService,
            sync_service_1.SyncService,
            sync_scheduler_1.SyncScheduler,
            uploads_service_1.UploadsService,
            jobs_service_1.JobsService,
            excel_service_1.ExcelService,
            email_service_1.EmailService,
            usage_service_1.UsageService,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map