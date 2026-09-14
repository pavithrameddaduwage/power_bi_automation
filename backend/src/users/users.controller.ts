import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Header, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Get('findAllUsers')
  findAllUsers() {
    return this.usersService.findAllUsers();
  }

  @Public()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Get('search-ad')
  searchADUsers(@Query('query') query: string) {
    return this.usersService.searchADUsers(query);
  }

  @Public()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @HttpCode(HttpStatus.OK)
  @Post('findUserByEmail')
  findUserByEmail(@Body() data: { email: any; userid?: string }) {
    return this.usersService.findUserByEmail(data.email, data.userid);
  }

  @Public()
  @Post('createUser')
  createUser(@Body() data: any) {
    return this.usersService.createUser(data);
  }

  @Public()
  @Post('updateUserRole')
  updateUserRole(@Body() data: { userId: number; role: string; is_admin?: boolean }) {
    return this.usersService.updateUserRole(data.userId, data.role, data.is_admin);
  }

  @Public()
  @Patch('updateUserRole/:id')
  updateUserRoleParam(@Param('id') id: number, @Body() data: { role: string; is_admin?: boolean }) {
    return this.usersService.updateUserRole(id, data.role, data.is_admin);
  }

  @Public()
  @Delete('deleteUser/:id')
  deleteUser(@Param('id') id: number) {
    return this.usersService.deleteUser(id);
  }

  @Public()
  @Post('bulk-access')
  bulkAllocateUsers(@Body() data: { userIds: number[]; workspaceIds: number[]; reportIds: number[]; displayviewIds: number[] }) {
    return this.usersService.bulkAllocateUsers(data);
  }

  @Public()
  @Get('findAllRoles')
  findAllRoles() {
    return this.usersService.findAllRoles();
  }

  @Public()
  @Post('createRole')
  createRole(@Body() data: { id?: number; role: string }) {
    return this.usersService.createRole(data);
  }

  @Public()
  @Delete('deleteRole/:id')
  deleteRole(@Param('id') id: number) {
    return this.usersService.deleteRole(id);
  }

  @Public()
  @Post('sync-ad')
  @HttpCode(HttpStatus.OK)
  syncADUsers() {
    return this.usersService.syncADUsers();
  }

  @Public()
  @Post('purgeAutoSynced')
  @HttpCode(HttpStatus.OK)
  purgeAutoSyncedUsers() {
    return this.usersService.purgeAutoSyncedUsers();
  }
}
