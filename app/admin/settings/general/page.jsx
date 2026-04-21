import ComingSoonCard from '../shared/ComingSoonCard/ComingSoonCard'

export default function GeneralSettingsPage() {
  return (
    <ComingSoonCard
      eyebrow="Configuración · General"
      title="Configuración general próximamente"
      description="Aquí concentraremos los datos principales del negocio y parámetros base del sistema para que todo quede administrable desde un solo lugar."
      points={[
        'Información comercial y datos visibles del negocio.',
        'Parámetros generales de operación y comunicación.',
        'Ajustes base para comportamiento global del sistema.',
      ]}
    />
  )
}
