'use client';

export default function BookingModal({ isOpen, onClose, service }) {
    if (!isOpen) return null;

    return (
        <div className="booking-modal" onClick={onClose}>
            <div
                className="booking-modal__dialog"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    className="booking-modal__close"
                    onClick={onClose}
                    aria-label="Cerrar"
                >
                    ×
                </button>

                <div className="booking-modal__header">
                    <span className="booking-modal__eyebrow">Reserva</span>
                    <h3 className="booking-modal__title">
                        {service?.name || 'Nueva cita'}
                    </h3>
                    <p className="booking-modal__text">
                        Aquí colocaremos el formulario de reserva en el siguiente paso.
                    </p>
                </div>

                {service ? (
                    <div className="booking-modal__service">
                        <p>
                            <strong>Servicio:</strong> {service.name}
                        </p>
                        <p>
                            <strong>Duración:</strong> {service.durationMinutes} min
                        </p>
                        <p>
                            <strong>Precio:</strong> ${Number(service.price || 0).toFixed(2)}
                        </p>
                    </div>
                ) : null}
            </div>
        </div>
    );
}