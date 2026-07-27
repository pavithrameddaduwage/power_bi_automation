 import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
 import { Reflector } from '@nestjs/core';

// @Injectable()
// export class RolesGuard implements CanActivate {
//   constructor(private reflector: Reflector) {}

//   canActivate(context: ExecutionContext): boolean {
//     const roles = this.reflector.get<string[]>('roles', context.getHandler());
//     const request = context.switchToHttp().getRequest();
//     return this.matchRoles(roles, request.user.roles);
//   }

//   private matchRoles(requiredRoles: string[], userRoles: string[]): boolean {
//     return requiredRoles.some(role => userRoles.includes(role));
//   }
// }

// role.guard.ts
// @Injectable()
// export class RolesGuard implements CanActivate {
//   constructor(private reflector: Reflector) {}

//   canActivate(context: ExecutionContext): boolean {
//     const roles = this.reflector.get<string[]>('roles', context.getHandler());
//     if (!roles) {
//       return true;
//     }
//     const request = context.switchToHttp().getRequest();
    
//     // Add this console log
//     console.log('Required roles:', roles);
//     console.log('User roles:', request.user.roles);
    
//     return this.matchRoles(roles, request.user.roles);
//   }

//   private matchRoles(requiredRoles: string[], userRoles: string[]): boolean {
//     // Make the role check case-insensitive
//     const normalizedUserRoles = userRoles.map(role => role.toLowerCase());
//     const normalizedRequiredRoles = requiredRoles.map(role => role.toLowerCase());
//     return normalizedRequiredRoles.some(role => normalizedUserRoles.includes(role));
//   }
// }

// role.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRole = this.reflector.get<string>('role', context.getHandler()) || 
                        this.reflector.get<string>('role', context.getClass());
    
    if (!requiredRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRoles = request.user.roles;

    // console.log('Required role:', requiredRole);
    // console.log('User roles:', userRoles);

    return this.matchRoles([requiredRole], userRoles);
  }

  private matchRoles(requiredRoles: string[], userRoles: string[]): boolean {
    const normalizedUserRoles = userRoles.map(role => role.toLowerCase());
    const normalizedRequiredRoles = requiredRoles.map(role => role.toLowerCase());
    
    // console.log('Normalized user roles:', normalizedUserRoles);
    // console.log('Normalized required roles:', normalizedRequiredRoles);
    
    return normalizedRequiredRoles.some(role => normalizedUserRoles.includes(role));
  }
}