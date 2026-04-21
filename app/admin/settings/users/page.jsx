import ComingSoonCard from '../shared/ComingSoonCard/ComingSoonCard'

export default function UsersSettingsPage() {
  return (
    <ComingSoonCard
      eyebrow="Configuración · Usuarios"
      title="Usuarios y accesos próximamente"
      description="Pronto esta sección permitirá administrar usuarios internos, accesos y control operativo de cuentas sin perder consistencia visual en el panel."
      points={[
        'Listado de usuarios internos y cuentas administrativas.',
        'Roles, permisos y estados de acceso al sistema.',
        'Auditoría base para movimientos y cambios de usuarios.',
      ]}
    />
  )
}
