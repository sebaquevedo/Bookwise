import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthApiService } from './api/auth-api.service';
import type { AuthMeData, Business } from '@models';

const business: Business = {
  id: 1,
  name: 'Kinesilk Centro',
  rut: '11111111-1',
  email: 'negocio@test.com',
  address: 'Av. Providencia 123',
  phone: '+56912345678',
  plan: 'starter',
};

const me: AuthMeData = {
  id: 7,
  name: 'Admin',
  email: 'admin@test.com',
  phone: '+56912345678',
  role: 'admin',
  tenant_id: 1,
  email_verified_at: '2026-09-01T16:00:00Z',
  onboarding_complete: true,
  business: null,
};

describe('AuthService', () => {
  let authApi: { getMe: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    authApi = { getMe: vi.fn() };
    router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthApiService, useValue: authApi },
        { provide: Router, useValue: router },
      ],
    });
    service = TestBed.inject(AuthService);
  });

  describe('loadMe', () => {
    it('fetches /auth/me and caches it on the first call', () => {
      authApi.getMe.mockReturnValue(of(me));

      let result: AuthMeData | undefined;
      service.loadMe().subscribe((r) => (result = r));

      expect(result).toEqual(me);
      expect(service.me()).toEqual(me);
      expect(service.meLoaded()).toBe(true);
      expect(authApi.getMe).toHaveBeenCalledTimes(1);
    });

    it('does not refetch when the cache is already loaded', () => {
      authApi.getMe.mockReturnValue(of(me));

      service.loadMe().subscribe();
      service.loadMe().subscribe();

      expect(authApi.getMe).toHaveBeenCalledTimes(1);
    });

    it('force=true refetches even when the cache is loaded', () => {
      authApi.getMe.mockReturnValue(of(me));

      service.loadMe().subscribe();
      authApi.getMe.mockClear();
      service.loadMe(true).subscribe();

      expect(authApi.getMe).toHaveBeenCalledTimes(1);
    });
  });

  describe('needsOnboarding', () => {
    it('is true when /auth/me is not loaded yet', () => {
      expect(service.needsOnboarding()).toBe(true);
    });

    it('is true when there is no business (tenant pending without name)', () => {
      service.setMe(me); // onboarding_complete=true, pero business null
      expect(service.needsOnboarding()).toBe(true);
    });

    it('is true when the business name is blank', () => {
      service.setMe({ ...me, business: { ...business, name: '   ' } });
      expect(service.needsOnboarding()).toBe(true);
    });

    it('is false when the active business has a name', () => {
      service.setMe({ ...me, business });
      expect(service.needsOnboarding()).toBe(false);
    });
  });

  describe('setMe', () => {
    it('updates the cached me payload', () => {
      const updated: AuthMeData = { ...me, onboarding_complete: false };
      service.setMe(updated);

      expect(service.me()).toEqual(updated);
      expect(service.meLoaded()).toBe(true);
    });
  });

  describe('login stays synchronous', () => {
    it('sets the token/user and navigates by role synchronously', () => {
      service.login('tok', { id: 7, email: 'admin@test.com', name: 'Admin', role: 'admin' });

      expect(service.token()).toBe('tok');
      expect(service.user()?.role).toBe('admin');
      expect(router.navigate).toHaveBeenCalledWith(['/admin']);
    });
  });

  describe('logout', () => {
    it('clears auth state and the per-user last-location preference key', () => {
      service.login('tok', { id: 7, email: 'admin@test.com', name: 'Admin', role: 'admin' });
      localStorage.setItem('bw:lastLocationId:7', '2');
      expect(service.user()?.id).toBe(7);

      service.logout();

      expect(service.token()).toBeNull();
      expect(service.user()).toBeNull();
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('auth_user')).toBeNull();
      expect(localStorage.getItem('bw:lastLocationId:7')).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('leaves other users\u2019 preference keys untouched when logging out an anonymous session', () => {
      // Ensure an anonymous state (no user on the service) before asserting that
      // logout does not touch other users' preference keys.
      service.logout();
      localStorage.setItem('bw:lastLocationId:9', '2');

      service.logout();

      expect(localStorage.getItem('bw:lastLocationId:9')).toBe('2');
    });
  });
});
