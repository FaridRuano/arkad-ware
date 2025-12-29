'use client'

import { useEffect, useState } from 'react'

const SECTIONS = [
  { id: "informacion-general", label: "Información general", content: "" },
  { id: "aceptacion-terminos", label: "Aceptación de los términos", content: "" },
  { id: "descripcion-servicio", label: "Descripción del servicio", content: "" },
  { id: "registro-usuarios", label: "Registro de usuarios", content: "" },
  { id: "datos-personales-recopilados", label: "Datos personales recopilados", content: "" },
  { id: "finalidad-tratamiento-datos", label: "Finalidad del tratamiento de datos", content: "" },
  { id: "email-marketing-comunicaciones", label: "Email marketing y comunicaciones", content: "" },
  { id: "uso-cookies", label: "Uso de cookies", content: "" },
  { id: "proteccion-seguridad-datos", label: "Protección y seguridad de la información", content: "" },
  { id: "comparticion-datos-terceros", label: "Compartición de datos con terceros", content: "" },
  { id: "derechos-usuario", label: "Derechos del usuario", content: "" },
  { id: "responsabilidades-usuario", label: "Responsabilidades del usuario", content: "" },
  { id: "cancelaciones-ausencias", label: "Cancelaciones y ausencias", content: "" },
  { id: "limitacion-responsabilidad", label: "Limitación de responsabilidad", content: "" },
  { id: "propiedad-intelectual", label: "Propiedad intelectual", content: "" },
  { id: "modificaciones-terminos", label: "Modificaciones de los términos", content: "" },
  { id: "legislacion-jurisdiccion", label: "Legislación aplicable y jurisdicción", content: "" },
  { id: "informacion-contacto", label: "Información de contacto", content: "" }
];



const page = () => {

  const [activeId, setActiveId] = useState(null);

  const goTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;

    // actualiza el hash sin salto brusco nativo
    history.replaceState(null, "", `#${id}`);

    // centra el elemento en pantalla
    el.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // opcional: setActive inmediato para que no “parpadee”
    setActiveId(id);
  };

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && SECTIONS.some((s) => s.id === hash)) {
      setActiveId(hash);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.find((e) => e.isIntersecting);
        if (entry) setActiveId(entry.target.id);
      },
      {
        root: null,
        // Solo considera "activa" la sección cuando su caja entra al área central
        rootMargin: "-45% 0px -45% 0px",
        threshold: 0,
      }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="policies-page">
      {/* Top Logo */}
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

      {/* Main Content: Two Columns */}
      <div className="policies-container">
        {/* Left: Index/Guide */}
        <aside className="policies-index">
          <h2>Índice</h2>
          <ul>
            {SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <a onClick={(e) => { e.preventDefault(); goTo(id) }} className={activeId === id ? "active" : ""}>{label}</a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Right: Main Content */}
        <main className="policies-content">
          <section id="title">
            <h1>Políticas y Términos de Uso</h1>
            <p className='subtitle'>Última actualización el de 27 de diciembre del 2025. </p>
          </section>
          {SECTIONS.map(({ id, label, content }) => (
            <section key={id} id={id} className="policy-section">
              <h2>{label}</h2>
              <p>{content || "Contenido de ejemplo para la sección de " + label + ". Aquí irán los términos y políticas correspondientes."}</p>
            </section>
          ))}

        </main>
      </div>
      <div className="policies-footer">

      </div>
    </div>
  )
}

export default page