import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { DateTime } from 'luxon';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import type { Context } from 'chartjs-plugin-datalabels';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { AuthService } from '@services/auth.service';
import { TimezoneService } from '@services/timezone.service';
import { LanguageService } from '@services/language.service';
import { CalendarNavigationService } from '@services/calendar-navigation.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Booking } from '@models';
import { BOOKING_STATUSES } from '@features/admin/bookings/constants/booking-statuses';
import { locationColor } from '@shared/utils/location-palette.util';

interface ChartDataset { data: number[]; backgroundColor?: string | string[]; borderColor?: string; fill?: boolean; tension?: number; label?: string }
interface DashboardChartData { labels: string[]; datasets: ChartDataset[] }
interface DashboardChartOptions {
  responsive?:          boolean;
  resizeDelay?:         number;
  plugins?:             Record<string, unknown>;
  maintainAspectRatio?: boolean;
  aspectRatio?:         number;
  scales?:              Record<string, unknown>;
  cutout?:              string;
}

interface LocationStat {
  name: string;
  count: number;
  color: string;
}

interface DailyStat {
  dayLabel: string;
  count: number;
}

interface DashboardData {
  todayCount: number;
  pendingCount: number;
  locationStats: LocationStat[];
  weeklyStats: DailyStat[];
  weekBookings: Booking[];
}

/** Params reactivos del rxResource — cambian con el rango de fechas seleccionado
 *  y con el negocio activo (un switch de tenant re-ejecuta la carga). */
interface DashboardRangeParams {
  start: string;
  end: string;
  anchor: string;
  businessKey?: number | null;
}

interface LocationOption {
  label: string;
  value: number | null;
}

type RangeMode = 'mes' | 'semana' | 'libre';

interface RangeOption {
  label: string;
  value: RangeMode;
}

const PRIMARY_COLOR = '#046af4';
const DAY_LABELS    = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const PENDING_STATUS_ID = BOOKING_STATUSES.find((s) => s.label === 'Pendiente')!.value;

/** Convierte un color hex (#rrggbb) a rgba con la opacidad dada. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Normalize API response: may be a plain array or { data: [...] } */
function normalizeBookings(res: unknown): Booking[] {
  return Array.isArray(res) ? res : (res as any)?.data ?? [];
}

/** Week labels index — used to keep the "week" select stable across months. */
function mondayOf(iso: string, tz: string): DateTime {
  return DateTime.fromISO(iso, { zone: tz }).startOf('week');
}

@Component({
  selector: 'bw-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CardModule, ChartModule, SelectModule, SkeletonModule, DatePickerModule, ButtonModule, TooltipModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent {
  private bookingsApi = inject(BookingsApiService);
  private httpError   = inject(HttpErrorService);
  private auth        = inject(AuthService);
  private tzService = inject(TimezoneService);
  readonly lang = inject(LanguageService);
  private router = inject(Router);
  private calNav = inject(CalendarNavigationService);

  /** ReferenceStore: datos maestros reactivos */
  private refStore  = inject(ReferenceStore);

  /** ── signals reactivas desde ReferenceStore ── */
  readonly locations = this.refStore.locations;
  readonly providers = this.refStore.providers;

  readonly userName = computed(() => this.auth.user()?.name ?? 'Usuario');

  /** ── Filtro de location ── */
  readonly selectedLocationId = signal<number | null>(null);
  /** Modo del gráfico "Citas por Día" cuando se ven todas las sucursales. */
  readonly weeklyMode = signal<'sumatoria' | 'comparativa'>('sumatoria');

  /** ── Selector de rango de fechas ── */
  readonly rangeMode = signal<RangeMode>('mes');
  readonly selectedMonth = signal<number>(DateTime.now().setZone(this.tzService.activeTimezone()).month);
  readonly selectedWeekStart = signal<string>(
    DateTime.now().setZone(this.tzService.activeTimezone()).startOf('week').toISODate()!,
  );
  readonly customStart = signal<Date | null>(null);
  readonly customEnd = signal<Date | null>(null);

  readonly chartPlugins = [ChartDataLabels];

  readonly locationOptions = computed<LocationOption[]>(() => [
    { label: 'Todas las sucursales', value: null },
    ...this.locations().map(l => ({ label: l.name, value: l.id })),
  ]);

  /** ── opciones del selector de rango ── */
  readonly rangeModeOptions = computed<RangeOption[]>(() => [
    { label: this.lang.t('dashboard.range.mode.mes'), value: 'mes' },
    { label: this.lang.t('dashboard.range.mode.semana'), value: 'semana' },
    { label: this.lang.t('dashboard.range.mode.libre'), value: 'libre' },
  ]);

  readonly monthOptions = computed(() =>
    Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
      label: this.lang.t(`dashboard.range.month.${m}`),
      value: m,
    })),
  );

  /** Semanas del mes elegido (Semana 1..N). Regla ISO: la semana pertenece al
   *  mes que contiene su jueves, así cada semana aparece en un único mes. */
  readonly weekOptions = computed(() => {
    const tz = this.tzService.activeTimezone();
    const now = DateTime.now().setZone(tz);
    const monthStart = now.set({ month: this.selectedMonth(), day: 1 }).startOf('day');
    const monthEnd = monthStart.endOf('month');

    const weeks: { label: string; value: string }[] = [];
    let monday = monthStart.startOf('week'); // lunes on/antes del día 1
    if (monday.plus({ days: 3 }) < monthStart) {
      monday = monday.plus({ weeks: 1 }); // el jueves aún no cae en el mes → semana siguiente
    }
    let i = 1;
    while (monday.plus({ days: 3 }) <= monthEnd) {
      weeks.push({
        label: this.lang.t('dashboard.range.week', { n: String(i) }),
        value: monday.toISODate()!,
      });
      monday = monday.plus({ weeks: 1 });
      i++;
    }
    return weeks;
  });

  /** Lunes de la primera semana que pertenece al mes (la que contiene su jueves). */
  private firstWeekMondayOfMonth(month: number): DateTime {
    const tz = this.tzService.activeTimezone();
    const now = DateTime.now().setZone(tz);
    const monthStart = now.set({ month, day: 1 }).startOf('day');
    let monday = monthStart.startOf('week');
    if (monday.plus({ days: 3 }) < monthStart) {
      monday = monday.plus({ weeks: 1 });
    }
    return monday;
  }

  /** Mes al que pertenece la semana cuyo lunes es `monday` (mes de su jueves). */
  private monthOfWeekMonday(monday: DateTime): number {
    return monday.plus({ days: 3 }).month;
  }

  /** ── rango resuelto (start/end/anchor) según el modo activo ── */
  readonly rangeDetails = computed<{ start: DateTime; end: DateTime; anchor: DateTime }>(() => {
    const tz  = this.tzService.activeTimezone();
    const now = DateTime.now().setZone(tz);
    const today = now.startOf('day');
    const mode = this.rangeMode();

    let start: DateTime;
    let end: DateTime;

    if (mode === 'mes') {
      const month = this.selectedMonth();
      start = now.set({ month, day: 1 }).startOf('day');
      end = start.endOf('month');
      if (month === now.month) end = today; // mes actual → hoy
    } else if (mode === 'semana') {
      start = mondayOf(this.selectedWeekStart(), tz).startOf('day');
      end = start.endOf('week'); // lunes → domingo
    } else {
      // Modo libre: dos datepickers Desde/Hasta
      const startDt = this.customStart()
        ? DateTime.fromJSDate(this.customStart()!, { zone: tz }).startOf('day') : null;
      const endDt = this.customEnd()
        ? DateTime.fromJSDate(this.customEnd()!, { zone: tz }).startOf('day') : null;
      if (startDt && endDt) {
        const [early, late] = startDt <= endDt ? [startDt, endDt] : [endDt, startDt];
        start = early;
        end = late;
      } else {
        // Rango incompleto → vuelve al estándar (mes actual → hoy)
        start = now.startOf('month');
        end = today;
      }
    }

    // "Hoy": día actual si cae dentro del rango; si no, el primer día del rango.
    const anchor = (today >= start && today <= end) ? today : start;
    return { start, end, anchor };
  });

  /** Params para el rxResource (ISODate). `businessKey` engancha la carga al negocio
   *  activo: al switchear de tenant, me() cambia → el computed se invalida y rxResource
   *  recarga los charts con los datos del nuevo negocio. */
  readonly rangeParams = computed(() => {
    const { start, end, anchor } = this.rangeDetails();
    return {
      start: start.toISODate()!,
      end: end.toISODate()!,
      anchor: anchor.toISODate()!,
      businessKey: this.auth.me()?.business?.id ?? this.auth.me()?.tenant_id ?? null,
    };
  });

  /** Texto del badge que muestra el rango activo (estándar o elegido). */
  readonly rangeBadgeText = computed<string>(() => {
    const tz  = this.tzService.activeTimezone();
    const now = DateTime.now().setZone(tz);
    const { start, end } = this.rangeDetails();
    const isStandard = this.rangeMode() === 'mes' && this.selectedMonth() === now.month;
    if (isStandard) return this.lang.t('dashboard.range.standard');
    return `${start.toFormat('dd/MM/yyyy')} – ${end.toFormat('dd/MM/yyyy')}`;
  });

  /** ── rxResource: carga reactiva del dashboard ──
   * Params-driven: el `params` deriva del rango seleccionado, así que cada
   * cambio de mes/semana/rango libre re-ejecuta el stream y recarga los datos.
   * (Un rxResource sin `params` solo corre su stream una vez — los cambios
   * posteriores de señal NO disparan recarga.)
   */
  readonly dashboardStats = rxResource<DashboardData, DashboardRangeParams>({
    params: () => this.rangeParams(),
    stream: ({ params }) => {
      const { start, end, anchor } = params;

      return forkJoin({
        today:   this.bookingsApi.getBookings({ date_from: anchor, date_to: anchor, per_page: 200 }),
        pending: this.bookingsApi.getBookings({ status_id: PENDING_STATUS_ID, date_from: start, date_to: end, per_page: 200 }),
        week:    this.bookingsApi.getBookings({ date_from: start, date_to: end, per_page: 500 }),
      }).pipe(
        map(({ today, pending, week }) => {
          const todayList   = normalizeBookings(today);
          const pendingList = normalizeBookings(pending);
          const weekList    = normalizeBookings(week);
          return {
            todayCount:    todayList.length,
            pendingCount:  pendingList.length,
            locationStats: this.computeLocationStats(weekList),
            weeklyStats:   this.computeWeeklyStats(weekList),
            weekBookings:  weekList,
          };
        }),
      );
    },
  });

  /** ── señales derivadas para el template ── */
  readonly loading         = computed(() => this.dashboardStats.isLoading() && !this.dashboardStats.hasValue());
  readonly todayBookings   = computed(() => this.dashboardStats.value()?.todayCount   ?? 0);
  readonly pendingBookings = computed(() => this.dashboardStats.value()?.pendingCount ?? 0);

  /** Weekly stats filtrados por location */
  readonly filteredWeeklyStats = computed<DailyStat[]>(() => {
    const data   = this.dashboardStats.value();
    const locId  = this.selectedLocationId();
    if (!data) return [];
    const filtered = locId ? data.weekBookings.filter(b => b.location?.id === locId) : data.weekBookings;
    return this.computeWeeklyStats(filtered);
  });

  readonly locationChartData = computed<DashboardChartData | null>(() => {
    const stats = this.dashboardStats.value();
    if (!stats?.locationStats.length) return null;
    return {
      labels:   stats.locationStats.map(s => s.name),
      datasets: [{ data: stats.locationStats.map(s => s.count), backgroundColor: stats.locationStats.map(s => s.color) }],
    };
  });

  readonly weeklyChartData = computed<DashboardChartData>(() => {
    const stats = this.filteredWeeklyStats();
    const locId = this.selectedLocationId();
    const data = this.dashboardStats.value()?.weekBookings ?? [];

    // Sucursal puntual → una sola línea con su color.
    if (locId) {
      const color = locationColor(locId);
      return {
        labels: DAY_LABELS,
        datasets: [{
          label: this.lang.t('dashboard.chart.citas'),
          data: stats.map(s => s.count),
          fill: true,
          borderColor: color,
          backgroundColor: hexToRgba(color, 0.1),
          tension: 0.4,
        }],
      };
    }

    // "Todas las sucursales": modo sumatoria (total) o comparativa (por sucursal).
    if (this.weeklyMode() === 'sumatoria') {
      return {
        labels: DAY_LABELS,
        datasets: [{
          label: this.lang.t('dashboard.chart.total'),
          data: stats.map(s => s.count),
          fill: true,
          borderColor: PRIMARY_COLOR,
          backgroundColor: hexToRgba(PRIMARY_COLOR, 0.1),
          tension: 0.4,
        }],
      };
    }

    // Comparativa: una línea por sucursal, cada una con su color de la paleta.
    const byLoc = new Map<number, { name: string; bookings: Booking[] }>();
    for (const b of data) {
      const id = b.location?.id ?? -1;
      const name = b.location?.name ?? 'Sin ubicación';
      const entry = byLoc.get(id) ?? { name, bookings: [] };
      entry.bookings.push(b);
      byLoc.set(id, entry);
    }

    const datasets = Array.from(byLoc.entries()).map(([id, loc]) => {
      const color = locationColor(id);
      return {
        label: loc.name,
        data: this.computeWeeklyStats(loc.bookings).map(s => s.count),
        fill: false,
        borderColor: color,
        backgroundColor: hexToRgba(color, 0.1),
        tension: 0.4,
      };
    });

    return { labels: DAY_LABELS, datasets };
  });

  /** ── opciones de charts ── */
  readonly doughnutOptions = signal<DashboardChartOptions>({
    responsive: true,
    resizeDelay: 0,
    maintainAspectRatio: true,
    cutout: '60%',
    plugins: {
      legend: { position: 'bottom' },
      datalabels: {
        display: (ctx: Context) => {
          const data = ctx.dataset.data;
          const total = (data as number[]).reduce((a: number, b: number) => a + b, 0);
          return total > 0;
        },
        color: '#fff',
        font: { weight: 'bold' as const, size: 13 },
        formatter: (_value: number, ctx: Context) => {
          const data = ctx.dataset.data;
          const total = (data as number[]).reduce((a: number, b: number) => a + b, 0);
          const pct = total > 0 ? ((_value / total) * 100).toFixed(0) + '%' : '';
          return `${_value}\n${pct}`;
        },
        textAlign: 'center',
        offset: 2,
      },
    },
  });

  readonly lineOptions = signal<DashboardChartOptions>({
    responsive: true,
    resizeDelay: 0,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true },
    },
  });

  /** ── efecto para mostrar errores de carga ── */
  private errorEffect = effect(() => {
    const err = this.dashboardStats.error();
    if (err instanceof HttpErrorResponse) {
      this.httpError.handle(err, 'cargar dashboard');
    }
  });

  // ── selectores de rango ─────────────────────────────────────

  /** Card "Citas Pendientes": abre el calendario con el filtro Pendientes activo y
   *  un contexto de vista/fecha que refleja el rango activo del dashboard:
   *  - 'mes'    → vista de mes (dayGridMonth) posicionada en el mes seleccionado.
   *  - 'semana' → vista de semana (timeGridWeek) en la semana seleccionada.
   *  - 'libre'  → rango custom que puede cruzar dos meses: el calendario no puede
   *               renderizar dos meses a la vez, así que abre en semana anclada al
   *               inicio del rango (fallback útil) y describe el período elegido.
   *  El toast con el contexto (vista + rango) lo muestra el calendario tras la
   *  navegación; no se dispara un toast propio aquí para no duplicar mensajes. */
  onPendingCardClick(): void {
    const { start, end } = this.rangeDetails();
    const mode = this.rangeMode();

    let view: 'dayGridMonth' | 'timeGridWeek';
    let gotoDate: string;
    let rangeEnd: string | undefined;

    if (mode === 'mes') {
      view = 'dayGridMonth';
      gotoDate = start.toISODate()!;
    } else if (mode === 'semana') {
      view = 'timeGridWeek';
      gotoDate = start.toISODate()!;
      rangeEnd = end.toISODate()!;
    } else {
      // 'libre': fallback a semana anclada al inicio del rango custom
      view = 'timeGridWeek';
      gotoDate = start.toISODate()!;
      rangeEnd = end.toISODate()!;
    }

    this.calNav.navigateToCalendar(null, null, [PENDING_STATUS_ID], this.router, {
      view,
      gotoDate,
      rangeEnd,
    });
  }

  /** Desplaza la semana seleccionada ±1 (modo semana). El mes visible se
   *  sincroniza con la nueva semana (regla ISO: mes que contiene su jueves). */
  shiftWeek(delta: number): void {
    const tz = this.tzService.activeTimezone();
    const base = mondayOf(this.selectedWeekStart(), tz);
    const next = base.plus({ weeks: delta });
    this.selectedWeekStart.set(next.toISODate()!);
    this.selectedMonth.set(this.monthOfWeekMonday(next));
  }

  /** Al cambiar el modo: al entrar en 'semana', garantiza que la semana
   *  seleccionada pertenezca al mes visible del dropdown. */
  onRangeModeChange(mode: RangeMode): void {
    this.rangeMode.set(mode);
    if (mode === 'semana') {
      const tz = this.tzService.activeTimezone();
      const week = mondayOf(this.selectedWeekStart(), tz);
      if (this.monthOfWeekMonday(week) !== this.selectedMonth()) {
        const first = this.firstWeekMondayOfMonth(this.selectedMonth());
        this.selectedWeekStart.set(first.toISODate()!);
      }
    }
  }

  /** Al elegir mes en modo semana (selector grueso): salta a la primera semana
   *  del mes elegido (selector fino). */
  onWeekMonthChange(month: number): void {
    this.selectedMonth.set(month);
    const first = this.firstWeekMondayOfMonth(month);
    this.selectedWeekStart.set(first.toISODate()!);
  }

  /** Al elegir una semana directo en el dropdown fino: si esa semana pertenece
   *  a otro mes (semana de borde), sincroniza el selector grueso. */
  syncMonthToWeek(iso: string): void {
    this.selectedWeekStart.set(iso);
    const tz = this.tzService.activeTimezone();
    this.selectedMonth.set(this.monthOfWeekMonday(mondayOf(iso, tz)));
  }

  /** Vuelve al rango estándar (mes actual → hoy). */
  clearFilters(): void {
    const tz  = this.tzService.activeTimezone();
    const now = DateTime.now().setZone(tz);
    this.rangeMode.set('mes');
    this.selectedMonth.set(now.month);
    this.selectedWeekStart.set(now.startOf('week').toISODate()!);
    this.customStart.set(null);
    this.customEnd.set(null);
  }

  // ── helpers ─────────────────────────────────────────

  private computeLocationStats(bookings: Booking[]): LocationStat[] {
    // Se agrupa por `location.id` y el color se resuelve con el palette
    // compartido (determinista por id), para que sea idéntico al color que
    // identifica a la sucursal en la lista de profesionales.
    const countByLoc = new Map<number | null, { name: string; count: number }>();

    for (const b of bookings) {
      const id = b.location?.id ?? null;
      const name = b.location?.name ?? 'Sin ubicación';
      const entry = countByLoc.get(id) ?? { name, count: 0 };
      entry.count++;
      countByLoc.set(id, entry);
    }

    return Array.from(countByLoc.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([id, { name, count }]) => ({
        name,
        count,
        color: locationColor(id),
      }));
  }

  private computeWeeklyStats(bookings: Booking[]): DailyStat[] {
    const dayCounts = new Array(7).fill(0) as number[];

    for (const b of bookings) {
      const bDt = DateTime.fromISO(b.start_time, { zone: this.tzService.activeTimezone() });
      if (bDt.isValid) {
        const dayIdx = bDt.weekday - 1; // 0=Mon, 6=Sun
        dayCounts[dayIdx]++;
      }
    }

    return DAY_LABELS.map((label, i) => ({
      dayLabel: label,
      count: dayCounts[i],
    }));
  }
}
