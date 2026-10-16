import type { StudentSummaryData } from '../../src/data/adapters'

// SSR-only stand-in for the shell root-loader hook: synthetic, no router, no network, no snapshot.
export function useStudent(): StudentSummaryData {
  return {
    name: 'ESTUDIANTE SINTETICO DEMO', code: 'SYN-SHELL-001', period: '2026-II',
    faculty: 'Facultad de demostración', program: 'Programa de prueba',
    specialty: 'Especialidad sintética', plan: 'SYN-SHELL-PLAN - Plan sintético',
  }
}
