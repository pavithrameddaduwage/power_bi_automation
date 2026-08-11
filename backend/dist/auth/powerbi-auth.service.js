"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var PowerBiAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PowerBiAuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
let PowerBiAuthService = PowerBiAuthService_1 = class PowerBiAuthService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(PowerBiAuthService_1.name);
        this.cachedToken = null;
        this.expiresAt = 0;
    }
    async getAccessToken() {
        const now = Date.now();
        if (this.cachedToken && now < this.expiresAt - 60_000) {
            return this.cachedToken;
        }
        const tenantId = this.config.get('tenantId');
        const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.config.get('clientId'),
            client_secret: this.config.get('clientSecret'),
            scope: this.config.get('powerbiScope'),
        });
        try {
            const { data } = await axios_1.default.post(url, body.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            this.cachedToken = data.access_token;
            this.expiresAt = now + (data.expires_in ?? 3600) * 1000;
            this.logger.log('Acquired new Power BI access token.');
            return this.cachedToken;
        }
        catch (err) {
            const detail = err?.response?.data?.error_description || err.message;
            this.logger.error(`Token request failed: ${detail}`);
            throw new Error(`Azure AD token request failed: ${detail}`);
        }
    }
};
exports.PowerBiAuthService = PowerBiAuthService;
exports.PowerBiAuthService = PowerBiAuthService = PowerBiAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PowerBiAuthService);
//# sourceMappingURL=powerbi-auth.service.js.map