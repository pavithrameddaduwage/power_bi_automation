import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { jwtConstants } from '../constants';

@Injectable()
export class ExternalWebtoolGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private authService: AuthService  // Add this
  ) {}

  private extractToken(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      // Verify JWT token using your existing secret
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.secret  // Use your existing secret
      });
      
      // Validate payload has required info
      this.validatePayload(payload);

      // Add user info to request
      request.user = payload;
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private validatePayload(payload: any) {
    // Verify payload has minimum required fields from your AD login
    const requiredFields = ['email', 'name', 'department'];
    for (const field of requiredFields) {
      if (!payload[field]) {
        throw new UnauthorizedException(`Missing required field: ${field}`);
      }
    }
  }
}