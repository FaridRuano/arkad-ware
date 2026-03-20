'use client';

import ScheduleBarberSelector from '@public/components/admin/schedule/ScheduleBarberSelector';
import ScheduleCalendar from '@public/components/admin/schedule/ScheduleCalendar';
import ScheduleDateNavigator from '@public/components/admin/schedule/ScheduleDateNavigator';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import AppCreateModal from '@public/components/admin/schedule/AppCreateModal';
import AppReviewModal from '@public/components/admin/schedule/AppReviewModal';

function getTodayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isValidISODate(value = '') {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getSafeTimeHMFromISO(iso = '') {
    const d = iso ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

export default function SchedulePage() {
    // =========================
    // URLS
    // =========================
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const initialDateFromURL = searchParams.get('date') || '';
    const initialBarberIdFromURL = searchParams.get('barberId') || '';

    // =========================
    // Filters / view state
    // =========================
    const [dateISO, setDateISO] = useState(
        isValidISODate(initialDateFromURL) ? initialDateFromURL : getTodayISO()
    );
    const [selectedBarberId, setSelectedBarberId] = useState(initialBarberIdFromURL);

    // =========================
    // Data state
    // =========================
    const [appointments, setAppointments] = useState([]);
    const [meta, setMeta] = useState(null);
    const [barbers, setBarbers] = useState([]);
    const [services, setServices] = useState([]);
    const [schedule, setSchedule] = useState(null);

    // =========================
    // Review modal extra state
    // =========================
    const [reviewBarbers, setReviewBarbers] = useState([]);
    const [assigningBarber, setAssigningBarber] = useState(false);

    // =========================
    // Loading state
    // =========================
    const [loadingSchedule, setLoadingSchedule] = useState(true);
    const [loadingBarbers, setLoadingBarbers] = useState(true);
    const [loadingServices, setLoadingServices] = useState(true);
    const [loadingReviewBarbers, setLoadingReviewBarbers] = useState(false);

    // =========================
    // Error state
    // =========================
    const [scheduleError, setScheduleError] = useState('');
    const [barbersError, setBarbersError] = useState('');
    const [servicesError, setServicesError] = useState('');
    const [reviewBarbersError, setReviewBarbersError] = useState('');

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
            setSchedule(data?.schedule || null);
        } catch (error) {
            setAppointments([]);
            setMeta(null);
            setSchedule(null);
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
    // Fetch: review barbers
    // =========================
    const fetchReviewBarbers = useCallback(async (appointment) => {
        if (!appointment?.startAt || !appointment?.serviceId) {
            setReviewBarbers([]);
            setReviewBarbersError('');
            return;
        }

        try {
            setLoadingReviewBarbers(true);
            setReviewBarbersError('');

            const payload = {
                startAt: appointment.startAt,
                serviceId: appointment.serviceId,
                barberId: appointment?.barberId || appointment?.barber?.id || '',
            };

            const res = await fetch('/api/admin/schedule/form', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(
                    data?.error ||
                    data?.errors?.[0] ||
                    'Error cargando barberos disponibles'
                );
            }

            setReviewBarbers(Array.isArray(data?.barbers) ? data.barbers : []);
        } catch (error) {
            setReviewBarbers([]);
            setReviewBarbersError(
                error?.message || 'Error cargando barberos disponibles'
            );
        } finally {
            setLoadingReviewBarbers(false);
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
    // Sync: URL -> state
    // =========================
    useEffect(() => {
        const urlDate = searchParams.get('date') || '';
        const urlBarberId = searchParams.get('barberId') || '';

        const safeDate = isValidISODate(urlDate) ? urlDate : getTodayISO();

        if (safeDate !== dateISO) {
            setDateISO(safeDate);
        }

        if (urlBarberId !== selectedBarberId) {
            setSelectedBarberId(urlBarberId);
        }
    }, [searchParams]);

    // =========================
    // Sync: state -> URL
    // =========================
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());

        if (dateISO && isValidISODate(dateISO)) {
            params.set('date', dateISO);
        } else {
            params.delete('date');
        }

        if (selectedBarberId) {
            params.set('barberId', selectedBarberId);
        } else {
            params.delete('barberId');
        }

        const nextQuery = params.toString();
        const nextURL = nextQuery ? `${pathname}?${nextQuery}` : pathname;
        const currentURL = searchParams.toString()
            ? `${pathname}?${searchParams.toString()}`
            : pathname;

        if (nextURL !== currentURL) {
            router.replace(nextURL, { scroll: false });
        }
    }, [dateISO, selectedBarberId, pathname, router, searchParams]);

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

    useEffect(() => {
        if (!detailModalOpen || !activeAppointment) {
            setReviewBarbers([]);
            setReviewBarbersError('');
            return;
        }

        fetchReviewBarbers(activeAppointment);
    }, [detailModalOpen, activeAppointment, fetchReviewBarbers]);

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
        setReviewBarbers([]);
        setReviewBarbersError('');
        setDetailModalOpen(true);
    }, []);

    const closeDetailModal = useCallback(() => {
        setDetailModalOpen(false);
        setActiveAppointment(null);
        setReviewBarbers([]);
        setReviewBarbersError('');
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

            setActiveAppointment((prev) => {
                if (!prev) return prev;
                if ((prev?.id || prev?._id) !== id) return prev;

                return {
                    ...prev,
                    ...data?.appointment,
                };
            });
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

            setActiveAppointment((prev) => {
                if (!prev) return prev;
                if ((prev?.id || prev?._id) !== id) return prev;

                return {
                    ...prev,
                    ...data?.appointment,
                };
            });
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

    const handleAssignBarber = useCallback(async (appointmentId, payload = {}) => {
        try {
            setAssigningBarber(true);

            const barberId = String(payload?.barberId || '').trim();

            if (!appointmentId || !barberId) {
                throw new Error('Falta appointmentId o barberId');
            }

            const res = await fetch(`/api/admin/schedule/appointments/assign-barber/${appointmentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barberId }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.error || 'Error asignando barbero');
            }

            const updatedAppointment = data?.appointment || null;

            if (updatedAppointment) {
                setActiveAppointment(updatedAppointment);
            }

            await Promise.all([
                refreshSchedule(),
                fetchReviewBarbers(updatedAppointment || activeAppointment),
            ]);
        } catch (error) {
            console.error('handleAssignBarber:', error);
        } finally {
            setAssigningBarber(false);
        }
    }, [refreshSchedule, fetchReviewBarbers, activeAppointment]);

    return (
        <div className="page schedule-page">
            <AppCreateModal
                open={createModalOpen}
                saving={savingAppointment}
                dateISO={slotDraft.dateISO}
                timeHM={slotDraft.timeHM}
                services={services}
                barbers={barbers}
                selectedBarberId={slotDraft.barberId}
                onClose={closeCreateModal}
                onCreate={handleCreateAppointment}
            />

            <AppReviewModal
                open={detailModalOpen}
                appointment={activeAppointment}
                onClose={closeDetailModal}
                onUpdateStatus={handleUpdateStatus}
                onTogglePaid={handleTogglePaid}
                onCancel={handleCancelAppointment}
                availableBarbers={reviewBarbers}
                assigningBarber={assigningBarber || loadingReviewBarbers}
                onAssignBarber={handleAssignBarber}
            />

            <ScheduleBarberSelector
                barbers={barbers}
                selectedBarberId={selectedBarberId}
                onChange={setSelectedBarberId}
            />

            <ScheduleDateNavigator
                dateISO={dateISO}
                onChangeDate={setDateISO}
            />

            {(scheduleError || barbersError || servicesError || reviewBarbersError) ? (
                <div className="schedule-page__errors" style={{ marginBottom: 12 }}>
                    {scheduleError ? <div style={{ color: 'var(--negative)' }}>{scheduleError}</div> : null}
                    {barbersError ? <div style={{ color: 'var(--negative)' }}>{barbersError}</div> : null}
                    {servicesError ? <div style={{ color: 'var(--negative)' }}>{servicesError}</div> : null}
                    {detailModalOpen && reviewBarbersError ? (
                        <div style={{ color: 'var(--negative)' }}>{reviewBarbersError}</div>
                    ) : null}
                </div>
            ) : null}

            <ScheduleCalendar
                dateISO={dateISO}
                appointments={appointments}
                schedule={schedule}
                selectedBarberId={selectedBarberId}
                onCreateAtSlot={openCreateModal}
                onOpenAppointment={openDetailModal}
                loading={loadingSchedule}
            />
        </div>
    );
}