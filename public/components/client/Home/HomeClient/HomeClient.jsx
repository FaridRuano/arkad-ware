'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Instagram, Facebook, Music2, MapPin, ChevronDown, User, LogOut, AlertTriangle } from 'lucide-react';
import styles from './home-client.module.scss';
import ServicesSection from '../ServiceSection/ServicesSection';
import BookingModal from '../BookingModal/BookingModal';
import { signOut } from 'next-auth/react';
import ModalConfirm from '@public/components/shared/ModalConfirm';

const HERO_IMAGES = [
    '/assets/imgs/barber-hero-1.jpg',
    '/assets/imgs/barber-hero-2.jpg',
    '/assets/imgs/barber-hero-3.jpg',
];

export default function HomeClient({ session, userName }) {
    const [selectedService, setSelectedService] = useState(null);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

    const [appointments, setAppointments] = useState([]);
    const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
    const [appointmentsError, setAppointmentsError] = useState('');
    const [updatingAppointmentId, setUpdatingAppointmentId] = useState('');

    const [bookingSuccessModal, setBookingSuccessModal] = useState(false)
    const [bookingSuccessText, setBookingSuccessText] = useState('')
    const [bookingSuccessTitle, setBookingSuccessTitle] = useState('')

    const [infoModalOpen, setInfoModalOpen] = useState(false);
    const [infoModalTitle, setInfoModalTitle] = useState('');
    const [infoModalText, setInfoModalText] = useState('');

    const [confirmAppointmentModal, setConfirmAppointmentModal] = useState(false);
    const [appointmentActionTarget, setAppointmentActionTarget] = useState(null);
    const [appointmentActionType, setAppointmentActionType] = useState('');
    const [appointmentActionLoading, setAppointmentActionLoading] = useState(false);

    const openAppointmentConfirm = (appointment) => {
        const nextAction = canCancelAppointment(appointment.startAt)
            ? 'cancelled'
            : 'no_assistance';

        setAppointmentActionTarget(appointment);
        setAppointmentActionType(nextAction);
        setConfirmAppointmentModal(true);
    };

    const handleReserveLimitReached = ({ title, message }) => {
        setInfoModalTitle(title || 'Aviso');
        setInfoModalText(message || 'No puedes realizar esta acción en este momento.');
        setInfoModalOpen(true);
    };

    const accountMenuRef = useRef(null);
    const heroImages = useMemo(() => HERO_IMAGES, []);

    const openBookingModal = (service) => {
        setSelectedService(service || null);
        setIsBookingModalOpen(true);
    };

    const closeBookingModal = () => {
        setIsBookingModalOpen(false);
    };

    const handleBookingSuccess = ({ title, message }) => {
        setIsBookingModalOpen(false);
        setBookingSuccessTitle(title || 'Reserva confirmada');
        setBookingSuccessText(message || 'Tu cita ha sido registrada correctamente.');
        setBookingSuccessModal(true);
    };

    const openAuthModal = () => {
        setIsAuthModalOpen(true);
    };

    const toggleAccountMenu = () => {
        if (!session) {
            openAuthModal();
            return;
        }

        setIsAccountMenuOpen((prev) => !prev);
    };

    const handleSignOut = async () => {
        setIsAccountMenuOpen(false);
        await signOut({ callbackUrl: '/' });
    };

    const canCancelAppointment = (startAt) => {
        if (!startAt) return false;

        const appointmentTime = new Date(startAt).getTime();
        const now = Date.now();
        const diffMs = appointmentTime - now;
        const twoHoursMs = 2 * 60 * 60 * 1000;

        return diffMs > twoHoursMs;
    };

    const formatAppointmentDate = (dateValue) => {
        if (!dateValue) return '';

        const date = new Date(dateValue);

        return new Intl.DateTimeFormat('es-EC', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    const fetchAppointments = async () => {
        try {
            setIsLoadingAppointments(true);
            setAppointmentsError('');

            const res = await fetch('/api/client/appointment', {
                method: 'GET',
                cache: 'no-store',
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.error || 'No se pudieron cargar tus citas');
            }

            setAppointments(Array.isArray(data?.appointments) ? data.appointments : []);
        } catch (err) {
            setAppointmentsError(err?.message || 'Error al cargar tus citas');
        } finally {
            setIsLoadingAppointments(false);
        }
    };

    const handleAppointmentAction = async () => {
        const appointment = appointmentActionTarget;
        const appointmentId = appointment?.id;

        if (!appointmentId || appointmentActionLoading) return;

        const nextStatus = appointmentActionType;

        setAppointmentActionLoading(true);

        try {
            const res = await fetch(`/api/client/appointment/${appointmentId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: nextStatus,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.error || 'No se pudo actualizar la cita');
            }

            setConfirmAppointmentModal(false);
            setAppointmentActionTarget(null);
            setAppointmentActionType('');

            await fetchAppointments();
        } catch (err) {
            setAppointmentsError(err?.message || 'No se pudo actualizar la cita');
        } finally {
            setAppointmentActionLoading(false);
        }
    };

    useEffect(() => {
        if (!session?.user?.id) {
            setAppointments([]);
            setIsLoadingAppointments(false);
            return;
        }

        fetchAppointments();
    }, [session?.user?.id, bookingSuccessModal, appointmentActionLoading]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!accountMenuRef.current) return;
            if (!accountMenuRef.current.contains(event.target)) {
                setIsAccountMenuOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setIsAccountMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    return (
        <div className={styles.page}>
            <div className={styles.accountMenuWrap} ref={accountMenuRef}>
                <button
                    className={styles.authFloatingBtn}
                    onClick={toggleAccountMenu}
                    type="button"
                    aria-haspopup={session ? 'menu' : undefined}
                    aria-expanded={session ? isAccountMenuOpen : undefined}
                >
                    <span>
                        {session ? (userName.split(' ')[0] || 'Mi cuenta') : 'Iniciar sesión'}
                    </span>

                    {session ? (
                        <ChevronDown
                            size={16}
                            className={`${styles.authFloatingBtnIcon} ${isAccountMenuOpen ? styles.authFloatingBtnIconOpen : ''}`}
                        />
                    ) : null}
                </button>

                {session && isAccountMenuOpen ? (
                    <div className={styles.accountDropdown} role="menu">
                        <a href="/client/profile" className={styles.accountDropdownItem} role="menuitem">
                            <User size={16} />
                            <span>Mi perfil</span>
                        </a>

                        <button
                            type="button"
                            className={styles.accountDropdownItem}
                            onClick={handleSignOut}
                            role="menuitem"
                        >
                            <LogOut size={16} />
                            <span>Cerrar sesión</span>
                        </button>
                    </div>
                ) : null}
            </div>

            <header className={styles.hero}>
                <div className={styles.container}>
                    <div className={styles.heroContent}>
                        <div className={styles.heroCopy}>
                            <div className={styles.brand}>
                                <img
                                    src="/assets/icons/logo-arkad.svg"
                                    alt="ARKAD"
                                    className={styles.brandLogo}
                                />
                                <span className={styles.brandSubtitle}>
                                    Master Barber Empire
                                </span>
                            </div>

                            <div className={styles.socialBar}>
                                <a
                                    href="https://www.instagram.com/arkad_barber/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.socialBarItem}
                                >
                                    <Instagram size={16} />
                                    <span>Instagram</span>
                                </a>

                                <a
                                    href="https://www.facebook.com/profile.php?id=61562071806456"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.socialBarItem}
                                >
                                    <Facebook size={16} />
                                    <span>Facebook</span>
                                </a>

                                <a
                                    href="https://www.tiktok.com/@arkad1992"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.socialBarItem}
                                >
                                    <Music2 size={16} />
                                    <span>TikTok</span>
                                </a>

                                <a
                                    href="https://maps.app.goo.gl/MGALnMS9fhHkUkfY7"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`${styles.socialBarItem} ${styles.socialBarItemLocation}`}
                                >
                                    <MapPin size={16} />
                                    <span>Ubicación</span>
                                </a>
                            </div>

                            <h1 className={styles.title}>
                                Estilo, precisión y una experiencia premium en cada cita.
                            </h1>

                            <p className={styles.text}>
                                Descubre nuestros servicios, elige el que mejor se adapte a ti
                                y reserva tu espacio de forma rápida y elegante.
                            </p>

                            <div className={styles.actions}>
                                <a href="#services" className={styles.btnPrimary}>
                                    Ver servicios
                                </a>
                            </div>
                        </div>

                        <div className={styles.heroGrid}>
                            {heroImages.map((image, index) => (
                                <div
                                    className={`${styles.heroCard} ${styles[`heroCard${index + 1}`]}`}
                                    key={image}
                                >
                                    <img
                                        src={image}
                                        alt={`Servicio de barbería ${index + 1}`}
                                        className={styles.heroImage}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            <div className={styles.main}>
                <section id="services" className={styles.servicesSection}>
                    <div className={styles.container}>
                        <div className={styles.sectionHeading}>
                            <span className={styles.sectionHeadingEyebrow}>
                                Nuestros servicios
                            </span>
                            <h2 className={styles.sectionHeadingTitle}>
                                Elige el servicio ideal para ti
                            </h2>
                            <p className={styles.sectionHeadingText}>
                                Explora nuestras opciones y reserva en pocos pasos.
                            </p>
                        </div>

                        <ServicesSection onReserve={openBookingModal} onReserveLimitReached={handleReserveLimitReached} />
                    </div>
                </section>

                {
                    appointments.length > 0 && (
                        <section id="appointments" className={styles.appointmentsSection}>
                            <div className={styles.container}>
                                <div className={styles.sectionHeading}>
                                    <span className={styles.sectionHeadingEyebrow}>
                                        Tus reservas
                                    </span>
                                    <h2 className={styles.sectionHeadingTitle}>
                                        Tienes citas pendientes
                                    </h2>
                                    <p className={styles.sectionHeadingText}>
                                        Recuerda cancelar tus citas si no podrás asistir, para que otros clientes puedan reservar ese espacio. Si necesitas ayuda, contáctanos a través de <a href="https://wa.me/+593968844348" target="_blank" rel="noreferrer">nuestro teléfono</a>.
                                    </p>
                                </div>

                                {isLoadingAppointments ? (
                                    <div className={styles.appointmentsGrid}>
                                        {Array.from({ length: 2 }).map((_, index) => (
                                            <article
                                                key={index}
                                                className={`${styles.appointmentCard} ${styles.appointmentCardSkeleton}`}
                                            >
                                                <div className={styles.appointmentSkeletonLine} />
                                                <div className={`${styles.appointmentSkeletonLine} ${styles.short}`} />
                                                <div className={styles.appointmentSkeletonFooter} />
                                            </article>
                                        ))}
                                    </div>
                                ) : appointmentsError ? (
                                    <div className={`${styles.servicesState} ${styles.servicesStateError}`}>
                                        <AlertTriangle />
                                        <p>{appointmentsError}</p>
                                    </div>
                                ) : appointments.length ? (
                                    <div className={styles.appointmentsGrid}>
                                        {appointments.map((appointment) => {
                                            const canCancel = canCancelAppointment(appointment.startAt);
                                            const isUpdating = updatingAppointmentId === appointment.id;

                                            return (
                                                <article key={appointment.id} className={styles.appointmentCard}>
                                                    <div className={styles.appointmentCardTop}>
                                                        <div>
                                                            <h3 className={styles.appointmentTitle}>
                                                                {appointment.serviceName}
                                                            </h3>
                                                            <p className={styles.appointmentDate}>
                                                                {formatAppointmentDate(appointment.startAt)}
                                                            </p>
                                                        </div>

                                                        <span className={styles.appointmentStatus}>
                                                            {appointment.status === 'pending' ? 'Pendiente' : 'Confirmada'}
                                                        </span>
                                                    </div>

                                                    <div className={styles.appointmentMeta}>
                                                        <span>
                                                            <strong>Barbero:</strong> {appointment.barberName || 'Asignado'}
                                                        </span>
                                                        <span>
                                                            <strong>Precio:</strong> ${Number(appointment.price || 0).toFixed(2)}
                                                        </span>
                                                    </div>

                                                    <div className={styles.appointmentCardFooter}>
                                                        <button
                                                            type="button"
                                                            className={`${styles.btnSecondary} ${canCancel ? styles.cancelBtn : styles.noAssistBtn}`}
                                                            onClick={() => openAppointmentConfirm(appointment)}
                                                            disabled={isUpdating}
                                                        >
                                                            {isUpdating
                                                                ? 'Procesando...'
                                                                : canCancel
                                                                    ? 'Cancelar'
                                                                    : 'No asistiré'}
                                                        </button>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className={styles.servicesState}>
                                        <p>No tienes citas pendientes por el momento.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    )
                }


            </div>

            <BookingModal
                isOpen={isBookingModalOpen}
                onClose={closeBookingModal}
                service={selectedService}
                session={session}
                onBookingSuccess={handleBookingSuccess}
            />

            <ModalConfirm
                active={infoModalOpen}
                setActive={setInfoModalOpen}
                title={infoModalTitle}
                mainText={infoModalText}
                type="alert"
            />

            <ModalConfirm
                active={bookingSuccessModal}
                setActive={setBookingSuccessModal}
                mainText={bookingSuccessText}
                title={bookingSuccessTitle}
                type="success"
            />

            <ModalConfirm
                active={confirmAppointmentModal}
                setActive={setConfirmAppointmentModal}
                status={appointmentActionLoading}
                type="confirm"
                title={
                    appointmentActionType === 'cancelled'
                        ? 'Cancelar cita'
                        : 'Confirmar no asistencia'
                }
                mainText={
                    appointmentActionType === 'cancelled'
                        ? '¿Estás seguro de que deseas cancelar esta cita? Este espacio volverá a estar disponible para otros clientes.'
                        : 'Faltan menos de 2 horas para tu cita. ¿Deseas marcar que no asistirás?'
                }
                response={handleAppointmentAction}
            />
        </div>
    );
}