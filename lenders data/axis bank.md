Axis Bank — Personal Loan Policy

> Source: Axis Bank policy creatives supplied by the user.
>
> Product: Personal Loan  
> Policy: 7 Years Policy Loan

---

## 1. Product Overview

| Parameter | Details |
|---|---|
| Lender | Axis Bank |
| Product | Personal Loan |
| Maximum Loan Amount | ₹40 Lakh |
| Maximum Tenure | 84 Months / 7 Years |
| Fresh Loan | Available |
| Internal PL Top-Up | Available |
| External PL Balance Transfer | Available |
| Maximum FOIR | Up to 70% |
| CIBIL | As per revised norms |

---

## 2. Eligible Customer Categories

The policy mentions the following categories:

- SCATA
- A
- B
- C
- Selected Central Government
- CSG Government

---

## 3. Minimum Net Take-Home Salary

| Customer Segment | Minimum NTH |
|---|---:|
| CSG | ₹35,000 |
| Non-CSG CASA | ₹50,000 |
| NTB | ₹75,000 |
| Blue Collar Staff | ₹2,00,000 |

### Non-CSG CASA Requirement

For Non-CSG CASA customers:

- CASA account vintage of **90 days or above** is required.

---

# 4. CIBIL Segment — Revised Norms

## CSG — HIT

Two eligibility conditions are shown:

### Option 1

- NMI: ₹35,000–₹85,000
- CIBIL: **≥ 740**

### Option 2

- NMI: **> ₹85,000**
- CIBIL: **≥ 700**

---

## NCSG — HIT

- NMI: **₹50,000**
- CIBIL: **≥ 740**

---

## NTB — HIT

### Option 1

- NMI: ₹75,000–₹1,00,000
- CIBIL: **≥ 780**

### Option 2

- NMI: **> ₹1,00,000**
- CIBIL: **≥ 740**

---

# 5. Not Eligible Cases

The policy creative specifically lists the following as not eligible:

- Bureau Derog customers
- Government school teachers
- Class IV employees
- Credit Card BT cases
- Flexi Overdraft BT cases
- Local municipality staff
- Defence & Army
- App score re-look cases
- State Government employees

---

# 6. Balance Transfer

Axis Bank supports:

- External Personal Loan Balance Transfer
- Internal Personal Loan Top-Up

### BT Restrictions

The supplied policy specifically states that the following are **not eligible**:

- Credit Card BT
- Flexi Overdraft BT

---

# 7. Axis PL — USP / Flexibility

The second policy creative highlights the following Axis Bank Personal Loan features.

---

## 7.1 Gold Loan Obligation

### Axis Bank

- **Nil obligation** for Gold Loan

The comparison creative shows:

| Lender | Gold Loan Obligation |
|---|---|
| Axis Bank | Nil obligation |
| HDFC Bank | 1% |
| ICICI Bank | 1% |

For Axis Bank, the supplied creative therefore indicates:

```text
GOLD_LOAN_OBLIGATION = 0%
8. Number of Balance Transfers

Axis Bank's USP creative states:

N number of BTs can be done

Compared with:

HDFC Bank: 3 BT
ICICI Bank: 3 BT

Therefore, the Axis policy creative does not specify a fixed numeric maximum for BTs.

MAX_BT = N

N should be treated as policy-defined rather than converted into a numeric limit.

9. Credit Card Balance Transfer

Axis Bank's USP creative states:

N number of CC BT can be done

However, the 7-year policy creative separately lists:

Credit Card BT cases as not eligible

Therefore, for implementation, the latest/current applicable policy should determine whether CC BT is permitted.

CC_BT = POLICY_DEPENDENT

Do not automatically mark CC BT as eligible based only on the USP creative.

10. Credit Card Obligation

Axis Bank:

4% of Credit Card Outstanding (CC O/S)
CC_OBLIGATION = 4% OF CC_OUTSTANDING
11. Existing Personal Loan Non-Obligation

Axis Bank:

Existing PL with less than 6 EMIs can be treated as non-obligation.
EXISTING_PL:
  IF REMAINING_EMI < 6:
      NON_OBLIGATION = YES
12. Existing Home Loan Non-Obligation

Axis Bank:

Existing HL with less than 12 EMIs can be treated as non-obligation.
EXISTING_HL:
  IF REMAINING_EMI < 12:
      NON_OBLIGATION = YES
13. Bonus Add-Back

Axis Bank permits bonus consideration as shown in the USP creative.

Applicable Bonus Frequency
Quarterly
Half-yearly
Yearly
Consideration
50% considered
BONUS_ADD_BACK = 50%
14. Loan Amount
Maximum Loan Amount
MAX_LOAN_AMOUNT = ₹40,00,000
Tenure
MAX_TENURE = 84 MONTHS

The product is specifically promoted as a:

7 Years Policy Loan

15. FOIR

Maximum FOIR shown:

MAX_FOIR = 70%
16. Fresh / Top-Up / BT

Axis Bank's policy supports the following structures:

Fresh Personal Loan
FRESH_PL = YES
Internal Personal Loan Top-Up
INTERNAL_PL_TOPUP = YES
External Personal Loan Balance Transfer
EXTERNAL_PL_BT = YES
17. Customer Segment Summary
Segment	Minimum NTH	CIBIL Requirement
CSG	₹35K	≥740 for ₹35K–₹85K NMI; ≥700 above ₹85K
Non-CSG CASA	₹50K	≥740
NTB	₹75K	≥780 for ₹75K–₹1L; ≥740 above ₹1L
Blue Collar Staff	₹2L	As per applicable revised norms
18. Non-CSG CASA

For Non-CSG CASA customers:

MIN_NTH = ₹50,000
CASA_VINTAGE = >= 90 DAYS
19. Key Exclusions
NOT_ELIGIBLE:
  - BUREAU_DEROG_CUSTOMER
  - GOVERNMENT_SCHOOL_TEACHER
  - CLASS_IV_EMPLOYEE
  - CREDIT_CARD_BT
  - FLEXI_OD_BT
  - LOCAL_MUNICIPALITY_STAFF
  - DEFENCE_AND_ARMY
  - APP_SCORE_RELOOK_CASE
  - STATE_GOVERNMENT_EMPLOYEE
20. Axis Bank Eligibility Engine
LENDER = AXIS_BANK

PRODUCT = PERSONAL_LOAN

MAX_LOAN_AMOUNT = 4000000
MAX_TENURE = 84_MONTHS
MAX_FOIR = 70%

PRODUCT_OPTIONS:
  FRESH_PL = YES
  INTERNAL_PL_TOPUP = YES
  EXTERNAL_PL_BT = YES

MIN_NTH:
  CSG = 35000
  NON_CSG_CASA = 50000
  NTB = 75000
  BLUE_COLLAR = 200000

NON_CSG_CASA:
  CASA_VINTAGE >= 90_DAYS

CIBIL:
  CSG:
    NMI_35K_TO_85K:
      CIBIL >= 740
    NMI_ABOVE_85K:
      CIBIL >= 700

  NCSG_HIT:
    NMI >= 50000
    CIBIL >= 740

  NTB:
    NMI_75K_TO_100K:
      CIBIL >= 780
    NMI_ABOVE_100K:
      CIBIL >= 740

CC_OBLIGATION:
  4% OF CC_OUTSTANDING

EXISTING_PL:
  REMAINING_EMI < 6 = NON_OBLIGATION

EXISTING_HL:
  REMAINING_EMI < 12 = NON_OBLIGATION

GOLD_LOAN:
  OBLIGATION = 0%

BONUS:
  FREQUENCY:
    - QUARTERLY
    - HALF_YEARLY
    - YEARLY
  ADD_BACK = 50%

BT:
  PL_BT = YES
  MAX_BT = N

CC_BT:
  POLICY_DEPENDENT
  CURRENT_POLICY_CREATIVE = NOT_ELIGIBLE

FLEXI_OD_BT:
  NOT_ELIGIBLE = YES
21. Quick Reference
Parameter	Axis Bank
Product	Personal Loan
Maximum Loan	₹40 Lakh
Maximum Tenure	84 Months
Maximum FOIR	70%
Fresh PL	Yes
Internal PL Top-Up	Yes
External PL BT	Yes
CSG Minimum NTH	₹35K
Non-CSG CASA Minimum NTH	₹50K
NTB Minimum NTH	₹75K
Blue Collar Minimum NTH	₹2L
Non-CSG CASA Vintage	90+ days
CC Obligation	4% of CC O/S
Gold Loan Obligation	Nil
Existing PL <6 EMI	Non-obligation
Existing HL <12 EMI	Non-obligation
Bonus Add-back	50%
Credit Card BT	Not eligible in 7-year policy creative
Flexi OD BT	Not eligible
Bureau Derog	Not eligible
Defence & Army	Not eligible
State Govt Employees	Not eligible
Govt School Teachers	Not eligible
Class IV Employees	Not eligible
22. Important Policy Note

There is a policy inconsistency within the supplied Axis Bank creatives regarding Credit Card BT:

The 7-year policy creative lists Credit Card BT cases as not eligible.
The USP comparison creative states "N no of CC BT can do."

Because the creatives conflict, Credit Card BT should not be automatically approved by the eligibility engine. The current applicable Axis Bank policy should be verified before treating CC BT as eligible.

All other underwriting, documentation, credit and sanction conditions remain subject to the applicable Axis Bank policy.