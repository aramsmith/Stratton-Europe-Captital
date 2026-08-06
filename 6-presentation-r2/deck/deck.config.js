import DecisionSummarySlide from './src/slides/DecisionSummarySlide.jsx'
import BusinessContextSlide from './src/slides/BusinessContextSlide.jsx'
import ValueLogicSlide from './src/slides/ValueLogicSlide.jsx'
import ArchitectureChoiceSlide from './src/slides/ArchitectureChoiceSlide.jsx'
import TargetArchitectureSlide from './src/slides/TargetArchitectureSlide.jsx'
import AzureDesignSlide from './src/slides/AzureDesignSlide.jsx'
import DeliveryReadinessSlide from './src/slides/DeliveryReadinessSlide.jsx'
import BusinessCaseSlide from './src/slides/BusinessCaseSlide.jsx'
import GovernanceRisksSlide from './src/slides/GovernanceRisksSlide.jsx'
import RecommendationSlide from './src/slides/RecommendationSlide.jsx'

export default {
  id: 'architecture-decision-executive-brief',
  title: 'Investment Decision Intelligence',
  subtitle: 'Executive architecture decision brief',
  description: 'Evidence-backed baseline endorsement and controlled roadmap',
  meta: {
    seededTemplate: false,
    contentStatus: 'candidate',
    evidenceBoundary: 'approved-through-phase-5',
  },
  icon: 'A',
  accent: '#0ea5e9',
  theme: 'shadcn',
  designSystem: 'shadcn',
  appearance: 'dark',
  aurora: {
    palette: 'ocean',
    colors: ['#0ea5e9', '#6366f1', '#8b5cf6'],
  },
  order: 1,
  hiddenSlides: [],
  slides: [
    DecisionSummarySlide,
    BusinessContextSlide,
    ValueLogicSlide,
    ArchitectureChoiceSlide,
    TargetArchitectureSlide,
    AzureDesignSlide,
    DeliveryReadinessSlide,
    BusinessCaseSlide,
    GovernanceRisksSlide,
    RecommendationSlide,
  ],
}
