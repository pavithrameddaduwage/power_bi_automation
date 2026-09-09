import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SyncApiService } from './sync.service';
import { ToastService } from './toast.service';

export interface SystemPermission {
  key: string;
  label: string;
  category: 'Navigation Links' | 'System & Data Access';
}

export const SYSTEM_PERMISSIONS: SystemPermission[] = [
  { key: 'usage_analytics', label: 'Usage Analytics', category: 'Navigation Links' },
  { key: 'reports', label: 'Reports Automation', category: 'Navigation Links' },
  { key: 'stored_datasets', label: 'Stored Datasets', category: 'Navigation Links' },
  { key: 'jobs_schedules', label: 'Jobs & Schedules', category: 'Navigation Links' },
  { key: 'email_history', label: 'Email History', category: 'Navigation Links' },
  { key: 'user_management', label: 'User Details & Management', category: 'Navigation Links' },
  { key: 'roles_permissions', label: 'Roles & Permissions', category: 'Navigation Links' },
  { key: 'workspace_management', label: 'Workspace Management', category: 'System & Data Access' },
  { key: 'report_config', label: 'Report Configuration', category: 'System & Data Access' },
  { key: 'display_view', label: 'Display Views', category: 'System & Data Access' },
  { key: 'report_scheduler', label: 'Report Scheduler', category: 'System & Data Access' },
  { key: 'workspace_access', label: 'Workspace Access', category: 'System & Data Access' },
  { key: 'csv_export', label: 'CSV Export', category: 'System & Data Access' },
  { key: 'filter_sort', label: 'Filter & Sort', category: 'System & Data Access' },
];

@Component({
  selector: 'app-roles-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="roles-permissions-container">
      <!-- Header -->
      <div class="page-header row-between">
        <div>
          <h2>Roles &amp; Permissions Management</h2>
          <p class="subtext">Manage Active Directory users, assign system roles, and configure navigation link permissions.</p>
        </div>
        <div class="actions">
          <button class="btn-sync-ad" (click)="syncADUsers()" [disabled]="syncingAD()">
            <span *ngIf="syncingAD()" class="spinner-sm"></span>
            <svg *ngIf="!syncingAD()" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l5.64 5.64A9 9 0 0 0 20.49 15"></path></svg>
            Sync AD Users
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tab-bar">
        <button class="tab-btn" [class.active]="activeTab() === 'users'" (click)="activeTab.set('users')">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          Active Directory Users ({{ users().length }})
        </button>
        <button class="tab-btn" [class.active]="activeTab() === 'roles'" (click)="activeTab.set('roles')">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          Roles &amp; Permissions ({{ roles().length }})
        </button>
      </div>

      <!-- Tab 1: AD Users List -->
      <div *ngIf="activeTab() === 'users'" class="card tab-content">
        <div class="row-between table-toolbar">
          <input
            type="text"
            class="search-input"
            placeholder="Search users by name or email..."
            [(ngModel)]="userSearch"
          />
          <span class="user-count">{{ filteredUsers().length }} users loaded</span>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>User Name</th>
                <th>Email Address</th>
                <th>Assigned Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of filteredUsers()">
                <td style="font-weight: 600; color: #1e293b;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="avatar-sm">{{ getInitials(u.name) }}</div>
                    <span>{{ u.name }}</span>
                  </div>
                </td>
                <td style="color: #64748b;">{{ u.email }}</td>
                <td>
                  <select
                    class="role-select"
                    [ngModel]="u.role"
                    (ngModelChange)="onUserRoleChange(u, $event)"
                  >
                    <option *ngFor="let r of roles()" [value]="r.role">{{ r.role }}</option>
                  </select>
                </td>
                <td>
                  <span class="status-chip" [class.active]="u.is_active" [class.inactive]="!u.is_active">
                    {{ u.is_active ? 'Active' : 'Disabled' }}
                  </span>
                </td>
                <td>
                  <button class="btn-sm btn-save" (click)="saveUserRole(u)" [disabled]="savingUser() === u.id">
                    <span *ngIf="savingUser() === u.id" class="spinner-xs"></span>
                    Save
                  </button>
                </td>
              </tr>
              <tr *ngIf="filteredUsers().length === 0">
                <td colspan="5" class="empty-state">No matching users found. Click "Sync AD Users" to refresh directory users.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab 2: Roles & Nav Permissions Matrix -->
      <div *ngIf="activeTab() === 'roles'" class="card tab-content">
        <div class="roles-grid">
          <!-- Role selector sidebar -->
          <div class="role-list-sidebar">
            <div class="role-sidebar-header">
              <span>Select System Role</span>
              <button class="btn-xs" (click)="showNewRoleModal.set(true)">+ New Role</button>
            </div>
            <div
              *ngFor="let r of roles()"
              class="role-card-item"
              [class.active]="selectedRole()?.id === r.id"
              (click)="selectRole(r)"
            >
              <div class="role-title">{{ r.role }}</div>
              <div class="role-meta">{{ r.permissions?.length || 0 }} permissions enabled</div>
            </div>
          </div>

          <!-- Permissions config panel -->
          <div class="permissions-panel" *ngIf="selectedRole() as sel">
            <div class="row-between panel-header">
              <div>
                <h3>Configure Permissions — <span style="color:#2563eb;">{{ sel.role }}</span></h3>
                <p style="font-size:12px; color:#64748b; margin:2px 0 0 0;">Check navigation links and feature capabilities for users with this role.</p>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn-secondary-sm" (click)="selectAllPermissions(true)">Select All</button>
                <button class="btn-secondary-sm" (click)="selectAllPermissions(false)">Deselect All</button>
                <button class="btn-primary-sm" (click)="saveRolePermissions()" [disabled]="savingRole()">
                  <span *ngIf="savingRole()" class="spinner-xs"></span>
                  Save Permissions
                </button>
              </div>
            </div>

            <!-- Permission Groups -->
            <div class="perm-groups">
              <!-- Navigation Links Group -->
              <div class="perm-section">
                <h4 class="perm-section-title">Sidebar Navigation Links</h4>
                <div class="perm-grid">
                  <label *ngFor="let p of getNavPermissions()" class="perm-checkbox-card">
                    <input
                      type="checkbox"
                      [checked]="hasPermission(p.key)"
                      (change)="togglePermission(p.key)"
                    />
                    <div class="perm-label-wrap">
                      <span class="perm-name">{{ p.label }}</span>
                      <span class="perm-code">Key: {{ p.key }}</span>
                    </div>
                  </label>
                </div>
              </div>

              <!-- System Access Group -->
              <div class="perm-section" style="margin-top:20px;">
                <h4 class="perm-section-title">System &amp; Data Access Capabilities</h4>
                <div class="perm-grid">
                  <label *ngFor="let p of getSystemPermissions()" class="perm-checkbox-card">
                    <input
                      type="checkbox"
                      [checked]="hasPermission(p.key)"
                      (change)="togglePermission(p.key)"
                    />
                    <div class="perm-label-wrap">
                      <span class="perm-name">{{ p.label }}</span>
                      <span class="perm-code">Key: {{ p.key }}</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- New Role Modal -->
    <div class="modal-backdrop" *ngIf="showNewRoleModal()">
      <div class="modal-card">
        <h3>Create New System Role</h3>
        <p style="font-size:12px; color:#64748b; margin-bottom:16px;">Enter a unique title for the new user role.</p>
        <input
          type="text"
          class="modal-input"
          placeholder="e.g. Regional Analyst"
          [(ngModel)]="newRoleName"
        />
        <div class="modal-actions">
          <button class="btn-secondary-sm" (click)="showNewRoleModal.set(false)">Cancel</button>
          <button class="btn-primary-sm" (click)="createNewRole()">Create Role</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .roles-permissions-container { display: flex; flex-direction: column; gap: 20px; }
    .row-between { display: flex; align-items: center; justify-content: space-between; }
    .page-header h2 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .subtext { font-size: 12px; color: #64748b; margin: 4px 0 0 0; }
    
    .btn-sync-ad {
      background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe;
      padding: 8px 16px; border-radius: 8px; font-size: 12.5px; font-weight: 600;
      cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s;
    }
    .btn-sync-ad:hover { background: #dbeafe; border-color: #93c5fd; }
    
    .tab-bar { display: flex; gap: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
    .tab-btn {
      background: transparent; border: none; padding: 10px 16px; font-size: 13px; font-weight: 600;
      color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; display: flex; align-items: center; gap: 8px;
      transition: all 0.2s;
    }
    .tab-btn.active { color: #2563eb; border-bottom-color: #2563eb; }

    .card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
    .table-toolbar { margin-bottom: 16px; }
    .search-input { width: 300px; padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 12.5px; outline: none; }
    .search-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
    .user-count { font-size: 12px; color: #64748b; font-weight: 500; }

    .table-container { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 12.5px; text-align: left; }
    .data-table th { background: #f8fafc; padding: 12px 16px; font-weight: 700; color: #334155; border-bottom: 1px solid #e2e8f0; }
    .data-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .data-table tr:last-child td { border-bottom: none; }
    .avatar-sm { width: 32px; height: 32px; border-radius: 50%; background: #dbeafe; color: #1d4ed8; font-weight: 700; font-size: 11px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

    .role-select { padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; background: white; outline: none; font-weight: 500; }
    .status-chip { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .status-chip.active { background: #dcfce7; color: #15803d; }
    .status-chip.inactive { background: #fee2e2; color: #b91c1c; }

    .btn-save { background: #3b82f6; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-save:hover { background: #2563eb; }

    /* Roles Matrix Layout */
    .roles-grid { display: grid; grid-template-columns: 240px 1fr; gap: 20px; min-height: 400px; }
    .role-list-sidebar { border-right: 1px solid #f1f5f9; padding-right: 16px; display: flex; flex-direction: column; gap: 8px; }
    .role-sidebar-header { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 8px; }
    .role-card-item { padding: 12px 14px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; transition: all 0.2s; }
    .role-card-item:hover { background: #f1f5f9; }
    .role-card-item.active { background: #eff6ff; border-color: #93c5fd; box-shadow: 0 2px 4px rgba(37,99,235,0.05); }
    .role-title { font-weight: 700; font-size: 13px; color: #0f172a; }
    .role-meta { font-size: 11px; color: #64748b; margin-top: 3px; }

    .permissions-panel { padding-left: 8px; }
    .panel-header { margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; }
    .panel-header h3 { font-size: 16px; font-weight: 700; margin: 0; color: #0f172a; }

    .perm-section-title { font-size: 13px; font-weight: 700; color: #334155; margin: 0 0 10px 0; letter-spacing: 0.3px; }
    .perm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
    .perm-checkbox-card {
      display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 8px;
      border: 1px solid #e2e8f0; background: #ffffff; cursor: pointer; transition: all 0.15s;
    }
    .perm-checkbox-card:hover { border-color: #cbd5e1; background: #f8fafc; }
    .perm-checkbox-card input[type="checkbox"] { margin-top: 2px; cursor: pointer; width: 15px; height: 15px; }
    .perm-label-wrap { display: flex; flex-direction: column; }
    .perm-name { font-size: 12px; font-weight: 600; color: #1e293b; }
    .perm-code { font-size: 10.5px; color: #94a3b8; margin-top: 1px; }

    .btn-xs { font-size: 11px; padding: 3px 8px; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px; cursor: pointer; font-weight: 600; }
    .btn-secondary-sm { padding: 6px 12px; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-primary-sm { padding: 6px 14px; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }

    .spinner-sm { display: inline-block; width: 14px; height: 14px; border: 2px solid #93c5fd; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.6s linear infinite; }
    .spinner-xs { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-card { background: white; padding: 24px; border-radius: 12px; width: 340px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); }
    .modal-card h3 { margin: 0 0 6px 0; font-size: 16px; color: #0f172a; }
    .modal-input { width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; margin-bottom: 16px; box-sizing: border-box; outline: none; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .empty-state { text-align: center; color: #94a3b8; padding: 30px; }
  `]
})
export class RolesPermissionsComponent implements OnInit {
  private api = inject(SyncApiService);
  private toast = inject(ToastService);

  activeTab = signal<'users' | 'roles'>('users');
  users = signal<any[]>([]);
  roles = signal<any[]>([]);
  selectedRole = signal<any | null>(null);
  selectedPermissions = signal<Set<string>>(new Set());

  userSearch = '';
  syncingAD = signal(false);
  savingUser = signal<number | null>(null);
  savingRole = signal(false);
  showNewRoleModal = signal(false);
  newRoleName = '';

  ngOnInit() {
    this.loadUsers();
    this.loadRoles();
  }

  loadUsers() {
    this.api.findAllUsers().subscribe({
      next: (res) => {
        this.users.set(res || []);
      },
      error: (err) => {
        this.toast.error('Failed to load users list.');
      },
    });
  }

  loadRoles() {
    this.api.findAllRoles().subscribe({
      next: (res) => {
        this.roles.set(res || []);
        if (res && res.length > 0 && !this.selectedRole()) {
          this.selectRole(res[0]);
        }
      },
      error: (err) => {
        this.toast.error('Failed to load roles master data.');
      },
    });
  }

  filteredUsers() {
    const q = (this.userSearch || '').toLowerCase().trim();
    if (!q) return this.users();
    return this.users().filter(u =>
      (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
    );
  }

  getInitials(name: string): string {
    const parts = (name || 'User').trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name || 'US').slice(0, 2).toUpperCase();
  }

  syncADUsers() {
    this.syncingAD.set(true);
    this.api.syncADUsers().subscribe({
      next: (res) => {
        this.syncingAD.set(false);
        this.toast.success(res?.message || 'Active Directory user sync completed.');
        this.loadUsers();
      },
      error: (err) => {
        this.syncingAD.set(false);
        this.toast.error(err?.error?.message || err?.message || 'AD user sync failed.');
      },
    });
  }

  onUserRoleChange(user: any, newRole: string) {
    user.role = newRole;
    user.is_admin = newRole.toLowerCase() === 'admin' || newRole.toLowerCase() === 'super admin';
  }

  saveUserRole(user: any) {
    this.savingUser.set(user.id);
    this.api.createRole(user.role, [], user.id).subscribe({
      next: () => {
        this.savingUser.set(null);
        this.toast.success(`Updated role for ${user.name}`);
        this.loadUsers();
      },
      error: (err) => {
        this.savingUser.set(null);
        this.toast.error('Failed to update user role.');
      },
    });
  }

  selectRole(role: any) {
    this.selectedRole.set(role);
    const perms = Array.isArray(role.permissions) ? role.permissions : [];
    this.selectedPermissions.set(new Set(perms));
  }

  getNavPermissions() {
    return SYSTEM_PERMISSIONS.filter(p => p.category === 'Navigation Links');
  }

  getSystemPermissions() {
    return SYSTEM_PERMISSIONS.filter(p => p.category === 'System & Data Access');
  }

  hasPermission(key: string): boolean {
    return this.selectedPermissions().has(key);
  }

  togglePermission(key: string) {
    const current = new Set(this.selectedPermissions());
    if (current.has(key)) {
      current.delete(key);
    } else {
      current.add(key);
    }
    this.selectedPermissions.set(current);
  }

  selectAllPermissions(enable: boolean) {
    if (enable) {
      this.selectedPermissions.set(new Set(SYSTEM_PERMISSIONS.map(p => p.key)));
    } else {
      this.selectedPermissions.set(new Set());
    }
  }

  saveRolePermissions() {
    const role = this.selectedRole();
    if (!role) return;

    const perms = Array.from(this.selectedPermissions());
    this.savingRole.set(true);

    this.api.createRole(role.role, perms, role.id).subscribe({
      next: (updatedRole) => {
        this.savingRole.set(false);
        this.toast.success(`Permissions saved for role ${role.role}`);
        this.loadRoles();
      },
      error: (err) => {
        this.savingRole.set(false);
        this.toast.error('Failed to save role permissions.');
      },
    });
  }

  createNewRole() {
    const name = (this.newRoleName || '').trim();
    if (!name) {
      this.toast.error('Please enter a valid role name.');
      return;
    }

    this.api.createRole(name, ['reports', 'stored_datasets', 'csv_export', 'filter_sort']).subscribe({
      next: (created) => {
        this.newRoleName = '';
        this.showNewRoleModal.set(false);
        this.toast.success(`Role "${name}" created successfully.`);
        this.loadRoles();
      },
      error: (err) => {
        this.toast.error('Failed to create role.');
      },
    });
  }
}
