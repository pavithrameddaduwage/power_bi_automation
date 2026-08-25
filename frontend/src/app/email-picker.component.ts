import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  signal,
  computed,
  HostListener,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SyncApiService, DirectoryUser, ReportWithAccess } from './sync.service';

@Component({
  selector: 'app-email-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host {
      display: block;
      position: relative;
      width: 100%;
      font-family: inherit;
    }

    .picker-box {
      min-height: 38px;
      padding: 4px 8px;
      background: var(--card, #ffffff);
      border: 1px solid var(--border, #cbd5e1);
      border-radius: var(--radius-sm, 6px);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      cursor: text;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .picker-box:focus-within {
      border-color: var(--accent, #2563eb);
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
      padding: 2px 8px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.4;
      user-select: none;
    }

    .chip-name {
      max-width: 180px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .chip-remove {
      background: none;
      border: none;
      color: #3b82f6;
      cursor: pointer;
      font-size: 13px;
      padding: 0;
      margin: 0;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .chip-remove:hover {
      color: #ef4444;
    }

    .chip-input {
      border: none;
      outline: none;
      background: transparent;
      padding: 4px 2px;
      font-size: 13px;
      color: var(--text, #0f172a);
      flex: 1;
      min-width: 140px;
    }

    .picker-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      max-height: 290px;
      background: var(--card, #ffffff);
      border: 1px solid var(--border, #cbd5e1);
      border-radius: var(--radius-sm, 6px);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .dropdown-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 10px;
      background: var(--bg, #f8fafc);
      border-bottom: 1px solid var(--border, #e2e8f0);
      font-size: 11px;
      color: var(--muted, #64748b);
    }

    .dropdown-actions {
      display: flex;
      gap: 8px;
    }

    .dropdown-link-btn {
      background: none;
      border: none;
      color: var(--accent, #2563eb);
      cursor: pointer;
      padding: 0;
      font-size: 11px;
      font-weight: 600;
      text-decoration: underline;
    }

    .dropdown-link-btn:hover {
      color: #1d4ed8;
    }

    .dropdown-search-row {
      padding: 6px 10px;
      background: #ffffff;
      border-bottom: 1px solid var(--border, #e2e8f0);
    }

    .dropdown-search-box {
      width: 100%;
      box-sizing: border-box;
      padding: 5px 8px;
      font-size: 12px;
      border: 1px solid var(--border, #cbd5e1);
      border-radius: 4px;
      outline: none;
    }

    .dropdown-search-box:focus {
      border-color: var(--accent, #2563eb);
    }

    .dropdown-list {
      overflow-y: auto;
      max-height: 220px;
    }

    .user-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 12px;
      cursor: pointer;
      font-size: 12.5px;
      transition: background 0.1s;
      border-bottom: 1px solid #f1f5f9;
    }

    .user-option:hover {
      background: #f8fafc;
    }

    .user-option.selected {
      background: #eff6ff;
    }

    .user-avatar-mini {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #dbeafe;
      color: #1e40af;
      font-weight: 700;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .user-meta {
      flex: 1;
      min-width: 0;
    }

    .user-name {
      font-weight: 600;
      color: var(--text, #0f172a);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-email {
      font-size: 11px;
      color: var(--muted, #64748b);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .custom-add-item {
      padding: 8px 12px;
      font-size: 12px;
      color: var(--accent, #2563eb);
      background: #f0fdf4;
      cursor: pointer;
      font-weight: 600;
      border-bottom: 1px solid #e2e8f0;
    }

    .custom-add-item:hover {
      background: #dcfce7;
    }
  `],
  template: `
    <div class="picker-box" (click)="focusInput()">
      <!-- Selected recipient chips -->
      <span class="chip" *ngFor="let email of selectedList()">
        <span class="chip-name" [title]="getUserDisplayName(email) + ' (' + email + ')'">
          {{ getUserDisplayName(email) }}
        </span>
        <button type="button" class="chip-remove" (click)="removeEmail(email, $event)" title="Remove">
          &times;
        </button>
      </span>

      <!-- Search / Custom email input -->
      <input
        #chipInput
        class="chip-input"
        [placeholder]="selectedList().length === 0 ? (placeholder || 'Select AD users or type email...') : 'Add more...'"
        [ngModel]="searchQuery()"
        (ngModelChange)="onSearchInput($event)"
        (focus)="openDropdown()"
        (keydown)="onKeydown($event)"
      />
    </div>

    <!-- Dropdown List -->
    <div class="picker-dropdown" *ngIf="isOpen()" (click)="$event.stopPropagation()">
      <div class="dropdown-header-bar">
        <span>Directory Users ({{ filteredUsers().length }} of {{ directoryUsers().length }})</span>
        <div class="dropdown-actions">
          <button type="button" class="dropdown-link-btn" *ngIf="reportMembers().length" (click)="addAllReportMembers()">
            + Workspace ({{ reportMembers().length }})
          </button>
          <button type="button" class="dropdown-link-btn" *ngIf="filteredUsers().length > 0 && filteredUsers().length <= 50" (click)="selectAllFiltered()">
            Select All
          </button>
          <button type="button" class="dropdown-link-btn" *ngIf="selectedList().length" (click)="clearAll()">
            Clear
          </button>
        </div>
      </div>

      <!-- Dedicated search row inside dropdown -->
      <div class="dropdown-search-row">
        <input
          class="dropdown-search-box"
          placeholder="Filter by name, email, or workspace..."
          [ngModel]="searchQuery()"
          (ngModelChange)="onSearchInput($event)"
          (click)="$event.stopPropagation()"
        />
      </div>

      <div class="dropdown-list">
        <!-- Add custom email action if typed query is an email not currently selected -->
        <div class="custom-add-item" *ngIf="isCustomEmailQuery()" (click)="addCustomQueryEmail()">
          + Add custom recipient: <strong>{{ searchQuery().trim() }}</strong>
        </div>

        <div
          class="user-option"
          *ngFor="let u of filteredUsers()"
          [class.selected]="isSelected(u.email)"
          (click)="toggleUser(u.email)"
        >
          <input
            type="checkbox"
            [checked]="isSelected(u.email)"
            (click)="$event.stopPropagation(); toggleUser(u.email)"
            style="cursor:pointer;"
          />
          <div class="user-avatar-mini">{{ getInitial(u.name) }}</div>
          <div class="user-meta">
            <div class="user-name">{{ u.name }}</div>
            <div class="user-email">{{ u.email }} <span *ngIf="u.workspaceName">· {{ u.workspaceName }}</span></div>
          </div>
        </div>

        <div *ngIf="filteredUsers().length === 0 && !isCustomEmailQuery()" style="padding:16px; text-align:center; color:var(--muted); font-size:12px;">
          No matching AD users found for "{{ searchQuery() }}". Press Enter to add custom email.
        </div>
      </div>
    </div>
  `,
})
export class EmailPickerComponent implements OnInit {
  @Input() set recipients(val: string) {
    const list = (val || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);
    this.selectedList.set(Array.from(new Set(list)));
  }
  @Input() placeholder: string = 'Select AD users or type email...';
  @Input() selectedReport: ReportWithAccess | null = null;

  @Output() recipientsChange = new EventEmitter<string>();

  @ViewChild('chipInput') chipInputRef?: ElementRef<HTMLInputElement>;

  searchQuery = signal<string>('');
  isOpen = signal<boolean>(false);
  directoryUsers = signal<DirectoryUser[]>([]);
  selectedList = signal<string[]>([]);

  filteredUsers = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.directoryUsers();
    if (!q) return all;
    return all.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.workspaceName && u.workspaceName.toLowerCase().includes(q)),
    );
  });

  reportMembers = computed(() => {
    if (!this.selectedReport?.access?.length) return [];
    return this.selectedReport.access
      .map((a) => (a.email || '').trim().toLowerCase())
      .filter((e) => e.length > 0 && e.includes('@'));
  });

  constructor(
    private api: SyncApiService,
    private el: ElementRef,
  ) {}

  ngOnInit() {
    this.loadDirectoryUsers();
  }

  loadDirectoryUsers() {
    this.api.directoryUsers().subscribe({
      next: (users) => {
        this.directoryUsers.set(users || []);
      },
      error: () => {},
    });
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  openDropdown() {
    this.isOpen.set(true);
  }

  focusInput() {
    if (this.chipInputRef) {
      this.chipInputRef.nativeElement.focus();
    }
    this.openDropdown();
  }

  onSearchInput(val: string) {
    this.searchQuery.set(val || '');
    this.isOpen.set(true);
  }

  isSelected(email: string): boolean {
    return this.selectedList().includes(email.trim().toLowerCase());
  }

  toggleUser(email: string) {
    const em = email.trim().toLowerCase();
    const curr = [...this.selectedList()];
    const idx = curr.indexOf(em);
    if (idx >= 0) {
      curr.splice(idx, 1);
    } else {
      curr.push(em);
    }
    this.emitChange(curr);
  }

  removeEmail(email: string, event: MouseEvent) {
    event.stopPropagation();
    const em = email.trim().toLowerCase();
    const curr = this.selectedList().filter((e) => e !== em);
    this.emitChange(curr);
  }

  addAllReportMembers() {
    const members = this.reportMembers();
    const set = new Set([...this.selectedList(), ...members]);
    this.emitChange(Array.from(set));
  }

  selectAllFiltered() {
    const emails = this.filteredUsers().map((u) => u.email.toLowerCase());
    const set = new Set([...this.selectedList(), ...emails]);
    this.emitChange(Array.from(set));
  }

  clearAll() {
    this.emitChange([]);
  }

  isCustomEmailQuery(): boolean {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q || !q.includes('@')) return false;
    return !this.selectedList().includes(q);
  }

  addCustomQueryEmail() {
    const q = this.searchQuery().trim().toLowerCase();
    if (q && q.includes('@')) {
      if (!this.selectedList().includes(q)) {
        this.emitChange([...this.selectedList(), q]);
      }
      this.searchQuery.set('');
    }
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const q = this.searchQuery().trim().toLowerCase();
      if (q) {
        // Check if query matches top filtered user
        const topUser = this.filteredUsers()[0];
        if (topUser && topUser.name.toLowerCase() === q) {
          if (!this.selectedList().includes(topUser.email.toLowerCase())) {
            this.emitChange([...this.selectedList(), topUser.email.toLowerCase()]);
          }
        } else if (q.includes('@')) {
          if (!this.selectedList().includes(q)) {
            this.emitChange([...this.selectedList(), q]);
          }
        }
        this.searchQuery.set('');
      }
    } else if (event.key === 'Backspace' && !this.searchQuery()) {
      const curr = [...this.selectedList()];
      if (curr.length > 0) {
        curr.pop();
        this.emitChange(curr);
      }
    } else if (event.key === 'Escape') {
      this.isOpen.set(false);
    }
  }

  getUserDisplayName(email: string): string {
    const em = email.trim().toLowerCase();
    const found = this.directoryUsers().find((u) => u.email.toLowerCase() === em);
    if (found && found.name && found.name !== found.email) {
      return found.name;
    }
    return email;
  }

  getInitial(name: string): string {
    const n = (name || '').trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  }

  private emitChange(list: string[]) {
    this.selectedList.set(list);
    this.recipientsChange.emit(list.join(', '));
  }
}
