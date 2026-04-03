'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import styles from './day-selector.module.scss';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const parseDateLocal = (dateStr) => {
    const [y, m, d] = String(dateStr).split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
};

const formatDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const startOfWeek = (date) => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() - copy.getDay());
    return copy;
};

const addDays = (date, amount) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + amount);
    return copy;
};

const isSameDay = (a, b) => formatDateKey(a) === formatDateKey(b);

const getWeekLabel = (weekStart) => {
    const weekEnd = addDays(weekStart, 6);

    const startDay = weekStart.getDate();
    const endDay = weekEnd.getDate();
    const startMonth = MONTH_LABELS[weekStart.getMonth()];
    const endMonth = MONTH_LABELS[weekEnd.getMonth()];

    if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${startDay} - ${endDay} ${endMonth}`;
    }

    return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
};

export default function DaySelector({
    availableDates = [],
    selectedDate = null,
    onSelectDate,
    maxDaysAhead = 30,
    isLoading = false,
    error = '',
    disabled = false,
}) {
    const availableDateMap = useMemo(() => {
        const map = new Map();

        if (!Array.isArray(availableDates)) return map;

        availableDates.forEach((item) => {
            if (item?.date) {
                map.set(item.date, item);
            }
        });

        return map;
    }, [availableDates]);

    const today = useMemo(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    }, []);

    const firstWeek = useMemo(() => startOfWeek(today), [today]);

    const lastAllowedDate = useMemo(() => {
        const limit = new Date(today);
        limit.setDate(limit.getDate() + Math.max(0, Number(maxDaysAhead || 30) - 1));
        limit.setHours(0, 0, 0, 0);
        return limit;
    }, [today, maxDaysAhead]);

    const [visibleWeekStart, setVisibleWeekStart] = useState(firstWeek);

    useEffect(() => {
        setVisibleWeekStart(firstWeek);
    }, [firstWeek, availableDates, disabled]);

    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }).map((_, index) => {
            const current = addDays(visibleWeekStart, index);
            const key = formatDateKey(current);
            const availableInfo = availableDateMap.get(key);

            const isPast = current < today;
            const isBeyondLimit = current > lastAllowedDate;
            const isSelectable = !isPast && !isBeyondLimit && Boolean(availableInfo);

            return {
                key,
                date: current,
                availableInfo,
                isSelectable,
                isPast,
                isBeyondLimit,
                isSelected: selectedDate === key,
            };
        });
    }, [visibleWeekStart, availableDateMap, today, lastAllowedDate, selectedDate]);

    const canGoPrev = visibleWeekStart > firstWeek;
    const canGoNext = addDays(visibleWeekStart, 7) <= lastAllowedDate;

    const handlePrevWeek = () => {
        if (!canGoPrev) return;
        setVisibleWeekStart((prev) => addDays(prev, -7));
    };

    const handleNextWeek = () => {
        if (!canGoNext) return;
        setVisibleWeekStart((prev) => addDays(prev, 7));
    };

    return (
        <section className={`${styles.section} ${disabled ? styles.sectionDisabled : ''}`}>
            <div className={styles.heading}>
                <h4>Selecciona el día</h4>
                <p>
                    Navega por semanas y elige una fecha disponible para tu reserva.
                </p>
            </div>

            {disabled ? (
                <div className={styles.emptyState}>
                    <p>Primero selecciona un barbero para ver los días disponibles.</p>
                </div>
            ) : isLoading ? (
                <div className={styles.weekSkeleton}>
                    {Array.from({ length: 7 }).map((_, index) => (
                        <div key={index} className={styles.dayCardSkeleton} />
                    ))}
                </div>
            ) : error ? (
                <div className={styles.errorState}>
                    <p>{error}</p>
                </div>
            ) : (
                <>
                    <div className={styles.weekNav}>
                        <button
                            type="button"
                            className={styles.navBtn}
                            onClick={handlePrevWeek}
                            disabled={!canGoPrev}
                            aria-label="Semana anterior"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <div className={styles.weekLabel}>
                            <CalendarDays size={16} />
                            <span>{getWeekLabel(visibleWeekStart)}</span>
                        </div>

                        <button
                            type="button"
                            className={styles.navBtn}
                            onClick={handleNextWeek}
                            disabled={!canGoNext}
                            aria-label="Semana siguiente"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className={styles.grid}>
                        {weekDays.map((day) => {
                            const dayDate = day.date;
                            const dayNumber = dayDate.getDate();
                            const dayName = DAY_LABELS[dayDate.getDay()];

                            return (
                                <button
                                    key={day.key}
                                    type="button"
                                    className={`${styles.dayCard} ${day.isSelectable ? styles.dayCardAvailable : ''} ${day.isSelected ? styles.dayCardActive : ''}`}
                                    onClick={() => day.isSelectable && onSelectDate?.(day.key)}
                                    disabled={!day.isSelectable}
                                >
                                    <span className={styles.dayName}>{dayName}</span>
                                    <strong className={styles.dayNumber}>{dayNumber}</strong>
                                    <small className={styles.dayMeta}>
                                        {day.isPast
                                            ? 'Pasado'
                                            : day.isBeyondLimit
                                                ? 'Fuera de rango'
                                                : day.isSelectable
                                                    ? 'Disponible'
                                                    : 'Sin cupos'}
                                    </small>
                                </button>
                            );
                        })}
                    </div>

                    {!availableDates.length && (
                        <div className={styles.emptyState}>
                            <p>No hay fechas disponibles para este barbero por el momento.</p>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}