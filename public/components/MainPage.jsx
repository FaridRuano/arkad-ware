import React from 'react'

const MainPage = ({ isActive = true, handler }) => {

    if (isActive) {
        return (
            <>
                <ul className="social-list stack" aria-label="Redes sociales">
                    <li className="social-item">
                        <a className="social-link" href="https://www.tiktok.com/@arkad1992" target="_blank" rel="noreferrer">
                            <span className="social-icon" aria-hidden="true">
                                {/* Reemplaza por tu ícono */}
                                <img src="/assets/icons/tiktok.svg" alt="" />
                            </span>
                            <span className="social-text">arkad1992</span>
                        </a>
                    </li>

                    <li className="social-item">
                        <a className="social-link" href="https://www.instagram.com/arkad_barber" target="_blank" rel="noreferrer">
                            <span className="social-icon" aria-hidden="true">
                                <img src="/assets/icons/instagram.svg" alt="" />
                            </span>
                            <span className="social-text">arkad_barber</span>
                        </a>
                    </li>

                    <li className="social-item">
                        <a className="social-link" href="https://www.facebook.com/profile.php?id=61562071806456" target="_blank" rel="noreferrer">
                            <span className="social-icon" aria-hidden="true">
                                <img src="/assets/icons/facebook.svg" alt="" />
                            </span>
                            <span className="social-text">ARKAD</span>
                        </a>
                    </li>
                </ul>

                <div className="cta-wrap">
                    <button className="button cta-lg center" onClick={() => handler()}>Agenda una cita</button>
                </div>
            </>
        )
    } else {
        return null
    }
}

export default MainPage