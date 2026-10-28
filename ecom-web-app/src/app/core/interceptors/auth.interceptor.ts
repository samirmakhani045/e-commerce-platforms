import { HttpInterceptorFn } from '@angular/common/http';

const AUTH_STORAGE_KEY = 'ecom_auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return next(req);
  }

  try {
    const auth = JSON.parse(raw) as { token?: string };

    if (!auth.token) {
      return next(req);
    }

    return next(
      req.clone({
        setHeaders: {
          Authorization: `Bearer ${auth.token}`,
        },
      }),
    );
  } catch {
    return next(req);
  }
};
