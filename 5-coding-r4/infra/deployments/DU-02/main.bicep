targetScope = 'managementGroup'

param approvedLocationList array
param approvedLocationEvidenceId string
param regulatoryEvidenceRegisterVersion string
param tags object
param settings object

module guardrails '../../modules/governance/main.bicep' = {
  name: 'du02-guardrails'
  params: {
    approvedLocationList: approvedLocationList
    approvedLocationEvidenceId: approvedLocationEvidenceId
    regulatoryEvidenceRegisterVersion: regulatoryEvidenceRegisterVersion
    tags: tags
    settings: settings
  }
}

output policyAssignmentId string = guardrails.outputs.assignmentId