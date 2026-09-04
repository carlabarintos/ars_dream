import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatUserName, useUserProfilesByIds } from '@/features/auth/use-user-profiles'
import { useMarathon } from '@/features/marathons/use-marathons'
import { confirmPayment, rejectPayment } from '@/features/registrations/api'
import { useMarathonRegistrations } from '@/features/registrations/use-registrations'
import type { Registration } from '@/types'

import { usePaginatedSearch } from './use-list-filter'

function totalDue(registration: Registration) {
  const addOnsTotal = (registration.selectedAddOns ?? []).reduce((sum, addOn) => sum + addOn.priceAmount, 0)
  return registration.packagePriceAmount + addOnsTotal
}

export function PaymentReviewPage() {
  const { marathonId } = useParams<{ marathonId: string }>()
  const { marathon } = useMarathon(marathonId)
  const { registrations, isLoading } = useMarathonRegistrations(marathonId, marathon?.cycle ?? 1, 'payment_submitted')
  const profiles = useUserProfilesByIds(registrations.map((registration) => registration.userId))
  const [rejecting, setRejecting] = useState<Registration | null>(null)
  const [note, setNote] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [isRejecting, setIsRejecting] = useState(false)
  const { query, setQuery, filtered, visible, hasMore, loadMore } = usePaginatedSearch(
    registrations,
    (registration, q) => {
      const profile = profiles[registration.userId]
      return (
        formatUserName(profile).toLowerCase().includes(q) ||
        (profile?.email ?? '').toLowerCase().includes(q) ||
        registration.packageName.toLowerCase().includes(q)
      )
    },
  )

  async function handleConfirm(registration: Registration) {
    setConfirmingId(registration.id)
    try {
      await confirmPayment(registration.id)
      toast.success('Payment confirmed — registration complete.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setConfirmingId(null)
    }
  }

  async function handleReject() {
    if (!rejecting) return
    setIsRejecting(true)
    try {
      await rejectPayment(rejecting.id, note)
      toast.success('Payment rejected. The user can resubmit.')
      setRejecting(null)
      setNote('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsRejecting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <h1 className="font-display text-3xl tracking-wide">Payment Review</h1>

      {registrations.length > 0 && (
        <Input
          placeholder="Search by name, email, or package…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : registrations.length === 0 ? (
        <p className="text-muted-foreground">No payment proofs awaiting review.</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No registrations match your search.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visible.map((registration) => {
              const profile = profiles[registration.userId]
              return (
                <Card key={registration.id}>
                  <CardHeader>
                    <CardTitle>{formatUserName(profile)}</CardTitle>
                    <p className="text-muted-foreground text-sm">{profile?.email ?? '—'}</p>
                    <p className="text-sm">
                      {registration.packageName} · {registration.packagePriceCurrency}{' '}
                      {totalDue(registration).toLocaleString()}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Submitted {registration.proofSubmittedAt?.toDate().toLocaleString() ?? '—'}
                    </p>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2">
                    {registration.proofOfPaymentUrls.map((url, index) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        <img
                          src={url}
                          alt={`Proof of payment ${index + 1}`}
                          className="max-h-64 w-full rounded-md border border-border object-contain"
                        />
                      </a>
                    ))}
                  </CardContent>
                  <CardFooter className="gap-2">
                    <Button loading={confirmingId === registration.id} onClick={() => handleConfirm(registration)}>
                      Confirm
                    </Button>
                    <Button variant="destructive" onClick={() => setRejecting(registration)}>
                      Reject
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
          {hasMore && (
            <Button variant="outline" onClick={loadMore} className="self-center">
              Load more ({filtered.length - visible.length} remaining)
            </Button>
          )}
        </>
      )}

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment Proof</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Reason (e.g. amount doesn't match, unreadable receipt)…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!note} loading={isRejecting}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
