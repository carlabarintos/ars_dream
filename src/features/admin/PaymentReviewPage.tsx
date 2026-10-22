import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
import {
  getPaymentProofs,
  getFinalInvoiceBalance,
  getDepositDue,
  isOnFinalInvoice,
} from '@/features/registrations/registration-flow'
import { UploadedFileButton } from '@/features/registrations/BookingDocumentDialog'
import { useMarathonRegistrations } from '@/features/registrations/use-registrations'
import { usePaginatedSearch } from '@/lib/use-paginated-search'
import type { Registration } from '@/types'

import { PaymentProofsDialog } from './PaymentProofsDialog'
import { useAcknowledgeMarathon } from './use-acknowledge-marathon'

export function PaymentReviewPage() {
  const { marathonId } = useParams<{ marathonId: string }>()
  const { marathon } = useMarathon(marathonId)
  useAcknowledgeMarathon(marathon)
  const { registrations, isLoading } = useMarathonRegistrations(marathonId, marathon?.cycle ?? 1, 'payment_submitted')
  const profiles = useUserProfilesByIds(registrations.map((registration) => registration.userId))
  const [rejecting, setRejecting] = useState<Registration | null>(null)
  const [note, setNote] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [isRejecting, setIsRejecting] = useState(false)
  const [viewingPayments, setViewingPayments] = useState<Registration | null>(null)
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
      toast.success(
        isOnFinalInvoice(registration)
          ? 'Balance confirmed — registration complete.'
          : 'Deposit confirmed — slot locked. Next: agree add-ons and send the final invoice.',
      )
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
      <p className="text-sm text-muted-foreground">
        Approved deposits leave this list and move to{' '}
        <Link to={`/admin/marathons/${marathonId}/queue`} className="underline">
          the Queue page
        </Link>
        , where you issue the Final Invoice.
      </p>

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
                      {isOnFinalInvoice(registration) ? (
                        <>
                          <span className="font-semibold">Balance</span> · {registration.packagePriceCurrency}{' '}
                          {getFinalInvoiceBalance(registration).toLocaleString()} (final invoice)
                        </>
                      ) : (
                        <>
                          <span className="font-semibold">Deposit</span> · {registration.packageName} ·{' '}
                          {registration.packagePriceCurrency} {getDepositDue(registration, marathon).toLocaleString()}
                        </>
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Submitted {registration.proofSubmittedAt?.toDate().toLocaleString() ?? '—'}
                    </p>
                    {registration.paymentReference && (
                      <p className="text-sm">
                        <span className="font-semibold">Branch / Ref. no.</span> · {registration.paymentReference}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2">
                    {getPaymentProofs(registration).latest.map((url, index) => (
                      <UploadedFileButton key={url} url={url} label={`Proof of payment ${index + 1}`}>
                        <img
                          src={url}
                          alt={`Proof of payment ${index + 1}`}
                          className="max-h-64 w-full rounded-md border border-border object-contain"
                        />
                      </UploadedFileButton>
                    ))}
                  </CardContent>
                  <CardFooter className="gap-2">
                    <Button loading={confirmingId === registration.id} onClick={() => handleConfirm(registration)}>
                      Confirm
                    </Button>
                    <Button variant="destructive" onClick={() => setRejecting(registration)}>
                      Reject
                    </Button>
                    {getPaymentProofs(registration).approved.length > 0 && (
                      <Button variant="outline" onClick={() => setViewingPayments(registration)}>
                        Earlier Payments
                      </Button>
                    )}
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
      {viewingPayments && (
        <PaymentProofsDialog
          registration={viewingPayments}
          registrantName={formatUserName(profiles[viewingPayments.userId])}
          onClose={() => setViewingPayments(null)}
        />
      )}
    </div>
  )
}
