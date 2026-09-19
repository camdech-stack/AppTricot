// Single entry point for all data access. Components must import from here
// (or from a hook built on top of it) and never call Dexie directly.
export { db } from './db'
export { createId } from './id'
export { ensureSettingsInitialized, getSettings, updateSettings, watchSettings } from './settingsRepository'
export { requestPersistentStorage, isStoragePersisted } from './storage'
export {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  type NewProjectInput,
  type ProjectUpdateInput,
} from './projectsRepository'
export {
  getCounters,
  getCounter,
  getOrCreateStandaloneCounter,
  addCounter,
  renameCounter,
  setCounterGoal,
  setCounterValue,
  resetCounter,
  deleteCounter,
  applyCounterDelta,
  undoLastEvent,
  getCounterEvents,
} from './countersRepository'
export { setCoverImage, getCoverImage, deleteCoverImage } from './coverImagesRepository'
export { computeProjectProgress, type ProjectProgress, type ProgressCounterInput } from './progress'
export { nowIso, todayDateString } from './date'
export type {
  BaseEntity,
  AppSettingsRecord,
  LengthUnit,
  WeightUnit,
  ProjectRecord,
  ProjectCraft,
  ProjectStatus,
  ProjectColorKey,
  CounterRecord,
  CounterEventRecord,
  CounterEventType,
  CoverImageRecord,
} from './types'
