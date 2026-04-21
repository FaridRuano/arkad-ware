'use client';

import { useEffect, useMemo, useState } from 'react';
import PageLoader from '@public/components/shared/PageLoader/PageLoader';
import styles from './ReportsPage.module.scss';

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

function formatDateRange(filters = {}) {
  const { filterType, startDate, endDate } = filters;
  if (!startDate) return 'Sin rango';
  if (filterType === 'day') return startDate;
  if (startDate === endDate) return startDate;
  return `${startDate} → ${endDate}`;
}

function SummaryCard({ label, value, hint, accent = false }) {
  return (
    <article className={m(`reportsSummaryCard ${accent ? 'reportsSummaryCard--accent' : ''}`)}>
      <span className={m('reportsSummaryCard__label')}>{label}</span>
      <strong className={m('reportsSummaryCard__value')}>{value}</strong>
      <span className={m('reportsSummaryCard__hint')}>{hint}</span>
    </article>
  );
}

function ReportTable({ title, caption, columns, rows, renderCell, emptyText = 'Sin datos' }) {
  return (
    <section className={m('reportsPanel')}>
      <header className={m('reportsPanel__header')}>
        <div>
          <h2 className={m('reportsPanel__title')}>{title}</h2>
          <p className={m('reportsPanel__text')}>{caption}</p>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className={m('reportsEmpty')}>{emptyText}</div>
      ) : (
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
                  <tr key={`${title}-${index}`}>
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
              <article className={m('reportsMobileCard')} key={`${title}-mobile-${index}`}>
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
      )}
    </section>
  );
}

export default function ReportsPage() {
  const [filterType, setFilterType] = useState('day');
  const [date, setDate] = useState(getTodayISO());
  const [startDate, setStartDate] = useState(getTodayISO());
  const [endDate, setEndDate] = useState(getTodayISO());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchReports() {
      try {
        if (!data) setLoading(true);
        else setRefreshing(true);
        setError('');

        const params = new URLSearchParams({ filterType });
        if (filterType === 'custom') {
          params.set('startDate', startDate);
          params.set('endDate', endDate);
        } else {
          params.set('date', date);
        }

        const res = await fetch(`/api/admin/reports?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'No se pudo cargar reportes');
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'No se pudo cargar reportes');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    fetchReports();
    return () => {
      cancelled = true;
    };
  }, [filterType, date, startDate, endDate]);

  const filters = data?.filters || {};
  const summary = data?.summary || {};
  const tables = data?.tables || { services: [], statuses: [], barbers: [], clients: [] };

  const titleRange = useMemo(() => formatDateRange(filters), [filters]);

  if (loading) {
    return (
      <div className={m('reportsPage page')}>
        <PageLoader
          title="Cargando reportes..."
          text="Estamos preparando los datos operativos de servicios, ingresos y ejecución."
        />
      </div>
    );
  }

  return (
    <div className={m('reportsPage page')}>
      <section className={m('reportsHero')}>
        <div className={m('reportsHero__content')}>
          <span className={m('reportsHero__eyebrow')}>Reportes</span>
          <h1 className={m('reportsHero__title')}>Panel operativo</h1>
          <p className={m('reportsHero__text')}>
            Filtra por día, semana, mes o rango personalizado para revisar servicios realizados, cobros y ejecución general.
          </p>
        </div>

        <div className={m('reportsHero__status')}>
          {refreshing ? 'Actualizando...' : 'Listo para análisis'}
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

          <div className={m('reportsContext')}>
            <span className={m('reportsContext__label')}>Rango aplicado</span>
            <strong className={m('reportsContext__value')}>{titleRange}</strong>
          </div>
        </div>
      </section>

      {error ? (
        <section className={m('reportsState reportsState--error')}>
          <h2>No se pudieron cargar los reportes</h2>
          <p>{error}</p>
        </section>
      ) : (
        <>
          <section className={m('reportsSummary')}>
            <SummaryCard
              label="Total de citas"
              value={summary.totalAppointments ?? 0}
              hint="Citas registradas en el rango"
            />
            <SummaryCard
              label="Total cobrado"
              value={formatMoney(summary.cashRevenue)}
              hint="Ingresos reales marcados como pagados"
              accent
            />
            <SummaryCard
              label="Ingreso estimado"
              value={formatMoney(summary.estimatedRevenue)}
              hint="Proyección según citas no canceladas"
            />
            <SummaryCard
              label="Citas completadas"
              value={summary.completedCount ?? 0}
              hint="Servicios finalizados en el rango"
            />
          </section>

          <section className={m('reportsGrid')}>
            <ReportTable
              title="Servicios realizados"
              caption="Qué servicios movieron más operación e ingresos en el rango."
              columns={[
                { key: 'serviceName', label: 'Servicio' },
                { key: 'count', label: 'Cantidad' },
                { key: 'estimatedRevenue', label: 'Estimado' },
                { key: 'cashRevenue', label: 'Cobrado' },
                { key: 'averageTicket', label: 'Ticket promedio' },
              ]}
              rows={tables.services}
              renderCell={(row, column) => {
                if (column.key === 'estimatedRevenue' || column.key === 'cashRevenue' || column.key === 'averageTicket') {
                  return formatMoney(row[column.key]);
                }
                return row[column.key];
              }}
              emptyText="No hay servicios en este rango."
            />

            <ReportTable
              title="Estados operativos"
              caption="Distribución rápida del flujo de citas en el periodo."
              columns={[
                { key: 'status', label: 'Estado' },
                { key: 'count', label: 'Cantidad' },
              ]}
              rows={tables.statuses}
              renderCell={(row, column) =>
                column.key === 'status' ? STATUS_LABELS[row.status] || row.status : row.count
              }
              emptyText="No hay estados para mostrar."
            />
          </section>

          <section className={m('reportsGrid reportsGrid--single')}>
            <ReportTable
              title="Rendimiento por barbero"
              caption="Volumen atendido, completados e ingresos por cada barbero."
              columns={[
                { key: 'barberName', label: 'Barbero' },
                { key: 'count', label: 'Citas' },
                { key: 'completedCount', label: 'Completadas' },
                { key: 'estimatedRevenue', label: 'Estimado' },
                { key: 'cashRevenue', label: 'Cobrado' },
              ]}
              rows={tables.barbers}
              renderCell={(row, column) => {
                if (column.key === 'estimatedRevenue' || column.key === 'cashRevenue') {
                  return formatMoney(row[column.key]);
                }
                return row[column.key];
              }}
              emptyText="No hay actividad por barbero en este rango."
            />
          </section>

          <section className={m('reportsGrid reportsGrid--single')}>
            <ReportTable
              title="Valor por cliente"
              caption="Te ayuda a detectar clientes frecuentes, clientes de alto valor y comportamientos de cancelación o no asistencia."
              columns={[
                { key: 'clientName', label: 'Cliente' },
                { key: 'totalAppointments', label: 'Citas' },
                { key: 'completedCount', label: 'Completadas' },
                { key: 'cancelledCount', label: 'Canceladas' },
                { key: 'noAssistanceCount', label: 'No asistió' },
                { key: 'estimatedRevenue', label: 'Estimado' },
                { key: 'cashRevenue', label: 'Cobrado' },
              ]}
              rows={tables.clients}
              renderCell={(row, column) => {
                if (column.key === 'estimatedRevenue' || column.key === 'cashRevenue') {
                  return formatMoney(row[column.key]);
                }

                if (column.key === 'clientName') {
                  return (
                    <div className={m('reportsClientCell')}>
                      <strong>{row.clientName}</strong>
                      <span>{row.email || row.phone || 'Sin contacto'}</span>
                    </div>
                  );
                }

                return row[column.key];
              }}
              emptyText="No hay movimiento de clientes en este rango."
            />
          </section>
        </>
      )}
    </div>
  );
}
