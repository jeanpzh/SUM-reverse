// Deterministic wave scheduling for the compressed FISI jornada; pure so it can be unit tested without k6.
// Wave w opens at delayMs + (w - 1) * intervalMs. Within a wave, ordered by manifest position, the first
// floor(n * frontload) actors start exactly at the opening and the rest are spread uniformly over the interval.
export function waveOffsets(actors, { intervalMs, delayMs, frontload }) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new Error('WAVE_INTERVAL must be a positive number of seconds')
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error('START_DELAY_MS must be a nonnegative number')
  if (!Number.isFinite(frontload) || frontload < 0 || frontload > 1) throw new Error('WAVE_FRONTLOAD must be between 0 and 1')
  const members = new Map()
  actors.forEach((actor, index) => {
    if (!Number.isSafeInteger(actor?.wave) || actor.wave < 1 || actor.wave > 9) throw new Error('jornada requires every actor to carry a wave from 1 to 9')
    if (!members.has(actor.wave)) members.set(actor.wave, [])
    members.get(actor.wave).push(index)
  })
  const offsets = new Array(actors.length)
  for (const [wave, indexes] of members) {
    const opening = delayMs + (wave - 1) * intervalMs
    const front = Math.floor(indexes.length * frontload + 1e-9)
    const spread = indexes.length - front
    indexes.forEach((actorIndex, position) => {
      offsets[actorIndex] = position < front ? opening : opening + Math.floor((intervalMs * (position - front)) / spread)
    })
  }
  return offsets
}
