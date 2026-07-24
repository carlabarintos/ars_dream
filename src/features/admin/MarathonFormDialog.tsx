import { useState, type FormEvent, type ReactNode } from 'react'
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

import { createMarathon, updateMarathon } from '@/features/marathons/api'
import { useQuestionnaireTemplates } from '@/features/questionnaire-templates/use-questionnaire-templates'

const LOAD_TEMPLATE_PLACEHOLDER = ''

let nextRowId = 0

interface DetailRow {
  id: number
  label: string
  value: string
}

interface PackageRow {
  id: number
  name: string
  priceAmount: string
  priceCurrency: string
  details: DetailRow[]
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
    name: pkg.name,
    priceAmount: pkg.priceAmount.toString(),
    priceCurrency: pkg.priceCurrency,
    details: pkg.details.map((detail) => ({ id: nextRowId++, ...detail })),
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
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const { templates: questionnaireTemplates } = useQuestionnaireTemplates()

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
      { id: nextRowId++, name: '', priceAmount: '', priceCurrency: 'PHP', details: [] },
    ])
  }

  function removePackage(packageId: number) {
    setPackageRows((rows) => rows.filter((row) => row.id !== packageId))
  }

  function updatePackageField(packageId: number, field: 'name' | 'priceAmount' | 'priceCurrency', text: string) {
    setPackageRows((rows) =>
      rows.map((row) => (row.id === packageId ? { ...row, [field]: text } : row)),
    )
  }

  function addDetailRow(packageId: number) {
    setPackageRows((rows) =>
      rows.map((row) =>
        row.id === packageId
          ? { ...row, details: [...row.details, { id: nextRowId++, label: '', value: '' }] }
          : row,
      ),
    )
  }

  function updateDetailRow(packageId: number, detailId: number, field: 'label' | 'value', text: string) {
    setPackageRows((rows) =>
      rows.map((row) =>
        row.id === packageId
          ? {
              ...row,
              details: row.details.map((detail) =>
                detail.id === detailId ? { ...detail, [field]: text } : detail,
              ),
            }
          : row,
      ),
    )
  }

  function removeDetailRow(packageId: number, detailId: number) {
    setPackageRows((rows) =>
      rows.map((row) =>
        row.id === packageId
          ? { ...row, details: row.details.filter((detail) => detail.id !== detailId) }
          : row,
      ),
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!uid) return

    const packages: MarathonPackage[] = packageRows
      .filter((row) => row.name.trim())
      .map((row) => ({
        id: crypto.randomUUID(),
        name: row.name.trim(),
        priceAmount: Number(row.priceAmount) || 0,
        priceCurrency: row.priceCurrency.trim() || 'PHP',
        details: row.details
          .map((detail) => ({ label: detail.label.trim(), value: detail.value.trim() }))
          .filter((detail) => detail.label && detail.value),
      }))

    if (packages.length === 0) {
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

    const form = new FormData(event.currentTarget)
    const input = {
      title: String(form.get('title')),
      description: String(form.get('description')),
      bannerImageUrl: String(form.get('bannerImageUrl')),
      location: String(form.get('location')),
      eventDate: new Date(String(form.get('eventDate'))),
      registrationOpensAt: new Date(String(form.get('registrationOpensAt'))),
      registrationClosesAt: new Date(String(form.get('registrationClosesAt'))),
      capacity: Number(form.get('capacity')),
      paymentInstructions: String(form.get('paymentInstructions')),
      packages,
      questions,
    }
    setIsSubmitting(true)
    try {
      if (isEditing) {
        await updateMarathon(marathon.id, input)
        toast.success('Marathon updated.')
      } else {
        await createMarathon(input, uid)
        toast.success('Marathon created as a draft. Publish it when ready.')
        setPackageRows([])
        setQuestionRows([])
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
          <Field
            label="Banner image URL"
            name="bannerImageUrl"
            required
            defaultValue={marathon?.bannerImageUrl}
          />
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
            <Label htmlFor="paymentInstructions">Payment instructions</Label>
            <Textarea
              id="paymentInstructions"
              name="paymentInstructions"
              placeholder="Bank transfer to Account #... / GCash to ..."
              required
              defaultValue={marathon?.paymentInstructions}
            />
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

                <div className="flex flex-col gap-1.5 pl-3">
                  {pkg.details.map((detail) => (
                    <div key={detail.id} className="flex items-center gap-2">
                      <Input
                        placeholder="Label (e.g. Inclusions)"
                        value={detail.label}
                        onChange={(e) => updateDetailRow(pkg.id, detail.id, 'label', e.target.value)}
                        className="w-1/3"
                      />
                      <Input
                        placeholder="Value (e.g. Roundtrip airfare, 4-star hotel)"
                        value={detail.value}
                        onChange={(e) => updateDetailRow(pkg.id, detail.id, 'value', e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDetailRow(pkg.id, detail.id)}
                        aria-label="Remove detail"
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
                    onClick={() => addDetailRow(pkg.id)}
                  >
                    <PlusIcon className="size-3.5" />
                    Add detail
                  </Button>
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
            <Button type="submit" loading={isSubmitting}>
              {isEditing ? 'Save Changes' : 'Create Draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
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
