'use client'
import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const AdminSideBar = () => {

  const router = useRouter()

  const pathname = usePathname();

  const isActive = (href) => pathname === href;

  // 🔐 LOGOUT
  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!res.ok) {
        console.error("No se pudo cerrar sesión");
        return;
      }

      router.push("/"); // vuelve al login
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <div className="admin-sidebar">
      <h2>Admin Panel</h2>
      <nav>
        <ul>
          <li>
            <Link href="/admin" className={isActive('/admin') ? 'active' : ''}>Dashboard</Link>
          </li>
          <li>
            <Link href="/admin/schedule" className={isActive('/admin/schedule') ? 'active' : ''}>Agenda</Link>
          </li>
          <li>
            <Link href="/admin/appointments" className={isActive('/admin/appointments') ? 'active' : ''}>Citas</Link>
          </li>
          <li>
            <Link href="/admin/clients" className={isActive('/admin/clients') ? 'active' : ''}>Clientes</Link>
          </li>
          <li>
            <Link href="/admin/barbers" className={isActive('/admin/barbers') ? 'active' : ''}>Barberos</Link>
          </li>
          <li>
            <Link href="/admin/data" className={isActive('/admin/data') ? 'active' : ''}>Datos</Link>
          </li>
        </ul>
      </nav>
      {/* 🔥 Logout Section */}
      <div className="admin-sidebar__logout">
        <button
          type="button"
          className="admin-sidebar__logoutBtn"
          onClick={handleLogout}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export default AdminSideBar;
