import { Injectable, OnModuleInit, Inject, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PG_POOL } from '../db/database.module';
import { Pool } from 'pg';

const ActiveDirectory = require('activedirectory2').promiseWrapper;

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

const USER_PERMISSIONS = [
  'reports',
  'stored_datasets',
  'workspace_access',
  'csv_export',
  'filter_sort',
];

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleInit() {
    await this.ensureTables();
    await this.seedDefaultRolesAndPermissions();
    await this.seedAdminUser();
    // Run AD user sync asynchronously without blocking app startup
    this.syncADUsers().catch((err) => {
      this.logger.warn(`[AD Sync Notice] Initial AD user sync warning: ${err?.message || err}`);
    });
  }

  // ── Database Table Bootstrap ────────────────────────────────────────

  async ensureTables(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS app_users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          is_admin BOOLEAN DEFAULT false,
          role TEXT DEFAULT 'User',
          is_active BOOLEAN DEFAULT true,
          updated_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS role_master (
          id SERIAL PRIMARY KEY,
          role TEXT UNIQUE NOT NULL,
          permissions TEXT
        );

        CREATE TABLE IF NOT EXISTS user_roles (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE,
          role_id INTEGER REFERENCES role_master(id) ON DELETE CASCADE,
          UNIQUE(user_id, role_id)
        );
      `);
      this.logger.log('[Bootstrap] Ensured app_users, role_master, and user_roles tables.');
    } catch (err: any) {
      this.logger.error('[Bootstrap] Failed ensuring user tables:', err?.message || err);
    }
  }

  // ── Seed Roles & Permissions ────────────────────────────────────────

  async seedDefaultRolesAndPermissions(): Promise<void> {
    try {
      const defaultRoles = [
        {
          role: 'Super Admin',
          permissions: JSON.stringify(ALL_PERMISSIONS),
        },
        {
          role: 'Admin',
          permissions: JSON.stringify(ALL_PERMISSIONS),
        },
        {
          role: 'User',
          permissions: JSON.stringify(USER_PERMISSIONS),
        },
      ];

      for (const r of defaultRoles) {
        await this.pool.query(
          `INSERT INTO role_master (role, permissions)
           VALUES ($1, $2)
           ON CONFLICT (role) DO UPDATE SET permissions = EXCLUDED.permissions`,
          [r.role, r.permissions],
        );
      }
      this.logger.log('[Bootstrap] Seeded default roles & permissions (Super Admin, Admin, User).');
    } catch (err: any) {
      this.logger.warn('[Bootstrap] Role seeding notice:', err?.message || err);
    }
  }

  // ── Seed Default Admin User ─────────────────────────────────────────

  async seedAdminUser(): Promise<void> {
    try {
      const { rows } = await this.pool.query(
        `SELECT id FROM app_users WHERE LOWER(email) = 'admin@hgusa.com'`,
      );
      if (rows.length === 0) {
        const insertRes = await this.pool.query(
          `INSERT INTO app_users (name, email, is_admin, role, is_active)
           VALUES ('Admin', 'admin@hgusa.com', true, 'Admin', true)
           RETURNING id`,
        );
        const userId = insertRes.rows[0].id;

        // Assign Admin role
        const roleRes = await this.pool.query(
          `SELECT id FROM role_master WHERE LOWER(role) = 'admin'`,
        );
        if (roleRes.rows.length > 0) {
          await this.pool.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, roleRes.rows[0].id],
          );
        }
        this.logger.log('[Bootstrap] Default admin user created successfully.');
      }
    } catch (err: any) {
      this.logger.warn('[Bootstrap] Admin user seeding notice:', err?.message || err);
    }
  }

  // ── Active Directory Users Sync ──────────────────────────────────────

  async syncADUsers(): Promise<{ success: boolean; totalADUsersFound: number; newlySynced: number; updated: number; message: string }> {
    const config = {
      url: process.env.LDAP_URL || 'ldap://HGUNBXDC01VM.Horizongroupusa.com',
      baseDN: process.env.LDAP_BASE_DN || 'dc=Horizongroupusa,dc=com',
      username: process.env.LDAP_USERNAME || 'MISSVCACC',
      password: process.env.LDAP_PASSWORD || 'Horizon@MIS',
      attributes: {
        user: ['sAMAccountName', 'mail', 'cn', 'displayName', 'givenName', 'sn', 'department', 'userAccountControl'],
      },
      tlsOptions: {
        rejectUnauthorized: false,
      },
      timeout: 8000,
      reconnect: false,
      connectTimeout: 5000,
    };


  async searchADUsers(query: string): Promise<any[]> {
    const searchText = String(query || '').trim();
    if (searchText.length < 2) return this.findAllUsers();

    const escapeLDAP = (value: string) => value.replace(/[\\*()\0]/g, (character) => `\\${character.charCodeAt(0).toString(16).padStart(2, '0')}`);
    const escapedQuery = escapeLDAP(searchText);
    const config = {
      url: process.env.LDAP_URL || 'ldap://HGUNBXDC01VM.Horizongroupusa.com',
      baseDN: process.env.LDAP_BASE_DN || 'dc=Horizongroupusa,dc=com',
      username: process.env.LDAP_USERNAME || 'MISSVCACC',
      password: process.env.LDAP_PASSWORD || 'Horizon@MIS',
      attributes: {
        user: ['sAMAccountName', 'mail', 'cn', 'displayName', 'givenName', 'sn', 'userAccountControl'],
      },
      tlsOptions: { rejectUnauthorized: false },
      timeout: 8000,
      reconnect: false,
      connectTimeout: 5000,
    };

    const ad = new ActiveDirectory(config);
    const searchQuery = `(&(objectCategory=person)(objectClass=user)(|(displayName=*${escapedQuery}*)(cn=*${escapedQuery}*)(mail=*${escapedQuery}*)(sAMAccountName=*${escapedQuery}*)))`;

    const users = await new Promise<any[]>((resolve, reject) => {
      ad.findUsers(searchQuery, true, (err: any, foundUsers: any[]) => {
        if (err) return reject(err);
        resolve(foundUsers || []);
      });
    });

    const roleRes = await this.pool.query(`SELECT id FROM role_master WHERE LOWER(role) = 'user'`);
    const defaultRoleId = roleRes.rows[0]?.id;

    for (const adUser of users) {
      const rawMail = adUser.mail || (adUser.sAMAccountName ? `${adUser.sAMAccountName}@hgusa.com` : null);
      if (!rawMail) continue;

      const email = String(rawMail).trim().toLowerCase();
      const name = adUser.displayName || adUser.cn || `${adUser.givenName || ''} ${adUser.sn || ''}`.trim() || adUser.sAMAccountName || email;
      const uac = Number(adUser.userAccountControl || 0);
      const isActive = (uac & 2) === 0;
      const result = await this.pool.query(
        `INSERT INTO app_users (email, name, is_admin, role, is_active)
         VALUES ($1, $2, false, 'User', $3)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active, updated_at = now()
         RETURNING id`,
        [email, name, isActive],
      );

      if (defaultRoleId) {
        await this.pool.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [result.rows[0].id, defaultRoleId],
        );
      }
    }

    const allUsers = await this.findAllUsers();
    const normalizedQuery = searchText.toLowerCase();
    return allUsers.filter((user) =>
      (user.name || '').toLowerCase().includes(normalizedQuery) ||
      (user.email || '').toLowerCase().includes(normalizedQuery),
    );
  }
    this.logger.log(`Starting AD user sync from ${config.url} (${config.baseDN})...`);

    const ad = new ActiveDirectory(config);
    const searchQuery = '(&(objectCategory=person)(objectClass=user))';

    return new Promise((resolve, reject) => {
      ad.findUsers(searchQuery, true, async (err: any, users: any[]) => {
        if (err) {
          this.logger.error(`AD Search error during sync: ${err.message || err}`);
          return resolve({
            success: false,
            totalADUsersFound: 0,
            newlySynced: 0,
            updated: 0,
            message: `Active Directory sync failed: ${err.message || 'LDAP connection error'}`,
          });
        }

        if (!users || users.length === 0) {
          this.logger.log('No AD users returned from search.');
          return resolve({
            success: true,
            totalADUsersFound: 0,
            newlySynced: 0,
            updated: 0,
            message: 'No AD users found in directory.',
          });
        }

        let newlySynced = 0;
        let updated = 0;

        // Get default 'User' role ID
        const roleRes = await this.pool.query(`SELECT id FROM role_master WHERE LOWER(role) = 'user'`);
        const defaultRoleId = roleRes.rows.length > 0 ? roleRes.rows[0].id : null;

        for (const adUser of users) {
          try {
            const rawMail = adUser.mail || (adUser.sAMAccountName ? `${adUser.sAMAccountName}@hgusa.com` : null);
            if (!rawMail) continue;

            const email = String(rawMail).trim().toLowerCase();
            const name = adUser.displayName || adUser.cn || `${adUser.givenName || ''} ${adUser.sn || ''}`.trim() || adUser.sAMAccountName || email;
            
            // Check account status: bit 2 (0x2) in userAccountControl indicates disabled account
            const uac = Number(adUser.userAccountControl || 0);
            const isActive = (uac & 2) === 0;

            const existing = await this.pool.query(
              `SELECT id, name, is_active FROM app_users WHERE LOWER(email) = $1`,
              [email],
            );

            if (existing.rows.length === 0) {
              const insertRes = await this.pool.query(
                `INSERT INTO app_users (email, name, is_admin, role, is_active)
                 VALUES ($1, $2, false, 'User', $3)
                 RETURNING id`,
                [email, name, isActive],
              );
              const userId = insertRes.rows[0].id;

              if (defaultRoleId) {
                await this.pool.query(
                  `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                  [userId, defaultRoleId],
                );
              }
              newlySynced++;
            } else {
              const current = existing.rows[0];
              if (current.name !== name || current.is_active !== isActive) {
                await this.pool.query(
                  `UPDATE app_users SET name = $1, is_active = $2, updated_at = now() WHERE id = $3`,
                  [name, isActive, current.id],
                );
                updated++;
              }
            }
          } catch (e: any) {
            this.logger.warn(`Error processing AD user ${adUser.mail || adUser.sAMAccountName}: ${e?.message}`);
          }
        }

        const msg = `Synced ${users.length} AD users (${newlySynced} new, ${updated} updated).`;
        this.logger.log(msg);
        resolve({
          success: true,
          totalADUsersFound: users.length,
          newlySynced,
          updated,
          message: msg,
        });
      });
    });
  }

  // ── Public User API Methods ─────────────────────────────────────────

  async findAllUsers(): Promise<any[]> {
    await this.ensureTables();
    const { rows } = await this.pool.query(`
      SELECT u.id, u.email, u.name, u.is_admin, u.role, u.is_active, u.updated_at,
             COALESCE(json_agg(rm.role) FILTER (WHERE rm.role IS NOT NULL), '[]') as user_roles
        FROM app_users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN role_master rm ON ur.role_id = rm.id
       GROUP BY u.id
       ORDER BY u.id ASC
    `);
    return rows.map(r => ({
      ...r,
      workspaces: [],
      reports: [],
      displayviews: [],
    }));
  }

  async findUserByEmail(email: string, userId?: string): Promise<any | null> {
    await this.ensureTables();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const username = String(userId || normalizedEmail.split('@')[0]).trim().toLowerCase();

    const { rows } = await this.pool.query(
      `SELECT u.id, u.email, u.name, u.is_admin, u.role, u.is_active, u.updated_at,
              COALESCE(json_agg(rm.role) FILTER (WHERE rm.role IS NOT NULL), '[]') as user_roles
         FROM app_users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN role_master rm ON ur.role_id = rm.id
        WHERE LOWER(u.email) = $1 OR LOWER(u.email) = $2 OR LOWER(u.email) = $3
        GROUP BY u.id
        LIMIT 1`,
      [normalizedEmail, `${username}@hgusa.com`, `${username}@horizongroupusa.com`],
    );

    if (rows.length === 0) return null;
    return {
      ...rows[0],
      workspaces: [],
      reports: [],
      displayviews: [],
    };
  }

  async createUser(data: any): Promise<any> {
    await this.ensureTables();
    const email = String(data.email || '').trim().toLowerCase();
    const name = String(data.name || email.split('@')[0] || 'User').trim();
    const role = data.role || (data.is_admin ? 'Admin' : 'User');
    const isAdmin = Boolean(data.is_admin || role.toLowerCase() === 'admin' || role.toLowerCase() === 'super admin');
    const isActive = data.is_active !== undefined ? Boolean(data.is_active) : true;

    let userId: number;
    const existing = await this.pool.query(
      `SELECT id FROM app_users WHERE LOWER(email) = $1`,
      [email],
    );

    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      await this.pool.query(
        `UPDATE app_users SET name = $1, is_admin = $2, role = $3, is_active = $4, updated_at = now() WHERE id = $5`,
        [name, isAdmin, role, isActive, userId],
      );
    } else {
      const insertRes = await this.pool.query(
        `INSERT INTO app_users (email, name, is_admin, role, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [email, name, isAdmin, role, isActive],
      );
      userId = insertRes.rows[0].id;
    }

    // Update user_roles table
    await this.pool.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
    const roleNames = role.split(',').map((r: string) => r.trim()).filter(Boolean);
    for (const rName of roleNames) {
      const rRes = await this.pool.query(`SELECT id FROM role_master WHERE LOWER(role) = LOWER($1)`, [rName]);
      if (rRes.rows.length > 0) {
        await this.pool.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, rRes.rows[0].id],
        );
      }
    }

    return (await this.findUserByEmail(email)) || { id: userId, email, name, is_admin: isAdmin, role, is_active: isActive };
  }

  async deleteUser(id: number): Promise<{ success: boolean; message: string }> {
    await this.ensureTables();
    await this.pool.query(`DELETE FROM user_roles WHERE user_id = $1`, [id]);
    await this.pool.query(`DELETE FROM app_users WHERE id = $1`, [id]);
    return { success: true, message: `User ${id} deleted successfully` };
  }

  async bulkAllocateUsers(data: { userIds: number[]; workspaceIds: number[]; reportIds: number[]; displayviewIds: number[] }): Promise<any> {
    return { success: true, message: `Successfully updated ${data.userIds?.length || 0} users` };
  }

  // ── Role & Permission Master Methods ─────────────────────────────

  async findAllRoles(): Promise<any[]> {
    await this.ensureTables();
    const { rows } = await this.pool.query(`SELECT * FROM role_master ORDER BY id ASC`);
    if (!rows || rows.length === 0) {
      await this.seedDefaultRolesAndPermissions();
      const fresh = await this.pool.query(`SELECT * FROM role_master ORDER BY id ASC`);
      return fresh.rows.map((r) => ({
        ...r,
        permissions: r.permissions ? JSON.parse(r.permissions) : [],
      }));
    }

    return rows.map((r) => {
      let perms: string[] = [];
      try {
        perms = r.permissions ? JSON.parse(r.permissions) : [];
      } catch (e) {
        perms = [];
      }
      return {
        ...r,
        permissions: perms,
      };
    });
  }

  async createRole(data: { id?: number; role: string; permissions?: string[] }): Promise<any> {
    await this.ensureTables();
    if (!data.role || data.role.trim() === '') {
      throw new HttpException('Role name is required', HttpStatus.BAD_REQUEST);
    }

    const roleName = data.role.trim();
    const perms = JSON.stringify(data.permissions || USER_PERMISSIONS);

    let savedRow: any;
    if (data.id && data.id > 0) {
      const { rows } = await this.pool.query(
        `UPDATE role_master SET role = $1, permissions = $2 WHERE id = $3 RETURNING *`,
        [roleName, perms, data.id],
      );
      savedRow = rows[0];
    } else {
      const { rows } = await this.pool.query(
        `INSERT INTO role_master (role, permissions) VALUES ($1, $2) RETURNING *`,
        [roleName, perms],
      );
      savedRow = rows[0];
    }

    return {
      ...savedRow,
      permissions: data.permissions || USER_PERMISSIONS,
    };
  }

  async deleteRole(id: number): Promise<{ success: boolean; message: string }> {
    await this.ensureTables();
    await this.pool.query(`DELETE FROM user_roles WHERE role_id = $1`, [id]);
    await this.pool.query(`DELETE FROM role_master WHERE id = $1`, [id]);
    return { success: true, message: 'Role deleted successfully' };
  }
}
