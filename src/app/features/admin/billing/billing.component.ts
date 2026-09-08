import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { ProgressBarModule } from 'primeng/progressbar';
import { RouterModule } from '@angular/router';
import { LanguageService } from '@services/language.service';
import { formatCLP } from '@shared/config/currency.config';

// ── Interfaces locales del chart (misma forma que en el dashboard) ─────────────
interface ChartDataset {
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string;
  fill?: boolean;
  tension?: number;
  label?: string;
}
interface BillingChartData {
  labels: string[];
  datasets: ChartDataset[];
}
interface BillingChartOptions {
  responsive?: boolean;
  resizeDelay?: number;
  plugins?: Record<string, unknown>;
  maintainAspectRatio?: boolean;
  scales?: Record<string, unknown>;
}

type UsageStatus = 'success' | 'warning' | 'danger';

interface UsageMetric {
  key: 'locations' | 'providers' | 'clients';
  icon: string;
  used: number;
  limit: number;
  // Etiquetas pre-formateadas para mostrar con la separación de miles adecuada
  usedLabel: string;
  limitLabel: string;
  hintKey: string;
  hintCountLabel?: string;
}

type InvoiceStatus = 'paid' | 'pending' | 'failed';

interface Invoice {
  id: string;
  date: string;
  plan: string;
  amount: number;
  status: InvoiceStatus;
}

const PRIMARY_COLOR = '#046af4';          // azul marca (--bw-300)
const VIOLET_COLOR  = '#7c3aed';          // serie Profesionales
const GREEN_COLOR   = '#22c55e';          // --bw-success (serie Clientes)

const STATUS_COLOR: Record<UsageStatus, string> = {
  success: '#22c55e',
  warning: '#f59e0b',
  danger:  '#ef4444',
};

/** Convierte un color hex (#rrggbb) a rgba con la opacidad dada. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

@Component({
  selector: 'bw-billing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CardModule, ButtonModule, ChartModule, ProgressBarModule, RouterModule],
  templateUrl: './billing.component.html',
  styleUrls: ['./billing.component.scss'],
})
export class BillingComponent {
  readonly lang = inject(LanguageService);

  // ════════════════════════════════════════════════════════════════════════════
  // DATOS MOCK — FASE 6 billing aún no expone endpoints. NO CABLEAR a la API.
  //
  // TODO FASE 6: GET /v1/subscription   → plan activo, precio, renovación, período y días restantes.
  // TODO FASE 6: GET /v1/plans          → características del plan activo (Detalles del plan).
  // TODO FASE 6: GET /v1/payment-methods→ última tarjeta para el resumen del plan actual.
  // TODO FASE 6: GET /v1/tenants        → conteos reales (sucursales/profesionales/clientes) para "Uso del plan" y "Consumo mensual".
  // TODO FASE 6: GET /v1/invoices       → historial de facturación.
  // ════════════════════════════════════════════════════════════════════════════

  // ── Plan actual (mock) ─────────────────────────────────────────────────────
  readonly planName = 'Professional';
  readonly planPrice = 34990;
  readonly planPriceLabel = `${formatCLP(34990)} /mes`;
  readonly accountId = 'F8R9X1';
  readonly renewalDate = '12 Dic 2024';
  readonly cardBrand = 'Visa';
  readonly cardLast4 = '4242';
  readonly periodStart = '12 Nov';
  readonly periodEnd = '12 Dic';
  readonly daysLeft = '18';
  /** % del período ya transcurrido (12 días de 30) — solo visual. */
  readonly periodProgress = 40;

  // ── Uso del plan por métrica (mock) ─────────────────────────────────────────
  readonly usageMetrics: UsageMetric[] = [
    {
      key: 'locations',
      icon: 'pi pi-building',
      used: 3,
      limit: 5,
      usedLabel: '3',
      limitLabel: '5',
      hintKey: 'billing.usage.locations_hint',
      hintCountLabel: '2',
    },
    {
      key: 'providers',
      icon: 'pi pi-users',
      used: 7,
      limit: 8,
      usedLabel: '7',
      limitLabel: '8',
      hintKey: 'billing.usage.providers_warning',
    },
    {
      key: 'clients',
      icon: 'pi pi-user',
      used: 41200,
      limit: 100000,
      usedLabel: '41.2K',
      limitLabel: '100K',
      hintKey: 'billing.usage.clients_hint',
      hintCountLabel: '58.8K',
    },
  ];

  // ── Detalles del plan (mock) ────────────────────────────────────────────────
  readonly planFeatures = [
    'billing.feature.locations',
    'billing.feature.providers',
    'billing.feature.clients',
    'billing.feature.support',
    'billing.feature.messages',
  ];

  // ── Historial de facturación (mock) ─────────────────────────────────────────
  readonly invoices: Invoice[] = [
    { id: 'INV-2024-011', date: '12 Nov 2024', plan: 'Professional', amount: 34990, status: 'paid' },
    { id: 'INV-2024-010', date: '12 Oct 2024', plan: 'Professional', amount: 34990, status: 'paid' },
    { id: 'INV-2024-009', date: '12 Sep 2024', plan: 'Professional', amount: 34990, status: 'pending' },
    { id: 'INV-2024-008', date: '12 Ago 2024', plan: 'Professional', amount: 34990, status: 'failed' },
    { id: 'INV-2024-007', date: '12 Jul 2024', plan: 'Professional', amount: 34990, status: 'paid' },
  ];

  // ── Consumo mensual (chart) ────────────────────────────────────────────────
  /** Etiquetas de mes (últimos 6 meses) sensibles al idioma. */
  readonly consumptionLabels = computed<string[]>(() => {
    const locale = this.lang.lang() === 'es' ? 'es-CL' : 'en-US';
    return [5, 4, 3, 2, 1, 0].map((offset) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - offset);
      return new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
    });
  });

  readonly consumptionData = computed<BillingChartData>(() => ({
    labels: this.consumptionLabels(),
    datasets: [
      {
        label: this.lang.t('billing.usage.locations'),
        data: [2, 2, 3, 3, 3, 3],
        fill: false,
        borderColor: PRIMARY_COLOR,
        backgroundColor: hexToRgba(PRIMARY_COLOR, 0.1),
        tension: 0.4,
      },
      {
        label: this.lang.t('billing.usage.providers'),
        data: [4, 5, 5, 6, 6, 7],
        fill: false,
        borderColor: VIOLET_COLOR,
        backgroundColor: hexToRgba(VIOLET_COLOR, 0.1),
        tension: 0.4,
      },
      {
        label: this.lang.t('billing.usage.clients'),
        data: [12500, 18200, 24600, 30400, 36100, 41200],
        fill: false,
        borderColor: GREEN_COLOR,
        backgroundColor: hexToRgba(GREEN_COLOR, 0.1),
        tension: 0.4,
      },
    ],
  }));

  readonly lineOptions: BillingChartOptions = {
    responsive: true,
    resizeDelay: 0,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true },
    },
  };

  // ── Helpers de uso (pct / estado / hint) ───────────────────────────────────
  pctOf(metric: UsageMetric): number {
    return Math.round((metric.used / metric.limit) * 100);
  }

  usageStatus(metric: UsageMetric): UsageStatus {
    const pct = this.pctOf(metric);
    if (pct > 90) return 'danger';
    if (pct >= 70) return 'warning';
    return 'success';
  }

  usageChipClass(metric: UsageMetric): string {
    return `bw-chip--${this.usageStatus(metric)}`;
  }

  /** Texto de ayuda de cada métrica; las que incluyen un conteo lo interpolan. */
  usageHint(metric: UsageMetric): string {
    if (metric.hintCountLabel) {
      return this.lang.t(metric.hintKey, { n: metric.hintCountLabel });
    }
    return this.lang.t(metric.hintKey);
  }

  statusColor(metric: UsageMetric): string {
    return STATUS_COLOR[this.usageStatus(metric)];
  }

  statusKey(status: InvoiceStatus): string {
    switch (status) {
      case 'pending': return 'billing.pending';
      case 'failed':  return 'billing.failed';
      default:        return 'billing.paid';
    }
  }

  statusChipClass(status: InvoiceStatus): string {
    switch (status) {
      case 'pending': return 'bw-chip--warning';
      case 'failed':  return 'bw-chip--danger';
      default:        return 'bw-chip--success';
    }
  }

  /** Formatea montos CLP de las facturas (mismo formatter del repo). */
  price(value: number): string {
    return formatCLP(value);
  }

  /** Botón "Facturas": desplaza al historial de facturación. */
  scrollToHistory(): void {
    document.getElementById('billing-history')?.scrollIntoView({ behavior: 'smooth' });
  }
}
