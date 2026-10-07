export type BackupErrorCode =
  | 'not_a_backup'
  | 'invalid_manifest'
  | 'invalid_data'
  | 'newer_version'
  | 'incomplete'
  | 'restore_failed'

// `message` is user-facing French text.
export class BackupError extends Error {
  readonly code: BackupErrorCode
  constructor(code: BackupErrorCode, message: string) {
    super(message)
    this.name = 'BackupError'
    this.code = code
  }
}
