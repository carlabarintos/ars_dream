import type { ReactNode } from 'react'
import { PaperclipIcon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { FileUploadButton } from '@/features/admin/FileUploadButton'
import { cn } from '@/lib/utils'
import type { Marathon, Registration } from '@/types'

import { addProofOfPayment, submitPassportPhoto } from './api'
import { UploadedFileThumb } from './BookingDocumentDialog'
import { ExtraPassports } from './ExtraPassports'
import {
  getLabelledPaymentProofs,
  getPendingActionStep,
  getRunners,
  isOnFinalInvoice,
  isPastDeposit,
  runnerPrefix,
} from './registration-flow'

/** A registrant's passports, other IDs and payment slips on one booking, with upload buttons for whatever is due. */
export function BookingUploads({
  registration,
  marathon,
  onOpenWizard,
  className,
}: {
  registration: Registration
  marathon: Marathon | undefined
  onOpenWizard: () => void
  className?: string
}) {
  const pendingStep = getPendingActionStep(registration, marathon)
  const paymentDue = pendingStep === 'payment' || pendingStep === 'final_payment'
  // Also while a balance slip is under review, which isPastDeposit leaves out (it drives the pending steps); the rules allow it.
  const canUploadDocs = isPastDeposit(registration) || (registration.depositPaidAt != null && registration.status === 'payment_submitted')
  const runners = getRunners(registration, marathon)
  const proofs = getLabelledPaymentProofs(registration)
  const showIds = canUploadDocs || runners.some((r) => r.passportPhotoUrl) || !!registration.extraPassports?.length
  const showSlips = proofs.length > 0 || paymentDue || registration.status === 'payment_submitted'
  if (!showIds && !showSlips) return null

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
        <PaperclipIcon className="size-3.5" />
        Your uploads
      </div>

      {showIds && (
        <UploadGroup title="Passport & IDs">
          <ExtraPassports
            registration={registration}
            editable={canUploadDocs}
            leading={runners.map((runner, i) => {
              const label = `${runnerPrefix(i, runners.length, runner.name)}Passport`
              const upload = (
                <FileUploadButton
                  variant={runner.passportPhotoUrl ? 'ghost' : 'outline'}
                  size="sm"
                  className={runner.passportPhotoUrl ? undefined : 'h-24 w-24 flex-col border-dashed text-xs whitespace-normal'}
                  accept="image/*"
                  onFiles={async ([file]) => {
                    await submitPassportPhoto(registration, i, file)
                    toast.success(runner.passportPhotoUrl ? 'Passport replaced.' : 'Passport uploaded.')
                  }}
                >
                  {runner.passportPhotoUrl ? (
                    'Replace'
                  ) : (
                    <>
                      <UploadIcon />
                      {label}
                    </>
                  )}
                </FileUploadButton>
              )
              if (!runner.passportPhotoUrl) return canUploadDocs && <div key={i}>{upload}</div>
              return (
                <div key={i} className="flex flex-col gap-1.5">
                  <UploadedFileThumb url={runner.passportPhotoUrl} label={label} className="h-24" />
                  {canUploadDocs && upload}
                </div>
              )
            })}
          />
        </UploadGroup>
      )}

      {showSlips && (
        <UploadGroup
          title="Payment slips"
          action={
            registration.status === 'payment_submitted' ? (
              <FileUploadButton
                variant="outline"
                size="sm"
                accept="image/*,application/pdf"
                multiple
                onFiles={async (files) => {
                  await addProofOfPayment(registration, files, registration.paymentReference ?? '')
                  toast.success(files.length > 1 ? `${files.length} slips added.` : 'Slip added.')
                }}
              >
                <UploadIcon /> Add {isOnFinalInvoice(registration) ? 'Balance' : 'Deposit'} Slips
              </FileUploadButton>
            ) : (
              paymentDue && (
                // Opens the wizard: a first slip needs a payment reference and may need T&C acceptance.
                <Button variant="outline" size="sm" onClick={onOpenWizard}>
                  <UploadIcon /> Upload {pendingStep === 'final_payment' ? 'Balance' : 'Deposit'} Slip
                </Button>
              )
            )
          }
        >
          {proofs.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {proofs.map(({ url, label }) => (
                <UploadedFileThumb key={url} url={url} label={label} className="h-24" />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">No slips uploaded yet.</p>
          )}
        </UploadGroup>
      )}
    </div>
  )
}

function UploadGroup({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{title}</h4>
        {action}
      </div>
      {children}
    </section>
  )
}
