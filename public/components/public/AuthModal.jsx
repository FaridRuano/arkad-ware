// AuthModal.jsx — Validación en TIEMPO REAL sin mostrar errores cuando el campo está vacío
'use client'

import { format } from '@node_modules/date-fns/format'
import { is } from '@node_modules/date-fns/locale'
import { useRouter } from '@node_modules/next/navigation'
import { ecPhoneErrorMessage, formatEcMobileRemainderPretty, normalizeEcMobileRemainder, toEcE164FromRemainder } from '@utils/ecPhone'
import { cedulaErrorMessage, validateEcuadorCedula } from '@utils/ecuadorId'
import { useState } from 'react'
import ModalConfirm from '../shared/ModalConfirm'
import { CredentialsSignin } from '@node_modules/next-auth'
import { signIn } from '@auth'

const emailRx = /^\S+@\S+\.\S+$/

const AuthModal = ({ isActive, handler }) => {

    const router = useRouter()

    const [loading, setLoading] = useState(false)

    const [loginMode, setLoginMode] = useState(true)
    const handleModeSwitch = () => {
        setLoginMode(!loginMode)
        setLoginTouched({ user: false, password: false })
        setTouched({ cedula: false, email: false, nombre: false, apellido: false, password: false, confirm: false, address: false, phone: false })
    }

    // -------- Login (UI-only) --------
    const [emailLogin, setEmailLogin] = useState('');
    const [password, setPassword] = useState('');
    const [loginTouched, setLoginTouched] = useState({ email: false, password: false });

    const loginDisplayErrors = {
        email:
            loginTouched.email && emailLogin.length > 0 && !emailRx.test(emailLogin)
                ? 'Email inválido.'
                : '',
        password:
            loginTouched.password && password.length > 0 && password.length < 6
                ? 'Mínimo 6 caracteres.'
                : '',
    };

    const isLoginValid = emailRx.test(emailLogin) && password.length >= 6;


    // -------- Registro (UI-only) --------

    const [cedula, setCedula] = useState('');
    const [errorCedula, setErrorCedula] = useState("");

    const [phone, setPhone] = useState('');
    const [errorPhone, setErrorPhone] = useState('');

    const [acceptTerms, setAcceptTerms] = useState(false);

    const [reg, setReg] = useState({
        email: '',
        nombre: '',
        apellido: '',
        password: '',
        confirm: '',
        address: '',
    })
    const [touched, setTouched] = useState({
        cedula: false, email: false, nombre: false, apellido: false, password: false, confirm: false, address: false, phone: false,
    })

    // Visualización de errores: solo si HAY TEXTO en el campo y la regla no se cumple.
    const displayErrors = {
        email: (touched.email && reg.email.length > 0 && !emailRx.test(reg.email)) ? 'Email inválido.' : '',
        nombre: (touched.nombre && reg.nombre.length > 0 && reg.nombre.trim().length < 2) ? 'Mínimo 2 caracteres.' : '',
        apellido: (touched.apellido && reg.apellido.length > 0 && reg.apellido.trim().length < 2) ? 'Mínimo 2 caracteres.' : '',
        password: (touched.password && reg.password.length > 0 && reg.password.length < 6) ? 'Mínimo 6 caracteres.' : '',
        confirm: (touched.confirm && reg.confirm.length > 0 && reg.confirm !== reg.password) ? 'No coincide con la contraseña.' : '',
        address: (touched.address && reg.address.length > 0 && reg.address.trim().length < 3) ? 'Mínimo 3 caracteres.' : '',
    }

    // Validez real para habilitar el botón (todos requeridos, aunque no mostremos errores si están vacíos)
    const isRegisterValid =
        cedula.length === 10 &&
        errorCedula === '' &&
        errorPhone === '' &&
        emailRx.test(reg.email) &&
        reg.nombre.trim().length >= 2 &&
        reg.apellido.trim().length >= 2 &&
        reg.password.length >= 6 &&
        reg.confirm === reg.password &&
        reg.address.trim().length >= 3 &&
        acceptTerms;

    const NAME_REGEX = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]*$/;

    const normalizeSpaces = (value) =>
        value
            .replace(/^\s+/, "")   // sin espacios al inicio
            .replace(/\s{2,}/g, " "); // sin múltiples espacios

    const onRegChange = (field) => (e) => {
        const raw = e.target.value;

        let next = raw;

        // ✅ Campos nombre y apellido(s)
        if (field === "nombre" || field === "apellido") {
            // 1) Bloquea caracteres no permitidos (números, símbolos, etc.)
            if (!NAME_REGEX.test(raw)) return;

            // 2) Normaliza espacios (sin espacio inicial y sin repetidos)
            next = normalizeSpaces(raw);
        }

        // ✅ Campo dirección
        if (field === "address") {
            // solo normaliza espacios (permite números y símbolos típicos de dirección)
            next = normalizeSpaces(raw);
        }

        setReg((prev) => ({ ...prev, [field]: next }));
        if (!touched[field]) setTouched((prev) => ({ ...prev, [field]: true }));
    };

    function onCedulaChange(e) {
        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
        setCedula(value);

        const res = validateEcuadorCedula(value);
        setErrorCedula(res.ok ? '' : cedulaErrorMessage(res.reason));
    }

    function onPhoneChange(e) {
        const value = e.target.value;

        const normalized = normalizeEcMobileRemainder(value);

        const pretty = formatEcMobileRemainderPretty(normalized);

        setPhone(pretty);

        const res = toEcE164FromRemainder(normalized);
        setErrorPhone(res.ok ? '' : ecPhoneErrorMessage(res.reason));
    }

    const getPhoneE164 = (value = phone) => {
        const normalized = normalizeEcMobileRemainder(value);
        if (!normalized) return '';
        return `+593${String(normalized).replace(/\s+/g, '')}`;
    }

    const capitalize = (value = "") =>
        value
            .trim()
            .toLowerCase()
            .replace(/^\w/, (c) => c.toUpperCase());

    /* Confirm modal */

    const [modalConfirmActive, setModalConfirmActive] = useState(false);

    const [modalConfirmText, setModalConfirmText] = useState("");

    const handlerModal = () => {
        setModalConfirmActive(false);
    }

    const modalConfirmResponse = () => {
        setModalConfirmActive(false);
        handlerModal(false);
    }

    const onLogin = async (e) => {
        e.preventDefault();

        const newLogin = {
            email: emailLogin,
            password: password,
        };
        try {
            setLoading(true);
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: newLogin.email,
                    password: newLogin.password,
                }),
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                setLoading(false);
                setModalConfirmText(data.message || "Credenciales inválidas");
                setModalConfirmActive(true);
                return;
            }
            router.push("/client");
        } catch (error) {
            console.error("Error al iniciar sesión:", error);
        }
    }

    const onSubmit = async (e) => {
        e.preventDefault();
        // Aquí iría la llamada a la API para registrar al usuario
        setLoading(true);
        const newUser = {
            cedula,
            email: reg.email,
            nombre: capitalize(reg.nombre),
            apellido: capitalize(reg.apellido),
            address: reg.address,
            phone: getPhoneE164(),
            password: reg.password,
        };

        try {
            const response = await fetch('/api/auth/login/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newUser),
            });

            const result = await response.json();

            if (result.error) {

                setModalConfirmText("La información ingresada ya existe.");
                setModalConfirmActive(true);
                return;

            } else {
                setReg({ email: '', nombre: '', apellido: '', password: '', confirm: '', address: '' });
                setCedula('');
                setPhone('');
                setAcceptTerms(false);
                setTouched({ cedula: false, email: false, nombre: false, apellido: false, password: false, confirm: false, address: false, phone: false });
                setLoginMode(true);
                setLoading(false);
                setModalConfirmText("Registro exitoso, ya puedes iniciar sesión.");
                setModalConfirmActive(true);

            }

        } catch (error) {
            console.error('Error al registrar:', error);
        }

    }

    if (!isActive) return null

    if (loading) return (
        <div className="auth-modal loading">
            <div className="spinner" aria-hidden="true"></div>
        </div>
    );

    return (
        <>
            <ModalConfirm mainText={modalConfirmText} response={modalConfirmResponse} active={modalConfirmActive} setActive={handlerModal} type='alert' />
            {loginMode ? (
                <>
                    <form className="auth-form" onSubmit={onLogin}>
                        <label className={`auth-input ${loginDisplayErrors.email ? 'is-invalid' : ''}`}>
                            <span className="auth-input__icon" aria-hidden="true">
                                <img src="/assets/icons/mail.svg" alt="" />
                            </span>
                            <input
                                type="email"
                                placeholder="Correo electrónico"
                                value={emailLogin}
                                onChange={(e) => {
                                    setEmailLogin(e.target.value);
                                    if (!loginTouched.email) setLoginTouched((s) => ({ ...s, email: true }));
                                }}
                                onFocus={() => setLoginTouched((s) => ({ ...s, email: true }))}
                                aria-invalid={!!loginDisplayErrors.email}
                            />
                        </label>
                        {loginDisplayErrors.email && <p className="auth-error">{loginDisplayErrors.email}</p>}

                        <label className={`auth-input ${loginDisplayErrors.password ? 'is-invalid' : ''}`}>
                            <span className="auth-input__icon" aria-hidden="true">
                                <img src="/assets/icons/password.svg" alt="" />
                            </span>
                            <input
                                type="password"
                                placeholder="La clave aquí"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (!loginTouched.password) setLoginTouched((s) => ({ ...s, password: true }));
                                }}
                                onFocus={() => setLoginTouched((s) => ({ ...s, password: true }))}
                                aria-invalid={!!loginDisplayErrors.password}
                            />
                        </label>
                        {loginDisplayErrors.password && <p className="auth-error">{loginDisplayErrors.password}</p>}

                        <button className="auth-button" type="submit" disabled={!isLoginValid} aria-disabled={!isLoginValid}>
                            Ingresar
                        </button>
                    </form>

                    <p className="auth-footer">
                        ¿No tienes cuenta aún?{' '}
                        <button type="button" className="auth-link" onClick={handleModeSwitch}>Registrarte ya</button>
                    </p>
                </>
            ) : (
                <>
                    <form className="auth-form" onSubmit={onSubmit}>
                        <label className={`auth-input ${errorCedula ? 'is-invalid' : ''}`}>
                            <span className="auth-input__icon" aria-hidden="true">
                                <img src="/assets/icons/dni.svg" alt="" />
                            </span>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Cédula (10 dígitos)"
                                value={cedula}
                                onChange={onCedulaChange}
                                onFocus={() => setTouched(s => ({ ...s, cedula: true }))}
                                aria-invalid={!!errorCedula}
                            />
                        </label>
                        {errorCedula && <p className="auth-error">{errorCedula}</p>}

                        <label className={`auth-input ${displayErrors.email ? 'is-invalid' : ''}`}>
                            <span className="auth-input__icon" aria-hidden="true">
                                <img src="/assets/icons/mail.svg" alt="" />
                            </span>
                            <input
                                type="email"
                                placeholder="Correo electrónico"
                                value={reg.email}
                                onChange={onRegChange('email')}
                                onFocus={() => setTouched(s => ({ ...s, email: true }))}
                                aria-invalid={!!displayErrors.email}
                                maxLength={40}
                            />
                        </label>
                        {displayErrors.email && <p className="auth-error">{displayErrors.email}</p>}

                        <div className="auth-grid-2">
                            <label className={`auth-input ${displayErrors.nombre ? 'is-invalid' : ''}`}>
                                <span className="auth-input__icon" aria-hidden="true">
                                    <img src="/assets/icons/name.svg" alt="" />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Nombre"
                                    value={reg.nombre}
                                    onChange={onRegChange('nombre')}
                                    onFocus={() => setTouched(s => ({ ...s, nombre: true }))}
                                    aria-invalid={!!displayErrors.nombre}
                                    maxLength={20}
                                />
                            </label>

                            <label className={`auth-input ${displayErrors.apellido ? 'is-invalid' : ''}`}>
                                <span className="auth-input__icon" aria-hidden="true">
                                    <img src="/assets/icons/last.svg" alt="" />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Apellido"
                                    value={reg.apellido}
                                    onChange={onRegChange('apellido')}
                                    onFocus={() => setTouched(s => ({ ...s, apellido: true }))}
                                    aria-invalid={!!displayErrors.apellido}
                                    maxLength={20}
                                />
                            </label>
                        </div>
                        {(displayErrors.nombre || displayErrors.apellido) && (
                            <p className="auth-error">{displayErrors.nombre || displayErrors.apellido}</p>
                        )}

                        <label className={`auth-input ${displayErrors.address ? 'is-invalid' : ''}`}>
                            <span className="auth-input__icon" aria-hidden="true">
                                <img src="/assets/icons/address.svg" alt="" />
                            </span>
                            <input
                                type="text"
                                placeholder="Dirección"
                                value={reg.address}
                                onChange={onRegChange('address')}
                                onFocus={() => setTouched(s => ({ ...s, address: true }))}
                                aria-invalid={!!displayErrors.address}
                                maxLength={120}
                            />
                        </label>
                        {displayErrors.address && <p className="auth-error">{displayErrors.address}</p>}

                        <label className={`auth-input ${errorPhone ? 'is-invalid' : ''}`}>
                            <span className="auth-input__icon" aria-hidden="true">
                                <img src="/assets/icons/phone.svg" alt="" />
                            </span>
                            <div className="auth-input__prefix">
                                <span>+593</span>
                                <input
                                    type="text"
                                    placeholder="Teléfono"
                                    value={phone}
                                    onChange={onPhoneChange}
                                    onFocus={() => setTouched(s => ({ ...s, phone: true }))}
                                    aria-invalid={!!errorPhone}
                                />
                            </div>
                        </label>
                        {errorPhone && <p className="auth-error">{errorPhone}</p>}

                        <label className={`auth-input ${displayErrors.password ? 'is-invalid' : ''}`}>
                            <span className="auth-input__icon" aria-hidden="true">
                                <img src="/assets/icons/password.svg" alt="" />
                            </span>
                            <input
                                type="password"
                                placeholder="Contraseña"
                                value={reg.password}
                                onChange={onRegChange('password')}
                                onFocus={() => setTouched(s => ({ ...s, password: true }))}
                                aria-invalid={!!displayErrors.password}
                                maxLength={20}
                            />
                        </label>
                        {displayErrors.password && <p className="auth-error">{displayErrors.password}</p>}

                        <label className={`auth-input ${displayErrors.confirm ? 'is-invalid' : ''}`}>
                            <span className="auth-input__icon" aria-hidden="true">
                                <img src="/assets/icons/co-password.svg" alt="" />
                            </span>
                            <input
                                type="password"
                                placeholder="Confirmar contraseña"
                                value={reg.confirm}
                                onChange={onRegChange('confirm')}
                                onFocus={() => setTouched(s => ({ ...s, confirm: true }))}
                                aria-invalid={!!displayErrors.confirm}
                                maxLength={20}
                            />
                        </label>
                        {displayErrors.confirm && <p className="auth-error">{displayErrors.confirm}</p>}

                        <div className="auth-checkbox">
                            <label className={`auth-terms`}>
                                <input
                                    type="checkbox"
                                    checked={acceptTerms}
                                    onChange={(e) => setAcceptTerms(e.target.checked)}
                                />
                                <span>
                                    Acepto las{' '}
                                    <a href="/policies" target="_blank" rel="noopener noreferrer">políticas y términos</a>
                                </span>
                            </label>
                        </div>

                        <button
                            className={isRegisterValid ? "auth-button" : "auth-button disabled"}
                            type="submit"
                            disabled={!isRegisterValid}
                            aria-disabled={!isRegisterValid}
                        >
                            Crear cuenta
                        </button>
                    </form>

                    <p className="auth-footer">
                        ¿Ya tienes cuenta?{' '}
                        <button type="button" className="auth-link" onClick={handleModeSwitch}>Inicia sesión</button>
                    </p>
                </>
            )}
        </>
    )
}

export default AuthModal