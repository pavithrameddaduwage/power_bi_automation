import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NavigationStateService {
  pendingUserEmail = signal<string | null>(null);
}
