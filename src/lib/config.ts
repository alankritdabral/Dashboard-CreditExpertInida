// Centralised claims - keep configurable, never hardcode in components
export const claims = {
  personalLoanFrom: "9.95% p.a.*",
  personalLoanFromNote: "Personal loans starting from 9.95% p.a.* for eligible salaried applicants",
  balanceTransferNote: "Help customers reduce their interest burden, potentially to rates around 11% or lower where eligible.",
  disclaimerShort: "*Rates depend on credit profile, income, employer, existing obligations, loan amount, tenure and lender policy. For eligible applicants only.",
  disclaimerFull: "Your actual rate, EMI, savings and eligibility depend on your financial profile and the respective lender's criteria.",
  calculatorDisclaimer: "Illustrative / indicative only. This calculator output is not an approved offer.",
} as const;

export const contact = {
  whatsapp: "+91-9761471212",
  email: "akash.tyagi@creditexpertindia.com",
  addresses: [
    {
      city: "Dehradun",
      fullAddress: "2nd floor, Jumpstart Haridwar Bypass Rd, opp. Nilaya Hills, Saraswati Vihar, Ajabpur Kalan, Dehradun, Uttarakhand 248001"
    },
    {
      city: "Delhi",
      fullAddress: "3rd floor 1/560A main GT road shahdra near jindal oil mills mansarovar park shahdara delhi-110032"
    },
    {
      city: "Rudrapur",
      fullAddress: "Balaji Dwar, Adarsh Colonial Road, Rudrapur, near SBI Bank ATM Rudrapur Uttarakhand 263153"
    }
  ],
  legalName: "Credit Expert India",
} as const;

export const lendingPartners = {
  enabled: true,
  headline: "Affiliated Banking & Lending Partners",
  subheadline: "We work with premier private sector banks and RBI-registered NBFC networks across India to find optimal loan and consolidation solutions.",
  partners: [
    { id: "hdfc", name: "HDFC Bank", type: "Private Bank" },
    { id: "icici", name: "ICICI Bank", type: "Private Bank" },
    { id: "axis", name: "Axis Bank", type: "Private Bank" },
    { id: "kotak", name: "Kotak Mahindra Bank", type: "Private Bank" },
    { id: "indusind", name: "IndusInd Bank", type: "Private Bank" },
    { id: "idfc", name: "IDFC FIRST Bank", type: "Private Bank" },
  ],
} as const;

export const siteConfig = {
  name: "Credit Expert India",
  tagline: "Paying Too Much Interest on Your Loans? Let's Find a Better Way Forward.",
  url: "https://creditexpertindia.com",
};
