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

  private async executeADQuery(queryOpts: any, isSearch: boolean = false): Promise<any[]> {
    const rawUrl = process.env.LDAP_URL || 'ldap://HGUNBXDC01VM.Horizongroupusa.com';
    const rawBaseDN = process.env.LDAP_BASE_DN || 'dc=Horizongroupusa,dc=com';
    const rawUser = (process.env.LDAP_USERNAME || 'MISSVCACC').trim();
    const rawPass = process.env.LDAP_PASSWORD || 'Horizon@MIS';

    // Build candidate bind usernames
    const candidates: string[] = [];
    if (rawUser.includes('@') || rawUser.includes('\\')) {
      candidates.push(rawUser);
    } else {
      const domainFromDn = rawBaseDN
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.toLowerCase().startsWith('dc='))
        .map((p) => p.substring(3))
        .join('.');

      if (domainFromDn) {
        candidates.push(`${rawUser}@${domainFromDn}`);
      }
      candidates.push(`${rawUser}@horizongroupusa.com`);
      candidates.push(`${rawUser}@hgusa.com`);
      candidates.push(`horizongroupusa\\${rawUser}`);
      candidates.push(`HGUSA\\${rawUser}`);
      candidates.push(rawUser);
    }

    const uniqueCandidates = [...new Set(candidates)];
    let lastError: any = null;

    for (const bindUser of uniqueCandidates) {
      const config = {
        url: rawUrl,
        baseDN: rawBaseDN,
        username: bindUser,
        password: rawPass,
        paged: true,
        pageSize: 500,
        attributes: {
          user: ['sAMAccountName', 'mail', 'cn', 'displayName', 'givenName', 'sn', 'department', 'userAccountControl'],
        },
        tlsOptions: { rejectUnauthorized: false },
        timeout: isSearch ? 10000 : 35000,
        reconnect: false,
        connectTimeout: isSearch ? 6000 : 12000,
      };

      try {
        const ad = new ActiveDirectory(config);
        const users = await new Promise<any[]>((resolve, reject) => {
          let isDone = false;
          const timer = setTimeout(() => {
            if (!isDone) {
              isDone = true;
              if (isSearch) resolve([]);
              else reject(new Error('AD search timed out.'));
            }
          }, isSearch ? 10000 : 35000);

          ad.findUsers(queryOpts, false, (err: any, foundUsers: any[]) => {
            if (!isDone) {
              isDone = true;
              clearTimeout(timer);
              if (err) return reject(err);
              resolve(foundUsers || []);
            }
          });
        });

        this.logger.log(`[ActiveDirectory] Bind success with account "${bindUser}". Retrieved ${users.length} records.`);
        return users;
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        this.logger.warn(`[ActiveDirectory] Bind attempt with "${bindUser}" failed: ${msg}`);
        if (
          msg.includes('52e') ||
          msg.includes('credentials') ||
          msg.includes('InvalidCredentials') ||
          msg.includes('AcceptSecurityContext') ||
          msg.includes('NoSuchObject')
        ) {
          continue;
        }
        break;
      }
    }

    throw lastError || new Error('Active Directory LDAP query failed with all candidate bind usernames.');
  }

  async syncADUsers(): Promise<{ success: boolean; totalADUsersFound: number; newlySynced: number; updated: number; message: string }> {
    await this.ensureTables();

    this.logger.log(`Starting AD user sync with LDAP pagination and multi-domain bind resolver...`);

    const queryOpts = {
      filter: '(&(objectCategory=person)(objectClass=user))',
      paged: true,
      pageSize: 500,
      attributes: ['sAMAccountName', 'mail', 'cn', 'displayName', 'givenName', 'sn', 'department', 'userAccountControl'],
    };

    try {
      const users = await this.executeADQuery(queryOpts, false);

      if (!users || users.length === 0) {
        this.logger.log('No AD users returned from directory search.');
        return {
          success: true,
          totalADUsersFound: 0,
          newlySynced: 0,
          updated: 0,
          message: 'No AD users found in directory.',
        };
      }

      this.logger.log(`Fetched ${users.length} AD users from directory. Processing database sync...`);

      // 1. Fetch existing users from DB into Map for fast O(1) lookup
      const existingRes = await this.pool.query(`SELECT id, LOWER(email) as email, name, is_active FROM app_users`);
      const existingMap = new Map<string, { id: number; name: string; is_active: boolean }>();
      for (const row of existingRes.rows) {
        existingMap.set(row.email, { id: Number(row.id), name: row.name, is_active: row.is_active });
      }

      // 2. Fetch default 'User' role ID
      const roleRes = await this.pool.query(`SELECT id FROM role_master WHERE LOWER(role) = 'user'`);
      const defaultRoleId = roleRes.rows.length > 0 ? roleRes.rows[0].id : null;

      // 3. Categorize AD users into insert and update lists
      const usersToInsert: { email: string; name: string; isActive: boolean }[] = [];
      const usersToUpdate: { id: number; name: string; isActive: boolean }[] = [];
      const processedEmails = new Set<string>();

      for (const adUser of users) {
        const rawMail = adUser.mail || (adUser.sAMAccountName ? `${adUser.sAMAccountName}@hgusa.com` : null);
        if (!rawMail) continue;

        const email = String(rawMail).trim().toLowerCase();
        if (processedEmails.has(email)) continue;
        processedEmails.add(email);

        const name = adUser.displayName || adUser.cn || `${adUser.givenName || ''} ${adUser.sn || ''}`.trim() || adUser.sAMAccountName || email;
        const uac = Number(adUser.userAccountControl || 0);
        const isActive = (uac & 2) === 0;

        const existing = existingMap.get(email);
        if (!existing) {
          usersToInsert.push({ email, name, isActive });
        } else if (existing.name !== name || existing.is_active !== isActive) {
          usersToUpdate.push({ id: existing.id, name, isActive });
        }
      }

      let newlySynced = 0;
      let updated = 0;
      const CHUNK_SIZE = 300;

      // 4. Batch INSERT new users
      if (usersToInsert.length > 0) {
        for (let i = 0; i < usersToInsert.length; i += CHUNK_SIZE) {
          const chunk = usersToInsert.slice(i, i + CHUNK_SIZE);
          const valuePlaceholders: string[] = [];
          const params: any[] = [];

          chunk.forEach((u, idx) => {
            const base = idx * 3;
            valuePlaceholders.push(`($${base + 1}, $${base + 2}, false, 'User', $${base + 3})`);
            params.push(u.email, u.name, u.isActive);
          });

          const insertSql = `
            INSERT INTO app_users (email, name, is_admin, role, is_active)
            VALUES ${valuePlaceholders.join(', ')}
            ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active, updated_at = now()
            RETURNING id;
          `;
          const insertedRes = await this.pool.query(insertSql, params);

          if (defaultRoleId && insertedRes.rows.length > 0) {
            const rolePlaceholders: string[] = [];
            const roleParams: any[] = [defaultRoleId];
            insertedRes.rows.forEach((row, idx) => {
              rolePlaceholders.push(`($${idx + 2}, $1)`);
              roleParams.push(row.id);
            });
            await this.pool.query(
              `INSERT INTO user_roles (user_id, role_id) VALUES ${rolePlaceholders.join(', ')} ON CONFLICT DO NOTHING`,
              roleParams,
            );
          }
        }
        newlySynced = usersToInsert.length;
      }

      // 5. Batch UPDATE existing users
      if (usersToUpdate.length > 0) {
        for (let i = 0; i < usersToUpdate.length; i += CHUNK_SIZE) {
          const chunk = usersToUpdate.slice(i, i + CHUNK_SIZE);
          const ids = chunk.map((u) => u.id);
          const names = chunk.map((u) => u.name);
          const actives = chunk.map((u) => u.isActive);

          await this.pool.query(
            `UPDATE app_users AS u
             SET name = c.name, is_active = c.is_active, updated_at = now()
             FROM (SELECT unnest($1::int[]) AS id, unnest($2::text[]) AS name, unnest($3::boolean[]) AS is_active) AS c
             WHERE u.id = c.id`,
            [ids, names, actives],
          );
        }
        updated = usersToUpdate.length;
      }

      const msg = `Synced ${users.length} total AD users from directory (${newlySynced} new added, ${updated} updated).`;
      this.logger.log(msg);

      return {
        success: true,
        totalADUsersFound: users.length,
        newlySynced,
        updated,
        message: msg,
      };
    } catch (err: any) {
      this.logger.error(`AD Sync error: ${err.message || err}`);
      return {
        success: false,
        totalADUsersFound: 0,
        newlySynced: 0,
        updated: 0,
        message: `Active Directory sync failed: ${err.message || 'LDAP connection error'}`,
      };
    }
  }

  async searchADUsers(query: string): Promise<any[]> {
    const searchText = String(query || '').trim();
    if (searchText.length < 2) return this.findAllUsers();

    const escapeLDAP = (value: string) => value.replace(/[\\*()\0]/g, (character) => `\\${character.charCodeAt(0).toString(16).padStart(2, '0')}`);
    const escapedQuery = escapeLDAP(searchText);
    const syncedEmails = new Set<string>();

    try {
      const queryOpts = {
        filter: `(&(objectCategory=person)(objectClass=user)(|(displayName=*${escapedQuery}*)(cn=*${escapedQuery}*)(mail=*${escapedQuery}*)(sAMAccountName=*${escapedQuery}*)(givenName=*${escapedQuery}*)(sn=*${escapedQuery}*)))`,
        paged: true,
        pageSize: 500,
        attributes: ['sAMAccountName', 'mail', 'cn', 'displayName', 'givenName', 'sn', 'department', 'userAccountControl'],
      };

      const users = await this.executeADQuery(queryOpts, true);

      const roleRes = await this.pool.query(`SELECT id FROM role_master WHERE LOWER(role) = 'user'`);
      const defaultRoleId = roleRes.rows[0]?.id;

      for (const adUser of users) {
        const rawMail = adUser.mail || (adUser.sAMAccountName ? `${adUser.sAMAccountName}@hgusa.com` : null);
        if (!rawMail) continue;

        const email = String(rawMail).trim().toLowerCase();
        syncedEmails.add(email);

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

        if (defaultRoleId && result.rows[0]?.id) {
          await this.pool.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [result.rows[0].id, defaultRoleId],
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`AD Live search notice for query "${searchText}": ${err?.message || err}`);
    }

    const allUsers = await this.findAllUsers();
    const normalizedQuery = searchText.toLowerCase();
    return allUsers.filter((user) =>
      syncedEmails.has((user.email || '').toLowerCase()) ||
      (user.name || '').toLowerCase().includes(normalizedQuery) ||
      (user.email || '').toLowerCase().includes(normalizedQuery),
    );
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

  async updateUserRole(userId: number, role: string, isAdminParam?: boolean): Promise<any> {
    await this.ensureTables();
    const cleanRole = String(role || 'User').trim();
    const isAdmin = isAdminParam !== undefined ? Boolean(isAdminParam) : (cleanRole.toLowerCase() === 'admin' || cleanRole.toLowerCase() === 'super admin');

    await this.pool.query(
      `UPDATE app_users SET role = $1, is_admin = $2, updated_at = now() WHERE id = $3`,
      [cleanRole, isAdmin, userId],
    );

    // Sync with user_roles table
    await this.pool.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
    const roleNames = cleanRole.split(',').map((r: string) => r.trim()).filter(Boolean);
    for (const rName of roleNames) {
      const rRes = await this.pool.query(`SELECT id FROM role_master WHERE LOWER(role) = LOWER($1)`, [rName]);
      if (rRes.rows.length > 0) {
        await this.pool.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, rRes.rows[0].id],
        );
      }
    }

    const { rows } = await this.pool.query(
      `SELECT u.id, u.email, u.name, u.is_admin, u.role, u.is_active, u.updated_at,
              COALESCE(json_agg(rm.role) FILTER (WHERE rm.role IS NOT NULL), '[]') as user_roles
         FROM app_users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN role_master rm ON ur.role_id = rm.id
        WHERE u.id = $1
        GROUP BY u.id`,
      [userId],
    );

    return rows[0] || { id: userId, role: cleanRole, is_admin: isAdmin };
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
        `INSERT INTO role_master (role, permissions) VALUES ($1, $2) ON CONFLICT (role) DO UPDATE SET permissions = EXCLUDED.permissions RETURNING *`,
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
