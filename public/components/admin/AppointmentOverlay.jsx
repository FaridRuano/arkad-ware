'use client';
import React from 'react';

const STATUS = {
    PENDING: "pending",
    CONFIRMED: "confirmed",
    IN_PROGRESS: "in_progress",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
    NO_ASSISTANCE: "no_assistance",
};

const STATUS_LABELS = {
    [STATUS.PENDING]: "Pendiente",
    [STATUS.CONFIRMED]: "Confirmado",
    [STATUS.IN_PROGRESS]: "En progreso",
    [STATUS.COMPLETED]: "Completado",
    [STATUS.CANCELLED]: "Cancelado",
    [STATUS.NO_ASSISTANCE]: "No asistió",
};

const STATUS_FLOW = [
    STATUS.PENDING,
    STATUS.CONFIRMED,
    STATUS.IN_PROGRESS,
    STATUS.COMPLETED,
];

const TRANSITIONS = {
    pending: ["confirmed", "no_assistance", "cancelled"],
    confirmed: ["in_progress", "no_assistance", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    no_assistance: [],
    cancelled: [],
};

const ACTIONS_META = {
    confirmed: { label: "Confirmar", variant: "primary" },
    in_progress: { label: "Iniciar", variant: "primary" },
    completed: { label: "Completar", variant: "primary" },
    no_assistance: { label: "No asistió", variant: "ghost" },
    cancelled: { label: "Cancelar cita", variant: "danger" },
};

// Helpers
const buildWhatsAppLink = (phone, message) => {
    const wa = String(phone || '').replace(/[^\d]/g, '');
    if (!wa) return '';

    const clean = String(message || '')
        .normalize('NFC') // 🔥 normaliza unicode correctamente
        .replace(/\r\n/g, '\n')
        .replace(/\u2028|\u2029/g, '\n');

    const text = encodeURIComponent(clean);

    return `https://api.whatsapp.com/send?phone=${wa}&text=${text}`;
};

const formatDateTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('es-EC', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const safeDate = (v) => {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
};

const addMinutes = (date, minutes) => {
    if (!date || !Number.isFinite(minutes)) return null;
    return new Date(date.getTime() + minutes * 60 * 1000);
};

// Busca la ÚLTIMA vez que se cambió a completed/complete
const getCompletedChangedAt = (statusHistory) => {
    if (!Array.isArray(statusHistory) || statusHistory.length === 0) return null;

    for (let i = statusHistory.length - 1; i >= 0; i--) {
        const h = statusHistory[i];
        const to = String(h?.to || '').toLowerCase();
        if ((to === 'completed' || to === 'complete') && h?.changedAt) {
            return safeDate(h.changedAt);
        }
    }
    return null;
};

const buildWaMessageByStatus = ({
    status,
    name,
    serviceType,
    startAt,
    price,
    shareLink,
    formatDateTime,
}) => {
    const client = name ? ` ${name}` : "";
    const service = serviceType || "servicio";
    const when = startAt ? `📅 ${formatDateTime(startAt)}\n` : "";
    const cost = price ? `💵 Valor: $${price}\n` : "";
    const link = shareLink ? `🔗 Detalles: ${shareLink}\n` : "";

    // Cabecera común (puedes ajustarla)
    const base =
        `Hola${client} 👋\n` +
        `Tu cita de *${service}* está registrada.\n` +
        when +
        cost +
        link;

    const footer = `\nSi necesitas reprogramar, escríbenos por aquí.`;

    switch (status) {
        case "pending":
            return (
                base +
                `\n¿Nos confirmas tu asistencia, por favor? 🙌\n` +
                `Estamos a pocas horas de tu cita y queremos asegurarnos de tener todo listo para ti.` +
                footer
            );

        case "confirmed":
            return (
                base +
                `\n¡Gracias por confirmar! ✅\n` +
                `Te esperamos puntualmente. Si surge algún imprevisto, avísanos con tiempo y lo reprogramamos sin problema.` +
                footer
            );

        case "in_progress":
            // vacío como pediste
            return "";

        case "completed":
            return (
                `Hola${client} ✨\n` +
                `¡Gracias por visitarnos! Esperamos que hayas tenido una excelente experiencia 😊\n` +
                `Si te gustó, nos encantaría que nos cuentes cómo te fue o nos dejes tu opinión. ¡Nos ayuda muchísimo!` +
                footer
            );

        case "no_assistance":
            return (
                `Hola${client} 👋\n` +
                `Vimos que hoy no pudiste llegar a tu cita.\n` +
                `No pasa nada — solo te pedimos que, si no vas a poder asistir, nos avises con anticipación para liberar el espacio 🙏\n` +
                `Por ahora lo dejamos como una *advertencia suave* en tu historial (solo para organización).` +
                footer
            );

        case "cancelled":
            return (
                `Hola${client} 👋\n` +
                `Tu cita fue cancelada.\n` +
                `Si deseas reprogramar, dime qué día y hora te queda mejor y lo coordinamos.` +
                footer
            );

        default:
            return base + footer;
    }
};

export default function AppointmentOverlay({
    open,
    appointment,
    onClose,

    // Acciones (tú conectas con tu API)
    onUpdateStatus,
    onTogglePaid,
    onCancel,
}) {

    const panelRef = React.useRef(null);

    React.useEffect(() => {
        if (!open) return;

        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    // Click fuera para cerrar (sin cerrar cuando clickeas dentro)
    const onBackdropMouseDown = (e) => {
        if (panelRef.current && !panelRef.current.contains(e.target)) {
            onClose?.();
        }
    };

    if (!open || !appointment) return null;

    const {
        _id,
        name,
        phone,
        serviceType,
        notes,
        startAt,
        status = 'pending',
        paymentStatus = 'unpaid',
        statusHistory,
        price,
        durationMinutes,
    } = appointment;

    // 1) startDate
    const startDate = safeDate(startAt);

    // 2) endAt (calculado)
    const duration = Number(durationMinutes || 0);
    const endDate = startDate && duration > 0 ? addMinutes(startDate, duration) : null;

    // 3) completedAt (desde statusHistory)
    const completedAt = getCompletedChangedAt(statusHistory);

    // 4) strings listos para UI
    const endAtText = endDate ? formatDateTime(endDate) : '—';
    const completedAtText = completedAt ? formatDateTime(completedAt) : '—';

    const isPaid = paymentStatus === 'paid';

    const flowIndex = STATUS_FLOW.indexOf(status);
    const canAdvance = flowIndex >= 0 && flowIndex < STATUS_FLOW.length - 1;
    const nextStatus = canAdvance ? STATUS_FLOW[flowIndex + 1] : null;

    const isTerminal = status === STATUS.CANCELLED || status === STATUS.NO_ASSISTANCE;

    // Mensaje WhatsApp (incluye link si tú lo tienes en appointment.shareLink o similar)
    const shareLink = appointment.shareLink || appointment.link || '';

    const waMessage = buildWaMessageByStatus({
        status,
        name,
        serviceType,
        startAt,
        price,
        shareLink,
        formatDateTime,
    });

    const waHref = buildWhatsAppLink(phone, waMessage);

    const setStatus = (newStatus) => {
        if (!newStatus || newStatus === status) return;
        onUpdateStatus?.(_id, newStatus);
    };

    const togglePaid = () => {
        onTogglePaid?.(_id, isPaid ? 'unpaid' : 'paid');
    };

    const cancelAppt = () => {
        onCancel?.(_id);
    };

    const allowed = TRANSITIONS[status] || [];
    const isFinal = allowed.length === 0;

    return (
        <div className="apptOverlay" onMouseDown={onBackdropMouseDown} role="dialog" aria-modal="true">
            <div className="apptOverlay__panel" ref={panelRef}>
                <div className="apptOverlay__header">
                    <div className="apptOverlay__titleWrap">
                        <div className="apptOverlay__title">{name || 'Cita'}</div>
                        <div className="apptOverlay__subtitle">
                            <span className={`apptOverlay__pill apptOverlay__pill--status s-${status}`}>
                                {STATUS_LABELS[status] || status}
                            </span>
                            <span className={`apptOverlay__pill apptOverlay__pill--pay ${isPaid ? 'is-paid' : 'is-unpaid'}`}>
                                {isPaid ? 'Pagado' : 'Por cobrar'}
                            </span>
                        </div>
                    </div>

                    <button className="apptOverlay__close" onClick={onClose} type="button" aria-label="Cerrar">
                        ✕
                    </button>
                </div>

                <div className="apptOverlay__body">
                    <div className="apptOverlay__grid">
                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Servicio</div>
                            <div className="apptOverlay__value">{serviceType || '—'}</div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Teléfono</div>
                            <div className="apptOverlay__value">{phone || '—'}</div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Inicio</div>
                            <div className="apptOverlay__value">{startAt ? formatDateTime(startAt) : '—'}</div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Fin</div>
                            <div className="apptOverlay__value">{endAtText}</div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Completado</div>
                            <div className="apptOverlay__value">{completedAtText}</div>
                        </div>

                        <div className="apptOverlay__field">
                            <div className="apptOverlay__label">Valor</div>
                            <div className="apptOverlay__value">{price ? `$${price}` : '—'}</div>
                        </div>

                        <div className="apptOverlay__field apptOverlay__field--full">
                            <div className="apptOverlay__label">Notas</div>
                            <div className="apptOverlay__value apptOverlay__notes">{notes || '—'}</div>
                        </div>
                    </div>

                    <div className="apptOverlay__actions">
                        <div className="apptOverlay__actionsRow">
                            {!isPaid ? (
                                <button
                                    className="btn btn--money"
                                    type="button"
                                    onClick={() => onTogglePaid?.(_id, "paid")}
                                >
                                    Marcar como Pagado
                                </button>
                            ) : (
                                <>
                                    <div className="apptOverlay__paidBadge">
                                        Pagado
                                    </div>

                                    <button
                                        className="btn btn--ghost"
                                        type="button"
                                        onClick={() => onTogglePaid?.(_id, "unpaid")}
                                    >
                                        Revertir a Por cobrar
                                    </button>
                                </>
                            )}

                            <a
                                className={`btn btn--wa ${waHref ? '' : 'is-disabled'}`}
                                href={waHref || undefined}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => { if (!waHref) e.preventDefault(); }}
                            >
                                WhatsApp
                            </a>
                        </div>

                        <div className="apptOverlay__divider" />

                        <div className="apptOverlay__actionsRow apptOverlay__actionsRow--wrap">
                            {isFinal ? (
                                <div className="apptOverlay__finalHint">
                                    Estado final: <b>{STATUS_LABELS[status] || status}</b>
                                </div>
                            ) : (
                                <>
                                    {allowed.map((to) => {
                                        const meta = ACTIONS_META[to] || { label: STATUS_LABELS[to] || to, variant: "ghost" };

                                        const className =
                                            meta.variant === "primary"
                                                ? "btn btn--primary"
                                                : meta.variant === "danger"
                                                    ? "btn btn--danger"
                                                    : "btn btn--ghost";

                                        return (
                                            <button
                                                key={to}
                                                className={className}
                                                type="button"
                                                onClick={() => setStatus(to)}
                                            >
                                                {meta.label}
                                            </button>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}