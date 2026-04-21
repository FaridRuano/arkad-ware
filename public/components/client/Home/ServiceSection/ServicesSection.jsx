'use client';

import { useEffect, useState } from 'react';
import styles from './services-section.module.scss';

const formatPrice = (value) => {
  const amount = Number(value || 0);
  return `$${amount.toFixed(2)}`;
};

const formatDuration = (minutes) => {
  const total = Number(minutes || 0);

  if (total < 60) return `${total} min`;

  const hours = Math.floor(total / 60);
  const rest = total % 60;

  if (!rest) return `${hours} h`;
  return `${hours} h ${rest} min`;
};

export default function ServicesSection({ onReserve, onReserveLimitReached }) {
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [bookingStatus, setBookingStatus] = useState({
    canBook: true,
    activeAppointmentsCount: 0,
    maxActiveAppointments: 2,
  });
  const [isLoadingBookingStatus, setIsLoadingBookingStatus] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        setIsLoadingBookingStatus(true);
        setError('');

        const [servicesRes, bookingStatusRes] = await Promise.all([
          fetch('/api/client/services', {
            method: 'GET',
            cache: 'no-store',
          }),
          fetch('/api/client/booking-status', {
            method: 'GET',
            cache: 'no-store',
          }),
        ]);

        const servicesData = await servicesRes.json().catch(() => []);
        const bookingStatusData = await bookingStatusRes.json().catch(() => ({}));

        if (!servicesRes.ok) {
          throw new Error(servicesData?.error || 'No se pudieron cargar los servicios');
        }

        if (!isMounted) return;

        setServices(Array.isArray(servicesData) ? servicesData : []);

        if (bookingStatusRes.ok) {
          setBookingStatus({
            canBook: Boolean(bookingStatusData?.canBook),
            activeAppointmentsCount: Number(bookingStatusData?.activeAppointmentsCount || 0),
            maxActiveAppointments: Number(bookingStatusData?.maxActiveAppointments || 2),
          });
        } else {
          setBookingStatus({
            canBook: true,
            activeAppointmentsCount: 0,
            maxActiveAppointments: 2,
          });
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Error al cargar servicios');
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsLoadingBookingStatus(false);
        }
      }
    };

    fetchInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!services.length) return;

    const elements = Array.from(document.querySelectorAll('[data-service-reveal]'));

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
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px',
      }
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [services]);


  if (isLoading) {
    return (
      <div className={styles.servicesGrid}>
        {Array.from({ length: 3 }).map((_, index) => (
          <article className={`${styles.serviceCard} ${styles.serviceCardSkeleton}`} key={index}>
            <div className={`${styles.serviceCardSkeletonItem} ${styles.serviceCardSkeletonTitle}`} />
            <div className={`${styles.serviceCardSkeletonItem} ${styles.serviceCardSkeletonText}`} />
            <div className={`${styles.serviceCardSkeletonItem} ${styles.serviceCardSkeletonText} ${styles.short}`} />
            <div className={styles.serviceCardFooter}>
              <div className={`${styles.serviceCardSkeletonItem} ${styles.serviceCardSkeletonPrice}`} />
              <div className={`${styles.serviceCardSkeletonItem} ${styles.serviceCardSkeletonButton}`} />
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.servicesState} ${styles.servicesStateError}`}>
        <p>{error}</p>
      </div>
    );
  }

  if (!services.length) {
    return (
      <div className={styles.servicesState}>
        <p>Por el momento no hay servicios disponibles.</p>
      </div>
    );
  }

  return (
    <>
      {/* {!bookingStatus.canBook && (
        <div className={styles.servicesState}>
          <p>
            Ya tienes {bookingStatus.activeAppointmentsCount} reservas activas.
            Debes completar o cancelar una antes de crear otra.
          </p>
        </div>
      )} */}

      <div className={styles.servicesGrid}>
        {services.map((service, index) => (
          <article
            className={`${styles.serviceCard} ${styles.loaded}`}
            key={service.id}
            data-service-reveal
            style={{ '--stagger-order': index }}
          >
            <div className={styles.serviceCardContent}>
              <div className={styles.serviceCardTop}>
                <div
                  className={styles.serviceCardAccent}
                  style={{ backgroundColor: service.color || 'var(--primary)' }}
                />
                <div>
                  <h3 className={styles.serviceCardTitle}>{service.name}</h3>
                  <p className={styles.serviceCardDuration}>
                    {formatDuration(service.durationMinutes)}
                  </p>
                </div>
              </div>

              <p className={styles.serviceCardDescription}>
                {service.description || 'Servicio profesional con atencion personalizada y la experiencia Arkad incluida.'}
              </p>
            </div>

            <div className={styles.serviceCardFooter}>
              <div className={styles.serviceCardPrice}>{formatPrice(service.price)}</div>

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  if (isLoadingBookingStatus) return;

                  if (bookingStatus.canBook) {
                    onReserve?.(service);
                    return;
                  }

                  onReserveLimitReached?.({
                    title: 'Límite alcanzado',
                    message: `Ya tienes ${bookingStatus.activeAppointmentsCount} reservas activas. Debes completar o cancelar una antes de crear otra.`,
                  });
                }}
                title={
                  bookingStatus.canBook
                    ? 'Reservar'
                    : 'Ya alcanzaste el máximo de reservas activas'
                }
              >
                Reservar
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
