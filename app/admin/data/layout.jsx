import SubNavWrapper from '@public/components/admin/shared/SubNavWrapper'

export default function DataLayout({ children }) {
  const dataNavItems = [
    {
      label: 'Resumen',
      href: '/admin/data',
      icon: 'chart-column',
      exact: true,
    },
    {
      label: 'Clientes',
      href: '/admin/data/clients',
      icon: 'users',
    },
    {
      label: 'Barberos',
      href: '/admin/data/barbers',
      icon: 'scissors',
    },
  ]

  return (
    <>
      <SubNavWrapper items={dataNavItems} />
      {children}
    </>
  )
}
