import 'zone.js'; // Angular change detection requires Zone.js (fixes NG0908).
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([])),
  ],
}).catch((err) => console.error(err));
