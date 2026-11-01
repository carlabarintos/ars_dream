import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { approveReview, deleteReview, useReviews } from '@/features/reviews/api'
import { ReviewCard } from '@/features/reviews/ReviewCard'
import type { Review, ReviewStatus } from '@/types'

function ReviewList({ status }: { status: ReviewStatus }) {
  const { reviews, isLoading } = useReviews(status, 200)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function run(review: Review, action: () => Promise<void>, message: string) {
    setBusyId(review.id)
    try {
      await action()
      toast.success(message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setBusyId(null)
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (!reviews.length) return <p className="text-muted-foreground">No {status} reviews.</p>

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {reviews.map((review) => (
        <div key={review.id} className="flex flex-col gap-2">
          <ReviewCard review={review} />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busyId === review.id}
              onClick={() => run(review, () => deleteReview(review), status === 'pending' ? 'Review rejected.' : 'Review removed.')}
            >
              {status === 'pending' ? 'Reject' : 'Remove'}
            </Button>
            {status === 'pending' && (
              <Button
                size="sm"
                loading={busyId === review.id}
                onClick={() => run(review, () => approveReview(review.id), 'Review published.')}
              >
                Approve
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ReviewsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide">Reviews</h1>
        <p className="text-muted-foreground mt-1">Approve reviews before they appear on the landing page.</p>
      </div>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Published</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          <ReviewList status="pending" />
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
          <ReviewList status="approved" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
