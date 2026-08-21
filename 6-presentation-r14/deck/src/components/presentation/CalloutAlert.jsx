/**
 * CalloutAlert — an Alert composition for callout/highlight slides.
 *
 * Perfect for "pro tip", "key takeaway", or "important" blocks
 * inside a slide. Composes shadcn's Alert with an optional icon,
 * title, and description — ready to drop into any slide layout.
 *
 * Props:
 *   icon      — React node rendered as the alert icon (e.g. <Lightbulb />)
 *   title     — bold heading text
 *   children  — the callout body / description
 *   variant   — Alert variant (default: "default")
 *   className — additional classes
 *
 * Example:
 *   import { Lightbulb } from 'lucide-react'
 *   <CalloutAlert icon={<Lightbulb />} title="Pro tip">
 *     Use the shadcn MCP server for AI-assisted component expansion.
 *   </CalloutAlert>
 */
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export default function CalloutAlert({
  icon,
  title,
  children,
  variant = 'default',
  className,
  ...props
}) {
  return (
    <Alert variant={variant} className={cn(className)} {...props}>
      {icon}
      {title && <AlertTitle>{title}</AlertTitle>}
      {children && <AlertDescription>{children}</AlertDescription>}
    </Alert>
  )
}
