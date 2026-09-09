import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

export interface UserInfo {
  id?: number;
  email: string;
  name: string;
  userid?: string;
  is_admin: boolean;
  role?: string;
  roles: string[];
  permissions: string[];
  department?: string | null;
  location?: string | null;
}

export interface AuthResponse {
  access_token: string;
  user?: UserInfo;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenKey = 'pbi_backup_token';
  private userKey = 'pbi_user_info';
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());

  constructor(private http: HttpClient, private router: Router) {}

  login(username: string, pass: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('http://localhost:3000/api/auth/login', { username, pass }).pipe(
      tap(response => {
        if (response.access_token) {
          localStorage.setItem(this.tokenKey, response.access_token);
          if (response.user) {
            localStorage.setItem(this.userKey, JSON.stringify(response.user));
          }
          this.isAuthenticatedSubject.next(true);
        }
      })
    );
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUser(): UserInfo | null {
    try {
      const u = localStorage.getItem(this.userKey);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }

  getPermissions(): string[] {
    const user = this.getUser();
    return user?.permissions || [];
  }

  hasPermission(permKey: string): boolean {
    const user = this.getUser();
    if (!user) return false;
    if (user.is_admin) return true; // Admins bypass all permission checks
    return (user.permissions || []).includes(permKey);
  }

  isAdmin(): boolean {
    const user = this.getUser();
    return user?.is_admin === true;
  }

  isAuthenticated(): boolean {
    return this.hasToken();
  }
  
  isAuthenticated$(): Observable<boolean> {
    return this.isAuthenticatedSubject.asObservable();
  }

  private hasToken(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }
}
