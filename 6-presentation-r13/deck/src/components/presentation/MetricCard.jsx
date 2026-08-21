/**
 * MetricCard — a deck-friendly composition of Card + Badge.
 *
 * Use this to present a single metric or statistic on a slide.
 * It composes shadcn/ui primitives (Card, Badge) into a reusable
 * presentation block — this is the pattern for building your own
 * slide components on top of the preinstalled primitives.
 *
 * Props:
 *   label    — short category label rendered as a Badge
 *   value    — the hero number or stat (large text)
 *   description — supporting context beneath the value
 *   variant  — Badge variant (default: "secondary")
 *   className — additional classes on the outer Card
 *
 * Example:
 *   <MetricCard label="Users" value="1.2M" description="Monthly active" />
 */
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function MetricCard({
  label,
  value,
  description,
  variant = 'secondary',
  className,
  ...props
}) {
  return (
    <Card className={cn('text-center', className)} {...props}>
      <CardHeader>
        {label && <Badge variant={variant} className="mx-auto">{label}</Badge>}
        <CardTitle className="text-4xl font-bold tracking-tight">
          {value}
        </CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
    </Card>
  )
}
