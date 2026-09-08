import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';
import { onboardingGuard } from './core/guards/onboarding.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.component').then(m => m.LandingComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./features/auth/verify-email/verify-email.component').then(m => m.VerifyEmailComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'onboarding',
    canActivate: [roleGuard(['admin'])],
    loadComponent: () => import('./features/admin/onboarding/onboarding.component').then(m => m.OnboardingComponent)
  },
  {
    path: 'admin',
    canActivate: [roleGuard(['admin']), onboardingGuard],
    loadComponent: () => import('./layouts/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'locations',
        loadComponent: () => import('./features/admin/locations/locations-list.component').then(m => m.LocationsListComponent)
      },
      {
        path: 'providers',
        loadComponent: () => import('./features/admin/providers/providers-list.component').then(m => m.ProvidersListComponent)
      },
      {
        path: 'calendar',
        loadComponent: () => import('./features/admin/calendar/full-calendar.component').then(m => m.FullCalendarComponent)
      },
      {
        path: 'clients',
        loadComponent: () => import('./features/admin/clients/clients-list.component').then(m => m.ClientsListComponent)
      },
      {
        path: 'packs',
        loadComponent: () => import('./features/admin/packs/packs-list.component').then(m => m.PacksListComponent)
      },
      {
        path: 'facturacion',
        loadComponent: () => import('./features/admin/billing/billing.component').then(m => m.BillingComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/admin/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'configuraciones',
        loadComponent: () => import('@shared/components/configuraciones/configuraciones.component').then(m => m.ConfiguracionesComponent)
      },
      {
        path: 'negocios',
        loadComponent: () => import('./features/admin/business/businesses-list.component').then(m => m.BusinessesListComponent)
      },
      {
        path: 'negocios/nuevo',
        loadComponent: () => import('./features/admin/business/business-create.component').then(m => m.BusinessCreateComponent)
      },
      {
        path: 'negocios/:id',
        loadComponent: () => import('./features/admin/business/business-edit.component').then(m => m.BusinessEditComponent)
      },
      {
        path: 'roles',
        loadComponent: () => import('./features/admin/roles/roles.component').then(m => m.RolesComponent)
      }
    ]
  },
  {
    path: 'provider',
    canActivate: [roleGuard(['provider'])],
    loadComponent: () => import('./layouts/provider-layout/provider-layout.component').then(m => m.ProviderLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/provider/calendar/provider-calendar.component').then(m => m.ProviderCalendarComponent)
      },
      {
        path: 'availability',
        loadComponent: () => import('./features/provider/availability/provider-availability.component').then(m => m.ProviderAvailabilityComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/provider/profile/provider-profile.component').then(m => m.ProviderProfileComponent)
      },
      {
        path: 'configuraciones',
        loadComponent: () => import('@shared/components/configuraciones/configuraciones.component').then(m => m.ConfiguracionesComponent)
      }
    ]
  },
  {
    path: 'terms',
    loadComponent: () => import('./features/legal/terms/terms.component').then(m => m.TermsComponent)
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];