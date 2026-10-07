import { useStudent } from '../data/useStudent'
import { useState } from 'react'
import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { navigation, routes, routeUrl, routeAt } from '../data/routes'
import { Icon } from './Common'

export function Shell() {
  const student = useStudent()
  const pathname = useLocation({ select: (location) => location.pathname })
  const active = routeAt(pathname) ?? routes[0]
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState<string[]>([])
  const [accountOpen, setAccountOpen] = useState(false)
  const closeMenus = () => {
    setExpanded([])
    setAccountOpen(false)
  }
  return (
    <div className={`student-app ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <title>{`Sistema Único de Matrícula - ${active.title}`}</title>
      <aside className="sidebar" aria-label="Navegación del estudiante">
        <Link className="brand" to="/alumnoWebSum/v2/inicio" onClick={closeMenus}>
          <strong>SUM</strong>
          <span>Sistema Único de Matrícula</span>
        </Link>
        <nav>
          {navigation.map((item) => (
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
                  aria-expanded={expanded.includes(item.label)}
                  onClick={() =>
                    setExpanded((current) =>
                      current.includes(item.label)
                        ? current.filter((label) => label !== item.label)
                        : [...current, item.label],
                    )
                  }
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  <span className="chevron" aria-hidden="true">
                    {expanded.includes(item.label) ? '⌄' : '‹'}
                  </span>
                </button>
              )}
              {item.children && expanded.includes(item.label) && (
                <div className="subnav">
                  {item.children.map((id) => (
                    <Link
                      key={id}
                      activeProps={{ className: 'active' }}
                      to={routeUrl(id)}
                      onClick={closeMenus}
                    >
                      {routes.find((route) => route.id === id)!.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>
      <header className="topbar">
        <button
          className="menu-toggle"
          aria-label={collapsed ? 'Mostrar menú' : 'Ocultar menú'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
            <path d="M1 3h10M1 7h10M1 11h10" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
        <div className="header-right">
          <span className="session-clock">00:00:00</span>
          <div className="account-wrapper">
            <button
              className="account-button"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen(!accountOpen)}
            >
              {student.name}
              <span aria-hidden="true">⌄</span>
            </button>
            {accountOpen && (
              <div className="account-menu">
                <strong>{student.name}</strong>
                <span>ALUMNO · {student.code}</span>
                <Link to="/alumnoWebSum/v2/informacion/perfil" onClick={closeMenus}>
                  Mi Perfil
                </Link>
              </div>
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
        <Outlet />
      </main>
    </div>
  )
}
