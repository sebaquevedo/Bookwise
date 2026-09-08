import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Business, CreateBusinessData, CreateBusinessResponse } from '@models';

@Injectable({ providedIn: 'root' })
export class BusinessesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** GET /businesses (Bearer, email verificado) → unwrap { data: Business | null } */
  getBusiness(): Observable<Business | null> {
    return this.http
      .get<{ data: Business | null }>(`${this.baseUrl}/businesses`)
      .pipe(map((r) => r.data));
  }

  /** POST /businesses (Bearer) → 200 (completa el tenant pending) o 201 (tenant nuevo),
   *  siempre { data: Business, message?, warnings? } — respuesta plana, sin `user`. */
  createBusiness(data: CreateBusinessData): Observable<CreateBusinessResponse> {
    return this.http.post<CreateBusinessResponse>(`${this.baseUrl}/businesses`, data);
  }

  /** PATCH /businesses/{id} (Bearer) → { data: Business } — edita info del negocio. */
  updateBusiness(id: number, data: UpdateBusinessData): Observable<Business> {
    return this.http
      .patch<{ data: Business }>(`${this.baseUrl}/businesses/${id}`, data)
      .pipe(map((r) => r.data));
  }

  /** POST /businesses/{id}/logo (Bearer, multipart) → { data: Business } — logo de ESE negocio. */
  uploadLogo(id: number, file: File): Observable<Business> {
    const form = new FormData();
    form.append('logo', file);
    return this.http
      .post<{ data: Business }>(`${this.baseUrl}/businesses/${id}/logo`, form)
      .pipe(map((r) => r.data));
  }

  /** DELETE /businesses/{id}/logo (Bearer) → { data: Business } — quita el logo de ESE negocio. */
  removeLogo(id: number): Observable<Business> {
    return this.http
      .delete<{ data: Business }>(`${this.baseUrl}/businesses/${id}/logo`)
      .pipe(map((r) => r.data));
  }

  /** POST /businesses/{id}/assign-admin-local (Bearer) → asigna admin_local a un negocio. */
  assignAdminLocal(id: number, userId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/businesses/${id}/assign-admin-local`, {
      user_id: userId,
    });
  }

  /** DELETE /businesses/{id}/assign-admin-local (Bearer) → desasigna admin_local. */
  unassignAdminLocal(id: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/businesses/${id}/assign-admin-local`, {
      body: { user_id: userId },
    });
  }
}

/** Body de edición de negocio (RUT inmutable). */
export interface UpdateBusinessData {
  name: string;
  email?: string | null;
  address?: string | null;
  phone?: string | null;
  plan: string;
}
