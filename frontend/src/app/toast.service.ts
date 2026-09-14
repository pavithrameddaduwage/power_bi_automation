import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  title?: string;
  text: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  readonly confirmModalState = signal<{
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  private counter = 0;

  show(text: string, type: 'success' | 'error' | 'info' | 'warning' = 'success', title?: string) {
    const id = ++this.counter;
    this.toasts.update((t) => [...t, { id, text, type, title }]);
    setTimeout(() => this.dismiss(id), 4500);
  }

  success(text: string, title = 'Success') {
    this.show(text, 'success', title);
  }

  error(text: string, title = 'Error') {
    this.show(text, 'error', title);
  }

  info(text: string, title = 'Info') {
    this.show(text, 'info', title);
  }

  warning(text: string, title = 'Warning') {
    this.show(text, 'warning', title);
  }

  dismiss(id: number) {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }

  /**
   * Replaces native browser `confirm()` popup with a sleek custom modal,
   * eliminating the ugly "localhost says:" browser header!
   */
  confirm(options: string | ConfirmOptions): Promise<boolean> {
    const opts: ConfirmOptions = typeof options === 'string'
      ? { message: options, title: 'Confirm Action' }
      : { title: 'Confirm Action', confirmText: 'Confirm', cancelText: 'Cancel', danger: true, ...options };

    return new Promise<boolean>((resolve) => {
      this.confirmModalState.set({ options: opts, resolve });
    });
  }

  handleConfirmResult(result: boolean) {
    const state = this.confirmModalState();
    if (state) {
      state.resolve(result);
      this.confirmModalState.set(null);
    }
  }
}
