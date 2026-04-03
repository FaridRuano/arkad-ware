import Image from "next/image";
import Link from "next/link";
import styles from "./footer.module.scss";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.topGlow} />

      <div className={styles.footerInner}>
        <div className={styles.brand}>
          <Link href="/" className={styles.brandLink}>
            <div className={styles.iconWrap}>
              <Image
                src="/assets/icons/arkad.svg"
                alt="Arkad icon"
                width={48}
                height={49}
                className={styles.logoIcon}
              />
            </div>

            <div className={styles.logoLockup}>
              <div className={styles.logoRule} />
              <div className={styles.logoCenter}>
                <Image
                  src="/assets/icons/logo-arkad.svg"
                  alt="Arkad"
                  width={170}
                  height={48}
                  className={styles.logoWordmark}
                />
                <p>MASTER BARBER EMPIRE</p>
              </div>
              <div className={styles.logoRule} />
            </div>
          </Link>
        </div>

        <div className={styles.cols}>
          <div className={styles.col}>
            <h4>Contacto</h4>
            <a
              className={styles.link}
              href="https://wa.me/+593968844348"
              target="_blank"
              rel="noopener noreferrer"
            >
              +593 96 884 4348
            </a>
          </div>

          <div className={styles.col}>
            <h4>Redes</h4>
            <ul className={styles.list}>
              <li>
                <a
                  className={styles.link}
                  href="https://www.tiktok.com/@arkad1992"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  TikTok
                </a>
              </li>
              <li>
                <a
                  className={styles.link}
                  href="https://www.instagram.com/arkad_barber"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  className={styles.link}
                  href="https://www.facebook.com/profile.php?id=61562071806456"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Facebook
                </a>
              </li>
            </ul>
          </div>

          <div className={styles.col}>
            <h4>Legal</h4>
            <Link
              href="/policies"
              className={styles.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              Políticas y Términos
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.bottom}>
        <span>© {year} Arkad. Todos los derechos reservados.</span>
        <Link href="/" className={styles.link}>
          Inicio
        </Link>
      </div>
    </footer>
  );
}