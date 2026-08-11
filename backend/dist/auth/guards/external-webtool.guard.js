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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalWebtoolGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const auth_service_1 = require("../auth.service");
const constants_1 = require("../constants");
let ExternalWebtoolGuard = class ExternalWebtoolGuard {
    constructor(jwtService, authService) {
        this.jwtService = jwtService;
        this.authService = authService;
    }
    extractToken(request) {
        const authHeader = request.headers.authorization;
        if (!authHeader)
            return undefined;
        const [type, token] = authHeader.split(' ');
        return type === 'Bearer' ? token : undefined;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const token = this.extractToken(request);
        if (!token) {
            throw new common_1.UnauthorizedException('Missing authentication token');
        }
        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: constants_1.jwtConstants.secret
            });
            this.validatePayload(payload);
            request.user = payload;
            return true;
        }
        catch (error) {
            console.error('Token validation failed:', error);
            throw new common_1.UnauthorizedException('Invalid token');
        }
    }
    validatePayload(payload) {
        const requiredFields = ['email', 'name', 'department'];
        for (const field of requiredFields) {
            if (!payload[field]) {
                throw new common_1.UnauthorizedException(`Missing required field: ${field}`);
            }
        }
    }
};
exports.ExternalWebtoolGuard = ExternalWebtoolGuard;
exports.ExternalWebtoolGuard = ExternalWebtoolGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        auth_service_1.AuthService])
], ExternalWebtoolGuard);
//# sourceMappingURL=external-webtool.guard.js.map