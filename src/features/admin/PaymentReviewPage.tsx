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
import { Textarea } from '@/components/ui/textarea'
import { confirmPayment, rejectPayment } from '@/features/registrations/api'
import { useMarathonRegistrations } from '@/features/registrations/use-registrations'
import type { Registration } from '@/types'

export function PaymentReviewPage() {
  const { marathonId } = useParams<{ marathonId: string }>()
  const { registrations, isLoading } = useMarathonRegistrations(marathonId, 'payment_submitted')
  const [rejecting, setRejecting] = useState<Registration | null>(null)
  const [note, setNote] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [isRejecting, setIsRejecting] = useState(false)

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
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : registrations.length === 0 ? (
        <p className="text-muted-foreground">No payment proofs awaiting review.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {registrations.map((registration) => (
            <Card key={registration.id}>
              <CardHeader>
                <CardTitle className="font-mono text-sm">{registration.userId}</CardTitle>
              </CardHeader>
              <CardContent>
                {registration.proofOfPaymentUrl && (
                  <a href={registration.proofOfPaymentUrl} target="_blank" rel="noreferrer">
                    <img
                      src={registration.proofOfPaymentUrl}
                      alt="Proof of payment"
                      className="max-h-64 w-full rounded-md border border-border object-contain"
                    />
                  </a>
                )}
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
          ))}
        </div>
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
