import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthUser, LoginResponse } from '../models/auth.model';

const AUTH_STORAGE_KEY = 'ecom_auth';

interface StoredAuth {
  token: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly authState = signal<StoredAuth | null>(this.readStoredAuth());

  readonly currentUser = computed(() => this.authState()?.user ?? null);
  readonly isLoggedIn = computed(() => this.authState() !== null);
  readonly token = computed(() => this.authState()?.token ?? null);

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/users/login`, { email, password })
      .pipe(
        tap((response) => {
          const payload: StoredAuth = {
            token: response.data.token,
            user: response.data.user,
          };
          this.authState.set(payload);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
        }),
      );
  }

  logout(): void {
    this.authState.set(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  private readStoredAuth(): StoredAuth | null {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as StoredAuth;
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  }
}
