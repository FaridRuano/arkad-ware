'use client'
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const MOBILE_BREAKPOINT = 980;

const AdminSideBar = () => {
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const isActive = (href) => pathname === href;

  // Detecta mobile/desktop según ancho
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Cuando cambias de ruta, cierra el sidebar en móvil
  useEffect(() => {
    if (isMobile) setIsOpen(false);
  }, [pathname, isMobile]);

  // Cierra con Escape (solo si está abierto)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const closeIfMobile = () => {
    if (isMobile) setIsOpen(false);
  };

  // 🔐 LOGOUT
  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        console.error("No se pudo cerrar sesión");
        return;
      }
      setIsOpen(false);
      router.push("/");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <>
      {/* Botón hamburguesa (solo móvil) */}
      {isMobile && (
        <button
          type="button"
          aria-label="Abrir menú"
          aria-controls="admin-sidebar"
          aria-expanded={isOpen}
          className="admin-sidebar__toggle"
          onClick={() => setIsOpen(true)}
        >
          ☰
        </button>
      )}

      {/* Backdrop: el "espacio libre" clickeable para cerrar */}
      {isMobile && isOpen && (
        <div
          className="adminSidebarBackdrop"
          role="button"
          aria-label="Cerrar menú"
          tabIndex={-1}
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        id="admin-sidebar"
        className={`admin-sidebar ${isMobile && isOpen ? 'is-open' : ''}`}
      >
        <div className="admin-sidebar__header">
          <h2>Admin Panel</h2>
          {/* ❌ Quitamos el botón X */}
        </div>

        <nav>
          <ul>
            <li>
              <Link href="/admin" className={isActive('/admin') ? 'active' : ''} onClick={closeIfMobile}>
                Dashboard
              </Link>
            </li>
            <li>
              <Link href="/admin/schedule" className={isActive('/admin/schedule') ? 'active' : ''} onClick={closeIfMobile}>
                Agenda
              </Link>
            </li>
            <li>
              <Link href="/admin/appointments" className={isActive('/admin/appointments') ? 'active' : ''} onClick={closeIfMobile}>
                Citas
              </Link>
            </li>
            <li>
              <Link href="/admin/clients" className={isActive('/admin/clients') ? 'active' : ''} onClick={closeIfMobile}>
                Clientes
              </Link>
            </li>
            <li>
              <Link href="/admin/barbers" className={isActive('/admin/barbers') ? 'active' : ''} onClick={closeIfMobile}>
                Barberos
              </Link>
            </li>
            <li>
              <Link href="/admin/data" className={isActive('/admin/data') ? 'active' : ''} onClick={closeIfMobile}>
                Datos
              </Link>
            </li>
          </ul>
        </nav>

        <div className="admin-sidebar__logout">
          <button
            type="button"
            className="admin-sidebar__logoutBtn"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSideBar;
