import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { AuthService } from '@services/auth.service';
import { AuthApiService } from '@services/api/auth-api.service';
import { MessageService } from 'primeng/api';
import type { AuthMeData, Business, User, UserRole } from '@models';

const business: Business = {
  id: 1,
  name: 'Kinesilk Centro',
  rut: '11111111-1',
  email: 'negocio@test.com',
  address: 'Av. Providencia 123',
  phone: '+56912345678',
  plan: 'starter',
};

function makeMe(biz: Business | null): AuthMeData {
  return {
    id: 7,
    name: 'Admin',
    email: 'admin@test.com',
    phone: '+56912345678',
    role: 'admin',
    tenant_id: 1,
    email_verified_at: '2026-09-01T16:00:00Z',
    onboarding_complete: biz !== null,
    business: biz,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 7,
    email: 'admin@test.com',
    name: 'Admin',
    role: 'admin',
    ...overrides,
  };
}

describe('ProfileComponent', () => {
  let auth: {
    me: ReturnType<typeof signal<AuthMeData | null>>;
    meLoaded: ReturnType<typeof signal<boolean>>;
    user: ReturnType<typeof signal<User | null>>;
    userRole: () => UserRole | null;
    isAdmin: () => boolean;
    isAdminGeneral: () => boolean;
    loadMe: ReturnType<typeof vi.fn>;
  };
  let api: { changePassword: ReturnType<typeof vi.fn>; updateProfile: ReturnType<typeof vi.fn> };
  let toast: { add: ReturnType<typeof vi.fn> };
  let component: ProfileComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<ProfileComponent>>;

  beforeEach(async () => {
    auth = {
      me: signal(makeMe(business) as AuthMeData | null),
      meLoaded: signal(true),
      user: signal(makeUser() as User | null),
      userRole: () => auth.user()?.role ?? null,
      isAdmin: () => auth.user()?.role === 'admin',
      isAdminGeneral: () => auth.me()?.is_admin_general ?? false,
      loadMe: vi.fn(),
    };
    api = { changePassword: vi.fn(), updateProfile: vi.fn() };
    toast = { add: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: auth },
        { provide: AuthApiService, useValue: api },
        { provide: MessageService, useValue: toast },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
  });

  it('shows the new-business action and no active detail when business is null', () => {
    auth.me.set(makeMe(null) as AuthMeData | null);
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    // Sin negocio activo → no hay detalle del negocio.
    expect(nativeEl.querySelector('.biz-detail')).toBeNull();
    // La card de negocios ofrece crear una nueva empresa.
    expect(nativeEl.querySelector('.profile-card__actions')).toBeTruthy();
  });

  it('renders user email read-only and never issues an update request', () => {
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const inputs = Array.from(nativeEl.querySelectorAll<HTMLInputElement>('input'));

    const nameInput = inputs.find((i) => i.value === 'Admin');
    const emailInput = inputs.find((i) => i.value === 'admin@test.com');

    expect(nameInput).toBeTruthy();
    expect(nameInput!.readOnly).toBe(true);
    expect(emailInput).toBeTruthy();
    expect(emailInput!.readOnly).toBe(true);

    // Sin endpoint de actualización invocado (el perfil es de solo lectura).
    expect(auth.loadMe).not.toHaveBeenCalled();
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('calls changePassword with the payload and shows success on 200', () => {
    api.changePassword.mockReturnValue(of({ message: 'OK' }));
    fixture.detectChanges();

    component.pwCurrent.set('ClaveActual123');
    component.pwNew.set('ClaveNueva456');
    component.pwConfirm.set('ClaveNueva456');
    component.changePassword();

    expect(api.changePassword).toHaveBeenCalledWith({
      current_password: 'ClaveActual123',
      password: 'ClaveNueva456',
      password_confirmation: 'ClaveNueva456',
    });
    expect(toast.add).toHaveBeenCalled();
    expect(component.pwCurrent()).toBe('');
    expect(component.pwNew()).toBe('');
    expect(component.pwConfirm()).toBe('');
    expect(component.pwError()).toBeNull();
  });

  it('maps a 422 current_password error to the current field', () => {
    api.changePassword.mockReturnValue(
      throwError(() => ({
        status: 422,
        error: { errors: { current_password: ['La contraseña actual no es correcta.'] } },
      })),
    );
    fixture.detectChanges();

    component.pwCurrent.set('Mala');
    component.pwNew.set('ClaveNueva456');
    component.pwConfirm.set('ClaveNueva456');
    component.changePassword();

    expect(component.pwFieldErrors().current).toBeTruthy();
    expect(component.pwFieldErrors().password).toBeUndefined();
    expect(component.pwError()).toBeNull();
  });

  it('blocks submit when password and confirmation do not match', () => {
    fixture.detectChanges();

    component.pwCurrent.set('ClaveActual123');
    component.pwNew.set('ClaveNueva456');
    component.pwConfirm.set('ClaveDistinta789');
    component.changePassword();

    expect(api.changePassword).not.toHaveBeenCalled();
    expect(component.pwFieldErrors().password).toBeTruthy();
  });

  it('blocks submit when the new password is not strong enough', () => {
    fixture.detectChanges();

    component.pwCurrent.set('ClaveActual123');
    component.pwNew.set('debil123'); // no uppercase → not strong
    component.pwConfirm.set('debil123');
    component.changePassword();

    expect(api.changePassword).not.toHaveBeenCalled();
    expect(component.pwFieldErrors().password).toBeTruthy();
    expect(component.pwStrong()).toBe(false);
  });

  it('computes strength checkpoints for the new password', () => {
    fixture.detectChanges();

    component.pwNew.set('ClaveNueva456');
    expect(component.pwStrong()).toBe(true);

    component.pwNew.set('clave');
    expect(component.pwStrong()).toBe(false);
    expect(component.pwStrengthChecks().some((c) => !c.met)).toBe(true);
  });

  it('seeds the editable phone from /auth/me', () => {
    fixture.detectChanges();
    expect(component.phone()).toBe('+56912345678');
  });

  it('saves the edited phone via PATCH /auth/me and refreshes the me cache', () => {
    api.updateProfile.mockReturnValue(of({ user: makeMe(business) }));
    auth.loadMe.mockReturnValue(of(makeMe(business)));
    fixture.detectChanges();

    component.phone.set('+59899123456');
    component.savePhone();

    expect(api.updateProfile).toHaveBeenCalledWith({ phone: '+59899123456' });
    expect(auth.loadMe).toHaveBeenCalledWith(true);
    expect(toast.add).toHaveBeenCalled();
    expect(component.phoneError()).toBeNull();
  });

  it('blocks saving when the phone is empty', () => {
    fixture.detectChanges();

    component.phone.set('');
    component.savePhone();

    expect(api.updateProfile).not.toHaveBeenCalled();
    expect(component.phoneError()).toBeTruthy();
  });

  it('maps a 422 phone error to the field message', () => {
    api.updateProfile.mockReturnValue(
      throwError(() => ({
        status: 422,
        error: { errors: { phone: ['El número no es válido para este país.'] } },
      })),
    );
    fixture.detectChanges();

    component.phone.set('123');
    component.savePhone();

    expect(component.phoneError()).toBeTruthy();
    expect(component.phoneSaving()).toBe(false);
  });

  // ── Identidad del usuario autenticado (avatar + rol de sesión) ─────────────

  it('maps the session role to its localized label instead of the hardcoded chip', () => {
    fixture.detectChanges();

    expect(component.userRoleLabel()).toBe('Administrador');
    const nativeEl = fixture.nativeElement as HTMLElement;
    const chip = nativeEl.querySelector('.profile-hero__role');
    expect(chip).toBeTruthy();
    expect(chip!.textContent).toContain('Administrador');
  });

  it('renders the large avatar with the user initials', () => {
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const avatar = nativeEl.querySelector('.bw-user-avatar');
    expect(avatar).toBeTruthy();
    expect(avatar!.classList).toContain('bw-user-avatar--lg');
    expect(avatar!.textContent!.trim()).toBe('A');
  });

  it('maps a provider session role to the Professional label', () => {
    auth.user.set(makeUser({ role: 'provider' }) as User | null);
    fixture.detectChanges();

    expect(component.userRoleLabel()).toBe('Profesional');
  });

  it('labels the member as Owner when the user is admin_general of the tenant', () => {
    auth.me.set({ ...makeMe(business), is_admin_general: true } as AuthMeData | null);
    fixture.detectChanges();

    expect(component.memberRoleLabel()).toBe('Propietario');
  });

  it('labels the member as Administrator when not admin_general (e.g. admin_local)', () => {
    auth.me.set({ ...makeMe(business), is_admin_general: false } as AuthMeData | null);
    fixture.detectChanges();

    expect(component.memberRoleLabel()).toBe('Administrador');
  });
});
