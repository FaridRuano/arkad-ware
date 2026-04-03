"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import {
    LockKeyhole,
    Mail,
    ArrowRight,
    ShieldCheck,
    Facebook,
    Instagram,
    MapPin,
} from "lucide-react";
import styles from "./login-client.module.scss";

export default function LoginClient() {
    const [form, setForm] = useState({
        email: "",
        password: "",
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e) => {
        setError("");
        setForm((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const result = await signIn("credentials", {
            email: form.email,
            password: form.password,
            redirect: false,
        });

        setLoading(false);

        if (result?.error) {
            setError("Correo o contraseña incorrectos.");
            return;
        }

        window.location.href = "/";
    };

    return (
        <main className={styles.loginPage}>
            <div className={styles.backgroundGrid} />
            <div className={`${styles.glow} ${styles.glowOne}`} />
            <div className={`${styles.glow} ${styles.glowTwo}`} />
            <div className={`${styles.blurOrb} ${styles.blurOrbLeft}`} />
            <div className={`${styles.blurOrb} ${styles.blurOrbRight}`} />

            <div className={`${styles.bgMarkWrap} ${styles.introBgMark}`} aria-hidden="true">
                <Image
                    src="/assets/icons/arkad.svg"
                    alt=""
                    width={900}
                    height={900}
                    priority
                    className={styles.bgMark}
                />
            </div>

            <section className={styles.hero}>
                <div className={styles.brandBlock}>

                    <div className={`${styles.logoLockup} ${styles.introBrand}`}>
                        <div className={styles.logoRule} />
                        <div className={styles.logoCenter}>
                            <Image
                                src="/assets/icons/logo-arkad.svg"
                                alt="ARKAD"
                                width={420}
                                height={110}
                                priority
                                className={styles.wordmark}
                            />
                            <p>MASTER BARBER EMPIRE</p>
                        </div>
                        <div className={styles.logoRule} />
                    </div>

                    <div className={`${styles.copy} ${styles.introCopy}`}>
                        <div className={styles.badge}>
                            <ShieldCheck size={15} />
                            <span>Acceso privado</span>
                        </div>

                        <h1>
                            Acceso exclusivo
                            <br />
                            para clientes autorizados
                        </h1>

                        <p>
                            Ingresa con tus credenciales asignadas por administración para
                            continuar dentro del sistema.
                        </p>
                    </div>
                </div>

                <div className={`${styles.panelWrap} ${styles.introPanel}`}>
                    <div className={styles.panelGlow} />

                    <section className={styles.card}>
                        <div className={styles.cardHeader}>
                            <span className={styles.eyebrow}>Bienvenido</span>
                            <h2>Inicia sesión</h2>
                        </div>

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.field}>
                                <label htmlFor="email">Correo electrónico</label>
                                <div className={styles.inputWrap}>
                                    <Mail size={18} />
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        placeholder="correo@ejemplo.com"
                                        autoComplete="email"
                                        required
                                    />
                                </div>
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="password">Contraseña</label>
                                <div className={styles.inputWrap}>
                                    <LockKeyhole size={18} />
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        value={form.password}
                                        onChange={handleChange}
                                        placeholder="Ingresa tu contraseña"
                                        autoComplete="current-password"
                                        required
                                    />
                                </div>
                            </div>

                            <div className={styles.formMeta}>
                                <button
                                    type="button"
                                    className={styles.forgotPassword}
                                    onClick={() => { }}
                                >
                                    Olvidé mi contraseña
                                </button>
                            </div>

                            {error ? <div className={styles.error}>{error}</div> : null}

                            <button
                                type="submit"
                                disabled={loading}
                                className={styles.submit}
                            >
                                <span>{loading ? "Ingresando..." : "Entrar al sistema"}</span>
                                {!loading && <ArrowRight size={18} />}
                            </button>
                        </form>

                        <div className={styles.footNote}>
                            Tu primer acceso puede requerir cambio de contraseña por
                            seguridad.
                        </div>
                    </section>
                </div>
                <div className={`${styles.linksWrap} ${styles.introLinks}`}>
                    <div className={styles.socialCard}>
                        <a href="https://www.facebook.com/profile.php?id=61562071806456" target="_blank" rel="noreferrer" aria-label="Facebook">
                            <Facebook size={18} />
                        </a>
                        <a href="https://www.instagram.com/arkad_barber/" target="_blank" rel="noreferrer" aria-label="Instagram">
                            <Instagram size={18} />
                        </a>
                        <a href="https://www.tiktok.com/@arkad1992" target="_blank" rel="noreferrer" aria-label="TikTok">
                            <svg
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
                                aria-hidden="true"
                                fill="currentColor"
                            >
                                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.68h-3.29v13.19a2.9 2.9 0 1 1-2.9-2.9c.23 0 .45.03.67.08V9.03a6.2 6.2 0 1 0 6.23 6.2V8.56a8.08 8.08 0 0 0 4.73 1.51V6.69h-1.67Z" />
                            </svg>
                        </a>
                        <a href="https://maps.app.goo.gl/MGALnMS9fhHkUkfY7" target="_blank" rel="noreferrer" aria-label="Ubicación">
                            <MapPin size={18} />
                        </a>
                    </div>
                </div>
            </section>
        </main>
    );
}