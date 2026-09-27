// Labels for the closed-list "Type" field on Piece and Section — additive to
// the free-text name, never a replacement for it (see CLAUDE.md "Modèle de
// données (étape 5a)").
import { PIECE_TYPES, SECTION_TYPES, type PieceType, type SectionType } from '../../../data'

export const PIECE_TYPE_LABELS: Record<PieceType, string> = {
  front: 'Devant',
  back: 'Dos',
  sleeve: 'Manche',
  body: 'Corps',
  yoke: 'Empiècement',
  collar: 'Col',
  hood: 'Capuche',
  pocket: 'Poche',
  belt: 'Ceinture',
  other: 'Autre',
}

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  ribbing: 'Côtes',
  body: 'Corps',
  shaping: 'Mise en forme',
  colorwork: 'Jacquard',
  neckline: 'Encolure',
  shoulder: 'Épaules',
  other: 'Autre',
}

export const PIECE_TYPE_OPTIONS = PIECE_TYPES.map((type) => ({ type, label: PIECE_TYPE_LABELS[type] }))
export const SECTION_TYPE_OPTIONS = SECTION_TYPES.map((type) => ({ type, label: SECTION_TYPE_LABELS[type] }))
