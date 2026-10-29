# Eligibility Engine Rule Updates

This document outlines the implementation plan for updating the eligibility engine based on the new credit policies from **Aditya Birla Capital**, **Chola**, and **L&T Finance**.

As the engine calculates eligibility separately for each bank, the primary change will be to capture **new input details** (e.g., App Loan BT details, specific incentive types, employment verification data) and feed them into the individual bank calculation modules.

## Proposed Changes

### 1. New Extra Details (Inputs) to Collect
To support the new bank rules, the engine's input payload must be expanded to collect the following extra details:

- **Income & Incentives:**
  - Rental Income (amount)
  - Specific Incentives (Monthly, Quarterly, Half-Yearly)
  - Bonus (Monthly, Quarterly, Yearly)
  - LTA (Leave Travel Allowance)
- **Balance Transfer (BT) Details:**
  - BT Type (Regular PL, Credit Card, App Loan, OD)
  - Number of Active EMIs for each BT
  - Current Exposure per BT
  - For App Loans: specific partner name (e.g., Finnable, Fibe, KreditBee)
  - Availability of FC Letter and BT DD Proof
  - Banking statement history duration available (1 month, 3 months, 6 months)
- **Verification & Documentation:**
  - WFH Status
  - Availability of Digital Employment Verification (EPFO, OMID, HRMS, 26AS)
- **Customer Profile:**
  - Detailed Company Category (CAT-A, CAT-B, CAT-C, CAT-D, Govt, Restricted)
  - Exact Location (to apply Delhi NCR multipliers)

*Crucially, the previous banks and NBFC eligibility modules will continue to work based on their previous values and logic. They will be updated in the future. For now, they can take the new information in the payload but will simply ignore it if it is not written in their current rules. There are no global rule overrides. If previous banks already used App Loan BTs, their existing logic will continue to process them seamlessly.*

---

### 2. Aditya Birla Capital Calculation Module
We will update the Aditya Birla specific calculator:

- **Income Consideration:** Add Rental (50%), Incentives, and Bonuses to the Net Take-Home (NTH).
- **FOIR:** Apply a maximum FOIR of `75%`.
- **Dynamic Loan Caps:**
  - Max ₹65L if: `NTH >= 250000` + `COMPANY_CATEGORY == A` + `RISK == VLR/LR`.
  - Max ₹50L if: `NTH >= 175000` + `COMPANY_CATEGORY == A` + `RISK == VLR/LR`.
- **BT Eligibility:** Enforce max 6 BTs for PL+CC, and max 5 BTs for CC-only. Apply the specific 3-5 MOB PL BT lender list condition.
- **FI Waivers:** Output FI waiver flag as `true` if `EPFO`, `OMID`, `HRMS`, or `26AS` inputs are provided.

---

### 3. Chola Calculation Module
We will update the Chola specific calculator (with Delhi NCR conditions):

- **Documentation Rules:** Ignore WFH documentation requirements. Check for `3_MONTHS` banking statement for BT, and `1_MONTH` for Credit Card BT.
- **Flexi OD Calculation:**
  - Add logic to compute eligibility for Flexi OD up to ₹30L (Min ₹10L) for Govt (NTH ₹1L+) and CAT-A/B (NTH ₹1.5L+).
  - Calculate using an 84-month tenure split (2 years Flexi + 5 years Drop-line). Output this as a distinct Flexi OD product structure.
- **CIBIL -1 Funding:**
  - Max ₹20L for Government profiles.
  - Max ₹10L for CAT-A/B profiles (requires Co-applicant input = true, Age <= 30).
- **Profile Restrictions:** Immediately set eligibility to `0` for restricted profiles (Manpower, Law, Collection, Police, Belt Jobs, Court).
- **Delhi NCR Modifiers:** Apply minimum CIBIL `700` and the specific Delhi location NTH multiplier.

---

### 4. L&T Finance Calculation Module
We will update the L&T Finance specific calculator:

- **Enhanced Tenure Calculation:** Calculate loan eligibility up to `72_MONTHS`.
- **App Loan BTs:** Accept the new App Loan input data. If the app loan is in the approved list (e.g., South Indian Bank, KreditBee, Fibe, etc.), has `>= 6` active EMIs, and `>= ₹2 Lakh` exposure, include it in BT calculations (up to 16 app loans). Only L&T will specifically filter for these new 16 partners for now, while legacy bank logic remains unchanged.
- **CIBIL -1 & FOIR:** Allow CIBIL -1 up to ₹10L. Apply `75%+` max FOIR.
- **FI Waivers:** Output FI waiver flag as `true` if calculated loan amount is `< ₹7.5 Lakh`.

## Verification Plan

### Automated Tests
- Pass the enriched input payload (with app loans, various incentives, and EPFO flags) into the engine.
- Write assertions to ensure Aditya Birla correctly bumps loan limits to ₹65L for CAT-A + ₹2.5L NTH profiles.
- Write assertions to ensure Chola correctly calculates the Flexi OD splits and rejects restricted profiles.
- Write assertions to ensure L&T correctly includes App Loans in its BT eligibility calculation and evaluates on a 72-month tenure.
- Write assertions to ensure a generic other bank (e.g., HDFC) receives the new payload but calculates its standard eligibility without failing.

### Manual Verification
- Dry-run a mock application via the UI or API containing the new extra details and verify the independent outputs for Aditya Birla, Chola, L&T, and a generic 4th bank.
