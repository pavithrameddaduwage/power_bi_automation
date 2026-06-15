import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  type: 'success' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private counter = 0;

  show(text: string, type: 'success' | 'error' = 'success') {
    const id = ++this.counter;
    this.toasts.update((t) => [...t, { id, text, type }]);
    setTimeout(() => this.dismiss(id), 4500);
  }
  success(text: string) {
    this.show(text, 'success');
  }
  error(text: string) {
    this.show(text, 'error');
  }
  dismiss(id: number) {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
