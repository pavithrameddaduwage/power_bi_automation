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
          <p style="font-size:12px; color:#64748b; margin:2px 0 0 0;">Manage explicit system users, assign access roles, and set permission capabilities.</p>
        </div>
        <div class="actions" style="display:flex; gap:10px;">
          <button class="btn-sync-ad" (click)="syncADUsers()" [disabled]="syncingAD()">
            <span *ngIf="syncingAD()" class="spinner-sm"></span>
            <svg *ngIf="!syncingAD()" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l5.64 5.64A9 9 0 0 0 20.49 15"></path></svg>
            Sync AD Status
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tab-bar">
        <button class="tab-btn" [class.active]="activeTab() === 'users'" (click)="activeTab.set('users')">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          System Users ({{ users().length }})
        </button>
        <button class="tab-btn" [class.active]="activeTab() === 'roles'" (click)="activeTab.set('roles')">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          Roles &amp; Permissions ({{ roles().length }})
        </button>
      </div>

      <!-- Tab 1: System Users List -->
      <div *ngIf="activeTab() === 'users'" class="card tab-content">
        <div class="row-between table-toolbar">
          <input
            type="text"
            class="search-input"
            placeholder="Search added users by name, email, or role..."
            [(ngModel)]="userSearch"
          />
          <div style="display:flex; align-items:center; gap:12px;">
            <span class="user-count">{{ filteredUsers().length }} user(s)</span>
            <button class="btn-primary-sm" (click)="openAddUserModal()">+ Add User</button>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>User Name</th>
                <th>Email Address</th>
                <th>Assigned Role</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
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
                <td style="text-align:right;">
                  <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button class="btn-sm btn-save" (click)="saveUserRole(u)" [disabled]="savingUser() === u.id">
                      <span *ngIf="savingUser() === u.id" class="spinner-xs"></span>
                      Save
                    </button>
                    <button class="btn-sm btn-danger" style="background:#fee2e2; color:#991b1b; border:1px solid #fca5a5;" (click)="deleteUser(u)" [disabled]="deletingUser() === u.id">
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="filteredUsers().length === 0">
                <td colspan="5" class="empty-state">No matching users found. Click "+ Add User" to search Active Directory and add a user.</td>
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

    <!-- Add User Modal with Active Directory Search -->
    <div class="modal-backdrop" *ngIf="showAddUserModal()">
      <div class="modal-card" style="max-width:540px;">
        <h3 style="margin-bottom:4px;">Add System User</h3>
        <p style="font-size:12px; color:#64748b; margin:0 0 16px 0;">Search Active Directory to select a user candidate or enter details manually.</p>

        <!-- Live AD Search Box -->
        <label style="font-size:12px; font-weight:600; color:#334155; margin-bottom:4px; display:block;">
          Search Active Directory (LDAP)
        </label>
        <div style="position:relative; margin-bottom:12px;">
          <input
            type="text"
            class="modal-input"
            style="margin-bottom:0;"
            placeholder="Type name or email to search AD..."
            [(ngModel)]="adSearchQuery"
            (ngModelChange)="onADSearchInput($event)"
          />
          <span *ngIf="searchingAD()" style="position:absolute; right:10px; top:10px;" class="spinner-xs"></span>
        </div>

        <!-- AD Candidate Results Dropdown -->
        <div *ngIf="adSearchResults().length" style="border:1px solid #cbd5e1; border-radius:8px; max-height:180px; overflow-y:auto; margin-bottom:16px; background:#f8fafc;">
          <div
            *ngFor="let candidate of adSearchResults()"
            (click)="selectADCandidate(candidate)"
            style="padding:10px 12px; border-bottom:1px solid #e2e8f0; cursor:pointer; display:flex; justify-content:space-between; align-items:center;"
            [style.background]="newUserEmail === candidate.email ? '#eff6ff' : '#ffffff'"
          >
            <div>
              <div style="font-weight:600; font-size:13px; color:#0f172a;">{{ candidate.name }}</div>
              <div style="font-size:11.5px; color:#64748b;">{{ candidate.email }} <span *ngIf="candidate.department">• {{ candidate.department }}</span></div>
            </div>
            <div>
              <span *ngIf="candidate.isAlreadyAdded" class="badge" style="background:#e2e8f0; color:#475569; font-size:10px;">Already Added</span>
              <span *ngIf="!candidate.isAlreadyAdded" class="badge badge-ok" style="font-size:10px;">+ Select</span>
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="font-size:12px; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Full Name *</label>
            <input
              type="text"
              class="modal-input"
              placeholder="e.g. Jane Doe"
              [(ngModel)]="newUserName"
            />
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Email Address *</label>
            <input
              type="email"
              class="modal-input"
              placeholder="e.g. jane@company.com"
              [(ngModel)]="newUserEmail"
            />
          </div>
        </div>

        <label style="font-size:12px; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Assign System Role</label>
        <select class="modal-input" [(ngModel)]="newUserRole">
          <option *ngFor="let r of roles()" [value]="r.role">{{ r.role }}</option>
        </select>

        <div class="modal-actions">
          <button class="btn-secondary-sm" (click)="showAddUserModal.set(false)">Cancel</button>
          <button class="btn-primary-sm" (click)="addUser()" [disabled]="creatingUser()">
            <span *ngIf="creatingUser()" class="spinner-xs"></span>
            Add User to System
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .roles-permissions-container { display: flex; flex-direction: column; gap: 20px; }
    .row-between { display: flex; align-items: center; justify-content: space-between; }
    .page-header h2 { margin: 0; font-size: 20px; font-weight: 700; color: #0f172a; }
    .card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }

    .btn-sync-ad {
      background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe;
      padding: 7px 16px; border-radius: 8px; font-size: 12px; font-weight: 600;
      cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;
    }
    .btn-sync-ad:hover { background: #dbeafe; color: #1d4ed8; border-color: #93c5fd; }

    .tab-bar { display: flex; gap: 8px; border-bottom: 2px solid #e2e8f0; margin-bottom: -4px; }
    .tab-btn {
      background: none; border: none; padding: 10px 18px; font-size: 13px; font-weight: 600;
      color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 8px;
      border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s;
    }
    .tab-btn.active { color: #2563eb; border-bottom-color: #2563eb; }

    .table-toolbar { margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .search-input {
      flex: 1; max-width: 360px; padding: 8px 14px; border: 1px solid #cbd5e1;
      border-radius: 8px; font-size: 13px; outline: none; background: #ffffff;
    }
    .search-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15); }
    .user-count { font-size: 13px; color: #64748b; font-weight: 500; }

    .table-container { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #ffffff; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-table th { background: #f8fafc; padding: 12px 16px; text-align: left; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; }
    .data-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .data-table tbody tr:hover { background: #f8fafc; }

    .avatar-sm {
      width: 32px; height: 32px; border-radius: 8px; background: #e0e7ff; color: #3730a3;
      display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
    }
    .role-select {
      padding: 5px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 600; background: #ffffff;
    }
    .status-chip {
      display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;
    }
    .status-chip.active { background: #dcfce7; color: #15803d; }
    .status-chip.inactive { background: #fee2e2; color: #b91c1c; }

    .btn-primary-sm {
      background: #2563eb; color: white; border: none; padding: 7px 16px; border-radius: 8px;
      font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .btn-primary-sm:hover { background: #1d4ed8; }
    .btn-secondary-sm {
      background: #ffffff; color: #475569; border: 1px solid #cbd5e1; padding: 7px 14px;
      border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .btn-secondary-sm:hover { background: #f8fafc; color: #0f172a; }

    .btn-sm { padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; }
    .btn-save { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .btn-save:hover { background: #bfdbfe; }

    .btn-xs { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; }

    .roles-grid { display: grid; grid-template-columns: 240px 1fr; gap: 20px; }
    .role-list-sidebar { border-right: 1px solid #e2e8f0; padding-right: 16px; display: flex; flex-direction: column; gap: 8px; }
    .role-sidebar-header { display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 13px; color: #334155; margin-bottom: 8px; }
    .role-card-item {
      padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s; background: #ffffff;
    }
    .role-card-item.active { border-color: #3b82f6; background: #eff6ff; }
    .role-title { font-weight: 700; font-size: 13px; color: #0f172a; }
    .role-meta { font-size: 11px; color: #64748b; margin-top: 2px; }

    .panel-header { margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px; }
    .panel-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }

    .perm-section-title { font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px 0; }
    .perm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
    .perm-checkbox-card {
      display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 8px;
      border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; transition: all 0.2s;
    }
    .perm-checkbox-card:hover { border-color: #cbd5e1; background: #ffffff; }
    .perm-name { font-weight: 600; font-size: 12.5px; color: #0f172a; display: block; }
    .perm-code { font-size: 10px; color: #94a3b8; font-family: monospace; }

    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(2px);
      z-index: 9999; display: flex; align-items: center; justify-content: center;
    }
    .modal-card { background: white; border-radius: 14px; padding: 24px; width: 100%; max-width: 440px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
    .modal-card h3 { margin: 0 0 16px 0; font-size: 17px; font-weight: 700; color: #0f172a; }
    .modal-input {
      width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;
      outline: none; margin-bottom: 16px; background: #ffffff; box-sizing: border-box;
    }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; }

    .spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(37,99,235,0.2); border-top-color: #2563eb; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
    .spinner-xs { width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #ffffff; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-state { text-align: center; color: #94a3b8; padding: 30px 0; font-size: 13px; }
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
  deletingUser = signal<number | null>(null);
  savingRole = signal(false);
  showNewRoleModal = signal(false);
  newRoleName = '';

  showAddUserModal = signal(false);
  adSearchQuery = '';
  adSearchResults = signal<any[]>([]);
  searchingAD = signal(false);
  newUserName = '';
  newUserEmail = '';
  newUserRole = 'User';
  creatingUser = signal(false);

  private searchDebounceTimer: any = null;

  ngOnInit() {
    this.loadUsers();
    this.loadRoles();
  }

  loadUsers() {
    this.api.findAllUsers().subscribe({
      next: (res) => {
        this.users.set(res || []);
      },
      error: () => {
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
      error: () => {
        this.toast.error('Failed to load roles master data.');
      },
    });
  }

  filteredUsers() {
    const q = (this.userSearch || '').trim().toLowerCase();
    if (!q) return this.users();
    return this.users().filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  }

  openAddUserModal() {
    this.adSearchQuery = '';
    this.adSearchResults.set([]);
    this.newUserName = '';
    this.newUserEmail = '';
    this.newUserRole = 'User';
    this.showAddUserModal.set(true);
  }

  onADSearchInput(query: string) {
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    const q = (query || '').trim();
    if (q.length < 2) {
      this.adSearchResults.set([]);
      this.searchingAD.set(false);
      return;
    }

    this.searchingAD.set(true);
    this.searchDebounceTimer = setTimeout(() => {
      this.api.searchADUsers(q).subscribe({
        next: (res) => {
          this.adSearchResults.set(res || []);
          this.searchingAD.set(false);
        },
        error: () => {
          this.searchingAD.set(false);
        },
      });
    }, 300);
  }

  selectADCandidate(candidate: any) {
    this.newUserName = candidate.name;
    this.newUserEmail = candidate.email;
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
        this.toast.success(res?.message || 'Directory status sync completed.');
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
    this.api.updateUserRole(user.id, user.role, user.is_admin).subscribe({
      next: () => {
        this.savingUser.set(null);
        this.toast.success(`Updated role to "${user.role}" for ${user.name}`);
        this.loadUsers();
      },
      error: () => {
        this.savingUser.set(null);
        this.toast.error('Failed to update user role.');
      },
    });
  }

  async deleteUser(user: any) {
    const confirmed = await this.toast.confirm({
      title: 'Remove System User',
      message: `Are you sure you want to remove user "${user.name}" (${user.email}) from the system?`,
      confirmText: 'Remove User',
      danger: true,
    });
    if (!confirmed) return;
    this.deletingUser.set(user.id);
    this.api.deleteUser(user.id).subscribe({
      next: () => {
        this.deletingUser.set(null);
        this.toast.success(`Removed user "${user.name}".`);
        this.loadUsers();
      },
      error: () => {
        this.deletingUser.set(null);
        this.toast.error('Failed to remove user.');
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
      next: () => {
        this.savingRole.set(false);
        this.toast.success(`Permissions saved for role ${role.role}`);
        this.loadRoles();
      },
      error: () => {
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
      next: () => {
        this.newRoleName = '';
        this.showNewRoleModal.set(false);
        this.toast.success(`Role "${name}" created successfully.`);
        this.loadRoles();
      },
      error: () => {
        this.toast.error('Failed to create role.');
      },
    });
  }

  addUser() {
    const name = (this.newUserName || '').trim();
    const email = (this.newUserEmail || '').trim().toLowerCase();
    if (!name || !email) {
      this.toast.error('Please enter name and valid email.');
      return;
    }
    this.creatingUser.set(true);
    const isAdmin = this.newUserRole.toLowerCase() === 'admin' || this.newUserRole.toLowerCase() === 'super user' || this.newUserRole.toLowerCase() === 'super admin';
    this.api.updateUser({ name, email, role: this.newUserRole, is_admin: isAdmin, is_active: true }).subscribe({
      next: () => {
        this.creatingUser.set(false);
        this.showAddUserModal.set(false);
        this.newUserName = '';
        this.newUserEmail = '';
        this.toast.success(`User "${name}" added to system successfully.`);
        this.loadUsers();
      },
      error: () => {
        this.creatingUser.set(false);
        this.toast.error('Failed to add user.');
      },
    });
  }
}
