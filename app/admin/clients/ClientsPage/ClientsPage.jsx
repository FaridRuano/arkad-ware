'use client';

import React, { useEffect, useState } from 'react';
import ClientModal from '@public/components/admin/ClientModal/ClientModal';
import ClientHistoryModal from '@public/components/admin/ClientHistoryModal/ClientHistoryModal';
import ModalConfirm from '@public/components/shared/ModalConfirm/ModalConfirm';
import PageLoader from '@public/components/shared/PageLoader/PageLoader';
import styles from '@public/components/admin/shared/EntityListPage/EntityListPage.module.scss';

const m = (...tokens) =>
  tokens
    .flatMap((token) => String(token || '').split(/\s+/))
    .filter(Boolean)
    .map((name) => styles[name] ?? name)
    .join(' ');

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function getInitials(name = '') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'CL';
}

export default function ClientsPage() {
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState('');
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [confirmModal, setConfirmModal] = useState(false);
  const [confirmModalText, setConfirmModalText] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [saving, setSaving] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyClient, setHistoryClient] = useState(null);
  const [historyAppointments, setHistoryAppointments] = useState([]);

  const handleConfirmModal = () => {
    setConfirmModal((prev) => !prev);
  };

  async function fetchClients() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();

      if (q?.trim()) params.set('q', q.trim());
      params.set('page', String(page || 1));

      const res = await fetch(`/api/admin/clients?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Error cargando clientes');
      }

      setClients(data?.clients || []);
      setTotal(data?.total ?? 0);
      setTotalPages(data?.totalPages ?? 1);

      const safeTotalPages = data?.totalPages ?? 1;
      if (page > safeTotalPages) setPage(safeTotalPages);
    } catch (err) {
      setClients([]);
      setTotal(0);
      setTotalPages(1);
      setError(err?.message || 'Error cargando clientes');
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }

  const openNewClient = () => {
    setEditingClient(null);
    setClientModalOpen(true);
  };

  const openEditClient = (client) => {
    setEditingClient(client);
    setClientModalOpen(true);
  };

  const closeClientModal = () => {
    setClientModalOpen(false);
    setEditingClient(null);
  };

  const closeHistoryModal = () => {
    setHistoryOpen(false);
    setHistoryLoading(false);
    setHistoryError('');
    setHistoryClient(null);
    setHistoryAppointments([]);
  };

  const openHistory = async (client) => {
    const id = client?.id ?? client?._id;
    if (!id) return;

    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError('');
    setHistoryClient({
      ...client,
      name: client?.name || `${client?.firstName || ''} ${client?.lastName || ''}`.trim(),
    });
    setHistoryAppointments([]);

    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo cargar el historial del cliente');
      }

      setHistoryClient(data?.client || null);
      setHistoryAppointments(data?.history?.appointments || []);
    } catch (err) {
      setHistoryError(err?.message || 'No se pudo cargar el historial del cliente');
    } finally {
      setHistoryLoading(false);
    }
  };

  async function responseConfirmModal() {
    if (!selectedClient?.id && !selectedClient?._id) return;

    const id = selectedClient.id ?? selectedClient._id;

    try {
      setLoading(true);

      const res = await fetch(`/api/admin/clients/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || 'Error eliminando cliente');
      }

      await fetchClients();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
      setConfirmModal(false);
      setSelectedClient(null);
    }
  }

  async function handleSaveClient(payload) {
    setSaving(true);
    try {
      const isEdit = Boolean(editingClient?.id || editingClient?._id);
      const id = editingClient?.id || editingClient?._id;

      const res = await fetch(isEdit ? `/api/admin/clients/${id}` : `/api/admin/clients/create`, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar el cliente');

      closeClientModal();
      await fetchClients();
    } catch (err) {
      alert(err?.message || 'Error guardando cliente');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    fetchClients();
  }, [page, limit, q]);

  const totalSafe = total ?? 0;
  const fromN = totalSafe === 0 ? 0 : (page - 1) * limit + 1;
  const toN = Math.min(page * limit, totalSafe);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const canPrev = !loading && safePage > 1;
  const canNext = !loading && safePage < totalPages;

  if (loading && !hasLoadedOnce) {
    return (
      <>
        <ModalConfirm
          mainText={confirmModalText}
          active={confirmModal}
          setActive={handleConfirmModal}
          response={responseConfirmModal}
          type="confirm"
        />

        <ClientModal
          open={clientModalOpen}
          mode={editingClient ? 'edit' : 'create'}
          initialData={editingClient}
          saving={saving}
          onClose={closeClientModal}
          onSave={handleSaveClient}
        />

        <ClientHistoryModal
          open={historyOpen}
          loading={historyLoading}
          error={historyError}
          client={historyClient}
          appointments={historyAppointments}
          onClose={closeHistoryModal}
        />

        <div className={m('clients__page page')}>
          <PageLoader
            title="Cargando clientes..."
            text="Estamos preparando la base, el historial y las acciones del módulo."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <ModalConfirm
        mainText={confirmModalText}
        active={confirmModal}
        setActive={handleConfirmModal}
        response={responseConfirmModal}
        type="confirm"
      />

      <ClientModal
        open={clientModalOpen}
        mode={editingClient ? 'edit' : 'create'}
        initialData={editingClient}
        saving={saving}
        onClose={closeClientModal}
        onSave={handleSaveClient}
      />

      <ClientHistoryModal
        open={historyOpen}
        loading={historyLoading}
        error={historyError}
        client={historyClient}
        appointments={historyAppointments}
        onClose={closeHistoryModal}
      />

      <div className={m('clients__page page')}>
        <section className={m('clients__filters')}>
          <header className={m('clients__filtersHeader')}>
            <div className={m('clients__hero')}>
              <div className={m('clients__filtersHeading')}>
                <span className={m('clients__eyebrow')}>Panel de clientes</span>
                <h1 className={m('clients__title')}>Clientes</h1>
                <p className={m('clients__lead')}>
                  Administra la base completa y entra al historial detallado de cada cliente.
                </p>
              </div>

              <div className={m('clients__heroSummary')}>
                <div className={m('clients__heroSummaryLabel')}>Total en el sistema</div>
                <div className={m('clients__heroSummaryValue')}>{totalSafe}</div>
              </div>
            </div>

            <div className={m('clients__filtersActions')}>
              <div className={m('field clients__field clients__fieldSearch clients__fieldSearchHeader')}>
                <label className={m('field__label')}>Buscar</label>
                <input
                  className={m('field__input')}
                  placeholder="Nombre, teléfono, documento o email"
                  value={q}
                  onChange={(event) => {
                    setQ(event.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div className={m('clients__actionsGroup')}>
                <button className={m('__button primary clients__btnNew')} onClick={openNewClient}>
                  + Nuevo cliente
                </button>

                <button
                  className={m('__button clients__btnRefresh')}
                  onClick={() => {
                    setQ('');
                    setPage(1);
                    fetchClients();
                  }}
                  disabled={loading}
                >
                  {loading ? 'Cargando…' : 'Actualizar'}
                </button>
              </div>
            </div>
          </header>
        </section>

        <section className={m('clients__tableSection')}>
          <header className={m('clients__tableHeader')}>
            <div>
              <h2 className={m('clients__subtitle')}>Resultados</h2>
              <p className={m('clients__helper')}>
                Toca una fila o una tarjeta para ver el historial completo del cliente.
              </p>
            </div>

            <div className={m('clients__tableMeta')}>
              <span className={m('clients__count')}>
                {totalSafe ? `Mostrando ${fromN}–${toN} de ${totalSafe}` : 'Sin resultados'}
              </span>
            </div>
          </header>

          <div className={m('clients__tableWrap')}>
            <table className={m('clients__table')}>
              <thead className={m('clients__thead')}>
                <tr className={m('clients__tr clients__trHead')}>
                  <th className={m('clients__th')}>Cliente</th>
                  <th className={m('clients__th')}>Teléfono</th>
                  <th className={m('clients__th')}>Documento</th>
                  <th className={m('clients__th')}>Email</th>
                  <th className={m('clients__th')}>Dirección</th>
                  <th className={m('clients__th')}>Registro</th>
                  <th className={m('clients__th clients__thActions')}>Acciones</th>
                </tr>
              </thead>

              <tbody className={m('clients__tbody')}>
                {loading && (
                  <tr className={m('clients__tr')}>
                    <td className={m('clients__td clients__tdState')} colSpan={7}>
                      <div className={m('clients__state clients__stateLoading')}>
                        <span className={m('clients__stateSpinner')} aria-hidden="true" />
                        <span className={m('clients__stateTitle')}>Cargando clientes…</span>
                        <span className={m('clients__stateText')}>Por favor espera un momento</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr className={m('clients__tr')}>
                    <td className={m('clients__td clients__tdState')} colSpan={7}>
                      <div className={m('clients__state clients__stateError')}>
                        <span className={m('clients__stateTitle')}>Ocurrió un error</span>
                        <span className={m('clients__stateText')}>{error}</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && !error && clients.length === 0 && (
                  <tr className={m('clients__tr clients__trEmpty')}>
                    <td className={m('clients__td clients__tdState')} colSpan={7}>
                      <div className={m('clients__state clients__stateEmpty')}>
                        <span className={m('clients__stateTitle')}>No se encontraron resultados</span>
                        <span className={m('clients__stateText')}>
                          Intenta buscar por nombre, documento o teléfono.
                        </span>

                        <button
                          className={m('__button secondary clients__stateAction')}
                          onClick={() => {
                            setQ('');
                            setPage(1);
                          }}
                        >
                          Limpiar filtros
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  clients.length > 0 &&
                  clients.map((client) => {
                    const id = client?.id ?? client?._id;
                    const firstName = client?.firstName ?? '';
                    const lastName = client?.lastName ?? '';
                    const name = client?.name ?? (`${firstName} ${lastName}`.trim() || '—');

                    return (
                      <tr
                        className={m('clients__tr clients__trInteractive')}
                        key={id}
                        onClick={() => openHistory(client)}
                        onDoubleClick={() => openHistory(client)}
                      >
                        <td className={m('clients__td')}>
                          <div className={m('clients__identity')}>
                            <div className={m('clients__identityText')}>
                              <strong className={m('clients__name')}>{name}</strong>
                            </div>
                          </div>
                        </td>
                        <td className={m('clients__td')}>
                          <span className={m('clients__dataPill')}>{client?.phone ?? '—'}</span>
                        </td>
                        <td className={m('clients__td')}>
                          <span className={m('clients__dataPill clients__dataPillStrong')}>{client?.cedula ?? '—'}</span>
                        </td>
                        <td className={m('clients__td')}>
                          <div className={m('clients__dataStack')}>
                            <strong>{client?.email ?? '—'}</strong>
                            <span>{client?.email ? 'Contacto principal' : 'Sin email registrado'}</span>
                          </div>
                        </td>
                        <td className={m('clients__td')}>
                          <div className={m('clients__dataStack')}>
                            <strong>{client?.address ?? '—'}</strong>
                            <span>Dirección registrada</span>
                          </div>
                        </td>
                        <td className={m('clients__td')}>
                          <div className={m('clients__dateBadge')}>{formatDate(client?.createdAt)}</div>
                        </td>

                        <td className={m('clients__td clients__tdActions')}>
                          <div className={m('clients__actions')}>
                            <button
                              className={m('actionBtn actionBtn--view')}
                              title="Ver historial"
                              onClick={(event) => {
                                event.stopPropagation();
                                openHistory(client);
                              }}
                              disabled={loading || saving}
                            >
                              ⌕
                            </button>

                            <button
                              className={m('actionBtn actionBtn--edit')}
                              title="Editar cliente"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditClient(client);
                              }}
                              disabled={loading || saving}
                            >
                              ✎
                            </button>

                            <button
                              className={m('actionBtn actionBtn--delete')}
                              title="Eliminar cliente"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedClient(client);
                                setConfirmModalText(
                                  `¿Confirma que desea eliminar al cliente "${name}"? Esta acción no se puede deshacer.`
                                );
                                handleConfirmModal();
                              }}
                              disabled={loading || saving}
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {!loading && !error && clients.length > 0 && (
            <div className={m('clients__mobileList')}>
              {clients.map((client) => {
                const id = client?.id ?? client?._id;
                const name =
                  client?.name ||
                  `${client?.firstName || ''} ${client?.lastName || ''}`.trim() ||
                  '—';

                return (
                  <article
                    className={m('clients__mobileCard')}
                    key={`mobile-${id}`}
                    onClick={() => openHistory(client)}
                  >
                    <div className={m('clients__mobileTop')}>
                      <div className={m('clients__mobileIdentity')}>
                        <span className={m('clients__avatar clients__avatarMobile')}>{getInitials(name)}</span>
                        <div>
                        <h3 className={m('clients__mobileName')}>{name}</h3>
                        <p className={m('clients__mobileHint')}>Toca para abrir historial</p>
                        </div>
                      </div>

                      <span className={m('clients__mobileDate')}>{formatDate(client?.createdAt)}</span>
                    </div>

                    <div className={m('clients__mobileGrid')}>
                      <div className={m('clients__mobileField')}>
                        <span className={m('clients__mobileLabel')}>Documento</span>
                        <span className={m('clients__mobileValue')}>{client?.cedula || '—'}</span>
                      </div>

                      <div className={m('clients__mobileField')}>
                        <span className={m('clients__mobileLabel')}>Teléfono</span>
                        <span className={m('clients__mobileValue')}>{client?.phone || '—'}</span>
                      </div>

                      <div className={m('clients__mobileField')}>
                        <span className={m('clients__mobileLabel')}>Email</span>
                        <span className={m('clients__mobileValue')}>{client?.email || '—'}</span>
                      </div>

                      <div className={m('clients__mobileField')}>
                        <span className={m('clients__mobileLabel')}>Dirección</span>
                        <span className={m('clients__mobileValue')}>{client?.address || '—'}</span>
                      </div>
                    </div>

                    <div className={m('clients__mobileActions')}>
                      <button
                        className={m('__button secondary')}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditClient(client);
                        }}
                      >
                        Editar
                      </button>

                      <button
                        className={m('__button')}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openHistory(client);
                        }}
                      >
                        Historial
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className={m('clients__pagination')}>
          <div className={m('clients__paginationLeft')}>
            <span className={m('clients__pageInfo')}>
              Página <b>{safePage}</b> de <b>{Math.max(1, totalPages)}</b>
            </span>
          </div>

          <div className={m('clients__paginationRight')}>
            <button
              className={m(`clients__navBtn ${canPrev ? '' : 'is-disabled'}`)}
              onClick={() => canPrev && setPage((current) => Math.max(1, current - 1))}
              disabled={!canPrev}
              aria-label="Página anterior"
              title="Anterior"
            >
              ‹
            </button>

            <div className={m('clients__pageDots')} aria-label="Indicador de páginas">
              {Array.from({ length: Math.max(1, totalPages) }, (_, index) => index + 1).map((entryPage) => (
                <span
                  key={entryPage}
                  className={m(
                    `pageMark ${entryPage === 1 || entryPage === totalPages ? 'pageMark--square' : 'pageMark--dot'} ${entryPage === safePage ? 'is-active' : ''}`
                  )}
                />
              ))}
            </div>

            <button
              className={m(`clients__navBtn ${canNext ? '' : 'is-disabled'}`)}
              onClick={() =>
                canNext && setPage((current) => Math.min(Math.max(1, totalPages), current + 1))
              }
              disabled={!canNext}
              aria-label="Página siguiente"
              title="Siguiente"
            >
              ›
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
