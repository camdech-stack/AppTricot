import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { requestPersistentStorage } from './data'
import { useSessionTracking } from './hooks/useSessionTracking'

function App() {
  useEffect(() => {
    requestPersistentStorage().catch((error: unknown) => {
      console.error('Failed to request persistent storage', error)
    })
  }, [])

  useSessionTracking()

  return <RouterProvider router={router} />
}

export default App
