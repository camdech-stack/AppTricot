import { createHashRouter } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { HomePage } from '../pages/HomePage'
import { ProjectsPage } from '../pages/ProjectsPage'
import { PatternsPage } from '../pages/PatternsPage'
import { YarnPage } from '../pages/YarnPage'
import { StatsPage } from '../pages/StatsPage'
import { SettingsPage } from '../pages/SettingsPage'

// GitHub Pages only serves the app's own index.html, so client-side routes
// can't rely on server rewrites for deep links: HashRouter keeps every
// route in the URL fragment, which the static host never needs to resolve.
export const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'projets', element: <ProjectsPage /> },
      { path: 'patrons', element: <PatternsPage /> },
      { path: 'laine', element: <YarnPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'reglages', element: <SettingsPage /> },
    ],
  },
])
