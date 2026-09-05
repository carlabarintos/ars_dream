import { cn } from '@/lib/utils'

export function LogoBadge({
  className,
  imgClassName = 'h-12 w-auto',
}: {
  className?: string
  imgClassName?: string
}) {
  return (
    <div className={cn('inline-flex items-center justify-center rounded-2xl bg-white/95 p-4 shadow-xl', className)}>
      <img
        src="/ars-dream-logo-jp.avif"
        alt="ARS Dream Sports — アールス ドリーム"
        className={imgClassName}
      />
    </div>
  )
}
