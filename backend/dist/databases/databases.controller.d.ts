import { DatabasesService, DbConnectionDto } from './databases.service';
export declare class DatabasesController {
    private readonly svc;
    constructor(svc: DatabasesService);
    list(): Promise<import("./databases.service").DbConnection[]>;
    test(dto: DbConnectionDto): Promise<{
        ok: boolean;
        error?: string;
    }>;
    create(dto: DbConnectionDto): Promise<import("./databases.service").DbConnection>;
    activate(id: number): Promise<{
        ok: boolean;
    }>;
    deactivate(id: number): Promise<{
        ok: boolean;
    }>;
    remove(id: number): Promise<{
        ok: boolean;
    }>;
}
