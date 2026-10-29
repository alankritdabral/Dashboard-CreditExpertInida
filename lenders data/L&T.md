
### `lt-finance.md`

```md
# L&T Finance — Lender Policy

> Source: Channel-partner policy creatives supplied by the user.
>
> **Note:** The detailed BT and eligibility rules below are transcribed from the supplied creatives. Verify the latest lender/channel policy before using them for production eligibility decisions.

## 1. Basic Product Details

| Parameter | Details |
|---|---|
| Lender | L&T Finance |
| Product | Personal Loan |
| Customer Type | Salaried Customers |
| Coverage | PAN India |
| ROI shown in creative | Starting from 10.99% |
| Tenure | 12–72 months |
| Maximum FOIR | Up to 75%+ |
| Loan Calculation | Up to 72 months |

## 2. Personal Loan Highlights

- Loan amount calculation up to 72 months
- Credit card payment acceptance
- FI waiver for loans below ₹7.50 Lakh
- BT offering up to 16 app loans
- FOIR up to 75%+
- CIBIL -1 accepted
- CIBIL -1 funding up to ₹10 Lakh
- Multiple credit enquiries can be considered
- Recent funding can be considered

## 3. Customer Profile

| Profile | Status |
|---|---|
| WFH Profile | Accepted |
| Bachelor Profile | Accepted |
| PG Profile | Accepted |
| OHP | Not mandatory |
| Pension Income | Considered |
| Rental Income | Considered |
| Bonus | Considered |
| Incentive Income | Considered |

## 4. Balance Transfer

### BT Features

- Unlimited BT as per eligibility
- Up to 16 app loans
- OD BT available
- Multiple BT options available
- Up to 3 EMI de-obligation

## 5. BT Eligibility

The supplied policy states:

### Minimum Existing Loan Age

- At least **6 EMIs must be active** on the existing loan.

### Minimum Existing Loan Exposure

- Current loan exposure must be **₹2 Lakh or more**.

### FC Letter

- FC Letter is mandatory before sign-in.

## 6. BT Disbursement Conditions

BT sanction is based on:

- FC Letter
- BT DD proof

### Important

Without:

- FC Letter
- BT DD proof

the case will not be disbursed.

BT availability is limited to the listed partners and remains subject to L&T Finance credit policy and audit guidelines.

## 7. Listed BT Partners

| Partner | Type |
|---|---|
| South Indian Bank | BT |
| Northern Arc Capital Ltd | BT |
| MAS Financial Services Ltd | BT |
| TVS Credit Services Ltd | BT |
| DMI Finance Pvt Ltd | BT |
| Whizdm Finance Pvt Ltd | BT |
| KrazyBee Services Pvt Ltd | BT |
| PayU Finance India Pvt Ltd | BT |
| Clix Capital Services Pvt Ltd | BT |
| Credit Saison India / Kisetsu Saison Finance | BT |
| Vivriti Capital Ltd | BT |
| Groww Credit | BT |

## 8. Additional BT Names Shown

The supplied creative also displays:

- Finnable
- EarlyPay (Fibe)
- Money View
- KreditBee
- Navi Finserv
- InCred

## 9. Credit Policy Features

### CIBIL

- CIBIL -1 accepted
- CIBIL -1 funding up to ₹10 Lakh

### Credit Enquiries

- Multiple credit enquiries can be considered.

### Recent Funding

- Recent funding can be considered.

## 10. Income Consideration

The supplied creative states that the following may be considered:

- Rental income
- Bonus
- Incentive income
- Pension income

## 11. Repayment Features

| Feature | Details |
|---|---|
| Tenure | 12–72 months |
| Part Payment | Available |
| Foreclosure | Available after 6 months |
| EMI De-obligation | Up to 3 EMIs |

## 12. Process

- 100% digital process
- Zero paperwork stated in creative
- Quick processing
- 1-day TAT from login to disbursement
- 24×7 VKYC support
- PAN India sourcing

## 13. Policy Updates

### Update 1 — Loan Amount Calculation

Previous:

- 60-month calculation

Updated:

- 72-month calculation

Purpose:

- Enhanced loan eligibility.

### Update 2 — Credit Card Payment Acceptance

- Credit card payments accepted before or after login.
- Relevant payment proof/documentation must be submitted.

### Update 3 — FI Waiver

FI waiver applies to:

- Loan amount below ₹7.50 Lakh

## 14. Rule Summary for Eligibility Engine

```text
LENDER = LT_FINANCE

PRODUCT = PERSONAL_LOAN

CUSTOMER_TYPE = SALARIED
COVERAGE = PAN_INDIA

ROI_SHOWN = 10.99%
TENURE = 12–72 MONTHS
MAX_FOIR = 75%+

BT:
  APP_LOAN_BT = UP_TO_16
  UNLIMITED_BT_AS_PER_ELIGIBILITY = YES
  OD_BT = YES
  MAX_EMI_DEOBLIGATION = 3

BT_ELIGIBILITY:
  MIN_ACTIVE_EMI = 6
  MIN_CURRENT_EXPOSURE = 200000
  FC_LETTER_REQUIRED = YES
  BT_DD_PROOF_REQUIRED = YES

CIBIL:
  CIBIL_MINUS_1 = ACCEPTED
  CIBIL_MINUS_1_MAX_FUNDING = 1000000

PROFILE:
  WFH = YES
  BACHELOR = YES
  PG = YES
  OHP = NOT_MANDATORY

INCOME:
  RENTAL = YES
  BONUS = YES
  INCENTIVE = YES
  PENSION = YES

PROCESS:
  DIGITAL = YES
  VKYC = 24X7
  TAT = 1_DAY_LOGIN_TO_DISBURSEMENT

REPAYMENT:
  PART_PAYMENT = YES
  FORECLOSURE = AFTER_6_MONTHS

FI:
  FI_WAIVER_THRESHOLD = 750000