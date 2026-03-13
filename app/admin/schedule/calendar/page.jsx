'use client';

import ScheduleBarberSelector from '@public/components/admin/schedule/ScheduleBarberSelector';
import { useCallback, useEffect, useMemo, useState } from 'react';

function getTodayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export default function SchedulePage() {
    // =========================
    // Filters / view state
    // =========================
    const [dateISO, setDateISO] = useState(getTodayISO());
    const [selectedBarberId, setSelectedBarberId] = useState('');

    // =========================
    // Data state
    // =========================
    const [appointments, setAppointments] = useState([]);
    const [meta, setMeta] = useState(null);
    const [barbers, setBarbers] = useState([]);
    const [services, setServices] = useState([]);

    // =========================
    // Loading state
    // =========================
    const [loadingSchedule, setLoadingSchedule] = useState(true);
    const [loadingBarbers, setLoadingBarbers] = useState(true);
    const [loadingServices, setLoadingServices] = useState(true);

    // =========================
    // Error state
    // =========================
    const [scheduleError, setScheduleError] = useState('');
    const [barbersError, setBarbersError] = useState('');
    const [servicesError, setServicesError] = useState('');

    // =========================
    // Action state
    // =========================
    const [savingAppointment, setSavingAppointment] = useState(false);
    const [updatingAppointment, setUpdatingAppointment] = useState(false);

    // =========================
    // Modal state
    // =========================
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [activeAppointment, setActiveAppointment] = useState(null);

    // =========================
    // Create modal context
    // =========================
    const [slotDraft, setSlotDraft] = useState({
        dateISO: '',
        timeHM: '',
        barberId: '',
    });

    // =========================
    // Derived
    // =========================
    const activeBarber = useMemo(() => {
        if (!selectedBarberId) return null;
        return barbers.find((b) => b.id === selectedBarberId) || null;
    }, [barbers, selectedBarberId]);

    const isInitialLoading = loadingSchedule || loadingBarbers || loadingServices;

    // =========================
    // Fetch: schedule
    // =========================
    const fetchSchedule = useCallback(async () => {
        try {
            setLoadingSchedule(true);
            setScheduleError('');

            const params = new URLSearchParams();
            params.set('date', dateISO);

            if (selectedBarberId) {
                params.set('barberId', selectedBarberId);
            }

            const res = await fetch(`/api/admin/schedule?${params.toString()}`, {
                method: 'GET',
                cache: 'no-store',
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.error || 'Error cargando agenda');
            }

            setAppointments(Array.isArray(data?.appointments) ? data.appointments : []);
            setMeta(data?.meta || null);
        } catch (error) {
            setAppointments([]);
            setMeta(null);
            setScheduleError(error?.message || 'Error cargando agenda');
        } finally {
            setLoadingSchedule(false);
        }
    }, [dateISO, selectedBarberId]);

    // =========================
    // Fetch: barbers
    // =========================
    const fetchBarbers = useCallback(async () => {
        try {
            setLoadingBarbers(true);
            setBarbersError('');

            const res = await fetch('/api/admin/schedule/barbers', {
                method: 'GET',
                cache: 'no-store',
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.error || 'Error cargando barberos');
            }

            setBarbers(Array.isArray(data?.barbers) ? data.barbers : []);
        } catch (error) {
            setBarbers([]);
            setBarbersError(error?.message || 'Error cargando barberos');
        } finally {
            setLoadingBarbers(false);
        }
    }, []);

    // =========================
    // Fetch: services
    // =========================
    const fetchServices = useCallback(async () => {
        try {
            setLoadingServices(true);
            setServicesError('');

            const res = await fetch('/api/admin/schedule/services', {
                method: 'GET',
                cache: 'no-store',
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.error || 'Error cargando servicios');
            }

            setServices(Array.isArray(data?.services) ? data.services : []);
        } catch (error) {
            setServices([]);
            setServicesError(error?.message || 'Error cargando servicios');
        } finally {
            setLoadingServices(false);
        }
    }, []);

    // =========================
    // Global refresh
    // =========================
    const refreshSchedule = useCallback(async () => {
        await fetchSchedule();
    }, [fetchSchedule]);

    const refreshCatalogs = useCallback(async () => {
        await Promise.all([fetchBarbers(), fetchServices()]);
    }, [fetchBarbers, fetchServices]);

    const refreshAll = useCallback(async () => {
        await Promise.all([fetchSchedule(), fetchBarbers(), fetchServices()]);
    }, [fetchSchedule, fetchBarbers, fetchServices]);

    // =========================
    // Initial load / reactions
    // =========================
    useEffect(() => {
        fetchBarbers();
        fetchServices();
    }, [fetchBarbers, fetchServices]);

    useEffect(() => {
        fetchSchedule();
    }, [fetchSchedule]);

    // =========================
    // Modal handlers
    // =========================
    const openCreateModal = useCallback(({ dateISO = '', timeHM = '', barberId = '' } = {}) => {
        setSlotDraft({
            dateISO: dateISO || '',
            timeHM: timeHM || '',
            barberId: barberId || selectedBarberId || '',
        });
        setCreateModalOpen(true);
    }, [selectedBarberId]);

    const closeCreateModal = useCallback(() => {
        setCreateModalOpen(false);
        setSlotDraft({
            dateISO: '',
            timeHM: '',
            barberId: '',
        });
    }, []);

    const openDetailModal = useCallback((appointment) => {
        setActiveAppointment(appointment || null);
        setDetailModalOpen(true);
    }, []);

    const closeDetailModal = useCallback(() => {
        setDetailModalOpen(false);
        setActiveAppointment(null);
    }, []);

    // =========================
    // Appointment actions
    // =========================
    const handleCreateAppointment = useCallback(async (payload) => {
        try {
            setSavingAppointment(true);

            const res = await fetch('/api/admin/schedule/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.error || 'Error creando cita');
            }

            closeCreateModal();
            await refreshSchedule();
        } catch (error) {
            console.error('handleCreateAppointment:', error);
        } finally {
            setSavingAppointment(false);
        }
    }, [closeCreateModal, refreshSchedule]);

    const handleUpdateStatus = useCallback(async (id, to, extra = {}) => {
        try {
            setUpdatingAppointment(true);

            const res = await fetch(`/api/admin/schedule/appointments/status/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to,
                    ...extra,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.error || 'Error actualizando estado');
            }

            await refreshSchedule();
        } catch (error) {
            console.error('handleUpdateStatus:', error);
        } finally {
            setUpdatingAppointment(false);
        }
    }, [refreshSchedule]);

    const handleTogglePaid = useCallback(async (id, paymentStatus) => {
        try {
            setUpdatingAppointment(true);

            const res = await fetch(`/api/admin/schedule/appointments/billing/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentStatus }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.error || 'Error actualizando pago');
            }

            await refreshSchedule();
        } catch (error) {
            console.error('handleTogglePaid:', error);
        } finally {
            setUpdatingAppointment(false);
        }
    }, [refreshSchedule]);

    const handleCancelAppointment = useCallback(async (id, payload = {}) => {
        try {
            setUpdatingAppointment(true);

            const res = await fetch(`/api/admin/schedule/appointments/status/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: 'cancelled',
                    cancelReason: payload?.cancelReason || '',
                    reason: payload?.reason || '',
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.error || 'Error cancelando cita');
            }

            closeDetailModal();
            await refreshSchedule();
        } catch (error) {
            console.error('handleCancelAppointment:', error);
        } finally {
            setUpdatingAppointment(false);
        }
    }, [closeDetailModal, refreshSchedule]);

    return (
        <div className="page schedule-page">
            <div className="page-content">
                {/* Estado general temporal */}
                <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                        <strong>Fecha:</strong> {dateISO}
                    </div>

                    <div>
                        <strong>Barbero seleccionado:</strong>{' '}
                        {activeBarber?.name || 'Todos'}
                    </div>

                    <div>
                        <strong>Loading inicial:</strong> {isInitialLoading ? 'Sí' : 'No'}
                    </div>

                    <div>
                        <strong>Cargando agenda:</strong> {loadingSchedule ? 'Sí' : 'No'}
                    </div>

                    <div>
                        <strong>Cargando barberos:</strong> {loadingBarbers ? 'Sí' : 'No'}
                    </div>

                    <div>
                        <strong>Cargando servicios:</strong> {loadingServices ? 'Sí' : 'No'}
                    </div>

                    <div>
                        <strong>Citas:</strong> {appointments.length}
                    </div>

                    <div>
                        <strong>Barberos:</strong> {barbers.length}
                    </div>

                    <div>
                        <strong>Servicios:</strong> {services.length}
                    </div>

                    {!!scheduleError && (
                        <div style={{ color: 'var(--negative)' }}>
                            <strong>Error agenda:</strong> {scheduleError}
                        </div>
                    )}

                    {!!barbersError && (
                        <div style={{ color: 'var(--negative)' }}>
                            <strong>Error barberos:</strong> {barbersError}
                        </div>
                    )}

                    {!!servicesError && (
                        <div style={{ color: 'var(--negative)' }}>
                            <strong>Error servicios:</strong> {servicesError}
                        </div>
                    )}
                </div>

                {/* Placeholder temporal */}
                <div style={{ marginTop: 24, padding: 24, border: '1px solid var(--border)', borderRadius: 16 }}>
                    Página vacía por ahora. Lista para montar toolbar, stats, grid y modales.
                </div>
            </div>

            <div className="page-header">
                <div>
                    <h1>Agenda</h1>
                    <p>Administra la agenda general o revisa la disponibilidad por barbero.</p>
                </div>
            </div>

            <ScheduleBarberSelector
                barbers={barbers}
                selectedBarberId={selectedBarberId}
                onChange={setSelectedBarberId}
            />

            <div className="page-content">
                Página vacía por ahora...
            </div>
        </div>


    );
}