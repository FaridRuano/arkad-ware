'use client';

import { useEffect, useMemo, useState } from 'react';
import PageLoader from '@public/components/shared/PageLoader/PageLoader';
import styles from './ScheduleSummaryPage.module.scss';

const m = (...tokens) =>
  tokens
    .flatMap((token) => String(token || '').split(/\s+/))
    .filter(Boolean)
    .map((name) => styles[name] ?? name)
    .join(' ');

const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_assistance: 'No asistió',
};

const PAYMENT_LABELS = {
  paid: 'Pagada',
  unpaid: 'Pendiente de cobro',
};

function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMoney(value = 0) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDateTime(iso) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;

  return new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getBarTone(value, max) {
  const ratio = max > 0 ? value / max : 0;
  if (ratio >= 0.85) return 'excellent';
  if (ratio >= 0.55) return 'good';
  if (ratio >= 0.25) return 'medium';
  return 'low';
}

export default function ScheduleSummaryPage() {
  const [period, setPeriod] = useState('day');
  const [dateISO, setDateISO] = useState(getTodayISO());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSummary() {
      try {
        if (!data) setLoading(true);
        else setRefreshing(true);
        setError('');

        const params = new URLSearchParams({
          period,
          date: dateISO,
        });

        const res = await fetch(`/api/admin/schedule/summary?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'No se pudo cargar el resumen');
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'No se pudo cargar el resumen');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    fetchSummary();
    return () => {
      cancelled = true;
    };
  }, [period, dateISO]);

  const summary = data?.summary || {};
  const chart = data?.chart || { days: [], maxBarValue: 1 };
  const recentAppointments = data?.recentAppointments || [];
  const upcomingAppointments = data?.upcomingAppointments || [];

  const selectedDateLabel = useMemo(() => formatDateLabel(dateISO), [dateISO]);

  if (loading) {
    return (
      <div className={m('scheduleSummaryPage page')}>
        <PageLoader
          title="Cargando resumen de agenda..."
          text="Estamos reuniendo las citas, ingresos y movimientos recientes."
        />
      </div>
    );
  }

  return (
    <div className={m('scheduleSummaryPage page')}>
      <section className={m('scheduleSummaryHero')}>
        <div className={m('scheduleSummaryHero__content')}>
          <span className={m('scheduleSummaryHero__eyebrow')}>Agenda</span>
          <h1 className={m('scheduleSummaryHero__title')}>Resumen operativo</h1>
          <p className={m('scheduleSummaryHero__text')}>
            Revisa la carga semanal, ingresos y movimiento reciente de citas desde una sola vista.
          </p>
        </div>

        <div className={m('scheduleSummaryHero__controls')}>
          <div className={m('scheduleSummaryToggle')}>
            <button
              type="button"
              className={m(`scheduleSummaryToggle__item ${period === 'day' ? 'is-active' : ''}`)}
              onClick={() => setPeriod('day')}
            >
              Día
            </button>
            <button
              type="button"
              className={m(`scheduleSummaryToggle__item ${period === 'month' ? 'is-active' : ''}`)}
              onClick={() => setPeriod('month')}
            >
              Mes
            </button>
          </div>

          <label className={m('scheduleSummaryDateField')}>
            <span className={m('scheduleSummaryDateField__label')}>Fecha base</span>
            <input
              className={m('scheduleSummaryDateField__input')}
              type="date"
              value={dateISO}
              onChange={(event) => setDateISO(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className={m('scheduleSummaryContext')}>
        <div className={m('scheduleSummaryContext__main')}>
          <span className={m('scheduleSummaryContext__label')}>
            Vista actual: {period === 'day' ? 'día' : 'mes'}
          </span>
          <strong className={m('scheduleSummaryContext__value')}>{selectedDateLabel}</strong>
        </div>

        <div className={m('scheduleSummaryContext__status')}>
          {refreshing ? 'Actualizando...' : 'Información al día'}
        </div>
      </section>

      {error ? (
        <section className={m('scheduleSummaryState scheduleSummaryState--error')}>
          <h2>No se pudo cargar el resumen</h2>
          <p>{error}</p>
        </section>
      ) : (
        <>
          <section className={m('scheduleSummaryStats')}>
            <article className={m('summaryStatCard')}>
              <span className={m('summaryStatCard__label')}>Pendientes por confirmar</span>
              <strong className={m('summaryStatCard__value')}>
                {summary.pendingConfirmationCount ?? 0}
              </strong>
              <span className={m('summaryStatCard__hint')}>
                Citas que todavía esperan confirmación
              </span>
            </article>

            <article className={m('summaryStatCard')}>
              <span className={m('summaryStatCard__label')}>Citas próximas</span>
              <strong className={m('summaryStatCard__value')}>{summary.upcomingCount ?? 0}</strong>
              <span className={m('summaryStatCard__hint')}>
                Pendientes por atender
              </span>
            </article>

            <article className={m('summaryStatCard summaryStatCard--accent')}>
              <span className={m('summaryStatCard__label')}>Cash semanal</span>
              <strong className={m('summaryStatCard__value')}>
                {formatMoney(summary.weeklyCashRevenue)}
              </strong>
              <span className={m('summaryStatCard__hint')}>
                Solo citas ya cobradas
              </span>
            </article>

            <article className={m('summaryStatCard')}>
              <span className={m('summaryStatCard__label')}>Ingreso estimado</span>
              <strong className={m('summaryStatCard__value')}>
                {formatMoney(summary.estimatedRevenue)}
              </strong>
              <span className={m('summaryStatCard__hint')}>
                Proyección de citas activas
              </span>
            </article>
          </section>

          <section className={m('scheduleSummaryGrid')}>
            <article className={m('scheduleSummaryPanel scheduleSummaryPanel--chart')}>
              <div className={m('scheduleSummaryPanel__header')}>
                <div>
                  <h2 className={m('scheduleSummaryPanel__title')}>Carga de la semana</h2>
                  <p className={m('scheduleSummaryPanel__text')}>
                    Cada barra refleja cuántas citas tiene el día. Haz click para ir a ese día.
                  </p>
                </div>

                <div className={m('scheduleSummaryLegend')}>
                  <span className={m('scheduleSummaryLegend__item')}>Baja</span>
                  <span className={m('scheduleSummaryLegend__item scheduleSummaryLegend__item--high')}>Alta</span>
                </div>
              </div>

              <div className={m('scheduleSummaryChart')}>
                {(chart.items || []).map((item) => {
                  const height = Math.round(
                    (100 * item.totalAppointments) / (chart.maxBarValue || 1)
                  );
                  const tone = getBarTone(item.totalAppointments, chart.maxBarValue || 1);
                  const isSelected = chart.mode === 'days' && item.date === dateISO;

                  return (
                    <button
                      key={item.key || item.date}
                      type="button"
                      className={m(`scheduleSummaryChart__bar scheduleSummaryChart__bar--${tone} ${isSelected ? 'is-selected' : ''}`)}
                      onClick={() => {
                        if (chart.mode === 'days') {
                          setDateISO(item.date);
                          setPeriod('day');
                        }
                      }}
                      disabled={chart.mode !== 'days'}
                    >
                      <span className={m('scheduleSummaryChart__value')}>{item.totalAppointments}</span>
                      <span className={m('scheduleSummaryChart__track')}>
                        <span
                          className={m('scheduleSummaryChart__fill')}
                          style={{ height: `${height}%` }}
                        />
                      </span>
                      <span className={m('scheduleSummaryChart__label')}>{item.label}</span>
                      <span className={m('scheduleSummaryChart__day')}>{item.helper}</span>
                    </button>
                  );
                })}
              </div>
            </article>

            <article className={m('scheduleSummaryPanel')}>
              <div className={m('scheduleSummaryPanel__header')}>
                <div>
                  <h2 className={m('scheduleSummaryPanel__title')}>Indicadores rápidos</h2>
                  <p className={m('scheduleSummaryPanel__text')}>
                    Una lectura rápida de avance, cobros y ejecución.
                  </p>
                </div>
              </div>

              <div className={m('summaryHighlightList')}>
                <div className={m('summaryHighlightItem')}>
                  <span className={m('summaryHighlightItem__label')}>Citas activas</span>
                  <strong className={m('summaryHighlightItem__value')}>
                    {summary.totalAppointments ?? 0}
                  </strong>
                </div>
                <div className={m('summaryHighlightItem')}>
                  <span className={m('summaryHighlightItem__label')}>Completadas</span>
                  <strong className={m('summaryHighlightItem__value')}>
                    {summary.completedCount ?? 0}
                  </strong>
                </div>
                <div className={m('summaryHighlightItem')}>
                  <span className={m('summaryHighlightItem__label')}>Citas cobradas</span>
                  <strong className={m('summaryHighlightItem__value')}>
                    {summary.paidCount ?? 0}
                  </strong>
                </div>
              </div>
            </article>
          </section>

          <section className={m('scheduleSummaryGrid scheduleSummaryGrid--lists')}>
            <article className={m('scheduleSummaryPanel')}>
              <div className={m('scheduleSummaryPanel__header')}>
                <div>
                  <div className={m('scheduleSummaryPanel__titleRow')}>
                    <h2 className={m('scheduleSummaryPanel__title')}>Citas recientes</h2>
                    <span className={m('scheduleSummaryPanel__tag')}>Operativo</span>
                  </div>
                  <p className={m('scheduleSummaryPanel__text')}>
                    Últimas citas activas creadas. Este bloque no cambia con el filtro.
                  </p>
                </div>
              </div>

              {recentAppointments.length === 0 ? (
                <div className={m('scheduleSummaryEmpty')}>
                  No hay citas recientes en este rango.
                </div>
              ) : (
                <div className={m('summaryAppointmentList')}>
                  {recentAppointments.map((appointment) => (
                    <article className={m('summaryAppointmentItem')} key={appointment.id}>
                      <div className={m('summaryAppointmentItem__main')}>
                        <strong className={m('summaryAppointmentItem__title')}>
                          {appointment?.client?.name || 'Cliente'}
                        </strong>
                        <span className={m('summaryAppointmentItem__meta')}>
                          {appointment.serviceName} · {appointment?.barber?.name || 'Sin barbero'}
                        </span>
                      </div>

                      <div className={m('summaryAppointmentItem__side')}>
                        <span className={m(`summaryPill summaryPill--${appointment.status || 'pending'}`)}>
                          {STATUS_LABELS[appointment.status] || appointment.status}
                        </span>
                        <span className={m('summaryAppointmentItem__time')}>
                          {formatDateTime(appointment.createdAt)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article className={m('scheduleSummaryPanel')}>
              <div className={m('scheduleSummaryPanel__header')}>
                <div>
                  <div className={m('scheduleSummaryPanel__titleRow')}>
                    <h2 className={m('scheduleSummaryPanel__title')}>Próximas citas</h2>
                    <span className={m('scheduleSummaryPanel__tag')}>Operativo</span>
                  </div>
                  <p className={m('scheduleSummaryPanel__text')}>
                    Lo siguiente que viene en la agenda. Este bloque no cambia con el filtro.
                  </p>
                </div>
              </div>

              {upcomingAppointments.length === 0 ? (
                <div className={m('scheduleSummaryEmpty')}>
                  No hay citas próximas registradas.
                </div>
              ) : (
                <div className={m('summaryAppointmentList')}>
                  {upcomingAppointments.map((appointment) => (
                    <article className={m('summaryAppointmentItem')} key={appointment.id}>
                      <div className={m('summaryAppointmentItem__main')}>
                        <strong className={m('summaryAppointmentItem__title')}>
                          {appointment?.client?.name || 'Cliente'}
                        </strong>
                        <span className={m('summaryAppointmentItem__meta')}>
                          {appointment.serviceName} · {appointment?.barber?.name || 'Sin barbero'}
                        </span>
                      </div>

                      <div className={m('summaryAppointmentItem__side')}>
                        <span className={m(`summaryPill summaryPill--${appointment.status || 'pending'}`)}>
                          {STATUS_LABELS[appointment.status] || appointment.status}
                        </span>
                        <span className={m(`summaryPill ${appointment.paymentStatus === 'paid' ? 'summaryPill--paid' : 'summaryPill--unpaid'}`)}>
                          {PAYMENT_LABELS[appointment.paymentStatus] || '—'}
                        </span>
                        <span className={m('summaryAppointmentItem__time')}>
                          {formatDateTime(appointment.startAt)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </div>
  );
}
