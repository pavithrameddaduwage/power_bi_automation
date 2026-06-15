import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Reusable pagination control. Parent owns the page index + data slicing. */
@Component({
  selector: 'app-pager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="row-between pager" *ngIf="pageCount > 1">
      <span class="tag">page {{ page + 1 }} / {{ pageCount }} · {{ total }} items</span>
      <div style="display:flex;gap:6px;">
        <button class="secondary" (click)="go.emit(page - 1)" [disabled]="page === 0">‹ Prev</button>
        <button class="secondary" (click)="go.emit(page + 1)" [disabled]="page + 1 >= pageCount">Next ›</button>
      </div>
    </div>
  `,
})
export class PagerComponent {
  @Input() page = 0;
  @Input() total = 0;
  @Input() pageSize = 7;
  @Output() go = new EventEmitter<number>();

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }
}
