'use client';

import { Scissors, CalendarDays, Clock3, Dot, SeparatorVertical, SeparatorVerticalIcon, FlipVertical, LineChart, Tag } from 'lucide-react';
import styles from './booking-summary-card.module.scss';

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

export default function BookingSummaryCard({
    service,
    selectedBarber,
    selectedDate,
    selectedTime,
}) {
    console.log(service)
    return (
        <aside className={styles.card}>
            <div className={styles.topRow}>
                <div className={styles.summaryTittle}>
                    <div className={styles.title}>
                        Nueva Reserva
                    </div>
                </div>
            </div>

            <div className={styles.selectionList}>
                <div className={styles.selectionItem}>
                    <div className={styles.iconWrap}>
                        <Tag size={14} />
                    </div>
                    <div className={styles.selectionText}>
                        <small>Servicio</small>
                        <span>{service?.name || 'Pendiente'}</span>
                    </div>
                </div>
                <div className={styles.selectionItem}>
                    <div className={styles.iconWrap}>
                        <Scissors size={14} />
                    </div>
                    <div className={styles.selectionText}>
                        <small>Barbero</small>
                        <span>{selectedBarber?.name || 'Pendiente'}</span>
                    </div>
                </div>

                <div className={styles.selectionItem}>
                    <div className={styles.iconWrap}>
                        <CalendarDays size={14} />
                    </div>
                    <div className={styles.selectionText}>
                        <small>Día</small>
                        <span>{selectedDate || 'Pendiente'}</span>
                    </div>
                </div>

                <div className={styles.selectionItem}>
                    <div className={styles.iconWrap}>
                        <Clock3 size={14} />
                    </div>
                    <div className={styles.selectionText}>
                        <small>Hora</small>
                        <span>
                            {selectedTime?.start
                                ? `${selectedTime.start} - ${selectedTime.end}`
                                : 'Pendiente'}
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
}