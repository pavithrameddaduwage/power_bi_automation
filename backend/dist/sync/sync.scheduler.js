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
const usage_service_1 = require("../usage/usage.service");
let SyncScheduler = SyncScheduler_1 = class SyncScheduler {
    constructor(config, sync, usage, registry) {
        this.config = config;
        this.sync = sync;
        this.usage = usage;
        this.registry = registry;
        this.logger = new common_1.Logger(SyncScheduler_1.name);
    }
    onModuleInit() {
        const cron = this.config.get('syncCron');
        const job = new cron_1.CronJob(cron, () => this.run(), null, false, 'UTC');
        this.registry.addCronJob('weekly-sync', job);
        job.start();
        this.logger.log(`Weekly sync scheduled with cron "${cron}" (UTC).`);
        const usageJob = new cron_1.CronJob('0 * * * *', () => this.runUsageSync(), null, false, 'UTC');
        this.registry.addCronJob('hourly-usage-sync', usageJob);
        usageJob.start();
        this.logger.log('Hourly usage metrics sync scheduled with cron "0 * * * *" (UTC).');
        this.logger.log('Executing initial usage metrics synchronization on startup...');
        this.runUsageSync().catch(err => this.logger.error('Startup usage metrics sync failed', err));
    }
    async run() {
        this.logger.log('Scheduled sync starting...');
        const { results, errors } = await this.sync.syncAll();
        this.logger.log(`Scheduled sync done. ${results.length} ok, ${errors.length} failed.`);
        if (errors.length)
            this.logger.error(errors.join(' | '));
    }
    async runUsageSync() {
        this.logger.log('Scheduled hourly usage metrics collection starting...');
        try {
            const reports = await this.usage.listUsageReports();
            this.logger.log(`Found ${reports.length} usage reports to process.`);
            for (const r of reports) {
                try {
                    this.logger.log(`Processing usage dataset ${r.datasetId} for workspace ${r.groupName}...`);
                    await this.usage.getUsageAnalytics(r.groupId, r.datasetId);
                }
                catch (err) {
                    this.logger.error(`Failed to sync usage analytics for report ${r.reportName}: ${err.message}`);
                }
            }
            this.logger.log('Scheduled hourly usage metrics collection finished.');
        }
        catch (err) {
            this.logger.error(`Failed usage metrics list collection: ${err.message}`);
        }
    }
};
exports.SyncScheduler = SyncScheduler;
exports.SyncScheduler = SyncScheduler = SyncScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        sync_service_1.SyncService,
        usage_service_1.UsageService,
        schedule_1.SchedulerRegistry])
], SyncScheduler);
//# sourceMappingURL=sync.scheduler.js.map