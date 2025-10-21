'use client'
import { useRouter } from '@node_modules/next/navigation';
import React, { useEffect, useRef, useState } from 'react'

const ClientHeader = () => {

    const router = useRouter();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null)

    // Detectar click fuera del menú
    useEffect(() => {
        function handleClickOutside(event) {
            // Si el click fue fuera del menú, lo cerramos
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false)
            }
        }

        // Agregamos el listener cuando el menú está abierto
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        // Lo eliminamos cuando se cierra o desmonta
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isMenuOpen])

    return (
        <div className="client-header">
            <div className="header-container">
                <div className="header-container__logo" onClick={() => router.push('/client')}>
                    <img src="/assets/icons/arkad.svg" alt="ARKAD" />
                </div>
                <div className="header-container__menu" ref={menuRef}>
                    <button className="menu-button" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        <span className="menu-button__name">Farid Ruano</span>
                        <span className="menu-button__icon">▼</span>
                    </button>

                    <div className={"menu-dropdown" + (isMenuOpen ? " active" : "")}>
                        <ul className="menu-dropdown__list">
                            <li className="menu-dropdown__item">
                                <button className="menu-dropdown__button">Ver perfil</button>
                            </li>
                            <li className="menu-dropdown__item" onClick={() => router.push('/')}>
                                <button className="menu-dropdown__button negative">Cerrar sesión</button>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ClientHeader