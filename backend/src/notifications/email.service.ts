import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from '../db/database.module';

export interface EmailLogEntry {
  id?: number;
  recipients: string;
  subject: string;
  file_name?: string;
  file_size_bytes?: number;
  status: string;
  preview_url?: string;
  error?: string;
  sent_at?: Date;
}

export interface SmtpConfigDto {
  host: string;
  port: number;
  username: string;
  password?: string;
  fromAddress?: string;
}

export const DEFAULT_SENDER_EMAIL = 'pmeddaduwage@hgusa.com';
export const DEFAULT_SENDER_NAME = 'Pavithra Meddaduwage';
export const DEFAULT_SENDER_FROM = `"${DEFAULT_SENDER_NAME}" <${DEFAULT_SENDER_EMAIL}>`;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private sendmailTransporter: nodemailer.Transporter | null = null;
  private smtpTransporter: nodemailer.Transporter | null = null;
  private currentFromAddress: string = DEFAULT_SENDER_FROM;

  constructor(
    private configService: ConfigService,
    @Optional() @Inject(PG_POOL) private readonly pool?: Pool,
  ) {
    this.initTransporter();
  }

  async ensureTables(): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS email_history (
          id SERIAL PRIMARY KEY,
          recipients TEXT NOT NULL,
          subject TEXT NOT NULL,
          file_name TEXT,
          file_size_bytes INTEGER DEFAULT 0,
          status TEXT NOT NULL,
          preview_url TEXT,
          error TEXT,
          sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS smtp_config (
          id INT PRIMARY KEY DEFAULT 1,
          host TEXT NOT NULL,
          port INT NOT NULL DEFAULT 587,
          username TEXT NOT NULL,
          password TEXT NOT NULL,
          from_address TEXT,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } catch (err: any) {
      this.logger.error(`Failed to ensure email tables: ${err.message}`);
    }
  }

  private async initTransporter(): Promise<void> {
    await this.ensureTables();

    // Initialize sendmail transporter with fixed sender pmeddaduwage@hgusa.com
    try {
      this.sendmailTransporter = nodemailer.createTransport({
        sendmail: true,
        newline: 'unix',
        path: '/usr/sbin/sendmail',
        args: ['-f', DEFAULT_SENDER_EMAIL],
      });
      this.logger.log(`Initialized sendmail transporter with sender: ${DEFAULT_SENDER_FROM}`);
    } catch (sendmailErr: any) {
      this.logger.warn(`Could not initialize sendmail transport: ${sendmailErr.message}`);
      this.sendmailTransporter = null;
    }

    this.currentFromAddress = DEFAULT_SENDER_FROM;

    if (this.pool) {
      try {
        const { rows } = await this.pool.query(`SELECT * FROM smtp_config WHERE id = 1`);
        if (rows.length > 0 && rows[0].host && rows[0].username) {
          const cfg = rows[0];
          this.smtpTransporter = nodemailer.createTransport({
            host: cfg.host,
            port: cfg.port || 587,
            secure: cfg.port === 465,
            auth: { user: cfg.username, pass: cfg.password },
            tls: { rejectUnauthorized: false },
          });
          this.logger.log(`Initialized optional SMTP transporter for ${cfg.host} (${cfg.username})`);
          return;
        }
      } catch (dbErr: any) {
        // Fallback
      }
    }

    const host = this.configService.get<string>('SMTP_HOST');
    const port = parseInt(this.configService.get<string>('SMTP_PORT') || '587', 10);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (host && host !== 'smtp.example.com' && user && user !== 'user@example.com') {
      this.smtpTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      });
      this.logger.log(`Initialized optional SMTP transporter from env: ${host}`);
    } else {
      this.smtpTransporter = null;
    }
  }

  async getSmtpConfig(): Promise<{ host: string; port: number; username: string; fromAddress: string; isConfigured: boolean }> {
    await this.ensureTables();
    if (this.pool) {
      const { rows } = await this.pool.query(`SELECT host, port, username, from_address FROM smtp_config WHERE id = 1`);
      if (rows.length > 0) {
        return {
          host: rows[0].host,
          port: rows[0].port,
          username: rows[0].username,
          fromAddress: rows[0].from_address || '',
          isConfigured: true,
        };
      }
    }

    const host = this.configService.get<string>('SMTP_HOST') || '';
    const port = parseInt(this.configService.get<string>('SMTP_PORT') || '587', 10);
    const username = this.configService.get<string>('SMTP_USER') || '';
    const fromAddress = this.configService.get<string>('SMTP_FROM') || '';
    const isConfigured = !!(host && host !== 'smtp.example.com' && username && username !== 'user@example.com');

    return { host, port, username, fromAddress, isConfigured };
  }

  async saveSmtpConfig(dto: SmtpConfigDto): Promise<{ ok: boolean; message: string }> {
    await this.ensureTables();
    if (!dto.host?.trim() || !dto.username?.trim()) {
      throw new Error('Host and Username are required.');
    }

    const host = dto.host.trim();
    const port = dto.port || 587;
    const username = dto.username.trim();
    const fromAddress = dto.fromAddress?.trim() || `"Power BI Portal" <${username}>`;

    let password = dto.password?.trim();
    if (!password && this.pool) {
      const existing = await this.pool.query(`SELECT password FROM smtp_config WHERE id = 1`);
      password = existing.rows[0]?.password || '';
    }

    if (!password) {
      throw new Error('Password is required.');
    }

    const testTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: username, pass: password },
      tls: { rejectUnauthorized: false },
    });

    try {
      await testTransporter.verify();
    } catch (verifyErr: any) {
      this.logger.warn(`SMTP Verification failed: ${verifyErr.message}`);
      throw new Error(`SMTP connection test failed: ${verifyErr.message}`);
    }

    if (this.pool) {
      await this.pool.query(
        `INSERT INTO smtp_config (id, host, port, username, password, from_address, updated_at)
         VALUES (1, $1, $2, $3, $4, $5, now())
         ON CONFLICT (id) DO UPDATE SET
           host = EXCLUDED.host,
           port = EXCLUDED.port,
           username = EXCLUDED.username,
           password = EXCLUDED.password,
           from_address = EXCLUDED.from_address,
           updated_at = now()`,
        [host, port, username, password, fromAddress],
      );
    }

    this.smtpTransporter = testTransporter;
    this.currentFromAddress = fromAddress;
    this.logger.log(`SMTP settings updated and verified for ${host} (${username})`);
    return { ok: true, message: `SMTP connected successfully to ${host}!` };
  }

  parseRecipients(recipients: string[] | string): string[] {
    if (!recipients) return [];
    let list: string[] = [];
    if (Array.isArray(recipients)) {
      list = recipients
        .flatMap((r) => (typeof r === 'string' ? r.split(/[,;]+/) : []))
        .map((r) => r.trim());
    } else if (typeof recipients === 'string') {
      list = recipients.split(/[,;]+/).map((r) => r.trim());
    }
    // Deduplicate and filter out empty / invalid addresses
    return Array.from(new Set(list.filter((r) => r.length > 0 && r.includes('@'))));
  }

  private buildHtmlTemplate(params: {
    title: string;
    reportName: string;
    rowCount?: number;
    source?: string;
    fileName: string;
    fileSizeBytes: number;
    sentAt: Date;
    notes?: string;
  }): { html: string; text: string } {
    const formattedDate = params.sentAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const sizeKb = (params.fileSizeBytes / 1024).toFixed(1);
    const rowCountStr = params.rowCount !== undefined ? params.rowCount.toLocaleString() : 'N/A';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title}</title>
</head>
<body style="margin:0; padding:0; background-color:#f0f4f8; font-family:'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; color:#111827;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8; padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:12px; border:1px solid #dde3ec; box-shadow:0 4px 16px rgba(0,0,0,0.06); overflow:hidden;">
          <!-- Header Banner -->
          <tr>
            <td style="background-color:#1d6ef5; padding:24px 32px; color:#ffffff;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin:0; font-size:20px; font-weight:700; color:#ffffff; letter-spacing:-0.3px;">Power BI Portal</h1>
                    <div style="font-size:13px; color:#eff5ff; margin-top:4px; opacity:0.9;">Automated Report Delivery</div>
                  </td>
                  <td align="right" style="font-size:24px;">
                    📊
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 12px; font-size:17px; font-weight:700; color:#111827;">${params.title}</h2>
              <p style="margin:0 0 20px; font-size:14px; color:#4b5563; line-height:1.5;">
                Your requested automated Power BI dataset export is ready. The report spreadsheet has been generated and attached to this email.
              </p>

              <!-- Report Details Table -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:24px;">
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:600; color:#64748b; width:35%;">Report / Dataset:</td>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:700; color:#0f172a;">${params.reportName}</td>
                </tr>
                ${params.source ? `
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:600; color:#64748b;">Source / Schedule:</td>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:600; color:#1d6ef5;">${params.source}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:600; color:#64748b;">Total Rows Exported:</td>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:600; color:#0f172a;">${rowCountStr}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:600; color:#64748b;">Attachment:</td>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:600; color:#0f172a;">📎 ${params.fileName} (${sizeKb} KB)</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; font-size:13px; font-weight:600; color:#64748b;">Generated At:</td>
                  <td style="padding:12px 16px; font-size:13px; font-weight:500; color:#475569;">${formattedDate}</td>
                </tr>
              </table>

              ${params.notes ? `
              <div style="background-color:#eff5ff; border-left:3px solid #1d6ef5; padding:12px 16px; border-radius:4px; font-size:13px; color:#1e40af; margin-bottom:20px;">
                ${params.notes}
              </div>` : ''}

              <p style="margin:0; font-size:13px; color:#64748b; line-height:1.5;">
                You can open the attached <strong>.xlsx</strong> file directly in Microsoft Excel, Power BI, or any standard spreadsheet application.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc; border-top:1px solid #dde3ec; padding:20px 32px; text-align:center; font-size:12px; color:#64748b;">
              <div>This is an automated notification from your <strong>Power BI Backup &amp; Reporting Portal</strong>.</div>
              <div style="margin-top:4px; font-size:11px; color:#94a3b8;">Please do not reply directly to this automated email.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = `
Power BI Portal - Automated Report Delivery
============================================
${params.title}

Report / Dataset: ${params.reportName}
${params.source ? `Source / Schedule: ${params.source}\n` : ''}Total Rows: ${rowCountStr}
Attachment: ${params.fileName} (${sizeKb} KB)
Generated At: ${formattedDate}

${params.notes ? `Note: ${params.notes}\n\n` : ''}Attached is your requested Power BI export report in Excel format (.xlsx).

---
Power BI Automated Reporting Portal
`;

    return { html, text };
  }

  async sendTestEmail(toEmail: string): Promise<{ ok: boolean; message: string; previewUrl?: string }> {
    const validEmails = this.parseRecipients(toEmail);
    if (validEmails.length === 0) {
      throw new Error(`Invalid recipient email address: "${toEmail}".`);
    }

    // Generate a lightweight dummy sample excel buffer
    const header = Buffer.from('Test Power BI Automation Report Export\nGenerated by SMTP Verification Tool\nStatus: OK');
    const fileName = `smtp_test_report_${new Date().toISOString().slice(0, 10)}.xlsx`;

    const res = await this.sendReport(
      validEmails,
      'Power BI Portal: SMTP Connection Test & Verification',
      header,
      fileName,
      {
        reportName: 'SMTP System Test',
        rowCount: 1,
        source: 'Admin Live Verification Tool',
        notes: 'If you are seeing this email, your SMTP configuration is properly authenticated and delivering live emails!',
      },
    );

    return {
      ok: res.status.includes('sent'),
      message: `Test email sent to ${validEmails.join(', ')} (Status: ${res.status}).`,
      previewUrl: res.previewUrl,
    };
  }

  async sendReport(
    recipients: string[] | string,
    subject: string,
    excelBuffer: Buffer,
    fileName: string,
    metadata?: {
      reportName?: string;
      rowCount?: number;
      source?: string;
      notes?: string;
    },
  ): Promise<{ status: string; previewUrl?: string }> {
    const recipientList = this.parseRecipients(recipients);
    if (recipientList.length === 0) {
      this.logger.warn('No valid recipients provided for email.');
      return { status: 'skipped' };
    }

    const to = recipientList.join(', ');
    const fileSize = excelBuffer ? excelBuffer.length : 0;
    const reportName = metadata?.reportName || fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    const sentAt = new Date();

    const { html, text } = this.buildHtmlTemplate({
      title: subject,
      reportName,
      rowCount: metadata?.rowCount,
      source: metadata?.source,
      fileName,
      fileSizeBytes: fileSize,
      sentAt,
      notes: metadata?.notes,
    });

    let status = 'sent';
    let previewUrl: string | undefined = undefined;
    let errorMsg: string | undefined = undefined;

    if (!this.sendmailTransporter && !this.smtpTransporter) {
      await this.initTransporter();
    }

    // 1. Primary: If authenticated SMTP (e.g. Gmail) is configured, use it for direct inbox delivery
    let sentSuccessfully = false;
    if (this.smtpTransporter) {
      try {
        const info = await this.smtpTransporter.sendMail({
          from: this.currentFromAddress,
          to,
          subject,
          text,
          html,
          attachments: [
            {
              filename: fileName,
              content: excelBuffer,
              contentType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
          ],
        });
        status = 'sent';
        sentSuccessfully = true;
        errorMsg = undefined;
        this.logger.log(`SMTP email delivered successfully to ${to} [${subject}] (MessageId: ${info?.messageId || 'OK'})`);
      } catch (err: any) {
        this.logger.warn(`SMTP send failed (${err.message}). Trying sendmail fallback.`);
        errorMsg = err.message;
      }
    }

    // 2. Secondary: Try local sendmail transport
    if (!sentSuccessfully && this.sendmailTransporter) {
      try {
        const info = await this.sendmailTransporter.sendMail({
          from: this.currentFromAddress,
          to,
          subject,
          text,
          html,
          attachments: [
            {
              filename: fileName,
              content: excelBuffer,
              contentType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
          ],
        });
        status = 'sent (sendmail)';
        sentSuccessfully = true;
        errorMsg = undefined;
        this.logger.log(`Sendmail delivered report to ${to} [${subject}] (MessageId: ${info?.messageId || 'OK'})`);
      } catch (sendmailErr: any) {
        this.logger.warn(`Sendmail transport attempt failed: ${sendmailErr.message}. Trying backup test delivery...`);
        errorMsg = sendmailErr.message;
      }
    }

    // 3. Fallback: Ethereal test mailbox for diagnostics
    if (!sentSuccessfully) {
      try {
        const testAccount = await nodemailer.createTestAccount();
        const testTransporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });

        const info = await testTransporter.sendMail({
          from: this.currentFromAddress,
          to,
          subject,
          text,
          html,
          attachments: [
            {
              filename: fileName,
              content: excelBuffer,
              contentType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
          ],
        });

        previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
        status = 'sent (ethereal)';
        this.logger.log(`Ethereal test email sent to ${to}. Preview URL: ${previewUrl}`);
      } catch (etherealErr: any) {
        this.logger.warn(`Ethereal creation failed (${etherealErr.message}). Using simulated mode.`);
        status = 'simulated';
        errorMsg = errorMsg || etherealErr.message;
      }
    }

    await this.logEmailHistory({
      recipients: to,
      subject,
      file_name: fileName,
      file_size_bytes: fileSize,
      status,
      preview_url: previewUrl,
      error: errorMsg,
      sent_at: sentAt,
    });

    return { status, previewUrl };
  }

  private async logEmailHistory(entry: EmailLogEntry): Promise<void> {
    await this.ensureTables();
    if (!this.pool) return;

    try {
      await this.pool.query(
        `INSERT INTO email_history (recipients, subject, file_name, file_size_bytes, status, preview_url, error, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          entry.recipients,
          entry.subject,
          entry.file_name || null,
          entry.file_size_bytes || 0,
          entry.status,
          entry.preview_url || null,
          entry.error || null,
          entry.sent_at || new Date(),
        ],
      );
    } catch (err: any) {
      this.logger.error(`Failed to log email history: ${err.message}`);
    }
  }

  async getEmailHistory(): Promise<EmailLogEntry[]> {
    await this.ensureTables();
    if (!this.pool) return [];

    try {
      const res = await this.pool.query(
        `SELECT * FROM email_history ORDER BY sent_at DESC LIMIT 100`,
      );
      return res.rows;
    } catch (err: any) {
      this.logger.error(`Failed to fetch email history: ${err.message}`);
      return [];
    }
  }
}
