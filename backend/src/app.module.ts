import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { DatabaseModule } from './db/database.module';
import { UpsertService } from './db/upsert.service';
import { PowerBiAuthService } from './auth/powerbi-auth.service';
import { PowerBiService } from './powerbi/powerbi.service';
import { SyncService } from './sync/sync.service';
import { SyncController } from './sync/sync.controller';
import { SyncScheduler } from './sync/sync.scheduler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    DatabaseModule,
  ],
  controllers: [SyncController],
  providers: [
    PowerBiAuthService,
    PowerBiService,
    UpsertService,
    SyncService,
    SyncScheduler,
  ],
})
export class AppModule {}
