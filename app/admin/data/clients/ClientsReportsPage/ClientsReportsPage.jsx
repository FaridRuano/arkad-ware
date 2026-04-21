'use client'

import { useEffect, useMemo, useState } from 'react'
import PageLoader from '@public/components/shared/PageLoader/PageLoader'
import styles from '../../ReportsPage/ReportsPage.module.scss'

const m = (...tokens) =>
  tokens
    .flatMap((token) => String(token || '').split(/\s+/))
    .filter(Boolean)
    .map((name) => styles[name] ?? name)
    .join(' ')

function getTodayISO() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMoney(value = 0) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function SummaryCard({ label, value, hint, accent = false }) {
  return (
    <article className={m(`reportsSummaryCard ${accent ? 'reportsSummaryCard--accent' : ''}`)}>
      <span className={m('reportsSummaryCard__label')}>{label}</span>
      <strong className={m('reportsSummaryCard__value')}>{value}</strong>
      <span className={m('reportsSummaryCard__hint')}>{hint}</span>
    </article>
  )
}

function ReportTable({ columns, rows, renderCell, emptyText = 'Sin datos' }) {
  if (!rows.length) return <div className={m('reportsEmpty')}>{emptyText}</div>

  return (
    <div className={m('reportsTableStack')}>
      <div className={m('reportsTableWrap')}>
        <table className={m('reportsTable')}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`clients-report-${index}`}>
                {columns.map((column) => (
                  <td key={column.key}>{renderCell(row, column)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={m('reportsMobileList')}>
        {rows.map((row, index) => (
          <article className={m('reportsMobileCard')} key={`clients-report-mobile-${index}`}>
            {columns.map((column) => (
              <div className={m('reportsMobileItem')} key={column.key}>
                <span className={m('reportsMobileItem__label')}>{column.label}</span>
                <div className={m('reportsMobileItem__value')}>{renderCell(row, column)}</div>
              </div>
            ))}
          </article>
        ))}
      </div>
    </div>
  )
}

export default function ClientsReportsPage() {
  const [filterType, setFilterType] = useState('month')
  const [date, setDate] = useState(getTodayISO())
  const [startDate, setStartDate] = useState(getTodayISO())
  const [endDate, setEndDate] = useState(getTodayISO())
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchReports() {
      try {
        if (!data) setLoading(true)
        else setRefreshing(true)
        setError('')

        const params = new URLSearchParams({ filterType, view: 'clients' })
        if (filterType === 'custom') {
          params.set('startDate', startDate)
          params.set('endDate', endDate)
        } else {
          params.set('date', date)
        }
        if (q.trim()) params.set('q', q.trim())

        const res = await fetch(`/api/admin/reports?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
        })

        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload?.error || 'No se pudo cargar el reporte de clientes')
        if (!cancelled) setData(payload)
      } catch (err) {
        if (!cancelled) setError(err?.message || 'No se pudo cargar el reporte de clientes')
      } finally {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    fetchReports()
    return () => {
      cancelled = true
    }
  }, [filterType, date, startDate, endDate, q])

  const rows = data?.tables?.clients || []

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, item) => {
        acc.clients += 1
        acc.totalAppointments += item.totalAppointments || 0
        acc.cancelledCount += item.cancelledCount || 0
        acc.noAssistanceCount += item.noAssistanceCount || 0
        acc.cashRevenue += Number(item.cashRevenue) || 0
        return acc
      },
      {
        clients: 0,
        totalAppointments: 0,
        cancelledCount: 0,
        noAssistanceCount: 0,
        cashRevenue: 0,
      }
    )
  }, [rows])

  if (loading) {
    return (
      <div className={m('reportsPage page')}>
        <PageLoader
          title="Cargando reporte de clientes..."
          text="Estamos evaluando valor, recurrencia y comportamiento de los clientes."
        />
      </div>
    )
  }

  return (
    <div className={m('reportsPage page')}>
      <section className={m('reportsHero')}>
        <div className={m('reportsHero__content')}>
          <span className={m('reportsHero__eyebrow')}>Reportes · Clientes</span>
          <h1 className={m('reportsHero__title')}>Valor y comportamiento del cliente</h1>
          <p className={m('reportsHero__text')}>
            Analiza citas, cancelaciones, no asistencias y dinero desembolsado para detectar clientes de alto valor y clientes que requieren más atención.
          </p>
        </div>

        <div className={m('reportsHero__status')}>
          {refreshing ? 'Actualizando...' : 'Lectura enfocada a clientes'}
        </div>
      </section>

      <section className={m('reportsFilters')}>
        <div className={m('reportsFilters__grid')}>
          <label className={m('reportsField')}>
            <span className={m('reportsField__label')}>Tipo de filtro</span>
            <div className={m('reportsSelectWrap')}>
              <select
                className={m('reportsField__input reportsField__input--select')}
                value={filterType}
                onChange={(event) => setFilterType(event.target.value)}
              >
                <option value="day">Día</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
                <option value="custom">Rango personalizado</option>
              </select>
            </div>
          </label>

          {filterType === 'custom' ? (
            <>
              <label className={m('reportsField')}>
                <span className={m('reportsField__label')}>Desde</span>
                <input
                  className={m('reportsField__input')}
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </label>

              <label className={m('reportsField')}>
                <span className={m('reportsField__label')}>Hasta</span>
                <input
                  className={m('reportsField__input')}
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </label>
            </>
          ) : (
            <label className={m('reportsField')}>
              <span className={m('reportsField__label')}>Fecha base</span>
              <input
                className={m('reportsField__input')}
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
          )}

          <label className={m('reportsField')}>
            <span className={m('reportsField__label')}>Buscar cliente</span>
            <input
              className={m('reportsField__input')}
              type="text"
              placeholder="Nombre, email o teléfono"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </label>
        </div>
      </section>

      {error ? (
        <section className={m('reportsState reportsState--error')}>
          <h2>No se pudo cargar el reporte</h2>
          <p>{error}</p>
        </section>
      ) : (
        <>
          <section className={m('reportsSummary')}>
            <SummaryCard
              label="Clientes con movimiento"
              value={summary.clients}
              hint="Clientes detectados en el rango filtrado"
            />
            <SummaryCard
              label="Total de citas"
              value={summary.totalAppointments}
              hint="Incluye completadas, canceladas y no asistencias"
            />
            <SummaryCard
              label="Cancelaciones"
              value={summary.cancelledCount}
              hint="Señal importante para evaluar confiabilidad"
            />
            <SummaryCard
              label="Total desembolsado"
              value={formatMoney(summary.cashRevenue)}
              hint="Dinero realmente cobrado por este grupo"
              accent
            />
          </section>

          <section className={m('reportsPanel')}>
            <header className={m('reportsPanel__header')}>
              <div>
                <h2 className={m('reportsPanel__title')}>Valor por cliente</h2>
                <p className={m('reportsPanel__text')}>
                  Aquí puedes ver recurrencia, cancelaciones, no asistencias y dinero aportado por cada cliente.
                </p>
              </div>
            </header>

            <ReportTable
              columns={[
                { key: 'clientName', label: 'Cliente' },
                { key: 'totalAppointments', label: 'Citas' },
                { key: 'completedCount', label: 'Completadas' },
                { key: 'cancelledCount', label: 'Canceladas' },
                { key: 'noAssistanceCount', label: 'No asistió' },
                { key: 'cashRevenue', label: 'Desembolsado' },
                { key: 'estimatedRevenue', label: 'Estimado' },
                { key: 'lastAppointmentAt', label: 'Última cita' },
              ]}
              rows={rows}
              renderCell={(row, column) => {
                if (column.key === 'cashRevenue' || column.key === 'estimatedRevenue') {
                  return formatMoney(row[column.key])
                }

                if (column.key === 'clientName') {
                  return (
                    <div className={m('reportsClientCell')}>
                      <strong>{row.clientName}</strong>
                      <span>{row.email || row.phone || 'Sin contacto'}</span>
                    </div>
                  )
                }

                if (column.key === 'lastAppointmentAt') {
                  return formatDate(row.lastAppointmentAt)
                }

                return row[column.key]
              }}
              emptyText="No hay clientes con movimiento en este rango."
            />
          </section>
        </>
      )}
    </div>
  )
}
