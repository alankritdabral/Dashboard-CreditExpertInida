/**
 * Financial calculation and WhatsApp variable resolution utilities
 * for Excel Bulk EMI Campaigns.
 */

export interface EmiCalculationResult {
  currentEmi: number;
  newEmi: number;
  monthlySavings: number;
  totalSavings: number;
  isEligibleForSavings: boolean;
}

/**
 * Standard reducing-balance Equated Monthly Installment (EMI) calculation.
 * Formula: E = P * r * (1 + r)^n / ((1 + r)^n - 1)
 *
 * @param principal Loan amount (P)
 * @param annualRatePercent Annual interest rate in percent (e.g. 23.5)
 * @param tenureMonths Tenure in months (e.g. 24)
 */
export function calculateEmi(
  principal: number,
  annualRatePercent: number,
  tenureMonths: number
): number {
  if (!principal || principal <= 0 || !tenureMonths || tenureMonths <= 0) {
    return 0;
  }

  // If 0% interest rate, EMI is simply principal / months
  if (!annualRatePercent || annualRatePercent <= 0) {
    return Math.round(principal / tenureMonths);
  }

  const monthlyRate = annualRatePercent / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const denominator = factor - 1;

  if (denominator === 0) {
    return Math.round(principal / tenureMonths);
  }

  const emi = (principal * monthlyRate * factor) / denominator;
  return Math.round(emi);
}

/**
 * Calculates current EMI, new EMI at target rate (default 9.99%), and savings.
 */
export function calculateEmiDifference(
  principal: number,
  currentRate: number,
  targetRate: number = 9.99,
  tenureMonths: number
): EmiCalculationResult {
  const currentEmi = calculateEmi(principal, currentRate, tenureMonths);
  const newEmi = calculateEmi(principal, targetRate, tenureMonths);
  const monthlySavings = Math.max(0, currentEmi - newEmi);
  const totalSavings = monthlySavings * tenureMonths;

  return {
    currentEmi,
    newEmi,
    monthlySavings,
    totalSavings,
    isEligibleForSavings: currentEmi > newEmi && currentRate > targetRate,
  };
}

/**
 * Formats numbers into Indian numbering system (e.g. 10,524 or ₹10,524).
 */
export function formatInrCurrency(
  amount: number,
  options: { showSymbol?: boolean; showDecimals?: boolean } = {}
): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return options.showSymbol ? "₹0" : "0";
  }

  const rounded = options.showDecimals ? Number(amount.toFixed(2)) : Math.round(amount);
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: options.showDecimals ? 2 : 0,
    minimumFractionDigits: options.showDecimals ? 2 : 0,
  }).format(rounded);

  return options.showSymbol ? `₹${formatted}` : formatted;
}

/**
 * Strips Excel formulas, HYPERLINK wrappers, HTML links, markdown links,
 * and URL artifacts from a string, returning only the clean display name or text.
 * 
 * Handles cases like:
 * - '=HYPERLINK("https://recruiter.shine.com/...","Bhagyashree Mangesh Pardeshi")'
 * - 'HYPERLINK("url", "Candidate Name")'
 * - '<a href="...">Candidate Name</a>'
 * - '[Candidate Name](https://...)'
 * - 'Candidate Name (https://...)'
 * - Clean strings: 'Bhagyashree Mangesh Pardeshi'
 */
export function cleanHyperlinkText(value: any): string {
  if (value === undefined || value === null) return "";
  let s = String(value).trim();
  if (!s) return "";

  // 1. Excel HYPERLINK formula: =HYPERLINK("url", "friendly_name")
  const hyperlinkRegex = /^\s*=?\s*HYPERLINK\s*\(\s*(?:"(?:[^"\\]|\\.|"")*"|'(?:[^'\\]|\\.|'')*'|[^,]+)\s*,\s*(?:"((?:[^"\\]|\\.|"")*)"|'((?:[^'\\]|\\.|'')*)'|([^)]+))\s*\)\s*$/i;
  const match = s.match(hyperlinkRegex);
  if (match) {
    const extracted = (match[1] || match[2] || match[3] || "").replace(/""/g, '"').trim();
    if (extracted) {
      return extracted;
    }
  }

  // Fallback regex if HYPERLINK is embedded or slightly malformed
  const generalHyperlinkRegex = /HYPERLINK\s*\([^,]+,\s*["']?([^"')]+)["']?\s*\)/i;
  const generalMatch = s.match(generalHyperlinkRegex);
  if (generalMatch && generalMatch[1] && generalMatch[1].trim()) {
    return generalMatch[1].trim();
  }

  // 2. HTML anchor tag: <a href="...">Candidate Name</a>
  const htmlMatch = s.match(/<a\b[^>]*>(.*?)<\/a>/i);
  if (htmlMatch && htmlMatch[1] && htmlMatch[1].trim()) {
    return htmlMatch[1].replace(/<[^>]+>/g, "").trim();
  }

  // 3. Markdown link: [Candidate Name](https://...)
  const mdMatch = s.match(/\[([^\]]+)\]\([^)]+\)/);
  if (mdMatch && mdMatch[1] && mdMatch[1].trim()) {
    return mdMatch[1].trim();
  }

  // 4. Trailing or leading URL in parentheses: Candidate Name (https://...)
  s = s.replace(/\s*\(\s*https?:\/\/[^\s)]+\s*\)\s*/gi, " ").trim();

  // 5. Quotes unwrapping
  if (/^["'](.*)["']$/.test(s)) {
    s = s.slice(1, -1).trim();
  }

  return s;
}

export type PhoneFormatOption =
  | "auto"              // Smart Combined / Auto-Detect (Mixed: 10-digit, 91 prefix, 91 with space/dash, etc.)
  | "plain_10"          // Pure 10-digit without country code (e.g. 9876543210 -> Prepend 91)
  | "has_91"            // Already has 91 or +91 (e.g. 919876543210 or +919876543210)
  | "space_separated"   // 91 then space or separator (e.g. 91 9876543210 or +91 98765 43210)
  | "last_10";          // Extract last 10 digits & add 91 (safe fallback for dirty/prefixed numbers)

export interface PhoneSanitizeResult {
  raw: string;
  formatted: string;
  isValid: boolean;
  error?: string;
  detectedFormat?: string;
}

export const PHONE_FORMAT_OPTIONS: {
  id: PhoneFormatOption;
  label: string;
  shortLabel: string;
  description: string;
  example: string;
  badge?: string;
}[] = [
  {
    id: "auto",
    label: "Auto-Detect / Combined (Smart)",
    shortLabel: "Auto Combined",
    description: "Handles mixed formats in same column: plain 10-digit, +91, 91 with space/hyphen, leading 0, etc.",
    example: "9876543210, +91 98765 43210, 919876543210",
    badge: "Recommended",
  },
  {
    id: "plain_10",
    label: "Simply Number (Plain 10-Digit)",
    shortLabel: "Plain 10-Digit",
    description: "Column contains 10-digit mobile numbers without country code. Automatically prepends +91.",
    example: "9827322519 ➔ 919827322519",
  },
  {
    id: "has_91",
    label: "With 91 Automatically",
    shortLabel: "With 91 Prefix",
    description: "Column already includes 91 or +91 country prefix. Verifies and cleans non-digits.",
    example: "919827322519 or +919827322519",
  },
  {
    id: "space_separated",
    label: "91 Then Space / Dash Then Number",
    shortLabel: "91 With Space",
    description: "Column formatted with space or hyphen delimiter. Strips separators and standardizes to 91XXXXXXXXXX.",
    example: "91 98273 22519 or +91-9827322519",
  },
  {
    id: "last_10",
    label: "Extract Last 10 Digits",
    shortLabel: "Last 10 Digits",
    description: "Extracts the rightmost 10 digits and prepends 91. Robust fallback for messy/erratic columns.",
    example: "0091-9827322519 ➔ 919827322519",
  },
];

/**
 * Validates and formats Indian 10-digit mobile number to WhatsApp international format (91XXXXXXXXXX).
 * Supports configurable format modes:
 * - auto: Smart detection across mixed rows (pure 10-digit, with 91, 91 with spaces, leading 0, etc.)
 * - plain_10: Strictly pure 10-digit numbers without country code (automatically adds 91)
 * - has_91: Numbers already prefixed with 91 or +91
 * - space_separated: Numbers written with 91 followed by space/separator
 * - last_10: Extracts the last 10 digits and prepends 91
 */
export function sanitizeIndianPhoneNumber(
  raw: any,
  mode: PhoneFormatOption = "auto",
  defaultCountryCode: string = "91"
): PhoneSanitizeResult {
  if (raw === undefined || raw === null || raw === "") {
    return { raw: "", formatted: "", isValid: false, error: "Empty phone number" };
  }

  let rawStr = String(raw).trim();
  // Strip trailing decimal zeroes from Excel (e.g. 9827322519.0 or 919827322519.00)
  rawStr = rawStr.replace(/\.0+$/, "");

  // If scientific notation e.g. 9.827322519e+09 or 9.19827e+11 from Excel
  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(rawStr)) {
    try {
      const num = Number(rawStr);
      if (!isNaN(num) && isFinite(num)) {
        rawStr = BigInt(Math.round(num)).toString();
      }
    } catch {
      // ignore
    }
  }

  // Strip non-digits
  const digits = rawStr.replace(/\D/g, "");

  if (!digits) {
    return { raw: rawStr, formatted: "", isValid: false, error: "No digits found" };
  }

  const cc = defaultCountryCode.replace(/\D/g, "") || "91";

  // MODE: Plain 10-digit numbers (no country code in column)
  if (mode === "plain_10") {
    let tenDigits = digits;
    if (digits.length === 11 && digits.startsWith("0")) {
      tenDigits = digits.slice(1);
    }
    // If user selected plain_10 but row accidentally had 91 prefix
    if (digits.length === (cc.length + 10) && digits.startsWith(cc)) {
      tenDigits = digits.slice(cc.length);
    }

    if (tenDigits.length === 10) {
      const valid = /^[6-9]\d{9}$/.test(tenDigits);
      return {
        raw: rawStr,
        formatted: `${cc}${tenDigits}`,
        isValid: valid,
        detectedFormat: "10-Digit Mobile",
        error: valid ? undefined : "Indian mobile numbers typically start with 6, 7, 8, or 9",
      };
    }

    return {
      raw: rawStr,
      formatted: `${cc}${tenDigits.slice(-10)}`,
      isValid: false,
      error: `Expected 10 digits, found ${digits.length} digits`,
    };
  }

  // MODE: Already has 91 / +91 prefix
  if (mode === "has_91") {
    if (digits.startsWith(cc) && digits.length === (cc.length + 10)) {
      const local = digits.slice(cc.length);
      const valid = /^[6-9]\d{9}$/.test(local);
      return {
        raw: rawStr,
        formatted: digits,
        isValid: valid,
        detectedFormat: "With 91 Prefix",
        error: valid ? undefined : "10-digit mobile portion should start with 6, 7, 8, or 9",
      };
    }
    // Tolerant fallback: if 10 digits provided, auto-prepend 91
    if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
      return {
        raw: rawStr,
        formatted: `${cc}${digits}`,
        isValid: true,
        detectedFormat: "10-Digit (Auto-Prepended 91)",
      };
    }
    return {
      raw: rawStr,
      formatted: digits,
      isValid: false,
      error: `Expected number starting with ${cc} (12 digits), found ${digits.length} digits`,
    };
  }

  // MODE: 91 then space / dash separator
  if (mode === "space_separated") {
    if (digits.startsWith(cc) && digits.length === (cc.length + 10)) {
      const local = digits.slice(cc.length);
      const valid = /^[6-9]\d{9}$/.test(local);
      return {
        raw: rawStr,
        formatted: digits,
        isValid: valid,
        detectedFormat: "91 With Separator",
        error: valid ? undefined : "10-digit mobile portion should start with 6, 7, 8, or 9",
      };
    }
    if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
      return {
        raw: rawStr,
        formatted: `${cc}${digits}`,
        isValid: true,
        detectedFormat: "10-Digit (Auto-Prepended 91)",
      };
    }
    return {
      raw: rawStr,
      formatted: digits,
      isValid: false,
      error: `Expected ${cc} followed by 10 digits (e.g. "91 98765 43210"), found ${digits.length} digits`,
    };
  }

  // MODE: Extract last 10 digits
  if (mode === "last_10") {
    if (digits.length >= 10) {
      const last10 = digits.slice(-10);
      const valid = /^[6-9]\d{9}$/.test(last10);
      return {
        raw: rawStr,
        formatted: `${cc}${last10}`,
        isValid: valid,
        detectedFormat: "Last 10 Digits",
        error: valid ? undefined : "Last 10 digits do not match Indian mobile pattern (6-9)",
      };
    }
    return {
      raw: rawStr,
      formatted: digits,
      isValid: false,
      error: `Fewer than 10 digits found (${digits.length})`,
    };
  }

  // MODE: "auto" (Combined / Smart Auto-Detect - default)
  // 1. Pure 10-digit mobile number: e.g. 9827322519 -> 919827322519
  if (digits.length === 10) {
    const valid = /^[6-9]\d{9}$/.test(digits);
    return {
      raw: rawStr,
      formatted: `${cc}${digits}`,
      isValid: valid,
      detectedFormat: "10-Digit Mobile",
      error: valid ? undefined : "Indian mobile numbers typically start with 6, 7, 8, or 9",
    };
  }

  // 2. 12 digits starting with cc (e.g. 91): 919827322519
  if (digits.length === (cc.length + 10) && digits.startsWith(cc)) {
    const local = digits.slice(cc.length);
    const valid = /^[6-9]\d{9}$/.test(local);
    return {
      raw: rawStr,
      formatted: digits,
      isValid: valid,
      detectedFormat: "With 91 Prefix",
      error: valid ? undefined : "Invalid 10-digit mobile number portion after 91",
    };
  }

  // 3. 11 digits starting with 0: e.g. 09827322519
  if (digits.length === 11 && digits.startsWith("0")) {
    const local = digits.slice(1);
    const valid = /^[6-9]\d{9}$/.test(local);
    return {
      raw: rawStr,
      formatted: `${cc}${local}`,
      isValid: valid,
      detectedFormat: "Leading 0 Mobile",
      error: valid ? undefined : "Invalid 10-digit mobile number portion after 0",
    };
  }

  // 4. 13 digits starting with 091: e.g. 0919827322519
  if (digits.length === 13 && digits.startsWith("091")) {
    const local = digits.slice(3);
    const valid = /^[6-9]\d{9}$/.test(local);
    return {
      raw: rawStr,
      formatted: `${cc}${local}`,
      isValid: valid,
      detectedFormat: "Leading 091 Prefix",
      error: valid ? undefined : "Invalid mobile number portion",
    };
  }

  // 5. 13 digits starting with 910: e.g. 9109827322519 or 91 09827322519
  if (digits.length === 13 && digits.startsWith("910")) {
    const local = digits.slice(3);
    const valid = /^[6-9]\d{9}$/.test(local);
    return {
      raw: rawStr,
      formatted: `${cc}${local}`,
      isValid: valid,
      detectedFormat: "91 + Leading 0",
      error: valid ? undefined : "Invalid mobile number portion",
    };
  }

  // 6. If digits >= 10 and ends with a valid 10-digit Indian mobile (starts with 6-9)
  if (digits.length > 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) {
      return {
        raw: rawStr,
        formatted: `${cc}${last10}`,
        isValid: true,
        detectedFormat: "Extracted Mobile (Last 10)",
      };
    }
  }

  return {
    raw: rawStr,
    formatted: digits,
    isValid: false,
    error: `Invalid length (${digits.length} digits). Expected 10 digits or with 91 prefix.`,
  };
}

/**
 * Analyzes sample cell values from an Excel phone column to suggest the best format option.
 */
export function inspectPhoneColumnFormat(samples: any[]): {
  detectedMode: PhoneFormatOption;
  summary: string;
  hasSpacesOrDashes: boolean;
  validRatio: number;
} {
  let plain10Count = 0;
  let has91Count = 0;
  let spaceSepCount = 0;
  let validCount = 0;

  const validSamples = samples.filter(
    (s) => s !== undefined && s !== null && String(s).trim() !== ""
  );

  if (validSamples.length === 0) {
    return {
      detectedMode: "auto",
      summary: "No data rows available to inspect",
      hasSpacesOrDashes: false,
      validRatio: 0,
    };
  }

  for (const item of validSamples) {
    const str = String(item).trim().replace(/\.0+$/, "");
    const digits = str.replace(/\D/g, "");

    const hasSep = str.includes(" ") || str.includes("-");
    if (hasSep) {
      spaceSepCount++;
    }

    if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
      plain10Count++;
      validCount++;
    } else if (digits.length === 12 && digits.startsWith("91")) {
      has91Count++;
      validCount++;
    } else if (digits.length >= 10 && /^[6-9]\d{9}$/.test(digits.slice(-10))) {
      validCount++;
    }
  }

  const total = validSamples.length;
  const validRatio = Math.round((validCount / total) * 100);
  const hasSpacesOrDashes = spaceSepCount > 0;

  if (spaceSepCount > total * 0.3) {
    return {
      detectedMode: "space_separated",
      summary: `Detected: 91 with space/separator (${spaceSepCount}/${total} sample rows)`,
      hasSpacesOrDashes: true,
      validRatio,
    };
  }

  if (has91Count > total * 0.6) {
    return {
      detectedMode: "has_91",
      summary: `Detected: Column already has 91 prefix (${has91Count}/${total} sample rows)`,
      hasSpacesOrDashes,
      validRatio,
    };
  }

  if (plain10Count > total * 0.6) {
    return {
      detectedMode: "plain_10",
      summary: `Detected: Plain 10-digit mobile numbers (${plain10Count}/${total} sample rows)`,
      hasSpacesOrDashes,
      validRatio,
    };
  }

  return {
    detectedMode: "auto",
    summary: `Detected: Mixed/Combined formats (${validCount}/${total} valid)`,
    hasSpacesOrDashes,
    validRatio,
  };
}

export type VariableSourceType =
  | "name"
  | "current_emi"
  | "new_emi"
  | "emi_diff"
  | "total_savings"
  | "total_amount"
  | "tenure"
  | "current_roi"
  | "new_roi"
  | "difference"
  | "static_text"
  | "custom_column"
  | "custom_text";

export interface VariableSlotConfig {
  id: string;
  sourceType: VariableSourceType;
  mode?: "select" | "custom" | "difference";
  customText?: string;
  customColumnName?: string;
  staticValue?: string;
  formatAsCurrency?: boolean;
  includeRupeeSymbol?: boolean;

  // Difference of 2 values configuration
  diffOperandA?: string; // Predefined key ("current_emi", "new_emi", etc.), slot ("slot:0"), or column ("col:NAME")
  diffOperandB?: string; // Predefined key, slot, or column
  diffAbsolute?: boolean; // Math.abs(A - B)
  diffRound?: boolean; // Math.round (default true)
}

export const VARIABLE_SOURCE_OPTIONS: {
  value: VariableSourceType;
  label: string;
  description: string;
  example: string;
}[] = [
  {
    value: "name",
    label: "Customer Name",
    description: "Mapped customer name from Excel",
    example: "Rahul Sharma",
  },
  {
    value: "current_emi",
    label: "Current Monthly EMI",
    description: "Calculated EMI at existing interest rate",
    example: "10,524",
  },
  {
    value: "new_emi",
    label: "New Monthly EMI (@ 9.99%)",
    description: "Calculated reduced EMI at target 9.99% ROI",
    example: "9,228",
  },
  {
    value: "emi_diff",
    label: "Monthly EMI Savings (Difference)",
    description: "Monthly savings (Current EMI - New EMI)",
    example: "1,296",
  },
  {
    value: "difference",
    label: "➖ Difference of 2 Others (A − B)",
    description: "Subtract any 2 variables, slots, or Excel columns",
    example: "Value A − Value B",
  },
  {
    value: "total_savings",
    label: "Total Savings Over Tenure",
    description: "Cumulative savings across entire loan tenure",
    example: "31,111",
  },
  {
    value: "total_amount",
    label: "Total Loan Amount",
    description: "Principal / sanction amount from Excel",
    example: "2,00,000",
  },
  {
    value: "tenure",
    label: "Tenure",
    description: "Loan tenure in months",
    example: "24",
  },
  {
    value: "current_roi",
    label: "Current ROI",
    description: "Existing annual interest rate %",
    example: "23.5%",
  },
  {
    value: "new_roi",
    label: "New Target ROI",
    description: "Target annual interest rate %",
    example: "9.99%",
  },
  {
    value: "custom_text",
    label: "✍️ Custom Text / Tag Expression",
    description: "Type any custom text or tokens like {name}, {emi_diff}",
    example: "Special Offer: {name}",
  },
  {
    value: "static_text",
    label: "Fixed / Static Text",
    description: "Custom fixed text (e.g. Credit Expert India)",
    example: "Credit Expert India",
  },
  {
    value: "custom_column",
    label: "Raw Excel Column",
    description: "Pick any other column from the Excel sheet",
    example: "Values from selected column",
  },
];

/**
 * Extracts a numeric value from an operand specification (variable type, excel column, or another slot)
 */
export function extractNumericValue(
  operand: string | undefined,
  row: Record<string, any>,
  mapping: {
    nameCol: string;
    amountCol: string;
    tenureCol: string;
    roiCol: string;
  },
  calc: EmiCalculationResult,
  targetRoi: number = 9.99,
  allSlots?: VariableSlotConfig[],
  currentSlotIndex?: number
): number {
  if (!operand) return 0;
  const op = operand.trim();

  // Predefined calculated and loan values
  if (op === "current_emi") return calc.currentEmi;
  if (op === "new_emi") return calc.newEmi;
  if (op === "emi_diff" || op === "monthly_savings") return calc.monthlySavings;
  if (op === "total_savings") return calc.totalSavings;
  if (op === "total_amount" || op === "amount") {
    const raw = String(row[mapping.amountCol] ?? 0).replace(/,/g, "");
    return parseFloat(raw) || 0;
  }
  if (op === "tenure") {
    const raw = String(row[mapping.tenureCol] ?? 0).replace(/,/g, "");
    return parseFloat(raw) || 0;
  }
  if (op === "current_roi" || op === "roi") {
    const raw = String(row[mapping.roiCol] ?? 0).replace(/%/g, "");
    return parseFloat(raw) || 0;
  }
  if (op === "new_roi" || op === "target_roi") return targetRoi;

  // Another Variable Slot e.g. "slot:0", "slot:1"
  if (op.startsWith("slot:")) {
    const targetIdx = parseInt(op.replace(/^slot:/, ""), 10);
    if (allSlots && allSlots[targetIdx] && targetIdx !== currentSlotIndex) {
      const targetSlot = allSlots[targetIdx];
      // Guard against recursion
      if (targetSlot.sourceType !== "difference") {
        const strVal = resolveVariableValue(targetSlot, row, mapping, calc, targetRoi, allSlots, targetIdx);
        const clean = strVal.replace(/[^\d.-]/g, "");
        return parseFloat(clean) || 0;
      }
    }
  }

  // Excel sheet column e.g. "col:COLUMN_NAME"
  if (op.startsWith("col:")) {
    const colName = op.replace(/^col:/, "");
    const raw = String(row[colName] ?? "").replace(/,/g, "").replace(/%/g, "").trim();
    return parseFloat(raw) || 0;
  }

  // Direct column match in row
  if (row[op] !== undefined) {
    const raw = String(row[op] ?? "").replace(/,/g, "").replace(/%/g, "").trim();
    return parseFloat(raw) || 0;
  }

  // Custom numeric literal e.g. "num:50000" or raw number string
  const numStr = op.startsWith("num:") ? op.replace(/^num:/, "") : op;
  const parsed = parseFloat(numStr.replace(/,/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Resolves the string value for a variable slot given row data and EMI calculation results.
 */
export function resolveVariableValue(
  slot: VariableSlotConfig,
  row: Record<string, any>,
  mapping: {
    nameCol: string;
    amountCol: string;
    tenureCol: string;
    roiCol: string;
  },
  calc: EmiCalculationResult,
  targetRoi: number = 9.99,
  allSlots?: VariableSlotConfig[],
  slotIndex?: number
): string {
  const formatAmt = (val: number) => {
    if (slot.formatAsCurrency === false) {
      return String(Math.round(val));
    }
    return formatInrCurrency(val, { showSymbol: Boolean(slot.includeRupeeSymbol) });
  };

  // Difference of 2 values mode
  if (slot.mode === "difference" || slot.sourceType === "difference") {
    const opA = slot.diffOperandA || "current_emi";
    const opB = slot.diffOperandB || "new_emi";
    const valA = extractNumericValue(opA, row, mapping, calc, targetRoi, allSlots, slotIndex);
    const valB = extractNumericValue(opB, row, mapping, calc, targetRoi, allSlots, slotIndex);

    let diff = valA - valB;
    if (slot.diffAbsolute) {
      diff = Math.abs(diff);
    }
    if (slot.diffRound !== false) {
      diff = Math.round(diff);
    }
    return formatAmt(diff);
  }

  // If custom mode or custom_text type
  if (slot.mode === "custom" || slot.sourceType === "custom_text") {
    let text = slot.customText !== undefined ? slot.customText : (slot.staticValue || "");
    if (!text) return "";

    const customerName = cleanHyperlinkText(row[mapping.nameCol]);
    const tenureVal = String(row[mapping.tenureCol] ?? "").trim();
    const curRoiVal = parseFloat(String(row[mapping.roiCol] ?? 0));
    const loanAmtVal = parseFloat(String(row[mapping.amountCol] ?? 0)) || 0;

    text = text.replace(/\{name\}|\{\{name\}\}/gi, customerName);
    text = text.replace(/\{current_emi\}|\{\{current_emi\}\}/gi, formatAmt(calc.currentEmi));
    text = text.replace(/\{new_emi\}|\{\{new_emi\}\}/gi, formatAmt(calc.newEmi));
    text = text.replace(/\{emi_diff\}|\{savings\}|\{\{emi_diff\}\}|\{\{savings\}\}/gi, formatAmt(calc.monthlySavings));
    text = text.replace(/\{total_savings\}|\{\{total_savings\}\}/gi, formatAmt(calc.totalSavings));
    text = text.replace(/\{amount\}|\{loan_amount\}|\{\{amount\}\}/gi, formatAmt(loanAmtVal));
    text = text.replace(/\{tenure\}|\{\{tenure\}\}/gi, tenureVal);
    text = text.replace(/\{roi\}|\{current_roi\}|\{\{roi\}\}/gi, isNaN(curRoiVal) ? "" : `${curRoiVal}%`);
    text = text.replace(/\{new_roi\}|\{target_roi\}|\{\{new_roi\}\}/gi, `${targetRoi}%`);
    text = text.replace(/\{company\}|\{\{company\}\}/gi, "Credit Expert India");

    // Replace difference expressions e.g. {diff:current_emi-new_emi} or {diff:col:A-col:B}
    text = text.replace(/\{diff:([A-Za-z0-9_:-]+)-([A-Za-z0-9_:-]+)\}/gi, (_, opA, opB) => {
      const vA = extractNumericValue(opA, row, mapping, calc, targetRoi, allSlots, slotIndex);
      const vB = extractNumericValue(opB, row, mapping, calc, targetRoi, allSlots, slotIndex);
      return formatAmt(Math.round(vA - vB));
    });

    // Replace any {COLUMN_NAME} token matching an Excel column
    text = text.replace(/\{([A-Za-z0-9_-]+)\}/g, (match, colKey) => {
      if (row[colKey] !== undefined) return cleanHyperlinkText(row[colKey]);
      return match;
    });

    return text;
  }

  switch (slot.sourceType) {
    case "name":
      return cleanHyperlinkText(row[mapping.nameCol]);

    case "current_emi":
      return formatAmt(calc.currentEmi);

    case "new_emi":
      return formatAmt(calc.newEmi);

    case "emi_diff":
      return formatAmt(calc.monthlySavings);

    case "total_savings":
      return formatAmt(calc.totalSavings);

    case "total_amount": {
      const p = parseFloat(String(row[mapping.amountCol] ?? 0));
      return formatAmt(isNaN(p) ? 0 : p);
    }

    case "tenure": {
      const t = String(row[mapping.tenureCol] ?? "").trim();
      return t ? `${t}` : "";
    }

    case "current_roi": {
      const r = parseFloat(String(row[mapping.roiCol] ?? 0));
      return isNaN(r) ? "" : `${r}%`;
    }

    case "new_roi":
      return `${targetRoi}%`;

    case "static_text":
      return String(slot.staticValue ?? "").trim();

    case "custom_column":
      return cleanHyperlinkText(slot.customColumnName ? row[slot.customColumnName] : "");

    default:
      return "";
  }
}

/**
 * Prepares the comma-separated sample string for WhatsApp API (MessageBot / Meta).
 * CRITICAL: Commas inside individual variable values (e.g. Indian currency "1,296" or "₹1,296")
 * are stripped so MessageBot does not split a single variable into multiple parameters,
 * which triggers Meta ErrorCode 33 ("Sample variables mismatch with body text placeholders").
 */
export function formatSampleStringForApi(values: (string | number)[]): string {
  return values
    .map((v) => {
      const s = String(v ?? "").trim();
      // Remove internal commas from values to prevent delimiter splitting
      return s.replace(/,/g, "");
    })
    .join(", ");
}

/**
 * Known template variable placeholder counts verified with Meta WhatsApp API.
 */
export const KNOWN_TEMPLATE_REQUIREMENTS: Record<
  string,
  { name: string; count: number; description: string; presetKey: string }
> = {
  "78": {
    name: "excelv3",
    count: 6,
    description: "{{1}} Name, {{2}} Company, {{3}} Loan Amount, {{4}} Current EMI, {{5}} New EMI, {{6}} Difference",
    presetKey: "excelv3_78",
  },
  "77": {
    name: "excelv2",
    count: 6,
    description: "{{1}} Name, {{2}} Company, {{3}} Loan Amount, {{4}} Current EMI, {{5}} New EMI, {{6}} Difference",
    presetKey: "excelv3_78",
  },
  "72": {
    name: "reduce_emi",
    count: 4,
    description: "{{1}} Name, {{2}} Current EMI, {{3}} New EMI, {{4}} Company",
    presetKey: "reduce_emi_72",
  },
  "71": {
    name: "crminqueri",
    count: 5,
    description: "{{1}} Name, {{2}} Current EMI, {{3}} New EMI, {{4}} Bank, {{5}} Manager",
    presetKey: "crminqueri_71",
  },
  "69": {
    name: "marketing",
    count: 1,
    description: "{{1}} Name",
    presetKey: "marketing_69",
  },
};

/**
 * Built-in variable presets for common templates.
 */
export const VARIABLE_PRESETS: Record<string, VariableSlotConfig[]> = {
  // Preset for Template #78 (excelv3) & #77 (excelv2): 6 variables
  excelv3_78: [
    {
      id: "var-1",
      sourceType: "name",
      mode: "select",
    },
    {
      id: "var-2",
      sourceType: "static_text",
      mode: "custom",
      customText: "Credit Expert India",
      staticValue: "Credit Expert India",
    },
    {
      id: "var-3",
      sourceType: "total_amount",
      mode: "select",
      formatAsCurrency: false,
    },
    {
      id: "var-4",
      sourceType: "current_emi",
      mode: "select",
      formatAsCurrency: false,
    },
    {
      id: "var-5",
      sourceType: "new_emi",
      mode: "select",
      formatAsCurrency: false,
    },
    {
      id: "var-6",
      sourceType: "difference",
      mode: "difference",
      diffOperandA: "current_emi",
      diffOperandB: "new_emi",
      diffAbsolute: true,
      diffRound: true,
      formatAsCurrency: false,
    },
  ],

  // Preset for Template #72: reduce_emi ({{1}} Name, {{2}} Current EMI, {{3}} New EMI, {{4}} Company)
  reduce_emi_72: [
    {
      id: "var-1",
      sourceType: "name",
      mode: "select",
    },
    {
      id: "var-2",
      sourceType: "current_emi",
      mode: "select",
      formatAsCurrency: false,
    },
    {
      id: "var-3",
      sourceType: "new_emi",
      mode: "select",
      formatAsCurrency: false,
    },
    {
      id: "var-4",
      sourceType: "static_text",
      mode: "custom",
      customText: "Credit Expert India",
      staticValue: "Credit Expert India",
    },
  ],

  // Preset for Template #71: crminqueri (5 variables)
  crminqueri_71: [
    {
      id: "var-1",
      sourceType: "name",
      mode: "select",
    },
    {
      id: "var-2",
      sourceType: "current_emi",
      mode: "select",
      formatAsCurrency: false,
    },
    {
      id: "var-3",
      sourceType: "new_emi",
      mode: "select",
      formatAsCurrency: false,
    },
    {
      id: "var-4",
      sourceType: "static_text",
      mode: "custom",
      customText: "Bank",
      staticValue: "Bank",
    },
    {
      id: "var-5",
      sourceType: "static_text",
      mode: "custom",
      customText: "Manager",
      staticValue: "Manager",
    },
  ],

  // 1-Variable preset for Template #69
  marketing_69: [
    {
      id: "var-1",
      sourceType: "name",
      mode: "select",
    },
  ],

  // 5-Variable savings pitch (Name, Loan Amount, Current EMI, New EMI, Monthly Savings)
  savings_pitch_5: [
    {
      id: "var-1",
      sourceType: "name",
      mode: "select",
    },
    {
      id: "var-2",
      sourceType: "total_amount",
      mode: "select",
      formatAsCurrency: false,
    },
    {
      id: "var-3",
      sourceType: "current_emi",
      mode: "select",
      formatAsCurrency: false,
    },
    {
      id: "var-4",
      sourceType: "new_emi",
      mode: "select",
      formatAsCurrency: false,
    },
    {
      id: "var-5",
      sourceType: "emi_diff",
      mode: "select",
      formatAsCurrency: false,
    },
  ],
};
