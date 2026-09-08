import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, tap } from 'rxjs';
import { AuthMeData, User, UserRole } from '@models';
import { AuthApiService } from './api/auth-api.service';
import { CalendarPrefsService } from './calendar-prefs.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY  = 'auth_user';

  private readonly authApi = inject(AuthApiService);
  private readonly calendarPrefs = inject(CalendarPrefsService);

  private _token = signal<string | null>(this.getStoredToken());
  private _user  = signal<User | null>(this.getStoredUser());
  private _me    = signal<AuthMeData | null>(null);
  private _meLoaded = signal(false);

  readonly token           = computed(() => this._token());
  readonly user            = computed(() => this._user());
  readonly me              = computed(() => this._me());
  readonly meLoaded        = computed(() => this._meLoaded());
  readonly isAuthenticated = computed(() => !!this._token());
  readonly userRole        = computed(() => this._user()?.role ?? null);
  readonly isAdmin         = computed(() => this._user()?.role === 'admin');
  readonly isProvider      = computed(() => this._user()?.role === 'provider');
  /** Roles de NEGOCIO (multi-tenant) — expuestos por el backend en /auth/me. */
  readonly isAdminGeneral  = computed(() => this._me()?.is_admin_general ?? false);
  readonly isAdminLocal    = computed(() => this._me()?.is_admin_local ?? false);
  /** True cuando el usuario debe completar onboarding: sin negocio o negocio pendiente
   *  (name vacío). El backend crea el tenant en el registro, así que NO se usa
   *  `onboarding_complete` (siempre true cuando hay tenant_id). */
  readonly needsOnboarding = computed(() => {
    const me = this._me();
    return !me || !me.business || !(me.business.name?.trim());
  });

  constructor(private router: Router) {}

  getToken(): string | null {
    return this._token();
  }

  private getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private getStoredUser(): User | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(this.USER_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  setToken(token: string): void {
    this._token.set(token);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.TOKEN_KEY, token);
    }
  }

  setUser(user: User): void {
    this._user.set(user);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
  }

  login(token: string, user: User): void {
    this.setToken(token);
    this.setUser(user);
    this.navigateByRole(user.role);
  }

  /**
   * GET /auth/me con caché. La primera llamada (p. ej. desde `onboardingGuard`)
   * cachea el resultado para que deep-links a /admin no re-peticionen. `force`
   * vuelve a consultar el backend (útil tras crear el negocio).
   */
  loadMe(force = false): Observable<AuthMeData> {
    if (!force && this._meLoaded()) {
      return of(this._me() as AuthMeData);
    }
    return this.authApi.getMe().pipe(
      tap((me) => {
        this._me.set(me);
        this._meLoaded.set(true);
      }),
    );
  }

  /** Actualiza el caché de /auth/me (p. ej. tras switch-tenant o datos locales). */
  setMe(me: AuthMeData): void {
    this._me.set(me);
    this._meLoaded.set(true);
  }

  /** Cambia el negocio activo (admin_general) y refresca el caché de /auth/me. */
  switchTenant(tenantId: number): Observable<AuthMeData> {
    return this.authApi.switchTenant(tenantId).pipe(
      tap((me) => {
        this._me.set(me);
        this._meLoaded.set(true);
      }),
    );
  }

  private navigateByRole(role: UserRole): void {
    if (role === 'admin') {
      this.router.navigate(['/admin']);
    } else if (role === 'provider') {
      this.router.navigate(['/provider']);
    } else {
      this.router.navigate(['/']);
    }
  }

  logout(): void {
    const userId = this._user()?.id ?? null;
    this._token.set(null);
    this._user.set(null);
    this._me.set(null);
    this._meLoaded.set(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
    // Limpia preferencias por usuario (p. ej. última sucursal de la agenda)
    // para que no queden restos del usuario anterior en el mismo navegador.
    this.calendarPrefs.setLastLocationId(userId, null);
    this.router.navigate(['/login']);
  }
}
