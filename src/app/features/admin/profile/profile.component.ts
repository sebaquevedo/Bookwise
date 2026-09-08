import { Component, computed, effect, inject, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
import { AuthApiService } from '@services/api/auth-api.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { translateValidationMessage } from '@i18n/validation-translator';
import { Business, ChangePasswordData } from '@models';
import { checkPasswordStrength, isPasswordStrong } from '@shared/validators/password-strength.validator';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { UserAvatarComponent } from '@shared/components/user-avatar/user-avatar.component';
import { switchTenantErrorKey } from '@shared/utils/switch-tenant-error.util';

@Component({
  selector: 'bw-profile',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, InputTextModule, PasswordModule, ButtonModule,
    MessageModule, ToggleSwitchModule, PhoneInputComponent, UserAvatarComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  private auth = inject(AuthService);
  private authApi = inject(AuthApiService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private refStore = inject(ReferenceStore);
  readonly lang = inject(LanguageService);

  /**
   * Mostrar la sección "Información del negocio". `true` para admin (que ve el
   * negocio principal / CTA de onboarding); `false` para el profesional y roles
   * operativos, que no gestionan el negocio.
   */
  showBusiness = input(true);

  loading = signal(false);

  readonly me = computed(() => this.auth.me());

  // ── Identidad del usuario autenticado (avatar + nombre + rol de sesión) ─────
  readonly userName = computed(() => this.auth.user()?.name ?? this.me()?.name ?? '');
  readonly userEmail = computed(() => this.auth.user()?.email ?? this.me()?.email ?? '');
  /** URL del avatar del usuario autenticado (fallback → iniciales en el componente). */
  readonly userAvatar = computed(() => this.auth.user()?.avatar_url ?? this.me()?.avatar_url ?? null);
  readonly avatarSaving = signal(false);
  readonly userRoleLabel = computed(() => {
    const role = this.auth.userRole();
    if (role === 'admin') return this.lang.t('ui.role.admin');
    if (role === 'provider') return this.lang.t('ui.role.provider');
    return '';
  });

  // ── Negocios (multi-tenant) ───────────────────────────────────────────────
  readonly businesses = computed(() => this.auth.me()?.businesses ?? []);
  readonly activeBusinessId = computed(() => this.auth.me()?.business?.id ?? null);
  readonly canSwitch = computed(() => this.businesses().length > 1);
  /** Conteos del tenant activo (desde ReferenceStore). */
  readonly locationsCount = computed(() => this.refStore.locations().length);
  readonly providersCount = computed(() => this.refStore.providers().length);

  monogram(name?: string): string {
    return (name || 'B').trim().charAt(0).toUpperCase();
  }

  // ── Datos del hero / notificaciones ─────────────────────────────────────
  /** Zona horaria del negocio activo (derivada de la primera sucursal activa). */
  readonly timezoneLabel = computed<string>(() => {
    const tz = this.refStore.locations().find((l) => l.active)?.timezone;
    return tz ?? '—';
  });
  readonly langLabel = computed(() =>
    this.lang.lang() === 'es' ? 'Español' : 'English',
  );
  readonly memberSince = computed(() => this.me()?.business?.created_at ?? null);
  // Notificaciones (UI local por ahora; persistencia a futuro con notification_prefs)
  readonly notifWhatsApp = signal(true);
  readonly notifEmail = signal(true);
  readonly notifPush = signal(false);

  /** Etiqueta del miembro actual en la lista: owner = admin_general del tenant
   *  (no el rol técnico de sesión, que en la transición aún separa layouts). */
  readonly memberRoleLabel = computed(() =>
    this.auth.isAdminGeneral()
      ? this.lang.t('biz.member.owner')
      : this.lang.t('biz.member.admin'),
  );

  /** URL del logo del negocio, o null → el componente cae al monograma. */
  businessLogo(biz: Business): string | null {
    return biz.logo_url ?? null;
  }

  /** Handler del input file del avatar: valida imagen y sube vía /auth/me/avatar. */
  onAvatarInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (file) this.changeAvatar(file);
  }

  /** POST /auth/me/avatar — sube el avatar, refresca /auth/me y notifica. */
  changeAvatar(file: File): void {
    this.avatarSaving.set(true);
    this.authApi.uploadAvatar(file).subscribe({
      next: () => {
        this.avatarSaving.set(false);
        this.auth.loadMe(true).subscribe();
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('profile.avatar.change'),
          detail: this.lang.t('profile.avatar.success'),
          key: 'global',
          life: 4000,
        });
      },
      error: () => {
        this.avatarSaving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: this.lang.t('ui.error'),
          detail: this.lang.t('profile.avatar.error'),
          key: 'global',
          life: 4000,
        });
      },
    });
  }

  switchTo(biz: Business): void {
    if (biz.id === this.activeBusinessId()) return;
    this.auth.switchTenant(biz.id).subscribe({
      next: () => {
        this.refStore.loadLocations();
        this.refStore.loadProviders();
        this.messageService.add({ severity: 'success', summary: this.lang.t('biz.negocios'), detail: biz.name, key: 'global', life: 3500 });
      },
      error: (err) =>
        this.messageService.add({
          severity: 'error',
          summary: this.lang.t('ui.error'),
          detail: this.lang.t(switchTenantErrorKey(err)),
          key: 'global',
          life: 4000,
        }),
    });
  }

  editBusiness(biz: Business): void {
    this.router.navigate(['/admin/negocios', biz.id]);
  }

  /** Crea una nueva empresa (flujo de onboarding). */
  newBusiness(): void {
    this.router.navigate(['/admin/negocios/nuevo']);
  }

  /** Ve la configuración completa del negocio activo. */
  viewBusinessConfig(): void {
    const id = this.activeBusinessId();
    if (id) this.router.navigate(['/admin/negocios', id]);
  }

  // ── Teléfono editable (mismo widget del registro: bandera + código de país) ──
  readonly phone = signal('');
  readonly phoneSaving = signal(false);
  readonly phoneError = signal<string | null>(null);
  private readonly phoneSeeded = signal(false);

  // ── Cambio de contraseña ───────────────────────────────────────────────────
  readonly pwSaving = signal(false);
  readonly pwCurrent = signal('');
  readonly pwNew = signal('');
  readonly pwConfirm = signal('');
  readonly pwFieldErrors = signal<{ current?: string; password?: string }>({});
  readonly pwError = signal<string | null>(null);

  /** Checkpoints de fortaleza de la contraseña nueva (para la UI bajo el campo). */
  readonly pwStrengthChecks = computed(() => checkPasswordStrength(this.pwNew()));
  readonly pwStrong = computed(() => isPasswordStrong(this.pwNew()));

  /** Coincidencia en vivo entre contraseña nueva y su confirmación. */
  readonly pwMatch = computed(() =>
    this.pwNew().length > 0 && this.pwNew() === this.pwConfirm(),
  );
  readonly pwMismatch = computed(() =>
    this.pwConfirm().length > 0 && this.pwNew() !== this.pwConfirm(),
  );

  constructor() {
    // Siembra el teléfono editable apenas /auth/me está disponible (una sola vez,
    // sin pisar lo que el usuario esté editando tras un refresh del caché).
    effect(() => {
      const me = this.auth.me();
      if (me && !this.phoneSeeded()) {
        this.phoneSeeded.set(true);
        this.phone.set(me.phone ?? '');
      }
    });
  }

  ngOnInit(): void {
    // Si el guard ya cacheó /auth/me no re-peticiona; si no, lo cargamos.
    if (!this.auth.meLoaded()) {
      this.loading.set(true);
      this.auth.loadMe().subscribe({
        next: () => this.loading.set(false),
        error: () => this.loading.set(false),
      });
    }
  }

  /** PATCH /auth/me — persiste el teléfono editado (contrato backend "profile phone update"). */
  savePhone(): void {
    const phone = this.phone().trim();
    if (!phone) {
      this.phoneError.set(this.lang.t('profile.personal.phone_required'));
      return;
    }

    this.phoneError.set(null);
    this.phoneSaving.set(true);
    this.authApi.updateProfile({ phone }).subscribe({
      next: () => {
        this.phoneSaving.set(false);
        // Refresca el caché de /auth/me para que el resto de la app vea el nuevo teléfono.
        this.auth.loadMe(true).subscribe();
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('profile.personal.phone_saved_title'),
          detail: this.lang.t('profile.personal.phone_saved'),
          key: 'global',
          life: 4000,
        });
      },
      error: (err) => {
        this.phoneSaving.set(false);
        const apiErrors = err.error?.errors as Record<string, string[]> | undefined;
        const lang = this.lang.lang();
        if (apiErrors?.['phone']?.length) {
          this.phoneError.set(translateValidationMessage(apiErrors['phone'][0], lang));
        } else {
          this.phoneError.set(
            translateValidationMessage(
              err.error?.message ?? 'profile.personal.phone_error',
              lang,
            ),
          );
        }
      },
    });
  }

  /** POST /auth/password — habilita el cambio de contraseña del usuario autenticado. */
  changePassword(): void {
    const current = this.pwCurrent().trim();
    const password = this.pwNew();
    const confirm = this.pwConfirm();

    this.pwFieldErrors.set({});
    this.pwError.set(null);

    if (!current || !password || !confirm) {
      this.pwError.set(this.lang.t('profile.change_password.required'));
      return;
    }
    if (password !== confirm) {
      this.pwFieldErrors.set({ password: this.lang.t('profile.change_password.mismatch') });
      return;
    }
    if (!isPasswordStrong(password)) {
      this.pwFieldErrors.set({ password: this.lang.t('profile.change_password.weak') });
      return;
    }

    const payload: ChangePasswordData = {
      current_password: current,
      password,
      password_confirmation: confirm,
    };

    this.pwSaving.set(true);
    this.authApi.changePassword(payload).subscribe({
      next: (res) => {
        this.pwSaving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('profile.change_password.success_title'),
          detail: res.message ?? this.lang.t('profile.change_password.success'),
          key: 'global',
          life: 4000,
        });
        this.pwCurrent.set('');
        this.pwNew.set('');
        this.pwConfirm.set('');
      },
      error: (err) => {
        this.pwSaving.set(false);
        const apiErrors = err.error?.errors as Record<string, string[]> | undefined;
        const lang = this.lang.lang();
        if (apiErrors) {
          const map: { current?: string; password?: string } = {};
          if (apiErrors['current_password']?.length) {
            map['current'] = translateValidationMessage(apiErrors['current_password'][0], lang);
          }
          if (apiErrors['password']?.length) {
            map['password'] = translateValidationMessage(apiErrors['password'][0], lang);
          }
          this.pwFieldErrors.set(map);
          if (!Object.keys(map).length) {
            this.pwError.set(
              Object.values(apiErrors).flat().map((m) => translateValidationMessage(m, lang)).join(' '),
            );
          }
        } else {
          this.pwError.set(
            translateValidationMessage(
              err.error?.message ?? 'profile.change_password.error',
              lang,
            ),
          );
        }
      },
    });
  }
}
