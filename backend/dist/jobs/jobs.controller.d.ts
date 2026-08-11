import { JobsService, CreateJobDto } from './jobs.service';
export declare class JobsController {
    private readonly jobs;
    constructor(jobs: JobsService);
    list(): Promise<any[]>;
    create(dto: CreateJobDto): Promise<any>;
    run(id: string): Promise<{
        rowsWritten: number;
        totalRows: number;
    }>;
    remove(id: string): Promise<{
        deleted: boolean;
    }>;
}
