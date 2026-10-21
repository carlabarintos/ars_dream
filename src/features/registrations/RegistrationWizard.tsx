import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2Icon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, X } from 'lucide-react'
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
import { cn, formatPackagePrice } from '@/lib/utils'
import type { Marathon, QuestionAnswer, Registration } from '@/types'

import { useAuthStore } from '@/features/auth/auth-store'

import {
  submitFinalPayment,
  submitPassportPhoto,
  submitProofOfPayment,
  submitQuestionnaireAnswers,
  submitTermsAndConditions,
} from './api'
import { bookingDocumentPage, getBookingDocuments, downloadBookingDocument } from './booking-documents'
import {
  getFinalInvoiceBalance,
  getOfferedPackages,
  getNextQuestionnaire,
  getPendingActionStep,
  getQuestionnaires,
  isOnFinalInvoice,
  isQuestionAnswered,
} from './registration-flow'
import { getOfferAcceptanceDeadline } from '../../../functions/src/email-template'

export function RegistrationWizard({
  registration,
  marathon,
  onClose,
  initialQuestionnaire,
}: {
  registration: Registration
  marathon: Marathon | undefined
  onClose: () => void
  /** Opens straight onto this named questionnaire (e.g. from its link on the booking timeline). */
  initialQuestionnaire?: string
}) {
  const profile = useAuthStore((state) => state.profile)
  const [files, setFiles] = useState<File[]>([])
  const [passportFile, setPassportFile] = useState<File | null>(null)
  const [answerValues, setAnswerValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const answer of registration.answers ?? []) initial[answer.questionId] = answer.value
    return initial
  })
  // Submitted answers are read-only (the rules only allow adding new ones).
  const lockedAnswers = registration.answers ?? []
  const isLocked = (questionId: string) => lockedAnswers.some((answer) => answer.questionId === questionId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [finalTermsAccepted, setFinalTermsAccepted] = useState(false)
  const offeredPackages = getOfferedPackages(registration, marathon)
  const [chosenPackageId, setChosenPackageId] = useState(() =>
    offeredPackages.length === 1 ? offeredPackages[0].id : registration.packageId,
  )
  const [chosenAddOnIds, setChosenAddOnIds] = useState<string[]>(() =>
    (registration.selectedAddOns ?? []).map((addOn) => addOn.addOnId),
  )
  const chosenPackage = offeredPackages.find((pkg) => pkg.id === chosenPackageId)
  // Mandatory add-ons are always included, whatever was toggled.
  const chosenAddOns = (chosenPackage?.addOns ?? []).filter(
    (addOn) => addOn.mandatory || chosenAddOnIds.includes(addOn.id),
  )
  const chosenTotal =
    (chosenPackage?.priceAmount ?? 0) + chosenAddOns.reduce((sum, addOn) => sum + addOn.priceAmount, 0)
  const chosenDeposit = Math.min(chosenPackage?.depositAmount ?? 0, chosenTotal)

  const items = marathon?.questions ?? []
  const questionnaires = getQuestionnaires(marathon)
  const [openQuestionnaire, setOpenQuestionnaire] = useState<string | null>(
    () =>
      initialQuestionnaire ??
      getNextQuestionnaire(registration, marathon) ??
      (questionnaires.length === 1 ? questionnaires[0].name : null),
  )
  const activeItems = questionnaires.find((q) => q.name === openQuestionnaire)?.questions ?? []
  const pendingStep = getPendingActionStep(registration, marathon)
  const step = initialQuestionnaire
    ? 'questionnaire'
    : pendingStep ??
    (registration.status === 'payment_submitted'
      ? isOnFinalInvoice(registration)
        ? 'final_payment'
        : 'payment'
      : 'done')
  const isFinal = step === 'final_payment'
  // T&C are accepted with the first balance submission; a resubmit after rejection doesn't re-ask.
  const needsFinalTerms = registration.status === 'final_invoiced'
  // On a fresh final invoice, proofOfPaymentUrls still holds the already-approved payment's proof (kept in depositProofUrls) — not a submission to replace.
  const currentProofs = needsFinalTerms ? [] : registration.proofOfPaymentUrls
  const [paymentReference, setPaymentReference] = useState(() =>
    needsFinalTerms ? '' : (registration.paymentReference ?? ''),
  )
  const finalBalance = getFinalInvoiceBalance(registration)
  // The office-template invoice the registrant was emailed; shown in full on wider screens, the compact summary below on phones.
  const invoiceDocument = getBookingDocuments(registration, marathon, profile).find(
    (document) => document.label === (isFinal ? 'Final Invoice' : 'Invoice'),
  )
  const canSubmitPayment =
    ((files.length > 0 && paymentReference.trim() !== '') || (isFinal && finalBalance <= 0)) &&
    (!needsFinalTerms || finalTermsAccepted)

  const total =
    registration.packagePriceAmount +
    (registration.selectedAddOns ?? []).reduce((sum, addOn) => sum + addOn.priceAmount, 0)
  // Before acceptance the package isn't on the registration yet — use the one being picked.
  const deposit =
    step === 'terms'
      ? chosenDeposit
      : Math.min(marathon?.packages?.find((p) => p.id === registration.packageId)?.depositAmount ?? 0, total)
  const money = (amount: number) => `${registration.packagePriceCurrency} ${amount.toLocaleString()}`
  const formatDue = (date: Date) =>
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
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
    if (!chosenPackage) {
      toast.error('Please choose a package.')
      return
    }
    setIsSubmitting(true)
    try {
      await submitTermsAndConditions(registration.id, chosenPackage, chosenAddOns)
      toast.success('Thanks! Next: submit your proof of payment.')
      onClose()
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'terms'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmitAnswers() {
    const missingRequired = activeItems.some(
      (item) => item.required && !isQuestionAnswered(item, answerValues[item.id]),
    )
    if (missingRequired) {
      toast.error('Please complete all required items.')
      return
    }
    const answers: QuestionAnswer[] = [
      ...lockedAnswers,
      ...activeItems
        .filter((item) => !isLocked(item.id) && isQuestionAnswered(item, answerValues[item.id]))
        .map((item) => ({
          questionId: item.id,
          label: item.label,
          value: item.type === 'bool' ? (answerValues[item.id] === 'Yes' ? 'Yes' : 'No') : answerValues[item.id],
        })),
    ]
    setIsSubmitting(true)
    try {
      await submitQuestionnaireAnswers(registration.id, answers)
      const answered = new Set(answers.map((answer) => answer.questionId))
      const remaining = questionnaires.filter((q) => !q.questions.some((item) => answered.has(item.id)))
      if (remaining.length > 0) {
        toast.success(`Thanks! Next: ${remaining[0].name}.`)
        setOpenQuestionnaire(null)
      } else {
        toast.success(registration.status === 'confirmed' ? 'Thanks! Your booking is complete.' : 'Thanks! Your answers are in.')
        onClose()
      }
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'terms'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmitPassport() {
    if (!passportFile) return
    setIsSubmitting(true)
    try {
      await submitPassportPhoto(registration.id, passportFile)
      toast.success(
        items.length
          ? 'Passport uploaded. Next: the questionnaire.'
          : registration.status === 'confirmed'
            ? 'Thanks! Your booking is complete.'
            : 'Thanks! Your passport is in.',
      )
      onClose()
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'payment'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmitPayment() {
    if (!canSubmitPayment) return
    setIsSubmitting(true)
    try {
      await (isFinal
        ? submitFinalPayment(registration, files, paymentReference.trim())
        : submitProofOfPayment(registration.id, files, paymentReference.trim()))
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
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl sm:max-w-3xlgrid-cols-[minmax(0,1fr)] overflow-x-hidden overflow-y-auto p-5 sm:p-8">
        <DialogHeader>
          <DialogTitle className="px-6 sm:px-0 sm:pr-6">{marathon?.title ?? 'Complete Your Registration'}</DialogTitle>
          <DialogDescription>
            {step === 'terms'
              ? "You've received an offer! Choose your package, then review and accept the terms & conditions."
              : step === 'payment'
                ? 'Your invoice is below. Send payment using the instructions, then upload your proof of payment.'
                : isFinal
                  ? 'Your final invoice is below. Pay the balance using the instructions, then upload your proof of payment.'
                  : step === 'passport'
                    ? 'Your slot is locked in. Upload a clear photo of your passport bio page (the page with your photo and details).'
                    : step === 'questionnaire'
                      ? openQuestionnaire ?? 'Your slot is locked in. Please answer each questionnaire below.'
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
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Choose your package</p>
              {offeredPackages.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  The packages in this offer are no longer available — please message us so we can update it.
                </p>
              )}
              {offeredPackages.map((pkg) => {
                const isChosen = pkg.id === chosenPackageId
                return (
                  <div
                    key={pkg.id}
                    className={cn(
                      'rounded-md border border-border p-3 text-sm',
                      isChosen && 'border-primary ring-primary/25 ring-2',
                    )}
                  >
                    <button
                      type="button"
                      aria-pressed={isChosen}
                      onClick={() => setChosenPackageId(pkg.id)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <span className="font-semibold">{pkg.name}</span>
                      <span className="text-right tabular-nums">
                        <span className="font-semibold">{formatPackagePrice(pkg.priceCurrency, pkg.priceAmount)}</span>
                        {pkg.depositAmount ? (
                          <span className="text-muted-foreground block text-xs">
                            Deposit {pkg.priceCurrency} {pkg.depositAmount.toLocaleString()}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {isChosen && (pkg.addOns ?? []).length > 0 && (
                      <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                        {pkg.addOns!.map((addOn) => (
                          <div key={addOn.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`wizard-addon-${addOn.id}`}
                              checked={addOn.mandatory || chosenAddOnIds.includes(addOn.id)}
                              disabled={addOn.mandatory}
                              onCheckedChange={(v) =>
                                setChosenAddOnIds((ids) =>
                                  v === true ? [...ids, addOn.id] : ids.filter((id) => id !== addOn.id),
                                )
                              }
                            />
                            <Label htmlFor={`wizard-addon-${addOn.id}`} className="flex-1 text-sm font-normal">
                              {addOn.name}
                              {addOn.mandatory && <span className="text-muted-foreground text-xs">(required)</span>}
                            </Label>
                            <span className="text-muted-foreground text-xs">
                              +{pkg.priceCurrency} {addOn.priceAmount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {chosenPackage && (
                <div className="bg-muted/50 flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">
                      {chosenPackage.priceCurrency} {chosenTotal.toLocaleString()}
                    </span>
                  </div>
                  {chosenDeposit > 0 && (
                    <div className="flex justify-between">
                      <span>Down payment due after accepting</span>
                      <span className="font-semibold">
                        {chosenPackage.priceCurrency} {chosenDeposit.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button loading={isSubmitting} disabled={!chosenPackage} onClick={handleSubmitTerms}>
                Accept Offer
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'passport' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="passport">Passport bio page photo</Label>
              <Input
                id="passport"
                type="file"
                accept="image/*"
                onChange={(e) => setPassportFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-muted-foreground text-xs">
                Make sure all four corners are visible and the text is readable, with no glare. Your passport should be
                valid for at least 6 months after the event.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={!passportFile} loading={isSubmitting} onClick={handleSubmitPassport}>
                Upload Passport
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'questionnaire' && openQuestionnaire == null && (
          <div className="flex flex-col gap-2">
            {questionnaires.map((questionnaire) => {
              const isDone = questionnaire.questions.some((item) => isLocked(item.id))
              return (
                <Button
                  key={questionnaire.name}
                  variant="outline"
                  className="h-auto justify-between py-3"
                  onClick={() => setOpenQuestionnaire(questionnaire.name)}
                >
                  <span className="flex items-center gap-2 text-left whitespace-normal">
                    {isDone && <CheckCircle2Icon className="text-primary size-4 shrink-0" />}
                    {questionnaire.name}
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    {isDone ? 'Answered' : 'Answer'}
                    <ChevronRightIcon className="size-4" />
                  </span>
                </Button>
              )
            })}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'questionnaire' && openQuestionnaire != null && (
          <div className="flex flex-col gap-4">
            {questionnaires.length > 1 && (
              <Button
                variant="link"
                size="sm"
                className="h-auto self-start p-0"
                onClick={() => setOpenQuestionnaire(null)}
              >
                <ChevronLeftIcon />
                All questionnaires
              </Button>
            )}
            {activeItems.map((item) => (
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
                    disabled={isLocked(item.id)}
                    checked={answerValues[item.id] === 'Yes'}
                    onCheckedChange={(v) =>
                      setAnswerValues((values) => ({
                        ...values,
                        [item.id]: v === true ? 'Yes' : 'No',
                      }))
                    }
                  />
                ) : item.type === 'dropdown' ? (
                  <Select
                    disabled={isLocked(item.id)}
                    value={answerValues[item.id] ?? ''}
                    onValueChange={(value) =>
                      setAnswerValues((values) => ({
                        ...values,
                        [item.id]: value,
                      }))
                    }
                  >
                    <SelectTrigger id={item.id} className="h-auto min-h-10 text-left whitespace-normal">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
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
                    disabled={isLocked(item.id)}
                    type={item.type === 'int' ? 'number' : 'text'}
                    value={answerValues[item.id] ?? ''}
                    onChange={(e) =>
                      setAnswerValues((values) => ({
                        ...values,
                        [item.id]: e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              {activeItems.some((item) => !isLocked(item.id)) && (
                <Button loading={isSubmitting} onClick={handleSubmitAnswers}>
                  Submit Answers
                </Button>
              )}
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
                Your proof of payment is under review. You can still replace it below if you submitted the wrong file.
              </div>
            )}
            {invoiceDocument && (
              <div className="hidden flex-col gap-2 sm:flex">
                <iframe
                  title={invoiceDocument.label}
                  srcDoc={bookingDocumentPage(invoiceDocument, invoiceDocument.label, 'all')}
                  // Sized to its content so the dialog scrolls, not the frame.
                  onLoad={(e) => {
                    const frame = e.currentTarget
                    frame.style.height = `${frame.contentDocument?.documentElement.scrollHeight ?? 0}px`
                  }}
                  className="h-[60vh] w-full rounded-md border border-border"
                />
                <Button
                  variant="outline"
                  className="w-fit"
                  onClick={() => downloadBookingDocument(invoiceDocument, marathon?.title)}
                >
                  <DownloadIcon />
                  Download {invoiceDocument.label}
                </Button>
              </div>
            )}
            {isFinal ? (
              <div
                className={cn(
                  'flex flex-col gap-1 rounded-md border border-border p-3 text-sm',
                  invoiceDocument && 'sm:hidden',
                )}
              >
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
                  <span>
                    Balance due
                    {dueDate(registration.finalInvoice?.dueDate.toDate())}
                  </span>
                  <span className="font-semibold">{money(finalBalance)}</span>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  'flex flex-col gap-1 rounded-md border border-border p-3 text-sm',
                  invoiceDocument && 'sm:hidden',
                )}
              >
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
            {marathon?.paymentInstructions?.trim() && (
              <div className="text-muted-foreground rounded-md border border-border p-3 text-sm whitespace-pre-line">
                {marathon.paymentInstructions}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="proof">Upload proof of payment (receipts/screenshots)</Label>
              {currentProofs.length > 0 && (
                <div className="flex flex-col gap-1">
                  {currentProofs.map((url, index) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-sm underline underline-offset-2"
                    >
                      View current submission {currentProofs.length > 1 ? index + 1 : ''}
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
                  : currentProofs.length > 0
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payment-reference">Branch visited or online reference number</Label>
              <Input
                id="payment-reference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. BDO Makati Ayala branch, or ref. no. 123456789"
                maxLength={200}
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
                {currentProofs.length > 0 ? 'Replace Payment Proof' : 'Submit Payment Proof'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground text-sm">This registration doesn't require further action right now.</p>
            <DialogFooter>
              <Button onClick={onClose}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
