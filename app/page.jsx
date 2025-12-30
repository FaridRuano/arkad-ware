'use client'

import MainPage from '@public/components/public/MainPage'
import AuthModal   from '@public/components/public/AuthModal'
import { useState } from 'react'

const Home = () => {

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  const toggleAuthModal = () => {
    setIsAuthModalOpen(!isAuthModalOpen)
  }

  return (
    <div className="page home">
      {/* Header: marca + líneas */}
      <header className="brand container" onClick={() => setIsAuthModalOpen(false)}>
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
      <main className="container m-b">
        <section className="portal card-portal">
          <MainPage isActive={!isAuthModalOpen} handler={() => toggleAuthModal()} />
          <AuthModal isActive={isAuthModalOpen} handler={() => toggleAuthModal()} />
          {/* Emblema inferior */}
          <div className="emblem" aria-hidden="true">
            {/* Reemplaza por tu isotipo */}
            <img src="/assets/icons/arkad.svg" alt="" />
          </div>
        </section>
      </main>

    </div>
  )
}

export default Home