import { useEffect, useState } from 'react'

export type StudentPhotoState =
  | { status: 'ready'; src: string }
  | { status: 'empty' | 'invalid' }

const maxDecodedBytes = 5 * 1024 * 1024
const maxEncodedLength = 4 * Math.ceil(maxDecodedBytes / 3)
const emptyState: StudentPhotoState = { status: 'empty' }
const invalidState: StudentPhotoState = { status: 'invalid' }

type ParsedPhoto = {
  bytes: Uint8Array
  mime: string
}

function parseBase64(value: string): Uint8Array | null {
  if (
    value.length === 0 ||
    value.length > maxEncodedLength ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  ) return null

  const firstPadding = value.indexOf('=')
  const dataLength = firstPadding === -1 ? value.length : firstPadding
  const paddingLength = value.length - dataLength
  const remainder = dataLength % 4

  if (remainder === 1) return null
  if (paddingLength > 0 && (value.length % 4 !== 0 || (paddingLength === 1 && remainder !== 3) || (paddingLength === 2 && remainder !== 2))) {
    return null
  }

  const normalized = paddingLength > 0 ? value : value + '='.repeat((4 - remainder) % 4)

  try {
    const decoded = atob(normalized)
    if (decoded.length > maxDecodedBytes || btoa(decoded) !== normalized) return null

    const bytes = new Uint8Array(decoded.length)
    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index)
    }
    return bytes
  } catch {
    return null
  }
}

function detectMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10') return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'

  const header = String.fromCharCode(...bytes.slice(0, 6))
  if (bytes.length >= 6 && (header === 'GIF87a' || header === 'GIF89a')) return 'image/gif'

  const webpHeader = String.fromCharCode(...bytes.slice(0, 12))
  if (bytes.length >= 12 && webpHeader.slice(0, 4) === 'RIFF' && webpHeader.slice(8, 12) === 'WEBP') return 'image/webp'

  return null
}

function parsePhoto(photo: string | null | undefined): ParsedPhoto | null | undefined {
  if (photo === null || photo === undefined || photo === '') return undefined

  const dataUri = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(photo)
  const declaredMime = dataUri?.[1]
  const payload = dataUri ? dataUri[2] : photo.startsWith('data:') ? null : photo
  if (payload === null) return null

  const bytes = parseBase64(payload)
  if (!bytes) return null

  const mime = detectMime(bytes)
  if (!mime || (declaredMime && declaredMime !== mime)) return null
  return { bytes, mime }
}

export function useStudentPhoto(photo: string | null | undefined): StudentPhotoState {
  const [state, setState] = useState<{ photo: string | null | undefined; result: StudentPhotoState }>(() => ({
    photo,
    result: photo === null || photo === undefined || photo === '' ? emptyState : invalidState,
  }))

  useEffect(() => {
    let objectUrl: string | undefined
    let isActive = true

    if (photo === null || photo === undefined || photo === '') return

    const parsed = parsePhoto(photo)
    if (!parsed) return

    try {
      const blobBytes = new ArrayBuffer(parsed.bytes.byteLength)
      new Uint8Array(blobBytes).set(parsed.bytes)
      objectUrl = URL.createObjectURL(new Blob([blobBytes], { type: parsed.mime }))
      const src = objectUrl
      queueMicrotask(() => {
        if (isActive) setState({ photo, result: { status: 'ready', src } })
      })
    } catch {
      return
    }

    return () => {
      isActive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photo])

  if (state.photo !== photo) {
    setState({ photo, result: photo === null || photo === undefined || photo === '' ? emptyState : invalidState })
  }

  return state.photo === photo ? state.result : invalidState
}
