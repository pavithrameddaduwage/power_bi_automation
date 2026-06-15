import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  UploadsService,
  UploadReportDto,
  UploadPrincipalsDto,
} from './uploads.service';

@Controller('api/uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** Upload / append a custom report's rows (dynamic schema). */
  @Post('report')
  uploadReport(@Body() dto: UploadReportDto) {
    return this.uploads.uploadReport(dto);
  }

  /** Upload / append custom principals (dynamic schema). */
  @Post('principals')
  uploadPrincipals(@Body() dto: UploadPrincipalsDto) {
    return this.uploads.uploadPrincipals(dto);
  }

  /** Pull principals from Power BI into the principals table (idempotent). */
  @Post('principals/sync')
  syncPrincipals() {
    return this.uploads.syncPrincipalsFromPowerBi();
  }

  /** Every dynamically-created dataset (custom reports + principals). */
  @Get('datasets')
  datasets() {
    return this.uploads.listDatasets();
  }

  /** Preview rows from one dynamic dataset. */
  @Get('datasets/:table/rows')
  rows(@Param('table') table: string, @Query('limit') limit?: string) {
    return this.uploads.previewRows(
      table,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  /** Download a dynamic dataset as CSV (opens in Excel). */
  @Get('datasets/:table/export')
  async export(@Param('table') table: string, @Res() res: Response) {
    const csv = await this.uploads.exportCsv(table);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${table}.csv"`,
    );
    res.send(csv);
  }
}
