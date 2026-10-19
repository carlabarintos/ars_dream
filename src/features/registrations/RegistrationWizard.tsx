import { useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import type { Marathon, QuestionAnswer, Registration } from '@/types'

import { submitFinalPayment, submitProofOfPayment, submitTermsAndConditions } from './api'
import { getFinalInvoiceBalance, getPendingActionStep, isOnFinalInvoice, isQuestionAnswered } from './registration-flow'
import { getOfferAcceptanceDeadline } from '../../../functions/src/email-template'

export function RegistrationWizard({
  registration,
  marathon,
  onClose,
}: {
  registration: Registration
  marathon: Marathon | undefined
  onClose: () => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [answerValues, setAnswerValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const answer of registration.answers ?? []) initial[answer.questionId] = answer.value
    return initial
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [finalTermsAccepted, setFinalTermsAccepted] = useState(false)

  const items = marathon?.questions ?? []
  const pendingStep = getPendingActionStep(registration, marathon)
  const step =
    pendingStep ??
    (registration.status === 'payment_submitted' ? (isOnFinalInvoice(registration) ? 'final_payment' : 'payment') : 'done')
  const isFinal = step === 'final_payment'
  // T&C are accepted with the first balance submission; a resubmit after rejection doesn't re-ask.
  const needsFinalTerms = registration.status === 'final_invoiced'
  const finalBalance = getFinalInvoiceBalance(registration)
  const canSubmitPayment =
    (files.length > 0 || (isFinal && finalBalance <= 0)) && (!needsFinalTerms || finalTermsAccepted)

  const total =
    registration.packagePriceAmount + (registration.selectedAddOns ?? []).reduce((sum, addOn) => sum + addOn.priceAmount, 0)
  const deposit = Math.min(marathon?.packages?.find((p) => p.id === registration.packageId)?.depositAmount ?? 0, total)
  const money = (amount: number) => `${registration.packagePriceCurrency} ${amount.toLocaleString()}`
  const formatDue = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const dueDate = (date: Date | undefined) => (date ? ` · due ${formatDue(date)}` : '')
  const offerAcceptanceDeadline = registration.offeredAt
    ? getOfferAcceptanceDeadline(registration.offeredAt.toDate(), marathon?.offerAcceptanceDays)
    : undefined
  // Only relevant when the package has a deposit; defaults to 1 day.
  const depositDueDays = deposit > 0 ? (marathon?.depositDueDays ?? 1) : undefined
  const depositDeadline =
    depositDueDays && registration.termsAcceptedAt
      ? new Date(registration.termsAcceptedAt.toMillis() + depositDueDays * 86_400_000)
      : undefined

  async function handleSubmitTerms() {
    const missingRequired = items.some(
      (item) => item.required && !isQuestionAnswered(item, answerValues[item.id]),
    )
    if (missingRequired) {
      toast.error('Please complete all required items.')
      return
    }
    const answers: QuestionAnswer[] = items
      .filter((item) => isQuestionAnswered(item, answerValues[item.id]))
      .map((item) => ({
        questionId: item.id,
        label: item.label,
        value: item.type === 'bool' ? (answerValues[item.id] === 'Yes' ? 'Yes' : 'No') : answerValues[item.id],
      }))
    setIsSubmitting(true)
    try {
      await submitTermsAndConditions(registration.id, answers)
      toast.success('Thanks! Next: submit your proof of payment.')
      onClose()
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'terms'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmitPayment() {
    if (!canSubmitPayment) return
    setIsSubmitting(true)
    try {
      await (isFinal ? submitFinalPayment(registration, files) : submitProofOfPayment(registration.id, files))
      toast.success('Proof of payment submitted. An admin will review it shortly.')
      onClose()
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'payment'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{marathon?.title ?? 'Complete Your Registration'}</DialogTitle>
          <DialogDescription>
            {step === 'terms'
              ? "You've received an offer! Review and accept the terms & conditions to accept it."
              : step === 'payment'
                ? 'Your invoice is below. Send payment using the instructions, then upload your proof of payment.'
                : isFinal
                  ? 'Your final invoice is below. Pay the balance using the instructions, then upload your proof of payment.'
                  : ''}
          </DialogDescription>
        </DialogHeader>

        {step === 'terms' && (
          <div className="flex flex-col gap-4">
            {(offerAcceptanceDeadline || depositDueDays) && (
              <div className="bg-muted/50 flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
                {offerAcceptanceDeadline && (
                  <p>
                    Accept this offer by{' '}
                    <span className="font-semibold">
                      {offerAcceptanceDeadline.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </p>
                )}
                {depositDueDays && (
                  <p>
                    Deposit due within{' '}
                    <span className="font-semibold">
                      {depositDueDays} day{depositDueDays === 1 ? '' : 's'}
                    </span>{' '}
                    of accepting this offer
                  </p>
                )}
              </div>
            )}
            {items.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No additional information is required. Click Continue to accept the terms & conditions
                and proceed.
              </p>
            )}
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-1.5">
                <Label
                  htmlFor={item.id}
                  className={`block whitespace-pre-line leading-snug ${item.type === 'bool' ? 'font-normal' : ''}`}
                >
                  {item.label}
                  {item.type !== 'bool' && item.required && <span className="text-destructive"> *</span>}
                </Label>
                {item.type === 'bool' ? (
                  <Checkbox
                    id={item.id}
                    checked={answerValues[item.id] === 'Yes'}
                    onCheckedChange={(v) =>
                      setAnswerValues((values) => ({ ...values, [item.id]: v === true ? 'Yes' : 'No' }))
                    }
                  />
                ) : item.type === 'dropdown' ? (
                  <Select
                    value={answerValues[item.id] ?? ''}
                    onValueChange={(value) => setAnswerValues((values) => ({ ...values, [item.id]: value }))}
                  >
                    <SelectTrigger id={item.id}>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(item.options ?? []).map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={item.id}
                    type={item.type === 'int' ? 'number' : 'text'}
                    value={answerValues[item.id] ?? ''}
                    onChange={(e) => setAnswerValues((values) => ({ ...values, [item.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button loading={isSubmitting} onClick={handleSubmitTerms}>
                Continue
              </Button>
            </DialogFooter>
          </div>
        )}

        {(step === 'payment' || isFinal) && (
          <div className="flex flex-col gap-4">
            {registration.status === 'payment_rejected' && registration.adminNote && (
              <div className="border-destructive/40 bg-destructive/10 rounded-md border p-3 text-sm">
                Your previous submission was rejected: {registration.adminNote}
              </div>
            )}
            {registration.status === 'payment_submitted' && (
              <div className="bg-muted/50 rounded-md border border-border p-3 text-sm">
                Your proof of payment is under review. You can still replace it below if you submitted the
                wrong file.
              </div>
            )}
            {isFinal ? (
              <div className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Final Invoice</p>
                {registration.finalInvoice?.items.map((item, index) => (
                  <div key={index} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="tabular-nums">
                      {item.amount < 0 ? '−' : ''}
                      {money(Math.abs(item.amount))}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-border pt-1">
                  <span>Balance due{dueDate(registration.finalInvoice?.dueDate.toDate())}</span>
                  <span className="font-semibold">{money(finalBalance)}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Invoice</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">{money(total)}</span>
                </div>
                {deposit > 0 && (
                  <div className="flex justify-between">
                    <span>Deposit{dueDate(depositDeadline)}</span>
                    <span className="font-semibold">{money(deposit)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>
                    {deposit > 0 ? 'Remaining balance' : 'Amount due'}
                    {dueDate(marathon?.balanceDeadline?.toDate())}
                  </span>
                  <span className="font-semibold">{money(total - deposit)}</span>
                </div>
              </div>
            )}
            <div className="text-muted-foreground rounded-md border border-border p-3 text-sm whitespace-pre-line">
              {marathon?.paymentInstructions ?? 'Payment instructions will be provided here.'}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="proof">Upload proof of payment (receipts/screenshots)</Label>
              {registration.proofOfPaymentUrls.length > 0 && (
                <div className="flex flex-col gap-1">
                  {registration.proofOfPaymentUrls.map((url, index) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-sm underline underline-offset-2"
                    >
                      View current submission {registration.proofOfPaymentUrls.length > 1 ? index + 1 : ''}
                    </a>
                  ))}
                </div>
              )}
              {files.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className="bg-muted/50 flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label
                htmlFor="proof"
                className="border-input hover:bg-accent flex h-10 w-fit cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors"
              >
                {files.length > 0
                  ? 'Add more files'
                  : registration.proofOfPaymentUrls.length > 0
                    ? 'Choose replacement files'
                    : 'Choose files'}
              </label>
              <input
                id="proof"
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={(e) => {
                  setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])
                  e.target.value = ''
                }}
                className="sr-only"
              />
            </div>
            {needsFinalTerms && (
              <div className="flex items-start gap-2">
                <Checkbox
                  id="final-terms"
                  checked={finalTermsAccepted}
                  onCheckedChange={(v) => setFinalTermsAccepted(v === true)}
                />
                <Label htmlFor="final-terms" className="block leading-snug font-normal">
                  I've reviewed this final invoice and agree to the{' '}
                  <Link to="/terms" target="_blank" className="text-primary underline underline-offset-2">
                    Terms & Conditions
                  </Link>
                  .
                </Label>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={!canSubmitPayment} loading={isSubmitting} onClick={handleSubmitPayment}>
                {registration.proofOfPaymentUrls.length > 0 ? 'Replace Payment Proof' : 'Submit Payment Proof'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground text-sm">
              This registration doesn't require further action right now.
            </p>
            <DialogFooter>
              <Button onClick={onClose}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
