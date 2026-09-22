import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { JobsService, CreateJobDto } from './jobs.service';

import { Public } from '../auth/decorators/public.decorator';

@Controller(['api/jobs', 'jobs'])
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  /** All saved jobs. */
  @Public()
  @Get()
  list() {
    return this.jobs.list();
  }

  /** Save a new job (report + table + columns + mode + optional schedule). */
  @Public()
  @Post()
  create(@Body() dto: CreateJobDto) {
    return this.jobs.create(dto);
  }

  /** Run a saved job now. */
  @Public()
  @Post(':id/run')
  run(@Param('id') id: string) {
    return this.jobs.runJob(parseInt(id, 10));
  }

  /** Delete a job (and unschedule it). */
  @Public()
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.jobs.remove(parseInt(id, 10));
    return { deleted: true };
  }
}
