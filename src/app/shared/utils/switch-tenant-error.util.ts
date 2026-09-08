import { HttpErrorResponse } from '@angular/common/http';

/** Clave i18n del mensaje de switch-tenant según el status del error:
 *  403 → sin membresía en ese negocio; 409 → el tenant aún no está listo;
 *  cualquier otro → error genérico. */
export function switchTenantErrorKey(
  err: Pick<HttpErrorResponse, 'status'> | { status?: number } | null | undefined,
): string {
  if (err?.status === 403) return 'auth.switch_tenant_forbidden';
  if (err?.status === 409) return 'auth.switch_tenant_not_ready';
  return 'auth.switch_tenant_error';
}
