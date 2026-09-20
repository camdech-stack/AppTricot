import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import styles from './TagEditor.module.css'
import { normalizeTag, normalizeTags, suggestTags } from '../../data'

interface TagEditorProps {
  tags: string[]
  onChange: (tags: string[]) => void
  // Every distinct tag already used across the library, for suggestions —
  // see CLAUDE.md "tags avec suggestions issues des tags existants".
  allTags: string[]
}

export function TagEditor({ tags, onChange, allTags }: TagEditorProps) {
  const [draft, setDraft] = useState('')

  function commitDraft() {
    const tag = normalizeTag(draft)
    if (!tag) {
      setDraft('')
      return
    }
    onChange(normalizeTags([...tags, tag]))
    setDraft('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter((candidate) => candidate !== tag))
  }

  function addSuggestion(tag: string) {
    onChange(normalizeTags([...tags, tag]))
  }

  const suggestions = suggestTags(allTags, tags).slice(0, 8)

  return (
    <div className={styles.wrap}>
      <div className={styles.chips}>
        {tags.map((tag) => (
          <button key={tag} type="button" className={styles.chip} onClick={() => removeTag(tag)}>
            {tag}
            <X size={14} strokeWidth={2} />
          </button>
        ))}
        <input
          className={styles.input}
          value={draft}
          placeholder="Ajouter un tag…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              commitDraft()
            }
          }}
          onBlur={commitDraft}
        />
      </div>

      {suggestions.length > 0 && (
        <div className={styles.suggestions}>
          {suggestions.map((tag) => (
            <button key={tag} type="button" className={styles.suggestion} onClick={() => addSuggestion(tag)}>
              <Plus size={14} strokeWidth={2} />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
