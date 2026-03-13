'use client'

import { usePathname } from 'next/navigation'
import SubNav from '@public/components/admin/shared/SubNav'

export default function SubNavWrapper({
  items = [],
  basePath = '',
}) {
  const pathname = usePathname()

  // Si estamos exactamente en la raíz de la sección
  if (pathname === basePath) {
    return null
  }

  return <SubNav items={items} />
}