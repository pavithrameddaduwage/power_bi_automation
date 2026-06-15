import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { JobsService, CreateJobDto } from './jobs.service';

@Controller('api/jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  /** All saved jobs. */
  @Get()
  list() {
    return this.jobs.list();
  }

  /** Save a new job (report + table + columns + mode + optional schedule). */
  @Post()
  create(@Body() dto: CreateJobDto) {
    return this.jobs.create(dto);
  }

  /** Run a saved job now. */
  @Post(':id/run')
  run(@Param('id') id: string) {
    return this.jobs.runJob(parseInt(id, 10));
  }

  /** Delete a job (and unschedule it). */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.jobs.remove(parseInt(id, 10));
    return { deleted: true };
  }
}
