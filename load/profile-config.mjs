const allowedProfiles = new Set(['shared', 'ample', 'last-seat', 'multi-uniform', 'multi-hotspot', 'fisi-schools', 'distributed'])

function validSelection(items) {
  if (!Array.isArray(items) || items.length === 0) return false
  const pairs = new Set()
  const courses = new Set()
  for (const item of items) {
    if (!item || typeof item.courseId !== 'string' || !item.courseId || typeof item.sectionId !== 'string' || !item.sectionId) return false
    const pair = `${item.courseId}\u0000${item.sectionId}`
    if (pairs.has(pair) || courses.has(item.courseId)) return false
    pairs.add(pair)
    courses.add(item.courseId)
  }
  return true
}

const fisiCohortNames = ['SIS', 'SOFT', 'CC', 'IA']

// fisi-schools carries one shared selection per cohort (disjoint by section), plus a per-actor cohort
// label and, in the full day (jornada), a wave 1..9. Every figure is cross-checked against the actors.
function validateFisi(manifest) {
  const fail = message => { throw new Error(`Synthetic fisi-schools manifest ${message}`) }
  const isInt = (value, min) => Number.isSafeInteger(value) && value >= min
  const fisi = manifest.fisi
  if (!fisi || (fisi.mode !== 'franja' && fisi.mode !== 'jornada')) fail('fisi.mode must be franja or jornada')
  const jornada = fisi.mode === 'jornada'
  if (!jornada && !(Number.isSafeInteger(fisi.franja) && fisi.franja >= 1 && fisi.franja <= 9)) fail('fisi.franja must be 1..9')
  if (!Array.isArray(manifest.cohorts) || manifest.cohorts.length === 0) fail('cohorts are missing')
  const byName = new Map()
  const sectionOwner = new Map()
  let acceptedSum = 0
  let sizeSum = 0
  for (const cohort of manifest.cohorts) {
    if (!cohort || !fisiCohortNames.includes(cohort.cohort) || byName.has(cohort.cohort)) fail('cohort names must be unique SIS, SOFT, CC or IA')
    if (!isInt(cohort.size, 1) || !isInt(cohort.capacity, 1) || !isInt(cohort.expectedAccepted, 0)) fail('cohort size, capacity or expectedAccepted is invalid')
    if (!Array.isArray(cohort.sectionIds) || cohort.sectionIds.length === 0 || cohort.sectionIds.some(id => typeof id !== 'string' || !id) || new Set(cohort.sectionIds).size !== cohort.sectionIds.length) fail('cohort sectionIds are invalid')
    if (cohort.expectedAccepted !== Math.min(cohort.size, cohort.capacity)) fail('cohort expectedAccepted differs from size and capacity')
    for (const id of cohort.sectionIds) {
      if (sectionOwner.has(id)) fail('cohorts must use disjoint sections')
      sectionOwner.set(id, cohort.cohort)
    }
    byName.set(cohort.cohort, { ...cohort, actors: 0, key: [...cohort.sectionIds].sort().join('\u0000') })
    acceptedSum += cohort.expectedAccepted
    sizeSum += cohort.size
  }
  if (sizeSum !== manifest.actors.length) fail('cohort sizes must sum to the actor count')
  if (acceptedSum !== manifest.expectedAccepted) fail('expectedAccepted differs from the sum of cohort admissions')
  const waveSizes = new Map()
  if (jornada) {
    if (!Array.isArray(manifest.waves) || manifest.waves.length === 0) fail('waves are missing in jornada')
    let total = 0
    for (const wave of manifest.waves) {
      if (!wave || !Number.isSafeInteger(wave.wave) || wave.wave < 1 || wave.wave > 9 || waveSizes.has(wave.wave) || !isInt(wave.size, 0)) fail('wave entries are invalid')
      waveSizes.set(wave.wave, { size: wave.size, actors: 0 })
      total += wave.size
    }
    if (total !== manifest.actors.length) fail('wave sizes must sum to the actor count')
  } else if (manifest.waves !== undefined) fail('waves are only valid in jornada')
  const cells = new Map()
  for (const actor of manifest.actors) {
    const cohort = byName.get(actor.cohort)
    if (!cohort) fail('actor cohort is missing or unknown')
    if (!validSelection(actor.selection)) fail('every actor needs its own valid selection')
    if (actor.selection.map(item => item.sectionId).sort().join('\u0000') !== cohort.key) fail('actor selection differs from its cohort group')
    cohort.actors++
    if (jornada) {
      const wave = waveSizes.get(actor.wave)
      if (!wave) fail('actor wave must be one of the declared waves')
      wave.actors++
      const cell = `${actor.wave}:${actor.cohort}`
      cells.set(cell, (cells.get(cell) ?? 0) + 1)
    } else if (actor.wave !== undefined) fail('actor wave is only valid in jornada')
  }
  for (const cohort of byName.values()) if (cohort.actors !== cohort.size) fail('cohort size differs from its actors')
  for (const [number, wave] of waveSizes) if (wave.actors !== wave.size) fail(`wave ${number} size differs from its actors`)
  const hot = jornada ? Math.max(...cells.values()) : Math.max(...[...byName.values()].map(cohort => cohort.size))
  if (manifest.hotCohortSize !== undefined && manifest.hotCohortSize !== hot) fail('hotCohortSize differs from the actors')
  if (fisi.iaActors !== undefined && fisi.iaActors !== (byName.get('IA')?.size ?? 0)) fail('fisi.iaActors differs from the IA cohort')
}

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.actors)) throw new Error('Synthetic seed manifest has an invalid shape')
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuid.test(manifest.runId ?? '') || !uuid.test(manifest.campaignId ?? '')) throw new Error('Synthetic seed manifest is missing valid UUIDv4 campaign identifiers')
  const actorCount = manifest.actorCount ?? manifest.actors.length
  if (!Number.isSafeInteger(actorCount) || actorCount < 1 || actorCount > 2000 || actorCount !== manifest.actors.length) throw new Error('Synthetic seed actorCount must match 1..2000 manifest actors')
  const versionedManifest = manifest.actorCount !== undefined
  if (versionedManifest && (manifest.scenarioProfile === undefined || manifest.expectedAccepted === undefined || manifest.expectedRejected === undefined || manifest.initialEnrollments === undefined || manifest.initialRequests === undefined || manifest.capacityBySection === undefined)) throw new Error('Versioned synthetic manifest is missing load profile preflight fields')
  const profile = manifest.scenarioProfile ?? manifest.contention ?? 'shared'
  if (!allowedProfiles.has(profile)) throw new Error('Synthetic seed scenarioProfile is invalid')
  const contention = manifest.contention ?? 'shared'
  if (contention !== 'shared' && contention !== 'distributed') throw new Error('Synthetic seed contention mode is invalid')
  const actorIds = new Set()
  const credentials = new Set()
  const validActorId = /^SYN-[A-Z0-9-]+$/
  const validCredential = /^[A-Za-z0-9_-]{43}$/
  if (contention === 'shared' && !validSelection(manifest.selection) && !manifest.actors.every(actor => validSelection(actor?.selection))) throw new Error('Shared synthetic seed selection is invalid')
  if (contention === 'distributed' && manifest.selection !== undefined) throw new Error('Distributed synthetic seed must use per-actor selections')

  for (const actor of manifest.actors) {
    if (!actor || !validActorId.test(actor.actorId) || !validCredential.test(actor.credential)) throw new Error('Synthetic manifest actor credential is invalid')
    if (actorIds.has(actor.actorId) || credentials.has(actor.credential)) throw new Error('Synthetic manifest actors and credentials must be unique')
    actorIds.add(actor.actorId)
    credentials.add(actor.credential)
    if (contention === 'distributed' && !validSelection(actor.selection)) throw new Error('Distributed synthetic actor selection is invalid')
    if (contention === 'shared' && actor.selection !== undefined && !validSelection(actor.selection)) throw new Error('Synthetic actor selection is invalid')
  }

  if (profile === 'fisi-schools') {
    if (!versionedManifest) throw new Error('Synthetic fisi-schools manifest must be versioned')
    validateFisi(manifest)
  }

  const expectedAccepted = manifest.expectedAccepted ?? (contention === 'distributed' ? actorCount : 10)
  const expectedRejected = manifest.expectedRejected ?? actorCount - expectedAccepted
  if (!Number.isSafeInteger(expectedAccepted) || expectedAccepted < 0 || expectedAccepted > actorCount) throw new Error('Synthetic seed expectedAccepted is outside actor bounds')
  if (!Number.isSafeInteger(expectedRejected) || expectedRejected < 0 || expectedRejected + expectedAccepted !== actorCount) throw new Error('Synthetic seed expectedRejected does not match actor outcomes')
  if (manifest.initialEnrollments !== undefined && !nonnegativeInteger(manifest.initialEnrollments)) throw new Error('Synthetic seed initialEnrollments is invalid')
  if (manifest.initialRequests !== undefined && !nonnegativeInteger(manifest.initialRequests)) throw new Error('Synthetic seed initialRequests is invalid')

  if (manifest.capacityBySection !== undefined) {
    if (!Array.isArray(manifest.capacityBySection)) throw new Error('Synthetic seed capacityBySection is invalid')
    const sectionKeys = new Set()
    const capacities = new Map()
    for (const section of manifest.capacityBySection) {
      if (!section || typeof section.courseId !== 'string' || !section.courseId || typeof section.sectionId !== 'string' || !section.sectionId || !Number.isSafeInteger(section.capacity) || section.capacity < 1 || !Number.isSafeInteger(section.initialOccupied) || section.initialOccupied < 0 || section.initialOccupied > section.capacity) throw new Error('Synthetic seed section capacity is invalid')
      const key = `${section.courseId}\u0000${section.sectionId}`
      if (sectionKeys.has(key)) throw new Error('Synthetic seed section capacities must be unique')
      sectionKeys.add(key)
      capacities.set(key, section.capacity - section.initialOccupied)
    }
    for (const actor of manifest.actors) {
      const selection = actor.selection || manifest.selection
      for (const item of selection) {
        if (!sectionKeys.has(`${item.courseId}\u0000${item.sectionId}`)) throw new Error('Synthetic seed selection references a section without capacity metadata')
      }
    }
    // Each supported profile uses disjoint cohorts of identical selections.
    // Derive admission expectations from actual capacity instead of trusting a
    // scenario label or a caller-supplied accepted count.
    const cohorts = new Map()
    for (const actor of manifest.actors) {
      const keys = (actor.selection || manifest.selection).map(item => `${item.courseId}\u0000${item.sectionId}`).sort()
      const key = JSON.stringify(keys)
      const cohort = cohorts.get(key) ?? { keys, demand: 0 }
      cohort.demand++
      cohorts.set(key, cohort)
    }
    const used = new Set()
    let derivedAccepted = 0
    for (const cohort of cohorts.values()) {
      for (const key of cohort.keys) {
        if (used.has(key)) throw new Error('Synthetic profile cohorts must use disjoint sections')
        used.add(key)
      }
      derivedAccepted += Math.min(cohort.demand, ...cohort.keys.map(key => capacities.get(key)))
    }
    if (derivedAccepted !== expectedAccepted) throw new Error('Synthetic expectedAccepted differs from actual section capacity and demand')
  }

  return { ...manifest, actorCount, scenarioProfile: profile, contention, expectedAccepted, expectedRejected }
}
