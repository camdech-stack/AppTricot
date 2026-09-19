import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getCoverImage } from '../data'

export function useCoverImageUrl(projectId: string | undefined): string | undefined {
  const cover = useLiveQuery(() => (projectId ? getCoverImage(projectId) : undefined), [projectId])
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    if (!cover) {
      setUrl(undefined)
      return
    }
    const objectUrl = URL.createObjectURL(cover.blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [cover])

  return url
}
