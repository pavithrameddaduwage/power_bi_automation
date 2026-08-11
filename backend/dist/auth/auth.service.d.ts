import { JwtService } from '@nestjs/jwt';
import { ADUser } from './interfaces/ad-user.interface';
export declare class AuthService {
    private jwtService;
    constructor(jwtService: JwtService);
    authenticateuser(username: string, password: string): Promise<boolean>;
    getADUserDetails(username: string): Promise<ADUser>;
    signIn(username: string, pass: string): Promise<any>;
    searchUsers(query: string): Promise<any[]>;
}
