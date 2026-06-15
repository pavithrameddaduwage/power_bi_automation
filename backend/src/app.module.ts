import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { DatabaseModule } from './db/database.module';
import { UpsertService } from './db/upsert.service';
import { DynamicTableService } from './db/dynamic-table.service';
import { PowerBiAuthService } from './auth/powerbi-auth.service';
import { PowerBiService } from './powerbi/powerbi.service';
import { SyncService } from './sync/sync.service';
import { SyncController } from './sync/sync.controller';
import { SyncScheduler } from './sync/sync.scheduler';
import { CatalogController } from './catalog/catalog.controller';
import { UploadsController } from './uploads/uploads.controller';
import { UploadsService } from './uploads/uploads.service';
import { JobsController } from './jobs/jobs.controller';
import { JobsService } from './jobs/jobs.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    DatabaseModule,
  ],
  controllers: [
    SyncController,
    CatalogController,
    UploadsController,
    JobsController,
  ],
  providers: [
    PowerBiAuthService,
    PowerBiService,
    UpsertService,
    DynamicTableService,
    SyncService,
    SyncScheduler,
    UploadsService,
    JobsService,
  ],
})
export class AppModule {}
