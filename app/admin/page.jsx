'use client'
import Image from '@node_modules/next/image';
import ModalConfirm from '@public/components/shared/ModalConfirm';
import React, { useEffect, useMemo, useState } from 'react'

const TZ = "America/Guayaquil";

// helpers
const formatTimeEC = (iso) =>
    new Intl.DateTimeFormat("es-EC", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    }).format(new Date(iso));

const formatDateEC = (iso) =>
    new Intl.DateTimeFormat("es-EC", {
        timeZone: TZ,
        day: "2-digit",
        month: "long",
        year: "numeric",
    }).format(new Date(iso));

const page = () => {

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");


    // Static data for demonstration
    const currentDate = new Date().toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const currentTime = new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // ✅ fuente única: TODAS las citas de hoy
    const [todaysAppointments, setTodaysAppointments] = useState([]);


    // ✅ derivadas
    const currentAppointments = useMemo(() => {
        return todaysAppointments.filter((a) => a.status === "in progress");
    }, [todaysAppointments]);


    // ✅ pendientes
    const pendingAppointments = Array.isArray(todaysAppointments)
        ? todaysAppointments.filter(a => a?.status === "pending")
        : [];

    const nextAppointment = useMemo(() => {
        const now = Date.now();

        // próxima: pending/confirmed con startAt en el futuro
        const next = todaysAppointments
            .filter(
                (a) =>
                    (a.status === "pending" || a.status === "confirmed") &&
                    new Date(a.startAt).getTime() >= now
            )
            .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))[0];

        if (!next) return null;

        return {
            name: next.name,
            phone: next.phone,
            time: formatTimeEC(next.startAt),
            type: next.durationMinutes,
            date: formatDateEC(next.startAt),
            paymentStatus: next.paymentStatus,
            price: next.price,
            id: next.id,
            status: next.status,
            startAt: next.startAt,
        };
    }, [todaysAppointments]);

    async function fetchTodayAppointments() {
        setError("");

        try {
            // ✅ ejemplo: trae las citas del día ya en orden
            const res = await fetch("/api/admin/appointments/today", {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
            });

            const data = await res.json();

            if (!res.ok || !data?.ok) {
                throw new Error(data?.message || "No se pudo cargar la agenda");
            }

            // data.appointments debería venir normalizada:
            // [{ id, name, phone, startAt, durationMinutes, status, paymentStatus, price }]
            setTodaysAppointments(Array.isArray(data.appointments) ? data.appointments : []);
        } catch (e) {
            setError(e.message || "Error inesperado");
            setTodaysAppointments([]);
        } finally {
            setLoading(false);
        }
    }

    /* Confirm Modal */

    const [confirmModalText, setConfirmModalText] = useState('');
    const [confirmModal, setConfirmModal] = useState(false);

    const [modalAppointment, setModalAppointment] = useState(null)

    const handleConfirmModal = (appointment) => {
        setModalAppointment(appointment)

        setConfirmModalText(`¿Estás seguro de que quieres cancelar esta cita?`)
        setConfirmModal(current => !current)
    }


    async function updateAppointmentStatus(appointment, action, reason = "") {
        if (!appointment?.id) return;
        setLoading(true);
        try {
            const res = await fetch("/api/admin/appointments/status", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ id: appointment.id, action, reason }),
            });

            const data = await res.json();

            if (!res.ok || !data?.ok) {
                throw new Error(data?.message || "No se pudo actualizar la cita");
            }

            // 🔄 refrescar agenda
            fetchTodayAppointments();
        } catch (error) {
            console.error("Update appointment status error:", error);
            alert(error.message || "Error al actualizar la cita");
        }
    }

    const responseConfirmModal = async () => {
        updateAppointmentStatus(modalAppointment, 'cancel')
        setConfirmModal(current => !current)
    }

    async function markAppointmentAsPaid(appointment) {
        if (!appointment?.id) return;
        setLoading(true);

        try {
            const res = await fetch("/api/admin/appointments/payment", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id: appointment.id,
                    method: "cash", // opcional: cash | transfer | card
                }),
            });

            const data = await res.json();

            if (!res.ok || !data?.ok) {
                throw new Error(data?.message || "No se pudo registrar el pago");
            }

            // 🔄 refrescar agenda
            fetchTodayAppointments();
        } catch (error) {
            console.error("Mark as paid error:", error);
            alert(error.message || "Error al cobrar");
        }
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending':
                return (
                    <span className="status-badge pending">
                        <i className="status-dot" />
                        Pendiente
                    </span>
                );

            case 'confirmed':
                return (
                    <span className="status-badge confirmed">
                        <i className="status-dot" />
                        Confirmado
                    </span>
                );

            case 'in progress':
                return (
                    <span className="status-badge in-progress">
                        <i className="status-dot" />
                        En progreso
                    </span>
                );

            case 'completed':
                return (
                    <span className="status-badge completed">
                        <i className="status-dot" />
                        Completado
                    </span>
                );

            case 'cancelled':
                return (
                    <span className="status-badge cancelled">
                        <i className="status-dot" />
                        Cancelado
                    </span>
                );

            case 'no assistance':
                return (
                    <span className="status-badge no-assistance">
                        <i className="status-dot" />
                        No asistió
                    </span>
                );

            default:
                return (
                    <span className="status-badge unknown">
                        <i className="status-dot" />
                        Desconocido
                    </span>
                );
        }
    };

    const getServiceLabel = (duration) => {
        if (duration === 60) return "Premium";
        if (duration === 30) return "Estándar";
        return "Servicio";
    };

    const formatTime = (isoDate) => {
        if (!isoDate) return "--:--";
        const d = new Date(isoDate);
        if (isNaN(d.getTime())) return "--:--";

        return new Intl.DateTimeFormat("es-EC", {
            timeZone: "America/Guayaquil",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        }).format(d);
    };

    const onCancelAppointment = (appointment) => {


        return
    }

    useEffect(() => {
        fetchTodayAppointments();

        // opcional: refrescar cada 30s
        const id = setInterval(fetchTodayAppointments, 30000);
        return () => clearInterval(id);
    }, []);

    if (loading) {
        return (
            <div className='client-dashboard loading'>
                <div className="spinner" aria-hidden="true"></div>
            </div>
        )
    }

    return (
        <>
            <ModalConfirm mainText={confirmModalText} active={confirmModal} setActive={handleConfirmModal} response={responseConfirmModal} />

            <div className="admin__dashboard">
                <div className="admin__header">
                    <h1>Bienvenido Administrador</h1>
                    <div className="__datetime">
                        <div className="__date">
                            <span>{currentDate ?? "—"}</span>
                        </div>
                        <div className="__time">
                            <span>{currentTime ?? "—"}</span>
                        </div>
                    </div>
                </div>

                {/* Current Appointment Big Card */}
                {Array.isArray(currentAppointments) && currentAppointments.length > 0 ? (
                    <>
                        {currentAppointments.map((appointment, index) => {
                            const minutes = appointment?.type ?? appointment?.durationMinutes ?? 0;
                            const isPremium = minutes === 60;

                            return (
                                <div key={appointment?.id ?? index} className="admin__card current">
                                    <div className="__header">
                                        <h2>En Curso</h2>
                                        <div className={isPremium ? "__type premium" : "__type"}>
                                            {isPremium ? "Servicio Premium" : "Servicio Estandar"}
                                        </div>
                                    </div>

                                    <div className="__appointment">
                                        <div className="__name">
                                            <span>Nombre:</span>
                                            <span>
                                                <b>{appointment?.name ?? "—"}</b>
                                            </span>
                                        </div>

                                        <div className="__status">
                                            {appointment?.status ? getStatusBadge(appointment.status) : null}
                                        </div>
                                    </div>

                                    <div className="__buttons">
                                        <div className="row">
                                            {appointment?.phone ? (
                                                <a
                                                    href={`https://wa.me/${appointment.phone}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="link"
                                                >
                                                    <div className="__button phone">
                                                        <Image
                                                            src="/assets/icons/whastapp.svg"
                                                            alt="WhatsApp"
                                                            width={30}
                                                            height={30}
                                                        />
                                                    </div>
                                                </a>
                                            ) : (
                                                <div className="__button phone disabled" title="Sin teléfono">
                                                    <Image
                                                        src="/assets/icons/whastapp.svg"
                                                        alt="WhatsApp"
                                                        width={30}
                                                        height={30}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="row">
                                            {appointment?.paymentStatus === "unpaid" ? (
                                                <button
                                                    className="__button unpaid"
                                                    onClick={() => markAppointmentAsPaid(appointment)}
                                                >
                                                    Cobrar
                                                </button>
                                            ) : (
                                                <button className="__button pay">Pagado</button>
                                            )}

                                            <button
                                                className="__button primary"
                                                onClick={() => updateAppointmentStatus(appointment, "complete")}
                                            >
                                                Completar
                                            </button>
                                            <button className="__button cancel">Cancelar</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </>
                ) : (
                    <div className="admin__card no-current">
                        <div className="__header">
                            <h2>No hay citas en curso</h2>
                        </div>
                    </div>
                )}

                {/* Next Appointment Big Card */}
                {nextAppointment ? (
                    <div className="admin__card next">
                        <div className="__header">
                            <h2>Próxima Cita</h2>

                            {(() => {
                                const minutes =
                                    nextAppointment?.type ?? nextAppointment?.durationMinutes ?? 0;
                                const isPremium = minutes === 60;

                                return (
                                    <div className={isPremium ? "__type premium" : "__type"}>
                                        {isPremium ? "Servicio Premium" : "Servicio Estandar"}
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="__appointment">
                            <div className="__name">
                                <span>Nombre:</span>
                                <span>
                                    <b>{nextAppointment?.name ?? "—"}</b>
                                </span>
                            </div>

                            <div className="__datetime">
                                <div className="date">{nextAppointment?.date ?? "—"}</div>
                                <div className="time">{nextAppointment?.time ?? "—"}</div>
                            </div>
                        </div>

                        <div className="__buttons">
                            <div className="row">
                                {nextAppointment?.phone ? (
                                    <a
                                        href={`https://wa.me/${nextAppointment.phone}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="link"
                                    >
                                        <div className="__button phone">
                                            <Image
                                                src="/assets/icons/whastapp.svg"
                                                alt="WhatsApp"
                                                width={30}
                                                height={30}
                                            />
                                        </div>
                                    </a>
                                ) : (
                                    <div className="__button phone disabled" title="Sin teléfono">
                                        <Image
                                            src="/assets/icons/whastapp.svg"
                                            alt="WhatsApp"
                                            width={30}
                                            height={30}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="row">
                                {nextAppointment?.paymentStatus === "unpaid" ? (
                                    <button
                                        className="__button unpaid"
                                        onClick={() => markAppointmentAsPaid(nextAppointment)}
                                    >
                                        Cobrar
                                    </button>
                                ) : (
                                    <button className="__button pay">Pagado</button>
                                )}

                                <button
                                    className="__button primary"
                                    onClick={() => updateAppointmentStatus(nextAppointment, "start")}
                                >
                                    Iniciar
                                </button>
                                <button
                                    className="__button no-assis"
                                    onClick={() => updateAppointmentStatus(nextAppointment, "no_assistance")}
                                >
                                    No asistió
                                </button>
                                <button
                                    className="__button cancel"
                                    onClick={() => handleConfirmModal(nextAppointment)}
                                >
                                    X
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="admin__card no-next">
                        <div className="__header">
                            <h2>No hay próxima cita</h2>
                        </div>
                    </div>

                )}

                {/* Today's Appointments */}
                <div className="today-appointments">
                    <h2>Citas de Hoy</h2>

                    <ul className="appointment-list">
                        {!Array.isArray(pendingAppointments) || pendingAppointments.length === 0 ? (
                            <li className="appointment-empty">No hay citas para hoy</li>
                        ) : (
                            pendingAppointments.map((appointment) => {
                                const minutes =
                                    appointment?.duration ?? appointment?.durationMinutes ?? 0;

                                return (
                                    <li
                                        key={appointment?.id ?? appointment?._id ?? crypto.randomUUID()}
                                        className="appointment-item"
                                    >
                                        <div className="appointment-main">
                                            <div className="appointment-name">
                                                {appointment?.name ?? "—"}
                                            </div>

                                            <div className="appointment-meta">
                                                {appointment?.phone ? (
                                                    <a
                                                        href={`https://wa.me/${appointment.phone}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="appointment-phone"
                                                    >
                                                        {appointment.phone}
                                                    </a>
                                                ) : (
                                                    <span className="appointment-phone muted">Sin teléfono</span>
                                                )}

                                                <span>•</span>
                                                <span>{getServiceLabel(minutes)}</span>
                                            </div>
                                        </div>

                                        <div className="appointment-side">
                                            <span className="time-chip">
                                                {appointment?.startAt ? formatTime(appointment.startAt) : "—"}
                                            </span>

                                            <span
                                                className={`type-chip ${minutes === 60 ? "premium" : "standard"
                                                    }`}
                                            >
                                                {minutes} min
                                            </span>

                                            <button
                                                className="cancel-btn"
                                                title="Cancelar cita"
                                                onClick={() => handleConfirmModal(appointment)}
                                                disabled={!appointment?.id}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            </div>
        </>

    )
}

export default page