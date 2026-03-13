import Link from 'next/link';
import {
  SlidersHorizontal,
  Scissors,
  BriefcaseBusiness,
  Package,
  Users,
  Clock3,
  ChevronRight,
} from 'lucide-react';

export default function SettingsPage() {
  const items = [
    {
      title: 'General',
      description: 'Configura la información principal del negocio y parámetros básicos del sistema.',
      href: '/admin/settings/general',
      icon: SlidersHorizontal,
    },
    {
      title: 'Barberos',
      description: 'Administra los profesionales, sus datos y disponibilidad.',
      href: '/admin/settings/barbers',
      icon: Scissors,
    },
    {
      title: 'Servicios',
      description: 'Crea y organiza los servicios disponibles, duración y precios.',
      href: '/admin/settings/services',
      icon: BriefcaseBusiness,
    },
    {
      title: 'Productos',
      description: 'Gestiona productos, stock básico y configuración comercial.',
      href: '/admin/settings/products',
      icon: Package,
    },
    {
      title: 'Usuarios',
      description: 'Controla accesos, cuentas internas y roles del sistema.',
      href: '/admin/settings/users',
      icon: Users,
    },
    {
      title: 'Horarios',
      description: 'Define horarios de atención y disponibilidad general.',
      href: '/admin/settings/schedule',
      icon: Clock3,
    },
  ];

  return (
    <section className="settings-dashboard">
      <div className="settings-dashboard__intro">
        <h2>Panel de configuración</h2>
        <p>
          Administra los módulos clave del sistema desde un solo lugar.
        </p>
      </div>

      <div className="settings-dashboard__grid">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="settings-dashboard__card"
            >
              <div className="settings-dashboard__cardTop">
                <div className="settings-dashboard__icon">
                  <Icon size={22} />
                </div>

                <div className="settings-dashboard__arrow">
                  <ChevronRight size={18} />
                </div>
              </div>

              <div className="settings-dashboard__content">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}