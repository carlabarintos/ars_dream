import { cn } from '@/lib/utils'

/** The die-cut perforation seam between a card's image and its content — a nod to the tour-ticket feel of a travel booking, reused anywhere a card wants that same brand touch. */
export function TicketSeam({ className }: { className?: string }) {
  return (
    <div className={cn('relative h-[18px] shrink-0', className)}>
      <div className="border-border absolute inset-x-[22px] top-1/2 border-t-2 border-dashed" />
      <span className="bg-background absolute top-1/2 -left-[9px] size-[18px] -translate-y-1/2 rounded-full" />
      <span className="bg-background absolute top-1/2 -right-[9px] size-[18px] -translate-y-1/2 rounded-full" />
    </div>
  )
}
