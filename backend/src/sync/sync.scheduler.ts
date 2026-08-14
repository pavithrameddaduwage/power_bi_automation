import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SyncService } from './sync.service';
import { UsageService } from '../usage/usage.service';

@Injectable()
export class SyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(SyncScheduler.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sync: SyncService,
    private readonly usage: UsageService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const cron = this.config.get<string>('syncCron')!;
    const job = new CronJob(cron, () => this.run(), null, false, 'UTC');
    this.registry.addCronJob('weekly-sync', job as any);
    job.start();
    this.logger.log(`Weekly sync scheduled with cron "${cron}" (UTC).`);

    // Hourly scheduler for usage data collection: runs every hour at minute 0
    const usageJob = new CronJob('0 * * * *', () => this.runUsageSync(), null, false, 'UTC');
    this.registry.addCronJob('hourly-usage-sync', usageJob as any);
    usageJob.start();
    this.logger.log('Hourly usage metrics sync scheduled with cron "0 * * * *" (UTC).');
  }

  private async run() {
    this.logger.log('Scheduled sync starting...');
    const { results, errors } = await this.sync.syncAll();
    this.logger.log(
      `Scheduled sync done. ${results.length} ok, ${errors.length} failed.`,
    );
    if (errors.length) this.logger.error(errors.join(' | '));
  }

  private async runUsageSync() {
    this.logger.log('Scheduled hourly usage metrics collection starting...');
    try {
      const reports = await this.usage.listUsageReports();
      this.logger.log(`Found ${reports.length} usage reports to process.`);
      for (const r of reports) {
        try {
          this.logger.log(`Processing usage dataset ${r.datasetId} for workspace ${r.groupName}...`);
          await this.usage.getUsageAnalytics(r.groupId, r.datasetId);
        } catch (err: any) {
          this.logger.error(`Failed to sync usage analytics for report ${r.reportName}: ${err.message}`);
        }
      }
      this.logger.log('Scheduled hourly usage metrics collection finished.');
    } catch (err: any) {
      this.logger.error(`Failed usage metrics list collection: ${err.message}`);
    }
  }
}
