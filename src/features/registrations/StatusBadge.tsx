import { Badge } from '@/components/ui/badge'
import type { RegistrationStatus } from '@/types'

const STATUS_CONFIG: Record<RegistrationStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
  queued: { label: 'In Queue', variant: 'secondary' },
  accepted: { label: 'Accepted — Action Needed', variant: 'warning' },
  rejected: { label: 'Not Accepted', variant: 'destructive' },
  terms_accepted: { label: 'Terms Accepted — Payment Needed', variant: 'warning' },
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
