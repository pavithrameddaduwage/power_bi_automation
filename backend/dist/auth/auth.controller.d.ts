import { AuthService } from './auth.service';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    signIn(signInDto: Record<string, any>): Promise<any>;
    getProfile(req: any): any;
    getADUserDetails(userId: string): Promise<import("./interfaces/ad-user.interface").ADUser>;
    searchUsers(data: any): Promise<any[] | {
        error: string;
        details: any;
    }>;
}
