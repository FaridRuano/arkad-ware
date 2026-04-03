"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import {
    ShieldCheck,
    LockKeyhole,
    ArrowRight,
    CheckCircle2,
    AlertTriangle,
    KeyRound,
} from "lucide-react";
import styles from "./update-password.module.scss";

const initialForm = {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
};

export default function UpdatePasswordClient({ sessionUser }) {
    const [form, setForm] = useState(initialForm);
    const [token, setToken] = useState("");
    const [tokenLoading, setTokenLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [tokenError, setTokenError] = useState("");

    const canRequestToken = sessionUser?.isFirstLogin === true;

    const passwordChecks = useMemo(() => {
        const newPassword = form.newPassword || "";

        return {
            minLength: newPassword.length >= 8,
            hasUppercase: /[A-ZÁÉÍÓÚÑ]/.test(newPassword),
            hasLowercase: /[a-záéíóúñ]/.test(newPassword),
            hasNumber: /\d/.test(newPassword),
        };
    }, [form.newPassword]);

    useEffect(() => {
        if (!sessionUser) {
            setTokenLoading(false);
            return;
        }

        if (!canRequestToken) {
            setTokenLoading(false);
            return;
        }

        let ignore = false;

        const createInitialToken = async () => {
            try {
                setTokenLoading(true);
                setTokenError("");

                const res = await fetch("/api/auth/password/initial-password-token", {
                    method: "POST",
                    cache: "no-store",
                });

                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    throw new Error(
                        data?.error || "No se pudo generar el token de primer ingreso."
                    );
                }

                if (!ignore) {
                    setToken(data?.token || "");
                }
            } catch (err) {
                if (!ignore) {
                    setTokenError(
                        err?.message ||
                        "No se pudo preparar el proceso de actualización de contraseña."
                    );
                }
            } finally {
                if (!ignore) {
                    setTokenLoading(false);
                }
            }
        };

        createInitialToken();

        return () => {
            ignore = true;
        };
    }, [canRequestToken, sessionUser]);

    const handleChange = (e) => {
        setError("");
        setSuccess("");

        const { name, value } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleCancel = async () => {
        setError("");
        setSuccess("");
        await signOut({ redirect: true, redirectTo: "/" });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!token) {
            setError("No se encontró un token válido para completar el primer ingreso.");
            return;
        }

        if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
            setError("Completa todos los campos.");
            return;
        }

        if (form.newPassword !== form.confirmPassword) {
            setError("La nueva contraseña y la confirmación no coinciden.");
            return;
        }

        setSubmitting(true);
        setError("");
        setSuccess("");

        try {
            let city = null;
            let latitude = null;
            let longitude = null;

            if ("geolocation" in navigator) {
                await new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            latitude = position.coords?.latitude ?? null;
                            longitude = position.coords?.longitude ?? null;
                            resolve();
                        },
                        () => resolve(),
                        {
                            enableHighAccuracy: false,
                            timeout: 5000,
                            maximumAge: 600000,
                        }
                    );
                });
            }

            const res = await fetch("/api/auth/password/complete-initial-password", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    token,
                    currentPassword: form.currentPassword,
                    newPassword: form.newPassword,
                    confirmPassword: form.confirmPassword,
                    city,
                    latitude,
                    longitude,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(
                    data?.error || "No se pudo completar el cambio de contraseña."
                );
            }

            setSuccess(
                data?.message ||
                "Tu contraseña fue actualizada correctamente. Volverás al acceso."
            );

            setForm(initialForm);

            setTimeout(async () => {
                await signOut({ redirect: true, redirectTo: "/" });
            }, 1400);
        } catch (err) {
            setError(
                err?.message ||
                "Ocurrió un problema al actualizar la contraseña. Inténtalo nuevamente."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const isBlocked = tokenLoading || submitting || !sessionUser;

    return (
        <main className={styles.updatePage}>
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
                            <span>Primer ingreso protegido</span>
                        </div>

                        <h1>
                            Configura una nueva
                            <br />
                            contraseña segura
                        </h1>

                        <p>
                            Por seguridad, tu primer acceso requiere actualizar la contraseña
                            temporal asignada por administración antes de continuar.
                        </p>

                        <div className={styles.infoPanel}>
                            <div className={styles.infoItem}>
                                <KeyRound size={16} />
                                <span>Usa una clave distinta a tu cédula.</span>
                            </div>
                            <div className={styles.infoItem}>
                                <CheckCircle2 size={16} />
                                <span>Después del cambio volverás a iniciar sesión.</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`${styles.panelWrap} ${styles.introPanel}`}>
                    <div className={styles.panelGlow} />

                    <section className={styles.card}>
                        <div className={styles.cardHeader}>
                            <span className={styles.eyebrow}>Seguridad de acceso</span>
                            <h2>Actualiza tu contraseña</h2>
                        </div>

                        {!sessionUser ? (
                            <div className={`${styles.statusBox} ${styles.statusWarning}`}>
                                Debes iniciar sesión primero para completar este paso.
                            </div>
                        ) : null}

                        {tokenError ? (
                            <div className={`${styles.message} ${styles.messageError}`}>
                                <AlertTriangle size={16} />
                                <span>{tokenError}</span>
                            </div>
                        ) : null}

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.field}>
                                <label htmlFor="currentPassword">Contraseña actual</label>
                                <div className={styles.inputWrap}>
                                    <LockKeyhole size={18} />
                                    <input
                                        id="currentPassword"
                                        name="currentPassword"
                                        type="password"
                                        value={form.currentPassword}
                                        onChange={handleChange}
                                        placeholder="Ingresa tu contraseña temporal"
                                        autoComplete="current-password"
                                        required
                                        disabled={isBlocked || !token}
                                    />
                                </div>
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="newPassword">Nueva contraseña</label>
                                <div className={styles.inputWrap}>
                                    <LockKeyhole size={18} />
                                    <input
                                        id="newPassword"
                                        name="newPassword"
                                        type="password"
                                        value={form.newPassword}
                                        onChange={handleChange}
                                        placeholder="Crea una nueva contraseña"
                                        autoComplete="new-password"
                                        required
                                        disabled={isBlocked || !token}
                                    />
                                </div>
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="confirmPassword">Confirmar contraseña</label>
                                <div className={styles.inputWrap}>
                                    <LockKeyhole size={18} />
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type="password"
                                        value={form.confirmPassword}
                                        onChange={handleChange}
                                        placeholder="Confirma la nueva contraseña"
                                        autoComplete="new-password"
                                        required
                                        disabled={isBlocked || !token}
                                    />
                                </div>
                            </div>

                            <div className={styles.checkList}>
                                <div className={passwordChecks.minLength ? styles.checkOk : styles.checkItem}>
                                    <span />
                                    Mínimo 8 caracteres
                                </div>
                                <div className={passwordChecks.hasUppercase ? styles.checkOk : styles.checkItem}>
                                    <span />
                                    Al menos una mayúscula
                                </div>
                                <div className={passwordChecks.hasLowercase ? styles.checkOk : styles.checkItem}>
                                    <span />
                                    Al menos una minúscula
                                </div>
                                <div className={passwordChecks.hasNumber ? styles.checkOk : styles.checkItem}>
                                    <span />
                                    Al menos un número
                                </div>
                            </div>

                            {error ? (
                                <div className={`${styles.message} ${styles.messageError}`}>
                                    <AlertTriangle size={16} />
                                    <span>{error}</span>
                                </div>
                            ) : null}

                            {success ? (
                                <div className={`${styles.message} ${styles.messageSuccess}`}>
                                    <CheckCircle2 size={16} />
                                    <span>{success}</span>
                                </div>
                            ) : null}

                            <button
                                type="submit"
                                disabled={isBlocked || !token}
                                className={styles.submit}
                            >
                                <span>
                                    {submitting
                                        ? "Actualizando..."
                                        : tokenLoading
                                            ? "Preparando seguridad..."
                                            : "Guardar nueva contraseña"}
                                </span>
                                {!submitting && !tokenLoading ? <ArrowRight size={18} /> : null}
                            </button>
                            <div className={styles.actionsRow}>
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className={styles.cancelButton}
                                    disabled={submitting}
                                >
                                    Cancelar y volver
                                </button>
                            </div>
                        </form>

                        <div className={styles.footNote}>
                            Este paso es obligatorio para activar tu acceso definitivo al sistema.
                        </div>
                    </section>
                </div>
            </section>
        </main>
    );
}