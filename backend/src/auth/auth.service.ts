import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ADUser } from './interfaces/ad-user.interface';
import { PG_POOL } from '../db/database.module';
import { Pool } from 'pg';

const ActiveDirectory = require('activedirectory2').promiseWrapper;

const getADConfig = () => ({
  url: process.env.LDAP_URL || 'ldap://HGUNBXDC01VM.Horizongroupusa.com',
  baseDN: process.env.LDAP_BASE_DN || 'dc=Horizongroupusa,dc=com',
  username: process.env.LDAP_USERNAME || 'MISSVCACC',
  password: process.env.LDAP_PASSWORD || 'Horizon@MIS',
  attributes: {
    user: [],
  },
  tlsOptions: {
    rejectUnauthorized: false,
  },
  timeout: 8000,
  reconnect: false,
  connectTimeout: 5000,
});
const ad = new ActiveDirectory(getADConfig());

const ALL_PERMISSIONS = [
  'usage_analytics',
  'reports',
  'stored_datasets',
  'jobs_schedules',
  'email_history',
  'user_management',
  'roles_permissions',
  'workspace_management',
  'report_config',
  'display_view',
  'report_scheduler',
  'workspace_access',
  'csv_export',
  'filter_sort',
];

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async authenticateuser(username: string, password: string): Promise<boolean> {
    try {
      console.log('Attempting AD authentication for:', username);
      return new Promise<boolean>((resolve) => {
        ad.authenticate(username, password, (err: any, auth: boolean) => {
          if (err) {
            console.log('AD authentication error:', err.message);
            resolve(false);
          } else {
            resolve(auth);
          }
        });
      });
    } catch (error) {
      console.error('AD authentication unexpected error:', error);
      return false;
    }
  }

  async getADUserDetails(username: string): Promise<ADUser> {
    let user = await new Promise<ADUser>((resolve, reject) => {
      ad.findUser(username, function (err: any, user: ADUser) {
        if (err) {
          reject(err);
        }
        if (user) {
          resolve(user);
        } else {
          resolve(null as any);
        }
      });
    });
    return user;
  }

  async signIn(username: string, pass: string): Promise<any> {
    const rawUsername = username.trim().toLowerCase();
    username = rawUsername.split('@')[0];

    // ── Dev bypass: admin / 1234 or admin / admin ─────────────
    if (username === 'admin' && (pass === '1234' || pass === 'admin')) {
      console.log('[DEV] Admin bypass login used');

      // Fetch or seed Admin in DB to get assigned permissions
      let adminRolePerms = ALL_PERMISSIONS;
      try {
        const { rows } = await this.pool.query(
          `SELECT permissions FROM role_master WHERE LOWER(role) = 'admin' OR LOWER(role) = 'super admin'`,
        );
        if (rows.length > 0 && rows[0].permissions) {
          adminRolePerms = JSON.parse(rows[0].permissions);
        }
      } catch (e) {}

      const adminPayload = {
        id: 0,
        email: 'admin@hgusa.com',
        name: 'Admin',
        userid: 'admin',
        is_admin: true,
        role: 'Admin',
        roles: ['Admin', 'Super Admin'],
        permissions: adminRolePerms,
        department: 'MIS',
        location: null,
      };
      return {
        access_token: await this.jwtService.signAsync(adminPayload),
        user: adminPayload,
      };
    }
    // ──────────────────────────────────────────────────────────

    let email = '';
    let aduser: any = null;

    // Authenticate with Active Directory LDAP
    let adauthentication = await this.authenticateuser(`${username}@hgusa.com`, pass);
    if (!adauthentication) {
      console.log('First domain auth failed, trying second domain...');
      adauthentication = await this.authenticateuser(`${username}@horizongroupusa.com`, pass);
    }

    if (!adauthentication) {
      console.log('AD Authentication failed for user:', username);
      throw new UnauthorizedException('Active Directory authentication failed - Please check your credentials');
    } else {
      console.log('AD Authentication successful, getting AD user details...');
      try {
        aduser = await this.getADUserDetails(username);
      } catch (e) {
        console.log('Failed to fetch AD details, continuing with basics');
      }

      if (!aduser || !aduser.mail) {
        aduser = {
          mail: `${username}@hgusa.com`,
          cn: username,
          department: null,
          location: null,
        };
      }
      email = aduser.mail.toLowerCase();
    }

    // Lookup user in PostgreSQL database to resolve actual assigned Roles & Permissions
    let dbUser: any = null;
    try {
      const { rows } = await this.pool.query(
        `SELECT u.id, u.email, u.name, u.is_admin, u.role, u.is_active
           FROM app_users u
          WHERE LOWER(u.email) = $1 OR LOWER(u.email) = $2 OR LOWER(u.email) = $3
          LIMIT 1`,
        [email, `${username}@hgusa.com`, `${username}@horizongroupusa.com`],
      );

      if (rows.length > 0) {
        dbUser = rows[0];
      } else {
        // Auto-provision user into DB if logging in for the first time
        const displayName = aduser.cn || username;
        const insertRes = await this.pool.query(
          `INSERT INTO app_users (email, name, is_admin, role, is_active)
           VALUES ($1, $2, false, 'User', true)
           RETURNING id, email, name, is_admin, role, is_active`,
          [email, displayName],
        );
        dbUser = insertRes.rows[0];

        // Link to default User role
        const defaultRoleRes = await this.pool.query(`SELECT id FROM role_master WHERE LOWER(role) = 'user'`);
        if (defaultRoleRes.rows.length > 0) {
          await this.pool.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [dbUser.id, defaultRoleRes.rows[0].id],
          );
        }
      }
    } catch (err: any) {
      console.warn('Database lookup during auth notice:', err?.message || err);
    }

    // Determine assigned Roles
    const roles: string[] = (dbUser?.role || 'User').split(',').map((r: string) => r.trim()).filter(Boolean);
    if (dbUser?.is_admin && !roles.includes('Admin')) {
      roles.push('Admin');
    }

    // Determine assigned Permissions from role_master table
    let permissions: string[] = [];
    try {
      const roleRes = await this.pool.query(
        `SELECT role, permissions FROM role_master WHERE LOWER(role) = ANY($1::text[])`,
        [roles.map((r) => r.toLowerCase())],
      );
      for (const rRow of roleRes.rows) {
        if (rRow.permissions) {
          try {
            const parsed = JSON.parse(rRow.permissions);
            if (Array.isArray(parsed)) {
              permissions.push(...parsed);
            }
          } catch (e) {}
        }
      }
      permissions = [...new Set(permissions)];
    } catch (err: any) {
      console.warn('Permissions lookup during auth notice:', err?.message || err);
    }

    const isAdmin = Boolean(
      dbUser?.is_admin ||
      roles.some((r) => r.toLowerCase() === 'admin' || r.toLowerCase() === 'super admin'),
    );

    const userPayload = {
      id: dbUser?.id || 0,
      email: email,
      name: dbUser?.name || aduser.cn || username,
      userid: username,
      is_admin: isAdmin,
      role: dbUser?.role || 'User',
      roles: roles,
      permissions: permissions,
      department: aduser.department || null,
      location: aduser.location || null,
    };

    return {
      access_token: await this.jwtService.signAsync(userPayload),
      user: userPayload,
    };
  }

  async searchUsers(query: string): Promise<any[]> {
    const searchQuery = `(&(objectClass=user)(|(cn=${query}*)(mail=${query}*)))`;
    let searchCompleted = false;

    return new Promise((resolve, reject) => {
      let isResolved = false;

      try {
        ad.findUsers(searchQuery, true, (err: any, users: any[]) => {
          if (isResolved || searchCompleted) {
            return;
          }

          if (err) {
            console.error('AD Search Error for:', query, err);
            isResolved = true;
            return resolve([]);
          }

          if (!users || users.length === 0) {
            isResolved = true;
            return resolve([]);
          }

          const formattedUsers = users.map((f: any) => ({
            name: f.cn,
            email: f.mail,
            department: f.department,
          }));

          isResolved = true;
          searchCompleted = true;
          resolve(formattedUsers);
        });
      } catch (error) {
        console.error('Error in AD search for:', query, error);
        if (!isResolved) {
          isResolved = true;
          resolve([]);
        }
      }

      setTimeout(() => {
        if (!isResolved) {
          console.log('AD search timed out for:', query);
          isResolved = true;
          searchCompleted = true;
          resolve([]);
        }
      }, 10000);
    });
  }
}