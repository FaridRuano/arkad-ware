'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageLoader from '@public/components/shared/PageLoader/PageLoader';
import styles from './ScheduleDailyPage.module.scss';

const m = (...tokens) =>
  tokens
    .flatMap((token) => String(token || '').split(/\s+/))
    .filter(Boolean)
    .map((name) => styles[name] ?? name)
    .join(' ');

const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  in_progress: 'En proceso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_assistance: 'No asistió',
};

const PAYMENT_LABELS = {
  paid: 'Pagada',
  unpaid: 'Pendiente de cobro',
};

function formatDateTime(iso) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDateLabel(dateStr) {
  const date = dateStr ? new Date(`${dateStr}T00:00:00`) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Hoy';

  return new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatMoney(value = 0) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function buildWhatsAppLink(phone, appointment) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (!digits) return '';

  const message = `Hola ${appointment?.client?.name || ''}, te recordamos tu cita de ${appointment?.serviceName || 'servicio'} a las ${formatDateTime(appointment?.startAt)}.`;
  return `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`;
}

export default function ScheduleDailyPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [actionId, setActionId] = useState('');
  const hasLoadedRef = useRef(false);

  const fetchDaily = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent && !hasLoadedRef.current) setLoading(true);
      else setRefreshing(true);

      setError('');

      const res = await fetch('/api/admin/schedule/daily-summary', {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'No se pudo cargar el día');
      setData(payload);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err?.message || 'No se pudo cargar el día');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDaily();
  }, [fetchDaily]);

  const handleStatusChange = useCallback(async (appointment, to, reason = 'daily_workstation') => {
    if (!appointment?.id) return;
    try {
      setActionId(`${appointment.id}:${to}`);
      const res = await fetch(`/api/admin/schedule/appointments/status/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, reason }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'No se pudo actualizar la cita');
      await fetchDaily({ silent: true });
    } catch (err) {
      alert(err?.message || 'No se pudo actualizar la cita');
    } finally {
      setActionId('');
    }
  }, [fetchDaily]);

  const handleBillingChange = useCallback(async (appointment, paymentStatus) => {
    if (!appointment?.id) return;
    try {
      setActionId(`${appointment.id}:${paymentStatus}`);
      const res = await fetch(`/api/admin/schedule/appointments/billing/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'No se pudo actualizar el cobro');
      await fetchDaily({ silent: true });
    } catch (err) {
      alert(err?.message || 'No se pudo actualizar el cobro');
    } finally {
      setActionId('');
    }
  }, [fetchDaily]);

  const currentAppointment = useMemo(() => {
    const current = data?.currentAppointments?.[0];
    if (current) return current;
    return data?.upcomingAppointments?.[0] || data?.attentionAppointments?.[0] || null;
  }, [data]);

  if (loading) {
    return (
      <div className={m('dailyPage page')}>
        <PageLoader
          title="Cargando estación diaria..."
          text="Estamos reuniendo las citas del día para gestionar la operación."
        />
      </div>
    );
  }

  const summary = data?.summary || {};
  const attentionAppointments = data?.attentionAppointments || [];
  const upcomingAppointments = data?.upcomingAppointments || [];
  const pastAppointments = data?.pastAppointments || [];

  return (
    <div className={m('dailyPage page')}>
      <section className={m('dailyHero')}>
        <div>
          <span className={m('dailyHero__eyebrow')}>Agenda diaria</span>
          <h1 className={m('dailyHero__title')}>Workstation del día</h1>
          <p className={m('dailyHero__text')}>
            Controla la cita actual, confirma las siguientes y no pierdas de vista lo pendiente por cobrar.
          </p>
        </div>

        <div className={m('dailyHero__meta')}>
          <strong className={m('dailyHero__date')}>{formatDateLabel(data?.date)}</strong>
          <span className={m('dailyHero__status')}>
            {refreshing ? 'Actualizando...' : 'Operación lista'}
          </span>
        </div>
      </section>

      <section className={m('dailyStats')}>
        <article className={m('dailyStatCard')}>
          <span className={m('dailyStatCard__label')}>Total del día</span>
          <strong className={m('dailyStatCard__value')}>{summary.totalToday ?? 0}</strong>
        </article>
        <article className={m('dailyStatCard')}>
          <span className={m('dailyStatCard__label')}>Pendientes por confirmar</span>
          <strong className={m('dailyStatCard__value')}>{summary.pendingConfirmationCount ?? 0}</strong>
        </article>
        <article className={m('dailyStatCard dailyStatCard--warn')}>
          <span className={m('dailyStatCard__label')}>Completadas sin cobrar</span>
          <strong className={m('dailyStatCard__value')}>{summary.unpaidCompletedCount ?? 0}</strong>
        </article>
        <article className={m('dailyStatCard dailyStatCard--accent')}>
          <span className={m('dailyStatCard__label')}>Cash del día</span>
          <strong className={m('dailyStatCard__value')}>{formatMoney(summary.totalCash)}</strong>
        </article>
      </section>

      {error ? (
        <section className={m('dailyState dailyState--error')}>
          <h2>No se pudo cargar la jornada</h2>
          <p>{error}</p>
        </section>
      ) : (
        <>
          <section className={m('dailyGrid')}>
            <article className={m('dailyPanel dailyPanel--main')}>
              <div className={m('dailyPanel__header')}>
                <div>
                  <span className={m('dailyPanel__tag')}>Principal</span>
                  <h2 className={m('dailyPanel__title')}>
                    {currentAppointment?.status === 'in_progress' ? 'Cita en curso' : 'Siguiente foco'}
                  </h2>
                </div>
              </div>

              {currentAppointment ? (
                <div className={m('dailyFocusCard')}>
                  <div className={m('dailyFocusCard__top')}>
                    <div>
                      <h3 className={m('dailyFocusCard__name')}>
                        {currentAppointment?.client?.name || 'Cliente'}
                      </h3>
                      <p className={m('dailyFocusCard__meta')}>
                        {currentAppointment?.serviceName || 'Servicio'} · {currentAppointment?.barber?.name || 'Sin barbero'}
                      </p>
                    </div>

                    <div className={m('dailyFocusCard__chips')}>
                      <span className={m(`dailyPill dailyPill--${currentAppointment?.status || 'pending'}`)}>
                        {STATUS_LABELS[currentAppointment?.status] || currentAppointment?.status}
                      </span>
                      <span className={m(`dailyPill ${currentAppointment?.paymentStatus === 'paid' ? 'dailyPill--paid' : 'dailyPill--unpaid'}`)}>
                        {PAYMENT_LABELS[currentAppointment?.paymentStatus] || '—'}
                      </span>
                    </div>
                  </div>

                  <div className={m('dailyFocusCard__info')}>
                    <div className={m('dailyInfoItem')}>
                      <span className={m('dailyInfoItem__label')}>Hora</span>
                      <strong className={m('dailyInfoItem__value')}>
                        {formatDateTime(currentAppointment?.startAt)} - {formatDateTime(currentAppointment?.endAt)}
                      </strong>
                    </div>
                    <div className={m('dailyInfoItem')}>
                      <span className={m('dailyInfoItem__label')}>Duración</span>
                      <strong className={m('dailyInfoItem__value')}>
                        {currentAppointment?.serviceDurationMinutes || currentAppointment?.durationMinutes || 0} min
                      </strong>
                    </div>
                    <div className={m('dailyInfoItem')}>
                      <span className={m('dailyInfoItem__label')}>Valor</span>
                      <strong className={m('dailyInfoItem__value')}>
                        {formatMoney(currentAppointment?.price)}
                      </strong>
                    </div>
                  </div>

                  {currentAppointment?.status === 'completed' && currentAppointment?.paymentStatus === 'unpaid' && (
                    <div className={m('dailyAlert')}>
                      Esta cita ya está completada pero todavía falta marcarla como cobrada.
                    </div>
                  )}

                  <div className={m('dailyActions')}>
                    {currentAppointment?.client?.phone ? (
                      <a
                        className={m('dailyButton dailyButton--ghost')}
                        href={buildWhatsAppLink(currentAppointment.client.phone, currentAppointment)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        WhatsApp
                      </a>
                    ) : null}

                    {currentAppointment?.status === 'pending' && (
                      <button
                        className={m('dailyButton')}
                        onClick={() => handleStatusChange(currentAppointment, 'confirmed', 'daily_confirm')}
                        disabled={Boolean(actionId)}
                      >
                        Confirmar
                      </button>
                    )}

                    {['pending', 'confirmed'].includes(currentAppointment?.status) && (
                      <button
                        className={m('dailyButton')}
                        onClick={() => handleStatusChange(currentAppointment, 'in_progress', 'daily_start')}
                        disabled={Boolean(actionId)}
                      >
                        Iniciar
                      </button>
                    )}

                    {currentAppointment?.status === 'in_progress' && (
                      <button
                        className={m('dailyButton')}
                        onClick={() => handleStatusChange(currentAppointment, 'completed', 'daily_complete')}
                        disabled={Boolean(actionId)}
                      >
                        Completar
                      </button>
                    )}

                    {currentAppointment?.paymentStatus === 'unpaid' && (
                      <button
                        className={m('dailyButton dailyButton--positive')}
                        onClick={() => handleBillingChange(currentAppointment, 'paid')}
                        disabled={Boolean(actionId)}
                      >
                        Marcar cobrado
                      </button>
                    )}

                    {!['completed', 'cancelled', 'no_assistance'].includes(currentAppointment?.status) && (
                      <>
                        <button
                          className={m('dailyButton dailyButton--warning')}
                          onClick={() => handleStatusChange(currentAppointment, 'no_assistance', 'daily_no_assistance')}
                          disabled={Boolean(actionId)}
                        >
                          No asistió
                        </button>
                        <button
                          className={m('dailyButton dailyButton--danger')}
                          onClick={() => handleStatusChange(currentAppointment, 'cancelled', 'daily_cancel')}
                          disabled={Boolean(actionId)}
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className={m('dailyEmpty')}>No hay una cita principal para gestionar ahora mismo.</div>
              )}
            </article>

            <article className={m('dailyPanel')}>
              <div className={m('dailyPanel__header')}>
                <div>
                  <span className={m('dailyPanel__tag')}>Atención</span>
                  <h2 className={m('dailyPanel__title')}>Pendientes del día</h2>
                </div>
              </div>

              {attentionAppointments.length === 0 ? (
                <div className={m('dailyEmpty')}>No hay alertas activas por ahora.</div>
              ) : (
                <div className={m('dailyList')}>
                  {attentionAppointments.map((appointment) => (
                    <div className={m('dailyListItem')} key={appointment.id}>
                      <div className={m('dailyListItem__main')}>
                        <strong>{appointment?.client?.name || 'Cliente'}</strong>
                        <span>{appointment?.serviceName || 'Servicio'} · {formatDateTime(appointment?.startAt)}</span>
                      </div>

                      <div className={m('dailyListItem__actions')}>
                        <span className={m(`dailyPill dailyPill--${appointment?.status || 'pending'}`)}>
                          {STATUS_LABELS[appointment?.status] || appointment?.status}
                        </span>
                        {appointment?.paymentStatus === 'unpaid' && (
                          <button
                            className={m('dailyMiniButton')}
                            onClick={() => handleBillingChange(appointment, 'paid')}
                            disabled={Boolean(actionId)}
                          >
                            Cobrar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>

          <section className={m('dailyGrid dailyGrid--bottom')}>
            <article className={m('dailyPanel')}>
              <div className={m('dailyPanel__header')}>
                <div>
                  <span className={m('dailyPanel__tag')}>Próximas</span>
                  <h2 className={m('dailyPanel__title')}>Siguientes citas</h2>
                </div>
              </div>

              {upcomingAppointments.length === 0 ? (
                <div className={m('dailyEmpty')}>No hay próximas citas para hoy.</div>
              ) : (
                <div className={m('dailyList')}>
                  {upcomingAppointments.map((appointment) => (
                    <div className={m('dailyListItem')} key={appointment.id}>
                      <div className={m('dailyListItem__main')}>
                        <strong>{appointment?.client?.name || 'Cliente'}</strong>
                        <span>{appointment?.serviceName || 'Servicio'} · {formatDateTime(appointment?.startAt)}</span>
                      </div>

                      <div className={m('dailyListItem__actions')}>
                        <button
                          className={m('dailyMiniButton')}
                          onClick={() => handleStatusChange(appointment, 'confirmed', 'daily_confirm')}
                          disabled={appointment?.status !== 'pending' || Boolean(actionId)}
                        >
                          Confirmar
                        </button>
                        <button
                          className={m('dailyMiniButton')}
                          onClick={() => handleStatusChange(appointment, 'in_progress', 'daily_start')}
                          disabled={!['pending', 'confirmed'].includes(appointment?.status) || Boolean(actionId)}
                        >
                          Iniciar
                        </button>
                        <button
                          className={m('dailyMiniButton dailyMiniButton--warning')}
                          onClick={() => handleStatusChange(appointment, 'no_assistance', 'daily_no_assistance')}
                          disabled={Boolean(actionId)}
                        >
                          No asistió
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className={m('dailyPanel')}>
              <div className={m('dailyPanel__header')}>
                <div>
                  <span className={m('dailyPanel__tag')}>Historial</span>
                  <h2 className={m('dailyPanel__title')}>Citas pasadas del día</h2>
                </div>
              </div>

              {pastAppointments.length === 0 ? (
                <div className={m('dailyEmpty')}>Todavía no hay citas pasadas hoy.</div>
              ) : (
                <div className={m('dailyList')}>
                  {pastAppointments.map((appointment) => (
                    <div className={m('dailyListItem')} key={appointment.id}>
                      <div className={m('dailyListItem__main')}>
                        <strong>{appointment?.client?.name || 'Cliente'}</strong>
                        <span>{appointment?.serviceName || 'Servicio'} · {formatDateTime(appointment?.startAt)}</span>
                      </div>

                      <div className={m('dailyListItem__actions')}>
                        <span className={m(`dailyPill dailyPill--${appointment?.status || 'pending'}`)}>
                          {STATUS_LABELS[appointment?.status] || appointment?.status}
                        </span>
                        {appointment?.paymentStatus === 'unpaid' && appointment?.status === 'completed' && (
                          <button
                            className={m('dailyMiniButton')}
                            onClick={() => handleBillingChange(appointment, 'paid')}
                            disabled={Boolean(actionId)}
                          >
                            Marcar cobrado
                          </button>
                        )}
                      </div>
                    </div>
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
