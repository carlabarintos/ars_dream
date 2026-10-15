import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { PlusIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/features/auth/auth-store'
import type { Marathon, MarathonPackage, MarathonQuestion, QuestionType } from '@/types'

import {
  createMarathon,
  getPackageDescription,
  updateMarathon,
  uploadMarathonBanner,
  uploadMarathonPackageOffer,
  uploadMarathonPackagePhoto,
} from '@/features/marathons/api'
import { useQuestionnaireTemplates } from '@/features/questionnaire-templates/use-questionnaire-templates'

import { MarathonPreviewDialog, type MarathonPreviewData } from './MarathonPreviewDialog'

const LOAD_TEMPLATE_PLACEHOLDER = ''
const MAX_PACKAGE_PHOTOS = 6

let nextRowId = 0

interface PackagePhotoRow {
  id: number
  /** Real download URL if already uploaded, object-URL preview if pending. */
  url: string
  /** Set for a pending local selection not yet uploaded; null for an already-uploaded photo. */
  file: File | null
}

/** A package's single standard offer image — same url/file shape as PackagePhotoRow, but only one is kept. */
interface PackageOfferRow {
  url: string
  file: File | null
}

interface AddOnRow {
  id: number
  /** The add-on's persisted id — kept stable across edits so existing registrants' `selectedAddOns` stay matched to the right add-on. */
  addOnId: string
  name: string
  priceAmount: string
}

interface PackageRow {
  id: number
  /** The package's persisted id — kept stable across edits so existing registrants' `packageId` stays matched to the right package (e.g. for the offer image lookup in OfferChatDialog). */
  packageId: string
  name: string
  priceAmount: string
  priceCurrency: string
  description: string
  photos: PackagePhotoRow[]
  offer: PackageOfferRow | null
  addOns: AddOnRow[]
}

interface QuestionRow {
  rowId: number
  /** The question's persisted id — kept stable across edits so existing registrants' answers stay matched to it. */
  id: string
  label: string
  type: QuestionType
  required: boolean
  /** Comma-separated choices, only used for 'dropdown' items. */
  options: string
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  bool: 'Yes/No',
  text: 'Short text',
  int: 'Number',
  dropdown: 'Multiple choice',
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toPackageRows(packages: MarathonPackage[] | undefined): PackageRow[] {
  return (packages ?? []).map((pkg) => ({
    id: nextRowId++,
    packageId: pkg.id,
    name: pkg.name,
    priceAmount: pkg.priceAmount.toString(),
    priceCurrency: pkg.priceCurrency,
    description: getPackageDescription(pkg),
    photos: (pkg.photoUrls ?? []).map((url) => ({ id: nextRowId++, url, file: null })),
    offer: pkg.offerImageUrl ? { url: pkg.offerImageUrl, file: null } : null,
    addOns: (pkg.addOns ?? []).map((addOn) => ({
      id: nextRowId++,
      addOnId: addOn.id,
      name: addOn.name,
      priceAmount: addOn.priceAmount.toString(),
    })),
  }))
}

function toQuestionRows(questions: MarathonQuestion[] | undefined): QuestionRow[] {
  return (questions ?? []).map((question) => ({
    rowId: nextRowId++,
    id: question.id,
    label: question.label,
    type: question.type,
    required: question.required,
    options: (question.options ?? []).join(', '),
  }))
}

export function MarathonFormDialog({
  marathon,
  trigger,
}: {
  /** When provided, the dialog edits this marathon instead of creating a new one. */
  marathon?: Marathon
  /** Custom trigger element; defaults to a "New Marathon" or "Edit" button. */
  trigger?: ReactNode
}) {
  const isEditing = marathon != null
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [packageRows, setPackageRows] = useState<PackageRow[]>(() => toPackageRows(marathon?.packages))
  const [questionRows, setQuestionRows] = useState<QuestionRow[]>(() => toQuestionRows(marathon?.questions))
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | undefined>(marathon?.bannerImageUrl)
  const [feedDeadline, setFeedDeadline] = useState(
    marathon?.feedDeadline ? toDateInputValue(marathon.feedDeadline.toDate()) : '',
  )
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<MarathonPreviewData | null>(null)
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const { templates: questionnaireTemplates } = useQuestionnaireTemplates()

  const formRef = useRef<HTMLFormElement>(null)
  const packageRowsRef = useRef(packageRows)
  packageRowsRef.current = packageRows

  // Revoke any pending photo/offer-preview object URLs left over if the dialog is closed without submitting.
  useEffect(() => {
    return () => {
      for (const row of packageRowsRef.current) {
        for (const photo of row.photos) {
          if (photo.file) URL.revokeObjectURL(photo.url)
        }
        if (row.offer?.file) URL.revokeObjectURL(row.offer.url)
      }
    }
  }, [])

  function handleBannerFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBannerFile(file)
    setBannerPreviewUrl(URL.createObjectURL(file))
  }

  function loadQuestionsFromTemplate(templateId: string) {
    const template = questionnaireTemplates.find((t) => t.id === templateId)
    if (!template) return
    if (
      questionRows.length > 0 &&
      !window.confirm('This replaces the current question rows with the template\'s questions. Continue?')
    ) {
      return
    }
    setQuestionRows(toQuestionRows(template.questions))
  }

  function addQuestion() {
    setQuestionRows((rows) => [
      ...rows,
      { rowId: nextRowId++, id: crypto.randomUUID(), label: '', type: 'bool', required: false, options: '' },
    ])
  }

  function removeQuestion(rowId: number) {
    setQuestionRows((rows) => rows.filter((row) => row.rowId !== rowId))
  }

  function updateQuestionRow(rowId: number, patch: Partial<Omit<QuestionRow, 'rowId' | 'id'>>) {
    setQuestionRows((rows) => rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)))
  }

  function addPackage() {
    setPackageRows((rows) => [
      ...rows,
      {
        id: nextRowId++,
        packageId: crypto.randomUUID(),
        name: '',
        priceAmount: '',
        priceCurrency: 'PHP',
        description: '',
        photos: [],
        offer: null,
        addOns: [],
      },
    ])
  }

  function removePackage(packageId: number) {
    setPackageRows((rows) => rows.filter((row) => row.id !== packageId))
  }

  function updatePackageField(packageId: number, field: 'name' | 'priceAmount' | 'priceCurrency' | 'description', text: string) {
    setPackageRows((rows) =>
      rows.map((row) => (row.id === packageId ? { ...row, [field]: text } : row)),
    )
  }

  function addAddOnRow(packageId: number) {
    setPackageRows((rows) =>
      rows.map((row) =>
        row.id === packageId
          ? { ...row, addOns: [...row.addOns, { id: nextRowId++, addOnId: crypto.randomUUID(), name: '', priceAmount: '' }] }
          : row,
      ),
    )
  }

  function updateAddOnRow(packageId: number, addOnRowId: number, field: 'name' | 'priceAmount', text: string) {
    setPackageRows((rows) =>
      rows.map((row) =>
        row.id === packageId
          ? {
              ...row,
              addOns: row.addOns.map((addOn) =>
                addOn.id === addOnRowId ? { ...addOn, [field]: text } : addOn,
              ),
            }
          : row,
      ),
    )
  }

  function removeAddOnRow(packageId: number, addOnRowId: number) {
    setPackageRows((rows) =>
      rows.map((row) =>
        row.id === packageId
          ? { ...row, addOns: row.addOns.filter((addOn) => addOn.id !== addOnRowId) }
          : row,
      ),
    )
  }

  function addPackagePhotos(packageId: number, fileList: FileList | null) {
    if (!fileList) return
    const files = Array.from(fileList)
    setPackageRows((rows) =>
      rows.map((row) => {
        if (row.id !== packageId) return row
        const remaining = MAX_PACKAGE_PHOTOS - row.photos.length
        if (remaining <= 0) return row
        const newPhotos = files.slice(0, remaining).map((file) => ({
          id: nextRowId++,
          url: URL.createObjectURL(file),
          file,
        }))
        return { ...row, photos: [...row.photos, ...newPhotos] }
      }),
    )
  }

  function removePackagePhoto(packageId: number, photoId: number) {
    setPackageRows((rows) =>
      rows.map((row) => {
        if (row.id !== packageId) return row
        const photo = row.photos.find((p) => p.id === photoId)
        if (photo?.file) URL.revokeObjectURL(photo.url)
        return { ...row, photos: row.photos.filter((p) => p.id !== photoId) }
      }),
    )
  }

  function setPackageOffer(packageId: number, file: File | null) {
    setPackageRows((rows) =>
      rows.map((row) => {
        if (row.id !== packageId) return row
        if (row.offer?.file) URL.revokeObjectURL(row.offer.url)
        return { ...row, offer: file ? { url: URL.createObjectURL(file), file } : null }
      }),
    )
  }

  function handlePreview() {
    const form = formRef.current
    if (!form) return
    const formData = new FormData(form)

    function dateFromField(name: string) {
      const value = String(formData.get(name) ?? '')
      return value ? new Date(value) : null
    }

    setPreviewData({
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
      location: String(formData.get('location') ?? ''),
      bannerImageUrl: bannerPreviewUrl ?? '',
      eventDate: dateFromField('eventDate'),
      registrationClosesAt: dateFromField('registrationClosesAt'),
      capacity: Number(formData.get('capacity')) || 0,
      confirmedCount: marathon?.confirmedCount ?? 0,
      paymentInstructions: String(formData.get('paymentInstructions') ?? ''),
      sharedInclusions: String(formData.get('sharedInclusions') ?? ''),
      packages: packageRows
        .filter((row) => row.name.trim())
        .map((row) => ({
          id: String(row.id),
          name: row.name.trim(),
          priceAmount: Number(row.priceAmount) || 0,
          priceCurrency: row.priceCurrency.trim() || 'PHP',
          description: row.description.trim(),
          photoUrls: row.photos.map((photo) => photo.url),
          addOns: row.addOns
            .filter((addOn) => addOn.name.trim())
            .map((addOn) => ({
              id: addOn.addOnId,
              name: addOn.name.trim(),
              priceAmount: Number(addOn.priceAmount) || 0,
            })),
        })),
      questions: questionRows
        .filter((row) => row.label.trim())
        .map((row) => ({
          id: row.id,
          label: row.label.trim(),
          type: row.type,
          required: row.required,
          ...(row.type === 'dropdown'
            ? { options: row.options.split(',').map((option) => option.trim()).filter(Boolean) }
            : {}),
        })),
    })
    setPreviewOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!uid) return

    const validPackageRows = packageRows.filter((row) => row.name.trim())

    if (validPackageRows.length === 0) {
      toast.error('Add at least one package.')
      return
    }

    const questions: MarathonQuestion[] = questionRows
      .filter((row) => row.label.trim())
      .map((row) => ({
        id: row.id,
        label: row.label.trim(),
        type: row.type,
        required: row.required,
        ...(row.type === 'dropdown'
          ? { options: row.options.split(',').map((option) => option.trim()).filter(Boolean) }
          : {}),
      }))

    if (!bannerFile && !marathon?.bannerImageUrl) {
      toast.error('Upload a banner image.')
      return
    }

    const form = new FormData(event.currentTarget)
    setIsSubmitting(true)
    try {
      const bannerImageUrl = bannerFile ? await uploadMarathonBanner(bannerFile) : marathon!.bannerImageUrl

      const photoUrlsByPackage = await Promise.all(
        validPackageRows.map((row) =>
          Promise.all(
            row.photos.map((photo) => (photo.file ? uploadMarathonPackagePhoto(photo.file) : photo.url)),
          ),
        ),
      )

      const offerUrlByPackage = await Promise.all(
        validPackageRows.map((row) => {
          if (!row.offer) return null
          return row.offer.file ? uploadMarathonPackageOffer(row.offer.file) : row.offer.url
        }),
      )

      const packages: MarathonPackage[] = validPackageRows.map((row, index) => ({
        id: row.packageId,
        name: row.name.trim(),
        priceAmount: Number(row.priceAmount) || 0,
        priceCurrency: row.priceCurrency.trim() || 'PHP',
        description: row.description.trim(),
        photoUrls: photoUrlsByPackage[index],
        ...(offerUrlByPackage[index] ? { offerImageUrl: offerUrlByPackage[index]! } : {}),
        addOns: row.addOns
          .filter((addOn) => addOn.name.trim())
          .map((addOn) => ({
            id: addOn.addOnId,
            name: addOn.name.trim(),
            priceAmount: Number(addOn.priceAmount) || 0,
          })),
      }))

      const input = {
        title: String(form.get('title')),
        description: String(form.get('description')),
        bannerImageUrl,
        location: String(form.get('location')),
        eventDate: new Date(String(form.get('eventDate'))),
        registrationOpensAt: new Date(String(form.get('registrationOpensAt'))),
        registrationClosesAt: new Date(String(form.get('registrationClosesAt'))),
        capacity: Number(form.get('capacity')),
        paymentInstructions: String(form.get('paymentInstructions')),
        sharedInclusions: String(form.get('sharedInclusions') ?? '').trim(),
        packages,
        questions,
        feedDeadline: feedDeadline ? new Date(feedDeadline) : null,
      }
      if (isEditing) {
        await updateMarathon(marathon.id, input)
        toast.success('Marathon updated.')
      } else {
        await createMarathon(input, uid)
        toast.success('Marathon created as a draft. Publish it when ready.')
        setPackageRows([])
        setQuestionRows([])
        setBannerFile(null)
        setBannerPreviewUrl(undefined)
        setFeedDeadline('')
      }
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant={isEditing ? 'outline' : 'default'} size={isEditing ? 'sm' : 'default'}>
            {isEditing ? 'Edit' : 'New Marathon'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Marathon' : 'New Marathon'}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Title" name="title" required defaultValue={marathon?.title} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              required
              defaultValue={marathon?.description}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bannerFile">Banner image</Label>
            {bannerPreviewUrl && (
              <img
                src={bannerPreviewUrl}
                alt=""
                className="h-32 w-full rounded-md border border-border object-cover"
              />
            )}
            <Input id="bannerFile" type="file" accept="image/*" onChange={handleBannerFileChange} />
          </div>
          <Field label="Location" name="location" required defaultValue={marathon?.location} />
          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Event date"
              name="eventDate"
              type="date"
              required
              defaultValue={marathon && toDateInputValue(marathon.eventDate.toDate())}
            />
            <Field
              label="Registration opens"
              name="registrationOpensAt"
              type="date"
              required
              defaultValue={marathon && toDateInputValue(marathon.registrationOpensAt.toDate())}
            />
            <Field
              label="Registration closes"
              name="registrationClosesAt"
              type="date"
              required
              defaultValue={marathon && toDateInputValue(marathon.registrationClosesAt.toDate())}
            />
          </div>
          <Field
            label="Capacity"
            name="capacity"
            type="number"
            required
            defaultValue={marathon?.capacity.toString()}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feedDeadline">Show in feed until (optional)</Label>
            <Input
              id="feedDeadline"
              type="date"
              value={feedDeadline}
              onChange={(e) => setFeedDeadline(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              After this date the marathon drops off the Home feed. Independent of the registration
              deadline and status below — leave blank to show for as long as it's published.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paymentInstructions">Payment instructions</Label>
            <Textarea
              id="paymentInstructions"
              name="paymentInstructions"
              placeholder="Bank transfer to Account #... / GCash to ..."
              required
              defaultValue={marathon?.paymentInstructions}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sharedInclusions">Included in every package (optional)</Label>
            <Textarea
              id="sharedInclusions"
              name="sharedInclusions"
              placeholder={'One per line (each becomes a bullet)\nRace bib & entry\nAirport transfers'}
              rows={3}
              defaultValue={marathon?.sharedInclusions}
            />
            <p className="text-muted-foreground text-xs">
              Shown once above the packages, so you don't repeat them in each package's details.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>Packages</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPackage}>
                <PlusIcon className="size-3.5" />
                Add package
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Each package is a selectable option for this event, e.g. "Standard" vs "VIP", with its
              own price and details.
            </p>

            {packageRows.length === 0 && (
              <p className="text-muted-foreground rounded-md border border-dashed border-border p-3 text-center text-xs">
                No packages yet. Add at least one.
              </p>
            )}

            {packageRows.map((pkg) => (
              <div key={pkg.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Package name (e.g. Standard)"
                    value={pkg.name}
                    onChange={(e) => updatePackageField(pkg.id, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Price"
                    type="number"
                    value={pkg.priceAmount}
                    onChange={(e) => updatePackageField(pkg.id, 'priceAmount', e.target.value)}
                    className="w-28"
                  />
                  <Input
                    placeholder="Currency"
                    value={pkg.priceCurrency}
                    onChange={(e) => updatePackageField(pkg.id, 'priceCurrency', e.target.value)}
                    className="w-20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePackage(pkg.id)}
                    aria-label="Remove package"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>

                <Textarea
                  placeholder={'Details, one per line (each becomes a bullet)\nRoundtrip airfare\n4-star hotel'}
                  value={pkg.description}
                  onChange={(e) => updatePackageField(pkg.id, 'description', e.target.value)}
                  rows={3}
                />

                <div className="flex flex-col gap-1.5 pl-3">
                  <Label className="text-muted-foreground text-xs">
                    Add-ons (optional extras a registrant can toggle on, e.g. "Add Companion")
                  </Label>
                  {pkg.addOns.map((addOn) => (
                    <div key={addOn.id} className="flex items-center gap-2">
                      <Input
                        placeholder="Add-on name (e.g. Add Companion)"
                        value={addOn.name}
                        onChange={(e) => updateAddOnRow(pkg.id, addOn.id, 'name', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Price"
                        type="number"
                        value={addOn.priceAmount}
                        onChange={(e) => updateAddOnRow(pkg.id, addOn.id, 'priceAmount', e.target.value)}
                        className="w-28"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAddOnRow(pkg.id, addOn.id)}
                        aria-label="Remove add-on"
                      >
                        <XIcon className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => addAddOnRow(pkg.id)}
                  >
                    <PlusIcon className="size-3.5" />
                    Add add-on
                  </Button>
                </div>

                <div className="flex flex-col gap-1.5 pl-3">
                  <Label className="text-muted-foreground text-xs">
                    Photos (optional, shown as a carousel to registrants)
                  </Label>
                  {pkg.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {pkg.photos.map((photo) => (
                        <div key={photo.id} className="relative">
                          <img
                            src={photo.url}
                            alt=""
                            className="h-16 w-16 rounded-md border border-border object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removePackagePhoto(pkg.id, photo.id)}
                            aria-label="Remove photo"
                            className="bg-background absolute -top-1.5 -right-1.5 rounded-full border border-border p-0.5"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {pkg.photos.length < MAX_PACKAGE_PHOTOS && (
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        addPackagePhotos(pkg.id, e.target.files)
                        e.target.value = ''
                      }}
                    />
                  )}
                </div>

                <div className="flex flex-col gap-1.5 pl-3">
                  <Label className="text-muted-foreground text-xs">
                    Standard offer image (optional — previewed and sendable to a registrant when accepting them)
                  </Label>
                  {pkg.offer && (
                    <div className="relative w-fit">
                      <img
                        src={pkg.offer.url}
                        alt=""
                        className="h-24 w-24 rounded-md border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setPackageOffer(pkg.id, null)}
                        aria-label="Remove offer image"
                        className="bg-background absolute -top-1.5 -right-1.5 rounded-full border border-border p-0.5"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  )}
                  {!pkg.offer && (
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        setPackageOffer(pkg.id, e.target.files?.[0] ?? null)
                        e.target.value = ''
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>Registration Questions</Label>
              <div className="flex items-center gap-2">
                <Select value={LOAD_TEMPLATE_PLACEHOLDER} onValueChange={loadQuestionsFromTemplate}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Load from template…" />
                  </SelectTrigger>
                  <SelectContent>
                    {questionnaireTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                  <PlusIcon className="size-3.5" />
                  Add item
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Extra information registrants must provide before submitting payment (e.g. emergency
              contact, dietary restrictions). Load a saved template as a starting point, then edit freely
              below — changes here don't affect the template or other marathons. Manage templates from the
              admin dashboard's "Manage Questionnaire Templates" link.
            </p>

            {questionRows.length === 0 && (
              <p className="text-muted-foreground rounded-md border border-dashed border-border p-3 text-center text-xs">
                No items configured. Registrants will skip straight to payment once accepted.
              </p>
            )}

            {questionRows.map((question) => (
              <div key={question.rowId} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Item label (e.g. I agree to the terms & conditions)"
                    value={question.label}
                    onChange={(e) => updateQuestionRow(question.rowId, { label: e.target.value })}
                    className="flex-1"
                  />
                  <Select
                    value={question.type}
                    onValueChange={(value) => updateQuestionRow(question.rowId, { type: value as QuestionType })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeQuestion(question.rowId)}
                    aria-label="Remove item"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-4 pl-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(e) => updateQuestionRow(question.rowId, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  {question.type === 'dropdown' && (
                    <Input
                      placeholder="Choices, comma-separated (e.g. Vegetarian, Vegan, None)"
                      value={question.options}
                      onChange={(e) => updateQuestionRow(question.rowId, { options: e.target.value })}
                      className="flex-1"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handlePreview}>
              Preview
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isEditing ? 'Save Changes' : 'Create Draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <MarathonPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} data={previewData} />
    </Dialog>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required,
  defaultValue,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  defaultValue?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} />
    </div>
  )
}
