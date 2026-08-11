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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private smtpTransporter: nodemailer.Transporter | null = null;
  private currentFromAddress: string = '"Power BI Portal" <noreply@powerbibackup.com>';

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
          this.currentFromAddress = cfg.from_address || `"Power BI Portal" <${cfg.username}>`;
          this.logger.log(`Initialized SMTP transporter for ${cfg.host} (${cfg.username})`);
          return;
        }
      } catch (dbErr: any) {
        // Fallback to env
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
      this.currentFromAddress =
        this.configService.get<string>('SMTP_FROM') || `"Power BI Portal" <${user}>`;
      this.logger.log(`Initialized SMTP transporter from env: ${host}`);
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

  async sendReport(
    recipients: string[],
    subject: string,
    excelBuffer: Buffer,
    fileName: string,
  ): Promise<{ status: string; previewUrl?: string }> {
    if (!recipients || recipients.length === 0) {
      this.logger.warn('No recipients provided for email.');
      return { status: 'skipped' };
    }

    const to = recipients.join(', ');
    const fileSize = excelBuffer ? excelBuffer.length : 0;

    let status = 'sent';
    let previewUrl: string | undefined = undefined;
    let errorMsg: string | undefined = undefined;

    if (!this.smtpTransporter) {
      await this.initTransporter();
    }

    if (this.smtpTransporter) {
      try {
        await this.smtpTransporter.sendMail({
          from: this.currentFromAddress,
          to,
          subject,
          text: `Attached is your requested Power BI export report: ${fileName}`,
          attachments: [
            {
              filename: fileName,
              content: excelBuffer,
              contentType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
          ],
        });
        this.logger.log(`SMTP email sent successfully to ${to} [${subject}]`);
      } catch (err: any) {
        this.logger.warn(`SMTP send failed (${err.message}). Falling back to test transporter.`);
        status = 'fallback';
        errorMsg = err.message;
      }
    } else {
      status = 'test';
    }

    if (status !== 'sent') {
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
          from: `"Power BI Backup" <${testAccount.user}>`,
          to,
          subject,
          text: `Attached is your requested Power BI export report: ${fileName}`,
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
        errorMsg = undefined;
        this.logger.log(`Ethereal test email sent to ${to}. Preview URL: ${previewUrl}`);
      } catch (etherealErr: any) {
        this.logger.warn(`Ethereal creation failed (${etherealErr.message}). Using simulated mode.`);
        status = 'simulated';
        errorMsg = undefined;
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
    });

    return { status, previewUrl };
  }

  private async logEmailHistory(entry: EmailLogEntry): Promise<void> {
    await this.ensureTables();
    if (!this.pool) return;

    try {
      await this.pool.query(
        `INSERT INTO email_history (recipients, subject, file_name, file_size_bytes, status, preview_url, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          entry.recipients,
          entry.subject,
          entry.file_name || null,
          entry.file_size_bytes || 0,
          entry.status,
          entry.preview_url || null,
          entry.error || null,
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
