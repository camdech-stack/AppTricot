import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Copy, Search, Trash2 } from 'lucide-react'
import styles from './YarnFormPage.module.css'
import { Button, ConfirmDialog, PageHeader } from '../components/ui'
import { COLOR_FAMILY_LABELS, COLOR_FAMILY_OPTIONS, WEIGHT_CATEGORY_LABELS, WEIGHT_CATEGORY_OPTIONS } from '../components/yarn/yarnMeta'
import { metersToYards, yardsToMeters } from '../data/yarnMath'
import {
  compressCoverImage,
  createYarn,
  deleteYarn,
  getYarn,
  setYarnImage,
  toDuplicateDraft,
  updateYarn,
  type YarnCatalogSource,
  type YarnColorFamily,
  type YarnDraft,
  type YarnRecord,
  type YarnWeightCategory,
} from '../data'
import { useYarnImageUrl } from '../hooks/useYarnImageUrl'
import { useSettings } from '../hooks/useSettings'
import {
  computeRemainingCatalogFields,
  RavelryPrefilledPill,
  RavelrySearchSheet,
  YARN_CATALOG_FIELD_KEYS,
  type CatalogFieldSnapshot,
  type RavelrySearchSelection,
  type YarnCatalogFieldKey,
} from '../ravelry'

function numberOrEmpty(value: number | null): string {
  return value === null ? '' : String(value)
}

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function YarnFormPage() {
  const { yarnId } = useParams<{ yarnId: string }>()
  const isEditing = Boolean(yarnId)
  const navigate = useNavigate()
  const location = useLocation()
  const settings = useSettings()
  const lengthUnit = settings?.lengthUnit ?? 'm'

  const draft = (location.state as { draft?: YarnDraft } | null)?.draft

  // Read inside the load effect without becoming a dependency of it: the
  // effect must only re-run when the loaded record changes, never when the
  // user flips the length unit in Settings (which would overwrite in-progress edits).
  const lengthUnitRef = useRef(lengthUnit)
  useEffect(() => {
    lengthUnitRef.current = lengthUnit
  }, [lengthUnit])

  const [loaded, setLoaded] = useState(!isEditing)
  const [name, setName] = useState(draft?.name ?? '')
  const [brand, setBrand] = useState(draft?.brand ?? '')
  const [line, setLine] = useState(draft?.line ?? '')
  const [colorName, setColorName] = useState(draft?.colorName ?? '')
  const [colorRef, setColorRef] = useState(draft?.colorRef ?? '')
  const [colorFamily, setColorFamily] = useState<YarnColorFamily | ''>(draft?.colorFamily ?? '')
  const [weightCategory, setWeightCategory] = useState<YarnWeightCategory | ''>(draft?.weightCategory ?? '')
  const [fiber, setFiber] = useState(draft?.fiber ?? '')
  const [skeinCount, setSkeinCount] = useState('0')
  // Length figures are edited in the app's display unit and converted to
  // meters (the storage unit) on save — see CLAUDE.md "Stockage en système
  // métrique".
  const [metersPerSkeinInput, setMetersPerSkeinInput] = useState(
    numberOrEmpty(draft?.metersPerSkein ? (lengthUnit === 'yd' ? metersToYards(draft.metersPerSkein) : draft.metersPerSkein) : null),
  )
  const [gramsPerSkein, setGramsPerSkein] = useState(numberOrEmpty(draft?.gramsPerSkein ?? null))
  const [dyeLot, setDyeLot] = useState('')
  const [notes, setNotes] = useState('')
  const [price, setPrice] = useState('')
  const [purchasedAt, setPurchasedAt] = useState('')
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [photoProcessing, setPhotoProcessing] = useState(false)
  const [photoError, setPhotoError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Ravelry catalog search (step 3b) — see CLAUDE.md "Modèle de données
  // (étape 3b)". catalogBaseline/catalogFieldKeys hold what still needs
  // comparing at save time: fields the user hasn't touched since the
  // catalog last filled them in stay in catalogFields, everything else
  // drops out.
  const [catalogSource, setCatalogSource] = useState<YarnCatalogSource>(draft?.catalogSource ?? 'manual')
  const [ravelryYarnId, setRavelryYarnId] = useState<string | null>(draft?.ravelryYarnId ?? null)
  const [ravelryPermalink, setRavelryPermalink] = useState<string | null>(draft?.ravelryPermalink ?? null)
  const [catalogFetchedAt, setCatalogFetchedAt] = useState<string | null>(null)
  const [catalogBaseline, setCatalogBaseline] = useState<CatalogFieldSnapshot | null>(null)
  const [catalogFieldKeys, setCatalogFieldKeys] = useState<YarnCatalogFieldKey[]>([])
  const [searchSheetOpen, setSearchSheetOpen] = useState(false)

  const existingPhotoUrl = useYarnImageUrl(yarnId)
  const [previewUrl, setPreviewUrl] = useState<string>()

  useEffect(() => {
    if (!yarnId) return
    getYarn(yarnId)
      .then((yarn) => {
        if (!yarn) return
        setName(yarn.name)
        setBrand(yarn.brand)
        setLine(yarn.line)
        setColorName(yarn.colorName)
        setColorRef(yarn.colorRef)
        setColorFamily(yarn.colorFamily ?? '')
        setWeightCategory(yarn.weightCategory ?? '')
        setFiber(yarn.fiber)
        setSkeinCount(String(yarn.skeinCount))
        setMetersPerSkeinInput(
          numberOrEmpty(
            yarn.metersPerSkein
              ? lengthUnitRef.current === 'yd'
                ? metersToYards(yarn.metersPerSkein)
                : yarn.metersPerSkein
              : null,
          ),
        )
        setGramsPerSkein(numberOrEmpty(yarn.gramsPerSkein))
        setDyeLot(yarn.dyeLot)
        setNotes(yarn.notes)
        setPrice(numberOrEmpty(yarn.price))
        setPurchasedAt(yarn.purchasedAt ?? '')
        setCatalogSource(yarn.catalogSource)
        setRavelryYarnId(yarn.ravelryYarnId)
        setRavelryPermalink(yarn.ravelryPermalink)
        setCatalogFetchedAt(yarn.catalogFetchedAt)
        if (yarn.catalogSource === 'ravelry' && yarn.catalogFields.length > 0) {
          const keys = yarn.catalogFields.filter((field): field is YarnCatalogFieldKey =>
            (YARN_CATALOG_FIELD_KEYS as string[]).includes(field),
          )
          const snapshot: CatalogFieldSnapshot = {}
          for (const key of keys) {
            snapshot[key] = yarn[key]
          }
          setCatalogBaseline(snapshot)
          setCatalogFieldKeys(keys)
        }
        setLoaded(true)
      })
      .catch((error: unknown) => {
        console.error('Failed to load yarn', error)
      })
  }, [yarnId])

  useEffect(() => {
    if (!photoBlob) {
      setPreviewUrl(undefined)
      return
    }
    const url = URL.createObjectURL(photoBlob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photoBlob])

  const photoPreview = previewUrl ?? existingPhotoUrl

  async function handlePhotoChange(file: File | undefined) {
    setPhotoError(undefined)
    if (!file) {
      setPhotoBlob(null)
      return
    }
    setPhotoProcessing(true)
    try {
      const blob = await compressCoverImage(file)
      setPhotoBlob(blob)
    } catch (error: unknown) {
      console.error('Failed to process yarn photo', error)
      setPhotoBlob(null)
      setPhotoError("Cette photo n'a pas pu être utilisée. Essayez-en une autre.")
    } finally {
      setPhotoProcessing(false)
    }
  }

  function handleCatalogSelect(selection: RavelrySearchSelection) {
    const { draft: picked, catalogFields, fetchedAt } = selection
    if (picked.name !== undefined) setName(picked.name)
    if (picked.brand !== undefined) setBrand(picked.brand)
    if (picked.line !== undefined) setLine(picked.line)
    if (picked.weightCategory !== undefined) setWeightCategory(picked.weightCategory ?? '')
    if (picked.fiber !== undefined) setFiber(picked.fiber)
    if (picked.metersPerSkein !== undefined) {
      setMetersPerSkeinInput(
        numberOrEmpty(picked.metersPerSkein ? (lengthUnit === 'yd' ? metersToYards(picked.metersPerSkein) : picked.metersPerSkein) : null),
      )
    }
    if (picked.gramsPerSkein !== undefined) setGramsPerSkein(numberOrEmpty(picked.gramsPerSkein ?? null))
    setCatalogSource('ravelry')
    setRavelryYarnId(picked.ravelryYarnId ?? null)
    setRavelryPermalink(picked.ravelryPermalink ?? null)
    setCatalogFetchedAt(fetchedAt)
    setCatalogBaseline(catalogFields)
    setCatalogFieldKeys(Object.keys(catalogFields) as YarnCatalogFieldKey[])
    setSearchSheetOpen(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const metersPerSkeinValue = parseOptionalNumber(metersPerSkeinInput)
      const metersPerSkein = metersPerSkeinValue === null ? null : lengthUnit === 'yd' ? yardsToMeters(metersPerSkeinValue) : metersPerSkeinValue

      const baseInput = {
        name: name.trim(),
        brand,
        line,
        colorName,
        colorRef,
        colorFamily: colorFamily || null,
        weightCategory: weightCategory || null,
        fiber,
        skeinCount: parseOptionalNumber(skeinCount) ?? 0,
        metersPerSkein,
        gramsPerSkein: parseOptionalNumber(gramsPerSkein),
        dyeLot,
        notes,
        price: parseOptionalNumber(price),
        purchasedAt: purchasedAt || null,
      }

      const catalogFields = catalogBaseline ? computeRemainingCatalogFields(catalogFieldKeys, catalogBaseline, baseInput) : []

      const input = {
        ...baseInput,
        catalogSource,
        ravelryYarnId,
        ravelryPermalink,
        catalogFields,
        catalogFetchedAt,
      }

      const yarn: YarnRecord = yarnId ? await updateYarn(yarnId, input) : await createYarn(input)

      if (photoBlob) {
        await setYarnImage(yarn.id, photoBlob)
      }
      navigate(`/laine/${yarn.id}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!yarnId || deleting) return
    setDeleting(true)
    try {
      await deleteYarn(yarnId)
      navigate('/laine')
    } finally {
      setDeleting(false)
    }
  }

  async function handleDuplicate() {
    if (!yarnId) return
    const yarn = await getYarn(yarnId)
    if (!yarn) return
    navigate('/laine/nouveau', { state: { draft: toDuplicateDraft(yarn) } })
  }

  if (!loaded) {
    return <div className={styles.page} />
  }

  return (
    <div className={styles.page}>
      <PageHeader title={isEditing ? 'Modifier le fil' : 'Nouveau fil'} onBack={() => navigate(-1)} />
      <div className={styles.scrollArea}>
        <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
          {settings?.ravelryEnabled && settings.ravelryUsername && settings.ravelryPassword ? (
            <Button
              type="button"
              variant="secondary"
              icon={<Search size={18} strokeWidth={1.75} />}
              onClick={() => setSearchSheetOpen(true)}
            >
              Rechercher dans le catalogue
            </Button>
          ) : (
            <p className={styles.helperText}>
              <Link to="/reglages">Active le catalogue Ravelry dans les Réglages</Link> pour préremplir un fil depuis
              une recherche.
            </p>
          )}
          {catalogSource === 'ravelry' && <RavelryPrefilledPill />}

          <div className={styles.section}>
            <span className={styles.sectionTitle}>Identité</span>
            <label className={styles.field}>
              <span className={styles.label}>Nom</span>
              <input className={styles.input} value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Marque</span>
              <input className={styles.input} value={brand} onChange={(event) => setBrand(event.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Gamme</span>
              <input className={styles.input} value={line} onChange={(event) => setLine(event.target.value)} />
            </label>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>Couleur</span>
            <label className={styles.field}>
              <span className={styles.label}>Nom de la couleur</span>
              <input className={styles.input} value={colorName} onChange={(event) => setColorName(event.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Référence couleur</span>
              <input className={styles.input} value={colorRef} onChange={(event) => setColorRef(event.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Famille de couleur</span>
              <select
                className={styles.input}
                value={colorFamily}
                onChange={(event) => setColorFamily(event.target.value as YarnColorFamily | '')}
              >
                <option value="">—</option>
                {COLOR_FAMILY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {COLOR_FAMILY_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Lot de teinture</span>
              <input className={styles.input} value={dyeLot} onChange={(event) => setDyeLot(event.target.value)} />
            </label>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>Format</span>
            <label className={styles.field}>
              <span className={styles.label}>Épaisseur</span>
              <select
                className={styles.input}
                value={weightCategory}
                onChange={(event) => setWeightCategory(event.target.value as YarnWeightCategory | '')}
              >
                <option value="">—</option>
                {WEIGHT_CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {WEIGHT_CATEGORY_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Composition</span>
              <input className={styles.input} value={fiber} onChange={(event) => setFiber(event.target.value)} />
            </label>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>Stock</span>
            <label className={styles.field}>
              <span className={styles.label}>Nombre de pelotes</span>
              <input
                className={styles.input}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                value={skeinCount}
                onChange={(event) => setSkeinCount(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Métrage par pelote ({lengthUnit === 'yd' ? 'yd' : 'm'})</span>
              <input
                className={styles.input}
                type="number"
                inputMode="decimal"
                min={0}
                value={metersPerSkeinInput}
                onChange={(event) => setMetersPerSkeinInput(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Poids par pelote (g)</span>
              <input
                className={styles.input}
                type="number"
                inputMode="decimal"
                min={0}
                value={gramsPerSkein}
                onChange={(event) => setGramsPerSkein(event.target.value)}
              />
            </label>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>Achat</span>
            <label className={styles.field}>
              <span className={styles.label}>Prix (€)</span>
              <input
                className={styles.input}
                type="number"
                inputMode="decimal"
                min={0}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Date d'achat</span>
              <input
                className={styles.input}
                type="date"
                value={purchasedAt}
                onChange={(event) => setPurchasedAt(event.target.value)}
              />
            </label>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>Photo</span>
            <label className={styles.field}>
              {photoPreview && <img src={photoPreview} alt="" className={styles.preview} />}
              <input type="file" accept="image/*" onChange={(event) => void handlePhotoChange(event.target.files?.[0])} />
              {photoProcessing && <span className={styles.photoStatus}>Traitement de la photo…</span>}
              {photoError && <span className={styles.photoError}>{photoError}</span>}
            </label>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>Notes</span>
            <label className={styles.field}>
              <textarea className={styles.textarea} value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
            </label>
          </div>

          <Button type="submit" size="lg" disabled={saving || photoProcessing || !name.trim()}>
            {isEditing ? 'Enregistrer' : 'Créer le fil'}
          </Button>

          {isEditing && (
            <>
              <Button type="button" variant="secondary" icon={<Copy size={18} strokeWidth={1.75} />} onClick={() => void handleDuplicate()}>
                Dupliquer pour une autre couleur
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={styles.deleteButton}
                icon={<Trash2 size={18} strokeWidth={1.75} />}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                Supprimer le fil
              </Button>
            </>
          )}
        </form>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Supprimer le fil"
        message="Cette action supprime aussi ses liens avec les projets, son historique de consommation et sa photo. Elle est irréversible."
        confirmLabel="Supprimer"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      <RavelrySearchSheet
        open={searchSheetOpen}
        onClose={() => setSearchSheetOpen(false)}
        onSelect={handleCatalogSelect}
        lengthUnit={lengthUnit}
      />
    </div>
  )
}
