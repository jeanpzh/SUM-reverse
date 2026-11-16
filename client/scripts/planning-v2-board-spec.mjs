// Expected Planning v2 design values, sourced from the approved boards in
// docs/design/academic-planning-2026-11-16/boards/*.dc.html (and theme.css where a board has no
// light variant). Single source for acceptance scripts: extend this object in later tickets instead of
// scattering literals. Colors are computed-style strings with spaces removed (`rgb(10,10,10)`).
//
// Provenance comments name the board whose markup states the value.

const ink = 'rgb(10,10,10)'
const white = 'rgb(255,255,255)'
const fog = 'rgb(107,107,107)'
const steel = 'rgb(84,84,84)'
const dove = 'rgb(213,217,226)'
const controlBorder = 'rgb(138,143,153)'
const sand = 'rgb(242,237,229)'

export const BOARD_SPEC = Object.freeze({
  boards: 'docs/design/academic-planning-2026-11-16/boards (Main, Preparation, Resources, Review, Approval, Dark, States)',
  route: '/local/programacion-academica',
  viewport: { width: 1440, height: 1000 }, // Main/Preparation `$preview`
  overflowWidths: [360, 720, 1440], // handoff §4 acceptance (subset required by this script)

  colors: { ink, white, fog, steel, dove, controlBorder, sand },

  // Main: <header style="height:52px; padding:0 16px; border-bottom:1px solid #d5d9e2">
  scopeBar: {
    heightPx: 52,
    brand: 'Planificación académica',
    // Main: aria-label of the icon buttons / search input; ids from handoff §3.
    guideButtonName: 'Guía',
    searchLabel: 'Ir a curso, docente o ambiente',
    searchShortcut: '⌘K',
    proposalSwitcherId: 'planning-tour-proposals', // aria-haspopup="dialog"
    chatToggleId: 'planning-toggle-chat', // aria-pressed
    syntheticMarker: 'Datos sintéticos · local',
  },

  // Main/Preparation: <nav class="nav" aria-label="Etapas de la propuesta" style="flex:0 0 216px; ...">
  rail: {
    ariaLabel: 'Etapas de la propuesta',
    widthPx: 216,
    groups: [
      { eyebrow: 'Preparación', items: ['Oferta de cursos', 'Docentes y ambientes'] },
      { eyebrow: 'Programación', items: ['Horario', 'Revisión docente', 'Aprobación y publicación'] },
    ],
    moduleLink: '← Módulos',
    forbiddenItems: ['Resumen', 'Cursos'], // Resumen dropped (handoff §5.1)
    // .nav a{padding:6px 10px; border-radius:9999px; color:steel; font-weight:500}
    item: { color: steel, fontWeight: '500', radiusMinPx: 9999 },
    // .nav a[aria-current="page"]{color:ink; background:sand}
    current: { background: sand, color: ink },
  },

  // h1: font-weight 400; 30px/36px; letter-spacing -0.75px (all boards)
  title: { fontSizePx: 30, lineHeightPx: 36, fontWeight: '400', letterSpacing: '-0.75px', fontFamilyIncludes: 'Inter' },

  // .eyebrow{font-family:"Geist Mono"; 11px/16px; letter-spacing:0.04em; uppercase; color:fog}
  eyebrow: {
    fontFamilyIncludes: 'Geist Mono', fontSizePx: 11, lineHeightPx: 16,
    textTransform: 'uppercase', letterSpacing: '0.44px', color: fog,
  },

  // .btn{font-weight:500; 14px/20px; border-radius:9999px; padding:6px 14px} .btn-primary{background:ink; color:#fff}
  primary: {
    background: ink, color: white, radiusMinPx: 9999, fontSizePx: 14, fontWeight: '500',
    paddingY: 6, paddingX: 14, fontFamilyIncludes: 'Inter',
  },
  // .btn-ghost{background:transparent; box-shadow: inset 0 0 0 1px dove}
  ghost: { background: 'rgba(0,0,0,0)', radiusMinPx: 9999 },

  // .field{height:32px; border-radius:6px; border:1px solid #8a8f99; padding:0 10px; background:#fff}
  field: { heightPx: 32, radiusPx: 6, borderColor: controlBorder, borderWidthPx: 1, background: white },

  // :focus-visible{outline:2px solid #0a0a0a; outline-offset:2px}
  focus: { outlineStyle: 'solid', outlineWidthPx: 2, outlineColor: ink, outlineOffsetPx: 2 },

  // Result / readiness strip: border-radius 12px; padding 10px 16px; status word `.st` 13px/500 in the status color
  strip: { radiusPx: 12, paddingY: 10, paddingX: 16 },
  statusColors: {
    // Light values from theme.css (Main/Preparation boards show warning; Dark board shows the success layout).
    warning: { color: 'rgb(138,90,0)', background: 'rgb(251,243,226)' },
    success: { color: 'rgb(26,127,55)', background: 'rgb(238,246,239)' },
    danger: { color: 'rgb(180,35,24)', background: 'rgb(253,238,236)' },
  },

  // Per-stage copy. `eyebrow*` is the mono line above the h1.
  stages: {
    preparacion: {
      label: 'Oferta de cursos', title: 'Oferta de cursos', // Preparation
      // Preparation: fresh, ungenerated, unsaved state.
      eyebrowFresh: 'Paso 1 de 4 · cambios en memoria hasta guardar',
      eyebrowPrefix: 'Paso 1 de 4 · ',
      primaryLabel: 'Generar propuesta',
      secondaryLabels: ['Opciones de generación', 'Guardar'],
      selectAllButton: /^Seleccionar los \d+ cursos del catálogo$/, // States board 03
      strip: {
        ariaLabel: 'Lista de preparación',
        factsPattern: /\d+ docentes · \d+ ambientes/,
        states: {
          incomplete: { label: 'Oferta incompleta', tone: 'warning' }, // Preparation
          ready: { label: 'Oferta lista para generar', tone: 'success', disclosure: 'Ver resumen' }, // Dark
        },
      },
    },
    recursos: {
      label: 'Docentes y ambientes', title: 'Docentes y ambientes', // Resources
      eyebrowPrefix: 'Paso 1 de 4 · ',
    },
    horario: {
      label: 'Horario', title: 'Horario', // Main
      eyebrowPattern: /^.+ · versión \d+ · .+$/, // "Propuesta base 2027-I · versión 4 · cambios sin guardar"
      saveLabel: 'Guardar',
      searchPlaceholder: 'Buscar curso, sección o aula',
      teacherFilterName: 'Docente',
      viewGroup: { name: 'Vista', options: ['Tabla', 'Semana'] },
      tableName: 'Secciones de la propuesta',
      columns: ['Curso', 'Secc.', 'Componente', 'Docente', 'Ambiente', 'Día y hora', 'Estado'],
    },
    revision: { label: 'Revisión docente', title: 'Revisión docente' }, // Review
    aprobacion: { label: 'Aprobación y publicación', title: 'Aprobación y publicación' }, // Approval
  },
})
