'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  X,
  SlidersHorizontal,
  Scissors,
  BriefcaseBusiness,
  Package,
  Users,
  Clock3,
} from 'lucide-react'
import styles from './SubNav.module.scss'

const MOBILE_BREAKPOINT = 768

const iconMap = {
  'calendar-days': CalendarDays,
  'clipboard-list': ClipboardList,
  sliders: SlidersHorizontal,
  scissors: Scissors,
  briefcase: BriefcaseBusiness,
  'layout-dashboard': LayoutDashboard,
  package: Package,
  users: Users,
  clock: Clock3,
}

const SubNav = ({ items = [], className = '' }) => {
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (item) => {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  const activeItem = useMemo(() => {
    return items.find((item) => isActive(item)) || items[0] || null
  }, [items, pathname])

  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
    }

    checkViewport()
    window.addEventListener('resize', checkViewport)

    return () => window.removeEventListener('resize', checkViewport)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isMobile) setMenuOpen(false)
  }, [isMobile])

  useEffect(() => {
    if (!menuOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [menuOpen])

  if (!items?.length) return null

  return (
    <>
      <nav className={[styles.root, className].filter(Boolean).join(' ')} aria-label="Subnavegación">
        {!isMobile ? (
          <div className={styles.scroll}>
            <div className={styles.inner}>
              {items.map((item) => {
                const Icon = iconMap[item.icon]
                const active = isActive(item)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[styles.link, active ? styles.linkActive : ''].filter(Boolean).join(' ')}
                  >
                    {Icon ? <Icon className={styles.icon} /> : null}
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ) : (
          <div className={styles.mobile}>
            <button
              type="button"
              className={[
                styles.mobileTrigger,
                menuOpen ? styles.mobileTriggerOpen : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-controls="subnav-mobile-menu"
            >
              <div className={styles.mobileTriggerLeft}>
                {(() => {
                  const ActiveIcon = activeItem?.icon ? iconMap[activeItem.icon] : null
                  return ActiveIcon ? <ActiveIcon className={styles.icon} /> : null
                })()}
                <span className={styles.mobileLabel}>
                  {activeItem?.label || 'Seleccionar'}
                </span>
              </div>

              <ChevronDown className={styles.mobileChevron} />
            </button>
          </div>
        )}
      </nav>

      {isMobile && menuOpen && (
        <>
          <button
            type="button"
            className={styles.overlay}
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
          />

          <div
            id="subnav-mobile-menu"
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Opciones de navegación"
          >
            <div className={styles.drawerHeader}>
              <button
                type="button"
                className={styles.drawerClose}
                onClick={() => setMenuOpen(false)}
                aria-label="Cerrar menú"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.drawerList}>
              {items.map((item) => {
                const Icon = iconMap[item.icon]
                const active = isActive(item)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      styles.drawerLink,
                      active ? styles.drawerLinkActive : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className={styles.drawerLinkLeft}>
                      {Icon ? <Icon className={styles.icon} /> : null}
                      <span>{item.label}</span>
                    </div>

                    {active && <span className={styles.drawerActiveMark} />}
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default SubNav
