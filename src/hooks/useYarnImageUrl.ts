import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getYarnImage } from '../data'

export function useYarnImageUrl(yarnId: string | undefined): string | undefined {
  const image = useLiveQuery(() => (yarnId ? getYarnImage(yarnId) : undefined), [yarnId])
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    if (!image) {
      setUrl(undefined)
      return
    }
    const objectUrl = URL.createObjectURL(image.blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [image])

  return url
}
