import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getPatternCover } from '../data'

export function usePatternCoverUrl(patternId: string | undefined): string | undefined {
  const cover = useLiveQuery(() => (patternId ? getPatternCover(patternId) : undefined), [patternId])
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
