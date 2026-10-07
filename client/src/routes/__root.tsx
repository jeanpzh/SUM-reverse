import { createRootRoute, Link } from '@tanstack/react-router'
import { Shell } from '../components/Shell'

export const Route = createRootRoute({
  component: Shell,
  notFoundComponent: () => (
    <div className="not-found">
      <h2>Página no encontrada</h2>
      <Link to="/alumnoWebSum/v2/inicio">Volver al inicio</Link>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="not-found">
      <h2>No se pudo mostrar la página</h2>
      <button onClick={reset}>Intentar de nuevo</button>
    </div>
  ),
})
