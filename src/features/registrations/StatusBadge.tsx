import { ClockAlertIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { RegistrationStatus } from '@/types'

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
  status,
  overdue,
  className,
}: {
  status: RegistrationStatus
  overdue?: boolean
  className?: string
}) {
  if (overdue) {
    return (
      <Badge variant="destructive" className={className}>
        <ClockAlertIcon />
        {status === 'accepted' ? 'Offer Overdue' : status === 'final_invoiced' ? 'Balance Overdue' : 'Deposit Overdue'}
      </Badge>
    )
  }
  const config = STATUS_CONFIG[status]
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}
