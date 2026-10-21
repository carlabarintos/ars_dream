import { type ReactNode, useState } from 'react'
import { DownloadIcon, FileTextIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { type BookingDocument, bookingDocumentPage, downloadBookingDocument } from './booking-documents'

/** The document rendered as it looks in the email, sized to its content so the surrounding dialog scrolls, not the frame. */
export function BookingDocumentFrame({ document, className }: { document: BookingDocument; className?: string }) {
  return (
    <iframe
      title={document.label}
      srcDoc={bookingDocumentPage(document, document.label, 'all')}
      onLoad={(e) => {
        const frame = e.currentTarget
        frame.style.height = `${frame.contentDocument?.documentElement.scrollHeight ?? 0}px`
      }}
      className={cn('h-[60vh] w-full rounded-md border border-border bg-white', className)}
    />
  )
}

function ViewerDialog({
  title,
  open,
  onClose,
  onDownload,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  onDownload: () => void
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button onClick={onDownload}>
            <DownloadIcon />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Views an invoice/receipt in-app, with the option to download it. */
export function BookingDocumentDialog({
  document,
  marathonTitle,
  onClose,
}: {
  document: BookingDocument | undefined
  marathonTitle: string | undefined
  onClose: () => void
}) {
  return (
    <ViewerDialog
      title={[document?.label, marathonTitle].filter(Boolean).join(' — ')}
      open={!!document}
      onClose={onClose}
      onDownload={() => document && downloadBookingDocument(document, marathonTitle)}
    >
      {document && <BookingDocumentFrame document={document} />}
    </ViewerDialog>
  )
}

/** The uploaded file's original name, from a Storage download URL (`…/o/<encoded path>?token=…`), minus the `Date.now()-` upload prefix. */
function uploadedFileName(url: string) {
  const path = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '')
  return path.split('/').pop()!.replace(/^\d+-/, '')
}

export function isPdfUpload(url: string) {
  return /\.pdf$/i.test(uploadedFileName(url))
}

async function downloadUploadedFile(url: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(response.statusText)
    const link = document.createElement('a')
    link.href = URL.createObjectURL(await response.blob())
    link.download = uploadedFileName(url)
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href))
  } catch {
    // The bucket may not allow cross-origin fetches (no Storage CORS config); the browser's own viewer still has a save button.
    window.open(url, '_blank', 'noreferrer')
  }
}

/** Wraps a thumbnail/link to an uploaded file (payment proof, passport photo) so clicking it views the file in-app, with a Download option. */
export function UploadedFileButton({
  url,
  label,
  className,
  children,
}: {
  url: string
  label: string
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn('cursor-pointer text-left', className)}>
        {children}
      </button>
      <ViewerDialog title={label} open={open} onClose={() => setOpen(false)} onDownload={() => void downloadUploadedFile(url)}>
        {isPdfUpload(url) ? (
          <iframe title={label} src={url} className="h-[70vh] w-full rounded-md border border-border" />
        ) : (
          <img src={url} alt={label} className="mx-auto max-h-[70vh] max-w-full rounded-md border border-border" />
        )}
      </ViewerDialog>
    </>
  )
}

/** A clickable preview of an uploaded file: the image itself, or a file tile for a PDF. */
export function UploadedFileThumb({ url, label, className }: { url: string; label: string; className?: string }) {
  return (
    <UploadedFileButton url={url} label={label} className="flex flex-col gap-1 text-xs">
      {isPdfUpload(url) ? (
        <span
          className={cn(
            'border-border bg-muted text-muted-foreground flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-md border',
            className,
          )}
        >
          <FileTextIcon className="size-6" />
          PDF
        </span>
      ) : (
        <img src={url} alt={label} className={cn('border-border w-auto rounded-md border object-contain', className)} />
      )}
      <span className={label.endsWith('Rejected') ? 'text-destructive' : 'text-muted-foreground'}>{label}</span>
    </UploadedFileButton>
  )
}
