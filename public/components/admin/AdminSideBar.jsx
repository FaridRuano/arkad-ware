'use client'
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const AdminSideBar = () => {
  const pathname = usePathname();

  const isActive = (href) => pathname === href;

  return (
    <div className="admin-sidebar">
      <h2>Admin Panel</h2>
      <nav>
        <ul>
          <li>
            <Link href="/admin" className={isActive('/admin') ? 'active' : ''}>Dashboard</Link>
          </li>
          <li>
            <Link href="/admin/appointments" className={isActive('/admin/appointments') ? 'active' : ''}>Citas</Link>
          </li>
          <li>
            <Link href="/admin/clients" className={isActive('/admin/clients') ? 'active' : ''}>Clientes</Link>
          </li>
          <li>
            <Link href="/admin/data" className={isActive('/admin/data') ? 'active' : ''}>Datos</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default AdminSideBar;
