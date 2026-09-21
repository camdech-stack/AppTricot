import type { JoinMode, Operation, OperationKind } from '../../../data'

export const OPERATION_KIND_LABELS: Record<OperationKind, string> = {
  cast_on: 'Montage',
  pick_up: 'Reprise de mailles',
  join: 'Jonction en rond',
  bind_off: 'Rabattre les mailles',
  graft: 'Greffe (Kitchener)',
  three_needle_bind_off: 'Rabat aux 3 aiguilles',
}

export const JOIN_MODE_LABELS: Record<JoinMode, string> = {
  round: 'En rond dès le départ',
  new_yarn: 'Avec un nouveau fil',
}

export function summarizeOperation(operation: Operation): string {
  const parts = [OPERATION_KIND_LABELS[operation.kind]]
  if (operation.stitches != null) parts.push(`${operation.stitches} mailles`)
  if (operation.kind === 'join' && operation.joinMode) parts.push(JOIN_MODE_LABELS[operation.joinMode])
  return parts.join(' · ')
}
