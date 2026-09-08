import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
import { BusinessesApiService } from '@services/api/businesses-api.service';
import { BusinessHeroComponent } from '@shared/components/business-hero/business-hero.component';

const PLAN_OPTIONS = [
  { label: 'Starter', value: 'starter' },
  { label: 'Professional', value: 'professional' },
  { label: 'Enterprise', value: 'enterprise' },
];

@Component({
  selector: 'bw-business-create',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, CardModule, ButtonModule, InputTextModule, SelectModule,
    RouterLink, BusinessHeroComponent,
  ],
  templateUrl: './business-create.component.html',
  styleUrls: ['./business-create.component.scss'],
})
export class BusinessCreateComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  private businessesApi = inject(BusinessesApiService);
  private messageService = inject(MessageService);
  readonly lang = inject(LanguageService);

  readonly PLAN_OPTIONS = PLAN_OPTIONS;
  readonly saving = signal(false);
  readonly created = signal(false);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    rut: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    address: ['', Validators.required],
    phone: ['', Validators.required],
    plan: ['starter', Validators.required],
  });

  /** Negocio recién creado (para el hero de logo). Se setea tras el POST. */
  readonly createdBusiness = signal<any | null>(null);

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const data = this.form.value;

    this.businessesApi.createBusiness({
      name: data.name!,
      rut: data.rut!,
      email: data.email!,
      address: data.address!,
      phone: data.phone!,
      plan: (data.plan as any) ?? 'starter',
    }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.created.set(true);
        // Respuesta plana: { data: Business } (sin { business } anidado ni `user`).
        this.createdBusiness.set(res.data);
        // Refresca /auth/me para que me().businesses incluya el nuevo negocio.
        this.auth.loadMe(true).subscribe();
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('biz.negocios'),
          detail: this.lang.t('biz.create_success'),
          key: 'global',
          life: 4000,
        });
      },
      error: (err) => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: this.lang.t('ui.error'),
          detail: err?.error?.message ?? this.lang.t('biz.create_error'),
          key: 'global',
          life: 4000,
        });
      },
    });
  }

  onLogoChanged(): void {
    this.auth.loadMe(true).subscribe();
  }

  goToList(): void {
    this.router.navigate(['/admin/negocios']);
  }
}
