'use client'
import React, { useEffect } from 'react'

const ModalConfirm = ({
    mainText,
    active,
    setActive,
    response,
    type = 'confirm',
}) => {

    useEffect(() => {
        if (!active) return

        const onKey = (e) => {
            if (e.key === 'Escape') setActive(false)
        }

        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [active, setActive])

    if (!active) return null

    const isAlert = type === 'alert'

    return (
        <div
            className="modalOverlay"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) setActive(false)
            }}
        >
            <div className="modalCard" style={{ maxWidth: 480 }}>
                <header className="modalHeader">
                    <h3 className="modalTitle">
                        Confirmación
                    </h3>

                    <button
                        className="modalClose"
                        onClick={() => setActive(false)}
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                </header>

                <div className="modalBody" style={{ paddingTop: 24 }}>
                    <p style={{ margin: 0, color: 'var(--fg)', lineHeight: 1.5 }}>
                        {mainText}
                    </p>
                </div>

                <footer className="modalFooter">
                    {!isAlert && (
                        <button
                            className="__button secondary"
                            onClick={() => setActive(false)}
                        >
                            Cancelar
                        </button>
                    )}

                    <button
                        className="__button primary"
                        onClick={() => {
                            response?.()
                            setActive(false)
                        }}
                    >
                        Continuar
                    </button>
                </footer>
            </div>
        </div>
    )
}

export default ModalConfirm
