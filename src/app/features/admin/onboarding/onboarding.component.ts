import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { BusinessesApiService } from '@services/api/businesses-api.service';
import { AuthService } from '@services/auth.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { RutDirective } from '@shared/validators/rut.directive';
import { isValidRut } from '@shared/validators/rut.validator';
import { CreateBusinessData } from '@models';

export interface PlanOption {
  label: string;
  value: string;
}

@Component({
  selector: 'bw-onboarding',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    ButtonModule,
    SelectModule,
    PhoneInputComponent,
    RutDirective,
  ],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.scss'],
})
export class OnboardingComponent {
  private businessesApi = inject(BusinessesApiService);
  private auth = inject(AuthService);
  private httpError = inject(HttpErrorService);
  private router = inject(Router);
  readonly lang = inject(LanguageService);

  readonly planOptions: PlanOption[] = [
    { label: this.lang.t('onboard.plan.starter'), value: 'starter' },
    { label: this.lang.t('onboard.plan.professional'), value: 'professional' },
    { label: this.lang.t('onboard.plan.enterprise'), value: 'enterprise' },
  ];

  loading = signal(false);

  formData: CreateBusinessData = {
    name: '',
    rut: '',
    email: '',
    address: '',
    phone: '',
    plan: 'starter',
  };

  onSubmit(form?: NgForm): void {
    if (form) {
      form.form.markAllAsTouched();
    }
    if (!this.isFormValid()) return;

    this.loading.set(true);
    this.businessesApi.createBusiness(this.formData).subscribe({
      next: () => {
        // El backend completa el tenant y responde 200 { data: Business, message?, warnings? }
        // (sin `user`). No usamos esa respuesta para el caché: refrescamos /auth/me real,
        // que puebla business.name y hace que needsOnboarding() pase a false.
        this.auth.loadMe(true).subscribe({
          next: () => {
            this.loading.set(false);
            this.router.navigate(['/admin']);
          },
          error: (err) => {
            // El negocio ya quedó creado, pero no pudimos confirmar el estado →
            // nos quedamos en onboarding (fail-closed) con el toast de error.
            this.loading.set(false);
            this.httpError.handle(err, this.lang.t('onboard.submit'));
          },
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.httpError.handle(err, this.lang.t('onboard.submit'));
      },
    });
  }

  /** Validación en el front SIEMPRE antes de POST /businesses (RUT chileno, email, phone, required). */
  isFormValid(): boolean {
    const { name, rut, email, address, phone, plan } = this.formData;
    const validEmail = /^\S+@\S+\.\S+$/.test(email);
    return !!(
      name &&
      rut &&
      isValidRut(rut) &&
      email &&
      validEmail &&
      address &&
      phone &&
      plan
    );
  }
}
