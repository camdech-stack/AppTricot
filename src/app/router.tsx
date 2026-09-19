import { createHashRouter } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { HomePage } from '../pages/HomePage'
import { ProjectsPage } from '../pages/ProjectsPage'
import { ProjectFormPage } from '../pages/ProjectFormPage'
import { ProjectDetailPage } from '../pages/ProjectDetailPage'
import { PatternsPage } from '../pages/PatternsPage'
import { YarnPage } from '../pages/YarnPage'
import { StatsPage } from '../pages/StatsPage'
import { SettingsPage } from '../pages/SettingsPage'
import { StyleguidePage } from '../pages/StyleguidePage'

// GitHub Pages only serves the app's own index.html, so client-side routes
// can't rely on server rewrites for deep links: HashRouter keeps every
// route in the URL fragment, which the static host never needs to resolve.
//
// The project detail/form screens sit outside AppLayout: they draw their
// own header (back button, title, actions) instead of the generic
// AppHeader.
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
      { path: 'styleguide', element: <StyleguidePage /> },
    ],
  },
  { path: '/projets/nouveau', element: <ProjectFormPage /> },
  { path: '/projets/:projectId', element: <ProjectDetailPage /> },
  { path: '/projets/:projectId/modifier', element: <ProjectFormPage /> },
])
