import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { SyncService } from './sync.service';
export declare class SyncScheduler implements OnModuleInit {
    private readonly config;
    private readonly sync;
    private readonly registry;
    private readonly logger;
    constructor(config: ConfigService, sync: SyncService, registry: SchedulerRegistry);
    onModuleInit(): void;
    private run;
}
