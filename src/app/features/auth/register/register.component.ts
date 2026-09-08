import { Component, inject, signal } from '@angular/core';
import { NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AuthApiService } from '@services/api/auth-api.service';
import { LanguageService } from '@services/language.service';
import { translateValidationMessage } from '@i18n/validation-translator';
import { RegisterData } from '@models';
import { checkPasswordStrength, isPasswordStrong, PasswordStrengthCheck } from '@shared/validators/password-strength.validator';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { AuthLayoutComponent } from '@shared/components/auth-layout/auth-layout.component';

@Component({
  selector: 'bw-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
    PhoneInputComponent,
    AuthLayoutComponent,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  private authApi = inject(AuthApiService);
  private lang = inject(LanguageService);

  loading = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // intl-tel-input emits the full E.164 phone string directly

  formData: RegisterData = {
    name: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: '',
  };

  /** Mismas reglas visibles que en "Cambiar contraseña" (Mi perfil) → consistencia visual. */
  private readonly strengthLabels: Record<PasswordStrengthCheck['key'], string> = {
    length: 'Mínimo 8 caracteres',
    uppercase: 'Una letra mayúscula',
    lowercase: 'Una letra minúscula',
    number: 'Un número',
  };

  passwordChecks(): Array<PasswordStrengthCheck & { label: string }> {
    return checkPasswordStrength(this.formData.password).map((check) => ({
      ...check,
      label: this.strengthLabels[check.key],
    }));
  }

  /** Coincidencia en vivo entre contraseña y su confirmación (como en el perfil). */
  pwMatch(): boolean {
    return (
      this.formData.password.length > 0 &&
      this.formData.password === this.formData.password_confirmation
    );
  }

  pwMismatch(): boolean {
    return (
      this.formData.password_confirmation.length > 0 &&
      this.formData.password !== this.formData.password_confirmation
    );
  }

  isFormValid(): boolean {
    return !!(
      this.formData.name &&
      this.formData.email &&
      this.formData.phone &&
      this.formData.password &&
      this.formData.password_confirmation &&
      this.formData.password === this.formData.password_confirmation &&
      isPasswordStrong(this.formData.password)
    );
  }

  /** True cuando la contraseña cumple todos los checkpoints de fortaleza. */
  passwordStrong(): boolean {
    return isPasswordStrong(this.formData.password);
  }

  onRegister(form?: NgForm): void {
    if (form) {
      form.form.markAllAsTouched();
      if (form.invalid) return;
    }
    if (!this.isFormValid()) return;

    this.loading.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    // POST /auth/register → 201 + user, SIN token. El login queda bloqueado
    // hasta que el usuario verifique su email vía el link (carlitox).
    this.authApi.register(this.formData).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.successMessage.set(
          res.message ?? this.lang.t('auth.register_check_email'),
        );
      },
      error: (err) => {
        this.loading.set(false);
        // Falla de provisioning del tenant (500 o { error: 'provisioning_failed' }):
        // la cuenta pudo quedar a medias → mensaje de reintento específico.
        const isProvisioningFailure =
          err?.status === 500 || err?.error?.error === 'provisioning_failed';
        if (isProvisioningFailure) {
          this.error.set(this.lang.t('auth.register_provisioning_failed'));
          return;
        }
        const apiErrors = err.error?.errors as Record<string, string[]> | undefined;
        const lang = this.lang.lang();
        const msg = apiErrors
          ? Object.values(apiErrors).flat().map((m) => translateValidationMessage(m, lang)).join(' ')
          : this.lang.t('auth.register_error');
        this.error.set(msg);
      },
    });
  }
}
