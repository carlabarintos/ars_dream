import { BadgeCheckIcon, StarIcon } from 'lucide-react'
import { useState } from 'react'

import type { Review } from '@/types'

import { usePhotoUrls } from './api'

function Stars({ rating, className = 'size-4' }: { rating: number; className?: string }) {
  return (
    <span className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} className={`${className} ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`} />
      ))}
    </span>
  )
}

// ponytail: length heuristic for showing "Read more", measure overflow if it misfires on narrow cards.
const LONG_COMMENT = 280

/** `clamp` cuts long reviews to 5 lines with a "Read more" toggle (carousel); the admin view shows them in full. */
export function ReviewCard({ review, clamp = false, className = '' }: { review: Review; clamp?: boolean; className?: string }) {
  const urls = usePhotoUrls(review.photoPaths)
  const [expanded, setExpanded] = useState(false)
  const canExpand = clamp && review.comment.length > LONG_COMMENT
  return (
    <article className={`border-border bg-card flex flex-col gap-3 rounded-2xl border p-6 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <Stars rating={review.rating} />
        {review.verified && (
          <span className="text-primary flex items-center gap-1 text-xs font-medium">
            <BadgeCheckIcon className="size-4" />
            Verified member
          </span>
        )}
      </div>
      <p className={`text-sm whitespace-pre-line ${canExpand && !expanded ? 'line-clamp-5' : ''}`}>{review.comment}</p>
      {canExpand && (
        <button type="button" className="text-primary self-start text-xs font-medium" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
      {urls.length > 0 && (
        <div className="flex gap-2">
          {urls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              <img src={url} alt="" loading="lazy" className="size-20 rounded-lg object-cover" />
            </a>
          ))}
        </div>
      )}
      <p className="text-muted-foreground mt-auto text-xs">
        — {review.name || 'Anonymous runner'} · {review.createdAt?.toDate().toLocaleDateString()}
      </p>
    </article>
  )
}
