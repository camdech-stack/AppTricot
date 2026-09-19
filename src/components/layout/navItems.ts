import { HomeIcon, PatternsIcon, ProjectsIcon, StatsIcon, YarnBallIcon, type IconComponent } from '../icons'

export interface NavItem {
  to: string
  label: string
  icon: IconComponent
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Accueil', icon: HomeIcon },
  { to: '/projets', label: 'Projets', icon: ProjectsIcon },
  { to: '/patrons', label: 'Patrons', icon: PatternsIcon },
  { to: '/laine', label: 'Laine', icon: YarnBallIcon },
  { to: '/stats', label: 'Stats', icon: StatsIcon },
]
