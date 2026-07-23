import { useState } from 'react'
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
  const [file, setFile] = useState<File | null>(null)
  const [answerValues, setAnswerValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const answer of registration.answers ?? []) initial[answer.questionId] = answer.value
    return initial
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const items = marathon?.questions ?? []
  const step = getPendingActionStep(registration, marathon) ?? 'done'

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
    if (!file) return
    setIsSubmitting(true)
    try {
      await submitProofOfPayment(registration.id, file)
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
              <Button disabled={isSubmitting} onClick={handleSubmitTerms}>
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
            <div className="text-muted-foreground rounded-md border border-border p-3 text-sm whitespace-pre-line">
              {marathon?.paymentInstructions ?? 'Payment instructions will be provided here.'}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="proof">Upload proof of payment (receipt/screenshot)</Label>
              <input
                id="proof"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={!file || isSubmitting} onClick={handleSubmitPayment}>
                Submit Payment Proof
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
