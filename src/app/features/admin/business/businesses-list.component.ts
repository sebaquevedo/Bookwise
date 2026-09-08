import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Business } from '@models';
import { UserAvatarComponent } from '@shared/components/user-avatar/user-avatar.component';
import { switchTenantErrorKey } from '@shared/utils/switch-tenant-error.util';

/**
 * Listado de negocios (gestión multi-tenant).
 *
 * El admin general ve TODOS los negocios donde tiene rol de negocio; el admin
 * local ve solo el suyo (fuente: me().businesses, ya filtrado por pivots).
 * Permite crear un negocio nuevo y navegar a la edición de cada uno.
 */
@Component({
  selector: 'bw-businesses-list',
  standalone: true,
  imports: [CommonModule, ButtonModule, CardModule, UserAvatarComponent],
  templateUrl: './businesses-list.component.html',
  styleUrl: './businesses-list.component.scss',
})
export class BusinessesListComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly refStore = inject(ReferenceStore);
  private readonly messageService = inject(MessageService);
  readonly lang = inject(LanguageService);

  readonly businesses = computed(() => this.auth.me()?.businesses ?? []);
  readonly activeBusinessId = computed(() => this.auth.me()?.business?.id ?? null);
  readonly isAdminGeneral = computed(() => this.auth.isAdminGeneral());
  readonly canSwitch = computed(() => this.businesses().length > 1);

  readonly loading = signal(false);

  /** Navega a la edición de un negocio. */
  editBusiness(biz: Business): void {
    this.router.navigate(['/admin/negocios', biz.id]);
  }

  /** Navega a la creación de un negocio nuevo. */
  newBusiness(): void {
    this.router.navigate(['/admin/negocios/nuevo']);
  }

  /** Cambia el negocio activo (admin_general). */
  switchTo(biz: Business): void {
    if (biz.id === this.activeBusinessId()) return;
    this.auth.switchTenant(biz.id).subscribe({
      next: () => {
        this.refStore.loadLocations();
        this.refStore.loadProviders();
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('biz.negocios'),
          detail: biz.name,
          key: 'global',
          life: 3500,
        });
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
}
