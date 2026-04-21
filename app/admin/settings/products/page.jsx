import ComingSoonCard from '../shared/ComingSoonCard/ComingSoonCard'

export default function ProductsSettingsPage() {
  return (
    <ComingSoonCard
      eyebrow="Configuración · Productos"
      title="Gestión de productos próximamente"
      description="Este módulo quedará listo para manejar inventario, catálogo y apoyo comercial sin que la sección se vea vacía mientras lo construimos."
      points={[
        'Catálogo de productos con precio, estado e imagen.',
        'Control básico de stock y visibilidad comercial.',
        'Relación entre productos, ventas y operación interna.',
      ]}
    />
  )
}
