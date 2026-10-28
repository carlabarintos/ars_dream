import { ClockAlertIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { Marathon, Registration, RegistrationStatus } from '@/types'

import { hasSubmittedBookingDetails, isBookingComplete, isOverdue } from './registration-flow'

const STATUS_CONFIG: Record<RegistrationStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
  queued: { label: 'In Queue', variant: 'secondary' },
  accepted: { label: 'Offered — Action Needed', variant: 'warning' },
  rejected: { label: 'Not Offered', variant: 'destructive' },
  terms_accepted: { label: 'Invoiced — Deposit Due', variant: 'warning' },
  payment_submitted: { label: 'Payment Under Review', variant: 'secondary' },
  deposit_paid: { label: 'Deposit Paid — Finalizing', variant: 'success' },
  final_invoiced: { label: 'Final Invoice — Balance Due', variant: 'warning' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  payment_rejected: { label: 'Payment Rejected — Resubmit', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
}

export function StatusBadge({
  registration,
  marathon,
  className,
}: {
  registration: Registration
  marathon: Marathon | null | undefined
  className?: string
}) {
  const { status } = registration
  if (isOverdue(registration)) {
    return (
      <Badge variant="destructive" className={className}>
        <ClockAlertIcon />
        {status === 'accepted' ? 'Offer Overdue' : status === 'final_invoiced' ? 'Balance Overdue' : 'Deposit Overdue'}
      </Badge>
    )
  }
  const config =
    status === 'deposit_paid' && !registration.passportPhotoUrl
      ? { label: 'Deposit Paid — Passport Needed', variant: 'warning' as const }
      : status === 'deposit_paid' && !hasSubmittedBookingDetails(registration, marathon ?? undefined)
        ? { label: 'Deposit Paid — Questionnaire Needed', variant: 'warning' as const }
        : status === 'confirmed' && !isBookingComplete(registration, marathon ?? undefined)
          ? { label: 'Paid — Final Steps Needed', variant: 'warning' as const }
          : STATUS_CONFIG[status]
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}
