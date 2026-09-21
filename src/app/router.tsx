import { createHashRouter } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { HomePage } from '../pages/HomePage'
import { ProjectsPage } from '../pages/ProjectsPage'
import { ProjectFormPage } from '../pages/ProjectFormPage'
import { ProjectDetailPage } from '../pages/ProjectDetailPage'
import { CounterPage } from '../pages/CounterPage'
import { PatternsPage } from '../pages/PatternsPage'
import { PatternDetailPage } from '../pages/PatternDetailPage'
import { PatternViewerPage } from '../pages/PatternViewerPage'
import { ProjectWorkPage } from '../pages/ProjectWorkPage'
import { LazyGuideEditorPage } from '../pages/LazyGuideEditorPage'
import { YarnPage } from '../pages/YarnPage'
import { YarnFormPage } from '../pages/YarnFormPage'
import { YarnDetailPage } from '../pages/YarnDetailPage'
import { StatsPage } from '../pages/StatsPage'
import { SettingsPage } from '../pages/SettingsPage'
import { StyleguidePage } from '../pages/StyleguidePage'
import { RavelryDiagnosticPage } from '../ravelry'

// GitHub Pages only serves the app's own index.html, so client-side routes
// can't rely on server rewrites for deep links: HashRouter keeps every
// route in the URL fragment, which the static host never needs to resolve.
//
// The project detail/form/counter screens sit outside AppLayout: they draw
// their own header (back button, title, actions) instead of the generic
// AppHeader, and the counter screen additionally hides the floating tab bar
// (see CLAUDE.md, "Écran compteur").
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
  { path: '/projets/:projectId/compteur', element: <CounterPage /> },
  { path: '/projets/:projectId/travail', element: <ProjectWorkPage /> },
  { path: '/compteur', element: <CounterPage /> },
  { path: '/patrons/:patternId', element: <PatternDetailPage /> },
  { path: '/patrons/:patternId/lire', element: <PatternViewerPage /> },
  { path: '/guides/:guideId', element: <LazyGuideEditorPage /> },
  { path: '/laine/nouveau', element: <YarnFormPage /> },
  { path: '/laine/:yarnId', element: <YarnDetailPage /> },
  { path: '/laine/:yarnId/modifier', element: <YarnFormPage /> },
  // Hidden diagnostic screen for Ravelry catalog search (step 3b), never
  // linked from the app nav — see CLAUDE.md.
  { path: '/diagnostic-ravelry', element: <RavelryDiagnosticPage /> },
])
