/* eslint-disable @typescript-eslint/no-explicit-any -- profile and loan inputs are loosely typed */
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
  kccObligationPercent?: number;    // KCC: % of outstanding (undefined = full EMI)
  plNonObligationIfEmisBelow?: number;  // PL is non-obligation if remaining EMIs < this
  hlNonObligationIfEmisBelow?: number;  // HL is non-obligation if remaining EMIs < this
  // Pending-EMI waivers for EMI loans. The first entry whose minTenure <= the loan's
  // total tenure applies: if the EMIs still pending are <= maxEmisLeft, the loan is not obligated.
  // (Chola: tenure > 18 → last 6 EMIs ignored; tenure = 18 → last 3 EMIs ignored)
  pendingEmiWaivers?: { minTenure: number; maxEmisLeft: number }[];
  cdNonObligationIfTenureAtMost?: number;    // Consumer durable loans with tenure <= N months not obligated
  ccNonObligationUpToSalaryMultiple?: number; // total CC O/S <= N × salary → CC not obligated at all
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
  govtMaxAgeAtMaturity?: number;   // Govt employees: retirement age applies instead of maxAgeAtMaturity
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
    minSalary: 0,            // Removed: no minimum salary gate (was ₹1.75L)
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
    ownHouseRequired: false, // Removed: owned property no longer mandatory
    metroOnly: false,        // Removed: no longer restricted to Metro cities
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
    minSalary: 0,             // Removed: no generic minimum salary gate (was ₹75K)
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
  // CHOLA — Source: chola.md + Delhi NCR one-pager (Nov 2026)
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
      maxCCBTs: 6,              // CC OS up to 8× salary allowed for BT (checked in Chola block)
      appLoan: false,
      maxAppBTs: 0,
      overdraft: true,          // OD / DOD tracks can be taken over into a Chola PL
                                // ("BT not allowed in Flexi OD" is about the destination product, see btPreference check)
      maxTotalBTs: 6,           // 6 tracks total
      topUp: true,
    },
    obligations: {
      ccObligationPercent: 5,
      goldLoanObligationPercent: 0,  // Zero GL obligation
      kccObligationPercent: 0,       // Zero KCC obligation
      ccNonObligationUpToSalaryMultiple: 3, // CC O/S up to 3× salary not obligated
      pendingEmiWaivers: [
        { minTenure: 19, maxEmisLeft: 6 }, // tenure above 18 months → last 6 EMIs not obligated
        { minTenure: 18, maxEmisLeft: 3 }, // 18-month tenure → last 3 EMIs not obligated
      ],
      cdNonObligationIfTenureAtMost: 6,    // CD loans with 6-month tenure not obligated
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
    ownHouseRequired: false,  // Required only for ₹30L cases (enforced in Chola block)
    metroOnly: false,
    geoLimitKm: null,
    digitalProcess: false,
    minAge: 21,
    maxAgeAtMaturity: 58,     // Pvt job
    govtMaxAgeAtMaturity: 60, // Govt: retirement age
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
      overdraft: false,     // ICICI takes PL BT only, no OD takeover
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
// EMIs still pending on a loan: an explicit emisRemaining wins; otherwise derived
// from total tenure and the months elapsed since dateOpened. null when unknown.
function remainingEmisFor(loan: any): number | null {
  const explicit = Number(loan.emisRemaining);
  if (loan.emisRemaining !== undefined && loan.emisRemaining !== null && !isNaN(explicit)) {
    return Math.max(0, explicit);
  }
  const tenure = Number(loan.tenure);
  if (!tenure || isNaN(tenure)) return null;
  const opened = parseLoanDate(loan.dateOpened);
  if (!opened) return null;
  const monthsElapsed = Math.floor((Date.now() - opened.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  return Math.max(0, tenure - monthsElapsed);
}

interface ObligationContext {
  netSalary?: number;          // basis for salary-multiple rules
  totalCcOutstanding?: number; // sum of all credit card outstanding on the report
}

function calculateObligation(
  loan: any,
  lender: LenderConfig,
  ctx: ObligationContext = {}
): number {
  const type = loan.type || "";
  const emi = Number(loan.emi || 0);
  const outstanding = Number(loan.currentOutstanding || 0);
  const totalTenure = Number(loan.tenure) || 0;
  const remainingEmis = remainingEmisFor(loan) ?? 0;
  const rules = lender.obligations;

  // Joint loan paid by someone else (repayment banking to be documented): not obligated
  if (loan.userPaysEmi === false) return 0;

  // Credit Card: use bank-specific CC obligation %
  if (type === "Credit Card") {
    if (
      rules.ccNonObligationUpToSalaryMultiple &&
      ctx.netSalary &&
      (ctx.totalCcOutstanding ?? outstanding) <= ctx.netSalary * rules.ccNonObligationUpToSalaryMultiple
    ) {
      return 0;
    }
    return outstanding * (rules.ccObligationPercent / 100);
  }

  // Gold Loan: use bank-specific GL obligation %
  if (type === "Gold Loan") {
    return outstanding * (rules.goldLoanObligationPercent / 100);
  }

  // KCC: bank-specific % of outstanding, else full EMI
  if (type === "KCC") {
    if (rules.kccObligationPercent !== undefined) {
      return outstanding * (rules.kccObligationPercent / 100);
    }
    return emi;
  }

  // Consumer durable loans with a short tenure are ignored by some lenders
  if (
    type === "Consumer Loan" &&
    rules.cdNonObligationIfTenureAtMost &&
    totalTenure > 0 &&
    totalTenure <= rules.cdNonObligationIfTenureAtMost
  ) {
    return 0;
  }

  // Pending-EMI waivers (tenure-banded), for EMI-based loans only
  if (rules.pendingEmiWaivers && totalTenure > 0 && type !== "Overdraft" && remainingEmisFor(loan) !== null) {
    const band = [...rules.pendingEmiWaivers]
      .sort((a, b) => b.minTenure - a.minTenure)
      .find((w) => totalTenure >= w.minTenure);
    if (band && remainingEmis <= band.maxEmisLeft) {
      return 0;
    }
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

// Parses a loan's dateOpened field, which may be "DD-MM-YYYY" (bureau-formatted),
// a raw bureau date string, or "N/A"/empty. Returns null when unparseable.
function parseLoanDate(dateOpened: string | undefined): Date | null {
  if (!dateOpened || dateOpened === "N/A") return null;

  const ddmmyyyy = dateOpened.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : d;
  }

  const yyyymmdd = dateOpened.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (yyyymmdd) {
    const [, yyyy, mm, dd] = yyyymmdd;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(dateOpened);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Eligibility Engine ─────────────────────────────────────────────────────

/**
 * Default FOIR by net salary (applies to banks & NBFCs unless a lender's own rules override):
 *   < 50,000 → 50% | 50,000–69,999 → 65% | ≥ 70,000 → 70%
 *   ≥ 70,000 with a running secured loan (Home/Car/Auto): NBFC → 75%
 */
export function getDefaultFoir(netSalary: number, hasSecuredLoan: boolean, isNbfc: boolean): number {
  if (netSalary < 50000) return 50;
  if (netSalary < 70000) return 65;
  return isNbfc && hasSecuredLoan ? 75 : 70;
}

export function analyzeLenderEligibility({
  profile,
  catBLoans,
  allLoans = [],
}: {
  profile: any;
  catBLoans: any[];
  allLoans?: any[];
}) {
  const cibilScore = Number(profile.cibilScore) || 0;
  const age = Number(profile.age) || 0;

  const eligibleLenders: any[] = [];
  const ineligibleLenders: any[] = [];

  // When the applicant wants "BT to PL", any Overdraft being consolidated is
  // converted into a Personal Loan, so it must be counted as a PL BT, not an OD BT.
  const effectiveCatBLoans =
    profile.btPreference === "BT to PL"
      ? catBLoans.map((l: any) => (l.type === "Overdraft" ? { ...l, type: "Personal Loan" } : l))
      : catBLoans;

  // Pre-count loan types in catBLoans
  const plCount = effectiveCatBLoans.filter((l: any) => l.type === "Personal Loan").length;
  const ccCount = effectiveCatBLoans.filter((l: any) => l.type === "Credit Card").length;
  const appLoans = effectiveCatBLoans.filter((l: any) => l.type === "App Loan");
  const appCount = appLoans.length;
  const odLoans = effectiveCatBLoans.filter((l: any) => l.type === "Overdraft");
  const odCount = odLoans.length;
  const totalBTCount = effectiveCatBLoans.length;

  // Shared context for salary-multiple obligation rules
  const obligationCtx: ObligationContext = {
    netSalary: Number(profile.netSalary) || 0,
    totalCcOutstanding: allLoans
      .filter((l: any) => l.type === "Credit Card")
      .reduce((sum: number, l: any) => sum + Number(l.currentOutstanding || 0), 0),
  };

  for (const lender of LENDERS) {
    let isEligible = true;
    let matchScore = 100;
    const rejectionReasons: string[] = [];
    const warnings: string[] = [];
    const customOutput: any = {};

    // ─── Get employer tier for this specific lender ─────────────────────
    const employerTier = profile.employerTier || "Unknown";
    customOutput.employerTier = employerTier;
    // Bank-specific category straight from that lender's employer listing (if the
    // employer is listed there); falls back to the unified tier used by the rules.
    const bankCategory = (profile.employerBankCategories || []).find((b: any) => b.key === lender.id)?.category;
    customOutput.employerCategory = bankCategory || employerTier;

    // ─── Calculate effective NTH ────────────────────────────────────────
    const nth = calculateEffectiveNTH(lender, profile);
    customOutput.effectiveNTH = Math.floor(nth);

    // ─── Global FOIR Logic ──────────────────────────────────────────────
    const hasRunningHL = allLoans.some((l: any) => l.type === "Home Loan" && Number(l.currentOutstanding || 0) > 0);
    const hasSecuredLoan =
      hasRunningHL ||
      allLoans.some((l: any) => l.type === "Car Loan" && Number(l.currentOutstanding || 0) > 0);
    const salaryForFoir = Number(profile.netSalary) || 0;
    const defaultFoir = getDefaultFoir(salaryForFoir, hasSecuredLoan, lender.type === "NBFC");
    let effectiveMaxFoir = hasRunningHL && lender.type !== "NBFC" && salaryForFoir >= 70000
      ? Math.max(defaultFoir, lender.maxFoir)
      : defaultFoir;
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

    // 8. Age limits (only when age is known). Govt employees use retirement age where configured.
    if (age > 0) {
      if (age < lender.minAge) {
        isEligible = false;
        rejectionReasons.push(`Minimum age is ${lender.minAge} years`);
      }
      const maxAge =
        employerTier === "GOVT" && lender.govtMaxAgeAtMaturity
          ? lender.govtMaxAgeAtMaturity
          : lender.maxAgeAtMaturity;
      const tenureAllowedByAge = Math.floor((maxAge - age) * 12);
      if (tenureAllowedByAge < 12) {
        isEligible = false;
        rejectionReasons.push(`Exceeds maximum age of ${maxAge} at loan maturity`);
      } else if (tenureAllowedByAge < lender.maxTenure) {
        warnings.push(`Tenure limited to ${tenureAllowedByAge} months by age at maturity (${maxAge})`);
        customOutput.tenureLimitedByAge = tenureAllowedByAge;
      }
    }

    // 9. Bounce / late payment
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

    // OD BT check — uses the original Overdraft loans, even when "BT to PL" relabels them
    // as PL for count limits: a lender that doesn't take over ODs can't take this one over.
    const rawOdLoans = catBLoans.filter((l: any) => l.type === "Overdraft");
    if (rawOdLoans.length > 0) {
      if (!lender.bt.overdraft) {
        isEligible = false;
        rejectionReasons.push("Does not support Overdraft BT");
      }
      // IndusInd: OD BT only for specific banks
      if (lender.bt.odBTRestrictions && lender.bt.odBTRestrictions.length > 0) {
        const invalidODs = rawOdLoans.filter((l: any) => {
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
      // Only Kotak and IndusInd take a BT into an OD facility. Chola's Flexi OD is a
      // fresh-loan product: "BT not allowed in Flexi OD product" (Delhi NCR one-pager).
      if (lender.id === "chola") {
        isEligible = false;
        rejectionReasons.push("BT not allowed into Chola Flexi OD; BT is offered as a Personal Loan only");
      } else if (!["kotak", "indusind"].includes(lender.id)) {
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
          totalAxisObligation += calculateObligation(l, lender, obligationCtx);
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

    // ── AXIS FINANCE specific ───────────────────────────────────────────
    if (lender.id === "axisfinance" && isEligible) {
      // Source: bank_comparison data — Axis Finance rejects if applicant has
      // taken a Personal Loan or Overdraft in the last 3 months.
      const recentPLOrOD = allLoans.some((l: any) => {
        if (l.type !== "Personal Loan" && l.type !== "Overdraft") return false;
        const opened = parseLoanDate(l.dateOpened);
        if (!opened) return false;
        const monthsSince =
          (Date.now() - opened.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
        return monthsSince < 3;
      });

      if (recentPLOrOD) {
        isEligible = false;
        rejectionReasons.push("Personal Loan/Overdraft taken in the last 3 months");
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
      const cholaSalary = Number(profile.netSalary) || 0;
      const employmentType = String(profile.employmentType || "Regular");

      // Delhi location CIBIL requirement
      if (profile.location === "Delhi NCR" && cibilScore > 0 && cibilScore < 700) {
        isEligible = false;
        rejectionReasons.push("Delhi NCR requires minimum CIBIL of 700");
      }

      // All categories funded except Cat D
      if (employerTier === "D") {
        isEligible = false;
        rejectionReasons.push("Cat D employers are not funded");
      }

      // Max 5 unique credit enquiries in the last 30 days (top-up enquiries can be ignored)
      const enquiries30d = Number(profile.inquiriesLast30Days);
      if (!isNaN(enquiries30d) && enquiries30d > 5) {
        isEligible = false;
        rejectionReasons.push(`More than 5 credit enquiries in the last 30 days (${enquiries30d})`);
      }

      // Govt contractual: needs ₹50K+ salary and 2-year JCP; funded up to ₹7.5L
      if (employmentType === "Govt Contractual" && cholaSalary < 50000) {
        isEligible = false;
        rejectionReasons.push("Govt contractual employees need salary above ₹50,000");
      }

      // BT seasoning: 6 months on book, paid without bouncing
      const unseasonedBT = catBLoans.filter((l: any) => {
        const opened = parseLoanDate(l.dateOpened);
        if (!opened) return false;
        const monthsSince = (Date.now() - opened.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
        return monthsSince < 6;
      });
      if (unseasonedBT.length > 0) {
        isEligible = false;
        rejectionReasons.push("BT loans must have 6 months on book (6 MOB) without bounce");
      }

      // Credit card BT: outstanding allowed up to 8× salary
      const ccBtOutstanding = effectiveCatBLoans
        .filter((l: any) => l.type === "Credit Card")
        .reduce((sum: number, l: any) => sum + Number(l.currentOutstanding || 0), 0);
      if (cholaSalary > 0 && ccBtOutstanding > cholaSalary * 8) {
        isEligible = false;
        rejectionReasons.push("Credit card outstanding for BT exceeds 8× salary");
      }

      // Flexi OD: fresh-loan product, ₹10L–₹30L, 84 months (2 years Flexi + 5 years drop-line)
      const flexiOdCibilOk = cibilScore <= 0 || cibilScore >= 725;
      if (
        flexiOdCibilOk &&
        ((employerTier === "GOVT" && nth >= 100000) ||
          (["A+", "A", "B"].includes(employerTier) && nth >= 150000))
      ) {
        customOutput.flexiOdEligible = true;
        customOutput.flexiOdStructure = "2 years Flexi + 5 years Drop-line";
        customOutput.flexiOdMinLoan = 1000000;
        customOutput.flexiOdMaxLoan = 3000000;
        // ROI 13.5% for Cat-A and Govt, 14.5% otherwise (offer valid till 30 Nov 2026)
        customOutput.flexiOdRate = ["A+", "A", "GOVT"].includes(employerTier) ? 13.5 : 14.5;
      } else {
        customOutput.flexiOdEligible = false;
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

      // ₹30L cases need an owned house in self or spouse name
      if (customOutput.cholaMaxLoan === 3000000 && profile.residenceType !== "Owned") {
        customOutput.cholaMaxLoan = 1000000;
        warnings.push("₹30L funding needs owned house (self/spouse); capped at ₹10L on rented residence");
      }

      // Govt contractual and 4th grade (driver, peon, MTS, attendant): up to ₹7.5L
      if (employmentType === "Govt Contractual" || employmentType === "4th Grade") {
        customOutput.cholaMaxLoan = Math.min(customOutput.cholaMaxLoan, 750000);
        warnings.push(
          employmentType === "Govt Contractual"
            ? "Govt contractual: funding capped at ₹7.5L, 2-year JCP to be documented"
            : "4th grade employee: funding capped at ₹7.5L (Safai Karamchari / Railways & MCD 4th grade not funded)"
        );
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
      const plCount = effectiveCatBLoans.filter((l: any) => l.type === "Personal Loan").length;
      const odCount = effectiveCatBLoans.filter((l: any) => l.type === "Overdraft").length;

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

      // FOIR grid: risk segment × company category × NTH segment (policy §2–3)
      const isHighRisk = profile.riskSegment === "high";
      const catIdx =
        employerTier === "A+" || employerTier === "A" ? 0 :
        employerTier === "B" || employerTier === "GOVT" ? 1 :
        employerTier === "C" || employerTier === "D" ? 2 : 3; // Unknown → Cat E (conservative)
      const incIdx =
        nth > 250000 ? 0 : nth > 150000 ? 1 : nth > 75000 ? 2 : nth >= 50000 ? 3 : 4;
      const grid: (number | null)[][] = isHighRisk
        ? [
            [75, 75, 70, 65, 60],
            [70, 70, 65, 60, 50],
            [65, 60, 55, 55, 50],
            [60, 55, 50, null, null],
          ]
        : [
            [80, 80, 75, 70, 65],
            [75, 70, 65, 65, 60],
            [70, 65, 60, 60, 55],
            [65, 60, 55, 50, 50],
          ];
      const gridFoir = grid[catIdx][incIdx];

      if (gridFoir === null) {
        isEligible = false;
        rejectionReasons.push("High-risk Cat E applicants with Prime or Others income are not allowed");
      } else {
        effectiveMaxFoir = gridFoir;
        customOutput.poonawallaFOIR = gridFoir;
      }

      // Secured (Car/Auto) loan bumps max FOIR to 75%
      const hasSecuredAutoLoan = allLoans.some((l: any) => l.type === "Car Loan" && Number(l.currentOutstanding || 0) > 0);
      if (hasSecuredAutoLoan) {
        effectiveMaxFoir = Math.max(effectiveMaxFoir, 75);
        customOutput.poonawallaFOIR = effectiveMaxFoir;
      }
      customOutput.maxFOIR = `${effectiveMaxFoir}%`;
      if (profile.cityTier !== "Metro") {
        warnings.push("FOIR grid is defined only for Metro, Tier 1 and Tier 2 cities");
      }

      // FOIR & capacity (CC 5% / gold 1% obligation rules via calculateObligation)
      let totalEmi = 0;
      allLoans.forEach((l: any) => {
        totalEmi += calculateObligation(l, lender, obligationCtx);
      });
      const maxEmi = nth * (effectiveMaxFoir / 100);
      const unusedCap = isEligible ? Math.max(0, maxEmi - totalEmi) : 0;
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
      if (isHighRisk) {
        customOutput.poonawallaMaxLoan = Math.min(customOutput.poonawallaMaxLoan, 3000000);
      }

      // Geo limit warning
      if (isEligible) {
        warnings.push("Applicant must be within 80 km of a municipal office");
      }
    }

    // ── TATA CAPITAL specific ───────────────────────────────────────────
    if (lender.id === "tatacapital" && isEligible) {
      // BT financed amount > ₹5L is handled by minBTFinancedAmount in BT checks above.
      // Multiplier grid: rows = tenure bucket (months), cols = NTH band (<50K / 50–75K / >75K).
      // null = not available.
      type Row = [number | null, number | null, number | null];
      const TATA_GRID: Record<string, Record<number, Row>> = {
        TGE: {
          12: [6, 7, 7], 24: [10, 13, 13], 36: [16, 18, 18], 48: [18, 22, 23], 60: [21, 24, 27],
        },
        A: {
          12: [6, 7, 7], 24: [10, 13, 13], 36: [14, 18, 18], 48: [17, 22, 23], 60: [20, 23, 27],
        },
        B: {
          12: [5, 7, 7], 24: [9, 13, 13], 36: [13, 18, 18], 48: [15, 20, 22], 60: [19, 22, 25],
        },
        C: {
          12: [5, 7, 7], 24: [7, 13, 13], 36: [9, 18, 18], 48: [9, 18, 18], 60: [null, null, null],
        },
        UNAPPROVED: {
          12: [5, 7, 7], 24: [7, 13, 13], 36: [9, 15, 15], 48: [null, null, null], 60: [null, null, null],
        },
      };
      const gridKey =
        employerTier === "A+" ? "TGE" :
        employerTier === "A" || employerTier === "GOVT" ? "A" :
        employerTier === "B" ? "B" :
        employerTier === "C" || employerTier === "D" ? "C" : "UNAPPROVED";
      const bandIdx = nth > 75000 ? 2 : nth >= 50000 ? 1 : 0;

      // FOIR grid by salary (Max FOIR applied to total obligations)
      let tataFoir = nth > 75000 ? 75 : nth > 50000 ? 65 : nth > 25000 ? 60 : 50;

      // Secured (Car/Auto) loan bumps max FOIR to 75%
      const hasSecuredAutoLoan = allLoans.some((l: any) => l.type === "Car Loan" && Number(l.currentOutstanding || 0) > 0);
      if (hasSecuredAutoLoan) {
        tataFoir = Math.max(tataFoir, 75);
      }

      effectiveMaxFoir = tataFoir;
      customOutput.maxFOIR = `${tataFoir}%`;

      let totalEmi = 0;
      allLoans.forEach((l) => {
        totalEmi += calculateObligation(l, lender, obligationCtx);
      });
      const unusedCap = Math.max(0, nth * (tataFoir / 100) - totalEmi);
      const r = lender.headlineRate / 12 / 100;

      // Best result across tenure buckets: min(multiplier eligibility, FOIR eligibility at that tenure)
      let best = 0;
      let bestTenure = 0;
      let anyMultiplier = false;
      for (const t of [12, 24, 36, 48, 60]) {
        const mult = TATA_GRID[gridKey][t][bandIdx];
        if (mult === null) continue;
        anyMultiplier = true;
        const foirLoan = unusedCap * (Math.pow(1 + r, t) - 1) / (r * Math.pow(1 + r, t));
        const amt = Math.min(nth * mult, foirLoan);
        if (amt > best) { best = amt; bestTenure = t; }
      }

      if (!anyMultiplier) {
        isEligible = false;
        rejectionReasons.push(`No multiplier available for employer category '${employerTier}' at this salary band`);
      } else {
        customOutput.tataMaxLoan = Math.floor(best);
        customOutput.tataBestTenure = bestTenure;
        customOutput.tataFOIR = tataFoir;
        if (best <= 0) {
          isEligible = false;
          rejectionReasons.push("No FOIR capacity available after existing obligations");
        }
      }
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
        totalObligations += calculateObligation(l, lender, obligationCtx);
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
      if (lender.id === 'tatacapital' && customOutput.tataMaxLoan !== undefined) customOutput.universalMaxLoan = customOutput.tataMaxLoan;
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

