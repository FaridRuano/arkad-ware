"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    KeyRound,
    LockKeyhole,
    ShieldCheck,
    UserRoundSearch,
    Eye,
    EyeOff,
} from "lucide-react";
import styles from "./forgot-password.module.scss";

const initialForm = {
    identifier: "",
    recoveryCode: "",
    newPassword: "",
    confirmPassword: "",
};

export default function ForgotPasswordClient() {
    const router = useRouter();
    const [form, setForm] = useState(initialForm);
    const [submitting, setSubmitting] = useState(false);
    const [redirecting, setRedirecting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const passwordChecks = useMemo(() => {
        const newPassword = form.newPassword || "";

        return {
            minLength: newPassword.length >= 8,
            hasUppercase: /[A-ZÁÉÍÓÚÑ]/.test(newPassword),
            hasLowercase: /[a-záéíóúñ]/.test(newPassword),
            hasNumber: /\d/.test(newPassword),
        };
    }, [form.newPassword]);

    const identifier = form.identifier.trim();
    const recoveryCode = form.recoveryCode.trim();
    const passwordMatches =
        form.confirmPassword.length > 0 && form.newPassword === form.confirmPassword;
    const canSubmit =
        Boolean(identifier) &&
        Boolean(recoveryCode) &&
        passwordChecks.minLength &&
        passwordChecks.hasUppercase &&
        passwordChecks.hasLowercase &&
        passwordChecks.hasNumber &&
        passwordMatches &&
        !submitting &&
        !redirecting;

    const handleChange = (e) => {
        setError("");
        setSuccess("");

        const { name, value } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.identifier || !form.recoveryCode || !form.newPassword || !form.confirmPassword) {
            setError("Completa todos los campos.");
            return;
        }

        if (form.newPassword !== form.confirmPassword) {
            setError("La nueva contraseña y la confirmación no coinciden.");
            return;
        }

        setSubmitting(true);
        setRedirecting(false);
        setError("");
        setSuccess("");

        try {
            const res = await fetch("/api/auth/password/reset-password", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    identifier: form.identifier,
                    recoveryCode: form.recoveryCode,
                    newPassword: form.newPassword,
                    confirmPassword: form.confirmPassword,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(
                    data?.error || "No se pudo restablecer la contraseña."
                );
            }

            setSuccess(
                data?.message || "Tu contraseña fue actualizada correctamente."
            );
            setRedirecting(true);

            setTimeout(() => {
                router.push("/");
            }, 1400);
        } catch (err) {
            setError(
                err?.message ||
                "Ocurrió un problema al cambiar la contraseña. Inténtalo nuevamente."
            );
        } finally {
            setSubmitting(false);
        }
    };

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
                            <span>Recuperación presencial</span>
                        </div>

                        <h1>
                            Recupera el acceso
                            <br />
                            con tu código
                        </h1>

                        <p>
                            Si olvidaste tu contraseña, solicita el código de recuperación
                            en la barberia. Cuando lo tengas, ingrésalo aquí junto con tu correo
                            o cédula para definir una nueva clave.
                        </p>
                    </div>

                    <div className={`${styles.infoPanel} ${styles.introInfo}`}>
                        <div className={styles.infoItem}>
                            <KeyRound size={18} />
                            <span>El código se entrega presencialmente en la barberia.</span>
                        </div>
                        <div className={styles.infoItem}>
                            <UserRoundSearch size={18} />
                            <span>Puedes identificarte con tu correo o tu cédula.</span>
                        </div>
                        <div className={styles.infoItem}>
                            <LockKeyhole size={18} />
                            <span>Al confirmar, tu contraseña anterior dejará de funcionar.</span>
                        </div>
                    </div>
                </div>

                <div className={`${styles.panelWrap} ${styles.introPanel}`}>
                    <div className={styles.panelGlow} />

                    <section className={`${styles.card} ${redirecting ? styles.cardRedirecting : ""}`}>
                        {redirecting ? (
                            <div className={styles.redirectOverlay} aria-live="polite">
                                <div className={styles.redirectOverlayCard}>
                                    <CheckCircle2 size={20} />
                                    <span>Contraseña actualizada. Volviendo al acceso...</span>
                                </div>
                            </div>
                        ) : null}
                        <div className={styles.cardHeader}>
                            <span className={styles.eyebrow}>Recuperar contraseña</span>
                            <h2>Ingresa tus datos</h2>
                        </div>

                        <div className={`${styles.statusBox} ${styles.statusWarning}`}>
                            Usa el código que te entregaron en persona para continuar con
                            el cambio de contraseña.
                        </div>

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.field}>
                                <label htmlFor="identifier">Correo o cédula</label>
                                <div className={styles.inputWrap}>
                                    <UserRoundSearch size={18} />
                                    <input
                                        id="identifier"
                                        name="identifier"
                                        type="text"
                                        value={form.identifier}
                                        onChange={handleChange}
                                        placeholder="correo@ejemplo.com o 1234567890"
                                        autoComplete="username"
                                        disabled={submitting || redirecting}
                                        required
                                    />
                                </div>
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="recoveryCode">Código de recuperación</label>
                                <div className={styles.inputWrap}>
                                    <KeyRound size={18} />
                                    <input
                                        id="recoveryCode"
                                        name="recoveryCode"
                                        type="text"
                                        value={form.recoveryCode}
                                        onChange={handleChange}
                                        placeholder="Ingresa el código entregado"
                                        autoComplete="one-time-code"
                                        disabled={submitting || redirecting}
                                        required
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
                                        type={showNewPassword ? "text" : "password"}
                                        value={form.newPassword}
                                        onChange={handleChange}
                                        placeholder="Crea una nueva contraseña"
                                        autoComplete="new-password"
                                        disabled={submitting || redirecting}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className={styles.passwordToggle}
                                        onClick={() => setShowNewPassword((prev) => !prev)}
                                        onMouseDown={(e) => e.preventDefault()}
                                        aria-label={showNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                        aria-pressed={showNewPassword}
                                    >
                                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="confirmPassword">Confirmar contraseña</label>
                                <div className={styles.inputWrap}>
                                    <LockKeyhole size={18} />
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={form.confirmPassword}
                                        onChange={handleChange}
                                        placeholder="Confirma tu nueva contraseña"
                                        autoComplete="new-password"
                                        disabled={submitting || redirecting}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className={styles.passwordToggle}
                                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                                        onMouseDown={(e) => e.preventDefault()}
                                        aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                        aria-pressed={showConfirmPassword}
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className={styles.checkList}>
                                <div className={passwordChecks.minLength ? styles.checkOk : styles.checkItem}>
                                    <span />
                                    Mínimo 8 caracteres.
                                </div>
                                <div className={passwordChecks.hasUppercase ? styles.checkOk : styles.checkItem}>
                                    <span />
                                    Al menos una letra mayúscula.
                                </div>
                                <div className={passwordChecks.hasLowercase ? styles.checkOk : styles.checkItem}>
                                    <span />
                                    Al menos una letra minúscula.
                                </div>
                                <div className={passwordChecks.hasNumber ? styles.checkOk : styles.checkItem}>
                                    <span />
                                    Al menos un número.
                                </div>
                                <div className={passwordMatches ? styles.checkOk : styles.checkItem}>
                                    <span />
                                    Las contraseñas coinciden.
                                </div>
                            </div>

                            {error ? (
                                <div className={`${styles.message} ${styles.messageError}`}>
                                    <AlertTriangle size={18} />
                                    <span>{error}</span>
                                </div>
                            ) : null}

                            {success ? (
                                <div className={`${styles.message} ${styles.messageSuccess}`}>
                                    <CheckCircle2 size={18} />
                                    <span>{success}</span>
                                </div>
                            ) : null}

                            <div className={styles.actionsRow}>
                                <button
                                    type="submit"
                                    disabled={!canSubmit}
                                    className={styles.submit}
                                >
                                    <span>
                                        {submitting ? "Guardando..." : "Guardar nueva contraseña"}
                                    </span>
                                    {!submitting && <ArrowRight size={18} />}
                                </button>

                                <button
                                    type="button"
                                    className={styles.cancelButton}
                                    onClick={() => router.push("/")}
                                    disabled={submitting || redirecting}
                                >
                                    <ArrowLeft size={16} />
                                    Volver al acceso
                                </button>
                            </div>
                        </form>

                        <div className={styles.footNote}>
                            Este flujo usa un código único temporal del negocio. Más
                            adelante podemos reemplazarlo por códigos individuales por
                            cliente sin cambiar la experiencia de la pantalla.
                        </div>
                    </section>
                </div>
            </section>
        </main>
    );
}
