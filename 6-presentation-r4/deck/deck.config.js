import TitleSlide from './src/slides/TitleSlide.jsx'
import CompanyProfileSlide from './src/slides/CompanyProfileSlide.jsx'
import TransformationAgendaSlide from './src/slides/TransformationAgendaSlide.jsx'
import MyApproachSlide from './src/slides/MyApproachSlide.jsx'
import AgenticArchitectureRingSlide from './src/slides/AgenticArchitectureRingSlide.jsx'
import AgenticAssuranceRosterSlide from './src/slides/AgenticAssuranceRosterSlide.jsx'
import FrontierSolutionTitleSlide from './src/slides/FrontierSolutionTitleSlide.jsx'
import RequirementsInterviewSlide from './src/slides/RequirementsInterviewSlide.jsx'
import TogafArchitectureSlide from './src/slides/TogafArchitectureSlide.jsx'
import HumanAiOperatingModelSlide from './src/slides/HumanAiOperatingModelSlide.jsx'
import AzureDesignSlide from './src/slides/AzureDesignSlide.jsx'
import ImplementationPlanSlide from './src/slides/ImplementationPlanSlide.jsx'
import CodingSlide from './src/slides/CodingSlide.jsx'
import DeploymentSlide from './src/slides/DeploymentSlide.jsx'
import RunTestsSlide from './src/slides/RunTestsSlide.jsx'
import CostsBenefitsSlide from './src/slides/CostsBenefitsSlide.jsx'
import RisksMitigationsSlide from './src/slides/RisksMitigationsSlide.jsx'
import NextStepsSlide from './src/slides/NextStepsSlide.jsx'
import ThankYouSlide from './src/slides/ThankYouSlide.jsx'

export default {
  id: 'architecture-decision-executive-brief',
  title: 'Becoming a Frontier Company',
  subtitle: 'Executive architecture decision brief',
  description: 'Stratton Europe Capital nineteen-slide executive architecture working draft',
  meta: {
    seededTemplate: false,
    contentStatus: 'working-draft-nineteen-slide-case-grounded',
    evidenceBoundary: 'slides-2-and-3-grounded-in-case-study-18; slide-4-presenter-method-and-linked-reference-sources; slides-5-and-6-grounded-in-the-agentic-architecture-v2-operating-model; slide-7-presenter-framed-solution-vision; slides-8-and-9 grounded in approved Phase 1-and-2 case artifacts; slide-10 is a logical human-AI process allocation derived from approved Phase 2 evidence with Microsoft AI implementation cues; slides-11-through-13 grounded in approved Phase 3-through-5 case artifacts; slides-14-and-15 are explicitly planned-or-mock optional execution views; slide-16 combines live Azure Retail Prices API rates with a clearly labelled demo on-premises comparator; slides-17-through-19 close with a working-project assumption/risk assessment, an explicit mockup-data-to-POC roadmap and presentation-only thank-you copy; slide-17 is a project risk/assumption assessment derived from the current working architecture; slide-18 explicitly uses mockup-data disclosure and proposes investigation and a non-production POC; slide-19 is presentation closing copy and makes no delivery claim',
    canvas: '1440x900-16:10',
    defaultFont: 'JetBrains Mono',
    fallbackFontMode: 'system-ui',
  },
  icon: 'A',
  accent: '#58a6ff',
  theme: 'dark',
  designSystem: 'default',
  appearance: 'dark',
  order: 1,
  hiddenSlides: [],
  slides: [
    TitleSlide,
    CompanyProfileSlide,
    TransformationAgendaSlide,
    MyApproachSlide,
    AgenticArchitectureRingSlide,
    AgenticAssuranceRosterSlide,
    FrontierSolutionTitleSlide,
    RequirementsInterviewSlide,
    TogafArchitectureSlide,
    HumanAiOperatingModelSlide,
    AzureDesignSlide,
    ImplementationPlanSlide,
    CodingSlide,
    DeploymentSlide,
    RunTestsSlide,
    CostsBenefitsSlide,
    RisksMitigationsSlide,
    NextStepsSlide,
    ThankYouSlide,
  ],
}
