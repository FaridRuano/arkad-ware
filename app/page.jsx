import React from 'react'

const Home = () => {
  return (
    <div className="page home">
      {/* Header: marca + líneas */}
      <header className="brand container">
        <div className="brand__row">
          <span aria-hidden="true" className="brand__line" />
          <div className="brand__lockup" role="img" aria-label="ARKAD — Master Barber Empire">
            {/* Reemplaza por tu wordmark */}
            <img src="/assets/logo-arkad.svg" alt="ARKAD" className="brand__logo" />
            <div className="brand__subtitle">Master Barber Empire</div>
          </div>
          <span aria-hidden="true" className="brand__line" />
        </div>
      </header>

      {/* Main: tarjeta con enlaces y CTA */}
      <main className="container">
        <section className="portal card-portal">
          <ul className="social-list stack" aria-label="Redes sociales">
            <li className="social-item">
              <a className="social-link" href="https://www.tiktok.com/@arkad1992" target="_blank" rel="noreferrer">
                <span className="social-icon" aria-hidden="true">
                  {/* Reemplaza por tu ícono */}
                  <img src="/assets/icons/facebook.svg" alt="" />
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
                  <img src="/assets/icons/tiktok.svg" alt="" />
                </span>
                <span className="social-text">ARKAD</span>
              </a>
            </li>
          </ul>

          <div className="cta-wrap">
            <a className="button cta-lg" href="/reservas">Agenda una cita</a>
          </div>

          {/* Emblema inferior */}
          <div className="emblem" aria-hidden="true">
            {/* Reemplaza por tu isotipo */}
            <img src="/assets/logo-mark.svg" alt="" />
          </div>
        </section>
      </main>

      <footer className="container page-warp" />
    </div>
  )
}

export default Home