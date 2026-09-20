// Single entry point for all Ravelry catalog-search code (step 3b). To
// remove the feature entirely: delete this folder, then remove the imports
// from it in SettingsPage, YarnFormPage, YarnDetailPage, router.tsx and
// vite.config.ts — see CLAUDE.md "Comment retirer le module Ravelry".
export { buildRavelryAuthHeader } from './auth'
export { classifyRavelryStatus, describeRavelryError } from './errors'
export {
  getYarnCatalogDetail,
  getLastRavelryCall,
  RAVELRY_SEARCH_PAGE_SIZE,
  searchYarnsCatalog,
  testRavelryConnection,
  type LastRavelryCall,
} from './client'
export { mapSearchResponse, mapSearchResultItem, mapWeightCategoryLabel, mapYarnDetail } from './mapping'
export { ravelryRequestQueue, RavelryRequestQueue } from './requestQueue'
export {
  countRavelryYarns,
  computeRemainingCatalogFields,
  purgeRavelryData,
  snapshotCatalogFields,
  YARN_CATALOG_FIELD_KEYS,
  type CatalogFieldSnapshot,
  type YarnCatalogFieldKey,
} from './catalogSync'
export { RAVELRY_RUNTIME_CACHING_RULE } from './serviceWorkerRule'
export {
  RavelryError,
  type RavelryCredentials,
  type RavelryErrorKind,
  type YarnCatalogDetail,
  type YarnCatalogSearchPage,
  type YarnCatalogSearchResult,
} from './types'
export { RavelrySettingsSection } from './components/RavelrySettingsSection'
export { RavelrySearchSheet, type RavelrySearchSelection } from './components/RavelrySearchSheet'
export { RavelryCatalogPill, RavelryPrefilledPill } from './components/RavelryCatalogPill'
export { RavelryDiagnosticPage } from './pages/RavelryDiagnosticPage'
