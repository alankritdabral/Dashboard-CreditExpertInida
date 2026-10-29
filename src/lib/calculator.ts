// Pure EMI calculations - illustrative only
export function calculateEMI(principal: number, annualRatePercent: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  if (annualRatePercent <= 0) return principal / tenureMonths;
  const r = annualRatePercent / 12 / 100;
  const pow = Math.pow(1 + r, tenureMonths);
  return (principal * r * pow) / (pow - 1);
}

export function calculateTotalRepayment(emi: number, tenureMonths: number): number {
  return emi * tenureMonths;
}

export type CalculatorInput = {
  existingLoanAmount: number;
  ccOutstanding: number;
  currentMonthlyEMI: number;
  currentRate: number;
  tenureMonths: number;
  illustrativeRate: number;
};

export type CalculatorOutput = {
  totalPrincipal: number;
  currentEMI: number;
  illustrativeEMI: number;
  monthlyDifference: number;
  currentTotalRepayment: number;
  illustrativeTotalRepayment: number;
};

export function getCalculatorOutput(input: CalculatorInput): CalculatorOutput {
  const totalPrincipal = input.existingLoanAmount + input.ccOutstanding;
  const illustrativeEMI = calculateEMI(totalPrincipal, input.illustrativeRate, input.tenureMonths);
  const currentTotalRepayment = input.currentMonthlyEMI * input.tenureMonths;
  const illustrativeTotalRepayment = calculateTotalRepayment(illustrativeEMI, input.tenureMonths);
  return {
    totalPrincipal,
    currentEMI: input.currentMonthlyEMI,
    illustrativeEMI,
    monthlyDifference: input.currentMonthlyEMI - illustrativeEMI,
    currentTotalRepayment,
    illustrativeTotalRepayment,
  };
}
