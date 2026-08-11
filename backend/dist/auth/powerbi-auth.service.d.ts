import { ConfigService } from '@nestjs/config';
export declare class PowerBiAuthService {
    private readonly config;
    private readonly logger;
    private cachedToken;
    private expiresAt;
    constructor(config: ConfigService);
    getAccessToken(): Promise<string>;
}
