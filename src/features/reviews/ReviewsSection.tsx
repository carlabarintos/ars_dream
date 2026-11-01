import { ChevronLeftIcon, ChevronRightIcon, StarIcon, XIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { photoToDataUrl, REVIEW_COMMENT_MAX, REVIEW_NAME_MAX, REVIEW_PHOTOS_MAX, submitReview, useReviews } from './api'
import { ReviewCard } from './ReviewCard'

function WriteReviewDialog() {
  // Shareable link: arsdreamsports.com/?review opens this dialog straight away.
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).has('review'))
  const [name, setName] = useState('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleFiles(files: FileList | null) {
    const picked = Array.from(files ?? []).slice(0, REVIEW_PHOTOS_MAX - photos.length)
    try {
      const urls = await Promise.all(picked.map(photoToDataUrl))
      setPhotos((prev) => [...prev, ...urls])
    } catch {
      toast.error("Couldn't read that image.")
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await submitReview({ name: name.trim() || undefined, rating, comment, photos })
      toast.success('Thanks! Your review will appear once our team approves it.')
      setOpen(false)
      setName('')
      setRating(0)
      setComment('')
      setPhotos([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline">
          Write a Review
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Share your experience</DialogTitle>
            <DialogDescription>Reviews are checked by our team before they're published.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label>Rating</Label>
            <div className="flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  onClick={() => setRating(n)}
                >
                  <StarIcon className={`size-8 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="review-name">Name (optional)</Label>
            <Input id="review-name" value={name} maxLength={REVIEW_NAME_MAX} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="review-comment">Your review</Label>
            <Textarea
              id="review-comment"
              required
              rows={5}
              value={comment}
              maxLength={REVIEW_COMMENT_MAX}
              onChange={(e) => setComment(e.target.value)}
            />
            <p className="text-muted-foreground text-right text-xs">
              {comment.length}/{REVIEW_COMMENT_MAX}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="review-photos">Photos (optional, up to {REVIEW_PHOTOS_MAX})</Label>
            {photos.length < REVIEW_PHOTOS_MAX && (
              <Input
                id="review-photos"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  handleFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            )}
            {photos.length > 0 && (
              <div className="flex gap-2">
                {photos.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt="" className="size-20 rounded-lg object-cover" />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      className="bg-background absolute -top-2 -right-2 rounded-full border p-0.5"
                      onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" loading={isSubmitting} disabled={!rating || !comment.trim()}>
              Submit Review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ReviewsSection({ className = 'max-w-7xl pb-24 sm:pb-32' }: { className?: string }) {
  const { reviews } = useReviews('approved', 12)
  const trackRef = useRef<HTMLDivElement>(null)
  const scroll = (direction: 1 | -1) => trackRef.current?.scrollBy({ left: direction * trackRef.current.clientWidth })

  return (
    <section className={`mx-auto w-full px-4 ${className}`}>
      <div className="sd-reveal flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-display text-5xl tracking-wide sm:text-6xl">From our runners.</h2>
        <WriteReviewDialog />
      </div>
      {reviews.length > 0 ? (
        <div className="relative mt-10">
          <div
            ref={trackRef}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none]"
          >
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                clamp
                className="w-[85%] shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)]"
              />
            ))}
          </div>
          {reviews.length > 1 && (
            <div className="mt-4 hidden justify-end gap-2 sm:flex">
              <Button variant="outline" size="icon" aria-label="Previous reviews" onClick={() => scroll(-1)}>
                <ChevronLeftIcon />
              </Button>
              <Button variant="outline" size="icon" aria-label="Next reviews" onClick={() => scroll(1)}>
                <ChevronRightIcon />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground mt-6">Ran with us? Be the first to share your experience.</p>
      )}
    </section>
  )
}
