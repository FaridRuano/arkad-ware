import React from 'react'

const page = () => {

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

    const currentAppointment = {
        name: 'Carlos Pérez',
        status: 'in progress',
        type: 60
    };

    const nextAppointment = {
        name: 'Farid Ruano',
        phone: '+593968844354',
        time: '10:00 AM',
        type: 'Servicio Premium',
        date: '29 de diciembre de 2025'
    };

    const todaysAppointments = [
        { name: 'Jane Smith', phone: '+593968844355', time: '11:00 AM', type: 'Tratamiento' },
        { name: 'Bob Johnson', phone: '+593968844356', time: '2:00 PM', type: 'Seguimiento' },
        { name: 'Alice Brown', phone: '+593968844357', time: '4:00 PM', type: 'Consulta' }
    ];

    const latestUsers = [
        { name: 'Emma Wilson', phone: '+593968844349', registered: '28 dic 2025' },
        { name: 'Michael Davis', phone: '+593968844350', registered: '27 dic 2025' },
        { name: 'Sarah Garcia', phone: '+593968844351', registered: '26 dic 2025' },
        { name: 'David Lee', phone: '+593968844352', registered: '25 dic 2025' },
        { name: 'Lisa Chen', phone: '+593968844353', registered: '24 dic 2025' }
    ];

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
                <div className="admin__card current">

                    <div className="__header">
                        <h2>En Curso</h2>
                    </div>

                    <div className="__appointment">
                        <div className='__name'>
                            {currentAppointment.name}
                        </div>
                        <div className="__status">
                            En Progreso
                        </div>
                    </div>

                    <div className={nextAppointment.type === 'Servicio Premium' ? '__type premium' : '__type'}>{nextAppointment.type}</div>

                    <div className="__buttons">
                        <a href={`https://wa.me/${nextAppointment.phone}`} target="_blank" rel="noopener noreferrer" className="link">
                            <div className='__button phone'>
                                📞{nextAppointment.phone}
                            </div>
                        </a>
                        <div className='__button'>Finalizar</div>
                        <div className='__button cancel'>Cancelar</div>
                    </div>
                </div>


                {/* Next Appointment Big Card */}
                <div className="admin__card">

                    <div className="__header">
                        <h2>Próxima Cita</h2>
                    </div>

                    <div className="__appointment">
                        <div className='__name'>
                            {nextAppointment.name}
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

                    <div className={nextAppointment.type === 'Servicio Premium' ? '__type premium' : '__type'}>{nextAppointment.type}</div>

                    <div className="__buttons">
                        <a href={`https://wa.me/${nextAppointment.phone}`} target="_blank" rel="noopener noreferrer" className="link">
                            <div className='__button phone'>
                                📞{nextAppointment.phone}
                            </div>
                        </a>
                        <div className='__button'>Finalizar</div>
                        <div className='__button cancel'>Cancelar</div>
                    </div>
                </div>

                {/* Today's Appointments */}
                <div style={{ marginBottom: '30px' }}>
                    <h2>Citas de Hoy</h2>
                    <ul className="appointment-list" style={{ listStyleType: 'none', padding: 0 }}>
                        {todaysAppointments.map((appointment, index) => (
                            <li key={index}>
                                <strong>{appointment.patient}</strong> (<a href={`https://wa.me/${appointment.phone}`} target="_blank" rel="noopener noreferrer" className="link">{appointment.phone}</a>) - {appointment.time} - {appointment.type}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Latest Users Table */}
                <div>
                    <h2>Últimos 5 Usuarios Registrados</h2>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Teléfono</th>
                                <th>Registrado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {latestUsers.map((user, index) => (
                                <tr key={index}>
                                    <td>{user.name}</td>
                                    <td>
                                        <a href={`https://wa.me/${user.phone}`} target="_blank" rel="noopener noreferrer" className="link">
                                            {user.phone}
                                        </a>
                                    </td>
                                    <td>{user.registered}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    )
}

export default page