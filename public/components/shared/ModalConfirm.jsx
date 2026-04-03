'use client'
import React, { useEffect } from 'react'

const ModalConfirm = ({
    mainText,
    active,
    setActive,
    status = false,
    response,
    type = 'confirm',
    title,
}) => {
    useEffect(() => {
        if (!active) return
        if (status) return

        const onKey = (e) => {
            if (e.key === 'Escape') setActive(false)
        }

        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [active, setActive, status])

    if (!active) return null

    const isAlert = type === 'alert'
    const isSuccess = type === 'success'

    const handleClose = () => {
        if (status) return
        setActive(false)
    }

    const handleConfirm = () => {
        if (status) return

        if (isAlert || isSuccess) {
            response?.()
            setActive(false)
            return
        }

        response?.()
    }

    return (
        <div
            className="modalOverlay"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !status) {
                    setActive(false)
                }
            }}
        >
            <div
                className={`modalCard ${isAlert ? 'modalCardAlert' : ''} ${isSuccess ? 'modalCardSuccess' : ''}`}
                style={{ maxWidth: 480 }}
            >
                <header className="modalHeader">
                    <h3
                        className={`modalTitle ${isAlert ? 'modalTitleAlert' : ''} ${isSuccess ? 'modalTitleSuccess' : ''}`}
                    >
                        {title || (isSuccess ? 'Reserva confirmada' : isAlert ? 'Aviso' : 'Confirmación')}
                    </h3>

                    <button
                        type="button"
                        className="modalClose"
                        onClick={handleClose}
                        aria-label="Cerrar"
                        disabled={status}
                    >
                        ✕
                    </button>
                </header>

                <div
                    className={`modalBody ${isAlert ? 'modalBodyAlert' : ''} ${isSuccess ? 'modalBodySuccess' : ''}`}
                    style={{ paddingTop: 24 }}
                >
                    <p style={{ margin: 0, color: 'var(--fg)', lineHeight: 1.5 }}>
                        {mainText}
                    </p>
                </div>

                <footer className="modalFooter">
                    {!isAlert && !isSuccess && (
                        <button
                            type="button"
                            className="__button secondary"
                            onClick={handleClose}
                            disabled={status}
                        >
                            Cancelar
                        </button>
                    )}

                    <button
                        type="button"
                        className={`__button ${isSuccess ? 'success' : isAlert ? 'warning' : 'primary'}`}
                        onClick={handleConfirm}
                        disabled={status}
                    >
                        {status ? 'Procesando...' : isSuccess ? 'Entendido' : isAlert ? 'Aceptar' : 'Confirmar'}
                    </button>
                </footer>
            </div>
        </div>
    )
}

export default ModalConfirm