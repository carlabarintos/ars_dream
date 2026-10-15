import { CalendarIcon, CheckIcon, MapPinIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { toBulletLines } from '@/features/marathons/api'
import { PackagePhotoCarousel } from '@/features/marathons/PackagePhotoCarousel'
import { cn } from '@/lib/utils'
import type { QuestionType } from '@/types'

export interface PreviewPackage {
  id: string
  name: string
  priceAmount: number
  priceCurrency: string
  description: string
  photoUrls: string[]
  addOns: { id: string; name: string; priceAmount: number; mandatory?: boolean }[]
}

export interface PreviewQuestion {
  id: string
  label: string
  type: QuestionType
  required: boolean
  options?: string[]
}

export interface MarathonPreviewData {
  title: string
  description: string
  location: string
  bannerImageUrl: string
  eventDate: Date | null
  registrationClosesAt: Date | null
  capacity: number
  confirmedCount: number
  paymentInstructions: string
  sharedInclusions: string
  packageNotes: string
  packages: PreviewPackage[]
  questions: PreviewQuestion[]
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  bool: 'Yes/No',
  text: 'Short text',
  int: 'Number',
  dropdown: 'Multiple choice',
}

function formatDate(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatPrice(pkg: PreviewPackage) {
  return `${pkg.priceCurrency || 'PHP'} ${pkg.priceAmount.toLocaleString()}`
}

export function MarathonPreviewDialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: MarathonPreviewData | null
}) {
  if (!data) return null

  const spotsLeft = Math.max(data.capacity - data.confirmedCount, 0)
  const percentFull = data.capacity > 0 ? (data.confirmedCount / data.capacity) * 100 : 0
  const isFull = spotsLeft <= 0
  const isClosed = data.registrationClosesAt ? new Date() > data.registrationClosesAt : false
  const sharedInclusions = toBulletLines(data.sharedInclusions)
  const packageNotes = toBulletLines(data.packageNotes)

  const statusPill = isFull || isClosed
    ? { label: 'Closed', variant: 'secondary' as const }
    : percentFull >= 75
      ? { label: 'Filling Up', variant: 'warning' as const }
      : { label: 'Open', variant: 'success' as const }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground -mt-2 text-xs">
          This is roughly how the event will look to registrants once published. Nothing has been saved.
        </p>

        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden py-0 gap-0">
            <div
              className="bg-muted relative block h-40 w-full bg-cover bg-center"
              style={data.bannerImageUrl ? { backgroundImage: `url(${data.bannerImageUrl})` } : undefined}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <Badge variant={statusPill.variant} className="absolute top-3 right-3">
                {statusPill.label}
              </Badge>
              <div className="font-display absolute bottom-3 left-4 text-4xl tracking-wide text-white drop-shadow">
                {formatDate(data.eventDate)}
              </div>
            </div>

            <CardContent className="flex flex-col gap-3 pt-5">
              <div>
                <h3 className="font-display text-xl leading-tight tracking-wide">
                  {data.title || 'Untitled event'}
                </h3>
                <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                  <MapPinIcon className="size-3.5" />
                  {data.location || '—'}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>{spotsLeft} spots left</span>
                  <span>
                    {data.confirmedCount}/{data.capacity}
                  </span>
                </div>
                <Progress value={percentFull} />
              </div>

              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <CalendarIcon className="size-3.5" />
                Registration closes {formatDate(data.registrationClosesAt)}
              </div>
            </CardContent>
          </Card>

          {data.description && <p className="text-sm whitespace-pre-line">{data.description}</p>}

          {data.packages.length > 0 && (
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-medium">Packages</h4>
              {sharedInclusions.length > 0 && (
                <div className="bg-secondary/40 border-border rounded-xl border p-4">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Included in every package
                  </p>
                  <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    {sharedInclusions.map((line, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {data.packages.map((pkg) => (
                  <Card
                    key={pkg.id}
                    className={cn('flex flex-col', pkg.photoUrls.length > 0 && 'gap-0 overflow-hidden py-0')}
                  >
                    {pkg.photoUrls.length > 0 && <PackagePhotoCarousel photoUrls={pkg.photoUrls} />}
                    <CardHeader>
                      <CardTitle>{pkg.name || 'Untitled package'}</CardTitle>
                      <p className="text-lg font-medium">{formatPrice(pkg)}</p>
                    </CardHeader>
                    {(pkg.description || pkg.addOns.length > 0) && (
                      <CardContent className={cn('flex-1', pkg.photoUrls.length > 0 && 'pt-5')}>
                        {pkg.description && (
                          <ul className="text-muted-foreground flex list-disc flex-col gap-1.5 pl-5 text-sm">
                            {pkg.description
                              .split('\n')
                              .filter((line) => line.trim())
                              .map((line, index) => (
                                <li key={index}>{line.trim()}</li>
                              ))}
                          </ul>
                        )}
                        {pkg.addOns.length > 0 && (
                          <div className="mt-3 flex flex-col gap-1">
                            <p className="text-muted-foreground text-xs font-medium">Add-ons</p>
                            {pkg.addOns.map((addOn) => (
                              <div key={addOn.id} className="flex justify-between gap-3 text-sm">
                                <span>
                                  {addOn.name}
                                  {addOn.mandatory && <span className="text-muted-foreground"> (required)</span>}
                                </span>
                                <span className="text-muted-foreground">
                                  +{pkg.priceCurrency || 'PHP'} {addOn.priceAmount.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
              {packageNotes.length > 0 && (
                <div className="bg-secondary/40 border-border rounded-xl border p-4">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Notes</p>
                  <ul className="text-muted-foreground mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm">
                    {packageNotes.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {data.questions.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium">Registration questions</h4>
              <div className="flex flex-col gap-2">
                {data.questions.map((question) => (
                  <div key={question.id} className="border-border rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {question.label || 'Untitled item'}
                        {question.required && <span className="text-destructive"> *</span>}
                      </span>
                      <Badge variant="secondary">{QUESTION_TYPE_LABELS[question.type]}</Badge>
                    </div>
                    {question.type === 'dropdown' && question.options && question.options.length > 0 && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        Choices: {question.options.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.paymentInstructions && (
            <div className="flex flex-col gap-1.5">
              <h4 className="text-sm font-medium">Payment instructions</h4>
              <p className="text-muted-foreground border-border rounded-md border p-3 text-sm whitespace-pre-line">
                {data.paymentInstructions}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
