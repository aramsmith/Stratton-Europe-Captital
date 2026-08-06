/**
 * SectionBadge — a styled Badge composition for section headers.
 *
 * Slides often need a small eyebrow label above the title to
 * indicate the current section or topic. This wraps shadcn's
 * Badge with presentation-friendly defaults: outline variant,
 * uppercase tracking, and muted opacity.
 *
 * Props:
 *   children  — the label text
 *   variant   — Badge variant override (default: "outline")
 *   className — additional classes
 *
 * Example:
 *   <SectionBadge>Introduction</SectionBadge>
 */
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function SectionBadge({
  children,
  variant = 'outline',
  className,
  ...props
}) {
  return (
    <Badge
      variant={variant}
      className={cn(
        'text-xs uppercase tracking-widest opacity-80',
        className
      )}
      {...props}
    >
      {children}
    </Badge>
  )
}
