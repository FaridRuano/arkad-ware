'use client';

import { Clock3 } from 'lucide-react';
import styles from './time-selector.module.scss';

export default function TimeSelector({
    slots = [],
    selectedTime = null,
    onSelectTime,
    isLoading = false,
    error = '',
    disabled = false,
}) {
    const hasSlots = Array.isArray(slots) && slots.length > 0;

    return (
        <section className={`${styles.section} ${disabled ? styles.sectionDisabled : ''}`}>
            <div className={styles.heading}>
                <h4>Selecciona el horario</h4>
                <p>
                    Elige una hora disponible para completar tu reserva.
                </p>
            </div>

            {disabled ? (
                <div className={styles.emptyState}>
                    <p>Primero selecciona un día para ver los horarios disponibles.</p>
                </div>
            ) : isLoading ? (
                <div className={styles.grid}>
                    {Array.from({ length: 8 }).map((_, index) => (
                        <div key={index} className={styles.timeCardSkeleton} />
                    ))}
                </div>
            ) : error ? (
                <div className={styles.errorState}>
                    <p>{error}</p>
                </div>
            ) : hasSlots ? (
                <div className={styles.grid}>
                    {slots.map((slot) => {
                        const isActive =
                            selectedTime?.start === slot?.start &&
                            selectedTime?.end === slot?.end;

                        return (
                            <button
                                key={`${slot.start}-${slot.end}`}
                                type="button"
                                className={`${styles.timeCard} ${isActive ? styles.timeCardActive : ''}`}
                                onClick={() => onSelectTime?.(slot)}
                            >
                                <div className={styles.timeCardIcon}>
                                    <Clock3 size={16} />
                                </div>

                                <div className={styles.timeCardContent}>
                                    <strong>{slot.start}</strong>
                                    <span>{slot.end}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className={styles.emptyState}>
                    <p>No hay horarios disponibles para el día seleccionado.</p>
                </div>
            )}
        </section>
    );
}