import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { onboardingGuard } from './onboarding.guard';
import { AuthService } from '@services/auth.service';
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

/** me con negocio ya configurado (name presente) → onboarding completo. */
function meReady(): AuthMeData {
  return {
    id: 7,
    name: 'Admin',
    email: 'admin@test.com',
    role: 'admin',
    tenant_id: 1,
    email_verified_at: '2026-09-01T16:00:00Z',
    onboarding_complete: true,
    business,
  };
}

/** me con tenant pending (business sin name / null) → aún necesita onboarding. */
function mePending(): AuthMeData {
  return {
    id: 7,
    name: 'Admin',
    email: 'admin@test.com',
    role: 'admin',
    tenant_id: 1,
    email_verified_at: '2026-09-01T16:00:00Z',
    onboarding_complete: true,
    business: null,
  };
}

describe('onboardingGuard', () => {
  let authService: {
    loadMe: ReturnType<typeof vi.fn>;
    needsOnboarding: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = {
      loadMe: vi.fn(),
      // El guard consulta needsOnboarding() tras cargar /auth/me: cada test fija
      // el retorno alineado con el me que devuelve loadMe (ver más abajo).
      needsOnboarding: vi.fn(() => false),
    };
    router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });
  });

  /** Runs the guard inside the injection context and collects the emitted value. */
  function run(): boolean | undefined {
    let emitted: boolean | undefined;
    TestBed.runInInjectionContext(() => {
      const result = onboardingGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Observable<boolean>;
      result.subscribe({ next: (v) => (emitted = v) });
    });
    return emitted;
  }

  it('allows access when the active business is configured (name present)', () => {
    authService.loadMe.mockReturnValue(of(meReady()));
    authService.needsOnboarding.mockReturnValue(false);

    expect(run()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects to /onboarding when the tenant is pending (business without name)', () => {
    authService.loadMe.mockReturnValue(of(mePending()));
    authService.needsOnboarding.mockReturnValue(true);

    expect(run()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
  });

  it('redirects to /onboarding and never authorizes when loadMe fails', () => {
    authService.loadMe.mockReturnValue(throwError(() => new Error('boom')));
    authService.needsOnboarding.mockReturnValue(true);

    expect(run()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
  });
});
