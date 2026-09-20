import type { YarnColorFamily, YarnWeightCategory } from '../../data'

export const COLOR_FAMILY_LABELS: Record<YarnColorFamily, string> = {
  rouge: 'Rouge',
  rose: 'Rose',
  orange: 'Orange',
  jaune: 'Jaune',
  vert: 'Vert',
  bleu: 'Bleu',
  violet: 'Violet',
  marron: 'Marron',
  gris: 'Gris',
  noir: 'Noir',
  blanc: 'Blanc / écru',
  multicolore: 'Multicolore',
}

export const COLOR_FAMILY_OPTIONS: YarnColorFamily[] = [
  'rouge',
  'rose',
  'orange',
  'jaune',
  'vert',
  'bleu',
  'violet',
  'marron',
  'gris',
  'noir',
  'blanc',
  'multicolore',
]

export const WEIGHT_CATEGORY_LABELS: Record<YarnWeightCategory, string> = {
  dentelle: 'Dentelle',
  chaussettes: 'Chaussettes',
  sport: 'Sport',
  dk: 'DK',
  worsted: 'Worsted',
  aran: 'Aran',
  bulky: 'Bulky',
  super_bulky: 'Super bulky',
  autre: 'Autre',
}

export const WEIGHT_CATEGORY_OPTIONS: YarnWeightCategory[] = [
  'dentelle',
  'chaussettes',
  'sport',
  'dk',
  'worsted',
  'aran',
  'bulky',
  'super_bulky',
  'autre',
]
