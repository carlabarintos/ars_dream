import { useRef, useState, type ComponentProps } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

/** A button that picks files and hands them to `onFiles`, showing a spinner and toasting any error. */
export function FileUploadButton({
  accept,
  multiple,
  onFiles,
  ...buttonProps
}: Omit<ComponentProps<typeof Button>, 'onClick'> & {
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  async function handleChange(fileList: FileList | null) {
    const files = Array.from(fileList ?? [])
    if (inputRef.current) inputRef.current.value = ''
    if (!files.length) return
    setIsUploading(true)
    try {
      await onFiles(files)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => void handleChange(e.target.files)}
      />
      <Button {...buttonProps} loading={isUploading} onClick={() => inputRef.current?.click()} />
    </>
  )
}
