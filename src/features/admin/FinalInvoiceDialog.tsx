import { useState } from 'react'
import { PlusIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { issueFinalInvoice } from '@/features/registrations/api'
import type { InvoiceLineItem, Marathon, Registration } from '@/types'

/** Package + selected add-ons, then the deposit already paid as a credit — the admin edits from there. */
function buildDefaultItems(registration: Registration, marathon: Marathon | null): InvoiceLineItem[] {
  const addOns = registration.selectedAddOns ?? []
  const total = registration.packagePriceAmount + addOns.reduce((sum, addOn) => sum + addOn.priceAmount, 0)
  // No deposit split on the package means the first payment was the full amount.
  const depositAmount = marathon?.packages?.find((p) => p.id === registration.packageId)?.depositAmount
  const deposit = Math.min(depositAmount ?? total, total)
  return [
    { label: `${registration.packageName} package`, amount: registration.packagePriceAmount },
    ...addOns.map((addOn) => ({ label: `Add-on: ${addOn.name}`, amount: addOn.priceAmount })),
    { label: 'Deposit paid', amount: -deposit, isDeposit: true },
  ]
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function FinalInvoiceDialog({
  registration,
  marathon,
  onClose,
}: {
  registration: Registration
  marathon: Marathon | null
  onClose: () => void
}) {
  const [items, setItems] = useState<InvoiceLineItem[]>(
    () => registration.finalInvoice?.items ?? buildDefaultItems(registration, marathon),
  )
  const [dueDate, setDueDate] = useState(() => {
    const existing = registration.finalInvoice?.dueDate.toDate() ?? marathon?.balanceDeadline?.toDate()
    return existing ? toDateInputValue(existing) : ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currency = registration.packagePriceCurrency
  const balance = items.reduce((sum, item) => sum + item.amount, 0)
  const isValid = dueDate !== '' && items.length > 0 && items.every((item) => item.label.trim() && Number.isFinite(item.amount))

  function updateItem(index: number, patch: Partial<InvoiceLineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  async function handleSend() {
    setIsSubmitting(true)
    try {
      // End of the chosen day, local time, so "due Nov 1" isn't flagged overdue at midnight.
      await issueFinalInvoice(
        registration.id,
        items.map((item) => ({ ...item, label: item.label.trim() })),
        new Date(`${dueDate}T23:59:59`),
      )
      toast.success('Final invoice sent.')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{registration.finalInvoice ? 'Edit Final Invoice' : 'Create Final Invoice'}</DialogTitle>
          <DialogDescription>
            Prefilled from the package and add-ons, with the deposit as a credit. Edit any line or add more
            (use a negative amount for discounts). Amounts in {currency}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                aria-label="Item"
                value={item.label}
                onChange={(e) => updateItem(index, { label: e.target.value })}
                className="flex-1"
              />
              <Input
                aria-label="Amount"
                type="number"
                value={Number.isNaN(item.amount) ? '' : item.amount}
                onChange={(e) => updateItem(index, { amount: e.target.valueAsNumber })}
                className="w-32 text-right"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${item.label || 'item'}`}
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => setItems((prev) => [...prev, { label: '', amount: 0 }])}
          >
            <PlusIcon className="size-4" />
            Add item
          </Button>
        </div>

        <div className="flex justify-between border-t border-border pt-3 text-sm font-semibold">
          <span>Balance due</span>
          <span className="tabular-nums">
            {currency} {balance.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="final-invoice-due">Due date</Label>
          <Input id="final-invoice-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!isValid} loading={isSubmitting}>
            {registration.finalInvoice ? 'Update & resend' : 'Send final invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
