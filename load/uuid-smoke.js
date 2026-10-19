import { Counter } from 'k6/metrics'
import { check } from 'k6'
import { uuidV4 } from './common.js'

const generated = new Counter('uuid_smoke_generated')
const unique = new Counter('uuid_smoke_unique')
const valid = new Counter('uuid_smoke_valid')
const count = Number(__ENV.UUID_SMOKE_COUNT || 1000)

export const options = {
  thresholds: {
    uuid_smoke_generated: [`count==${count}`],
    uuid_smoke_unique: [`count==${count}`],
    uuid_smoke_valid: [`count==${count}`],
  },
}

export default function () {
  const seen = new Set()
  for (let index = 0; index < count; index += 1) {
    const value = uuidV4()
    generated.add(1)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) valid.add(1)
    if (!seen.has(value)) unique.add(1)
    seen.add(value)
  }
  check(seen.size, { 'UUIDv4 values are unique in this smoke batch': (value) => value === count })
}
