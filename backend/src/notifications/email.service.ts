import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    // In a real scenario, these come from .env
    const host = this.configService.get<string>('SMTP_HOST') || 'smtp.example.com';
    const port = parseInt(this.configService.get<string>('SMTP_PORT') || '587', 10);
    const user = this.configService.get<string>('SMTP_USER') || 'user@example.com';
    const pass = this.configService.get<string>('SMTP_PASS') || 'password';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      // TLS option can be adjusted for local dev/testing
      tls: { rejectUnauthorized: false }
    });
  }

  async sendReport(recipients: string[], subject: string, excelBuffer: Buffer, fileName: string): Promise<void> {
    if (!recipients || recipients.length === 0) {
      this.logger.warn('No recipients provided for email.');
      return;
    }

    const to = recipients.join(', ');
    const from = this.configService.get<string>('SMTP_FROM') || '"Power BI Backup" <noreply@example.com>';

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject,
        text: `Attached is the new report: ${fileName}`,
        attachments: [
          {
            filename: fileName,
            content: excelBuffer,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          }
        ]
      });
      this.logger.log(`Email sent successfully to ${to} with subject "${subject}"`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error}`);
      // Don't throw if email fails, so it doesn't break the upload flow
    }
  }
}
