'use client';

import { useMemo, useState } from 'react';
import BookingModal from './BookingModal';
import ServicesSection from './ServicesSection';
import { Instagram, Facebook, Music2, MapPin } from 'lucide-react';

const HERO_IMAGES = [
    '/assets/imgs/barber-hero-1.jpg',
    '/assets/imgs/barber-hero-2.jpg',
    '/assets/imgs/barber-hero-3.jpg',
];

export default function HomeClient({ session, userName }) {
    const [selectedService, setSelectedService] = useState(null);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    const heroImages = useMemo(() => HERO_IMAGES, []);

    const openBookingModal = (service) => {
        setSelectedService(service || null);
        setIsBookingModalOpen(true);
    };

    const closeBookingModal = () => {
        setIsBookingModalOpen(false);
    };

    const openAuthModal = () => {
        setIsAuthModalOpen(true);
    };

    return (
        <div className="page home-public">
            <button
                className="auth-floating-btn"
                onClick={session ? undefined : openAuthModal}
                type="button"
            >
                {session ? (userName.split(' ')[0] || 'Mi cuenta') : 'Iniciar sesión'}
            </button>

            <header className="home-public__hero">
                <div className="container">
                    <div className="home-public__hero-content">
                        <div className="home-public__hero-copy">
                            <div className="home-public__brand">
                                <img
                                    src="/assets/logo-arkad.svg"
                                    alt="ARKAD"
                                    className="home-public__brand-logo"
                                />
                                <span className="home-public__brand-subtitle">
                                    Master Barber Empire
                                </span>
                            </div>
                            <div className="social-bar">
                                <a href="https://www.instagram.com/arkad_barber/" target="_blank" rel="noopener noreferrer" className="social-bar__item">
                                    <Instagram size={16} />
                                    <span>Instagram</span>
                                </a>

                                <a href="https://www.facebook.com/profile.php?id=61562071806456" target="_blank" rel="noopener noreferrer" className="social-bar__item">
                                    <Facebook size={16} />
                                    <span>Facebook</span>
                                </a>

                                <a href="https://www.tiktok.com/@arkad1992" target="_blank" rel="noopener noreferrer" className="social-bar__item">
                                    <Music2 size={16} />
                                    <span>TikTok</span>
                                </a>
                                <a
                                    href="https://maps.app.goo.gl/MGALnMS9fhHkUkfY7"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="social-bar__item social-bar__item--location"
                                >
                                    <MapPin size={16} />
                                    <span>Ubicación</span>
                                </a>
                            </div>
                            <h1 className="home-public__title">
                                Estilo, precisión y una experiencia premium en cada cita.
                            </h1>

                            <p className="home-public__text">
                                Descubre nuestros servicios, elige el que mejor se adapte a ti
                                y reserva tu espacio de forma rápida y elegante.
                            </p>

                            <div className="home-public__actions">
                                <a href="#services" className="btn-primary">
                                    Ver servicios
                                </a>
                            </div>
                        </div>

                        <div className="home-public__hero-grid">
                            {heroImages.map((image, index) => (
                                <div
                                    className={`home-public__hero-card home-public__hero-card--${index + 1}`}
                                    key={image}
                                >
                                    <img src={image} alt={`Servicio de barbería ${index + 1}`} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            <main className="home-public__main">
                <section id="services" className="home-public__services-section">
                    <div className="container">
                        <div className="section-heading">
                            <span className="section-heading__eyebrow">Nuestros servicios</span>
                            <h2 className="section-heading__title">
                                Elige el servicio ideal para ti
                            </h2>
                            <p className="section-heading__text">
                                Explora nuestras opciones y reserva en pocos pasos.
                            </p>
                        </div>

                        <ServicesSection onReserve={openBookingModal} />
                    </div>
                </section>
            </main>

            <BookingModal
                isOpen={isBookingModalOpen}
                onClose={closeBookingModal}
                service={selectedService}
                session={session}
            />

            {/* Aquí luego puedes volver a poner tu AuthModal */}
            {/* <AuthModal isActive={isAuthModalOpen} handler={openAuthModal} /> */}
        </div>
    );
}