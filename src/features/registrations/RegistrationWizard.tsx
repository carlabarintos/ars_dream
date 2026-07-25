import { useState } from 'react'
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
import type { Marathon, QuestionAnswer, Registration } from '@/types'

import { submitProofOfPayment, submitTermsAndConditions } from './api'
import { getPendingActionStep, isQuestionAnswered } from './registration-flow'

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

  const items = marathon?.questions ?? []
  const pendingStep = getPendingActionStep(registration, marathon)
  const step = pendingStep ?? (registration.status === 'payment_submitted' ? 'payment' : 'done')

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
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmitPayment() {
    if (files.length === 0) return
    setIsSubmitting(true)
    try {
      await submitProofOfPayment(registration.id, files)
      toast.success('Proof of payment submitted. An admin will review it shortly.')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
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
              ? "You've been accepted! Review and accept the terms & conditions to continue."
              : step === 'payment'
                ? 'Send payment using the instructions below, then upload your proof of payment.'
                : ''}
          </DialogDescription>
        </DialogHeader>

        {step === 'terms' && (
          <div className="flex flex-col gap-4">
            {items.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No additional information is required. Click Continue to accept the terms & conditions
                and proceed.
              </p>
            )}
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-1.5">
                <Label htmlFor={item.id} className={item.type === 'bool' ? 'font-normal' : undefined}>
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

        {step === 'payment' && (
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
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={files.length === 0} loading={isSubmitting} onClick={handleSubmitPayment}>
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
