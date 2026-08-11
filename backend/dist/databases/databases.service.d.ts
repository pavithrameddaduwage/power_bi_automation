import { OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
export interface DbConnectionDto {
    label: string;
    host: string;
    port?: number;
    dbname: string;
    username: string;
    password: string;
}
export interface DbConnection {
    id: number;
    label: string;
    host: string;
    port: number;
    dbname: string;
    username: string;
    is_active: boolean;
    created_at: string;
}
export declare class DatabasesService implements OnModuleDestroy {
    private readonly primaryPool;
    private readonly logger;
    private readonly poolCache;
    private activePool;
    private activeId;
    constructor(primaryPool: Pool);
    onModuleDestroy(): Promise<void>;
    private ensureRegistry;
    list(): Promise<DbConnection[]>;
    testConnection(dto: DbConnectionDto): Promise<{
        ok: boolean;
        error?: string;
    }>;
    createAndRegister(dto: DbConnectionDto): Promise<DbConnection>;
    activate(id: number): Promise<void>;
    deactivate(id: number): Promise<void>;
    remove(id: number): Promise<void>;
    getActivePool(): Promise<Pool>;
    private createDatabaseIfAbsent;
    private bootstrapSchema;
}
