import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogComponent } from './catalog.component';
import { UploadComponent } from './upload.component';
import { JobsComponent } from './jobs.component';
import { ToastService } from './toast.service';

type Tab = 'catalog' | 'final' | 'upload' | 'jobs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, CatalogComponent, UploadComponent, JobsComponent],
  template: `
    <header class="appbar">
      <div class="appbar-inner">
        <div class="brand">
          <div class="brand-title">Power BI Report Automation Portal</div>
        </div>
      </div>
    </header>

    <div class="container">
      <nav class="tabs">
        <button [class.active]="tab() === 'catalog'" (click)="tab.set('catalog')">
          Catalog &amp; access
        </button>
        <button [class.active]="tab() === 'final'" (click)="tab.set('final')">
          Final reports
        </button>
        <button [class.active]="tab() === 'upload'" (click)="tab.set('upload')">
          Reports &amp; upload
        </button>
        <button [class.active]="tab() === 'jobs'" (click)="tab.set('jobs')">
          Jobs &amp; history
        </button>
      </nav>

      <app-catalog *ngIf="tab() === 'catalog'"></app-catalog>
      <app-upload *ngIf="tab() === 'final'" [finalOnly]="true"></app-upload>
      <app-upload *ngIf="tab() === 'upload'"></app-upload>
      <app-jobs *ngIf="tab() === 'jobs'"></app-jobs>
    </div>

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
})
export class AppComponent {
  tab = signal<Tab>('catalog');
  toast = inject(ToastService);
}
