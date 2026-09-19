import { useEffect, useState } from 'react'
import { watchSettings, type AppSettingsRecord } from '../data'

export function useSettings(): AppSettingsRecord | undefined {
  const [settings, setSettings] = useState<AppSettingsRecord>()

  useEffect(() => {
    const subscription = watchSettings().subscribe({
      next: setSettings,
      error: (error: unknown) => {
        console.error('Failed to load settings', error)
      },
    })
    return () => subscription.unsubscribe()
  }, [])

  return settings
}
