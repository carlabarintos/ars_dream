import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getPaymentProofs } from '@/features/registrations/registration-flow'
import type { Registration } from '@/types'

function ProofGrid({ title, urls }: { title: string; urls: string[] }) {
  if (urls.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {urls.map((url, index) => (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            <img
              src={url}
              alt={`${title} ${index + 1}`}
              className="max-h-64 w-full rounded-md border border-border object-contain"
            />
          </a>
        ))}
      </div>
    </div>
  )
}

/** Every payment proof a registrant has uploaded on a booking, for admins to look back over. */
export function PaymentProofsDialog({
  registration,
  registrantName,
  onClose,
}: {
  registration: Registration
  registrantName: string
  onClose: () => void
}) {
  const { approved, latest } = getPaymentProofs(registration)
  const isPending = registration.status === 'payment_submitted' || registration.status === 'payment_rejected'
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payments</DialogTitle>
          <DialogDescription>{registrantName}</DialogDescription>
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
            <ProofGrid title="Earlier approved payments" urls={approved} />
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
