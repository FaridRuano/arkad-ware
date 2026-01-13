'use client'
import Image from '@node_modules/next/image';
import React, { useEffect, useState } from 'react'

const page = () => {

    const [dashboardData, setDashboardData] = useState({
        currentAppointment: null,
        nextAppointment: null,
        todaysAppointments: [],
        latestUsers: []
    });

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

    const currentAppointment = [
        {
            name: 'Carlos Pérez',
            status: 'in progress',
            paymentStatus: 'pay',
            type: 60,
            phone: '+593968844354',
            price: 16,
        },
        {
            name: 'Marco Lozano',
            status: 'in progress',
            paymentStatus: 'pay',
            type: 30,
            phone: '+593968844355',
            price: 8,
        }
    ];

    const nextAppointment = {
        name: 'Farid Ruano',
        phone: '+593968844354',
        time: '10:00 AM',
        type: 30,
        date: '29 de diciembre de 2025',
        paymentStatus: 'unpaid',
    };

    const todaysAppointments = [
        {
            id: "apt-001",
            name: "Carlos Montalvo",
            phone: "593987654321",
            startAt: "2025-12-30T14:00:00.000+00:00", // 09:00 EC
            duration: 60, // Premium
            status: "completed",
            paymentStatus: "paid",
        },
        {
            id: "apt-002",
            name: "Andrés López",
            phone: "593998112233",
            startAt: "2025-12-30T15:00:00.000+00:00", // 10:00 EC
            duration: 30, // Estándar
            status: "completed",
            paymentStatus: "unpaid",
        },
        {
            id: "apt-003",
            name: "Mateo Rivera",
            phone: "593969887744",
            startAt: "2025-12-30T16:00:00.000+00:00", // 11:00 EC
            duration: 60, // Premium
            status: "in-progress",
            paymentStatus: "unpaid",
        },
        {
            id: "apt-004",
            name: "Juan Sebastián Torres",
            phone: "593984556677",
            startAt: "2025-12-30T17:00:00.000+00:00", // 12:00 EC
            duration: 30, // Estándar
            status: "confirmed",
            paymentStatus: "unpaid",
        },
        {
            id: "apt-005",
            name: "Diego Almeida",
            phone: "593972334455",
            startAt: "2025-12-30T18:00:00.000+00:00", // 13:00 EC
            duration: 30, // Estándar
            status: "pending",
            paymentStatus: "unpaid",
        },
    ];

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

    const formatDate = (isoDate) => {
        const d = new Date(isoDate);
        return new Intl.DateTimeFormat("es-EC", {
            timeZone: "America/Guayaquil",
            day: "2-digit",
            month: "short",
        }).format(d);
    };

    const onCancelAppointment = (appointment) => {
        return
    }

    useEffect(() => {

    }, []);

    return (
        <>
            <div className="admin__dashboard">
                <div className="admin__header">
                    <h1>Bienvenido Administrador</h1>
                    <div className='__datetime'>
                        <div className="__date">
                            <span>{currentDate}</span>
                        </div>
                        <div className="__time">
                            <span>{currentTime}</span>
                        </div>
                    </div>
                </div>

                {/* Current Appointment Big Card */}


                {
                    currentAppointment.length > 0 ? (
                        <>
                            {
                                currentAppointment.map((appointment, index) => (
                                    <div key={index} className="admin__card current">

                                        <div className="__header">
                                            <h2>En Curso</h2>
                                            <div className={appointment.type === 60 ? '__type premium' : '__type'}>{appointment.type === 60 ? 'Servicio Premium' : 'Servicio Estandar'}</div>
                                        </div>

                                        <div className="__appointment">
                                            <div className='__name'>
                                                <span>Nombre:</span>
                                                <span>
                                                    <b>
                                                        {appointment.name}
                                                    </b>
                                                </span>
                                            </div>
                                            <div className="__status">
                                                {getStatusBadge(appointment.status)}
                                            </div>
                                        </div>


                                        <div className="__buttons">
                                            <div className="row">
                                                <a
                                                    href={`https://wa.me/${appointment.phone}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="link"
                                                >
                                                    <div className="__button phone">

                                                        <Image
                                                            src="/assets/icons/whastapp.svg"
                                                            alt="Arkad logo"
                                                            width={30}
                                                            height={30}
                                                        />
                                                    </div>
                                                </a>
                                            </div>
                                            <div className="row">
                                                {
                                                    appointment.paymentStatus === 'unpaid' ? (
                                                        <button className="__button unpaid">
                                                            Cobrar
                                                        </button>
                                                    ) : (
                                                        <button className="__button pay">
                                                            Pagado
                                                        </button>
                                                    )
                                                }
                                                <button className="__button primary">
                                                    Completar
                                                </button>
                                                <button className="__button cancel">
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            }
                        </>
                    ) : (
                        <div className="admin__card no-current">

                            <div className="__header">
                                <h2>No hay citas en curso</h2>

                            </div>

                        </div>
                    )
                }




                {/* Next Appointment Big Card */}
                <div className="admin__card next">

                    <div className="__header">
                        <h2>Próxima Cita</h2>
                        <div className={nextAppointment.type === 60 ? '__type premium' : '__type'}>{nextAppointment.type === 60 ? 'Servicio Premium' : 'Servicio Estandar'}</div>

                    </div>

                    <div className="__appointment">
                        <div className='__name'>
                            <span>Nombre:</span>
                            <span>
                                <b>
                                    {nextAppointment.name}
                                </b>
                            </span>
                        </div>
                        <div className='__datetime'>
                            <div className="date">
                                {nextAppointment.date}
                            </div>
                            <div className="time">
                                {nextAppointment.time}
                            </div>
                        </div>
                    </div>

                    <div className="__buttons">
                        <div className="row">
                            <a
                                href={`https://wa.me/${nextAppointment.phone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link"
                            >
                                <div className="__button phone">

                                    <Image
                                        src="/assets/icons/whastapp.svg"
                                        alt="Arkad logo"
                                        width={30}
                                        height={30}
                                    />
                                </div>
                            </a>
                        </div>
                        <div className="row">
                            {
                                nextAppointment.paymentStatus === 'unpaid' ? (
                                    <button className="__button unpaid">
                                        Cobrar
                                    </button>
                                ) : (
                                    <button className="__button pay">
                                        Pagado
                                    </button>
                                )
                            }

                            <button className="__button primary">
                                Iniciar
                            </button>
                            <button className="__button cancel">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Today's Appointments */}
                <div className="today-appointments">
                    <h2>Citas de Hoy</h2>

                    <ul className="appointment-list">
                        {todaysAppointments.length === 0 ? (
                            <li className="appointment-empty">No hay citas para hoy.</li>
                        ) : (
                            todaysAppointments.map((appointment) => (
                                <li key={appointment.id} className="appointment-item">
                                    <div className="appointment-main">
                                        <div className="appointment-name">
                                            {appointment.name}
                                        </div>

                                        <div className="appointment-meta">
                                            <a
                                                href={`https://wa.me/${appointment.phone}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="appointment-phone"
                                            >
                                                {appointment.phone}
                                            </a>

                                            <span>•</span>
                                            <span>{getServiceLabel(appointment.duration)}</span>
                                        </div>
                                    </div>

                                    <div className="appointment-side">
                                        <span className="time-chip">
                                            {formatTime(appointment.startAt)}
                                        </span>

                                        <span
                                            className={`type-chip ${appointment.duration === 60 ? "premium" : "standard"
                                                }`}
                                        >
                                            {appointment.duration} min
                                        </span>
                                        {/* Cancel button */}
                                        <button
                                            className="cancel-btn"
                                            title="Cancelar cita"
                                            onClick={() => onCancelAppointment(appointment)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>

            </div>
        </>
    )
}

export default page