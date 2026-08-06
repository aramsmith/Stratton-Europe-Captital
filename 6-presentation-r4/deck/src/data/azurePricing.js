export const azurePricingMeta = {
  apiVersion: '2023-01-01-preview',
  queriedAt: '2026-08-04',
  region: 'West Europe',
  currency: 'USD',
  hoursPerMonth: 730,
  basis: 'Public PAYG retail rates; illustrative production workload; taxes, support and discounts excluded.',
}

export const azureCostCategories = [
  {
    id: 'network',
    label: 'Network + API',
    monthly: 3105.54,
    color: '#58a6ff',
    detail: 'Firewall Premium, WAF v2, APIM Standard v2 and Service Bus Premium',
  },
  {
    id: 'data',
    label: 'Data + search',
    monthly: 1547.45,
    color: '#8b5cf6',
    detail: 'SQL Business Critical, 5 TB hot blob storage and three AI Search S1 primary-meter units',
  },
  {
    id: 'apps-ai',
    label: 'Apps + AI',
    monthly: 450.55,
    color: '#2dd4bf',
    detail: 'Container Apps, GPT-4o mini token usage and 20K Document Intelligence pages',
  },
  {
    id: 'operations',
    label: 'Operations + reserve',
    monthly: 782,
    color: '#f472b6',
    detail: 'Log Analytics, Key Vault and a transparent reserve for private endpoints, DNS, ACR and transactions',
  },
]

export const azureMonthlyTotal = azureCostCategories.reduce((sum, item) => sum + item.monthly, 0)
export const azureAnnualTotal = azureMonthlyTotal * 12

export const onPremMock = {
  annualTotal: 112984.37,
  annualOpex: 66660.78,
  annualCapexRenewal: 46323.59,
  premiumPercent: 60,
}

export const pricingAssumptions = [
  '1 production region plus warm recovery design allowance',
  '4 active vCPU / 8 GiB Container Apps at 50% average utilisation',
  '100 GB analytics-log ingestion and 5 TB hot LRS storage per month',
  '100M input + 20M output GPT-4o mini tokens and 20K pre-built document pages',
]
