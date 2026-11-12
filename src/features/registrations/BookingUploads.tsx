import { PaperclipIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FileUploadButton } from "@/features/admin/FileUploadButton";
import type { Marathon, Registration } from "@/types";

import { addProofOfPayment, submitPassportPhoto } from "./api";
import { UploadedFileThumb } from "./BookingDocumentDialog";
import { ExtraPassports } from "./ExtraPassports";
import {
  getLabelledPaymentProofs,
  getPendingActionStep,
  getRunners,
  isOnFinalInvoice,
  isPastDeposit,
  runnerPrefix,
} from "./registration-flow";

/** A registrant's passports, other IDs and payment slips on one booking, with upload buttons for whatever is due. */
export function BookingUploads({
  registration,
  marathon,
  onOpenWizard,
}: {
  registration: Registration;
  marathon: Marathon | undefined;
  onOpenWizard: () => void;
}) {
  const pendingStep = getPendingActionStep(registration, marathon);
  const paymentDue =
    pendingStep === "payment" || pendingStep === "final_payment";
  // Also while a balance slip is under review, which isPastDeposit leaves out (it drives the pending steps); the rules allow it.
  const canUploadDocs =
    isPastDeposit(registration) ||
    (registration.depositPaidAt != null &&
      registration.status === "payment_submitted");

  if (
    !getRunners(registration, marathon).some((r) => r.passportPhotoUrl) &&
    !getLabelledPaymentProofs(registration).length &&
    !canUploadDocs &&
    !paymentDue
  )
    return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
        <PaperclipIcon className="size-3.5" />
        Your uploads
      </div>
      <div className="flex flex-wrap gap-3">
        {getRunners(registration, marathon).map(
          (runner, i, all) =>
            (runner.passportPhotoUrl || canUploadDocs) && (
              <div key={i} className="flex flex-col gap-1.5">
                {runner.passportPhotoUrl && (
                  <UploadedFileThumb
                    url={runner.passportPhotoUrl}
                    label={`${runnerPrefix(i, all.length, runner.name)}Passport bio page`}
                    className="h-24"
                  />
                )}
                {canUploadDocs && (
                  <FileUploadButton
                    variant="outline"
                    size="sm"
                    accept="image/*"
                    onFiles={async ([file]) => {
                      await submitPassportPhoto(registration, i, file);
                      toast.success(
                        runner.passportPhotoUrl
                          ? "Passport replaced."
                          : "Passport uploaded.",
                      );
                    }}
                  >
                    {runner.passportPhotoUrl
                      ? "Replace"
                      : `Upload ${runnerPrefix(i, all.length, runner.name)}Passport`}
                  </FileUploadButton>
                )}
              </div>
            ),
        )}
        {getLabelledPaymentProofs(registration).map(({ url, label }) => (
          <UploadedFileThumb
            key={url}
            url={url}
            label={`Payment proof · ${label}`}
            className="h-24"
          />
        ))}
      </div>
      {registration.status === "payment_submitted" ? (
        <FileUploadButton
          variant="outline"
          size="sm"
          className="self-start"
          accept="image/*,application/pdf"
          multiple
          onFiles={async (files) => {
            await addProofOfPayment(
              registration,
              files,
              registration.paymentReference ?? "",
            );
            toast.success(
              files.length > 1 ? `${files.length} slips added.` : "Slip added.",
            );
          }}
        >
          Add More {isOnFinalInvoice(registration) ? "Balance" : "Deposit"}{" "}
          Slips
        </FileUploadButton>
      ) : (
        paymentDue && (
          // Opens the wizard: a first slip needs a payment reference and may need T&C acceptance.
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={onOpenWizard}
          >
            Upload {pendingStep === "final_payment" ? "Balance" : "Deposit"}{" "}
            Slip
          </Button>
        )
      )}
      <ExtraPassports registration={registration} editable={canUploadDocs} />
    </div>
  );
}
