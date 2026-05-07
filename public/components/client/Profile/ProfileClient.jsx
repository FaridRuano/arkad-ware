"use client";

import Link from "next/link";
import {
    ArrowLeft,
    CalendarClock,
    CalendarDays,
    Clock3,
    CreditCard,
    MapPin,
    Phone,
    ShieldCheck,
    Sparkles,
    UserRound,
} from "lucide-react";
import styles from "./profile-client.module.scss";

const STATUS_LABELS = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    in_progress: "En curso",
    completed: "Completada",
    cancelled: "Cancelada",
    no_assistance: "Inasistencia",
};

const PAYMENT_LABELS = {
    unpaid: "Pendiente de pago",
    paid: "Pagada",
};

const formatDateTime = (value) => {
    if (!value) return "Sin fecha";

    return new Intl.DateTimeFormat("es-EC", {
        weekday: "short",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
};

const formatDate = (value) => {
    if (!value) return "Sin fecha";

    return new Intl.DateTimeFormat("es-EC", {
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date(value));
};

const formatCurrency = (value) =>
    new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
    }).format(Number(value || 0));

export default function ProfileClient({
    user,
    nextAppointment,
    appointmentHistory = [],
}) {
    const fullName =
        [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
        user?.name ||
        "Cliente Arkad";

    return (
        <main className={styles.profilePage}>
            <div className={styles.backgroundGrid} />
            <div className={`${styles.glow} ${styles.glowOne}`} />
            <div className={`${styles.glow} ${styles.glowTwo}`} />
            <div className={`${styles.floatingAction} ${styles.introAction}`}>
                <Link href="/client" className={styles.primaryAction}>
                    <ArrowLeft size={16} className={styles.primaryActionIcon} />
                    <span className={styles.primaryActionText}>Volver al inicio</span>
                </Link>
            </div>

            <section className={`${styles.hero} ${styles.introHero}`}>
                <div className={`${styles.heroCopy} ${styles.introCopy}`}>
                    <div className={styles.badge}>
                        <ShieldCheck size={15} />
                        <span>Perfil del cliente</span>
                    </div>

                    <h1>Tu espacio personal dentro de Arkad</h1>
                    <p>
                        Consulta tu información, revisa tu próxima cita y mantén a la vista
                        el historial completo de tus visitas.
                    </p>
                </div>
            </section>

            <section className={styles.layout}>
                <aside className={`${styles.sidebar} ${styles.introSidebar}`}>
                    <article className={styles.profileCard}>
                        <div className={styles.profileAvatar}>
                            <UserRound size={28} />
                        </div>

                        <div className={styles.profileHeader}>
                            <h2>{fullName}</h2>
                            <span>{user?.email || "Sin correo registrado"}</span>
                        </div>

                        <div className={styles.profileInfo}>
                            <div className={styles.infoRow}>
                                <Phone size={16} />
                                <span>{user?.phone || "Sin teléfono registrado"}</span>
                            </div>
                            <div className={styles.infoRow}>
                                <MapPin size={16} />
                                <span>{user?.address || "Sin dirección registrada"}</span>
                            </div>
                            <div className={styles.infoRow}>
                                <Sparkles size={16} />
                                <span>Cliente desde {formatDate(user?.createdAt)}</span>
                            </div>
                        </div>

                        <div className={styles.profileMeta}>
                            <div className={styles.metaItem}>
                                <small>Cédula</small>
                                <strong>{user?.cedula || "No registrada"}</strong>
                            </div>
                            <div className={styles.metaItem}>
                                <small>Historial</small>
                                <strong>{appointmentHistory.length} citas</strong>
                            </div>
                        </div>
                    </article>
                </aside>

                <div className={styles.mainContent}>
                    <article className={`${styles.nextAppointmentCard} ${styles.introPrimaryCard}`}>
                        <div className={styles.sectionHeader}>
                            <div>
                                <span className={styles.eyebrow}>Próxima cita</span>
                                <h3>Estado actual de tu agenda</h3>
                            </div>
                        </div>

                        {nextAppointment ? (
                            <div className={styles.nextAppointmentBody}>
                                <div className={styles.nextMain}>
                                    <div className={styles.nextIcon}>
                                        <CalendarClock size={22} />
                                    </div>
                                    <div>
                                        <h4>{nextAppointment.serviceName || "Servicio reservado"}</h4>
                                        <p>{formatDateTime(nextAppointment.startAt)}</p>
                                    </div>
                                </div>

                                <div className={styles.nextGrid}>
                                    <div className={styles.detailItem}>
                                        <span>Barbero</span>
                                        <strong>{nextAppointment.barberName || "Por confirmar"}</strong>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span>Estado</span>
                                        <strong>{STATUS_LABELS[nextAppointment.status] || nextAppointment.status}</strong>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span>Duración</span>
                                        <strong>{nextAppointment.durationMinutes || 0} min</strong>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span>Pago</span>
                                        <strong>{PAYMENT_LABELS[nextAppointment.paymentStatus] || nextAppointment.paymentStatus}</strong>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.emptyMain}>
                                <CalendarDays size={20} />
                                <div>
                                    <h4>No tienes citas pendientes</h4>
                                    <p>
                                        Cuando reserves una nueva cita, aquí te mostraremos el
                                        resumen principal de tu próxima visita.
                                    </p>
                                </div>
                            </div>
                        )}
                    </article>

                    <article className={`${styles.historyCard} ${styles.introSecondaryCard}`}>
                        <div className={styles.sectionHeader}>
                            <div>
                                <span className={styles.eyebrow}>Historial</span>
                                <h3>Tus citas registradas</h3>
                            </div>
                        </div>

                        {appointmentHistory.length ? (
                            <div className={styles.historyList}>
                                {appointmentHistory.map((appointment) => (
                                    <article key={appointment.id} className={styles.historyItem}>
                                        <div className={styles.historyPrimary}>
                                            <h4>{appointment.serviceName || "Servicio"}</h4>
                                            <p>{appointment.barberName || "Barbero por confirmar"}</p>
                                        </div>

                                        <div className={styles.historyMeta}>
                                            <div className={styles.historyMetaItem}>
                                                <Clock3 size={15} />
                                                <span>{formatDateTime(appointment.startAt)}</span>
                                            </div>
                                            <div className={styles.historyMetaItem}>
                                                <CreditCard size={15} />
                                                <span>{formatCurrency(appointment.price)}</span>
                                            </div>
                                        </div>

                                        <div className={styles.historyBadges}>
                                            <span className={styles.statusBadge}>
                                                {STATUS_LABELS[appointment.status] || appointment.status}
                                            </span>
                                            <span className={styles.paymentBadge}>
                                                {PAYMENT_LABELS[appointment.paymentStatus] || appointment.paymentStatus}
                                            </span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className={styles.emptyHistory}>
                                <p>Todavía no tienes citas registradas en tu historial.</p>
                            </div>
                        )}
                    </article>
                </div>
            </section>
        </main>
    );
}
