import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { DatabasesService, DbConnectionDto } from './databases.service';

@Controller('api/databases')
export class DatabasesController {
  constructor(private readonly svc: DatabasesService) {}

  /** List all saved connections (passwords redacted). */
  @Get()
  list() {
    return this.svc.list();
  }

  /**
   * Test connectivity without saving.
   * Body: { host, port?, dbname, username, password, label? }
   */
  @Post('test')
  test(@Body() dto: DbConnectionDto) {
    return this.svc.testConnection(dto);
  }

  /**
   * Create a new database on a remote server, bootstrap the schema,
   * save the connection, and make it the active sync target.
   */
  @Post()
  create(@Body() dto: DbConnectionDto) {
    return this.svc.createAndRegister(dto);
  }

  /** Make an existing saved connection the active sync target. */
  @Put(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.svc.activate(id).then(() => ({ ok: true }));
  }

  /** Deactivate (fall back to the primary pool). */
  @Put(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deactivate(id).then(() => ({ ok: true }));
  }

  /** Delete a saved connection. */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id).then(() => ({ ok: true }));
  }
}
