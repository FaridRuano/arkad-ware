'use client';

import { useMemo, useState } from 'react';

const VIEW_OPTIONS = [
    { key: 'year', label: 'Año' },
    { key: 'month', label: 'Mes' },
    { key: 'week', label: 'Semana' },
    { key: 'day', label: 'Día' },
];

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function parseISOToLocalDate(dateISO) {
    const [year, month, day] = dateISO.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function formatDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function addMonths(date, months) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
}

function addYears(date, years) {
    const next = new Date(date);
    next.setFullYear(next.getFullYear() + years);
    return next;
}

function getStartOfWeek(date) {
    const current = new Date(date);
    const day = current.getDay(); // 0 domingo, 1 lunes...
    const diff = day === 0 ? -6 : 1 - day; // lunes como inicio
    current.setDate(current.getDate() + diff);
    current.setHours(0, 0, 0, 0);
    return current;
}

function getWeekDays(date) {
    const start = getStartOfWeek(date);
    return Array.from({ length: 7 }, (_, index) => {
        const current = addDays(start, index);
        return {
            date: current,
            iso: formatDateISO(current),
            dayNumber: String(current.getDate()).padStart(2, '0'),
            weekdayLabel: WEEKDAY_LABELS[index],
        };
    });
}

function getMonthLabel(date) {
    return new Intl.DateTimeFormat('es-ES', {
        month: 'long',
    }).format(date);
}

function getDayLabel(date) {
    return new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
    }).format(date);
}

function getWeekRangeLabel(date) {
    const weekDays = getWeekDays(date);
    const first = weekDays[0].date;
    const last = weekDays[6].date;

    const sameMonth = first.getMonth() === last.getMonth();
    const sameYear = first.getFullYear() === last.getFullYear();

    const firstDay = String(first.getDate()).padStart(2, '0');
    const lastDay = String(last.getDate()).padStart(2, '0');

    const firstMonth = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(first);
    const lastMonth = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(last);

    if (sameMonth && sameYear) {
        return `${firstDay} - ${lastDay} ${new Intl.DateTimeFormat('es-ES', {
            month: 'long',
            year: 'numeric',
        }).format(last)}`;
    }

    return `${firstDay} ${firstMonth} - ${lastDay} ${lastMonth} ${last.getFullYear()}`;
}

export default function ScheduleDateNavigator({
    dateISO,
    onChangeDate,
}) {
    const [activeView, setActiveView] = useState('day');

    const selectedDate = useMemo(() => parseISOToLocalDate(dateISO), [dateISO]);

    const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

    const summary = useMemo(() => {
        return {
            year: String(selectedDate.getFullYear()),
            month: getMonthLabel(selectedDate),
            week: getWeekRangeLabel(selectedDate),
            day: getDayLabel(selectedDate),
        };
    }, [selectedDate]);

    const moveDate = (direction) => {
        let nextDate = selectedDate;

        if (activeView === 'day') {
            nextDate = addDays(selectedDate, direction);
        }

        if (activeView === 'week') {
            nextDate = addDays(selectedDate, direction * 7);
        }

        if (activeView === 'month') {
            nextDate = addMonths(selectedDate, direction);
        }

        if (activeView === 'year') {
            nextDate = addYears(selectedDate, direction);
        }

        onChangeDate(formatDateISO(nextDate));
    };

    const handleToday = () => {
        onChangeDate(formatDateISO(new Date()));
    };

    return (
        <section className="schedule-date-navigator">
            <div className="schedule-date-navigator__top">
                <div className="schedule-date-navigator__views">
                    {VIEW_OPTIONS.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            className={`schedule-date-navigator__view-btn ${activeView === option.key ? 'is-active' : ''
                                }`}
                            onClick={() => setActiveView(option.key)}
                        >
                            <span className="schedule-date-navigator__view-label">
                                {option.label}
                            </span>
                            <span className="schedule-date-navigator__view-value">
                                {summary[option.key]}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="schedule-date-navigator__actions">
                    <button
                        type="button"
                        className="schedule-date-navigator__arrow"
                        onClick={() => moveDate(-1)}
                        aria-label="Anterior"
                    >
                        ‹
                    </button>

                    <button
                        type="button"
                        className="schedule-date-navigator__today"
                        onClick={handleToday}
                    >
                        Hoy
                    </button>

                    <button
                        type="button"
                        className="schedule-date-navigator__arrow"
                        onClick={() => moveDate(1)}
                        aria-label="Siguiente"
                    >
                        ›
                    </button>
                </div>
            </div>

            <div className="schedule-date-navigator__week">
                {weekDays.map((day) => {
                    const isSelected = day.iso === dateISO;

                    return (
                        <button
                            key={day.iso}
                            type="button"
                            className={`schedule-date-navigator__day ${isSelected ? 'is-selected' : ''
                                }`}
                            onClick={() => onChangeDate(day.iso)}
                        >
                            <span className="schedule-date-navigator__day-weekday">
                                {day.weekdayLabel}
                            </span>
                            <span className="schedule-date-navigator__day-number">
                                {day.dayNumber}
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}