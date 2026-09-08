import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '@services/auth.service';

/**
 * Bloquea el acceso a /admin hasta que el negocio esté configurado.
 * Lee `/auth/me` (cacheado en AuthService); si el negocio falta o está pendiente
 * (business sin name) redirige a /onboarding. Nunca autoriza hacia adelante si
 * no puede confirmar. No depende de `onboarding_complete`: el backend crea el
 * tenant en el registro, así que ese flag ya no indica onboarding pendiente.
 */
export const onboardingGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  return authService.loadMe().pipe(
    map(() => {
      if (authService.needsOnboarding()) {
        router.navigate(['/onboarding']);
        return false;
      }
      return true;
    }),
    catchError(() => {
      // No se pudo confirmar el estado → seguridad: no autorizar /admin.
      router.navigate(['/onboarding']);
      return of(false);
    }),
  );
};
