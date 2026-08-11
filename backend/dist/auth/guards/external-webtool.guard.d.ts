import { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
export declare class ExternalWebtoolGuard implements CanActivate {
    private jwtService;
    private authService;
    constructor(jwtService: JwtService, authService: AuthService);
    private extractToken;
    canActivate(context: ExecutionContext): Promise<boolean>;
    private validatePayload;
}
