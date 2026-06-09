import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Acquires a Power BI access token using the OAuth2 client-credentials grant
 * (service principal). Tokens are cached until shortly before they expire.
 */
@Injectable()
export class PowerBiAuthService {
  private readonly logger = new Logger(PowerBiAuthService.name);
  private cachedToken: string | null = null;
  private expiresAt = 0; // epoch ms

  constructor(private readonly config: ConfigService) {}

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    // Reuse the cached token if it has more than 60s of life left.
    if (this.cachedToken && now < this.expiresAt - 60_000) {
      return this.cachedToken;
    }

    const tenantId = this.config.get<string>('tenantId')!;
    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.get<string>('clientId')!,
      client_secret: this.config.get<string>('clientSecret')!,
      scope: this.config.get<string>('powerbiScope')!,
    });

    try {
      const { data } = await axios.post(url, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      this.cachedToken = data.access_token;
      this.expiresAt = now + (data.expires_in ?? 3600) * 1000;
      this.logger.log('Acquired new Power BI access token.');
      return this.cachedToken!;
    } catch (err: any) {
      const detail = err?.response?.data?.error_description || err.message;
      this.logger.error(`Token request failed: ${detail}`);
      throw new Error(`Azure AD token request failed: ${detail}`);
    }
  }
}
