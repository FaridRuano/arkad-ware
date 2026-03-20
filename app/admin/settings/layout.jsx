import SubNavWrapper from '@public/components/admin/shared/SubNavWrapper'

export default function SettingsLayout({ children }) {
  const settingsNavItems = [
    {
      label: 'General',
      href: '/admin/settings/general',
      icon: 'sliders',
      exact: true,
    },
    {
      label: 'Barberos',
      href: '/admin/settings/barbers',
      icon: 'scissors',
    },
    {
      label: 'Servicios',
      href: '/admin/settings/services',
      icon: 'briefcase',
    },
    {
      label: 'Productos',
      href: '/admin/settings/products',
      icon: 'package',
    },
    {
      label: 'Usuarios',
      href: '/admin/settings/users',
      icon: 'users',
    },
    {
      label: 'Horarios',
      href: '/admin/settings/schedule',
      icon: 'clock',
    },
  ]

  return (
    <>
      <SubNavWrapper items={settingsNavItems} basePath='/admin/settings'/>
      {children}
    </>
  )
}