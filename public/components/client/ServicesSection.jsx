'use client';

import { useEffect, useState } from 'react';

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

export default function ServicesSection({ onReserve }) {
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchServices = async () => {
      try {
        setIsLoading(true);
        setError('');

        const res = await fetch('/api/client/services', {
          method: 'GET',
          cache: 'no-store',
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || 'No se pudieron cargar los servicios');
        }

        if (!isMounted) return;
        setServices(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Error al cargar servicios');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchServices();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="services-grid">
        {Array.from({ length: 3 }).map((_, index) => (
          <article className="service-card service-card--skeleton" key={index}>
            <div className="service-card__skeleton service-card__skeleton--title" />
            <div className="service-card__skeleton service-card__skeleton--text" />
            <div className="service-card__skeleton service-card__skeleton--text short" />
            <div className="service-card__footer">
              <div className="service-card__skeleton service-card__skeleton--price" />
              <div className="service-card__skeleton service-card__skeleton--button" />
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="services-state services-state--error">
        <p>{error}</p>
      </div>
    );
  }

  if (!services.length) {
    return (
      <div className="services-state">
        <p>Por el momento no hay servicios disponibles.</p>
      </div>
    );
  }

  return (
    <div className="services-grid">
      {services.map((service) => (
        <article className="service-card" key={service.id}>
          <div className="service-card__content">
            <div className="service-card__top">
              <div
                className="service-card__accent"
                style={{ backgroundColor: service.color || '#CFB690' }}
              />
              <div>
                <h3 className="service-card__title">{service.name}</h3>
                <p className="service-card__duration">
                  {formatDuration(service.durationMinutes)}
                </p>
              </div>
            </div>

            <p className="service-card__description">
              {service.description || 'Servicio profesional con atención personalizada.'}
            </p>
          </div>

          <div className="service-card__footer">
            <div className="service-card__price">{formatPrice(service.price)}</div>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => onReserve?.(service)}
            >
              Reservar
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}