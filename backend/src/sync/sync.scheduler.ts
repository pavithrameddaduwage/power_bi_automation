import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SyncService } from './sync.service';

@Injectable()
export class SyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(SyncScheduler.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sync: SyncService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const cron = this.config.get<string>('syncCron')!;
    const job = new CronJob(cron, () => this.run(), null, false, 'UTC');
    this.registry.addCronJob('weekly-sync', job as any);
    job.start();
    this.logger.log(`Weekly sync scheduled with cron "${cron}" (UTC).`);
  }

  private async run() {
    this.logger.log('Scheduled sync starting...');
    const { results, errors } = await this.sync.syncAll();
    this.logger.log(
      `Scheduled sync done. ${results.length} ok, ${errors.length} failed.`,
    );
    if (errors.length) this.logger.error(errors.join(' | '));
  }
}
