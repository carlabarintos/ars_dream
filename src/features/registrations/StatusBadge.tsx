import { Badge } from '@/components/ui/badge'
import type { RegistrationStatus } from '@/types'

const STATUS_CONFIG: Record<RegistrationStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
  queued: { label: 'In Queue', variant: 'secondary' },
  accepted: { label: 'Offered — Action Needed', variant: 'warning' },
  rejected: { label: 'Not Offered', variant: 'destructive' },
  terms_accepted: { label: 'Invoiced — Deposit Due', variant: 'warning' },
  payment_submitted: { label: 'Payment Under Review', variant: 'secondary' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  payment_rejected: { label: 'Payment Rejected — Resubmit', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
}

export function StatusBadge({ status, className }: { status: RegistrationStatus; className?: string }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}
