import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OnboardingComponent } from './onboarding.component';
import { BusinessesApiService } from '@services/api/businesses-api.service';
import { AuthService } from '@services/auth.service';
import { HttpErrorService } from '@services/http-error.service';
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

function meData(biz: Business | null): AuthMeData {
  return {
    id: 7,
    name: 'Admin',
    email: 'admin@test.com',
    phone: '+56912345678',
    role: 'admin',
    tenant_id: 1,
    email_verified_at: '2026-09-01T16:00:00Z',
    onboarding_complete: true,
    business: biz,
  };
}

describe('OnboardingComponent', () => {
  let businessesApi: { createBusiness: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let auth: {
    me: ReturnType<typeof signal<AuthMeData | null>>;
    meLoaded: ReturnType<typeof signal<boolean>>;
    loadMe: ReturnType<typeof vi.fn>;
  };
  let httpError: { handle: ReturnType<typeof vi.fn> };
  let fixture: ReturnType<typeof TestBed.createComponent<OnboardingComponent>>;
  let component: OnboardingComponent;

  beforeEach(async () => {
    businessesApi = { createBusiness: vi.fn() };
    router = { navigate: vi.fn() };
    auth = {
      me: signal(meData(null)),
      meLoaded: signal(true),
      loadMe: vi.fn(),
    };
    httpError = { handle: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: BusinessesApiService, useValue: businessesApi },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
        { provide: HttpErrorService, useValue: httpError },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingComponent);
    component = fixture.componentInstance;
  });

  it('does not POST when the form is invalid', () => {
    fixture.detectChanges();

    const formEl = fixture.nativeElement.querySelector('form');
    formEl.dispatchEvent(new Event('submit'));

    expect(businessesApi.createBusiness).not.toHaveBeenCalled();
  });

  it('does not POST when business_type is "other" without a description', () => {
    component.formData = {
      name: 'Kinesilk Centro',
      rut: '11111111-1',
      email: 'negocio@test.com',
      address: 'Av. Providencia 123',
      phone: '+56912345678',
      plan: 'starter',
      professional_count: 2,
      business_type: 'other',
      business_type_other: '   ',
    };
    fixture.detectChanges();

    const formEl = fixture.nativeElement.querySelector('form');
    formEl.dispatchEvent(new Event('submit'));

    expect(businessesApi.createBusiness).not.toHaveBeenCalled();
  });

  it('does not POST when professional_count is 0 (must be an integer >= 1)', () => {
    component.formData = {
      name: 'Kinesilk Centro',
      rut: '11111111-1',
      email: 'negocio@test.com',
      address: 'Av. Providencia 123',
      phone: '+56912345678',
      plan: 'starter',
      professional_count: 0,
      business_type: 'centro-estetica',
      business_type_other: null,
    };
    fixture.detectChanges();

    const formEl = fixture.nativeElement.querySelector('form');
    formEl.dispatchEvent(new Event('submit'));

    expect(businessesApi.createBusiness).not.toHaveBeenCalled();
  });

  it('POSTs with business_type "other" sending the trimmed description', () => {
    businessesApi.createBusiness.mockReturnValue(of({ data: business, message: 'ok' }));
    auth.loadMe.mockReturnValue(of(meData(business)));

    component.formData = {
      name: 'Kinesilk Centro',
      rut: '11111111-1',
      email: 'negocio@test.com',
      address: 'Av. Providencia 123',
      phone: '+56912345678',
      plan: 'starter',
      professional_count: 1,
      business_type: 'other',
      business_type_other: '  Yoga y pilates  ',
    };
    fixture.detectChanges();

    const formEl = fixture.nativeElement.querySelector('form');
    formEl.dispatchEvent(new Event('submit'));

    expect(businessesApi.createBusiness).toHaveBeenCalledWith(
      expect.objectContaining({ business_type: 'other', business_type_other: 'Yoga y pilates' }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/admin']);
  });

  it('POSTs, refreshes /auth/me and navigates to /admin when the form is valid', () => {
    // Respuesta plana del backend: { data: Business } — sin `user` ni { business } anidado.
    businessesApi.createBusiness.mockReturnValue(of({ data: business, message: 'ok' }));
    auth.loadMe.mockReturnValue(of(meData(business)));

    component.formData = {
      name: 'Kinesilk Centro',
      rut: '11111111-1',
      email: 'negocio@test.com',
      address: 'Av. Providencia 123',
      phone: '+56912345678',
      plan: 'starter',
      professional_count: 3,
      business_type: 'centro-estetica',
      business_type_other: null,
    };
    fixture.detectChanges();

    const formEl = fixture.nativeElement.querySelector('form');
    formEl.dispatchEvent(new Event('submit'));

    expect(businessesApi.createBusiness).toHaveBeenCalledWith(component.formData);
    // El caché de /auth/me se refresca contra el backend (force=true) antes de navegar,
    // para que business.name quede poblado y needsOnboarding() sea false en el guard.
    expect(auth.loadMe).toHaveBeenCalledWith(true);
    expect(router.navigate).toHaveBeenCalledWith(['/admin']);
  });

  it('stays on onboarding (fail-closed) when the /auth/me refresh fails after a 200 create', () => {
    businessesApi.createBusiness.mockReturnValue(of({ data: business, message: 'ok' }));
    auth.loadMe.mockReturnValue(throwError(() => ({ status: 500 })));

    component.formData = {
      name: 'Kinesilk Centro',
      rut: '11111111-1',
      email: 'negocio@test.com',
      address: 'Av. Providencia 123',
      phone: '+56912345678',
      plan: 'starter',
      professional_count: 3,
      business_type: 'centro-estetica',
      business_type_other: null,
    };
    fixture.detectChanges();

    const formEl = fixture.nativeElement.querySelector('form');
    formEl.dispatchEvent(new Event('submit'));

    expect(businessesApi.createBusiness).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(httpError.handle).toHaveBeenCalled();
  });
});
