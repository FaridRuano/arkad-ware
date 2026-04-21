'use client'
import React from 'react';
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
import styles from './AdminSideBar.module.scss';

const AdminSideBar = ({
  collapsed,
  setCollapsed,
  isMobile,
  isMobileOpen,
  setIsMobileOpen,
}) => {
  const router = useRouter();
  const pathname = usePathname();

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
          className={styles.mobileToggle}
          onClick={() => setIsMobileOpen(true)}
          aria-label="Abrir menú"
        >
          <PanelLeftOpen size={20} />
        </button>
      )}

      {isMobile && isMobileOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={[
          styles.sidebar,
          collapsed ? styles.sidebarCollapsed : '',
          isMobileOpen ? styles.sidebarOpen : '',
        ].filter(Boolean).join(' ')}
      >
        <div className={styles.top}>
          <div className={styles.header}>
            {!collapsed && <h2 className={styles.brandTitle}>Arkad</h2>}

            <button
              type="button"
              className={styles.collapseBtn}
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

          <nav className={styles.nav}>
            <ul className={styles.navList}>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <li key={item.href} className={styles.navItem}>
                    <Link
                      href={item.href}
                      className={[
                        styles.link,
                        active ? styles.linkActive : '',
                      ].filter(Boolean).join(' ')}
                      onClick={handleLinkClick}
                      title={collapsed && !isMobile ? item.label : ''}
                    >
                      <Icon size={18} />
                      {!collapsed && <span className={styles.linkLabel}>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className={styles.logout}>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={handleLogout}
            title={collapsed && !isMobile ? 'Cerrar sesión' : ''}
          >
            <LogOut size={18} />
            {!collapsed && <span className={styles.logoutLabel}>Cerrar sesión</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSideBar;
