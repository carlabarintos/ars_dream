import { useEffect, useState } from 'react'

/**
 * Client-side search + "load more" pagination for a list that's already fully
 * loaded via a realtime subscription (no server-side query to paginate against).
 * Resets the visible page back to `pageSize` whenever the search query changes.
 */
export function usePaginatedSearch<T>(
  items: T[],
  matches: (item: T, query: string) => boolean,
  pageSize = 20,
) {
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(pageSize)

  useEffect(() => {
    setVisibleCount(pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = normalizedQuery ? items.filter((item) => matches(item, normalizedQuery)) : items
  const visible = filtered.slice(0, visibleCount)

  return {
    query,
    setQuery,
    filtered,
    visible,
    hasMore: visibleCount < filtered.length,
    loadMore: () => setVisibleCount((count) => count + pageSize),
  }
}
