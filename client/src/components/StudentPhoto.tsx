import { useState } from 'react'
import { useStudentPhoto } from '../data/useStudentPhoto'
import { Icon } from './Common'
import './StudentPhoto.css'

type StudentPhotoProps = {
  photo: string | null | undefined
  alt: string
  className?: string
}

export function StudentPhoto({ photo, alt, className }: StudentPhotoProps) {
  const image = useStudentPhoto(photo)
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  const classes = ['student-photo', className].filter(Boolean).join(' ')

  if (image.status !== 'ready' || failedPhoto === photo) {
    return (
      <span className={`${classes} student-photo-fallback`} role="img" aria-label={alt}>
        <Icon name="user" />
      </span>
    )
  }

  return (
    <img
      className={classes}
      src={image.src}
      alt={alt}
      onError={() => setFailedPhoto(photo ?? null)}
    />
  )
}
