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
import { Public } from '../auth/decorators/public.decorator';

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

  /** Get the last successful sync timestamp for a table (for Delta mode). */
  @Get('datasets/:table/last-sync')
  async lastSync(@Param('table') table: string) {
    const lastSyncAt = await this.uploads.getLastSyncAt(table);
    return { lastSyncAt };
  }

  /** Email a dynamic dataset */
  @Post('datasets/:table/email')
  emailDataset(@Param('table') table: string, @Body() body: { recipients: string[], subject: string }) {
    return this.uploads.emailDataset(table, body.recipients, body.subject);
  }

  /** Email delivery logs history */
  @Get('email-history')
  emailHistory() {
    return this.uploads.getEmailHistory();
  }

  /** Get current SMTP config status */
  @Get('smtp-config')
  smtpConfig() {
    return this.uploads.getSmtpConfig();
  }

  /** Save and test SMTP config */
  @Post('smtp-config')
  saveSmtpConfig(@Body() body: any) {
    return this.uploads.saveSmtpConfig(body);
  }

  /** Send a live test email to verify mailbox receipt */
  @Post('send-test-email')
  sendTestEmail(@Body() body: { toEmail: string }) {
    return this.uploads.sendTestEmail(body);
  }

  /** Directly email an Excel report of given rows to recipients */
  @Post('send-email-report')
  sendEmailReport(@Body() body: { reportName: string; rows: any[]; recipients: string[]; subject?: string }) {
    return this.uploads.sendEmailReport(body);
  }

  /** Export given rows directly as a downloadable Excel (.xlsx) file */
  @Public()
  @Post('export-excel')
  async exportExcel(@Body() body: { reportName?: string; rows: any[] }, @Res() res: Response) {
    const buffer = await this.uploads.exportExcelBuffer(body.reportName, body.rows);
    const safeName = (body.reportName || 'report').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${safeName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  /** Download a dynamic dataset as CSV (opens in Excel). */
  @Public()
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
