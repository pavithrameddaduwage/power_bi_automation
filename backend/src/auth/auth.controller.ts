import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Request,
  Param,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { Public } from './decorators/public.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  @Public() 
  @HttpCode(HttpStatus.OK)
  @Post('login')
    async signIn(@Body() signInDto: Record<string, any>) {
    try {
      const result = await this.authService.signIn(
        signInDto.username, 
        signInDto.pass
      );
      return result;
    } catch (error) {
      console.error('Login error in controller:', error);
      throw error;
    }
  }
  //   @UseGuards(AuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user;
  }

  @Get('getADUserDetails/:userId')
  getADUserDetails(@Param('userId') userId: string) {
    return this.authService.getADUserDetails(userId);
  }


  @Post('searchUsers')
  @Public()
  async searchUsers(@Body() data: any) {
    try {
      const users = await this.authService.searchUsers(data.searchkey);
      return users;
    } catch (error: any) {
      return { error: 'Failed to search users', details: error.message };
    }
  }
}
