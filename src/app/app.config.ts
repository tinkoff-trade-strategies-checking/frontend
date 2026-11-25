import {
  provideHttpClient,
  withFetch,
  withInterceptors,
  withXsrfConfiguration,
} from '@angular/common/http';
import { provideTaiga } from '@taiga-ui/core';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { FUNDAMENTALS_API_IMPL } from './api-impls';
import { FUNDAMENTALS_API } from './core/api/fundamentals.models';
import { apiErrorInterceptor, credentialsInterceptor } from './core/http-interceptors';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideTaiga(),
    { provide: FUNDAMENTALS_API, useClass: FUNDAMENTALS_API_IMPL },
    // CSRF: токен из cookie XSRF-TOKEN уходит заголовком X-XSRF-TOKEN на изменяющих запросах.
    provideHttpClient(
      withFetch(),
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
      withInterceptors([credentialsInterceptor, apiErrorInterceptor]),
    ),
  ],
};
