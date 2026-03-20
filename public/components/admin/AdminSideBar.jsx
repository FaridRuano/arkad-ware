'use client'
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  BarChart3,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

const AdminSideBar = ({
  collapsed,
  setCollapsed,
  isMobile,
  isMobileOpen,
  setIsMobileOpen,
}) => {
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { label: 'Inicio', href: '/admin', icon: LayoutDashboard },
    { label: 'Agenda', href: '/admin/schedule', icon: CalendarDays },
    { label: 'Clientes', href: '/admin/clients', icon: Users },
    { label: 'Reportes', href: '/admin/data', icon: BarChart3 },
    { label: 'Configuración', href: '/admin/settings', icon: Settings },
  ];

  const isActive = (href) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (!res.ok) {
        console.error('No se pudo cerrar sesión');
        return;
      }

      router.push('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleLinkClick = () => {
    if (isMobile) {
      setIsMobileOpen(false);
    }
  };

  const handleToggleSidebar = () => {
    if (isMobile) {
      setIsMobileOpen(false);
      return;
    }

    setCollapsed((prev) => !prev);
  };

  return (
    <>
      {isMobile && !isMobileOpen && (
        <button
          type="button"
          className="admin-mobile-toggle"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Abrir menú"
        >
          <PanelLeftOpen size={20} />
        </button>
      )}

      {isMobile && isMobileOpen && (
        <div
          className="adminSidebarBackdrop"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`admin-sidebar ${collapsed ? 'collapsed' : ''} ${isMobileOpen ? 'is-open' : ''}`}
      >
        <div className="admin-sidebar__top">
          <div className="admin-sidebar__header">
            {!collapsed && <h2>Arkad</h2>}

            <button
              type="button"
              className="admin-sidebar__collapseBtn"
              onClick={handleToggleSidebar}
              aria-label={
                isMobile
                  ? 'Cerrar menú'
                  : collapsed
                    ? 'Expandir sidebar'
                    : 'Colapsar sidebar'
              }
            >
              {isMobile ? (
                <PanelLeftClose size={18} />
              ) : collapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
          </div>

          <nav>
            <ul>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`admin-sidebar__link ${active ? 'active' : ''}`}
                      onClick={handleLinkClick}
                      title={collapsed && !isMobile ? item.label : ''}
                    >
                      <Icon size={18} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="admin-sidebar__logout">
          <button
            type="button"
            className="admin-sidebar__logoutBtn"
            onClick={handleLogout}
            title={collapsed && !isMobile ? 'Cerrar sesión' : ''}
          >
            <LogOut size={18} />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSideBar;