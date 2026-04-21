'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Instagram, Facebook, Music2, MapPin, ChevronDown, User, LogOut, AlertTriangle, Coffee, GlassWater, Wine, Candy, Gamepad2, Clock3, ShieldCheck, Sparkles, Scissors, ArrowRight, Star, ChevronLeft, ChevronRight, X } from 'lucide-react';
import styles from './home-client.module.scss';
import ServicesSection from '../ServiceSection/ServicesSection';
import BookingModal from '../BookingModal/BookingModal';
import { signOut } from 'next-auth/react';
import ModalConfirm from '@public/components/shared/ModalConfirm/ModalConfirm';

const GALLERY_IMAGES = [
    { src: '/assets/imgs/img1-hor.jpg', orientation: 'horizontal' },
    { src: '/assets/imgs/img2-ver.jpg', orientation: 'vertical' },
    { src: '/assets/imgs/img3-hor.jpg', orientation: 'horizontal' },
    { src: '/assets/imgs/img4-ver.jpg', orientation: 'vertical' },
    { src: '/assets/imgs/img5-hor.jpg', orientation: 'horizontal' },
    { src: '/assets/imgs/img6-ver.jpg', orientation: 'vertical' },
];

const getFeaturedGalleryImages = (galleryImages, step) => {
    const horizontalImages = galleryImages
        .map((image, index) => ({ ...image, sourceIndex: index }))
        .filter((image) => image.orientation === 'horizontal');
    const verticalImages = galleryImages
        .map((image, index) => ({ ...image, sourceIndex: index }))
        .filter((image) => image.orientation === 'vertical');

    if (!horizontalImages.length || !verticalImages.length) {
        return galleryImages
            .slice(0, 3)
            .map((image, index) => ({ ...image, sourceIndex: index }));
    }

    return [
        horizontalImages[step % horizontalImages.length],
        verticalImages[step % verticalImages.length],
        horizontalImages[(step + 1) % horizontalImages.length],
    ];
};

const EXPERIENCE_ITEMS = [
    {
        icon: Coffee,
        title: 'Cafe disponible',
        description: 'Mientras esperas o disfrutas del servicio, puedes tomar un cafe en un ambiente relajado.',
    },
    {
        icon: GlassWater,
        title: 'Agua y comodidad',
        description: 'Todos los servicios incluyen acceso a agua para que tu visita sea mas comoda.',
    },
    {
        icon: Wine,
        title: 'Licor para la experiencia',
        description: 'En Arkad tambien puedes disfrutar de licor como parte de la experiencia premium.',
    },
    {
        icon: Candy,
        title: 'Dulces incluidos',
        description: 'Pequenos detalles que elevan la visita: dulces y atencion cuidada de inicio a fin.',
    },
    {
        icon: Gamepad2,
        title: 'Consolas disponibles',
        description: 'Puedes jugar en las consolas disponibles mientras esperas o compartes el momento.',
    },
];

const TESTIMONIALS = [
    {
        name: 'Mateo Cedeño',
        review: 'La atencion fue impecable desde que llegue. El ambiente, el servicio y los detalles hacen que realmente se sienta premium.',
    },
    {
        name: 'Andrés Villacís',
        review: 'Muy recomendado. El corte quedo excelente y todo el espacio transmite mucha calidad y buen gusto.',
    },
    {
        name: 'Nicolás Vera',
        review: 'Arkad no es solo una barberia, es una experiencia. Se nota el cuidado en cada detalle y el trato al cliente es top.',
    },
    {
        name: 'Sebastián Mera',
        review: 'Me gusto muchisimo la puntualidad, el ambiente y la forma en que te hacen sentir comodo durante toda la cita.',
    },
    {
        name: 'Javier Alarcón',
        review: 'Excelente servicio. Todo se siente muy bien pensado, desde la reserva hasta el resultado final. Sin duda regreso.',
    },
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
    const [scrollOffset, setScrollOffset] = useState(0);
    const [heroGalleryStep, setHeroGalleryStep] = useState(0);
    const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
    const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
    const [heroGalleryImages, setHeroGalleryImages] = useState(() => getFeaturedGalleryImages(GALLERY_IMAGES, 0));
    const [heroGalleryPrevImages, setHeroGalleryPrevImages] = useState(null);
    const [isHeroGalleryTransitioning, setIsHeroGalleryTransitioning] = useState(false);
    const [hoveredHeroCardIndex, setHoveredHeroCardIndex] = useState(null);

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
    const galleryImages = useMemo(() => GALLERY_IMAGES, []);
    const featuredGalleryImages = useMemo(
        () => getFeaturedGalleryImages(galleryImages, heroGalleryStep),
        [galleryImages, heroGalleryStep]
    );

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

    useEffect(() => {
        const elements = Array.from(document.querySelectorAll('[data-reveal]'));

        if (!elements.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add(styles.isVisible);
                    }
                });
            },
            {
                threshold: 0.18,
                rootMargin: '0px 0px -10% 0px',
            }
        );

        elements.forEach((element) => observer.observe(element));

        return () => observer.disconnect();
    }, [appointments.length]);

    useEffect(() => {
        let ticking = false;

        const updateScroll = () => {
            setScrollOffset(window.scrollY || 0);
            ticking = false;
        };

        const handleScroll = () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(updateScroll);
        };

        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (isGalleryModalOpen || hoveredHeroCardIndex !== null || isHeroGalleryTransitioning) return undefined;

        const interval = window.setInterval(() => {
            setHeroGalleryStep((prev) => prev + 1);
        }, 3200);

        return () => window.clearInterval(interval);
    }, [galleryImages.length, hoveredHeroCardIndex, isGalleryModalOpen, isHeroGalleryTransitioning]);

    useEffect(() => {
        const currentSignature = heroGalleryImages.map((image) => image.src).join('|');
        const nextSignature = featuredGalleryImages.map((image) => image.src).join('|');

        if (currentSignature === nextSignature) return undefined;

        setHeroGalleryPrevImages(heroGalleryImages);
        setHeroGalleryImages(featuredGalleryImages);
        setIsHeroGalleryTransitioning(true);

        const timeout = window.setTimeout(() => {
            setHeroGalleryPrevImages(null);
            setIsHeroGalleryTransitioning(false);
        }, 480);

        return () => window.clearTimeout(timeout);
    }, [featuredGalleryImages, heroGalleryImages]);

    useEffect(() => {
        if (!isGalleryModalOpen) return;

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setIsGalleryModalOpen(false);
            }

            if (event.key === 'ArrowRight') {
                setActiveGalleryIndex((prev) => (prev + 1) % galleryImages.length);
            }

            if (event.key === 'ArrowLeft') {
                setActiveGalleryIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
            }
        };

        document.addEventListener('keydown', handleEscape);

        return () => document.removeEventListener('keydown', handleEscape);
    }, [galleryImages.length, isGalleryModalOpen]);

    const getUpcomingReminder = (startAt) => {
        if (!startAt) return null;

        const diffMs = new Date(startAt).getTime() - Date.now();

        if (diffMs <= 0 || diffMs > 3 * 60 * 60 * 1000) {
            return null;
        }

        const totalMinutes = Math.max(1, Math.round(diffMs / 60000));

        if (totalMinutes <= 60) {
            return `Tu cita es en menos de ${totalMinutes} minutos. Llega puntual para respetar el tiempo de espera maximo de 5 minutos.`;
        }

        return `Tu cita es hoy y faltan aproximadamente ${totalMinutes} minutos. Por favor llega puntual; el tiempo de espera maximo es de 5 minutos.`;
    };

    const closestUpcomingReminder = appointments
        .map((appointment) => getUpcomingReminder(appointment.startAt))
        .find(Boolean);

    const currentGalleryImage = galleryImages[activeGalleryIndex];

    const openGalleryModal = (src) => {
        const index = galleryImages.findIndex((image) => image.src === src);
        setActiveGalleryIndex(index >= 0 ? index : 0);
        setIsGalleryModalOpen(true);
    };

    const goToPrevGalleryImage = () => {
        setActiveGalleryIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
    };

    const goToNextGalleryImage = () => {
        setActiveGalleryIndex((prev) => (prev + 1) % galleryImages.length);
    };

    return (
        <div
            className={styles.page}
            style={{
                '--scroll-offset': `${Math.min(scrollOffset, 320)}px`,
                '--bg-parallax-offset': `${scrollOffset * 0.12}px`,
            }}
        >
            <div className={styles.backgroundGrid} />
            <div className={`${styles.glow} ${styles.glowOne}`} />
            <div className={`${styles.glow} ${styles.glowTwo}`} />
            <div className={`${styles.blurOrb} ${styles.blurOrbLeft}`} />
            <div className={`${styles.blurOrb} ${styles.blurOrbRight}`} />
            <div className={styles.bgMarkWrap} aria-hidden="true">
                <img
                    src="/assets/icons/arkad.svg"
                    alt=""
                    className={styles.bgMark}
                />
            </div>

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
                    {closestUpcomingReminder ? (
                        <div className={`${styles.topReminder} ${styles.revealUp} ${styles.isVisible}`}>
                            <div className={styles.topReminderIcon}>
                                <Clock3 size={18} />
                            </div>
                            <div className={styles.topReminderCopy}>
                                <strong>Tu cita ya esta cerca</strong>
                                <p>{closestUpcomingReminder}</p>
                            </div>
                        </div>
                    ) : null}

                    <div className={styles.heroContent}>
                        <div className={styles.heroCopy}>
                            <span className={styles.heroGlow} aria-hidden="true" />
                            <div className={styles.logoLockup}>
                                <div className={styles.logoRule} />
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
                                <div className={styles.logoRule} />
                            </div>

                            <div className={styles.heroBadgeRow}>
                                <div className={styles.heroBadge}>
                                    <ShieldCheck size={15} />
                                    <span>Experiencia premium</span>
                                </div>
                                <div className={styles.heroBadge}>
                                    <Sparkles size={15} />
                                    <span>Servicios especializados</span>
                                </div>
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
                                    <span>Ver servicios</span>
                                    <ArrowRight size={17} />
                                </a>
                                <a href="#experience" className={styles.btnSecondary}>
                                    Descubrir experiencia
                                </a>
                            </div>

                            <div className={styles.heroStats}>
                                <article className={styles.heroStatCard}>
                                    <span className={styles.heroStatValue}>Comunidad</span>
                                    <span className={styles.heroStatLabel}>Estamos construyendo una comunidad exclusiva alrededor de la experiencia Arkad.</span>
                                </article>
                                <article className={styles.heroStatCard}>
                                    <span className={styles.heroStatValue}>Networking</span>
                                    <span className={styles.heroStatLabel}>Un espacio pensado para conectar con personas, ideas y nuevas oportunidades.</span>
                                </article>
                                <article className={styles.heroStatCard}>
                                    <span className={styles.heroStatValue}>Beneficios</span>
                                    <span className={styles.heroStatLabel}>Pronto sumaremos beneficios exclusivos para quienes formen parte de Arkad.</span>
                                </article>
                            </div>
                        </div>

                        <div className={styles.heroVisualPanel}>
                            <div className={styles.heroVisualHeader}>
                                <div>
                                    <span className={styles.heroVisualEyebrow}>Sesion Arkad</span>
                                    <h2>Barberia, ambiente y detalle en una sola cita</h2>
                                </div>
                                <div className={styles.heroVisualChip}>
                                    <Scissors size={16} />
                                    <span>Reserva activa</span>
                                </div>
                            </div>

                            <div className={`${styles.heroGrid} ${hoveredHeroCardIndex !== null ? styles.heroGridHovering : ''}`}>
                                {heroGalleryImages.map((image, index) => (
                                    <button
                                        type="button"
                                        className={`${styles.heroCard} ${styles[`heroCard${index + 1}`]} ${image.orientation === 'horizontal' ? styles.heroCardHorizontal : styles.heroCardVertical} ${hoveredHeroCardIndex === index ? styles.heroCardHovered : ''}`}
                                        key={`${image.src}-${image.sourceIndex}`}
                                        onClick={() => openGalleryModal(image.src)}
                                        onMouseEnter={() => setHoveredHeroCardIndex(index)}
                                        onMouseLeave={() => setHoveredHeroCardIndex(null)}
                                    >
                                        <div className={styles.heroImageLayer}>
                                            {heroGalleryPrevImages?.[index] ? (
                                                <div className={`${styles.heroImageMotion} ${styles.heroImageOutgoing}`}>
                                                    <img
                                                        src={heroGalleryPrevImages[index].src}
                                                        alt=""
                                                        className={styles.heroImage}
                                                    />
                                                </div>
                                            ) : null}

                                            <div
                                                key={`${image.src}-${heroGalleryStep}-${index}`}
                                                className={`${styles.heroImageMotion} ${isHeroGalleryTransitioning ? styles.heroImageIncoming : ''}`}
                                            >
                                                <img
                                                    src={image.src}
                                                    alt={`Galería Arkad ${index + 1}`}
                                                    className={styles.heroImage}
                                                />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className={styles.main}>
                <section id="experience" className={`${styles.experienceSection} ${styles.revealUp}`} data-reveal>
                    <div className={styles.container}>
                        <div className={styles.sectionHeading}>
                            <span className={styles.sectionHeadingEyebrow}>
                                Experiencia Arkad
                            </span>
                            <h2 className={styles.sectionHeadingTitle}>
                                Todos los servicios incluyen mucho mas que un corte
                            </h2>
                            <p className={styles.sectionHeadingText}>
                                En Arkad buscamos que cada reserva se viva como una experiencia completa:
                                acceso a cafe, agua, licor, dulces y tiempo para disfrutar de las consolas
                                disponibles mientras compartes el momento.
                            </p>
                        </div>

                        <div className={styles.experiencePanel}>
                            <div className={`${styles.experienceIntro} ${styles.revealUp}`} data-reveal>
                                <span className={styles.experienceIntroEyebrow}>Incluye en cada visita</span>
                                <h3>Una experiencia pensada para que disfrutes desde que llegas hasta que sales.</h3>
                                <p>
                                    No es solo el servicio: es el ambiente, la atencion y los detalles que
                                    convierten tu cita en un momento premium.
                                </p>
                            </div>

                            <div className={styles.experienceList}>
                                {EXPERIENCE_ITEMS.map((item, index) => {
                                    const Icon = item.icon;

                                    return (
                                        <article
                                            key={item.title}
                                            className={`${styles.experienceItem} ${styles.revealUp}`}
                                            data-reveal
                                            style={{ '--stagger-order': index }}
                                        >
                                            <div className={styles.experienceIcon}>
                                                <Icon size={20} />
                                            </div>
                                            <div className={styles.experienceItemCopy}>
                                                <h3>{item.title}</h3>
                                                <p>{item.description}</p>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>

                <section id="services" className={`${styles.servicesSection} ${styles.revealUp}`} data-reveal>
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
                        <section id="appointments" className={`${styles.appointmentsSection} ${styles.revealUp}`} data-reveal>
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
                                            const upcomingReminder = getUpcomingReminder(appointment.startAt);

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

                                                    {upcomingReminder ? (
                                                        <div className={styles.appointmentReminder}>
                                                            <Clock3 size={16} />
                                                            <p>{upcomingReminder}</p>
                                                        </div>
                                                    ) : null}

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

                <section className={`${styles.testimonialsSection} ${styles.revealUp}`} data-reveal>
                    <div className={styles.container}>
                        <div className={styles.sectionHeading}>
                            <span className={styles.sectionHeadingEyebrow}>
                                Reseñas
                            </span>
                            <h2 className={styles.sectionHeadingTitle}>
                                Lo que dicen quienes ya vivieron la experiencia Arkad
                            </h2>
                            <p className={styles.sectionHeadingText}>
                                Comentarios reales de clientes satisfechos con la atención, el ambiente y el resultado final.
                            </p>
                        </div>

                        <div className={styles.testimonialsGrid}>
                            {TESTIMONIALS.map((testimonial, index) => (
                                <article
                                    key={testimonial.name}
                                    className={`${styles.testimonialCard} ${styles.revealUp}`}
                                    data-reveal
                                    style={{ '--stagger-order': index }}
                                >
                                    <div className={styles.testimonialStars} aria-label="5 estrellas">
                                        {Array.from({ length: 5 }).map((_, starIndex) => (
                                            <Star key={starIndex} size={16} fill="currentColor" />
                                        ))}
                                    </div>

                                    <p className={styles.testimonialText}>
                                        “{testimonial.review}”
                                    </p>

                                    <span className={styles.testimonialAuthor}>
                                        {testimonial.name}
                                    </span>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>


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

            {isGalleryModalOpen ? (
                <div
                    className={styles.galleryModal}
                    role="dialog"
                    aria-modal="true"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setIsGalleryModalOpen(false);
                        }
                    }}
                >
                    <div className={styles.galleryDialog}>
                        <button
                            type="button"
                            className={styles.galleryClose}
                            onClick={() => setIsGalleryModalOpen(false)}
                            aria-label="Cerrar galería"
                        >
                            <X size={18} />
                        </button>

                        <div className={styles.galleryStage}>
                            <button
                                type="button"
                                className={styles.galleryNav}
                                onClick={goToPrevGalleryImage}
                                aria-label="Imagen anterior"
                            >
                                <ChevronLeft size={18} />
                            </button>

                            <div
                                className={`${styles.galleryImageWrap} ${currentGalleryImage?.orientation === 'vertical' ? styles.galleryImageWrapVertical : styles.galleryImageWrapHorizontal}`}
                            >
                                <img
                                    key={galleryImages[activeGalleryIndex].src}
                                    src={galleryImages[activeGalleryIndex].src}
                                    alt={`Galería Arkad ${activeGalleryIndex + 1}`}
                                    className={styles.galleryImage}
                                />
                            </div>

                            <button
                                type="button"
                                className={styles.galleryNav}
                                onClick={goToNextGalleryImage}
                                aria-label="Imagen siguiente"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        <div className={styles.galleryThumbs}>
                            {galleryImages.map((image, index) => (
                                <button
                                    type="button"
                                    key={image.src}
                                    className={`${styles.galleryThumb} ${index === activeGalleryIndex ? styles.galleryThumbActive : ''}`}
                                    onClick={() => setActiveGalleryIndex(index)}
                                >
                                    <img
                                        src={image.src}
                                        alt={`Miniatura ${index + 1}`}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
