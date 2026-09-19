import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { useSettings } from './hooks/useSettings'
import { requestPersistentStorage } from './data'

function App() {
  const settings = useSettings()

  useEffect(() => {
    requestPersistentStorage().catch((error: unknown) => {
      console.error('Failed to request persistent storage', error)
    })
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (settings?.theme === 'light' || settings?.theme === 'dark') {
      root.dataset.theme = settings.theme
    } else {
      delete root.dataset.theme
    }
  }, [settings?.theme])

  return <RouterProvider router={router} />
}

export default App
