import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__inner">
        {/* Branding */}
        <div className="footer__brand">
          <Link href="/" className="footer__logo">
            <Image
              src="/assets/icons/arkad.svg"
              alt="Arkad logo"
              width={42}
              height={43}
            />
            <Image
              src="/assets/logo-arkad.svg"
              alt="Arkad logo"
              width={150}
              height={43}
            />
          </Link>

          <p className="footer__purpose">
            Master Barber Empire
          </p>
        </div>

        {/* Columns */}
        <div className="footer__cols">
          <div className="footer__col">
            <h4>Contacto</h4>
            <a className="footer__link" href="https://wa.me/+593968844348" target="_blank" rel="noopener noreferrer">
              +593 96 884 4348
            </a>
          </div>

          <div className="footer__col">
            <h4>Redes</h4>
            <ul className="footer__list">
              <li>
                <a
                  className="footer__link"
                  href="https://www.tiktok.com/@arkad1992"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  TikTok
                </a>
              </li>
              <li>
                <a
                  className="footer__link"
                  href="https://www.instagram.com/arkad_barber"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  className="footer__link"
                  href="https://www.facebook.com/profile.php?id=61562071806456"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Facebook
                </a>
              </li>
            </ul>
          </div>

          <div className="footer__col">
            <h4>Legal</h4>
            <Link href="/policies" className="footer__link" target="_blank" rel="noopener noreferrer">
              Políticas y Términos
            </Link>
          </div>
        </div>
      </div>

      <div className="footer__bottom">
        <span>© {year} Arkad. Todos los derechos reservados.</span>
        <Link href="/" className="footer__link">
          Inicio
        </Link>
      </div>
    </footer>
  );
}
