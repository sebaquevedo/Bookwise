// Modelos del sistema de agenda

// Re-export requests
export * from './requests/blocked-slots';
export * from './requests/sales';

// Re-export responses
export * from './responses/bookings';
export * from './responses/sales';

export interface Locality {
  id: number;
  name: string;
}

export interface Region extends Locality {
  timezone: string;
}

export interface LocationComuna extends Locality {}

export interface Location {
  id: number;
  name: string;
  address: string;
  city: string;
  region_id?: number;
  region?: Region;
  comuna_id?: number;
  comuna?: LocationComuna;
  timezone: string;
  codigo_postal?: string;
  opening_time?: string;
  closing_time?: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Provider {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  active: boolean;
  location?: Location | null;
  services?: Service[];
  roles?: Role[];
  created_at?: string;
  updated_at?: string;
}

export interface Service {
  id: number;
  name: string;
  description?: string;
  duration_minutes: number;
  slot_interval_minutes?: number;
  min_duration_minutes?: number;
  max_duration_minutes?: number;
  price: string | number;
  active: boolean;
  slot_config?: {
    interval_minutes: number;
    buffer_minutes: number;
  };
  created_at?: string;
  updated_at?: string;
}

export interface ServicePack {
  id: number;
  service_id: number;
  service?: Service;
  name: string;
  total_sessions: number;
  price: string | number;
  active: boolean;
  duration_minutes?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Per-client notification preferences — 1:1 with the backend contract (5 flags).
 * Sending is handled by the backend (carlitox + cron); the frontend only reads/writes.
 */
export interface NotificationPrefs {
  email_new_booking: boolean;
  email_booking_confirmation: boolean;
  email_booking_cancellation: boolean;
  whatsapp_reminder: boolean;
  whatsapp_cancellation_confirmation: boolean;
}

export interface Client {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  rut?: string | null;
  gender?: string | null;
  wc_customer_id?: number | null;
  active: boolean;
  custom_attributes?: Record<string, unknown>;
  notifications_enabled?: boolean;
  notification_prefs?: NotificationPrefs;
  created_at?: string;
  updated_at?: string;
}

export interface ClientPack {
  id: number;
  client_id: number;
  client?: Client;
  service_pack_id: number;
  service_pack?: ServicePack;
  wc_order_id?: number;
  total_sessions: number;
  used_sessions: number;
  remaining_sessions: number;
  status: 'active' | 'used' | 'expired';
  created_at?: string;
  updated_at?: string;
}

export interface BookingStatus {
  id: number;
  name: string;
  color?: string;          // returned by API; fallback to STATUS_COLOR_MAP
  is_cancellation: boolean;
}

export interface PackSession {
  session_number: number;
  total_sessions: number;
  client_pack_id: number;
  service_pack_id: number;
  status: string;
}

export * from './requests/blocked-slots';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface Payment {
  id?: number;
  booking_id?: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: PaymentStatus;
  created_at?: string;
  updated_at?: string;
}

export interface Booking {
  id: number;
  // IDs (used when sending to API)
  client_id?: number;
  service_id?: number;
  provider_id?: number;
  location_id?: number;
  status_id: number;
  // Nested objects (returned by API)
  client?: Client;
  service?: Service;
  provider?: Provider;
  location?: Location;
  status?: BookingStatus;
  // Timing
  start_time: string;
  end_time: string;
  effective_duration_minutes?: number;
  custom_duration_minutes?: number | null;
  // Financials
  price: string | number;
  payment_status?: PaymentStatus | null;
  payment?: Payment | Record<string, never>;   // {} when no payment
  pack_session?: PackSession | null;
  // Meta
  notes?: string | null;
  internal_notes?: string | null;
  wc_order_id?: number | null;
  created_via?: 'admin_calendar' | 'agent' | 'online_webhook' | null;
  last_modified_via?: 'admin_calendar' | 'agent' | null;
  created_at?: string;
  updated_at?: string;
}

// Sale interface is defined in responses/sales.ts and re-exported via the barrel

export interface AvailableSlot {
  location_id: number;
  provider_id: number;
  service_id: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

export interface ProviderAvailability {
  id: number;
  provider_id: number;
  location_id: number;
  day_of_week: number; // 0-6 (domingo-sábado)
  start_time: string;
  end_time: string;
  is_active: boolean;
}

// Auth
export type UserRole = 'admin' | 'provider';

export interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  avatar_url?: string | null;
  role: UserRole;
  provider_id?: number | null;
  tenant_id?: number | null;
  email_verified_at?: string | null;
  onboarding_complete?: boolean;
  business?: Business | null;
  location_ids?: number[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone: string;
  role?: UserRole;
}

/** POST /auth/register → 201 { message, user } (sin token: el login queda bloqueado hasta verificar email) */
export interface RegisterResponse {
  message: string;
  user: User;
}

/** POST /auth/password (Bearer) → 200 { message } — cambio de contraseña del usuario autenticado. */
export interface ChangePasswordData {
  current_password: string;
  password: string;
  password_confirmation: string;
}

/** POST /auth/reset-password (público) { token, password, password_confirmation }
 *  → 200 { message } | 400 { error: 'invalid_token' | 'token_expired' | 'token_already_used' } | 422 { message, errors }. */
export interface ResetPasswordData {
  token: string;
  password: string;
  password_confirmation: string;
}

// Business onboarding / profile / roles
/** Plan de negocio. El contrato confirma valores tipo 'starter' | 'professional' | 'enterprise'. */
export type BusinessPlan = string;

export interface Business {
  id: number;
  name: string;
  rut: string;
  email: string;
  address: string;
  phone?: string | null;
  plan: BusinessPlan;
  logo_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** GET /auth/me (Bearer) → { user: AuthMeData }. El email del negocio no es editable. */
export interface AuthMeData {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: UserRole;
  tenant_id: number | null;
  email_verified_at: string | null;
  onboarding_complete: boolean;
  business: Business | null;
  /** Negocios a los que puede alternar (multi-tenant; admin_general ve todos). */
  businesses?: Business[];
  /** Roles de NEGOCIO (distintos del rol técnico `role`). */
  is_admin_general?: boolean;
  is_admin_local?: boolean;
}

export interface AuthMeResponse {
  user: AuthMeData;
}

/** Rol de negocio (capa separada de `UserRole`). name ∈ admin_general|admin_local|recepcionista|recepcionista_readonly|staff|staff_readonly */
export interface Role {
  id: number;
  name: string;
  label?: string;
}

/** POST /businesses (Bearer) → cuerpo que SIEMPRE se valida en el front. */
export interface CreateBusinessData {
  name: string;
  rut: string;
  email: string;
  address: string;
  phone: string;
  plan: BusinessPlan;
  /** Logo opcional del negocio (aparece en recibos/email). */
  logo?: File | null;
}

/** POST /businesses → 200 (completa el tenant pending) o 201 (crea tenant nuevo)
 *  { data: Business, message?, warnings? }. `data` ES el Business (plano); la
 *  respuesta ya NO incluye `user`. */
export interface CreateBusinessResponse {
  data: Business;
  message?: string;
  warnings?: string[];
}

// Paginación
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    from: number;
    last_page: number;
    per_page: number;
    to: number;
    total: number;
  };
}

// Client-paginated response (flat structure from /clients/{id}/bookings, etc.)
export type { ClientPaginatedResponse } from './responses/client-paginated-response';

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}
