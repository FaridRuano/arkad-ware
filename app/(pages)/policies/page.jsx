'use client'

import { useEffect, useState } from 'react'

const SECTIONS = [
  {
    id: "informacion-general",
    label: "Información general",
    content: (
      <>
        <p>
          La presente aplicación web es una plataforma digital destinada a la
          gestión de citas para servicios de estética personal, tales como corte
          de cabello, barba, cejas y servicios relacionados.
        </p>
        <p>
          El servicio está orientado al público en general bajo un modelo B2C y
          opera principalmente en la ciudad de Ambato, Ecuador.
        </p>
        <p>
          El acceso y uso de la aplicación implica la aceptación plena de los
          presentes Términos y Condiciones y de la Política de Privacidad aquí
          descrita.
        </p>
      </>
    )
  },
  {
    id: "aceptacion-terminos",
    label: "Aceptación de los términos",
    content: (
      <>
        <p>
          Al registrarse, acceder o utilizar esta aplicación, el usuario declara
          haber leído, comprendido y aceptado estos Términos y Condiciones.
        </p>
        <p>
          Si el usuario no está de acuerdo con alguno de los puntos aquí
          establecidos, deberá abstenerse de utilizar la plataforma.
        </p>
      </>
    )
  },
  {
    id: "descripcion-servicio",
    label: "Descripción del servicio",
    content: (
      <>
        <p>La aplicación permite a los usuarios registrados:</p>
        <ul>
          <li>Crear y gestionar una cuenta personal.</li>
          <li>Agendar citas seleccionando fecha, hora y tipo de servicio.</li>
          <li>
            Elegir entre servicios de tipo <strong>Express</strong> y{" "}
            <strong>Premium</strong>.
          </li>
          <li>
            Mantener un historial de citas agendadas, cumplidas, canceladas o
            reprogramadas.
          </li>
        </ul>
        <p>
          La plataforma actúa como un sistema de gestión y organización de citas,
          mas no garantiza la disponibilidad inmediata fuera de los horarios o
          condiciones establecidas por el negocio.
        </p>
      </>
    )
  },
  {
    id: "registro-usuarios",
    label: "Registro de usuarios",
    content: (
      <>
        <p>
          Para acceder a las funcionalidades del sistema, el usuario debe
          registrarse proporcionando información veraz, actualizada y completa.
        </p>
        <p>
          El usuario es responsable de mantener la confidencialidad de sus
          credenciales de acceso y de todas las actividades realizadas desde su
          cuenta.
        </p>
        <p>
          El acceso a la plataforma sin registro está limitado únicamente a la
          visualización de páginas públicas.
        </p>
      </>
    )
  },
  {
    id: "datos-personales-recopilados",
    label: "Datos personales recopilados",
    content: (
      <>
        <p>La aplicación recopila los siguientes datos personales:</p>
        <ul>
          <li>Número de cédula de identidad ecuatoriana.</li>
          <li>Nombres y apellidos.</li>
          <li>Correo electrónico.</li>
          <li>Número telefónico.</li>
          <li>Dirección.</li>
          <li>Contraseña (almacenada de forma cifrada).</li>
        </ul>
        <p>
          Adicionalmente, se recopilan datos técnicos necesarios para el
          funcionamiento de la sesión del usuario mediante sistemas de
          autenticación.
        </p>
      </>
    )
  },
  {
    id: "finalidad-tratamiento-datos",
    label: "Finalidad del tratamiento de datos",
    content: (
      <>
        <p>Los datos personales recopilados se utilizan exclusivamente para:</p>
        <ul>
          <li>Gestionar cuentas de usuario.</li>
          <li>Agendar, confirmar, reprogramar o cancelar citas.</li>
          <li>
            Contactar al usuario ante cualquier novedad relacionada con su cita.
          </li>
          <li>
            Llevar un registro del cumplimiento de citas para mejorar la calidad
            del servicio.
          </li>
        </ul>
        <p>
          Los datos no serán utilizados con fines distintos a los aquí
          descritos.
        </p>
      </>
    )
  },
  {
    id: "email-marketing-comunicaciones",
    label: "Email marketing y comunicaciones",
    content: (
      <>
        <p>
          Actualmente, la aplicación no realiza campañas de email marketing.
        </p>
        <p>El correo electrónico podrá ser utilizado para:</p>
        <ul>
          <li>Recuperación de contraseña.</li>
          <li>Confirmaciones o notificaciones relacionadas con citas.</li>
          <li>
            Comunicaciones operativas necesarias para el correcto funcionamiento
            del servicio.
          </li>
        </ul>
        <p>
          En el futuro, podrían implementarse comunicaciones adicionales, las
          cuales respetarán siempre la normativa vigente.
        </p>
      </>
    )
  },
  {
    id: "uso-cookies",
    label: "Uso de cookies",
    content: (
      <>
        <p>La aplicación utiliza cookies únicamente para:</p>
        <ul>
          <li>Mantener la sesión activa del usuario.</li>
          <li>
            Garantizar el correcto funcionamiento del sistema de autenticación.
          </li>
        </ul>
        <p>
          No se utilizan cookies con fines publicitarios ni de análisis externo.
        </p>
      </>
    )
  },
  {
    id: "proteccion-seguridad-datos",
    label: "Protección y seguridad de la información",
    content: (
      <>
        <p>
          Se implementan medidas técnicas y organizativas razonables para
          proteger la información personal de los usuarios contra accesos no
          autorizados, pérdida, uso indebido o alteración.
        </p>
        <p>
          Las contraseñas son almacenadas de forma cifrada y nunca se guardan en
          texto plano.
        </p>
      </>
    )
  },
  {
    id: "comparticion-datos-terceros",
    label: "Compartición de datos con terceros",
    content: (
      <>
        <p>
          Los datos personales no son vendidos, alquilados ni compartidos con
          terceros, salvo cuando sea estrictamente necesario para el
          funcionamiento técnico de la plataforma o por requerimiento legal.
        </p>
        <p>
          El servicio se apoya en proveedores tecnológicos como servicios de
          hosting y bases de datos.
        </p>
      </>
    )
  },
  {
    id: "derechos-usuario",
    label: "Derechos del usuario",
    content: (
      <>
        <p>El usuario tiene derecho a:</p>
        <ul>
          <li>Acceder a sus datos personales.</li>
          <li>Solicitar la actualización o corrección de su información.</li>
          <li>
            Solicitar la eliminación de su cuenta y datos, salvo obligaciones
            legales.
          </li>
          <li>Conocer cómo se utilizan sus datos.</li>
        </ul>
      </>
    )
  },
  {
    id: "responsabilidades-usuario",
    label: "Responsabilidades del usuario",
    content: (
      <>
        <p>El usuario se compromete a:</p>
        <ul>
          <li>Proporcionar información real y actualizada.</li>
          <li>Utilizar la plataforma de forma responsable.</li>
          <li>
            Respetar los horarios y condiciones de las citas agendadas.
          </li>
          <li>No utilizar la aplicación con fines fraudulentos o indebidos.</li>
        </ul>
        <p>
          El incumplimiento podrá derivar en la suspensión o bloqueo de la
          cuenta.
        </p>
      </>
    )
  },
  {
    id: "cancelaciones-ausencias",
    label: "Cancelaciones y ausencias",
    content: (
      <>
        <p>
          La plataforma lleva un registro del comportamiento del usuario
          respecto a sus citas.
        </p>
        <p>
          Las ausencias reiteradas o cancelaciones sin previo aviso podrán
          afectar la posibilidad de agendar futuras citas.
        </p>
        <p>
          El objetivo de este registro es garantizar una mejor organización y
          calidad del servicio para todos los usuarios.
        </p>
      </>
    )
  },
  {
    id: "limitacion-responsabilidad",
    label: "Limitación de responsabilidad",
    content: (
      <>
        <p>La aplicación no se hace responsable por:</p>
        <ul>
          <li>
            Errores derivados de información incorrecta proporcionada por el
            usuario.
          </li>
          <li>
            Fallos técnicos ajenos al control razonable de la plataforma.
          </li>
          <li>
            Incumplimientos derivados de causas de fuerza mayor.
          </li>
        </ul>
        <p>
          El uso del servicio se realiza bajo responsabilidad del usuario.
        </p>
      </>
    )
  },
  {
    id: "propiedad-intelectual",
    label: "Propiedad intelectual",
    content: (
      <>
        <p>
          Todo el contenido, diseño, estructura y funcionamiento de la
          aplicación es propiedad del titular del servicio.
        </p>
        <p>
          Queda prohibida su reproducción, distribución o uso no autorizado sin
          consentimiento expreso.
        </p>
      </>
    )
  },
  {
    id: "modificaciones-terminos",
    label: "Modificaciones de los términos",
    content: (
      <>
        <p>
          La plataforma se reserva el derecho de modificar estos Términos y
          Condiciones en cualquier momento.
        </p>
        <p>
          Las modificaciones entrarán en vigencia desde su publicación en la
          aplicación.
        </p>
      </>
    )
  },
  {
    id: "legislacion-jurisdiccion",
    label: "Legislación aplicable y jurisdicción",
    content: (
      <>
        <p>
          Estos Términos y Condiciones se rigen por las leyes de la República del
          Ecuador.
        </p>
        <p>
          Cualquier controversia será sometida a los tribunales competentes del
          país.
        </p>
      </>
    )
  },
  {
    id: "informacion-contacto",
    label: "Información de contacto",
    content: (
      <>
        <p>
          Para consultas, solicitudes o reclamos relacionados con estos Términos
          y Condiciones, el usuario podrá comunicarse a través de los canales
          oficiales del negocio.
        </p>
      </>
    )
  }
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
              {content || "Contenido de ejemplo para la sección de " + label + ". Aquí irán los términos y políticas correspondientes."}
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