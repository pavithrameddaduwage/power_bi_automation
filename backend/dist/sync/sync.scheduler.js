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
var SyncScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncScheduler = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const cron_1 = require("cron");
const sync_service_1 = require("./sync.service");
let SyncScheduler = SyncScheduler_1 = class SyncScheduler {
    constructor(config, sync, registry) {
        this.config = config;
        this.sync = sync;
        this.registry = registry;
        this.logger = new common_1.Logger(SyncScheduler_1.name);
    }
    onModuleInit() {
        const cron = this.config.get('syncCron');
        const job = new cron_1.CronJob(cron, () => this.run(), null, false, 'UTC');
        this.registry.addCronJob('weekly-sync', job);
        job.start();
        this.logger.log(`Weekly sync scheduled with cron "${cron}" (UTC).`);
    }
    async run() {
        this.logger.log('Scheduled sync starting...');
        const { results, errors } = await this.sync.syncAll();
        this.logger.log(`Scheduled sync done. ${results.length} ok, ${errors.length} failed.`);
        if (errors.length)
            this.logger.error(errors.join(' | '));
    }
};
exports.SyncScheduler = SyncScheduler;
exports.SyncScheduler = SyncScheduler = SyncScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        sync_service_1.SyncService,
        schedule_1.SchedulerRegistry])
], SyncScheduler);
//# sourceMappingURL=sync.scheduler.js.map