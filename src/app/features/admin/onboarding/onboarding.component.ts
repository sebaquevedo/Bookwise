import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { BusinessesApiService } from '@services/api/businesses-api.service';
import { AuthService } from '@services/auth.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { RutDirective } from '@shared/validators/rut.directive';
import { isValidRut } from '@shared/validators/rut.validator';
import { BusinessPlan, CreateBusinessData } from '@models';

export interface PlanOption {
  label: string;
  value: string;
}

/**
 * Datos del form de onboarding. `plan` arranca en null: el p-select muestra su
 * placeholder y el validador `required` deja el form inválido (submit bloqueado)
 * hasta que el usuario elija un plan.
 */
type OnboardingFormData = Omit<CreateBusinessData, 'plan'> & { plan: BusinessPlan | null };

/**
 * Catálogo de rubros del onboarding (orden de presentación = el del landing).
 * Los 14 primeros reusan las claves i18n `landing.business.N.title`; yoga-studio
 * y other usan claves propias de onboarding.
 */
const BUSINESS_TYPE_CATALOG: ReadonlyArray<{ value: string; labelKey: string }> = [
  { value: 'centro-estetica', labelKey: 'landing.business.1.title' },
  { value: 'spa', labelKey: 'landing.business.2.title' },
  { value: 'salon-belleza', labelKey: 'landing.business.3.title' },
  { value: 'manicure-pedicure', labelKey: 'landing.business.4.title' },
  { value: 'barberia', labelKey: 'landing.business.5.title' },
  { value: 'peluqueria', labelKey: 'landing.business.6.title' },
  { value: 'cejas-pestanas', labelKey: 'landing.business.7.title' },
  { value: 'salones-maquillaje', labelKey: 'landing.business.8.title' },
  { value: 'medicina-alternativa', labelKey: 'landing.business.9.title' },
  { value: 'podologia', labelKey: 'landing.business.10.title' },
  { value: 'fisioterapia-kinesiologia', labelKey: 'landing.business.11.title' },
  { value: 'psicologia', labelKey: 'landing.business.12.title' },
  { value: 'nutricion', labelKey: 'landing.business.13.title' },
  { value: 'clinicas', labelKey: 'landing.business.14.title' },
  { value: 'yoga-studio', labelKey: 'onboard.business_type.yoga_studio' },
  { value: 'other', labelKey: 'onboard.business_type.other' },
];

@Component({
  selector: 'bw-onboarding',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    InputNumberModule,
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

  /** Opciones del select de rubro, traducidas según el idioma activo. */
  readonly businessTypeOptions = computed<PlanOption[]>(() =>
    BUSINESS_TYPE_CATALOG.map((o) => ({ label: this.lang.t(o.labelKey), value: o.value })),
  );

  loading = signal(false);

  formData: OnboardingFormData = {
    name: '',
    rut: '',
    email: '',
    address: '',
    phone: '',
    plan: null,
    // Campos del onboarding extendido (opcionales en CreateBusinessData porque
    // el flujo admin de crear negocio adicional no los envía).
    professional_count: null,
    business_type: null,
    business_type_other: '',
  };

  onSubmit(form?: NgForm): void {
    if (form) {
      form.form.markAllAsTouched();
    }
    if (!this.isFormValid()) return;

    // Normaliza el payload: business_type_other solo viaja cuando el rubro es
    // 'other' (con texto); en cualquier otro caso se manda null, nunca "".
    this.formData.business_type_other =
      this.formData.business_type === 'other'
        ? this.formData.business_type_other?.trim() ?? null
        : null;

    this.loading.set(true);
    // `plan` ya está garantizado por isFormValid() (truthy) antes de llegar acá.
    this.businessesApi.createBusiness(this.formData as CreateBusinessData).subscribe({
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

  /** Entero >= 1 (cantidad de profesionales que exige el onboarding). */
  isProfessionalCountValid(): boolean {
    const value = this.formData.professional_count;
    return value != null && Number.isInteger(value) && value >= 1;
  }

  /** Validación en el front SIEMPRE antes de POST /businesses (RUT chileno, email, phone, required). */
  isFormValid(): boolean {
    const { name, rut, email, address, phone, plan, business_type } = this.formData;
    const validEmail = /^\S+@\S+\.\S+$/.test(email);
    // El texto libre solo se exige cuando el rubro elegido es 'other'.
    const otherFilled =
      business_type !== 'other' || (this.formData.business_type_other?.trim().length ?? 0) > 0;
    return !!(
      name &&
      rut &&
      isValidRut(rut) &&
      email &&
      validEmail &&
      address &&
      phone &&
      plan &&
      this.isProfessionalCountValid() &&
      business_type &&
      otherFilled
    );
  }
}
