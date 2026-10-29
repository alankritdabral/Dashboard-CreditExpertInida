# Tata Capital — Personal Loan & Balance Transfer Policy

> Source: Tata Capital policy information previously provided for Credit Expert India.
>
> Note: The available source material supports the rules below. Any parameter not specified in the source should not be assumed and should be verified against the latest Tata Capital policy before production use.

---

## 1. Lender Overview

| Parameter | Details |
|---|---|
| Lender | Tata Capital |
| Product | Personal Loan |
| Balance Transfer | Available |
| PL + CC Merge | Available |
| Indicative ROI for PL + CC Merge | 10.99% |
| BT Loan Amount Condition | Financed amount must be > ₹5 Lakh |

---

## 2. Personal Loan

Tata Capital is considered as a lender for Personal Loan requirements.

### Product

- Personal Loan
- Fresh Personal Loan
- Balance Transfer
- Personal Loan + Credit Card consolidation

### Indicative ROI

- **10.99%** for PL + CC merge

> The ROI is indicative and subject to the applicable customer profile, lender credit policy and final sanction.

---

## 3. Balance Transfer

Tata Capital can be considered for eligible Balance Transfer cases.

### Eligible BT Structure

- Personal Loan BT
- Credit Card BT
- Personal Loan + Credit Card consolidation

### Minimum BT Financing Condition

For Tata Capital in the supplied 3–5 MOB lender list:

- BT loan amount financed must be **greater than ₹5 Lakh**

```text
TATA_CAPITAL_BT = AVAILABLE

TATA_CAPITAL_BT_MIN_FINANCED_AMOUNT = > ₹5,00,000
4. Personal Loan + Credit Card Merge

Tata Capital is included among the lenders available for:

Personal Loan + Credit Card merge
Consolidation of eligible unsecured liabilities
Balance Transfer of eligible Personal Loans
Credit Card outstanding consolidation where permitted
Indicative Rate
PL_CC_MERGE_ROI = 10.99%
5. Eligible Liability Types

For Credit Expert India's consolidation workflow, the relevant liability categories are:

Personal Loans
Credit Card Loans / Outstanding
Eligible App Loans
Multiple eligible unsecured loans

Final eligibility remains subject to Tata Capital's applicable policy.

6. Balance Transfer Condition
Tata Capital
IF:
    BT_LOAN_AMOUNT > ₹5,00,000

THEN:
    TATA_CAPITAL_BT = POTENTIALLY_ELIGIBLE

ELSE:
    TATA_CAPITAL_BT = NOT_ELIGIBLE_UNDER_THIS_RULE

This ₹5 Lakh condition specifically comes from the supplied lender list and should be treated as a policy rule for that sourcing channel.

7. Eligibility Parameters

The following parameters should be checked when evaluating a Tata Capital case:

Net Take-Home Salary
CIBIL / credit profile
Existing liabilities
Existing EMI obligations
FOIR
Employment profile
Company category
Existing loan tenure
BT loan amount
Credit Card outstanding
Required documentation

The available source material does not specify exact Tata Capital thresholds for all of these parameters.

Therefore, do not assume:

Minimum salary
Minimum CIBIL
Maximum loan amount
Maximum tenure
Maximum FOIR
Maximum number of BT loans
Exact documentation requirements

unless supported by a current Tata Capital policy.

8. Credit Expert India — Use Case

Tata Capital can be configured in the lender engine for:

Fresh Loan
PRODUCT = PERSONAL_LOAN
Balance Transfer
PRODUCT = BALANCE_TRANSFER
MIN_FINANCED_AMOUNT = > ₹5,00,000
PL + CC Consolidation
PRODUCT = PL_CC_MERGE
INDICATIVE_ROI = 10.99%
9. Lender Engine Configuration
LENDER:
  TATA_CAPITAL

PRODUCTS:
  - PERSONAL_LOAN
  - BALANCE_TRANSFER
  - PL_CC_MERGE

BALANCE_TRANSFER:
  AVAILABLE = TRUE
  MIN_FINANCED_AMOUNT = > 500000

PL_CC_MERGE:
  AVAILABLE = TRUE
  INDICATIVE_ROI = 10.99%

ELIGIBLE_LIABILITIES:
  - PERSONAL_LOAN
  - CREDIT_CARD
  - ELIGIBLE_APP_LOANS
  - MULTIPLE_UNSECURED_LOANS

ELIGIBILITY:
  NTH = REQUIRED
  CIBIL = REQUIRED
  FOIR = REQUIRED
  EXISTING_LIABILITIES = REQUIRED
  EMPLOYMENT_PROFILE = REQUIRED
  DOCUMENTATION = REQUIRED

FINAL_DECISION:
  SUBJECT_TO_LENDER_CREDIT_POLICY = TRUE
  SUBJECT_TO_DOCUMENT_VERIFICATION = TRUE
  SUBJECT_TO_FINAL_SANCTION = TRUE
10. Quick Reference
Rule	Tata Capital
Personal Loan	Yes
Balance Transfer	Yes
PL + CC Merge	Yes
Indicative PL + CC ROI	10.99%
BT Financed Amount	> ₹5 Lakh
Personal Loan BT	Yes
Credit Card BT	Yes
App Loan BT	Subject to eligibility
Multiple Loan Consolidation	Subject to eligibility
Final Approval	Subject to lender policy
11. Important

The key Tata Capital rules available in the supplied information are:

Tata Capital is included as a lender for PL + CC merge.
The indicative ROI provided for PL + CC merge is 10.99%.
Tata Capital is listed for 3–5 MOB PL BT.
For that BT listing, the BT loan amount financed must be greater than ₹5 Lakh.

All other eligibility, documentation, pricing, tenure, FOIR and credit-policy parameters should be obtained from the latest applicable Tata Capital policy before being used for automated customer eligibility or sanction decisions.