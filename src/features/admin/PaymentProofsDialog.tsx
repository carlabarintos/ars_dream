import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { confirmPayment, rejectPayment } from '@/features/registrations/api'
import {
  getDepositDue,
  getFinalInvoiceBalance,
  getPaymentProofs,
  isOnFinalInvoice,
} from '@/features/registrations/registration-flow'
import type { Marathon, Registration } from '@/types'

import { UploadedFileButton } from '@/features/registrations/BookingDocumentDialog'

function ProofGrid({ title, urls }: { title: string; urls: string[] }) {
  if (urls.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {urls.map((url, index) => (
          <UploadedFileButton
            key={url}
            url={url}
            label={`${title} ${index + 1}`}
            className={urls.length === 1 ? 'w-full' : 'w-[calc(50%-0.25rem)]'}
          >
            <img
              src={url}
              alt={`${title} ${index + 1}`}
              className={`border-border mx-auto block max-w-full rounded-md border ${urls.length === 1 ? 'max-h-[60vh]' : 'max-h-64'}`}
            />
          </UploadedFileButton>
        ))}
      </div>
    </div>
  )
}

/** Branch / reference number entered with each approved payment. */
export function ApprovedReferences({ registration }: { registration: Registration }) {
  const references = (registration.approvedPaymentReferences ?? [])
    .map((reference, index) => ({ reference, label: index === 0 ? 'Deposit' : 'Balance' }))
    .filter(({ reference }) => reference)
  if (references.length === 0) return null
  return (
    <div className="flex flex-col gap-1 text-sm">
      {references.map(({ reference, label }, index) => (
        <p key={index}>
          <span className="font-semibold">{label} · Branch / Ref. no.</span> · {reference}
        </p>
      ))}
    </div>
  )
}

/** Every payment proof a registrant has uploaded on a booking; with `review`, just the pending one plus Approve/Reject. */
export function PaymentProofsDialog({
  registration,
  registrantName,
  review,
  marathon,
  onClose,
}: {
  /** Set only while the registration is payment_submitted. */
  review?: boolean
  registration: Registration
  registrantName: string
  marathon?: Marathon | null
  onClose: () => void
}) {
  const { approved, latest } = getPaymentProofs(registration)
  const isPending = registration.status === 'payment_submitted' || registration.status === 'payment_rejected'
  const isBalance = isOnFinalInvoice(registration)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null)

  async function handleConfirm() {
    setBusy('confirm')
    try {
      await confirmPayment(registration.id)
      toast.success(
        isBalance
          ? 'Balance confirmed — registration complete.'
          : 'Deposit confirmed — slot locked. Next: agree add-ons and send the final invoice.',
      )
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  async function handleReject() {
    setBusy('reject')
    try {
      await rejectPayment(registration.id, note)
      toast.success('Payment rejected. The user can resubmit.')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{review ? 'Review Payment' : 'Payments'}</DialogTitle>
          <DialogDescription>
            {registrantName}
            {review &&
              ` · ${isBalance ? 'Balance' : 'Deposit'} due ${registration.packagePriceCurrency} ${(isBalance
                ? getFinalInvoiceBalance(registration)
                : getDepositDue(registration, marathon)
              ).toLocaleString()}`}
          </DialogDescription>
        </DialogHeader>
        {approved.length === 0 && latest.length === 0 ? (
          <p className="text-muted-foreground text-sm">No payment proof uploaded yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <ProofGrid
              title={
                registration.status === 'payment_rejected'
                  ? 'Rejected submission'
                  : isPending
                    ? 'Awaiting review'
                    : 'Latest approved payment'
              }
              urls={latest}
            />
            {registration.paymentReference && latest.length > 0 && (
              <p className="text-sm">
                <span className="font-semibold">Branch / Ref. no.</span> · {registration.paymentReference}
              </p>
            )}
            {!review && <ProofGrid title="Earlier approved payments" urls={approved} />}
            {!review && <ApprovedReferences registration={registration} />}
          </div>
        )}
        {rejecting && (
          <Textarea
            placeholder="Reason (e.g. amount doesn't match, unreadable receipt)…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
        <DialogFooter>
          {!review ? (
            <Button onClick={onClose}>Close</Button>
          ) : rejecting ? (
            <>
              <Button variant="outline" onClick={() => setRejecting(false)}>
                Back
              </Button>
              <Button variant="destructive" disabled={!note} loading={busy === 'reject'} onClick={handleReject}>
                Reject Payment
              </Button>
            </>
          ) : (
            <>
              <Button variant="destructive" disabled={busy !== null} onClick={() => setRejecting(true)}>
                Reject
              </Button>
              <Button loading={busy === 'confirm'} onClick={handleConfirm}>
                Approve {isBalance ? 'Balance' : 'Deposit'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
