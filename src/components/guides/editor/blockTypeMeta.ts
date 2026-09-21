// Labels, short descriptions and examples for each block type — shown in
// the block-type picker sheet and reused for the block cards' summary line.
// Written from scratch, not copied from any other app's wording.
import type { BlockType, MeasureBlock, RepeatBlock, StitchCountBlock } from '../../../data'

export interface BlockTypeMeta {
  type: BlockType
  label: string
  description: string
  example: string
}

export const BLOCK_TYPE_META: BlockTypeMeta[] = [
  {
    type: 'rows',
    label: 'Rangs',
    description: 'Une suite de rangs numérotés, à tricoter dans l’ordre.',
    example: 'Ex. Rang 1 : *2 m end, 2 m env* — Rang 2 : tout à l’envers',
  },
  {
    type: 'repeat',
    label: 'Répétition',
    description: 'Répète un groupe de blocs un nombre de fois donné.',
    example: 'Ex. répéter les rangs 1 et 2, 10 fois',
  },
  {
    type: 'text',
    label: 'Texte libre',
    description: 'Une instruction ou une remarque qui ne se découpe pas en rangs.',
    example: 'Ex. « Placer les mailles des manches en attente sur un fil auxiliaire. »',
  },
  {
    type: 'measure',
    label: 'Jusqu’à une longueur',
    description: 'Répète le contenu jusqu’à atteindre une longueur mesurée depuis un repère.',
    example: 'Ex. jusqu’à 14 cm depuis le montage',
  },
  {
    type: 'stitch_count',
    label: 'Jusqu’à un nombre de mailles',
    description: 'Répète le contenu jusqu’à atteindre un nombre de mailles précis.',
    example: 'Ex. jusqu’à 45 mailles',
  },
]

export function blockTypeLabel(type: BlockType): string {
  return BLOCK_TYPE_META.find((meta) => meta.type === type)?.label ?? type
}

export function summarizeRepeatBlock(block: RepeatBlock): string {
  return `Répéter ${block.times} fois`
}

export function summarizeMeasureBlock(block: MeasureBlock): string {
  const unitLabel = block.unit === 'cm' ? 'cm' : 'po'
  const fromLabel = block.from.trim() ? ` depuis ${block.from.trim()}` : ''
  return `Jusqu’à ${block.length} ${unitLabel}${fromLabel}`
}

export function summarizeStitchCountBlock(block: StitchCountBlock): string {
  return `Jusqu’à ${block.target} maille${block.target > 1 ? 's' : ''}`
}
