// AuthModal.jsx — Validación en TIEMPO REAL sin mostrar errores cuando el campo está vacío
'use client'

import { useState } from 'react'

const emailRx = /^\S+@\S+\.\S+$/

const AuthModal = ({ isActive, handler }) => {
    const [loginMode, setLoginMode] = useState(true)
    const handleModeSwitch = () => {
        setLoginMode(!loginMode)
        setLoginTouched({ user: false, password: false })
        setTouched({ cedula: false, email: false, nombre: false, apellido: false, password: false, confirm: false })
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
    const [reg, setReg] = useState({
        cedula: '',
        email: '',
        nombre: '',
        apellido: '',
        password: '',
        confirm: '',
    })
    const [touched, setTouched] = useState({
        cedula: false, email: false, nombre: false, apellido: false, password: false, confirm: false,
    })

    // Visualización de errores: solo si HAY TEXTO en el campo y la regla no se cumple.
    const displayErrors = {
        cedula: (touched.cedula && reg.cedula.length > 0 && reg.cedula.length !== 10) ? 'Debe tener 10 dígitos.' : '',
        email: (touched.email && reg.email.length > 0 && !emailRx.test(reg.email)) ? 'Email inválido.' : '',
        nombre: (touched.nombre && reg.nombre.length > 0 && reg.nombre.trim().length < 2) ? 'Mínimo 2 caracteres.' : '',
        apellido: (touched.apellido && reg.apellido.length > 0 && reg.apellido.trim().length < 2) ? 'Mínimo 2 caracteres.' : '',
        password: (touched.password && reg.password.length > 0 && reg.password.length < 6) ? 'Mínimo 6 caracteres.' : '',
        confirm: (touched.confirm && reg.confirm.length > 0 && reg.confirm !== reg.password) ? 'No coincide con la contraseña.' : '',
    }

    // Validez real para habilitar el botón (todos requeridos, aunque no mostremos errores si están vacíos)
    const isRegisterValid =
        reg.cedula.length === 10 &&
        emailRx.test(reg.email) &&
        reg.nombre.trim().length >= 2 &&
        reg.apellido.trim().length >= 2 &&
        reg.password.length >= 6 &&
        reg.confirm === reg.password

    const onRegChange = (field) => (e) => {
        const raw = e.target.value
        const val = field === 'cedula' ? raw.replace(/\D/g, '').slice(0, 10) : raw
        setReg(prev => ({ ...prev, [field]: val }))
        if (!touched[field]) setTouched(prev => ({ ...prev, [field]: true }))
    }

    if (!isActive) return null

    return (
        <>
            {loginMode ? (
                <>
                    <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
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
                    <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
                        <label className={`auth-input ${displayErrors.cedula ? 'is-invalid' : ''}`}>
                            <span className="auth-input__icon" aria-hidden="true">
                                <img src="/assets/icons/dni.svg" alt="" />
                            </span>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Cédula (10 dígitos)"
                                value={reg.cedula}
                                onChange={onRegChange('cedula')}
                                onFocus={() => setTouched(s => ({ ...s, cedula: true }))}
                                aria-invalid={!!displayErrors.cedula}
                            />
                        </label>
                        {displayErrors.cedula && <p className="auth-error">{displayErrors.cedula}</p>}

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
                            />
                        </label>
                        {displayErrors.email && <p className="auth-error">{displayErrors.email}</p>}

                        <div className="auth-grid-2">
                            <label className={`auth-input ${displayErrors.nombre ? 'is-invalid' : ''}`}>
                                <span className="auth-input__icon" aria-hidden="true">
                                    <img src="/assets/icons/user.svg" alt="" />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Nombre"
                                    value={reg.nombre}
                                    onChange={onRegChange('nombre')}
                                    onFocus={() => setTouched(s => ({ ...s, nombre: true }))}
                                    aria-invalid={!!displayErrors.nombre}
                                />
                            </label>

                            <label className={`auth-input ${displayErrors.apellido ? 'is-invalid' : ''}`}>
                                <span className="auth-input__icon" aria-hidden="true">
                                    <img src="/assets/icons/user.svg" alt="" />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Apellido"
                                    value={reg.apellido}
                                    onChange={onRegChange('apellido')}
                                    onFocus={() => setTouched(s => ({ ...s, apellido: true }))}
                                    aria-invalid={!!displayErrors.apellido}
                                />
                            </label>
                        </div>
                        {(displayErrors.nombre || displayErrors.apellido) && (
                            <p className="auth-error">{displayErrors.nombre || displayErrors.apellido}</p>
                        )}

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
                            />
                        </label>
                        {displayErrors.password && <p className="auth-error">{displayErrors.password}</p>}

                        <label className={`auth-input ${displayErrors.confirm ? 'is-invalid' : ''}`}>
                            <span className="auth-input__icon" aria-hidden="true">
                                <img src="/assets/icons/password.svg" alt="" />
                            </span>
                            <input
                                type="password"
                                placeholder="Confirmar contraseña"
                                value={reg.confirm}
                                onChange={onRegChange('confirm')}
                                onFocus={() => setTouched(s => ({ ...s, confirm: true }))}
                                aria-invalid={!!displayErrors.confirm}
                            />
                        </label>
                        {displayErrors.confirm && <p className="auth-error">{displayErrors.confirm}</p>}

                        <button
                            className="auth-button"
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
