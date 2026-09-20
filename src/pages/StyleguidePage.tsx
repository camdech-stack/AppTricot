import { ArrowLeft, Settings } from 'lucide-react'
import styles from './StyleguidePage.module.css'
import {
  Button,
  Card,
  HeroCard,
  IconButton,
  PageHeader,
  Pill,
  ProgressRing,
  SectionTitle,
  StatTile,
  StripedProgressBar,
  WaveDivider,
  type ProjectColor,
} from '../components/ui'
import { COLOR_FAMILY_LABELS, COLOR_FAMILY_OPTIONS } from '../components/yarn/yarnMeta'
import { yarnColorFamilyBorderStyle } from '../components/yarn/colorFamilyMeta'
import {
  HomeIcon,
  PatternsIcon,
  ProjectsIcon,
  SettingsIcon,
  StatsIcon,
  YarnBallIcon,
  type IconComponent,
} from '../components/icons'
import { Logo } from '../components/Logo'
import { APP_NAME } from '../config/appInfo'

const COLOR_GROUPS: { title: string; swatches: { name: string; varName: string; hex: string }[] }[] = [
  {
    title: 'Surfaces & texte',
    swatches: [
      { name: 'bg', varName: '--color-bg', hex: '#FCF8F3' },
      { name: 'surface', varName: '--color-surface', hex: '#FFFFFF' },
      { name: 'surface-alt', varName: '--color-surface-alt', hex: '#F5ECE6' },
      { name: 'border', varName: '--color-border', hex: '#EBDDD5' },
      { name: 'text', varName: '--color-text', hex: '#2B1A20' },
      { name: 'text-muted', varName: '--color-text-muted', hex: '#7A676E' },
    ],
  },
  {
    title: 'Marque',
    swatches: [
      { name: 'primary', varName: '--color-primary', hex: '#C2416B' },
      { name: 'primary-strong', varName: '--color-primary-strong', hex: '#8F3557' },
      { name: 'primary-soft', varName: '--color-primary-soft', hex: '#F9DEE6' },
      { name: 'on-primary', varName: '--color-on-primary', hex: '#FFFFFF' },
    ],
  },
  {
    title: 'Accents (fonds / icônes / badges uniquement pour gold et sage)',
    swatches: [
      { name: 'terracotta', varName: '--color-terracotta', hex: '#E2703F' },
      { name: 'terracotta-soft', varName: '--color-terracotta-soft', hex: '#FBE3D6' },
      { name: 'gold', varName: '--color-gold', hex: '#D4A85F' },
      { name: 'gold-soft', varName: '--color-gold-soft', hex: '#F6EBD3' },
      { name: 'blue', varName: '--color-blue', hex: '#6F86C9' },
      { name: 'blue-soft', varName: '--color-blue-soft', hex: '#E1E7F6' },
      { name: 'sage', varName: '--color-sage', hex: '#8FAE7E' },
      { name: 'sage-soft', varName: '--color-sage-soft', hex: '#E4EEDD' },
      { name: 'danger', varName: '--color-danger', hex: '#C8402F' },
      { name: 'danger-soft', varName: '--color-danger-soft', hex: '#F8DDD9' },
    ],
  },
]

const PROJECT_COLORS: { color: ProjectColor; name: string; hex: string }[] = [
  { color: 'prune', name: 'Prune', hex: '#A24E7A' },
  { color: 'pervenche', name: 'Pervenche', hex: '#6F86C9' },
  { color: 'terracotta', name: 'Terracotta', hex: '#C9583A' },
  { color: 'peche', name: 'Pêche', hex: '#F2A488' },
  { color: 'rouge', name: 'Rouge', hex: '#D93A3A' },
  { color: 'rose', name: 'Rose', hex: '#EE8FB8' },
]

const RADII: { name: string; varName: string }[] = [
  { name: 'sm', varName: '--radius-sm' },
  { name: 'md', varName: '--radius-md' },
  { name: 'lg', varName: '--radius-lg' },
  { name: 'pill', varName: '--radius-pill' },
]

const SPACING: string[] = ['4', '8', '12', '16', '20', '24', '32', '40', '56']

const SHADOWS: { name: string; varName: string }[] = [
  { name: 'sm', varName: '--shadow-sm' },
  { name: 'md', varName: '--shadow-md' },
  { name: 'lg', varName: '--shadow-lg' },
  { name: 'float (barre flottante)', varName: '--shadow-float' },
]

const ICONS: { name: string; Icon: IconComponent }[] = [
  { name: 'Home', Icon: HomeIcon },
  { name: 'Projects (FolderOpen)', Icon: ProjectsIcon },
  { name: 'Patterns (BookOpen)', Icon: PatternsIcon },
  { name: 'Yarn (perso)', Icon: YarnBallIcon },
  { name: 'Stats (BarChart3)', Icon: StatsIcon },
  { name: 'Settings', Icon: SettingsIcon },
]

export function StyleguidePage() {
  return (
    <div className={styles.page}>
      <h1>Styleguide</h1>
      <p className={styles.intro}>
        Système visuel de {`"${APP_NAME}"`} — thème clair uniquement. Toute valeur affichée ici vient
        d'un token de <code>src/styles/tokens.css</code>.
      </p>

      <section className={styles.section}>
        <SectionTitle title="Palette" />
        {COLOR_GROUPS.map((group) => (
          <div key={group.title} className={styles.group}>
            <div className={styles.groupTitle}>{group.title}</div>
            <div className={styles.swatchGrid}>
              {group.swatches.map((swatch) => (
                <div key={swatch.varName} className={styles.swatch}>
                  <div className={styles.swatchColor} style={{ background: `var(${swatch.varName})` }} />
                  <div className={styles.swatchName}>{swatch.name}</div>
                  <div className={styles.swatchHex}>{swatch.hex}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <SectionTitle title="Couleurs de projet & rayures" />
        <div className={styles.projectGrid}>
          {PROJECT_COLORS.map((project) => (
            <div key={project.color} className={styles.projectCard}>
              <div
                className={styles.swatchColor}
                style={{ background: `var(--color-project-${project.color})` }}
              />
              <div className={styles.swatchName}>{project.name}</div>
              <div className={styles.swatchHex}>{project.hex}</div>
              <StripedProgressBar progress={0.6} projectColor={project.color} label={`Progression ${project.name}`} />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <SectionTitle title="Couleurs de laine (étape 3a)" />
        <div className={styles.projectGrid}>
          {COLOR_FAMILY_OPTIONS.map((family) => (
            <div key={family} className={styles.projectCard}>
              <div
                className={styles.swatchColor}
                style={
                  family === 'multicolore'
                    ? {
                        ...yarnColorFamilyBorderStyle(family),
                        borderWidth: '4px',
                        borderStyle: 'solid',
                        background: 'var(--color-surface)',
                      }
                    : { background: `var(--color-yarn-${family})` }
                }
              />
              <div className={styles.swatchName}>{COLOR_FAMILY_LABELS[family]}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <SectionTitle title="Échelles" />

        <div className={styles.groupTitle}>Rayons</div>
        <div className={styles.scaleRow}>
          {RADII.map((radius) => (
            <div key={radius.varName} className={styles.scaleItem}>
              <div className={styles.radiusBox} style={{ borderRadius: `var(${radius.varName})` }} />
              <span>{radius.name}</span>
            </div>
          ))}
        </div>

        <div className={styles.groupTitle}>Espacements (base 4px)</div>
        <div className={styles.spacingList}>
          {SPACING.map((px) => (
            <div key={px} className={styles.spacingRow}>
              <span className={styles.spacingLabel}>{px}px</span>
              <div className={styles.spacingBar} style={{ width: `var(--space-${px})` }} />
            </div>
          ))}
        </div>

        <div className={styles.groupTitle}>Ombres (teintées framboise)</div>
        <div className={styles.scaleRow}>
          {SHADOWS.map((shadow) => (
            <div key={shadow.varName} className={styles.scaleItem}>
              <div className={styles.shadowBox} style={{ boxShadow: `var(${shadow.varName})` }} />
              <span>{shadow.name}</span>
            </div>
          ))}
        </div>

        <div className={styles.groupTitle}>Transitions & appui (respecte prefers-reduced-motion)</div>
        <Button variant="primary">Appuyer pour voir l'effet (scale 0.97)</Button>
      </section>

      <section className={styles.section}>
        <SectionTitle title="Typographie" />
        <div className={styles.typeRow}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-3xl)', fontWeight: 700 }}>
            Outfit — titres (3xl)
          </span>
        </div>
        <div className={styles.typeRow}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', fontWeight: 700 }}>
            Outfit — xl
          </span>
        </div>
        <div className={styles.typeRow}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-md)' }}>
            DM Sans — texte courant (md), pour les paragraphes et labels de l'interface.
          </span>
        </div>
        <div className={styles.typeRow}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            DM Sans — texte secondaire (sm)
          </span>
        </div>
        <div className={styles.counterExample}>42</div>
      </section>

      <section className={styles.section}>
        <SectionTitle title="Icônes" />
        <div className={styles.iconGrid}>
          {ICONS.map(({ name, Icon }) => (
            <div key={name} className={styles.iconItem}>
              <div className={styles.iconSizes}>
                <Icon size={20} />
                <Icon size={24} />
                <Icon size={28} />
              </div>
              <span>{name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <SectionTitle title="Composants" />

        <div className={styles.groupTitle}>Button</div>
        <div className={styles.componentRow}>
          <Button variant="primary" size="md">
            Primary md
          </Button>
          <Button variant="secondary" size="md">
            Secondary md
          </Button>
          <Button variant="ghost" size="md">
            Ghost md
          </Button>
          <Button variant="primary" size="lg">
            Primary lg
          </Button>
          <Button variant="primary" size="md" disabled>
            Désactivé
          </Button>
          <Button variant="primary" size="md" icon={<Settings size={18} strokeWidth={1.75} />}>
            Avec icône
          </Button>
        </div>

        <div className={styles.groupTitle}>IconButton</div>
        <div className={styles.componentRow}>
          <IconButton icon={<ArrowLeft size={22} strokeWidth={1.75} />} label="Retour" />
          <IconButton icon={<Settings size={22} strokeWidth={1.75} />} label="Réglages" />
        </div>

        <div className={styles.groupTitle}>Card & HeroCard</div>
        <div className={styles.componentRow}>
          <Card className={styles.cardDemo}>Card — contenu quelconque, fond blanc, ombre douce.</Card>
          <HeroCard className={styles.cardDemo}>HeroCard — dégradé framboise, texte clair.</HeroCard>
        </div>

        <div className={styles.groupTitle}>Pill</div>
        <div className={styles.componentRow}>
          <Pill color="primary">Primary</Pill>
          <Pill color="terracotta">Terracotta</Pill>
          <Pill color="gold">Gold</Pill>
          <Pill color="blue">Blue</Pill>
          <Pill color="sage">Sage</Pill>
          <Pill color="danger">Danger</Pill>
        </div>

        <div className={styles.groupTitle}>StatTile</div>
        <div className={styles.componentRow}>
          <StatTile icon={<HomeIcon size={22} />} value="12" label="Projets" color="primary" />
          <StatTile icon={<YarnBallIcon size={22} />} value="8" label="Pelotes" color="terracotta" />
          <StatTile icon={<StatsIcon size={22} />} value="3h20" label="Cette semaine" color="blue" />
        </div>

        <div className={styles.groupTitle}>ProgressRing</div>
        <div className={styles.componentRow}>
          <ProgressRing progress={0.25} label="25 %" />
          <ProgressRing progress={0.6} label="60 %" />
          <ProgressRing progress={1} label="100 %" />
        </div>

        <div className={styles.groupTitle}>StripedProgressBar</div>
        <div className={styles.stackDemo}>
          <StripedProgressBar progress={0.4} projectColor="pervenche" label="Exemple" />
        </div>

        <div className={styles.groupTitle}>WaveDivider</div>
        <div className={styles.waveDemo}>
          <div className={styles.waveDemoColor} />
          <WaveDivider />
        </div>

        <div className={styles.groupTitle}>PageHeader</div>
        <div className={styles.pageHeaderDemo}>
          <PageHeader title="Titre de page" onBack={() => {}} action={<Logo />} colored />
        </div>

        <div className={styles.groupTitle}>SectionTitle</div>
        <div className={styles.componentRow}>
          <SectionTitle title="Titre de section" seeAllTo="/styleguide" />
        </div>
      </section>

      <section className={styles.section}>
        <SectionTitle title="Exemple de page type" />
        <div className={styles.pageExample}>
          <PageHeader title="Mon projet" onBack={() => {}} colored />
          <div className={styles.pageExampleBody}>
            <HeroCard>
              <div className={styles.heroTitle}>Châle en dentelle</div>
              <div className={styles.heroSubtitle}>Rang 42 sur 120</div>
            </HeroCard>
            <div className={styles.statRow}>
              <StatTile icon={<HomeIcon size={22} />} value="42" label="Rang actuel" color="primary" />
              <StatTile icon={<StatsIcon size={22} />} value="2h10" label="Temps total" color="blue" />
              <StatTile icon={<YarnBallIcon size={22} />} value="120g" label="Laine utilisée" color="terracotta" />
            </div>
            <StripedProgressBar progress={0.35} projectColor="pervenche" label="Progression du projet" />
          </div>
        </div>
        <p className={styles.note}>
          La barre de navigation flottante réelle (FloatingTabBar) est visible en bas de cette page — pilule sur
          iPhone, navigation latérale sur iPad et ordinateur.
        </p>
      </section>
    </div>
  )
}
