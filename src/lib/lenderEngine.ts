/**
 * Lender Eligibility Engine
 * 
 * Determines which lenders a customer is eligible for based on their
 * salary, employer, CIBIL score, existing liabilities, and other profile data.
 * 
 * Rules are sourced from individual lender policy MD files in /lenders data/.
 * Each lender's configuration is data-driven and can be updated independently.
 * 
 * Banks with their own employer Excel data use bank-specific categories.
 * Banks without use a generic tier derived from other banks' data.
 */



// ─── Types ──────────────────────────────────────────────────────────────────

interface ObligationRules {
  ccObligationPercent: number;      // % of CC outstanding treated as obligation
  goldLoanObligationPercent: number;
  plNonObligationIfEmisBelow?: number;  // PL is non-obligation if remaining EMIs < this
  hlNonObligationIfEmisBelow?: number;  // HL is non-obligation if remaining EMIs < this
}

interface IncomeAddBack {
  rentalPercent: number;       // % of rental income to add
  monthlyIncentive: boolean;
  quarterlyIncentive: boolean;
  halfYearlyIncentive: boolean;
  monthlyBonus: boolean;
  quarterlyBonus: boolean;
  yearlyBonus: boolean;
  bonusAddBackPercent: number; // % of bonus considered (e.g., 50% for Axis)
  lta: boolean;
  variableIncome: boolean;
  pensionIncome: boolean;
}

interface BTRules {
  personalLoan: boolean;
  multiplePLs: boolean;
  maxPLBTs: number | null;         // null = unlimited
  creditCard: boolean;
  maxCCBTs: number | null;
  appLoan: boolean;
  maxAppBTs: number | null;
  overdraft: boolean;
  odBTRestrictions?: string[];     // Only these banks' ODs can be transferred
  maxTotalBTs: number | null;      // null = unlimited
  topUp: boolean;
  minBTFinancedAmount?: number;    // e.g., Tata Capital requires >₹5L
  minActiveEMIs?: number;          // e.g., L&T requires >= 6 active EMIs for BT
  minExposure?: number;            // e.g., L&T requires >= ₹2L exposure
}

interface LenderConfig {
  id: string;
  name: string;
  type: "Private Bank" | "NBFC";
  headlineRate: number;
  maxLoanAmount: number;
  minLoanAmount: number;
  maxTenure: number;
  maxFoir: number;

  // Employer lookup: if bankId is set, uses bank-specific Excel data
  employerBankId: string | null;

  // Min salary (default, may be overridden per segment)
  minSalary: number;

  // CIBIL
  minCibil: number | null;         // null = no specific requirement / scorecard based
  cibilMinus1Accepted: boolean;
  cibilMinus1MaxFunding: number;

  // BT rules
  bt: BTRules;

  // Obligation rules  
  obligations: ObligationRules;

  // Income add-back
  incomeAddBack: IncomeAddBack;

  // Restrictions
  restrictedProfiles: string[];

  // Special flags
  wfhAccepted: boolean;
  ownHouseRequired: boolean;
  metroOnly: boolean;
  geoLimitKm: number | null;
  digitalProcess: boolean;
  minAge: number;
  maxAgeAtMaturity: number;
  minExperienceMonths: number;

  // Location restriction warning
  locationWarning: string | null;
}

// ─── Default values ─────────────────────────────────────────────────────────

const DEFAULT_INCOME_ADD_BACK: IncomeAddBack = {
  rentalPercent: 0,
  monthlyIncentive: false,
  quarterlyIncentive: false,
  halfYearlyIncentive: false,
  monthlyBonus: false,
  quarterlyBonus: false,
  yearlyBonus: false,
  bonusAddBackPercent: 0,
  lta: false,
  variableIncome: false,
  pensionIncome: false,
};

const DEFAULT_OBLIGATIONS: ObligationRules = {
  ccObligationPercent: 5,
  goldLoanObligationPercent: 1,
};

// ─── Lender Configurations (from MD files) ──────────────────────────────────

const LENDERS: LenderConfig[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // AXIS BANK — Source: axis bank.md
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "axis",
    name: "Axis Bank",
    type: "Private Bank",
    headlineRate: 9.99,
    maxLoanAmount: 4000000,
    minLoanAmount: 100000,
    maxTenure: 84,
    maxFoir: 70,
    employerBankId: "axisBank",
    minSalary: 35000,  // CSG minimum; varies by segment
    minCibil: 700,     // Minimum across all segments
    cibilMinus1Accepted: false,
    cibilMinus1MaxFunding: 0,
    bt: {
      personalLoan: true,
      multiplePLs: true,
      maxPLBTs: null,        // "N number of BTs can do"
      creditCard: true,      // CC BT allowed
      maxCCBTs: null,
      appLoan: false,        // Not mentioned as eligible
      maxAppBTs: 0,
      overdraft: false,      // "Flexi OD BT cases not eligible"
      maxTotalBTs: null,
      topUp: true,
    },
    obligations: {
      ccObligationPercent: 4,     // 4% of CC O/S
      goldLoanObligationPercent: 0, // Nil obligation for Gold Loan
      plNonObligationIfEmisBelow: 6,  // PL <6 EMI remaining = non-obligation
      hlNonObligationIfEmisBelow: 12, // HL <12 EMI remaining = non-obligation
    },
    incomeAddBack: {
      ...DEFAULT_INCOME_ADD_BACK,
      quarterlyBonus: true,
      halfYearlyIncentive: true,
      yearlyBonus: true,
      bonusAddBackPercent: 50,
    },
    restrictedProfiles: [
      "Government School Teacher", "Class IV Employee",
      "Local Municipality Staff", "Defence & Army",
      "State Government Employee",
    ],
    wfhAccepted: false,
    ownHouseRequired: false,
    metroOnly: false,
    geoLimitKm: null,
    digitalProcess: false,
    minAge: 21,
    maxAgeAtMaturity: 60,
    minExperienceMonths: 0,
    locationWarning: null,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADITYA BIRLA CAPITAL — Source: aditya birla.md
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "abfl",
    name: "Aditya Birla Finance",
    type: "NBFC",
    headlineRate: 10.99,
    maxLoanAmount: 6500000,  // Up to ₹65L for Cat-A
    minLoanAmount: 100000,
    maxTenure: 84,
    maxFoir: 75,
    employerBankId: null,    // No specific Excel data
    minSalary: 20000,        // Tier 4 minimum
    minCibil: null,          // Scorecard based
    cibilMinus1Accepted: false,
    cibilMinus1MaxFunding: 0,
    bt: {
      personalLoan: true,
      multiplePLs: true,
      maxPLBTs: 6,           // Max 6 BTs (PL + CC combined)
      creditCard: true,
      maxCCBTs: 5,           // Max 5 CC-only BTs
      appLoan: false,        // Not clearly quantified
      maxAppBTs: 0,
      overdraft: true,       // OD BT, OD-to-OD BT available
      maxTotalBTs: 6,        // Max 6 total
      topUp: true,
    },
    obligations: {
      ...DEFAULT_OBLIGATIONS,
      ccObligationPercent: 5,
      goldLoanObligationPercent: 0,
    },
    incomeAddBack: {
      rentalPercent: 50,
      monthlyIncentive: true,
      quarterlyIncentive: true,
      halfYearlyIncentive: true,
      monthlyBonus: true,
      quarterlyBonus: true,
      yearlyBonus: true,
      bonusAddBackPercent: 100,
      lta: true,
      variableIncome: true,
      pensionIncome: false,
    },
    restrictedProfiles: [],
    wfhAccepted: false,
    ownHouseRequired: false,
    metroOnly: false,
    geoLimitKm: null,
    digitalProcess: true,
    minAge: 21,
    maxAgeAtMaturity: 60,
    minExperienceMonths: 0,
    locationWarning: null,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // L&T FINANCE — Source: L&T.md, l&t finance.md
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "ltfinance",
    name: "L&T Finance",
    type: "NBFC",
    headlineRate: 10.99,
    maxLoanAmount: 2000000,  // Up to ₹20L for highlighted offer
    minLoanAmount: 100000,
    maxTenure: 72,
    maxFoir: 75,
    employerBankId: "ltFinance",
    minSalary: 175000,       // ₹1.75L+ for highlighted offer
    minCibil: 775,           // 775 for highlighted offer
    cibilMinus1Accepted: true,
    cibilMinus1MaxFunding: 1000000, // Up to ₹10L
    bt: {
      personalLoan: true,
      multiplePLs: true,
      maxPLBTs: null,        // "Unlimited BT as per eligibility"
      creditCard: true,
      maxCCBTs: null,
      appLoan: true,
      maxAppBTs: 16,         // Up to 16 app loans
      overdraft: true,
      maxTotalBTs: null,     // Unlimited
      topUp: true,
      minActiveEMIs: 6,     // At least 6 EMIs must be active
      minExposure: 200000,   // Current exposure ≥ ₹2L
    },
    obligations: {
      ...DEFAULT_OBLIGATIONS,
      goldLoanObligationPercent: 0,
    },
    incomeAddBack: {
      rentalPercent: 100,
      monthlyIncentive: true,
      quarterlyIncentive: true,
      halfYearlyIncentive: false,
      monthlyBonus: true,
      quarterlyBonus: true,
      yearlyBonus: true,
      bonusAddBackPercent: 100,
      lta: false,
      variableIncome: false,
      pensionIncome: true,
    },
    restrictedProfiles: [],
    wfhAccepted: true,
    ownHouseRequired: true,  // "Owned residential property mandatory"
    metroOnly: true,         // "Metro Cities"
    geoLimitKm: null,
    digitalProcess: true,
    minAge: 21,
    maxAgeAtMaturity: 60,
    minExperienceMonths: 0,
    locationWarning: null,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KOTAK MAHINDRA BANK (OD Product) — Source: kotak bank.md
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "kotak",
    name: "Kotak Mahindra Bank",
    type: "Private Bank",
    headlineRate: 9.99,
    maxLoanAmount: 10000000,  // Up to ₹1Cr PL shown in poster
    minLoanAmount: 100000,
    maxTenure: 84,
    maxFoir: 70,
    employerBankId: "kotak",
    minSalary: 75000,         // Minimum based on Green Scorecard
    minCibil: null,           // Segment/policy based
    cibilMinus1Accepted: false,
    cibilMinus1MaxFunding: 0,
    bt: {
      personalLoan: true,
      multiplePLs: true,
      maxPLBTs: null,
      creditCard: false,      // Not mentioned
      maxCCBTs: 0,
      appLoan: false,
      maxAppBTs: 0,
      overdraft: true,
      maxTotalBTs: null,
      topUp: true,
    },
    obligations: DEFAULT_OBLIGATIONS,
    incomeAddBack: {
      ...DEFAULT_INCOME_ADD_BACK,
      // Variable income excluded per policy
    },
    restrictedProfiles: [],
    wfhAccepted: false,
    ownHouseRequired: false,
    metroOnly: false,
    geoLimitKm: null,
    digitalProcess: false,
    minAge: 21,
    maxAgeAtMaturity: 60,
    minExperienceMonths: 0,
    locationWarning: null,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHOLA — Source: chola.md (Delhi NCR specific)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "chola",
    name: "Chola",
    type: "NBFC",
    headlineRate: 13.50,
    maxLoanAmount: 3000000,
    minLoanAmount: 100000,
    maxTenure: 84,
    maxFoir: 70,               // Base; up to 60% income add-back
    employerBankId: null,      // No specific Excel data
    minSalary: 15000,
    minCibil: 700,             // 700 for Delhi location
    cibilMinus1Accepted: true,
    cibilMinus1MaxFunding: 2000000, // Govt: ₹20L, Cat A/B: ₹10L
    bt: {
      personalLoan: true,
      multiplePLs: true,
      maxPLBTs: 6,              // 6 tracks across PL/OD/DOD/CC
      creditCard: true,
      maxCCBTs: 6,              // CC OS up to 8× allowed for BT
      appLoan: false,
      maxAppBTs: 0,
      overdraft: false,
      maxTotalBTs: 6,           // 6 tracks total
      topUp: true,
    },
    obligations: {
      ccObligationPercent: 5,
      goldLoanObligationPercent: 0,  // Zero GL/KCC obligation
    },
    incomeAddBack: {
      rentalPercent: 100,       // Rental income considered (up to 60% total add-back)
      monthlyIncentive: true,
      quarterlyIncentive: true,
      halfYearlyIncentive: false,
      monthlyBonus: false,
      quarterlyBonus: false,
      yearlyBonus: false,
      bonusAddBackPercent: 0,
      lta: false,
      variableIncome: false,
      pensionIncome: false,
    },
    restrictedProfiles: [
      "Manpower", "Law", "Collection", "Court", "Police", "Belt Job",
    ],
    wfhAccepted: true,   // WFH docs not required per policy update
    ownHouseRequired: false,  // Required only for ₹30L cases
    metroOnly: false,
    geoLimitKm: null,
    digitalProcess: false,
    minAge: 21,
    maxAgeAtMaturity: 58,
    minExperienceMonths: 0,
    locationWarning: "⚠️ Chola policy data is specifically for Delhi NCR. Eligibility in other locations may differ.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INDUSIND BANK — Source: IndusInd_Bank_Personal_Loan_Policy.md
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "indusind",
    name: "IndusInd Bank",
    type: "Private Bank",
    headlineRate: 9.99,
    maxLoanAmount: 7500000,    // Up to ₹75L
    minLoanAmount: 500000,     // ₹5L min for 72 months
    maxTenure: 84,
    maxFoir: 75,
    employerBankId: "indusind",
    minSalary: 50000,           // ₹50K for 72 months, ₹1L for 84 months
    minCibil: 700,             // 700 for 72 months, 750 for 84 months
    cibilMinus1Accepted: true,
    cibilMinus1MaxFunding: 500000, // Up to ₹5L for 0 & -1 cases
    bt: {
      personalLoan: true,
      multiplePLs: true,
      maxPLBTs: 5,              // Max 5 PL BTs
      creditCard: false,        // Policy dependent
      maxCCBTs: 0,
      appLoan: true,            // App loans & fintech loans accepted
      maxAppBTs: null,
      overdraft: true,
      odBTRestrictions: ["Tata Capital", "Bajaj Finance", "Kotak", "ABFL", "Cholamandalam", "Axis Finance"],
      maxTotalBTs: 5,
      topUp: true,
    },
    obligations: DEFAULT_OBLIGATIONS,
    incomeAddBack: {
      ...DEFAULT_INCOME_ADD_BACK,
      variableIncome: true,     // Variable allowance considered (lowest 3-month avg)
    },
    restrictedProfiles: [],
    wfhAccepted: false,
    ownHouseRequired: false,
    metroOnly: false,
    geoLimitKm: null,
    digitalProcess: false,
    minAge: 25,
    maxAgeAtMaturity: 60,
    minExperienceMonths: 0,
    locationWarning: null,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PIRAMAL FINANCE — Source: priamal finance.md
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "piramal",
    name: "Piramal Finance",
    type: "NBFC",
    headlineRate: 11.99,
    maxLoanAmount: 3000000,    // ₹30L standard; ₹50L for Elite/Cat-A
    minLoanAmount: 100000,
    maxTenure: 72,
    maxFoir: 75,
    employerBankId: null,      // No specific Excel data
    minSalary: 25000,
    minCibil: 750,             // 750+ standard; -1/0 may be accepted
    cibilMinus1Accepted: true,
    cibilMinus1MaxFunding: 0,  // Subject to policy
    bt: {
      personalLoan: true,
      multiplePLs: true,
      maxPLBTs: 3,             // Max 3 PL BTs
      creditCard: true,
      maxCCBTs: 6,
      appLoan: true,
      maxAppBTs: 3,
      overdraft: false,
      maxTotalBTs: 8,          // Up to 8 total in debt consolidation poster
      topUp: true,
    },
    obligations: {
      ccObligationPercent: 5,
      goldLoanObligationPercent: 0,   // Gold loan not obligated
    },
    incomeAddBack: DEFAULT_INCOME_ADD_BACK,
    restrictedProfiles: [],
    wfhAccepted: true,
    ownHouseRequired: false,   // "No own house mandatory"
    metroOnly: false,
    geoLimitKm: null,
    digitalProcess: true,
    minAge: 21,
    maxAgeAtMaturity: 60,
    minExperienceMonths: 6,    // Min 6 months total experience
    locationWarning: null,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POONAWALLA FINCORP — Source: bank_comparison_credit_expert_india.md §9
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "poonawalla",
    name: "Poonawalla Fincorp",
    type: "NBFC",
    headlineRate: 11.99,
    maxLoanAmount: 6000000,    // Up to ₹60L
    minLoanAmount: 100000,
    maxTenure: 84,             // PL 84M; OD up to 96M
    maxFoir: 70,
    employerBankId: null,      // No specific Excel data
    minSalary: 30000,
    minCibil: 700,
    cibilMinus1Accepted: false,
    cibilMinus1MaxFunding: 0,
    bt: {
      personalLoan: true,
      multiplePLs: true,
      maxPLBTs: null,
      creditCard: true,
      maxCCBTs: null,
      appLoan: true,
      maxAppBTs: null,
      overdraft: true,
      maxTotalBTs: 8,          // Max 8 total
      topUp: true,
    },
    obligations: DEFAULT_OBLIGATIONS,
    incomeAddBack: DEFAULT_INCOME_ADD_BACK,
    restrictedProfiles: [],
    wfhAccepted: false,
    ownHouseRequired: false,   // "No own-house requirement"
    metroOnly: false,          // PAN India
    geoLimitKm: 80,            // 80km from municipal offices
    digitalProcess: true,
    minAge: 21,
    maxAgeAtMaturity: 60,
    minExperienceMonths: 0,
    locationWarning: "Applicant must be within 80 km of a municipal office.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TATA CAPITAL — Source: tata capital.md
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "tatacapital",
    name: "Tata Capital",
    type: "NBFC",
    headlineRate: 10.99,
    maxLoanAmount: 5000000,
    minLoanAmount: 100000,
    maxTenure: 84,
    maxFoir: 70,
    employerBankId: "tataCapital",
    minSalary: 20000,          // Will be updated when full policy is available
    minCibil: null,            // Will be updated when full policy is available
    cibilMinus1Accepted: false,
    cibilMinus1MaxFunding: 0,
    bt: {
      personalLoan: true,
      multiplePLs: true,
      maxPLBTs: null,
      creditCard: true,
      maxCCBTs: null,
      appLoan: true,           // "Subject to eligibility"
      maxAppBTs: null,
      overdraft: false,
      maxTotalBTs: null,
      topUp: true,
      minBTFinancedAmount: 500000, // BT loan amount must be > ₹5L
    },
    obligations: DEFAULT_OBLIGATIONS,
    incomeAddBack: DEFAULT_INCOME_ADD_BACK,
    restrictedProfiles: [],
    wfhAccepted: false,
    ownHouseRequired: false,
    metroOnly: false,
    geoLimitKm: null,
    digitalProcess: false,
    minAge: 21,
    maxAgeAtMaturity: 60,
    minExperienceMonths: 0,
    locationWarning: null,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AXIS FINANCE — Source: bank_comparison data (separate from Axis Bank)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "axisfinance",
    name: "Axis Finance",
    type: "NBFC",
    headlineRate: 12.00,
    maxLoanAmount: 5000000,
    minLoanAmount: 100000,
    maxTenure: 84,
    maxFoir: 70,
    employerBankId: "axisFinance",
    minSalary: 20000,
    minCibil: null,
    cibilMinus1Accepted: false,
    cibilMinus1MaxFunding: 0,
    bt: {
      personalLoan: true,
      multiplePLs: true,
      maxPLBTs: null,
      creditCard: true,
      maxCCBTs: null,
      appLoan: true,
      maxAppBTs: null,
      overdraft: false,
      maxTotalBTs: null,
      topUp: true,
    },
    obligations: DEFAULT_OBLIGATIONS,
    incomeAddBack: DEFAULT_INCOME_ADD_BACK,
    restrictedProfiles: [],
    wfhAccepted: false,
    ownHouseRequired: false,
    metroOnly: false,
    geoLimitKm: null,
    digitalProcess: false,
    minAge: 21,
    maxAgeAtMaturity: 60,
    minExperienceMonths: 0,
    locationWarning: null,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SMFG INDIA CREDIT COMPANY (formerly Fullerton) — Source: smfg.md
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "smfg",
    name: "SMFG India Credit (Fullerton)",
    type: "NBFC",
    headlineRate: 14.99,
    maxLoanAmount: 3000000,
    minLoanAmount: 100000,
    maxTenure: 60,
    maxFoir: 70, // Dynamic based on salary
    employerBankId: null,
    minSalary: 25001,
    minCibil: null,
    cibilMinus1Accepted: true,
    cibilMinus1MaxFunding: 3000000,
    bt: {
      personalLoan: true,
      multiplePLs: true,
      maxPLBTs: null,
      creditCard: true,
      maxCCBTs: 2,
      appLoan: false,
      maxAppBTs: 0,
      overdraft: true,
      maxTotalBTs: null,
      topUp: true,
    },
    obligations: DEFAULT_OBLIGATIONS,
    incomeAddBack: {
      ...DEFAULT_INCOME_ADD_BACK,
      monthlyIncentive: true,
      quarterlyIncentive: true,
      halfYearlyIncentive: true,
      pensionIncome: true,
    },
    restrictedProfiles: [],
    wfhAccepted: false,
    ownHouseRequired: false,
    metroOnly: false,
    geoLimitKm: null,
    digitalProcess: false,
    minAge: 21,
    maxAgeAtMaturity: 60,
    minExperienceMonths: 0,
    locationWarning: null,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ICICI BANK
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "icici",
    name: "ICICI Bank",
    type: "Private Bank",
    headlineRate: 9.99,
    maxLoanAmount: 5000000,
    minLoanAmount: 100000,
    maxTenure: 84,
    maxFoir: 70,
    employerBankId: "icici",
    minSalary: 30000,
    minCibil: 700,
    cibilMinus1Accepted: false,
    cibilMinus1MaxFunding: 0,
    bt: {
      personalLoan: true,
      multiplePLs: true,
      maxPLBTs: null,
      creditCard: false,
      maxCCBTs: 0,
      appLoan: false,
      maxAppBTs: 0,
      overdraft: true,
      maxTotalBTs: null,
      topUp: true,
    },
    obligations: DEFAULT_OBLIGATIONS,
    incomeAddBack: DEFAULT_INCOME_ADD_BACK,
    restrictedProfiles: [],
    wfhAccepted: false,
    ownHouseRequired: false,
    metroOnly: false,
    geoLimitKm: null,
    digitalProcess: false,
    minAge: 21,
    maxAgeAtMaturity: 60,
    minExperienceMonths: 0,
    locationWarning: null,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HDFC BANK
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "hdfc",
    name: "HDFC Bank",
    type: "Private Bank",
    headlineRate: 9.99,
    maxLoanAmount: 5000000,
    minLoanAmount: 100000,
    maxTenure: 84,
    maxFoir: 70,
    employerBankId: "hdfc",
    minSalary: 30000,
    minCibil: 700,
    cibilMinus1Accepted: false,
    cibilMinus1MaxFunding: 0,
    bt: {
      personalLoan: true,
      multiplePLs: true,
      maxPLBTs: null,
      creditCard: false,
      maxCCBTs: 0,
      appLoan: false,
      maxAppBTs: 0,
      overdraft: true,
      maxTotalBTs: null,
      topUp: true,
    },
    obligations: DEFAULT_OBLIGATIONS,
    incomeAddBack: DEFAULT_INCOME_ADD_BACK,
    restrictedProfiles: [],
    wfhAccepted: false,
    ownHouseRequired: false,
    metroOnly: false,
    geoLimitKm: null,
    digitalProcess: false,
    minAge: 21,
    maxAgeAtMaturity: 60,
    minExperienceMonths: 0,
    locationWarning: null,
  },
];



// ─── Obligation Calculator ──────────────────────────────────────────────────

/**
 * Calculate the effective EMI obligation for a loan based on lender-specific rules.
 */
function calculateObligation(
  loan: any,
  lender: LenderConfig
): number {
  const type = loan.type || "";
  const emi = Number(loan.emi || 0);
  const outstanding = Number(loan.currentOutstanding || 0);
  const remainingEmis = Number(loan.emisRemaining || loan.tenure || 0);

  // Credit Card: use bank-specific CC obligation %
  if (type === "Credit Card") {
    return outstanding * (lender.obligations.ccObligationPercent / 100);
  }

  // Gold Loan: use bank-specific GL obligation %
  if (type === "Gold Loan") {
    return outstanding * (lender.obligations.goldLoanObligationPercent / 100);
  }

  // PL non-obligation rule (Axis: PL <6 EMI remaining = 0)
  if (type === "Personal Loan" && lender.obligations.plNonObligationIfEmisBelow) {
    if (remainingEmis > 0 && remainingEmis < lender.obligations.plNonObligationIfEmisBelow) {
      return 0;
    }
  }

  // HL non-obligation rule (Axis: HL <12 EMI remaining = 0)
  if (type === "Home Loan" && lender.obligations.hlNonObligationIfEmisBelow) {
    if (remainingEmis > 0 && remainingEmis < lender.obligations.hlNonObligationIfEmisBelow) {
      return 0;
    }
  }

  return emi;
}

// ─── Income Calculator ──────────────────────────────────────────────────────

/**
 * Calculate effective NTH (Net Take-Home) for a lender including add-backs.
 */
function calculateEffectiveNTH(
  lender: LenderConfig,
  profile: any
): number {
  let nth = Number(profile.netSalary) || 0;
  const addBack = lender.incomeAddBack;

  if (addBack.rentalPercent > 0 && profile.rentalIncome) {
    nth += Number(profile.rentalIncome) * (addBack.rentalPercent / 100);
  }

  if (addBack.monthlyIncentive && profile.monthlyIncentive) {
    nth += Number(profile.monthlyIncentive);
  }
  if (addBack.quarterlyIncentive && profile.quarterlyIncentive) {
    nth += Number(profile.quarterlyIncentive) / 3;
  }
  if (addBack.halfYearlyIncentive && profile.halfYearlyIncentive) {
    nth += Number(profile.halfYearlyIncentive) / 6;
  }

  const bonusMultiplier = addBack.bonusAddBackPercent / 100;
  if (addBack.monthlyBonus && profile.monthlyBonus) {
    nth += Number(profile.monthlyBonus) * bonusMultiplier;
  }
  if (addBack.quarterlyBonus && profile.quarterlyBonus) {
    nth += (Number(profile.quarterlyBonus) / 3) * bonusMultiplier;
  }
  if (addBack.yearlyBonus && profile.yearlyBonus) {
    nth += (Number(profile.yearlyBonus) / 12) * bonusMultiplier;
  }

  if (addBack.lta && profile.lta) {
    nth += Number(profile.lta) / 12;
  }

  if (addBack.variableIncome && profile.variableIncome) {
    nth += Number(profile.variableIncome);
  }

  if (addBack.pensionIncome && profile.pensionIncome) {
    nth += Number(profile.pensionIncome);
  }

  return nth;
}

// ─── Eligibility Engine ─────────────────────────────────────────────────────

export function analyzeLenderEligibility({
  profile,
  catBLoans,
  allLoans = [],
}: {
  profile: any;
  catBLoans: any[];
  allLoans?: any[];
}) {
  const companyName = profile.employer || "";
  const cibilScore = Number(profile.cibilScore) || 0;
  const age = Number(profile.age) || 0;

  const eligibleLenders: any[] = [];
  const ineligibleLenders: any[] = [];

  // Pre-count loan types in catBLoans
  const plCount = catBLoans.filter((l: any) => l.type === "Personal Loan").length;
  const ccCount = catBLoans.filter((l: any) => l.type === "Credit Card").length;
  const appLoans = catBLoans.filter((l: any) => l.type === "App Loan");
  const appCount = appLoans.length;
  const odLoans = catBLoans.filter((l: any) => l.type === "Overdraft");
  const odCount = odLoans.length;
  const totalBTCount = catBLoans.length;

  for (const lender of LENDERS) {
    let isEligible = true;
    let matchScore = 100;
    const rejectionReasons: string[] = [];
    const warnings: string[] = [];
    const customOutput: any = {};

    // ─── Get employer tier for this specific lender ─────────────────────
    const employerTier = profile.employerTier || "Unknown";
    customOutput.employerTier = employerTier;
    customOutput.employerCategory = employerTier;

    // ─── Calculate effective NTH ────────────────────────────────────────
    const nth = calculateEffectiveNTH(lender, profile);
    customOutput.effectiveNTH = Math.floor(nth);

    // ─── Global FOIR Logic ──────────────────────────────────────────────
    const hasRunningHL = allLoans.some((l: any) => l.type === "Home Loan" && Number(l.currentOutstanding || 0) > 0);
    const effectiveMaxFoir = hasRunningHL ? Math.max(70, lender.maxFoir) : 70;
    customOutput.maxFOIR = `${effectiveMaxFoir}%`;

    // ─── Location warning ──────────────────────────────────────────────
    if (lender.locationWarning) {
      warnings.push(lender.locationWarning);
    }

    // ═════════════════════════════════════════════════════════════════════
    // HARD KNOCKOUT CHECKS
    // ═════════════════════════════════════════════════════════════════════

    // 1. Minimum salary
    if (nth < lender.minSalary) {
      isEligible = false;
      rejectionReasons.push(`Requires minimum salary of ₹${lender.minSalary.toLocaleString("en-IN")}`);
    }

    // 2. Employer rejection
    if (employerTier === "REJECTED") {
      isEligible = false;
      rejectionReasons.push("Company is categorized as delisted/rejected by this lender");
    }

    // 3. CIBIL check
    if (lender.minCibil && cibilScore > 0 && cibilScore < lender.minCibil) {
      // Check if CIBIL -1 is accepted
      if (cibilScore === -1 && lender.cibilMinus1Accepted) {
        // Acceptable but with funding limit
        if (lender.cibilMinus1MaxFunding > 0) {
          warnings.push(`CIBIL -1: Max funding ₹${(lender.cibilMinus1MaxFunding / 100000).toFixed(0)}L`);
          customOutput.cibilMinus1MaxFunding = lender.cibilMinus1MaxFunding;
        }
      } else {
        isEligible = false;
        rejectionReasons.push(`Requires minimum CIBIL score of ${lender.minCibil}`);
      }
    }

    // 4. Active overdue
    if (profile.hasActiveOverdue === "yes") {
      isEligible = false;
      rejectionReasons.push("Active overdue accounts detected");
    }

    // 5. Metro-only check
    if (lender.metroOnly && profile.cityTier !== "Metro") {
      isEligible = false;
      rejectionReasons.push("Only available in Metro cities");
    }

    // 6. Own house required
    if (lender.ownHouseRequired && profile.residenceType !== "Owned") {
      isEligible = false;
      rejectionReasons.push("Owned residential property is mandatory");
    }

    // 7. Restricted profiles
    if (lender.restrictedProfiles.length > 0 && profile.jobProfile) {
      let isRestricted = lender.restrictedProfiles.some(
        (p) => profile.jobProfile.toLowerCase().includes(p.toLowerCase())
      );

      // --- Lender Specific Restricted Profile Bypasses ---
      if (isRestricted && lender.id === "axis") {
        // Special September 2026 State Police Offer bypass for specific states
        const jobLower = profile.jobProfile.toLowerCase();
        if (jobLower.includes("police") || jobLower.includes("state government")) {
          const state = (profile.state || "").toLowerCase();
          if (["maharashtra", "karnataka", "tamil nadu", "andhra pradesh"].some(s => state.includes(s))) {
            isRestricted = false;
          }
        }
      }

      if (isRestricted) {
        isEligible = false;
        rejectionReasons.push(`Profile "${profile.jobProfile}" is restricted`);
      }
    }

    // 8. Bounce / late payment
    if (
      (profile.hasBounce === "yes" || profile.hasLatePayment === "yes")
    ) {
      matchScore -= 15;
      warnings.push("Recent EMI bounce/late payment may affect approval");
    }

    // ═════════════════════════════════════════════════════════════════════
    // BT COMPATIBILITY CHECKS
    // ═════════════════════════════════════════════════════════════════════

    // BT minimum financed amount (e.g., Tata Capital > ₹5L)
    if (lender.bt.minBTFinancedAmount && catBLoans.length > 0) {
      const totalBTAmount = catBLoans.reduce(
        (sum: number, l: any) => sum + Number(l.currentOutstanding || 0), 0
      );
      if (totalBTAmount > 0 && totalBTAmount < lender.bt.minBTFinancedAmount) {
        isEligible = false;
        rejectionReasons.push(
          `BT amount must be > ₹${(lender.bt.minBTFinancedAmount / 100000).toFixed(0)} Lakh`
        );
      }
    }

    // PL BT check
    if (plCount > 0 && !lender.bt.personalLoan) {
      isEligible = false;
      rejectionReasons.push("Does not support Personal Loan BT");
    }

    // Multiple PL check
    if (plCount > 1) {
      if (!lender.bt.multiplePLs) {
        isEligible = false;
        rejectionReasons.push("Does not consolidate multiple Personal Loans");
      }
      if (lender.bt.maxPLBTs && plCount > lender.bt.maxPLBTs) {
        isEligible = false;
        rejectionReasons.push(
          `Maximum ${lender.bt.maxPLBTs} Personal Loan BTs allowed`
        );
      }
    }

    // CC BT check
    if (ccCount > 0) {
      if (!lender.bt.creditCard) {
        isEligible = false;
        rejectionReasons.push("Does not support Credit Card BT");
      }
      if (lender.bt.maxCCBTs !== null && ccCount > lender.bt.maxCCBTs) {
        isEligible = false;
        rejectionReasons.push(
          `Maximum ${lender.bt.maxCCBTs} Credit Card BTs allowed`
        );
      }
    }

    // App Loan BT check
    if (appCount > 0) {
      if (!lender.bt.appLoan) {
        isEligible = false;
        rejectionReasons.push("Does not support App/Fintech Loan BT");
      }
      if (lender.bt.maxAppBTs !== null && appCount > lender.bt.maxAppBTs) {
        isEligible = false;
        rejectionReasons.push(
          `Maximum ${lender.bt.maxAppBTs} App Loan BTs allowed`
        );
      }
      // L&T specific: app loans need >= 6 active EMIs and >= ₹2L exposure
      if (lender.bt.minActiveEMIs || lender.bt.minExposure) {
        const invalidApps = appLoans.filter((l: any) => {
          const emis = Number(l.activeEMIs || l.emisRemaining || 0);
          const exposure = Number(l.currentOutstanding || 0);
          return (
            (lender.bt.minActiveEMIs && emis < lender.bt.minActiveEMIs) ||
            (lender.bt.minExposure && exposure < lender.bt.minExposure)
          );
        });
        if (invalidApps.length > 0) {
          isEligible = false;
          rejectionReasons.push(
            `Requires App Loans to have ≥ ${lender.bt.minActiveEMIs || 0} active EMIs and ≥ ₹${((lender.bt.minExposure || 0) / 100000).toFixed(0)}L exposure`
          );
        }
      }
    }

    // OD BT check
    if (odCount > 0) {
      if (!lender.bt.overdraft) {
        isEligible = false;
        rejectionReasons.push("Does not support Overdraft BT");
      }
      // IndusInd: OD BT only for specific banks
      if (lender.bt.odBTRestrictions && lender.bt.odBTRestrictions.length > 0) {
        const invalidODs = odLoans.filter((l: any) => {
          const bankName = (l.bankName || "").toLowerCase();
          return !lender.bt.odBTRestrictions!.some(
            (r) => bankName.includes(r.toLowerCase())
          );
        });
        if (invalidODs.length > 0) {
          isEligible = false;
          rejectionReasons.push(
            `OD BT only allowed from: ${lender.bt.odBTRestrictions.join(", ")}`
          );
        }
      }
    }

    // Total BT count check
    if (lender.bt.maxTotalBTs && totalBTCount > lender.bt.maxTotalBTs) {
      isEligible = false;
      rejectionReasons.push(
        `Maximum ${lender.bt.maxTotalBTs} total BTs allowed`
      );
    }

    // Top-up check
    if (profile.wantsTopUp === "yes" && !lender.bt.topUp) {
      isEligible = false;
      rejectionReasons.push("Does not offer top-up on transfers");
    }

    // BT / Loan Preference check
    if (profile.btPreference === "BT to OD") {
      // Currently Kotak, Chola, and IndusInd have specific OD/Flexi rules configured
      if (!["kotak", "chola", "indusind"].includes(lender.id)) {
        isEligible = false;
        rejectionReasons.push("Overdraft facility not supported by this policy");
      }
    } else if (profile.btPreference === "BT to PL") {
      // Kotak's configuration here is strictly OD
      if (lender.id === "kotak") {
        isEligible = false;
        rejectionReasons.push("This specific policy is structured for Overdrafts only");
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // BANK-SPECIFIC RULES
    // ═════════════════════════════════════════════════════════════════════

    // ── AXIS BANK specific ──────────────────────────────────────────────
    if (lender.id === "axis" && isEligible) {
      const allowedAxisTiers = ["A+", "A", "B", "C", "GOVT"];
      if (!allowedAxisTiers.includes(employerTier)) {
        isEligible = false;
        rejectionReasons.push(`Employer category '${employerTier}' is not eligible (Only A+, A, B, C, and Govt allowed)`);
      }

      const seg = profile.axisCustomerSegment || "NTB";
      let nmiReq = 75000;
      let cibilReq = 780;

      if (seg === "CSG") {
        nmiReq = 35000;
        cibilReq = nth > 85000 ? 700 : 740;
      } else if (seg === "Non-CSG CASA") {
        nmiReq = 50000;
        cibilReq = 740;
        if (profile.casaVintage !== "yes") {
          isEligible = false;
          rejectionReasons.push("Axis Bank requires 90+ days CASA vintage for Non-CSG CASA segment");
        }
      } else if (seg === "NTB") {
        nmiReq = 75000;
        cibilReq = nth > 100000 ? 740 : 780;
      } else if (seg === "Blue Collar") {
        nmiReq = 200000;
        cibilReq = 0;
      }

      if (nth < nmiReq) {
        isEligible = false;
        rejectionReasons.push(
          `Requires minimum ₹${nmiReq.toLocaleString("en-IN")} NTH for ${seg} segment`
        );
      }
      if (cibilReq > 0 && cibilScore > 0 && cibilScore < cibilReq) {
        isEligible = false;
        rejectionReasons.push(
          `Requires CIBIL ≥ ${cibilReq} for ${seg} segment`
        );
      }

      customOutput.axisSegment = seg;
      customOutput.axisCibilRequired = cibilReq;

      // Calculate obligations using Axis-specific rules
      if (isEligible) {
        let totalAxisObligation = 0;
        allLoans.forEach((l: any) => {
          totalAxisObligation += calculateObligation(l, lender);
        });

        const maxEmi = nth * (effectiveMaxFoir / 100);
        customOutput.axisMaxEmiCapacity = Math.floor(maxEmi);
        customOutput.axisTotalObligations = Math.floor(totalAxisObligation);
        customOutput.axisUnusedCapacity = Math.max(0, Math.floor(maxEmi - totalAxisObligation));

        if (customOutput.axisUnusedCapacity > 0) {
          const r = lender.headlineRate / 12 / 100;
          const n = lender.maxTenure;
          customOutput.axisMaxLoan = Math.floor(
            (customOutput.axisUnusedCapacity * (Math.pow(1 + r, n) - 1)) /
            (r * Math.pow(1 + r, n))
          );
        } else {
          customOutput.axisMaxLoan = 0;
        }

        // --- Axis Bank September Special Offers 2026 ---
        const specialOffers = [];
        const isCibil750 = cibilScore >= 750;
        
        if (employerTier === "GOVT" && nth >= 50000 && isCibil750) {
          specialOffers.push("Govt Employee Offer (ROI 10.90%, PF ₹4,999)");
        }
        
        if (seg === "CSG" && ["A+", "A", "B", "C", "GOVT"].includes(employerTier)) {
          if (isCibil750) {
            specialOffers.push("Select Corporates Offer (ROI 10.29%-11.99%, PF ₹2,999+GST)");
          } else if (cibilScore > 0) {
            specialOffers.push("Select Corporates Offer (1% higher ROI for CIBIL < 750)");
          }
        }
        
        if (profile.jobProfile && profile.jobProfile.toLowerCase().includes("police")) {
          const state = (profile.state || "").toLowerCase();
          if (["maharashtra", "karnataka", "tamil nadu", "andhra pradesh"].some(s => state.includes(s))) {
             if (isCibil750) {
               specialOffers.push("State Police Offer (ROI 10.49%-11.49%, PF ₹999)");
             } else if (cibilScore > 0) {
               specialOffers.push("State Police Offer (1% higher ROI for CIBIL < 750)");
             }
          }
        }

        if (isCibil750 && seg !== "Blue Collar" && specialOffers.length === 0) {
          specialOffers.push("September Special Offer (ROI from 9.99%)");
        }

        if (specialOffers.length > 0) {
          customOutput.axisSpecialOffers = specialOffers;
          warnings.push(`Special Offers Available: ${specialOffers.join(" | ")}`);
        }
      }
    }

    // ── ADITYA BIRLA specific ───────────────────────────────────────────
    if (lender.id === "abfl" && isEligible) {
      // Salary tier check
      // Tier 1: ₹40K, Tier 2: ₹35K, Tier 3: ₹25K, Tier 4: ₹20K
      // Max loan by company category
      let maxLoanForCategory = 5000000;
      if (employerTier === "A+" || employerTier === "A") {
        if (nth >= 250000) maxLoanForCategory = 6500000;
        else if (nth >= 175000) maxLoanForCategory = 5000000;
        else maxLoanForCategory = 4000000;
      } else if (employerTier === "B") {
        maxLoanForCategory = 4000000;
      } else if (employerTier === "C") {
        maxLoanForCategory = 3500000;
      } else if (employerTier === "D") {
        maxLoanForCategory = 2500000;
      }
      customOutput.abflMaxLoan = maxLoanForCategory;

      // FI waiver check
      if (profile.hasEPFO || profile.hasOMID || profile.hasHRMS || profile.has26AS) {
        customOutput.fiWaiver = true;
      }

      // BT count check
      const totalPLCCBT = plCount + ccCount;
      if (totalPLCCBT > 6) {
        isEligible = false;
        rejectionReasons.push("Maximum 6 BTs (PL + CC) allowed");
      }
      if (ccCount > 5) {
        isEligible = false;
        rejectionReasons.push("Maximum 5 Credit Card BTs allowed");
      }
    }

    // ── L&T FINANCE specific ────────────────────────────────────────────
    if (lender.id === "ltfinance" && isEligible) {
      customOutput.fiWaiverThreshold = 750000;
      if (cibilScore === -1 || cibilScore === 0) {
        customOutput.cibilMinus1MaxLoan = 1000000;
      }
    }

    // ── KOTAK specific ──────────────────────────────────────────────────
    if (lender.id === "kotak" && isEligible) {
      // Exclude variable income from NTH for Kotak
      const kotakNth = (Number(profile.netSalary) || 0) -
        (profile.yearlyBonus ? Number(profile.yearlyBonus) / 12 : 0);

      const scorecard = (profile.kotakScorecard || "").toLowerCase();
      
      // Employer Category check
      if (employerTier === "C") {
         const isItCompany = profile.industry === "IT" || profile.industry === "Information Technology" || (profile.employer || "").toLowerCase().includes("it");
         if (!isItCompany) {
            isEligible = false;
            rejectionReasons.push("Cat C employer must be an IT company for Kotak OD");
         }
         if (kotakNth < 100000) {
            isEligible = false;
            rejectionReasons.push("Cat C (IT) requires minimum ₹1 Lakh+ NTH");
         }
         if (scorecard && scorecard !== "green") {
            isEligible = false;
            rejectionReasons.push("Cat C (IT) requires a 'Green' credit score");
         } else if (!scorecard) {
            warnings.push("Cat C (IT) requires a 'Green' credit score.");
         }
      } else if (!["A+", "A", "B", "GOVT"].includes(employerTier)) {
         isEligible = false;
         rejectionReasons.push(`Employer category '${employerTier}' is not eligible for Kotak OD. Allowed: Cat A, B, Govt, or Cat C (IT).`);
      }
      
      // Salary & Scorecard logic for general (Cat A, B, Govt)
      if (isEligible && ["A+", "A", "B", "GOVT"].includes(employerTier)) {
         let minRequiredNth = 100000; // Default to Yellow requirement
         if (scorecard === "green") minRequiredNth = 75000;
         
         if (kotakNth < minRequiredNth) {
           if (kotakNth >= 75000 && !scorecard) {
             warnings.push("Kotak OD requires a 'Green' credit score for salaries between ₹75K and ₹1L.");
           } else {
             isEligible = false;
             rejectionReasons.push(
               `Requires minimum ₹${(minRequiredNth / 1000).toFixed(0)}K NTH (excluding variable income) based on scorecard`
             );
           }
         }
      }
      
      // Tenure output
      customOutput.kotakOdTenure = "2+5 years or 2+6 years";
      
      customOutput.kotakEffectiveNTH = Math.floor(kotakNth);
    }

    // ── CHOLA specific ──────────────────────────────────────────────────
    if (lender.id === "chola" && isEligible) {
      // Delhi location CIBIL requirement
      if (profile.location === "Delhi NCR" && cibilScore > 0 && cibilScore < 700) {
        isEligible = false;
        rejectionReasons.push("Delhi NCR requires minimum CIBIL of 700");
      }

      // Flexi OD eligibility
      if (
        (employerTier === "GOVT" && nth >= 100000) ||
        (["A+", "A", "B"].includes(employerTier) && nth >= 150000)
      ) {
        customOutput.flexiOdEligible = true;
        customOutput.flexiOdStructure = "2 years Flexi + 5 years Drop-line";
      }

      // CIBIL -1 handling
      if (cibilScore === -1 || cibilScore === 0) {
        if (employerTier === "GOVT") {
          customOutput.cibilMinus1MaxLoan = 2000000;
        } else if (["A+", "A", "B"].includes(employerTier) && profile.coApplicant && age <= 30) {
          customOutput.cibilMinus1MaxLoan = 1000000;
        } else {
          isEligible = false;
          rejectionReasons.push("Does not meet CIBIL -1 criteria for Chola");
        }
      }

      // Income add-back capped at 60%
      const addBack = (Number(profile.monthlyIncentive) || 0) +
        (Number(profile.quarterlyIncentive) || 0) / 3 +
        (Number(profile.rentalIncome) || 0);
      const maxAddBack = (Number(profile.netSalary) || 0) * 0.60;
      const effectiveAddBack = Math.min(addBack, maxAddBack);
      const cholaEffectiveNTH = (Number(profile.netSalary) || 0) + effectiveAddBack;
      customOutput.cholaEffectiveNTH = Math.floor(cholaEffectiveNTH);

      // Max loan by category
      if (["A+", "A", "B"].includes(employerTier)) {
        customOutput.cholaMaxLoan = cholaEffectiveNTH >= 125000 ? 3000000 : 1000000;
      } else if (employerTier === "GOVT") {
        customOutput.cholaMaxLoan = cholaEffectiveNTH >= 100000 ? 3000000 : 1000000;
      } else {
        customOutput.cholaMaxLoan = 1000000;
      }

      // BT tracks
      if (totalBTCount > 6) {
        isEligible = false;
        rejectionReasons.push("Maximum 6 BT tracks allowed (PL/OD/DOD/CC)");
      }
    }

    // ── INDUSIND specific ───────────────────────────────────────────────
    if (lender.id === "indusind" && isEligible) {
      // Loan amount by category
      if (employerTier === "C") {
        customOutput.indusindMaxLoan = 1000000; // CAT C Non-Listed: ₹10L
      } else {
        customOutput.indusindMaxLoan = 7500000; // CAT A/B/G: ₹75L
      }

      // Income Multiplier
      let multiplier = 21;
      if (nth >= 125000) {
        if (["A+", "A", "GOVT"].includes(employerTier)) multiplier = 30;
        else if (employerTier === "B") multiplier = 25;
      } else if (nth >= 75000) {
        if (["A+", "A", "B", "GOVT"].includes(employerTier)) multiplier = 25;
      }
      const maxLoanFromMultiplier = nth * multiplier;
      customOutput.indusindMaxLoan = Math.min(customOutput.indusindMaxLoan, maxLoanFromMultiplier);

      // Tenure rules
      let allowedTenure = 60;
      if (nth >= 50000 && (age >= 25 || !age)) {
        allowedTenure = 72;
      }
      // 84M requires: NMI ≥₹1L, Cat A+, A, B, Govt, age ≥25, CIBIL ≥750
      if (nth >= 100000 && ["A+", "A", "B", "GOVT"].includes(employerTier) &&
        (age >= 25 || !age) && cibilScore >= 750) {
        allowedTenure = 84;
      }
      customOutput.indusindMaxTenure = allowedTenure;

      // Calculate capacity
      let totalEmi = 0;
      allLoans.forEach((l: any) => {
        totalEmi += Number(l.emi || 0);
      });
      const maxEmi = nth * (effectiveMaxFoir / 100);
      const unusedCap = Math.max(0, maxEmi - totalEmi);
      customOutput.indusindUnusedCapacity = Math.floor(unusedCap);

      if (unusedCap > 0) {
        // FOIR Calculation @ 72 months for 84 month policies too
        const calcTenure = Math.min(allowedTenure, 72);
        const r = lender.headlineRate / 12 / 100;
        customOutput.indusindMaxLoanFromCapacity = Math.floor(
          (unusedCap * (Math.pow(1 + r, calcTenure) - 1)) /
          (r * Math.pow(1 + r, calcTenure))
        );
      } else {
        customOutput.indusindMaxLoanFromCapacity = 0;
      }
    }

    // ── PIRAMAL specific ────────────────────────────────────────────────
    if (lender.id === "piramal" && isEligible) {
      // Elite/Cat-A offer: up to ₹50L with CIBIL 750+, salary ₹2L+
      if (["A+", "A"].includes(employerTier) && nth >= 200000 && cibilScore >= 750) {
        customOutput.piramalMaxLoan = 5000000;
        customOutput.eliteEligible = true;
      } else {
        customOutput.piramalMaxLoan = 3000000;
      }
    }

    // ── POONAWALLA specific ─────────────────────────────────────────────
    if (lender.id === "poonawalla" && isEligible) {
      // Validate specific BT counts
      const plCount = catBLoans.filter((l: any) => l.type === "Personal Loan").length;
      const odCount = catBLoans.filter((l: any) => l.type === "Overdraft").length;

      if (odCount > 0) {
        if (odCount > 1) {
          isEligible = false;
          rejectionReasons.push("Maximum 1 Overdraft BT allowed in OD combination");
        }
        if (plCount > 2) {
          isEligible = false;
          rejectionReasons.push("Maximum 2 Personal Loan BTs allowed in OD combination");
        }
        if (totalBTCount > 3) {
          isEligible = false;
          rejectionReasons.push("Maximum 3 total BTs allowed in OD combination");
        }
      } else {
        if (totalBTCount > 8) {
          isEligible = false;
          rejectionReasons.push("Maximum 8 total BTs allowed");
        }
      }

      // FOIR & capacity
      let totalEmi = 0;
      allLoans.forEach((l: any) => {
        totalEmi += Number(l.emi || 0);
      });
      const maxEmi = nth * (effectiveMaxFoir / 100);
      const unusedCap = Math.max(0, maxEmi - totalEmi);
      customOutput.poonawallaUnusedCapacity = Math.floor(unusedCap);

      if (unusedCap > 0) {
        const r = lender.headlineRate / 12 / 100;
        customOutput.poonawallaMaxLoan = Math.floor(
          (unusedCap * (Math.pow(1 + r, lender.maxTenure) - 1)) /
          (r * Math.pow(1 + r, lender.maxTenure))
        );
      } else {
        customOutput.poonawallaMaxLoan = 0;
      }

      // Geo limit warning
      if (isEligible) {
        warnings.push("Applicant must be within 80 km of a municipal office");
      }
    }

    // ── TATA CAPITAL specific ───────────────────────────────────────────
    if (lender.id === "tatacapital" && isEligible) {
      // Already handled by minBTFinancedAmount in BT checks above
    }

    // ── SMFG specific ───────────────────────────────────────────────────
    if (lender.id === "smfg" && isEligible) {
    }

    // ═════════════════════════════════════════════════════════════════════
    // UNIVERSAL CAPACITY CALCULATION
    // ═════════════════════════════════════════════════════════════════════
    if (isEligible) {
      const foir = effectiveMaxFoir;

      const maxEmiCapacity = nth * (foir / 100);

      let totalObligations = 0;
      allLoans.forEach((l: any) => {
        totalObligations += calculateObligation(l, lender);
      });

      const unusedCapacity = Math.max(0, maxEmiCapacity - totalObligations);

      let maxLoan = 0;
      if (unusedCapacity > 0) {
        const r = lender.headlineRate / 12 / 100;
        const n = customOutput.indusindMaxTenure || lender.maxTenure;
        maxLoan = (unusedCapacity * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n));
      }

      customOutput.universalMaxEmi = Math.floor(maxEmiCapacity);
      customOutput.universalUsedEmi = Math.floor(totalObligations);
      customOutput.universalUnusedEmi = Math.floor(unusedCapacity);

      customOutput.universalMaxLoan = Math.floor(maxLoan);

      // Override with bank specific if available
      if (lender.id === 'axis' && customOutput.axisMaxLoan !== undefined) customOutput.universalMaxLoan = customOutput.axisMaxLoan;
      if (lender.id === 'abfl' && customOutput.abflMaxLoan !== undefined) customOutput.universalMaxLoan = customOutput.abflMaxLoan;
      if (lender.id === 'chola' && customOutput.cholaMaxLoan !== undefined) customOutput.universalMaxLoan = customOutput.cholaMaxLoan;
      if (lender.id === 'indusind' && customOutput.indusindMaxLoan !== undefined) customOutput.universalMaxLoan = customOutput.indusindMaxLoan;
      if (lender.id === 'poonawalla' && customOutput.poonawallaMaxLoan !== undefined) customOutput.universalMaxLoan = customOutput.poonawallaMaxLoan;
      if (customOutput.cibilMinus1MaxLoan !== undefined) customOutput.universalMaxLoan = customOutput.cibilMinus1MaxLoan;

      // Apply cap
      if (customOutput.universalMaxLoan > lender.maxLoanAmount) {
        customOutput.universalMaxLoan = lender.maxLoanAmount;
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // EMPLOYER TIER SCORING
    // ═════════════════════════════════════════════════════════════════════
    if (employerTier === "A+" || employerTier === "A") {
      matchScore += 5;
    } else if (employerTier === "GOVT") {
      matchScore += 3;
    } else if (employerTier === "B") {
      matchScore += 0;
    } else if (employerTier === "C" || employerTier === "D") {
      matchScore -= 5;
    } else if (employerTier === "Unknown") {
      matchScore -= 10;
    }

    // ═════════════════════════════════════════════════════════════════════
    // FINAL RESULT
    // ═════════════════════════════════════════════════════════════════════
    if (isEligible) {
      eligibleLenders.push({
        id: lender.id,
        name: lender.name,
        type: lender.type,
        headlineRate: lender.headlineRate,
        maxTenure: customOutput.indusindMaxTenure || lender.maxTenure,
        maxLoanAmount: lender.maxLoanAmount,
        maxFoir: effectiveMaxFoir,
        ...customOutput,
        warnings,
        matchConfidence: matchScore,
        outcome: matchScore >= 80 ? "ELIGIBLE" : "CONDITIONALLY_ELIGIBLE",
      });
    } else {
      ineligibleLenders.push({
        id: lender.id,
        name: lender.name,
        type: lender.type,
        headlineRate: lender.headlineRate,
        reasons: rejectionReasons,
        warnings,
      });
    }
  }

  // Sort: highest confidence first, then lowest rate
  eligibleLenders.sort((a, b) => {
    if (b.matchConfidence !== a.matchConfidence) {
      return b.matchConfidence - a.matchConfidence;
    }
    return a.headlineRate - b.headlineRate;
  });

  return { eligibleLenders, ineligibleLenders };
}

// Re-export for backward compatibility

