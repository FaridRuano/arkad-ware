'use client'

import { useEffect, useMemo, useState } from 'react'
import PageLoader from '@public/components/shared/PageLoader/PageLoader'
import styles from './DashboardPage.module.scss'
import { formatEcMobileDisplay } from '@utils/ecPhone'

const m = (...tokens) =>
  tokens
    .flatMap((token) => String(token || '').split(/\s+/))
    .filter(Boolean)
    .map((name) => styles[name] ?? name)
    .join(' ')

const TZ = 'America/Guayaquil'

const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  in_progress: 'En progreso',
}

function formatMoney(value = 0) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value))
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatPrimaryContact(phone, email) {
  if (phone) return formatEcMobileDisplay(phone)
  if (email) return email
  return 'Sin contacto principal'
}

function SummaryCard({ label, value, hint, accent = false }) {
  return (
    <article className={m(`dashboardCard ${accent ? 'dashboardCard--accent' : ''}`)}>
      <span className={m('dashboardCard__label')}>{label}</span>
      <strong className={m('dashboardCard__value')}>{value}</strong>
      <span className={m('dashboardCard__hint')}>{hint}</span>
    </article>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchDashboard() {
      try {
        if (!data) setLoading(true)
        else setRefreshing(true)
        setError('')

        const res = await fetch('/api/admin/dashboard', {
          method: 'GET',
          cache: 'no-store',
        })

        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload?.error || 'No se pudo cargar el panel')
        if (!cancelled) setData(payload)
      } catch (err) {
        if (!cancelled) setError(err?.message || 'No se pudo cargar el panel')
      } finally {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    fetchDashboard()
    return () => {
      cancelled = true
    }
  }, [])

  const summary = data?.summary || {}
  const monthInsights = data?.monthInsights || {}
  const services = data?.services || []
  const barbers = data?.barbers || []
  const recentClients = data?.recentClients || []
  const upcomingAppointments = data?.upcomingAppointments || []
  const topServices = data?.topServices || []

  const totalUpcomingValue = useMemo(
    () => upcomingAppointments.reduce((acc, item) => acc + (Number(item?.price) || 0), 0),
    [upcomingAppointments]
  )

  if (loading) {
    return (
      <div className={m('dashboardPage page')}>
        <PageLoader
          title="Cargando inicio..."
          text="Estamos preparando el resumen operativo de la aplicación."
        />
      </div>
    )
  }

  return (
    <div className={m('dashboardPage page')}>
      <section className={m('dashboardHero')}>
        <div className={m('dashboardHero__content')}>
          <span className={m('dashboardHero__eyebrow')}>Inicio</span>
          <h1 className={m('dashboardHero__title')}>Resumen general del sistema</h1>
          <p className={m('dashboardHero__text')}>
            Revisa el pulso del negocio: agenda del día, proyección mensual, clientes recientes,
            servicios activos y rendimiento operativo general.
          </p>
        </div>

        <div className={m('dashboardHero__meta')}>
          <span className={m('dashboardHero__pill')}>
            {refreshing ? 'Actualizando…' : 'Operación al día'}
          </span>
          <span className={m('dashboardHero__pill dashboardHero__pill--soft')}>
            Próximas citas: {upcomingAppointments.length}
          </span>
        </div>
      </section>

      {error ? (
        <section className={m('dashboardState dashboardState--error')}>
          <h2>No se pudo cargar el inicio</h2>
          <p>{error}</p>
        </section>
      ) : (
        <>
          <section className={m('dashboardSummary')}>
            <SummaryCard
              label="Citas hoy"
              value={summary.appointmentsToday ?? 0}
              hint="Volumen total agendado para la jornada"
            />
            <SummaryCard
              label="Pendientes por confirmar"
              value={summary.pendingConfirmationsToday ?? 0}
              hint="Atención inmediata para operación diaria"
            />
            <SummaryCard
              label="Proyección mensual"
              value={formatMoney(summary.monthlyEstimatedRevenue)}
              hint="Estimado según citas no canceladas"
              accent
            />
            <SummaryCard
              label="Cash del mes"
              value={formatMoney(summary.monthlyCashRevenue)}
              hint="Ingresos realmente cobrados"
            />
          </section>

          <section className={m('dashboardSplit')}>
            <section className={m('dashboardPanel dashboardPanel--wide')}>
              <header className={m('dashboardPanel__header')}>
                <div>
                  <h2 className={m('dashboardPanel__title')}>Movimiento del mes</h2>
                  <p className={m('dashboardPanel__text')}>
                    Métricas rápidas para entender volumen, ejecución y alertas del periodo actual.
                  </p>
                </div>
              </header>

              <div className={m('dashboardSignals')}>
                <article className={m('dashboardSignal dashboardSignal--warm')}>
                  <span className={m('dashboardSignal__label')}>Total agendadas</span>
                  <strong className={m('dashboardSignal__value')}>{summary.monthlyAppointments ?? 0}</strong>
                </article>
                <article className={m('dashboardSignal dashboardSignal--positive')}>
                  <span className={m('dashboardSignal__label')}>Citas completadas</span>
                  <strong className={m('dashboardSignal__value')}>{monthInsights.completedThisMonth ?? 0}</strong>
                </article>
                <article className={m('dashboardSignal dashboardSignal--accent')}>
                  <span className={m('dashboardSignal__label')}>Completadas sin cobrar</span>
                  <strong className={m('dashboardSignal__value')}>{monthInsights.unpaidCompletedThisMonth ?? 0}</strong>
                </article>
                <article className={m('dashboardSignal dashboardSignal--negative')}>
                  <span className={m('dashboardSignal__label')}>No asistencias y canceladas</span>
                  <strong className={m('dashboardSignal__value')}>
                    {(monthInsights.cancelledThisMonth ?? 0) + (monthInsights.noShowsThisMonth ?? 0)}
                  </strong>
                </article>
              </div>

              <div className={m('dashboardRibbon')}>
                <div className={m('dashboardRibbon__item')}>
                  <span>Canceladas</span>
                  <strong>{monthInsights.cancelledThisMonth ?? 0}</strong>
                </div>
                <div className={m('dashboardRibbon__item')}>
                  <span>No asistencias</span>
                  <strong>{monthInsights.noShowsThisMonth ?? 0}</strong>
                </div>
                <div className={m('dashboardRibbon__item')}>
                  <span>Cash del mes</span>
                  <strong>{formatMoney(summary.monthlyCashRevenue)}</strong>
                </div>
                <div className={m('dashboardRibbon__item')}>
                  <span>Proyección</span>
                  <strong>{formatMoney(summary.monthlyEstimatedRevenue)}</strong>
                </div>
              </div>
            </section>

            <section className={m('dashboardPanel')}>
              <header className={m('dashboardPanel__header')}>
                <div>
                  <h2 className={m('dashboardPanel__title')}>Base activa</h2>
                  <p className={m('dashboardPanel__text')}>
                    Panorama rápido de configuración y crecimiento actual.
                  </p>
                </div>
              </header>

              <div className={m('dashboardMiniStats')}>
                <div className={m('dashboardMiniStat')}>
                  <span>Servicios activos</span>
                  <strong>{summary.activeServices ?? 0}</strong>
                </div>
                <div className={m('dashboardMiniStat')}>
                  <span>Barberos activos</span>
                  <strong>{summary.activeBarbers ?? 0}</strong>
                </div>
                <div className={m('dashboardMiniStat')}>
                  <span>Total clientes</span>
                  <strong>{summary.totalClients ?? 0}</strong>
                </div>
                <div className={m('dashboardMiniStat')}>
                  <span>Valor próximo</span>
                  <strong>{formatMoney(totalUpcomingValue)}</strong>
                </div>
              </div>
            </section>
          </section>

          <section className={m('dashboardGrid')}>
            <section className={m('dashboardPanel')}>
              <header className={m('dashboardPanel__header')}>
                <div>
                  <h2 className={m('dashboardPanel__title')}>Servicios activos</h2>
                  <p className={m('dashboardPanel__text')}>
                    Lo que hoy está disponible para comercializar.
                  </p>
                </div>
              </header>

              <div className={m('dashboardList')}>
                {services.length === 0 ? (
                  <div className={m('dashboardEmpty')}>No hay servicios activos.</div>
                ) : (
                  services.map((service) => (
                    <article className={m('dashboardItem')} key={service.id}>
                      <div className={m('dashboardItem__main')}>
                        <span
                          className={m('dashboardItem__dot')}
                          style={{ backgroundColor: service.color || '#CFB690' }}
                        />
                        <div>
                          <strong>{service.name}</strong>
                          <span>
                            {service.durationMinutes} min · {service.assignedBarbers} barberos
                          </span>
                        </div>
                      </div>
                      <span className={m('dashboardItem__value')}>{formatMoney(service.price)}</span>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className={m('dashboardPanel')}>
              <header className={m('dashboardPanel__header')}>
                <div>
                  <h2 className={m('dashboardPanel__title')}>Barberos</h2>
                  <p className={m('dashboardPanel__text')}>
                    Carga de hoy y resultado del mes por cada uno.
                  </p>
                </div>
              </header>

              <div className={m('dashboardList')}>
                {barbers.length === 0 ? (
                  <div className={m('dashboardEmpty')}>No hay barberos activos.</div>
                ) : (
                  barbers.map((barber) => (
                    <article className={m('dashboardItem')} key={barber.id}>
                      <div className={m('dashboardItem__main')}>
                        <span
                          className={m('dashboardItem__dot')}
                          style={{ backgroundColor: barber.color || '#be902a' }}
                        />
                        <div>
                          <strong>{barber.name}</strong>
                          <span>
                            Hoy {barber.appointmentsToday} · Mes {barber.monthCompleted} completadas
                          </span>
                        </div>
                      </div>
                      <span className={m('dashboardItem__value')}>
                        {formatMoney(barber.monthCashRevenue)}
                      </span>
                    </article>
                  ))
                )}
              </div>
            </section>
          </section>

          <section className={m('dashboardGrid')}>
            <section className={m('dashboardPanel')}>
              <header className={m('dashboardPanel__header')}>
                <div>
                  <h2 className={m('dashboardPanel__title')}>Próximas citas</h2>
                  <p className={m('dashboardPanel__text')}>
                    Vista rápida para anticipar el siguiente bloque operativo.
                  </p>
                </div>
              </header>

              <div className={m('dashboardStack')}>
                {upcomingAppointments.length === 0 ? (
                  <div className={m('dashboardEmpty')}>No hay citas próximas cargadas.</div>
                ) : (
                  upcomingAppointments.map((appointment) => (
                    <article className={m('dashboardCallout')} key={appointment.id}>
                      <div className={m('dashboardCallout__top')}>
                        <strong>{appointment.clientName}</strong>
                        <span className={m('dashboardStatus')}>
                          {STATUS_LABELS[appointment.status] || appointment.status}
                        </span>
                      </div>
                      <div className={m('dashboardCallout__meta')}>
                        <span>{appointment.serviceName}</span>
                        <span>{appointment.barberName}</span>
                        <span>{formatDateTime(appointment.startAt)}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className={m('dashboardPanel')}>
              <header className={m('dashboardPanel__header')}>
                <div>
                  <h2 className={m('dashboardPanel__title')}>Clientes recientes</h2>
                  <p className={m('dashboardPanel__text')}>
                    Nuevos registros incorporados al sistema.
                  </p>
                </div>
              </header>

              <div className={m('dashboardStack')}>
                {recentClients.length === 0 ? (
                  <div className={m('dashboardEmpty')}>Aún no hay clientes recientes.</div>
                ) : (
                  recentClients.map((client) => (
                    <article className={m('dashboardClient')} key={client.id}>
                      <div className={m('dashboardClient__main')}>
                        <strong>{client.name}</strong>
                        <span>{formatPrimaryContact(client.phone, client.email)}</span>
                      </div>
                      <time>{formatDate(client.createdAt)}</time>
                    </article>
                  ))
                )}
              </div>
            </section>
          </section>

          <section className={m('dashboardPanel')}>
            <header className={m('dashboardPanel__header')}>
              <div>
                <h2 className={m('dashboardPanel__title')}>Servicios más movidos del mes</h2>
                <p className={m('dashboardPanel__text')}>
                  Te ayuda a entender qué genera más demanda y más proyección.
                </p>
              </div>
            </header>

            <div className={m('dashboardTopServices')}>
              {topServices.length === 0 ? (
                <div className={m('dashboardEmpty')}>No hay datos suficientes del mes actual.</div>
              ) : (
                topServices.map((service) => (
                  <article className={m('dashboardTopService')} key={service.serviceName}>
                    <div className={m('dashboardTopService__main')}>
                      <strong>{service.serviceName}</strong>
                      <span>{service.count} citas en el mes</span>
                    </div>
                    <span className={m('dashboardTopService__value')}>
                      {formatMoney(service.estimatedRevenue)}
                    </span>
                  </article>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
