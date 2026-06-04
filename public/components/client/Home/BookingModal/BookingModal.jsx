'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './booking-modal.module.scss';
import BarberSelector from './BarberSelector/BarberSelector';
import DaySelector from './DaySelector/DaySelector';
import TimeSelector from './TimeSelector/TimeSelector';
import BookingSummaryCard from './BookingSummaryCard/BookingSummaryCard';

export default function BookingModal({ isOpen, onClose, service, onBookingSuccess }) {
    const [currentStep, setCurrentStep] = useState(1);

    const [selectedBarber, setSelectedBarber] = useState(null);
    const [selectedPackageBarbers, setSelectedPackageBarbers] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);

    const [availableDates, setAvailableDates] = useState([]);
    const [availableSlots, setAvailableSlots] = useState([]);

    const [scheduleMeta, setScheduleMeta] = useState({
        timezone: 'America/Guayaquil',
        minNoticeMinutes: 0,
        maxDaysAhead: 30,
        durationMinutes: 0,
    });

    const [isLoadingDates, setIsLoadingDates] = useState(false);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

    const [datesError, setDatesError] = useState('');
    const [slotsError, setSlotsError] = useState('');
    const [bookingError, setBookingError] = useState('');
    const [bookingSuccess, setBookingSuccess] = useState('');

    const punctualityNotice = 'El servicio contempla un tiempo de espera maximo de 5 minutos, por favor llega puntual para respetar tu horario.';

    const availableBarbers = useMemo(() => {
        if (!service?.barbers || !Array.isArray(service.barbers)) return [];
        return service.barbers;
    }, [service]);
    const isPackage = service?.serviceType === 'package';
    const packageItems = useMemo(
        () => (Array.isArray(service?.packageItems) ? service.packageItems : []),
        [service]
    );
    const packageBarberIds = useMemo(
        () =>
            selectedPackageBarbers
                .map((barber) => barber?.id || barber?._id)
                .filter(Boolean),
        [selectedPackageBarbers]
    );
    const hasSelectedRequiredBarbers = isPackage
        ? packageItems.length > 0 && packageBarberIds.length === packageItems.length
        : Boolean(selectedBarber);

    useEffect(() => {
        if (!isOpen) return;

        setCurrentStep(1);

        setSelectedBarber(null);
        setSelectedPackageBarbers([]);
        setSelectedDate(null);
        setSelectedTime(null);

        setAvailableDates([]);
        setAvailableSlots([]);

        setDatesError('');
        setSlotsError('');
        setBookingError('');
        setBookingSuccess('');

        setIsLoadingDates(false);
        setIsLoadingSlots(false);
        setIsSubmittingBooking(false);

        setScheduleMeta({
            timezone: 'America/Guayaquil',
            minNoticeMinutes: 0,
            maxDaysAhead: 30,
            durationMinutes: Number(service?.durationMinutes || 0),
        });
    }, [isOpen, service]);

    const fetchAvailableDates = async (barber) => {
        const barberId = barber?.id || barber?._id;
        const serviceId = service?.id || service?._id;

        if ((!barberId && !packageBarberIds.length) || !serviceId) return false;

        setIsLoadingDates(true);
        setDatesError("");
        setBookingError("");
        setBookingSuccess("");
        setAvailableDates([]);
        setSelectedDate(null);
        setSelectedTime(null);
        setAvailableSlots([]);
        setSlotsError("");

        try {
            const query = new URLSearchParams({ serviceId });
            if (isPackage) {
                query.set('packageBarbers', packageBarberIds.join(','));
            } else {
                query.set('barberId', barberId);
            }

            const res = await fetch(
                `/api/client/schedule/dates?${query.toString()}`,
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.error || "No se pudieron cargar los días disponibles");
            }

            setAvailableDates(Array.isArray(data?.availableDates) ? data.availableDates : []);
            setScheduleMeta((prev) => ({
                ...prev,
                timezone: data?.timezone || prev.timezone,
                minNoticeMinutes: Number(data?.minNoticeMinutes || 0),
                maxDaysAhead: Number(data?.maxDaysAhead || 30),
                durationMinutes: Number(
                    data?.durationMinutes || service?.durationMinutes || 0
                ),
            }));

            return true;
        } catch (err) {
            setDatesError(err?.message || "No se pudieron cargar los días disponibles");
            return false;
        } finally {
            setIsLoadingDates(false);
        }
    };

    const fetchAvailableSlots = async (dateValue) => {
        const barberId = selectedBarber?.id || selectedBarber?._id;
        const serviceId = service?.id || service?._id;

        if ((!barberId && !packageBarberIds.length) || !serviceId || !dateValue) return false;

        setIsLoadingSlots(true);
        setSlotsError("");
        setBookingError("");
        setBookingSuccess("");
        setAvailableSlots([]);
        setSelectedTime(null);

        try {
            const query = new URLSearchParams({ serviceId, date: dateValue });
            if (isPackage) {
                query.set('packageBarbers', packageBarberIds.join(','));
            } else {
                query.set('barberId', barberId);
            }

            const res = await fetch(
                `/api/client/schedule/slots?${query.toString()}`,
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.error || "No se pudieron cargar los horarios");
            }

            setAvailableSlots(Array.isArray(data?.slots) ? data.slots : []);
            return true;
        } catch (err) {
            setSlotsError(err?.message || "No se pudieron cargar los horarios");
            return false;
        } finally {
            setIsLoadingSlots(false);
        }
    };

    const handleSelectBarber = (barber) => {
        setSelectedBarber(barber);
        setSelectedDate(null);
        setSelectedTime(null);
        setAvailableDates([]);
        setAvailableSlots([]);
        setDatesError('');
        setSlotsError('');
        setBookingError('');
        setBookingSuccess('');
    };

    const handleSelectPackageBarber = (index, barber) => {
        setSelectedPackageBarbers((prev) => {
            const next = [...prev];
            next[index] = barber;
            return next;
        });
        setSelectedDate(null);
        setSelectedTime(null);
        setAvailableDates([]);
        setAvailableSlots([]);
        setDatesError('');
        setSlotsError('');
        setBookingError('');
        setBookingSuccess('');
    };

    const handleSelectDate = (dateValue) => {
        setSelectedDate(dateValue);
        setSelectedTime(null);
        setAvailableSlots([]);
        setSlotsError('');
        setBookingError('');
        setBookingSuccess('');
    };

    const handleSelectTime = (slot) => {
        setSelectedTime(slot);
        setBookingError('');
        setBookingSuccess('');
    };

    const handleSubmitBooking = async () => {
        if (isSubmittingBooking) return;

        const serviceId = service?.id || service?._id;
        const barberId = selectedBarber?.id || selectedBarber?._id;
        const date = selectedDate;
        const time = selectedTime?.start;

        if (!serviceId || (!barberId && !packageBarberIds.length) || !date || !time) {
            setBookingError('Faltan datos para completar la reserva.');
            return;
        }

        setIsSubmittingBooking(true);
        setBookingError('');
        setBookingSuccess('');

        try {
            const res = await fetch('/api/client/appointment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    serviceId,
                    ...(isPackage ? { packageBarbers: packageBarberIds } : { barberId }),
                    date,
                    time,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                const message =
                    data?.error || 'No se pudo crear la reserva. Intenta nuevamente.';

                setBookingError(message);

                if (res.status === 409) {
                    setSelectedTime(null);
                    await fetchAvailableSlots(date);
                    setCurrentStep(3);
                    return;
                }

                if (
                    message.toLowerCase().includes('fecha') ||
                    message.toLowerCase().includes('día') ||
                    message.toLowerCase().includes('rango permitido')
                ) {
                    setSelectedDate(null);
                    setSelectedTime(null);
                    setAvailableSlots([]);
                    await fetchAvailableDates(selectedBarber);
                    setCurrentStep(2);
                    return;
                }

                return;
            }

            onBookingSuccess?.({
                title: 'Reserva confirmada',
                message: `${data?.message || 'Tu cita ha sido registrada correctamente.'} Recuerda llegar puntual: el tiempo de espera maximo es de 5 minutos.`,
            });
        } catch (err) {
            setBookingError(err?.message || 'No se pudo crear la reserva.');
        } finally {
            setIsSubmittingBooking(false);
        }
    };

    const handleContinue = async () => {
        if (currentStep === 1) {
            if (!hasSelectedRequiredBarbers) return;
            const ok = await fetchAvailableDates(selectedBarber);
            if (ok) setCurrentStep(2);
            return;
        }

        if (currentStep === 2) {
            if (!selectedDate) return;
            const ok = await fetchAvailableSlots(selectedDate);
            if (ok) setCurrentStep(3);
            return;
        }

        if (currentStep === 3) {
            if (!selectedTime) return;
            setCurrentStep(4);
            return;
        }

        if (currentStep === 4) {
            await handleSubmitBooking();
        }
    };

    const handleBack = () => {
        if (isSubmittingBooking) return;

        setBookingError('');
        setBookingSuccess('');

        if (currentStep === 1) {
            onClose();
            return;
        }

        if (currentStep === 2) {
            setCurrentStep(1);
            return;
        }

        if (currentStep === 3) {
            setCurrentStep(2);
            return;
        }

        if (currentStep === 4) {
            setCurrentStep(3);
        }
    };

    const continueDisabled =
        (currentStep === 1 && !hasSelectedRequiredBarbers) ||
        (currentStep === 2 && !selectedDate) ||
        (currentStep === 3 && !selectedTime) ||
        isLoadingDates ||
        isLoadingSlots ||
        isSubmittingBooking;

    if (!isOpen) return null;

    return (
        <div className={styles.bookingModal} onClick={isSubmittingBooking ? undefined : onClose}>
            <div
                className={styles.dialog}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.layout}>
                    <div className={styles.summaryColumn}>
                        <BookingSummaryCard
                            service={service}
                            selectedBarber={selectedBarber}
                            selectedPackageBarbers={selectedPackageBarbers}
                            selectedDate={selectedDate}
                            selectedTime={selectedTime}
                        />
                    </div>

                    <div className={`${styles.selectionColumn} ${isLoadingDates ? styles.loading : ''}`}>
                        <div className={styles.mobileProgress}>
                            <span className={styles.mobileProgressBadge}>
                                Paso {currentStep} de 4
                            </span>
                        </div>

                        <div className={styles.selectionViewport}>
                            {currentStep === 1 && (
                                isPackage ? (
                                    <section className={styles.packageBarbers}>
                                        <div className={styles.packageHeading}>
                                            <h4>Selecciona los barberos del paquete</h4>
                                            <p>
                                                El orden del paquete define el orden de atención y los horarios se calculan consecutivos.
                                            </p>
                                        </div>

                                        {packageItems.map((item, index) => (
                                            <div className={styles.packageBarberBlock} key={item.serviceId || index}>
                                                <div className={styles.packageBarberTitle}>
                                                    <span>{index + 1}</span>
                                                    <strong>{item.name}</strong>
                                                </div>
                                                <BarberSelector
                                                    barbers={item.barbers}
                                                    selectedBarber={selectedPackageBarbers[index]}
                                                    onSelectBarber={(barber) => handleSelectPackageBarber(index, barber)}
                                                />
                                            </div>
                                        ))}
                                    </section>
                                ) : (
                                    <BarberSelector
                                        barbers={availableBarbers}
                                        selectedBarber={selectedBarber}
                                        onSelectBarber={handleSelectBarber}
                                    />
                                )
                            )}

                            {currentStep === 2 && (
                                <DaySelector
                                    availableDates={availableDates}
                                    selectedDate={selectedDate}
                                    onSelectDate={handleSelectDate}
                                    maxDaysAhead={scheduleMeta.maxDaysAhead}
                                    isLoading={isLoadingDates}
                                    error={datesError}
                                    disabled={!hasSelectedRequiredBarbers}
                                />
                            )}

                            {currentStep === 3 && (
                                <TimeSelector
                                    slots={availableSlots}
                                    selectedTime={selectedTime}
                                    onSelectTime={handleSelectTime}
                                    isLoading={isLoadingSlots}
                                    error={slotsError}
                                    disabled={!selectedDate}
                                />
                            )}

                            {currentStep === 4 && (
                                <div className={styles.confirmationBlock}>
                                    <h4>Confirma tu reserva</h4>
                                    <p>
                                        Revisa la información y confirma para guardar tu cita.
                                    </p>
                                    <div className={styles.noticeCard}>
                                        <strong>Aviso importante</strong>
                                        <p>{punctualityNotice}</p>
                                    </div>
                                </div>
                            )}

                            {bookingError ? (
                                <div className={styles.feedbackError}>
                                    <p>{bookingError}</p>
                                </div>
                            ) : null}

                            {bookingSuccess ? (
                                <div className={styles.feedbackSuccess}>
                                    <p>{bookingSuccess}</p>
                                </div>
                            ) : null}
                        </div>

                        <div className={styles.footer}>
                            <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={handleBack}
                                disabled={isSubmittingBooking}
                            >
                                <ChevronLeft size={16} />
                                <span>{currentStep === 1 ? 'Cancelar' : 'Regresar'}</span>
                            </button>

                            <button
                                type="button"
                                className={styles.primaryBtn}
                                onClick={handleContinue}
                                disabled={continueDisabled}
                            >
                                <span>
                                    {isLoadingDates || isLoadingSlots
                                        ? 'Cargando...'
                                        : isSubmittingBooking
                                            ? 'Guardando...'
                                            : currentStep === 4
                                                ? 'Confirmar reserva'
                                                : 'Continuar'}
                                </span>
                                {!isSubmittingBooking && currentStep < 4 && <ChevronRight size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
