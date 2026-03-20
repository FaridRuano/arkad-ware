'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChevronDown,
  X,
  SlidersHorizontal,
  Scissors,
  BriefcaseBusiness,
  Package,
  Users,
  Clock3,
} from 'lucide-react'

const MOBILE_BREAKPOINT = 768

const iconMap = {
  sliders: SlidersHorizontal,
  scissors: Scissors,
  briefcase: BriefcaseBusiness,
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
      <nav className={`subnav ${className}`.trim()} aria-label="Subnavegación">
        {!isMobile ? (
          <div className="subnav__scroll">
            <div className="subnav__inner">
              {items.map((item) => {
                const Icon = iconMap[item.icon]
                const active = isActive(item)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`subnav__link ${active ? 'active' : ''}`}
                  >
                    {Icon ? <Icon className="subnav__icon" /> : null}
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="subnav__mobile">
            <button
              type="button"
              className={`subnav__mobileTrigger ${menuOpen ? 'is-open' : ''}`}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-controls="subnav-mobile-menu"
            >
              <div className="subnav__mobileTriggerLeft">
                {(() => {
                  const ActiveIcon = activeItem?.icon ? iconMap[activeItem.icon] : null
                  return ActiveIcon ? <ActiveIcon className="subnav__icon" /> : null
                })()}
                <span className="subnav__mobileLabel">
                  {activeItem?.label || 'Seleccionar'}
                </span>
              </div>

              <ChevronDown className="subnav__mobileChevron" />
            </button>
          </div>
        )}
      </nav>

      {isMobile && menuOpen && (
        <>
          <button
            type="button"
            className="subnav__overlay"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
          />

          <div
            id="subnav-mobile-menu"
            className="subnav__drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Opciones de navegación"
          >
            <div className="subnav__drawerHeader">
              <button
                type="button"
                className="subnav__drawerClose"
                onClick={() => setMenuOpen(false)}
                aria-label="Cerrar menú"
              >
                <X size={18} />
              </button>
            </div>

            <div className="subnav__drawerList">
              {items.map((item) => {
                const Icon = iconMap[item.icon]
                const active = isActive(item)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`subnav__drawerLink ${active ? 'active' : ''}`}
                  >
                    <div className="subnav__drawerLinkLeft">
                      {Icon ? <Icon className="subnav__icon" /> : null}
                      <span>{item.label}</span>
                    </div>

                    {active && <span className="subnav__drawerActiveMark" />}
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