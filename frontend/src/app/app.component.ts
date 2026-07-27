import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UploadComponent } from './upload.component';
import { JobsComponent } from './jobs.component';
import { ToastService } from './toast.service';
import { AuthService } from './auth/auth.service';
import { LoginComponent } from './auth/login/login.component';

type Tab = 'final' | 'all' | 'jobs' | 'history' | 'email-history';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, UploadComponent, JobsComponent, LoginComponent],
  template: `
    <app-login *ngIf="!(auth.isAuthenticated$() | async)"></app-login>

    <ng-container *ngIf="auth.isAuthenticated$() | async">
      <div style="display: flex; flex-direction: column; height: 100vh;">
        <!-- Top dark strip -->
        <div style="height: 8px; background: #333333; width: 100%;"></div>
        
        <!-- Full-width Top Nav -->
        <nav class="top-nav" style="border-bottom: 1px solid var(--border); padding: 0; display: flex; align-items: stretch; justify-content: space-between; height: 64px;">
          <div style="display: flex; align-items: center; height: 100%;">
            <div style="font-size: 20px; font-weight: 700; width: 250px; padding: 0 24px; box-sizing: border-box; color: #111827; height: 100%; display: flex; align-items: center; border-right: 1px solid var(--border);">Power BI Portal</div>
            <div class="breadcrumb" style="font-size: 15px; font-weight: 600; padding: 0 24px; color: #111827; display: flex; align-items: center; gap: 8px;">
            </div>
          </div>
          <div class="user-profile" style="padding: 0 24px; display: flex; align-items: center;">
            Welcome, Pavithra Meddaduwage 
            <div class="avatar" style="margin-left: 12px;">PM</div>
          </div>
        </nav>

        <div class="layout" style="flex: 1; height: auto;">
          <!-- Sidebar -->
          <aside class="sidebar">
            <div class="sidebar-nav" style="margin-top: 16px;">
            <div class="nav-group">
              <div class="nav-item" (click)="reportsExpanded.set(!reportsExpanded())" style="cursor: pointer; display: flex; align-items: center;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:12px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                Report Automation
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:auto; transition: transform 0.2s;" [style.transform]="reportsExpanded() ? 'rotate(180deg)' : 'rotate(0deg)'"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              <ng-container *ngIf="reportsExpanded()">
                <div class="nav-subitem" [class.active]="tab() === 'final'" (click)="tab.set('final')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  Reports
                </div>
                <div class="nav-subitem" [class.active]="tab() === 'all'" (click)="tab.set('all')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                  All Tables
                </div>
              </ng-container>
            </div>
            
            <div class="nav-group">
              <div class="nav-item" (click)="jobsExpanded.set(!jobsExpanded())" style="cursor: pointer; display: flex; align-items: center;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:12px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                Jobs & History
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:auto; transition: transform 0.2s;" [style.transform]="jobsExpanded() ? 'rotate(180deg)' : 'rotate(0deg)'"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              <ng-container *ngIf="jobsExpanded()">
                <div class="nav-subitem" [class.active]="tab() === 'jobs'" (click)="tab.set('jobs')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  Jobs & Schedules
                </div>
                <div class="nav-subitem" [class.active]="tab() === 'history'" (click)="tab.set('history')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><path d="M3 3v5h5"></path><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path><polyline points="12 7 12 12 15 15"></polyline></svg>
                  History
                </div>
                <div class="nav-subitem" [class.active]="tab() === 'email-history'" (click)="tab.set('email-history')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  Email History
                </div>
              </ng-container>
            </div>
          </div>
          <div style="padding: 24px; border-top: 1px solid var(--border); margin-top: auto;">
            <button class="logout-btn" style="width: 100%; text-align: center;" (click)="auth.logout()">Logout</button>
          </div>
        </aside>

        <!-- Main Area -->
        <div class="main-area">
          <main class="content-wrapper">
            <app-upload *ngIf="tab() === 'final' || tab() === 'all'" [finalOnly]="tab() === 'final'"></app-upload>
            <app-jobs *ngIf="tab() === 'jobs'"></app-jobs>
            <div *ngIf="tab() === 'history'">
              <h2>History</h2>
              <div class="card"><p class="muted">Run history will appear here.</p></div>
            </div>
            <div *ngIf="tab() === 'email-history'">
              <h2>Email History</h2>
              <div class="card"><p class="muted">Email delivery logs will appear here.</p></div>
            </div>
          </main>
        </div>
      </div>
    </div>
    </ng-container>

    <div class="toast-wrap">
      <div
        *ngFor="let t of toast.toasts()"
        class="toast"
        [class.toast-success]="t.type === 'success'"
        [class.toast-error]="t.type === 'error'"
        (click)="toast.dismiss(t.id)"
      >
        {{ t.text }}
      </div>
    </div>
  `,
  styles: [`
    .nav-item span {
      margin-left: auto;
      font-size: 10px;
    }
  `]
})
export class AppComponent {
  tab = signal<Tab>('final');
  reportsExpanded = signal(true);
  jobsExpanded = signal(true);
  toast = inject(ToastService);
  auth = inject(AuthService);
}
