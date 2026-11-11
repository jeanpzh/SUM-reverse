import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleCheck, CircleAlert, CircleMinus } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs'
import type { AcademicCatalog } from '../data/academicScheduling.ts'
import { filterAcademicResources, formatAcademicInterval, PLANNING_LIMITS } from '../data/academicScheduling.ts'
import type {
  AcademicInterval,
  AcademicPlanningResources,
  AcademicProposal,
  AcademicRoomResource,
  AcademicTeacherResource,
} from '../../../shared/programacion-academica-api.mjs'
import {
  applyBulkIncorporateRooms,
  applyBulkIncorporateTeachers,
  applyBulkRemoveRooms,
  applyBulkRemoveTeachers,
  buildBulkIncorporateRoomPreview,
  buildBulkIncorporateTeacherPreview,
  buildBulkRemovePreview,
  buildUnifiedRooms,
  buildUnifiedTeachers,
  calculateAssignedTeacherMinutes,
  calculateRoomCounts,
  calculateTeacherCounts,
  filterUnifiedRooms,
  filterUnifiedTeachers,
  formatAvailabilitySummary,
} from '../data/academicResources.ts'
import { Dialog, DialogContent, DialogTitle } from '../components/ui/Dialog'
import { Sheet, SheetContent, SheetTitle } from '../components/ui/Sheet'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Checkbox } from '../components/ui/Checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/Collapsible'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { NativeSelect } from '../components/ui/NativeSelect'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table'
import { LectiveHourSelect, TeacherLoadFields } from './PlanningTeacherLoad'
import type { LectiveHourMinutes } from '../../../shared/academic-normative-profile.mjs'
import './AcademicResourceEditor.css'

export type AcademicResourceEditorProps = {
  catalog: AcademicCatalog
  resources: AcademicPlanningResources
  onChange: (resources: AcademicPlanningResources) => void
  isLocked?: boolean
  proposal?: AcademicProposal | null
  academicPeriod?: string
  lectiveHourMinutes?: LectiveHourMinutes
  onLectiveHourMinutesChange?: (value: LectiveHourMinutes | undefined) => void
  // Opens a teacher's inspector at the authorizations, or filters the teachers eligible for the given courses (decision queue actions).
  focus?: { token: number; teacherId?: string; courseIds?: string[] } | null
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function timeValue(minute: number) {
  if (!Number.isFinite(minute)) return ''
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

function timeMinute(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function nextId(prefix: string, current: Array<{ id: string }>) {
  let index = current.length + 1
  while (current.some((item) => item.id === `${prefix}-LOCAL-${index}`)) index += 1
  return `${prefix}-LOCAL-${index}`
}

function updateInterval(intervals: AcademicInterval[], index: number, patch: Partial<AcademicInterval>) {
  return intervals.map((interval, itemIndex) => (itemIndex === index ? { ...interval, ...patch } : interval))
}

function cloneResources(resources: AcademicPlanningResources): AcademicPlanningResources {
  return {
    teachers: resources.teachers.map((teacher) => ({
      ...teacher,
      courseIds: [...teacher.courseIds],
      availability: teacher.availability.map((interval) => ({ ...interval })),
      ...(teacher.preferences ? { preferences: teacher.preferences.map((interval) => ({ ...interval })) } : {}),
      ...(teacher.sectionLimits ? { sectionLimits: teacher.sectionLimits.map((limit) => ({ ...limit })) } : {}),
    })),
    rooms: resources.rooms.map((room) => ({
      ...room,
      availability: room.availability.map((interval) => ({ ...interval })),
    })),
  }
}

export function AcademicResourceEditor({
  catalog,
  resources,
  onChange,
  isLocked = false,
  proposal,
  academicPeriod = '2027-I',
  lectiveHourMinutes,
  onLectiveHourMinutesChange,
  focus,
}: AcademicResourceEditorProps) {
  const [activeTab, setActiveTab] = useState<'teachers' | 'rooms'>('teachers')

  // Requirement: ZERO resource inspectors open on initial entry!
  const [inspectedTeacherId, setInspectedTeacherId] = useState<string | null>(null)
  const [inspectedRoomId, setInspectedRoomId] = useState<string | null>(null)

  // Filters & Search
  const [teacherSearch, setTeacherSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState<string[]>([])
  const [roomSearch, setRoomSearch] = useState('')
  const [teacherInclusionFilter, setTeacherInclusionFilter] = useState<'all' | 'included' | 'reference'>('all')
  const [roomInclusionFilter, setRoomInclusionFilter] = useState<'all' | 'included' | 'reference'>('all')
  const [roomKindFilter, setRoomKindFilter] = useState<'all' | 'classroom' | 'laboratory'>('all')

  // Multi-Selection
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([])
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([])

  // Errors & Fieldset searches
  const [teacherIdError, setTeacherIdError] = useState('')
  const [roomIdError, setRoomIdError] = useState('')
  const [courseSearch, setCourseSearch] = useState('')

  // Modals for bulk preview
  const [activeModal, setActiveModal] = useState<
    'incorporate-teacher' | 'incorporate-room' | 'remove-teacher' | 'remove-room' | null
  >(null)
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null)
  const modalFirstControlRef = useRef<HTMLButtonElement | null>(null)

  // References mapping (tracks changes in ID to preserve correspondence)
  const [teacherReferenceIds, setTeacherReferenceIds] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      resources.teachers.flatMap((teacher) =>
        catalog.referenceTeachers?.some((reference) => reference.id === teacher.id) ? [[teacher.id, teacher.id]] : [],
      ),
    ),
  )
  const [roomReferenceIds, setRoomReferenceIds] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      resources.rooms.flatMap((room) =>
        catalog.referenceRooms?.some((reference) => reference.id === room.id) ? [[room.id, room.id]] : [],
      ),
    ),
  )

  // Decision queue actions: open a teacher's authorizations, or list the teachers eligible for a course.
  const focusToken = focus?.token
  const [appliedFocusToken, setAppliedFocusToken] = useState<number | undefined>(undefined)
  if (focus && focusToken !== appliedFocusToken) {
    setAppliedFocusToken(focusToken)
    setActiveTab('teachers')
    if (focus.teacherId) {
      setCourseFilter([])
      setInspectedTeacherId(focus.teacherId)
    } else {
      setCourseFilter(focus.courseIds ?? [])
      setTeacherInclusionFilter('all')
      setTeacherSearch('')
    }
  }
  const focusTeacherId = focus?.teacherId
  useEffect(() => {
    if (focusToken === undefined || !focusTeacherId) return
    const timer = window.setTimeout(() => document.getElementById('teacher-load-reference')?.focus(), 250)
    return () => window.clearTimeout(timer)
  }, [focusToken, focusTeacherId])

  // Build unified lists
  const unifiedTeachers = useMemo(
    () => buildUnifiedTeachers(catalog.referenceTeachers, resources.teachers, teacherReferenceIds),
    [catalog.referenceTeachers, resources.teachers, teacherReferenceIds],
  )
  const unifiedRooms = useMemo(
    () => buildUnifiedRooms(catalog.referenceRooms, resources.rooms, roomReferenceIds),
    [catalog.referenceRooms, resources.rooms, roomReferenceIds],
  )

  // Filtered lists
  const filteredTeachers = useMemo(
    () => filterUnifiedTeachers(unifiedTeachers, teacherSearch, teacherInclusionFilter)
      .filter((teacher) => courseFilter.length === 0 || courseFilter.some((courseId) => teacher.courseIds.includes(courseId))),
    [unifiedTeachers, teacherSearch, teacherInclusionFilter, courseFilter],
  )
  const filteredRooms = useMemo(
    () => filterUnifiedRooms(unifiedRooms, roomSearch, roomKindFilter, roomInclusionFilter),
    [unifiedRooms, roomSearch, roomKindFilter, roomInclusionFilter],
  )

  // Legacy filtered reference teachers for select dropdown
  const filteredReferenceTeachers = useMemo(
    () => filterAcademicResources(catalog.referenceTeachers ?? [], teacherSearch),
    [catalog.referenceTeachers, teacherSearch],
  )

  // Counters
  const teacherCounts = useMemo(
    () => calculateTeacherCounts(catalog.referenceTeachers?.length ?? 0, resources.teachers.length, filteredTeachers.length),
    [catalog.referenceTeachers, resources.teachers.length, filteredTeachers.length],
  )
  const roomCounts = useMemo(
    () => calculateRoomCounts(catalog.referenceRooms?.length ?? 0, resources.rooms.length, filteredRooms.length),
    [catalog.referenceRooms, resources.rooms.length, filteredRooms.length],
  )

  // Active inspected items
  const inspectedTeacher = useMemo(() => {
    if (!inspectedTeacherId) return null
    return unifiedTeachers.find((t) => t.id === inspectedTeacherId) ?? null
  }, [inspectedTeacherId, unifiedTeachers])

  const inspectedRoom = useMemo(() => {
    if (!inspectedRoomId) return null
    return unifiedRooms.find((r) => r.id === inspectedRoomId) ?? null
  }, [inspectedRoomId, unifiedRooms])

  // Single active resource inspector:
  // Switching tabs closes the open card without mutations!
  const handleTabChange = (tab: 'teachers' | 'rooms') => {
    setActiveTab(tab)
    setInspectedTeacherId(null)
    setInspectedRoomId(null)
    setTeacherIdError('')
    setRoomIdError('')
  }

  // Open / Close inspector:
  const openTeacherInspector = (id: string) => {
    setInspectedRoomId(null) // Only one inspector across teacher/room views!
    setInspectedTeacherId(id)
    setTeacherIdError('')
  }

  const openRoomInspector = (id: string) => {
    setInspectedTeacherId(null) // Only one inspector across teacher/room views!
    setInspectedRoomId(id)
    setRoomIdError('')
  }

  const closeInspector = () => {
    setInspectedTeacherId(null)
    setInspectedRoomId(null)
    setTeacherIdError('')
    setRoomIdError('')
  }

  // Mutating commit helper
  const commit = (update: (draft: AcademicPlanningResources) => void) => {
    if (isLocked) return
    const draft = cloneResources(resources)
    update(draft)
    onChange(draft)
  }

  // Teacher changes
  const changeTeacher = (patch: Partial<AcademicTeacherResource>) => {
    if (isLocked || !inspectedTeacherId) return
    const current = resources.teachers.find((t) => t.id === inspectedTeacherId)
    if (!current) return
    const oldId = current.id

    if (patch.id !== undefined && patch.id !== oldId) {
      if (resources.teachers.some((teacher) => teacher.id !== oldId && teacher.id === patch.id)) {
        setTeacherIdError('Esa identificación ya está asignada a otro docente.')
        return
      }
      setTeacherIdError('')
      setTeacherReferenceIds((prev) =>
        Object.fromEntries(Object.entries(prev).map(([id, refId]) => [id === oldId ? patch.id! : id, refId])),
      )
      setInspectedTeacherId(patch.id)
    }

    commit((draft) => {
      draft.teachers = draft.teachers.map((t) => (t.id === oldId ? { ...t, ...patch } : t))
    })
  }

  // Replaces the whole teacher (not a merge): the regulatory helpers delete optional keys instead of leaving undefined values.
  const replaceTeacher = (next: AcademicTeacherResource) => {
    if (isLocked || !inspectedTeacherId) return
    commit((draft) => {
      draft.teachers = draft.teachers.map((t) => (t.id === inspectedTeacherId ? next : t))
    })
  }

  // Room changes
  const changeRoom = (patch: Partial<AcademicRoomResource>) => {
    if (isLocked || !inspectedRoomId) return
    const current = resources.rooms.find((r) => r.id === inspectedRoomId)
    if (!current) return
    const oldId = current.id

    if (patch.id !== undefined && patch.id !== oldId) {
      if (resources.rooms.some((room) => room.id !== oldId && room.id === patch.id)) {
        setRoomIdError('Esa identificación ya está asignada a otro ambiente.')
        return
      }
      setRoomIdError('')
      setRoomReferenceIds((prev) =>
        Object.fromEntries(Object.entries(prev).map(([id, refId]) => [id === oldId ? patch.id! : id, refId])),
      )
      setInspectedRoomId(patch.id)
    }

    commit((draft) => {
      draft.rooms = draft.rooms.map((r) => (r.id === oldId ? { ...r, ...patch } : r))
    })
  }

  // Single resource incorporate from reference card
  const handleIncorporateSingleTeacher = (refId: string) => {
    if (isLocked || resources.teachers.length >= PLANNING_LIMITS.teachers) return
    const ref = catalog.referenceTeachers?.find((t) => t.id === refId)
    if (!ref) return

    const newTeacher: AcademicTeacherResource = {
      id: ref.id,
      name: ref.name,
      courseIds: [...(ref.courseIds ?? [])],
      maxWeeklyMinutes: 600,
      availability: [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 })),
    }

    commit((draft) => {
      draft.teachers.push(newTeacher)
    })
    setTeacherReferenceIds((prev) => ({ ...prev, [newTeacher.id]: ref.id }))
    setTeacherIdError('')
    setInspectedTeacherId(newTeacher.id)
  }

  const handleIncorporateSingleRoom = (refId: string) => {
    if (isLocked || resources.rooms.length >= PLANNING_LIMITS.rooms) return
    const ref = catalog.referenceRooms?.find((r) => r.id === refId)
    if (!ref) return

    const newRoom: AcademicRoomResource = {
      id: ref.id,
      name: ref.name,
      capacity: ref.capacity ?? 45,
      kind: ref.kind,
      availability: [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 })),
    }

    commit((draft) => {
      draft.rooms.push(newRoom)
    })
    setRoomReferenceIds((prev) => ({ ...prev, [newRoom.id]: ref.id }))
    setRoomIdError('')
    setInspectedRoomId(newRoom.id)
  }

  // Remove single
  const removeTeacher = (idToRemove: string) => {
    if (isLocked) return
    const remaining = resources.teachers.filter((t) => t.id !== idToRemove)
    commit((draft) => {
      draft.teachers = remaining
    })
    setTeacherReferenceIds((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== idToRemove)))
    if (inspectedTeacherId === idToRemove) {
      setInspectedTeacherId(null)
    }
  }

  const removeRoom = (idToRemove: string) => {
    if (isLocked) return
    const remaining = resources.rooms.filter((r) => r.id !== idToRemove)
    commit((draft) => {
      draft.rooms = remaining
    })
    setRoomReferenceIds((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== idToRemove)))
    if (inspectedRoomId === idToRemove) {
      setInspectedRoomId(null)
    }
  }

  // Add local demonstration
  const addTeacher = () => {
    if (isLocked || resources.teachers.length >= PLANNING_LIMITS.teachers) return
    const teacher: AcademicTeacherResource = {
      id: nextId('DOC', resources.teachers),
      name: 'Docente de demostración',
      courseIds: [],
      maxWeeklyMinutes: 600,
      availability: [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 })),
    }
    commit((draft) => {
      draft.teachers.push(teacher)
    })
    setTeacherIdError('')
    openTeacherInspector(teacher.id)
  }

  const addRoom = (kind: 'classroom' | 'laboratory' = 'classroom') => {
    if (isLocked || resources.rooms.length >= PLANNING_LIMITS.rooms) return
    const room: AcademicRoomResource = {
      id: nextId('AULA', resources.rooms),
      name: kind === 'laboratory' ? 'Laboratorio de demostración' : 'Aula de demostración',
      capacity: 45,
      kind,
      availability: [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 })),
    }
    commit((draft) => {
      draft.rooms.push(room)
    })
    setRoomIdError('')
    openRoomInspector(room.id)
  }

  // Legacy quick select
  const selectReferenceTeacher = (id: string) => {
    if (!id || isLocked) return
    const existingId =
      Object.entries(teacherReferenceIds).find(([, refId]) => refId === id)?.[0] ??
      resources.teachers.find((t) => t.id === id)?.id

    if (existingId !== undefined) {
      setTeacherIdError('')
      openTeacherInspector(existingId)
      return
    }

    const reference = catalog.referenceTeachers?.find((t) => t.id === id)
    if (!reference || resources.teachers.length >= PLANNING_LIMITS.teachers) return

    const teacher: AcademicTeacherResource = {
      ...reference,
      courseIds: [...(reference.courseIds ?? [])],
      maxWeeklyMinutes: 600,
      availability: [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 })),
    }
    commit((draft) => {
      draft.teachers.push(teacher)
    })
    setTeacherReferenceIds((prev) => ({ ...prev, [teacher.id]: id }))
    setTeacherIdError('')
    openTeacherInspector(teacher.id)
  }

  const selectReferenceRoom = (id: string) => {
    if (!id || isLocked) return
    const existingId =
      Object.entries(roomReferenceIds).find(([, refId]) => refId === id)?.[0] ??
      resources.rooms.find((r) => r.id === id)?.id

    if (existingId !== undefined) {
      setRoomIdError('')
      openRoomInspector(existingId)
      return
    }

    const reference = catalog.referenceRooms?.find((r) => r.id === id)
    if (!reference || resources.rooms.length >= PLANNING_LIMITS.rooms) return

    const room: AcademicRoomResource = {
      id: reference.id,
      name: reference.name,
      capacity: reference.capacity,
      kind: reference.kind,
      availability: [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 })),
    }
    commit((draft) => {
      draft.rooms.push(room)
    })
    setRoomReferenceIds((prev) => ({ ...prev, [room.id]: id }))
    setRoomIdError('')
    openRoomInspector(room.id)
  }

  // Course eligibility options inside teacher inspector
  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLocaleLowerCase('es')
    return catalog.courses.filter(
      (course) => !query || `${course.courseId} ${course.name}`.toLocaleLowerCase('es').includes(query),
    )
  }, [catalog.courses, courseSearch])

  // Multi-Selection Bulk Preview calculations
  const teacherIncorporatePreview = useMemo(() => {
    if (activeModal !== 'incorporate-teacher') return null
    return buildBulkIncorporateTeacherPreview(selectedTeacherIds, unifiedTeachers, resources.teachers.length)
  }, [activeModal, selectedTeacherIds, unifiedTeachers, resources.teachers.length])

  const roomIncorporatePreview = useMemo(() => {
    if (activeModal !== 'incorporate-room') return null
    return buildBulkIncorporateRoomPreview(selectedRoomIds, unifiedRooms, resources.rooms.length)
  }, [activeModal, selectedRoomIds, unifiedRooms, resources.rooms.length])

  const teacherRemovePreview = useMemo(() => {
    if (activeModal !== 'remove-teacher') return null
    return buildBulkRemovePreview(selectedTeacherIds, unifiedTeachers)
  }, [activeModal, selectedTeacherIds, unifiedTeachers])

  const roomRemovePreview = useMemo(() => {
    if (activeModal !== 'remove-room') return null
    return buildBulkRemovePreview(selectedRoomIds, unifiedRooms)
  }, [activeModal, selectedRoomIds, unifiedRooms])

  // Modal open / close handlers with accessible focus trap
  const openModal = (
    modalType: 'incorporate-teacher' | 'incorporate-room' | 'remove-teacher' | 'remove-room',
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    triggerButtonRef.current = event.currentTarget
    setActiveModal(modalType)
  }

  const closeModal = () => {
    setActiveModal(null)
    if (triggerButtonRef.current) {
      triggerButtonRef.current.focus()
    }
  }

  const focusModalFirstControl = (event: Event) => {
    if (!modalFirstControlRef.current) return
    event.preventDefault()
    modalFirstControlRef.current.focus()
  }

  // Confirming bulk incorporate
  const confirmBulkIncorporateTeachers = () => {
    if (isLocked) return
    const { teachers, referenceMapping } = applyBulkIncorporateTeachers(
      selectedTeacherIds,
      resources.teachers,
      catalog.referenceTeachers,
      teacherReferenceIds,
    )
    commit((draft) => {
      draft.teachers = teachers
    })
    setTeacherReferenceIds(referenceMapping)
    setSelectedTeacherIds([])
    closeModal()
  }

  const confirmBulkIncorporateRooms = () => {
    if (isLocked) return
    const { rooms, referenceMapping } = applyBulkIncorporateRooms(
      selectedRoomIds,
      resources.rooms,
      catalog.referenceRooms,
      roomReferenceIds,
    )
    commit((draft) => {
      draft.rooms = rooms
    })
    setRoomReferenceIds(referenceMapping)
    setSelectedRoomIds([])
    closeModal()
  }

  // Confirming bulk remove
  const confirmBulkRemoveTeachers = () => {
    if (isLocked) return
    const { teachers, referenceMapping } = applyBulkRemoveTeachers(
      selectedTeacherIds,
      resources.teachers,
      teacherReferenceIds,
    )
    commit((draft) => {
      draft.teachers = teachers
    })
    setTeacherReferenceIds(referenceMapping)
    if (inspectedTeacherId && selectedTeacherIds.includes(inspectedTeacherId)) {
      setInspectedTeacherId(null)
    }
    setSelectedTeacherIds([])
    closeModal()
  }

  const confirmBulkRemoveRooms = () => {
    if (isLocked) return
    const { rooms, referenceMapping } = applyBulkRemoveRooms(
      selectedRoomIds,
      resources.rooms,
      roomReferenceIds,
    )
    commit((draft) => {
      draft.rooms = rooms
    })
    setRoomReferenceIds(referenceMapping)
    if (inspectedRoomId && selectedRoomIds.includes(inspectedRoomId)) {
      setInspectedRoomId(null)
    }
    setSelectedRoomIds([])
    closeModal()
  }

  // Toggle selections
  const toggleTeacherSelect = (id: string) => {
    setSelectedTeacherIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const toggleRoomSelect = (id: string) => {
    setSelectedRoomIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const selectAllVisibleTeachers = () => {
    const visibleIds = filteredTeachers.map((t) => t.id)
    setSelectedTeacherIds((prev) => [...new Set([...prev, ...visibleIds])])
  }

  const deselectVisibleTeachers = () => {
    const visibleSet = new Set(filteredTeachers.map((t) => t.id))
    setSelectedTeacherIds((prev) => prev.filter((id) => !visibleSet.has(id)))
  }

  const selectAllVisibleRooms = () => {
    const visibleIds = filteredRooms.map((r) => r.id)
    setSelectedRoomIds((prev) => [...new Set([...prev, ...visibleIds])])
  }

  const deselectVisibleRooms = () => {
    const visibleSet = new Set(filteredRooms.map((r) => r.id))
    setSelectedRoomIds((prev) => prev.filter((id) => !visibleSet.has(id)))
  }


  return (
    <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as 'teachers' | 'rooms')} className="academic-scheduling__resource-editor academic-resource-workbench">
      <TabsList className="academic-resource-workbench__tabs" aria-label="Vistas de recursos">
        <TabsTrigger value="teachers">Docentes ({teacherCounts.included})</TabsTrigger>
        <TabsTrigger value="rooms">Aulas y laboratorios ({roomCounts.included})</TabsTrigger>
      </TabsList>
      <TabsContent value={activeTab} className="academic-resource-workbench__tab-content">
      {/* Heading */}
      {activeTab === 'teachers' && onLectiveHourMinutesChange && <LectiveHourSelect value={lectiveHourMinutes} disabled={isLocked} onChange={onLectiveHourMinutesChange} />}
      {activeTab === 'teachers' && courseFilter.length > 0 && <p className="academic-resource-workbench__resource-note" role="status">
        Docentes habilitados para {courseFilter.join(', ')}: la cola de decisiones indica que faltan horas docentes en esos cursos. Incorpora un docente de referencia o habilita a uno existente.{' '}
        <Button type="button" size="sm" variant="outline" onClick={() => setCourseFilter([])}>Quitar filtro de curso</Button>
      </p>}
      <div className="academic-resource-workbench__header">
        <p className="academic-resource-workbench__subtitle">
          {activeTab === 'teachers'
            ? 'Los nombres y disponibilidades de referencia son supuestos sintéticos; no confirman asignaciones institucionales para el nuevo periodo.'
            : 'Los ambientes y su disponibilidad son sintéticos; el tipo no agrega requisitos de equipamiento por sesión ni confirma asignaciones institucionales.'}
        </p>
      </div>

      {/* Toolbar: Search, Filters, Multi-actions & Under-demand additions */}
      <div className="academic-resource-workbench__toolbar">
        <div className="academic-resource-workbench__toolbar-row">
          {activeTab === 'teachers' ? (
            <>
              <div className="academic-resource-workbench__search-field">
                <Label className="sr-only" htmlFor="search-teachers-input">Buscar docente</Label>
                <Input
                  id="search-teachers-input"
                  type="search"
                  aria-label="Buscar docentes por nombre o código"
                  placeholder="Buscar por nombre o código"
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.currentTarget.value)}
                />
              </div>
              <div className="academic-resource-workbench__filter-field">
                <Label className="sr-only" htmlFor="filter-teachers-inclusion">Filtrar por inclusión</Label>
                <NativeSelect
                  id="filter-teachers-inclusion"
                  aria-label="Filtrar docentes por inclusión"
                  value={teacherInclusionFilter}
                  onChange={(e) => setTeacherInclusionFilter(e.currentTarget.value as 'all' | 'included' | 'reference')}
                >
                  <option value="all">Todos los docentes</option>
                  <option value="included">Solo incorporados</option>
                  <option value="reference">Solo referencias no incorporadas</option>
                </NativeSelect>
              </div>
            </>
          ) : (
            <>
              <div className="academic-resource-workbench__search-field">
                <Label className="sr-only" htmlFor="search-rooms-input">Buscar ambiente</Label>
                <Input
                  id="search-rooms-input"
                  type="search"
                  aria-label="Buscar ambientes por nombre o código"
                  placeholder="Buscar por nombre o código"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.currentTarget.value)}
                />
              </div>
              <div className="academic-resource-workbench__filter-field">
                <Label className="sr-only" htmlFor="filter-rooms-kind">Tipo de ambiente</Label>
                <NativeSelect
                  id="filter-rooms-kind"
                  aria-label="Filtrar por tipo de ambiente"
                  value={roomKindFilter}
                  onChange={(e) => setRoomKindFilter(e.currentTarget.value as 'all' | 'classroom' | 'laboratory')}
                >
                  <option value="all">Todos los tipos</option>
                  <option value="classroom">Aulas</option>
                  <option value="laboratory">Laboratorios</option>
                </NativeSelect>
              </div>
              <div className="academic-resource-workbench__filter-field">
                <Label className="sr-only" htmlFor="filter-rooms-inclusion">Filtrar por inclusión</Label>
                <NativeSelect
                  id="filter-rooms-inclusion"
                  aria-label="Filtrar ambientes por inclusión"
                  value={roomInclusionFilter}
                  onChange={(e) => setRoomInclusionFilter(e.currentTarget.value as 'all' | 'included' | 'reference')}
                >
                  <option value="all">Todos los ambientes</option>
                  <option value="included">Solo incorporados</option>
                  <option value="reference">Solo referencias no incorporadas</option>
                </NativeSelect>
              </div>
            </>
          )}

          {/* Legacy select for test backward compatibility */}
          {activeTab === 'teachers' ? (
            <NativeSelect
              aria-label="Seleccionar o agregar docente"
              className="academic-resource-workbench__legacy-select"
              value=""
              disabled={isLocked}
              onChange={(e) => selectReferenceTeacher(e.currentTarget.value)}
            >
              <option value="">Seleccionar o agregar docente…</option>
              {!filteredReferenceTeachers.length && <option value="" disabled>Sin docentes que coincidan</option>}
              {filteredReferenceTeachers.map((teacher) => (
                <option
                  key={teacher.id}
                  value={teacher.id}
                  disabled={
                    resources.teachers.length >= PLANNING_LIMITS.teachers &&
                    !Object.values(teacherReferenceIds).includes(teacher.id) &&
                    !resources.teachers.some((item) => item.id === teacher.id)
                  }
                >
                  {teacher.name} · {teacher.id}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <NativeSelect
              aria-label="Seleccionar o agregar ambiente"
              className="academic-resource-workbench__legacy-select"
              value=""
              disabled={isLocked}
              onChange={(e) => selectReferenceRoom(e.currentTarget.value)}
            >
              <option value="">Seleccionar o agregar ambiente…</option>
              {(catalog.referenceRooms ?? []).map((room) => (
                <option
                  key={room.id}
                  value={room.id}
                  disabled={
                    resources.rooms.length >= PLANNING_LIMITS.rooms &&
                    !Object.values(roomReferenceIds).includes(room.id) &&
                    !resources.rooms.some((item) => item.id === room.id)
                  }
                >
                  {room.id} · {room.name} · {room.pavilion}
                </option>
              ))}
            </NativeSelect>
          )}

        {/* Action buttons: Bulk selection & Add demo */}
        <div className="academic-resource-workbench__toolbar-actions">
          {activeTab === 'teachers' ? (
            <>
              {selectedTeacherIds.length > 0 && (
              <Button
                variant="outline"
                type="button"
                disabled={isLocked || selectedTeacherIds.length === 0}
                onClick={(e) => openModal('incorporate-teacher', e)}
                aria-haspopup="dialog"
              >
                Incorporar seleccionados ({selectedTeacherIds.length})
              </Button>
              )}
              {selectedTeacherIds.length > 0 && (
              <Button
                variant="outline"
                type="button"
                disabled={isLocked || selectedTeacherIds.length === 0}
                onClick={(e) => openModal('remove-teacher', e)}
                aria-haspopup="dialog"
              >
                Retirar seleccionados ({selectedTeacherIds.length})
              </Button>
              )}
              <Button
                variant="outline"
                type="button"
                disabled={filteredTeachers.length === 0}
                onClick={selectAllVisibleTeachers}
              >
                Seleccionar visibles
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={selectedTeacherIds.length === 0}
                onClick={deselectVisibleTeachers}
              >
                Deseleccionar visibles
              </Button>
              <Button
                variant="link"
                type="button"
                onClick={addTeacher}
                disabled={isLocked || resources.teachers.length >= PLANNING_LIMITS.teachers}
              >
                Agregar demostración
              </Button>
            </>
          ) : (
            <>
              {selectedRoomIds.length > 0 && (
              <Button
                variant="outline"
                type="button"
                disabled={isLocked || selectedRoomIds.length === 0}
                onClick={(e) => openModal('incorporate-room', e)}
                aria-haspopup="dialog"
              >
                Incorporar seleccionados ({selectedRoomIds.length})
              </Button>
              )}
              {selectedRoomIds.length > 0 && (
              <Button
                variant="outline"
                type="button"
                disabled={isLocked || selectedRoomIds.length === 0}
                onClick={(e) => openModal('remove-room', e)}
                aria-haspopup="dialog"
              >
                Retirar seleccionados ({selectedRoomIds.length})
              </Button>
              )}
              <Button
                variant="outline"
                type="button"
                disabled={filteredRooms.length === 0}
                onClick={selectAllVisibleRooms}
              >
                Seleccionar visibles
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={selectedRoomIds.length === 0}
                onClick={deselectVisibleRooms}
              >
                Deseleccionar visibles
              </Button>
              <Button
                variant="link"
                type="button"
                onClick={() => addRoom('classroom')}
                disabled={isLocked || resources.rooms.length >= PLANNING_LIMITS.rooms}
              >
                Agregar aula
              </Button>
              <Button
                variant="link"
                type="button"
                onClick={() => addRoom('laboratory')}
                disabled={isLocked || resources.rooms.length >= PLANNING_LIMITS.rooms}
              >
                Agregar laboratorio
              </Button>
            </>
          )}
        </div>
      </div>

      </div>
      <p className="academic-resource-workbench__counters" role="status" aria-label="Contadores de recursos">
        {activeTab === 'teachers' ? teacherCounts.references : roomCounts.references} referencias del catálogo · {activeTab === 'teachers' ? teacherCounts.included : roomCounts.included} incorporados en borrador · {activeTab === 'teachers' ? teacherCounts.visible : roomCounts.visible} visibles
      </p>

      {/* Searchable table; at most one resource sheet (Sheet overlay) */}
      <div className="academic-resource-workbench__split">
        {/* Table Pane */}
        <div className="academic-resource-workbench__table-pane">
          <div
            className="academic-resource-workbench__scroll-region"
            role="region"
            aria-label={activeTab === 'teachers' ? 'Tabla de docentes' : 'Tabla de ambientes'}
          >
            {activeTab === 'teachers' ? (
              <Table stickyHeader tabIndex={0} className="academic-resource-table" aria-label="Docentes">
                <TableHeader>
                  <TableRow>
                    <TableHead className="academic-resource-table__td-checkbox">
                      <Input
                        type="checkbox"
                        className="academic-resource-workbench__native-checkbox"
                        aria-label="Seleccionar todos los docentes visibles"
                        checked={
                          filteredTeachers.length > 0 &&
                          filteredTeachers.every((t) => selectedTeacherIds.includes(t.id))
                        }
                        onChange={(e) => {
                          if (e.currentTarget.checked) selectAllVisibleTeachers()
                          else deselectVisibleTeachers()
                        }}
                      />
                    </TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Inclusión</TableHead>
                    <TableHead><abbr title="Asignaturas">Asign.</abbr></TableHead>
                    <TableHead>Carga máx.</TableHead>
                    <TableHead>Carga asig.</TableHead>
                    <TableHead><abbr title="Disponibilidad">Disp.</abbr></TableHead>

                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeachers.map((teacher) => {
                    const isSelected = selectedTeacherIds.includes(teacher.id)
                    const isInspected = inspectedTeacherId === teacher.id
                    const assignedMinutes = calculateAssignedTeacherMinutes(proposal, teacher.id)

                    return (
                      <TableRow
                        key={teacher.id}
                        aria-selected={isInspected}
                        onClick={(event) => { if (!(event.target as HTMLElement).closest('button, input, label')) openTeacherInspector(teacher.id) }}
                        data-state={isSelected ? 'selected' : undefined}
                        className={`${isSelected ? 'academic-resource-workbench__row--selected' : ''} ${isInspected ? 'academic-resource-workbench__row--inspected' : ''}`}
                      >
                        <TableCell className="academic-resource-table__td-checkbox">
                          <Input
                            type="checkbox"
                            className="academic-resource-workbench__native-checkbox"
                            aria-label={`Seleccionar docente ${teacher.name}`}
                            checked={isSelected}
                            onChange={() => toggleTeacherSelect(teacher.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="link" className="planning-table-name" aria-label={`Abrir ficha de ${teacher.name}`} onClick={() => openTeacherInspector(teacher.id)}>{teacher.name}</Button>
                          <code title={teacher.id}>{teacher.id}</code>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`academic-resource-table__status academic-resource-badge ${teacher.isIncluded ? 'academic-resource-badge--included' : teacher.isLocal ? 'academic-resource-badge--local' : 'academic-resource-badge--reference'}`}
                          >
                            {teacher.isIncluded ? <CircleCheck size={16} aria-hidden="true" /> : <CircleMinus size={16} aria-hidden="true" />}
                            {teacher.isIncluded ? (teacher.isLocal ? 'Local (incorporado)' : 'Incorporado') : 'Referencia (no incorporado)'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {teacher.courseIds.length > 0 ? (
                            <span title={teacher.courseIds.join(', ')}>
                              {teacher.courseIds.length} asign.
                            </span>
                          ) : (
                            <span className="academic-resource-workbench__resource-note">Sin asignaturas</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {teacher.maxWeeklyMinutes !== null ? (
                            <span>{teacher.maxWeeklyMinutes} min</span>
                          ) : (
                            <span className="academic-resource-table__status"><CircleAlert size={16} aria-hidden="true" />Sin configurar</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {assignedMinutes !== null ? (
                            <span>{assignedMinutes} min</span>
                          ) : (
                            <span>—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="academic-resource-table__availability" title={teacher.availability?.map(formatAcademicInterval).join(' · ') || formatAvailabilitySummary(teacher.availability)}>{formatAvailabilitySummary(teacher.availability)}</span>
                        </TableCell>

                      </TableRow>
                    )
                  })}
                  {filteredTeachers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="academic-resource-workbench__empty">
                        {unifiedTeachers.length === 0
                          ? 'No hay docentes disponibles en el catálogo ni en el borrador.'
                          : 'No se encontraron docentes con los filtros y búsqueda aplicados.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            ) : (
              <Table stickyHeader tabIndex={0} className="academic-resource-table" aria-label="Aulas y laboratorios">
                <TableHeader>
                  <TableRow>
                    <TableHead className="academic-resource-table__td-checkbox">
                      <Input
                        type="checkbox"
                        className="academic-resource-workbench__native-checkbox"
                        aria-label="Seleccionar todos los ambientes visibles"
                        checked={
                          filteredRooms.length > 0 &&
                          filteredRooms.every((r) => selectedRoomIds.includes(r.id))
                        }
                        onChange={(e) => {
                          if (e.currentTarget.checked) selectAllVisibleRooms()
                          else deselectVisibleRooms()
                        }}
                      />
                    </TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Inclusión</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Capacidad</TableHead>
                    <TableHead>Pabellón</TableHead>
                    <TableHead><abbr title="Disponibilidad">Disp.</abbr></TableHead>

                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRooms.map((room) => {
                    const isSelected = selectedRoomIds.includes(room.id)
                    const isInspected = inspectedRoomId === room.id

                    return (
                      <TableRow
                        key={room.id}
                        aria-selected={isInspected}
                        onClick={(event) => { if (!(event.target as HTMLElement).closest('button, input, label')) openRoomInspector(room.id) }}
                        data-state={isSelected ? 'selected' : undefined}
                        className={`${isSelected ? 'academic-resource-workbench__row--selected' : ''} ${isInspected ? 'academic-resource-workbench__row--inspected' : ''}`}
                      >
                        <TableCell className="academic-resource-table__td-checkbox">
                          <Input
                            type="checkbox"
                            className="academic-resource-workbench__native-checkbox"
                            aria-label={`Seleccionar ambiente ${room.name}`}
                            checked={isSelected}
                            onChange={() => toggleRoomSelect(room.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="link" className="planning-table-name" aria-label={`Abrir ficha de ${room.name}`} onClick={() => openRoomInspector(room.id)}>{room.name}</Button>
                          <code title={room.id}>{room.id}</code>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`academic-resource-table__status academic-resource-badge ${room.isIncluded ? 'academic-resource-badge--included' : room.isLocal ? 'academic-resource-badge--local' : 'academic-resource-badge--reference'}`}
                          >
                            {room.isIncluded ? <CircleCheck size={16} aria-hidden="true" /> : <CircleMinus size={16} aria-hidden="true" />}
                            {room.isIncluded ? (room.isLocal ? 'Local (incorporado)' : 'Incorporado') : 'Referencia (no incorporado)'}
                          </span>
                        </TableCell>
                        <TableCell>{room.kind === 'laboratory' ? 'Laboratorio' : 'Aula'}</TableCell>
                        <TableCell>{room.capacity}</TableCell>
                        <TableCell>{room.pavilion ?? '—'}</TableCell>
                        <TableCell>
                          <span className="academic-resource-table__availability" title={room.availability?.map(formatAcademicInterval).join(' · ') || formatAvailabilitySummary(room.availability)}>{formatAvailabilitySummary(room.availability)}</span>
                        </TableCell>

                      </TableRow>
                    )
                  })}
                  {filteredRooms.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="academic-resource-workbench__empty">
                        {unifiedRooms.length === 0
                          ? 'No hay ambientes disponibles en el catálogo ni en el borrador.'
                          : 'No se encontraron ambientes con los filtros y búsqueda aplicados.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Inspector Pane (Only open when a resource is inspected) */}
        {activeTab === 'teachers' && inspectedTeacher && (
          <Sheet open onOpenChange={(open) => { if (!open) closeInspector() }}>
          <SheetContent className="academic-resource-workbench__inspector-pane" aria-label="Ficha de docente"
            showCloseButton={false} aria-describedby={undefined}>
            <div className="academic-resource-workbench__inspector-header">
              <div>
                <SheetTitle asChild>
                  <h5 className="academic-resource-workbench__inspector-title">
                    {inspectedTeacher.name || inspectedTeacher.id}
                  </h5>
                </SheetTitle>
                <p className="academic-resource-workbench__inspector-subtitle">
                  {inspectedTeacher.isIncluded
                    ? teacherReferenceIds[inspectedTeacher.id]
                      ? 'Docente de referencia · no confirmado para el nuevo periodo'
                      : 'Docente de demostración local'
                    : 'Referencia del catálogo · no incorporado en el borrador'}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                aria-label="Cerrar ficha"
                onClick={closeInspector}
              >
                Cerrar
              </Button>
            </div>

            <div className="academic-resource-workbench__inspector-body">
              {isLocked && (
                <div className="academic-resource-workbench__draft-note" role="status">
                  Versión congelada de solo lectura: el recurso puede consultarse pero no modificarse.
                </div>
              )}

              {/* View 1: If reference not yet included */}
              {!inspectedTeacher.isIncluded ? (
                <div className="academic-resource-workbench__ref-view">
                  <dl className="academic-resource-workbench__ref-grid">
                    <dt>Identificación de catálogo</dt>
                    <dd>{inspectedTeacher.id}</dd>
                    <dt>Nombre registrado</dt>
                    <dd>{inspectedTeacher.name}</dd>
                    <dt>Asignaturas de referencia</dt>
                    <dd>
                      {inspectedTeacher.courseIds.length > 0
                        ? inspectedTeacher.courseIds.join(', ')
                        : 'Sin asignaturas registradas'}
                    </dd>
                    <dt>Carga semanal</dt>
                    <dd>Sin configurar en el catálogo de referencia</dd>
                    <dt>Disponibilidad</dt>
                    <dd>Sin configurar en el catálogo de referencia</dd>
                  </dl>
                  <p className="academic-resource-workbench__resource-note">
                    Las habilitaciones de referencia representan supuestos de partida y no comprometen disponibilidad ni confirmación institucional para el nuevo periodo.
                  </p>
                  <Button
                    variant="outline"
                    type="button"
                    disabled={isLocked || resources.teachers.length >= PLANNING_LIMITS.teachers}
                    onClick={() => handleIncorporateSingleTeacher(inspectedTeacher.id)}
                  >
                    Incorporar a la propuesta
                  </Button>
                </div>
              ) : (
                /* View 2: Incorporated teacher editor */
                (() => {
                  const currentTeacher = resources.teachers.find((t) => t.id === inspectedTeacher.id)
                  if (!currentTeacher) return null

                  return (
                    <article className="academic-resource-workbench__form academic-scheduling__resource-card academic-scheduling__resource-card--teacher">
                      <div className="academic-resource-workbench__resource-card-heading">
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label={`Quitar docente ${currentTeacher.name || currentTeacher.id}`}
                          disabled={isLocked}
                          onClick={() => removeTeacher(currentTeacher.id)}
                        >
                          Quitar
                        </Button>
                      </div>

                      <fieldset className="academic-resource-workbench__resource-fields">
                        <legend>Datos generales</legend>
                        <Label>
                          Identificación
                          <Input
                            aria-label="Identificación docente"
                            aria-invalid={Boolean(teacherIdError)}
                            aria-describedby={teacherIdError ? 'teacher-id-error' : undefined}
                            value={currentTeacher.id}
                            disabled={isLocked}
                            onChange={(e) => changeTeacher({ id: e.currentTarget.value })}
                          />
                          {teacherIdError && (
                            <span id="teacher-id-error" role="alert" className="academic-resource-workbench__inline-error">
                              {teacherIdError}
                            </span>
                          )}
                        </Label>
                        <Label>
                          Nombre
                          <Input
                            aria-label="Nombre docente"
                            value={currentTeacher.name}
                            disabled={isLocked}
                            onChange={(e) => changeTeacher({ name: e.currentTarget.value })}
                          />
                        </Label>
                        <Label>
                          Carga semanal máxima (minutos)
                          <Input
                            type="number"
                            min="0"
                            max="10080"
                            step="1"
                            aria-label="Carga semanal docente"
                            value={Number.isFinite(currentTeacher.maxWeeklyMinutes) ? currentTeacher.maxWeeklyMinutes : ''}
                            disabled={isLocked}
                            onChange={(e) =>
                              changeTeacher({
                                maxWeeklyMinutes: e.currentTarget.value === '' ? Number.NaN : Number(e.currentTarget.value),
                              })
                            }
                          />
                        </Label>
                      </fieldset>

                      <TeacherLoadFields teacher={currentTeacher} period={academicPeriod} lectiveHourMinutes={lectiveHourMinutes} disabled={isLocked}
                        onChange={replaceTeacher} />

                      {currentTeacher.qualificationSource === 'synthetic' && (
                        <p className="academic-resource-workbench__resource-note">
                          Metadatos de habilitación locales sintéticos · {currentTeacher.facultyId ?? 'sin facultad'} · categoría{' '}
                          {currentTeacher.category ?? 'sin especificar'}. No verifican afiliación ni categoría institucional.
                        </p>
                      )}

                      <fieldset className="academic-resource-workbench__course-eligibility">
                        <legend>Asignaturas habilitadas · buscar y seleccionar</legend>
                        <Input
                          type="search"
                          aria-label="Buscar asignatura habilitada"
                          placeholder="Buscar por código o nombre"
                          value={courseSearch}
                          disabled={isLocked}
                          onChange={(e) => setCourseSearch(e.currentTarget.value)}
                        />
                        <div className="academic-scheduling__course-options">
                          {filteredCourses.map((course) => (
                            <div className="academic-resource-workbench__course-option" key={course.courseId}>
                              <Checkbox
                                id={`teacher-course-${course.courseId}`}
                                checked={currentTeacher.courseIds.includes(course.courseId)}
                                disabled={isLocked}
                                aria-label={`${currentTeacher.name || 'Docente'} habilitado para ${course.courseId}`}
                                onCheckedChange={(checked) =>
                                  changeTeacher({
                                    courseIds: checked === true
                                      ? [...new Set([...currentTeacher.courseIds, course.courseId])]
                                      : currentTeacher.courseIds.filter((id) => id !== course.courseId),
                                  })
                                }
                              />
                              <Label htmlFor={`teacher-course-${course.courseId}`}>{course.courseId} · {course.name}</Label>
                            </div>
                          ))}
                        </div>
                        <div className="academic-scheduling__course-chips" aria-label="Asignaturas habilitadas">
                          {currentTeacher.courseIds.map((id) => (
                            <Badge variant="secondary" className="academic-resource-workbench__chip" key={id}>
                              {id}
                              {catalog.courses.some((course) => course.courseId === id) && (
                                <Button
                                  variant="ghost"
                                  type="button"
                                  aria-label={`Quitar habilitación ${id}`}
                                  disabled={isLocked}
                                  onClick={() =>
                                    changeTeacher({
                                      courseIds: currentTeacher.courseIds.filter((courseId) => courseId !== id),
                                    })
                                  }
                                >
                                  ×
                                </Button>
                              )}
                            </Badge>
                          ))}
                          {!currentTeacher.courseIds.length && (
                            <span className="academic-resource-workbench__resource-note">Sin asignaturas habilitadas.</span>
                          )}
                        </div>
                        {currentTeacher.courseIds
                          .filter((id) => !catalog.courses.some((course) => course.courseId === id))
                          .map((id) => (
                            <span key={id}>{id} · habilitación conservada fuera del catálogo visible</span>
                          ))}
                      </fieldset>

                      <fieldset className="academic-resource-workbench__course-limits">
                        <legend>Máximo de secciones por asignatura (opcional)</legend>
                        {currentTeacher.courseIds
                          .filter((id) => catalog.courses.some((course) => course.courseId === id))
                          .map((id) => {
                            const limit = currentTeacher.sectionLimits?.find((item) => item.courseId === id)?.maxSections
                            return (
                              <Label key={id}>
                                {id} · {catalog.courses.find((course) => course.courseId === id)?.name}
                                <Input
                                  type="number"
                                  min="0"
                                  max="128"
                                  step="1"
                                  placeholder="Sin límite adicional"
                                  aria-label={`Máximo de secciones ${id}`}
                                  value={limit === undefined ? '' : Number.isFinite(limit) ? limit : ''}
                                  disabled={isLocked}
                                  onChange={(e) => {
                                    const limits = currentTeacher.sectionLimits?.filter((item) => item.courseId !== id) ?? []
                                    if (e.currentTarget.value !== '')
                                      limits.push({ courseId: id, maxSections: Number(e.currentTarget.value) })
                                    changeTeacher({ sectionLimits: limits.length ? limits : undefined })
                                  }}
                                />
                              </Label>
                            )
                          })}
                        {!currentTeacher.courseIds.length && (
                          <span>Agrega asignaturas habilitadas para configurar sus límites.</span>
                        )}
                      </fieldset>

                      <AvailabilityEditor
                        label="Disponibilidad docente"
                        intervals={currentTeacher.availability}
                        disabled={isLocked}
                        onChange={(availability) => changeTeacher({ availability })}
                      />
                      <AvailabilityEditor
                        label="Preferencias semanales · prioridad blanda"
                        intervals={currentTeacher.preferences ?? []}
                        disabled={isLocked}
                        onChange={(preferences) =>
                          changeTeacher({ preferences: preferences.length ? preferences : undefined })
                        }
                      />
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="academic-resource-workbench__disclosure-trigger">Cómo se aplican las preferencias</Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <p className="academic-resource-workbench__resource-note">
                            Las preferencias ordenan alternativas, no impiden horarios fuera de ellas. Una persona puede atender varias secciones si respeta carga y límites.
                          </p>
                        </CollapsibleContent>
                      </Collapsible>
                    </article>
                  )
                })()
              )}
            </div>
          </SheetContent>
          </Sheet>
        )}

        {activeTab === 'rooms' && inspectedRoom && (
          <Sheet open onOpenChange={(open) => { if (!open) closeInspector() }}>
          <SheetContent className="academic-resource-workbench__inspector-pane" aria-label="Ficha de ambiente"
            showCloseButton={false} aria-describedby={undefined}>
            <div className="academic-resource-workbench__inspector-header">
              <div>
                <SheetTitle asChild>
                  <h5 className="academic-resource-workbench__inspector-title">
                    {inspectedRoom.name || inspectedRoom.id}
                  </h5>
                </SheetTitle>
                <p className="academic-resource-workbench__inspector-subtitle">
                  {inspectedRoom.isIncluded
                    ? `${inspectedRoom.kind === 'laboratory' ? 'Laboratorio' : 'Aula'}${roomReferenceIds[inspectedRoom.id] ? ' · referencia sintética' : ' · ambiente local'}`
                    : 'Referencia del catálogo · no incorporado en el borrador'}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                aria-label="Cerrar ficha"
                onClick={closeInspector}
              >
                Cerrar
              </Button>
            </div>

            <div className="academic-resource-workbench__inspector-body">
              {isLocked && (
                <div className="academic-resource-workbench__draft-note" role="status">
                  Versión congelada de solo lectura: el recurso puede consultarse pero no modificarse.
                </div>
              )}

              {/* View 1: If room reference not yet included */}
              {!inspectedRoom.isIncluded ? (
                <div className="academic-resource-workbench__ref-view">
                  <dl className="academic-resource-workbench__ref-grid">
                    <dt>Identificación de catálogo</dt>
                    <dd>{inspectedRoom.id}</dd>
                    <dt>Nombre</dt>
                    <dd>{inspectedRoom.name}</dd>
                    <dt>Tipo de ambiente</dt>
                    <dd>{inspectedRoom.kind === 'laboratory' ? 'Laboratorio' : 'Aula'}</dd>
                    <dt>Capacidad</dt>
                    <dd>{inspectedRoom.capacity}</dd>
                    <dt>Pabellón</dt>
                    <dd>{inspectedRoom.pavilion ?? 'Sin pabellón'}</dd>
                    <dt>Disponibilidad</dt>
                    <dd>Sin configurar en el catálogo de referencia</dd>
                  </dl>
                  <Button
                    variant="outline"
                    type="button"
                    disabled={isLocked || resources.rooms.length >= PLANNING_LIMITS.rooms}
                    onClick={() => handleIncorporateSingleRoom(inspectedRoom.id)}
                  >
                    Incorporar a la propuesta
                  </Button>
                </div>
              ) : (
                /* View 2: Incorporated room editor */
                (() => {
                  const currentRoom = resources.rooms.find((r) => r.id === inspectedRoom.id)
                  if (!currentRoom) return null

                  return (
                    <article className="academic-resource-workbench__form academic-scheduling__resource-card academic-scheduling__resource-card--room">
                      <div className="academic-resource-workbench__resource-card-heading">
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label={`Quitar ambiente ${currentRoom.name || currentRoom.id}`}
                          disabled={isLocked}
                          onClick={() => removeRoom(currentRoom.id)}
                        >
                          Quitar
                        </Button>
                      </div>

                      <fieldset className="academic-resource-workbench__resource-fields">
                        <legend>Datos generales</legend>
                        <Label>
                          Identificación
                          <Input
                            aria-label="Identificación ambiente"
                            aria-invalid={Boolean(roomIdError)}
                            aria-describedby={roomIdError ? 'room-id-error' : undefined}
                            value={currentRoom.id}
                            disabled={isLocked}
                            onChange={(e) => changeRoom({ id: e.currentTarget.value })}
                          />
                          {roomIdError && (
                            <span id="room-id-error" role="alert" className="academic-resource-workbench__inline-error">
                              {roomIdError}
                            </span>
                          )}
                        </Label>
                        <Label>
                          Nombre
                          <Input
                            aria-label="Nombre ambiente"
                            value={currentRoom.name}
                            disabled={isLocked}
                            onChange={(e) => changeRoom({ name: e.currentTarget.value })}
                          />
                        </Label>
                        <Label>
                          Tipo
                          <NativeSelect
                            aria-label="Tipo ambiente"
                            value={currentRoom.kind ?? 'classroom'}
                            disabled={isLocked}
                            onChange={(e) => changeRoom({ kind: e.currentTarget.value as 'classroom' | 'laboratory' })}
                          >
                            <option value="classroom">Aula</option>
                            <option value="laboratory">Laboratorio</option>
                          </NativeSelect>
                        </Label>
                        <Label>
                          Capacidad
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            aria-label="Capacidad ambiente"
                            value={Number.isFinite(currentRoom.capacity) ? currentRoom.capacity : ''}
                            disabled={isLocked}
                            onChange={(e) =>
                              changeRoom({
                                capacity: e.currentTarget.value === '' ? Number.NaN : Number(e.currentTarget.value),
                              })
                            }
                          />
                        </Label>
                      </fieldset>

                      <AvailabilityEditor
                        label="Disponibilidad del ambiente"
                        intervals={currentRoom.availability}
                        disabled={isLocked}
                        onChange={(availability) => changeRoom({ availability })}
                      />
                    </article>
                  )
                })()
              )}
            </div>
          </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Catalog reference rooms details box for information */}
      {catalog.referenceRooms && (
        <Collapsible className="academic-resource-workbench__reference-rooms">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="academic-resource-workbench__disclosure-trigger">
            Catálogo de referencia · {catalog.referenceRooms.length} ambientes (AP:{' '}
            {catalog.referenceRooms.filter((room) => room.pavilion === 'AP').length}, NP:{' '}
            {catalog.referenceRooms.filter((room) => room.pavilion === 'NP').length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
          <p>Listado de referencia proporcionado para esta demo. Capacidad inicial: 45. La disponibilidad no está confirmada y no proviene del historial.</p>
          <ul>
            {catalog.referenceRooms.map((room) => (
              <li key={room.id}>
                {room.id} · {room.name} · {room.kind === 'laboratory' ? 'Laboratorio' : 'Aula'} · {room.pavilion} · capacidad {room.capacity}
              </li>
            ))}
          </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Multi-Selection Preview Modals / Dialogs */}
      {activeModal === 'incorporate-teacher' && teacherIncorporatePreview && (
        <Dialog open onOpenChange={(open) => { if (!open) closeModal() }}>
          <DialogContent
            className="academic-resource-modal"
            showCloseButton={false}
            aria-describedby={undefined}
            onOpenAutoFocus={focusModalFirstControl}
          >
            <div className="academic-resource-modal__header">
              <div>
                <DialogTitle asChild>
                  <h4 className="academic-resource-modal__title">
                    Vista previa de incorporación múltiple de docentes
                  </h4>
                </DialogTitle>
                <p className="academic-resource-modal__subtitle">
                  Los valores iniciales de carga y disponibilidad son sintéticos y no confirman asignaciones institucionales.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                aria-label="Cerrar vista previa"
                onClick={closeModal}
              >
                ✕
              </Button>
            </div>

            <div className="academic-resource-modal__body">
              <div className="academic-resource-modal__summary">
                <span>Seleccionados: <strong>{teacherIncorporatePreview.counts.totalSelected}</strong></span>
                <span>A incorporar: <strong>{teacherIncorporatePreview.counts.toIncorporate}</strong></span>
                <span>Sin efecto (ya incorporados): <strong>{teacherIncorporatePreview.counts.alreadyIncluded}</strong></span>
                {teacherIncorporatePreview.counts.excludedByLimit > 0 && (
                  <span>Excluidos por límite: <strong>{teacherIncorporatePreview.counts.excludedByLimit}</strong></span>
                )}
              </div>

              {teacherIncorporatePreview.limitError && (
                <p className="academic-resource-workbench__inline-error" role="alert">
                  {teacherIncorporatePreview.limitError}
                </p>
              )}

              <div className="academic-resource-modal__item-list">
                {teacherIncorporatePreview.items.map((item) => (
                  <div key={item.id} className="academic-resource-modal__item">
                    <div className="academic-resource-modal__item-header">
                      <span>{item.name} (<code>{item.id}</code>)</span>
                      <Badge variant="outline"
                        className={`academic-resource-badge ${item.action === 'incorporate' ? 'academic-resource-badge--included' : 'academic-resource-badge--reference'}`}
                      >
                        {item.action === 'incorporate'
                          ? 'Se incorporará'
                          : item.action === 'no-effect-already-included'
                            ? 'Sin efecto · Ya incorporado'
                            : 'Excluido por límite'}
                      </Badge>
                    </div>
                    {item.syntheticValues && (
                      <div className="academic-resource-modal__item-details">
                        Carga inicial: {item.syntheticValues.maxWeeklyMinutes} min (sintética) · Disponibilidad: {item.syntheticValues.availabilitySummary} · Asignaturas de referencia: {item.syntheticValues.courseCount}
                      </div>
                    )}
                    {item.reason && (
                      <div className="academic-resource-modal__item-details">
                        {item.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="academic-resource-modal__footer">
              <Button
                variant="outline"
                ref={modalFirstControlRef}
                type="button"
                onClick={closeModal}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={!teacherIncorporatePreview.canConfirm}
                onClick={confirmBulkIncorporateTeachers}
              >
                Confirmar incorporación ({teacherIncorporatePreview.counts.toIncorporate})
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {activeModal === 'incorporate-room' && roomIncorporatePreview && (
        <Dialog open onOpenChange={(open) => { if (!open) closeModal() }}>
          <DialogContent
            className="academic-resource-modal"
            showCloseButton={false}
            aria-describedby={undefined}
            onOpenAutoFocus={focusModalFirstControl}
          >
            <div className="academic-resource-modal__header">
              <div>
                <DialogTitle asChild>
                  <h4 className="academic-resource-modal__title">
                    Vista previa de incorporación múltiple de ambientes
                  </h4>
                </DialogTitle>
                <p className="academic-resource-modal__subtitle">
                  La disponibilidad inicial de cada ambiente incorporado es sintética.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                aria-label="Cerrar vista previa"
                onClick={closeModal}
              >
                ✕
              </Button>
            </div>

            <div className="academic-resource-modal__body">
              <div className="academic-resource-modal__summary">
                <span>Seleccionados: <strong>{roomIncorporatePreview.counts.totalSelected}</strong></span>
                <span>A incorporar: <strong>{roomIncorporatePreview.counts.toIncorporate}</strong></span>
                <span>Sin efecto (ya incorporados): <strong>{roomIncorporatePreview.counts.alreadyIncluded}</strong></span>
                {roomIncorporatePreview.counts.excludedByLimit > 0 && (
                  <span>Excluidos por límite: <strong>{roomIncorporatePreview.counts.excludedByLimit}</strong></span>
                )}
              </div>

              {roomIncorporatePreview.limitError && (
                <p className="academic-resource-workbench__inline-error" role="alert">
                  {roomIncorporatePreview.limitError}
                </p>
              )}

              <div className="academic-resource-modal__item-list">
                {roomIncorporatePreview.items.map((item) => (
                  <div key={item.id} className="academic-resource-modal__item">
                    <div className="academic-resource-modal__item-header">
                      <span>{item.name} (<code>{item.id}</code>)</span>
                      <Badge variant="outline"
                        className={`academic-resource-badge ${item.action === 'incorporate' ? 'academic-resource-badge--included' : 'academic-resource-badge--reference'}`}
                      >
                        {item.action === 'incorporate'
                          ? 'Se incorporará'
                          : item.action === 'no-effect-already-included'
                            ? 'Sin efecto · Ya incorporado'
                            : 'Excluido por límite'}
                      </Badge>
                    </div>
                    {item.syntheticValues && (
                      <div className="academic-resource-modal__item-details">
                        Tipo: {item.syntheticValues.kind === 'laboratory' ? 'Laboratorio' : 'Aula'} · Capacidad: {item.syntheticValues.capacity} · Disponibilidad: {item.syntheticValues.availabilitySummary}
                      </div>
                    )}
                    {item.reason && (
                      <div className="academic-resource-modal__item-details">
                        {item.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="academic-resource-modal__footer">
              <Button
                variant="outline"
                ref={modalFirstControlRef}
                type="button"
                onClick={closeModal}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={!roomIncorporatePreview.canConfirm}
                onClick={confirmBulkIncorporateRooms}
              >
                Confirmar incorporación ({roomIncorporatePreview.counts.toIncorporate})
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {activeModal === 'remove-teacher' && teacherRemovePreview && (
        <Dialog open onOpenChange={(open) => { if (!open) closeModal() }}>
          <DialogContent
            className="academic-resource-modal"
            showCloseButton={false}
            aria-describedby={undefined}
            onOpenAutoFocus={focusModalFirstControl}
          >
            <div className="academic-resource-modal__header">
              <div>
                <DialogTitle asChild>
                  <h4 className="academic-resource-modal__title">
                    Vista previa de retiro múltiple de docentes
                  </h4>
                </DialogTitle>
                <p className="academic-resource-modal__subtitle">
                  Retirar un docente lo elimina de la configuración del borrador. Las referencias del catálogo permanecerán disponibles.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                aria-label="Cerrar vista previa"
                onClick={closeModal}
              >
                ✕
              </Button>
            </div>

            <div className="academic-resource-modal__body">
              <div className="academic-resource-modal__summary">
                <span>Seleccionados: <strong>{teacherRemovePreview.counts.totalSelected}</strong></span>
                <span>A retirar: <strong>{teacherRemovePreview.counts.toRemove}</strong></span>
                <span>Sin efecto (no estaban incorporados): <strong>{teacherRemovePreview.counts.notIncluded}</strong></span>
              </div>

              <div className="academic-resource-modal__item-list">
                {teacherRemovePreview.items.map((item) => (
                  <div key={item.id} className="academic-resource-modal__item">
                    <div className="academic-resource-modal__item-header">
                      <span>{item.name} (<code>{item.id}</code>)</span>
                      <Badge variant="outline"
                        className={`academic-resource-badge ${item.action === 'remove' ? 'academic-resource-badge--local' : 'academic-resource-badge--reference'}`}
                      >
                        {item.action === 'remove' ? 'Se retirará' : 'Sin efecto · No incorporado'}
                      </Badge>
                    </div>
                    {item.reason && (
                      <div className="academic-resource-modal__item-details">
                        {item.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="academic-resource-modal__footer">
              <Button
                variant="outline"
                ref={modalFirstControlRef}
                type="button"
                onClick={closeModal}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={!teacherRemovePreview.canConfirm}
                onClick={confirmBulkRemoveTeachers}
              >
                Confirmar retiro ({teacherRemovePreview.counts.toRemove})
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {activeModal === 'remove-room' && roomRemovePreview && (
        <Dialog open onOpenChange={(open) => { if (!open) closeModal() }}>
          <DialogContent
            className="academic-resource-modal"
            showCloseButton={false}
            aria-describedby={undefined}
            onOpenAutoFocus={focusModalFirstControl}
          >
            <div className="academic-resource-modal__header">
              <div>
                <DialogTitle asChild>
                  <h4 className="academic-resource-modal__title">
                    Vista previa de retiro múltiple de ambientes
                  </h4>
                </DialogTitle>
                <p className="academic-resource-modal__subtitle">
                  Retirar un ambiente lo elimina de la configuración del borrador. Las referencias del catálogo permanecerán disponibles.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                aria-label="Cerrar vista previa"
                onClick={closeModal}
              >
                ✕
              </Button>
            </div>

            <div className="academic-resource-modal__body">
              <div className="academic-resource-modal__summary">
                <span>Seleccionados: <strong>{roomRemovePreview.counts.totalSelected}</strong></span>
                <span>A retirar: <strong>{roomRemovePreview.counts.toRemove}</strong></span>
                <span>Sin efecto (no estaban incorporados): <strong>{roomRemovePreview.counts.notIncluded}</strong></span>
              </div>

              <div className="academic-resource-modal__item-list">
                {roomRemovePreview.items.map((item) => (
                  <div key={item.id} className="academic-resource-modal__item">
                    <div className="academic-resource-modal__item-header">
                      <span>{item.name} (<code>{item.id}</code>)</span>
                      <Badge variant="outline"
                        className={`academic-resource-badge ${item.action === 'remove' ? 'academic-resource-badge--local' : 'academic-resource-badge--reference'}`}
                      >
                        {item.action === 'remove' ? 'Se retirará' : 'Sin efecto · No incorporado'}
                      </Badge>
                    </div>
                    {item.reason && (
                      <div className="academic-resource-modal__item-details">
                        {item.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="academic-resource-modal__footer">
              <Button
                variant="outline"
                ref={modalFirstControlRef}
                type="button"
                onClick={closeModal}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={!roomRemovePreview.canConfirm}
                onClick={confirmBulkRemoveRooms}
              >
                Confirmar retiro ({roomRemovePreview.counts.toRemove})
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      </TabsContent>
    </Tabs>
  )
}

function AvailabilityEditor({
  label,
  intervals,
  disabled = false,
  onChange,
}: {
  label: string
  intervals: AcademicInterval[]
  disabled?: boolean
  onChange: (value: AcademicInterval[]) => void
}) {
  const patch = (index: number, change: Partial<AcademicInterval>) => {
    if (disabled) return
    onChange(updateInterval(intervals, index, change))
  }

  return (
    <fieldset className="academic-resource-workbench__availability">
      <legend>{label} · máximo 32 intervalos</legend>
      {intervals.map((interval, index) => (
        <div className="academic-resource-workbench__availability-row" key={`${label}-${index}`}>
          <Label>
            Día
            <NativeSelect
              aria-label={`${label} día ${index + 1}`}
              value={interval.day}
              disabled={disabled}
              onChange={(event) => patch(index, { day: Number(event.currentTarget.value) })}
            >
              {DAYS.map((day, dayIndex) => (
                <option key={day} value={dayIndex + 1}>
                  {day}
                </option>
              ))}
            </NativeSelect>
          </Label>
          <Label>
            Inicio
            <Input
              type="time"
              aria-label={`${label} inicio ${index + 1}`}
              value={timeValue(interval.startMinute)}
              disabled={disabled}
              onChange={(event) => patch(index, { startMinute: timeMinute(event.currentTarget.value) })}
            />
          </Label>
          <Label>
            Fin
            <Input
              type="time"
              aria-label={`${label} fin ${index + 1}`}
              value={timeValue(interval.endMinute)}
              disabled={disabled}
              onChange={(event) => patch(index, { endMinute: timeMinute(event.currentTarget.value) })}
            />
          </Label>
          <Button
            type="button"
            variant="ghost"
            aria-label={`Quitar ${label} intervalo ${index + 1}`}
            disabled={disabled}
            onClick={() => {
              if (disabled) return
              onChange(intervals.filter((_, itemIndex) => itemIndex !== index))
            }}
          >
            Quitar
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        disabled={disabled || intervals.length >= 32}
        onClick={() => {
          if (disabled) return
          onChange([...intervals, { day: 1, startMinute: 480, endMinute: 1020 }])
        }}
      >
        Agregar intervalo
      </Button>
    </fieldset>
  )
}
