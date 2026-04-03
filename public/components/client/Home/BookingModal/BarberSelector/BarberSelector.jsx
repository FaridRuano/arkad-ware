'use client';

import { Scissors } from 'lucide-react';
import styles from './barber-selector.module.scss';

export default function BarberSelector({
    barbers = [],
    selectedBarber = null,
    onSelectBarber,
}) {
    const hasBarbers = Array.isArray(barbers) && barbers.length > 0;

    return (
        <section className={styles.section}>
            <div className={styles.heading}>
                <h4>Selecciona tu barbero</h4>
                <p>
                    Elige el profesional con quien deseas agendar este servicio.
                </p>
            </div>

            {hasBarbers ? (
                <div className={styles.grid}>
                    {barbers.map((barber) => {
                        const barberId = barber?.id || barber?._id;
                        const selectedId = selectedBarber?.id || selectedBarber?._id;
                        const isActive = String(barberId) === String(selectedId);

                        return (
                            <button
                                key={barberId}
                                type="button"
                                className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
                                onClick={() => onSelectBarber?.(barber)}
                            >
                                <div
                                    className={styles.accent}
                                    style={{
                                        backgroundColor: isActive ? 'var(--primary)' : (barber?.color || 'var(--primary)')
                                    }}
                                />

                                <div className={styles.cardContent}>
                                    <div className={styles.icon}>
                                        <Scissors size={16} />
                                    </div>

                                    <div className={styles.texts}>
                                        <h5>{barber?.name || 'Barbero'}</h5>
                                        <span>
                                            {isActive
                                                ? 'Seleccionado'
                                                : 'Disponible para este servicio'}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className={styles.emptyState}>
                    <p>
                        Este servicio todavía no tiene barberos disponibles para selección.
                    </p>
                </div>
            )}
        </section>
    );
}