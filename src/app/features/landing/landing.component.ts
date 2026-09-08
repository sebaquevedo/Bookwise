import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LanguageService } from '@services/language.service';

@Component({
  selector: 'bw-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent {
  readonly lang = inject(LanguageService);

  readonly features = [
    {
      title: 'landing.features.1.title',
      desc: 'landing.features.1.desc',
      icon: 'pi-calendar',
      color: 'var(--bw-300)',
    },
    {
      title: 'landing.features.2.title',
      desc: 'landing.features.2.desc',
      icon: 'pi-whatsapp',
      color: 'var(--bw-success)',
    },
    {
      title: 'landing.features.3.title',
      desc: 'landing.features.3.desc',
      icon: 'pi-comments',
      color: '#7c3aed',
    },
  ];

  /** Categorías de negocio: id = clave i18n `landing.business.{id}.*`, img = foto de la card. */
  readonly businessTypes = [
    { id: 1, img: 'assets/images/landing_page/centro-estetica.jpg' },
    { id: 2, img: 'assets/images/landing_page/spa.jpg' },
    { id: 3, img: 'assets/images/landing_page/salon-belleza.jpg' },
    { id: 4, img: 'assets/images/landing_page/manicure-pedicure.jpg' },
    { id: 5, img: 'assets/images/landing_page/barberia.jpg' },
    { id: 6, img: 'assets/images/landing_page/peluqueria.jpg' },
    { id: 7, img: 'assets/images/landing_page/cejas-pestanas.jpg' },
    { id: 8, img: 'assets/images/landing_page/salones-maquillaje.webp' },
    { id: 9, img: 'assets/images/landing_page/medicina-alternativa.jpg' },
    { id: 10, img: 'assets/images/landing_page/podologia.webp' },
    { id: 11, img: 'assets/images/landing_page/fisioterapia-kinesiologia.jpg' },
    { id: 12, img: 'assets/images/landing_page/psicologia.jpg' },
    { id: 13, img: 'assets/images/landing_page/nutricion.jpg' },
    { id: 14, img: 'assets/images/landing_page/clinicas.webp' },
  ];

  readonly plans = [
    {
      key: 'starter',
      name: 'Starter',
      price: '14.990',
      priceNote: '/mes · CLP',
      features: [
        '1 profesional',
        'Agenda ilimitada',
        'Clientes y fichas',
        'Recordatorios por email',
      ],
    },
    {
      key: 'professional',
      name: 'Professional',
      price: '34.990',
      priceNote: '/mes · CLP',
      popular: true,
      features: [
        'Hasta 4 profesionales',
        '1-3 sucursales',
        'Caja y pagos',
        'Notificaciones',
      ],
    },
    {
      key: 'enterprise',
      name: 'Enterprise',
      price: '79.990',
      priceNote: '/mes · CLP',
      features: [
        '2+ empresas (multi-tenant)',
        'Multi-sucursal',
        'API + panel consolidado',
        'Soporte prioritario',
      ],
    },
  ];
}
