import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { navigation, routes, routeUrl, routeAt } from '../data/routes'
import { useShellStudent } from '../data/useShellStudent'
import { Icon } from './Common'

export function Shell({ children }: { children: ReactNode }) {
  const student = useShellStudent()
  const pathname = useLocation({ select: (location) => location.pathname })
  const active = routeAt(pathname) ?? routes[0]
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const closeMenus = () => {
    setExpanded(null)
    setAccountOpen(false)
  }
  return (
    <div className={`student-app ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <title>{`Sistema Único de Matrícula - ${active.title}`}</title>
      <aside
        id="student-sidebar"
        className="sidebar"
        aria-label="Navegación del estudiante"
        aria-hidden={collapsed}
        inert={collapsed}
      >
        <Link className="brand" to="/alumnoWebSum/v2/inicio" onClick={closeMenus}>
          <strong><i aria-hidden="true">S</i><span>SUM<small>UNMSM</small></span></strong>
        </Link>
        <nav aria-label="Menú principal">
          {navigation.map((item) => {
            const submenuId = `submenu-${item.label.toLowerCase().replaceAll(' ', '-')}`
            const isExpanded = expanded === item.label
            return (
            <div className="nav-group" key={item.label}>
              {item.id ? (
                <Link
                  className="nav-item"
                  activeProps={{ className: 'active' }}
                  activeOptions={{ exact: true }}
                  to={routeUrl(item.id)}
                  onClick={closeMenus}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <button
                  className={`nav-item ${item.children?.includes(active.id) ? 'active-group' : ''}`}
                  aria-expanded={isExpanded}
                  aria-controls={submenuId}
                  onClick={() =>
                    setExpanded((current) =>
                      current === item.label ? null : item.label,
                    )
                  }
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  <span className="chevron" aria-hidden="true">
                    {isExpanded ? '⌄' : '›'}
                  </span>
                </button>
              )}
              {item.children && (
                <div id={submenuId} className="subnav" hidden={!isExpanded}>
                  {item.children.map((id) => (
                    <Link
                      key={id}
                      activeProps={{ className: 'active' }}
                      to={routeUrl(id)}
                      onClick={closeMenus}
                    >
                      {item.childLabels?.[id] ?? routes.find((route) => route.id === id)!.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            )
          })}
        </nav>
      </aside>
      <header className="topbar">
        <button
          className="menu-toggle"
          aria-label={collapsed ? 'Mostrar menú' : 'Ocultar menú'}
          aria-expanded={!collapsed}
          aria-controls="student-sidebar"
          onClick={() => setCollapsed(!collapsed)}
        >
          <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
            <path d="M1 3h10M1 7h10M1 11h10" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
        <div className="header-right">
          <span className="session-clock">00:00:00</span>
          <div className="account-wrapper">
            {student.status === 'ready' ? (
              <>
                <button
                  className="account-button"
                  aria-expanded={accountOpen}
                  onClick={() => setAccountOpen(!accountOpen)}
                >
                  {student.student.name}
                  <span aria-hidden="true">⌄</span>
                </button>
                {accountOpen && (
                  <div className="account-menu">
                    <strong>{student.student.name}</strong>
                    <span>ALUMNO · {student.student.code}</span>
                    <Link to="/alumnoWebSum/v2/informacion/perfil" onClick={closeMenus}>
                      Mi Perfil
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <span>{student.status === 'pending' ? 'Cargando alumno…' : 'Información no disponible'}</span>
            )}
          </div>
          <button
            className="sign-out"
            disabled
            title="La demostración local no utiliza una sesión SUM"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2v10M6 5a9 9 0 1 0 12 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>{' '}
            Salir
          </button>
        </div>
      </header>
      <main key={active.id} className={`main-content screen-${active.id}`}>
        {children}
      </main>
    </div>
  )
}
