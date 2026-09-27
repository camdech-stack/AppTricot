import { useEffect, useState } from 'react'

// Mirrors a CSS breakpoint in JS, for the rare case a component needs to
// pick between two panes rather than just toggling visibility (which CSS
// alone handles everywhere else — see FloatingTabBar). Keep the query in
// sync with whatever CSS media rule it's meant to match.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const list = window.matchMedia(query)
    const handleChange = () => setMatches(list.matches)
    handleChange()
    list.addEventListener('change', handleChange)
    return () => list.removeEventListener('change', handleChange)
  }, [query])

  return matches
}
