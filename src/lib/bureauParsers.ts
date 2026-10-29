export interface BureauSummary {
  totalAccounts: number;
  currentBalance: number;
  highCreditAmount: number;
  overdueBalance: number;
  overdueAccounts: number;
  zeroBalanceAccounts: number;
}

export interface BureauAccount {
  accountNumber: string;
  accountType: string;
  currentBalance: number;
  highCreditAmount: number;
  memberShortName: string;
  dateOpened: string;
  dateReported: string;
  emiAmount: number;
  interest_rate: number;
  repaymentTenure?: string;
}

export interface BureauEnquiry {
  memberShortName: string;
  enquiryDate: string;
  enquiryAmount: number;
}

export interface BureauInquirySummary {
  totalInquiry: number;
  inquiryPast30Days?: number;
  inquiryPast12Months?: number;
  inquiryPast24Months?: number;
}

export interface ParsedBureauData {
  accountSummary: BureauSummary | null;
  inquirySummary: BureauInquirySummary | null;
  accounts: BureauAccount[];
  enquiries: BureauEnquiry[];
  personalInfo: any;
}

const ACCOUNT_TYPES: Record<string, string> = {
  "00": "Other",
  "01": "Auto Loan (Personal)",
  "02": "Housing Loan",
  "03": "Property Loan",
  "04": "Loan Against Shares/Securities",
  "05": "Personal Loan",
  "06": "Consumer Loan",
  "07": "Gold Loan",
  "08": "Education Loan",
  "09": "Loan to Professional",
  "10": "Credit Card",
  "11": "Leasing",
  "12": "Overdraft",
  "13": "Two-wheeler Loan",
  "14": "Non-Funded Credit Facility (NFCF)",
  "15": "Loan Against Bank Deposits (LABD)",
  "16": "Fleet Card",
  "17": "Commercial Vehicle Loan",
  "18": "Telco - Wireless",
  "19": "Telco - Broadband",
  "20": "Telco - Landline",
  "21": "Seller Financing",
  "22": "Seller Financing Soft",
  "23": "GECL Loan - Secured",
  "24": "GECL Loan - Unsecured",
  "31": "Secured Credit Card",
  "32": "Used Car Loan",
  "33": "Construction Equipment Loan",
  "34": "Tractor Loan",
  "35": "Corporate Credit Card",
  "36": "Kisan Credit Card",
  "37": "Loan on Credit Card",
  "38": "PM Jan Dhan Yojana - Overdraft",
  "39": "Mudra Loan - Shishu/Kishor/Tarun",
  "40": "Microfinance - Business Loan",
  "41": "Microfinance - Personal Loan",
  "42": "Microfinance - Housing Loan",
  "43": "Microfinance - Other",
  "44": "PMAY - Credit Linked Subsidy Scheme (CLSS)",
  "45": "P2P Personal Loan",
  "46": "P2P Auto Loan",
  "47": "P2P Education Loan",
  "50": "Business Loan - Secured",
  "51": "Business Loan - General",
  "52": "Business Loan - Priority Sector - Small Business",
  "53": "Business Loan - Priority Sector - Agriculture",
  "54": "Business Loan - Priority Sector - Others",
  "55": "Business Non-Funded Credit Facility - General",
  "56": "Business NFCF - Priority Sector - Small Business",
  "57": "Business NFCF - Priority Sector - Agriculture",
  "58": "Business NFCF - Priority Sector - Others",
  "59": "Business Loan Against Bank Deposits",
  "61": "Business Loan - Unsecured",
  "64": "Insurance",
  "80": "Microfinance Detailed Report",
  "81": "Summary Report",
  "88": "Locate Plus for Insurance",
  "90": "Account Review",
  "91": "Retro Enquiry",
  "92": "Locate Plus",
  "97": "Adviser Liability",
  "98": "Secured - Account Group for Portfolio Review",
  "99": "Unsecured - Account Group for Portfolio Review"
};

function getAccountTypeString(code: string | undefined | null, fallback: string | undefined | null = ""): string {
  if (!code) return fallback || "Unknown";
  const strCode = String(code).trim();
  const mapped = ACCOUNT_TYPES[strCode];
  if (mapped) {
    return `${strCode} - ${mapped}`;
  }
  return fallback || strCode || "Unknown";
}

export function parseBureauData(bureau: string, data: any): ParsedBureauData {
  const isEquifax = bureau.startsWith("v2");
  const isExperian = bureau.startsWith("experian");
  const isCrif = bureau.startsWith("crif");

  let accountSummary: BureauSummary | null = null;
  let inquirySummary: BureauInquirySummary | null = null;
  let accounts: BureauAccount[] = [];
  let enquiries: BureauEnquiry[] = [];
  let personalInfo: any = null;

  if (!data) {
    return { accountSummary, inquirySummary, accounts, enquiries, personalInfo };
  }

  if (isEquifax) {
    // Equifax JSON parsing
    const cirDataList = data?.credit_report?.CCRResponse?.CIRReportDataLst || [];
    const firstCirData = cirDataList[0]?.CIRReportData;
    personalInfo = firstCirData?.IDAndContactInfo?.PersonalInfo;

    if (cirDataList.length > 0) {
      enquiries = cirDataList.map((item: any) => ({
        memberShortName: item.InquiryResponseHeader?.CustomerName || "Unknown Lender",
        enquiryDate: item.InquiryResponseHeader?.Date || "N/A",
        enquiryAmount: Number(item.InquiryRequestInfo?.TransactionAmount || 0)
      }));
      inquirySummary = { totalInquiry: cirDataList.length };
    }

    const retailAccounts = firstCirData?.RetailAccountDetails || [];
    
    accounts = retailAccounts.map((acc: any) => ({
      accountNumber: acc.AccountNumber || "N/A",
      accountType: getAccountTypeString(acc.AccountType, acc.AccountType),
      currentBalance: Number(acc.Balance || 0),
      highCreditAmount: Number(acc.SanctionAmount || 0),
      memberShortName: acc.Institution || "Unknown Lender",
      dateOpened: acc.DateOpened || "N/A",
      dateReported: acc.DateReported || "N/A",
      emiAmount: Number(acc.InstallmentAmount || acc.EMIAmount || 0),
      interest_rate: Number(acc.InterestRate || 0),
      repaymentTenure: acc.RepaymentTenure || "N/A",
      pastDueAmount: Number(acc.PastDueAmount || 0)
    }));

    let currentBalance = 0;
    let highCreditAmount = 0;
    let overdueBalance = 0;
    let overdueAccounts = 0;
    let zeroBalanceAccounts = 0;

    retailAccounts.forEach((acc: any) => {
      const bal = Number(acc.Balance || 0);
      const pastDue = Number(acc.PastDueAmount || 0);
      
      currentBalance += bal;
      highCreditAmount += Number(acc.SanctionAmount || 0);
      overdueBalance += pastDue;
      
      if (pastDue > 0) overdueAccounts += 1;
      if (bal === 0) zeroBalanceAccounts += 1;
    });

    accountSummary = {
      totalAccounts: accounts.length,
      currentBalance,
      highCreditAmount,
      overdueBalance,
      overdueAccounts,
      zeroBalanceAccounts
    };

  } else if (isExperian) {
    // Experian JSON parsing
    console.log("[DEBUG EXPERIAN] Starting parse. Original data:", JSON.parse(JSON.stringify(data || {})));
    let rJson = data?.result_json || data?.data?.result_json;
    console.log("[DEBUG EXPERIAN] Raw rJson:", rJson);
    if (typeof rJson === 'string') {
      try { 
        rJson = JSON.parse(rJson); 
        console.log("[DEBUG EXPERIAN] Parsed string rJson successfully:", rJson);
      } catch(e) {
        console.error("[DEBUG EXPERIAN] Failed to parse string rJson:", e);
      }
    }
    const expReport = rJson?.INProfileResponse || data?.credit_report;
    console.log("[DEBUG EXPERIAN] expReport extracted:", expReport);
    console.log("[DEBUG EXPERIAN] SCORE object inside expReport:", expReport?.SCORE || expReport?.Score);
    let caisAccounts = expReport?.CAIS_Account?.CAIS_Account_DETAILS || [];
    if (!Array.isArray(caisAccounts)) {
      caisAccounts = [caisAccounts];
    }
    const formatExpDate = (d: string) => (d && d.length === 8) ? `${d.slice(6,8)}-${d.slice(4,6)}-${d.slice(0,4)}` : (d || "N/A");
    accounts = caisAccounts.map((acc: any) => {
      const emiStr = (acc.Scheduled_Monthly_Payment_Amount || "0").toString().replace(/,/g, '');
      const currBal = (acc.Current_Balance || "0").toString().replace(/,/g, '');
      const highCred = (acc.Highest_Credit_or_Original_Loan_Amount || "0").toString().replace(/,/g, '');
      
      return {
        accountNumber: acc.Account_Number || "N/A",
        accountType: getAccountTypeString(acc.Account_Type, acc.Account_Type),
        currentBalance: Number(currBal) || 0,
        highCreditAmount: Number(highCred) || 0,
        memberShortName: acc.Subscriber_Name || "Unknown Lender",
        dateOpened: formatExpDate(acc.Open_Date),
        dateReported: formatExpDate(acc.Date_Reported),
        emiAmount: Number(emiStr) || 0,
        interest_rate: Number(acc.Rate_of_Interest || 0),
        repaymentTenure: acc.Repayment_Tenure || "N/A",
        pastDueAmount: Number((acc.Amount_Past_Due || "0").toString().replace(/,/g, '')) || 0
      };
    });
    
    let currentBalance = 0;
    let highCreditAmount = 0;
    let overdueBalance = 0;
    let overdueAccounts = 0;
    let zeroBalanceAccounts = 0;

    caisAccounts.forEach((acc: any) => {
      const bal = Number((acc.Current_Balance || "0").toString().replace(/,/g, '')) || 0;
      const pastDue = Number((acc.Amount_Past_Due || "0").toString().replace(/,/g, '')) || 0;
      const highCred = Number((acc.Highest_Credit_or_Original_Loan_Amount || "0").toString().replace(/,/g, '')) || 0;
      
      currentBalance += bal;
      highCreditAmount += highCred;
      overdueBalance += pastDue;
      
      if (pastDue > 0) overdueAccounts += 1;
      if (bal === 0) zeroBalanceAccounts += 1;
    });

    const summary = expReport?.CAIS_Account?.CAIS_Summary?.Credit_Account;
    
    accountSummary = {
      totalAccounts: Number(summary?.CreditAccountTotal || accounts.length),
      currentBalance,
      highCreditAmount,
      overdueBalance,
      overdueAccounts: Number(summary?.CreditAccountDefault || overdueAccounts),
      zeroBalanceAccounts: Number(summary?.CreditAccountClosed || zeroBalanceAccounts)
    };
    
    let capsDetails = expReport?.CAPS?.CAPS_Application_Details || [];
    if (!Array.isArray(capsDetails)) {
      capsDetails = [capsDetails];
    }
    enquiries = capsDetails.map((inq: any) => ({
      memberShortName: inq.Subscriber_Name || "Unknown Lender",
      enquiryDate: formatExpDate(inq.Date_of_Request),
      enquiryAmount: Number((inq.Amount_Financed || "0").toString().replace(/,/g, '')) || 0
    }));

    const capsSummary = expReport?.CAPS?.CAPS_Summary;
    inquirySummary = {
      totalInquiry: Number(capsSummary?.CAPSTotal || enquiries.length),
      inquiryPast30Days: Number(capsSummary?.CAPSLast30Days || 0)
    };

    if (expReport?.SCORE) {
      personalInfo = {
        score: expReport.SCORE.BureauScore || 0,
        email: expReport?.Current_Application?.Current_Application_Details?.Email_Address || "",
        factors: [],
        scoreName: "Experian Bureau Score",
        scoreDescription: ""
      };
    } else if (expReport?.Score) {
      personalInfo = {
        score: expReport.Score.BureauScore || 0,
        email: expReport?.Current_Application?.Current_Application_Details?.Email_Address || "",
        factors: [],
        scoreName: "Experian Bureau Score",
        scoreDescription: ""
      };
    }
  } else if (isCrif) {
    // CRIF JSON parsing
    const report = data?.result_json?.credit_report || data?.credit_report || {};
    const newReport = data?.result_json?.parsed_data?.["B2C-REPORT"]?.["REPORT-DATA"]?.["STANDARD-DATA"];
    
    if (newReport) {
      const tradelines = newReport.TRADELINES || [];
      accounts = tradelines.map((loan: any) => {
        let emiStr = String(loan["INSTALLMENT-AMT"] || "0");
        emiStr = emiStr.split('/')[0].replace(/,/g, '');
        
        const currBal = String(loan["CURRENT-BAL"] || "0").replace(/,/g, '');
        const highCred = String(loan["DISBURSED-AMT"] || loan["CREDIT-LIMIT"] || "0").replace(/,/g, '');
        
        return {
          accountNumber: loan["ACCT-NUMBER"] || "N/A",
          accountType: getAccountTypeString(loan["ACCT-TYPE"], loan["ACCT-TYPE"]),
          currentBalance: Number(currBal) || 0,
          highCreditAmount: Number(highCred) || 0,
          memberShortName: loan["CREDIT-GRANTOR"] || "Unknown Lender",
          dateOpened: loan["DISBURSED-DT"] || "N/A",
          dateReported: loan["REPORTED-DT"] || "N/A",
          emiAmount: Number(emiStr) || 0,
          interest_rate: Number(loan["INTEREST-RATE"] || 0),
          repaymentTenure: loan["REPAYMENT-TENURE"] || "N/A",
          pastDueAmount: Number(String(loan["OVERDUE-AMT"] || "0").replace(/,/g, '')) || 0
        };
      });

      const inquiries = newReport["INQUIRY-HISTORY"] || [];
      enquiries = inquiries.map((inq: any) => ({
        memberShortName: inq["LENDER-NAME"] || "Unknown Lender",
        enquiryDate: inq["INQUIRY-DT"] || "N/A",
        enquiryAmount: Number(String(inq["AMOUNT"] || "0").replace(/,/g, '')) || 0
      }));
      
      inquirySummary = {
        totalInquiry: inquiries.length
      };

      let currentBalance = 0;
      let highCreditAmount = 0;
      let overdueBalance = 0;
      let overdueAccounts = 0;
      let zeroBalanceAccounts = 0;

      accounts.forEach(acc => {
        currentBalance += acc.currentBalance;
        highCreditAmount += acc.highCreditAmount;
        if (acc.currentBalance <= 0) zeroBalanceAccounts += 1;
        const pastDue = (acc as any).pastDueAmount || 0;
        overdueBalance += pastDue;
        if (pastDue > 0) overdueAccounts += 1;
      });

      accountSummary = {
        totalAccounts: accounts.length,
        currentBalance,
        highCreditAmount,
        overdueBalance,
        overdueAccounts,
        zeroBalanceAccounts
      };
      
      const scoreData = newReport.SCORE?.[0];
      let crifEmail = "";
      const addresses = newReport["ADDRESSES"] || [];
      const pInfo = newReport["PERSONAL-INFO"] || [];
      if (pInfo.length > 0 && pInfo[0]["EMAIL-ID"]) crifEmail = pInfo[0]["EMAIL-ID"];
      
      if (scoreData || crifEmail) {
        personalInfo = {
           score: scoreData?.VALUE || 0,
           email: crifEmail,
           factors: scoreData?.FACTORS || [],
           scoreName: scoreData?.NAME || "",
           scoreDescription: scoreData?.DESCRIPTION || ""
        };
      }
    } else {
      const responses = report?.RESPONSES?.RESPONSE || [];
      
      accounts = responses.map((res: any) => {
        const loan = res["LOAN-DETAILS"] || {};
        
        let emiStr = String(loan["INSTALLMENT-AMT"] || "0");
        emiStr = emiStr.split('/')[0].replace(/,/g, '');
        
        const currBal = String(loan["CURRENT-BAL"] || "0").replace(/,/g, '');
        const highCred = String(loan["DISBURSED-AMT"] || loan["CREDIT-LIMIT"] || "0").replace(/,/g, '');
        
        return {
          accountNumber: loan["ACCT-NUMBER"] || "N/A",
          accountType: getAccountTypeString(loan["ACCT-TYPE"], loan["ACCT-TYPE"]),
          currentBalance: Number(currBal) || 0,
          highCreditAmount: Number(highCred) || 0,
          memberShortName: loan["CREDIT-GUARANTOR"] || "Unknown Lender",
          dateOpened: loan["DISBURSED-DT"] || "N/A",
          dateReported: loan["DATE-REPORTED"] || "N/A",
          emiAmount: Number(emiStr) || 0,
          interest_rate: Number(loan["INTEREST-RATE"] || 0),
          repaymentTenure: loan["REPAYMENT-TENURE"] || "N/A",
          pastDueAmount: Number(String(loan["OVERDUE-AMT"] || "0").replace(/,/g, '')) || 0
        };
      });

      const inquiries = report?.["INQUIRY-HISTORY"]?.HISTORY || [];
      enquiries = inquiries.map((inq: any) => ({
        memberShortName: inq["MEMBER-NAME"] || "Unknown Lender",
        enquiryDate: inq["INQUIRY-DATE"] || "N/A",
        enquiryAmount: Number(String(inq["AMOUNT"] || "0").replace(/,/g, '')) || 0
      }));
      
      inquirySummary = {
        totalInquiry: inquiries.length
      };
      
      const primarySummary = report?.["ACCOUNTS-SUMMARY"]?.["PRIMARY-ACCOUNTS-SUMMARY"] || {};
      
      let currentBalance = 0;
      let highCreditAmount = 0;
      let overdueBalance = 0;
      let overdueAccounts = 0;
      let zeroBalanceAccounts = 0;

      accounts.forEach(acc => {
        currentBalance += acc.currentBalance;
        highCreditAmount += acc.highCreditAmount;
        if (acc.currentBalance === 0) zeroBalanceAccounts += 1;
      });

      responses.forEach((res: any) => {
         const loan = res["LOAN-DETAILS"] || {};
         const od = Number(String(loan["OVERDUE-AMT"] || "0").replace(/,/g, '')) || 0;
         overdueBalance += od;
         if (od > 0) overdueAccounts += 1;
      });

      accountSummary = {
        totalAccounts: Number(primarySummary["PRIMARY-NUMBER-OF-ACCOUNTS"] || accounts.length),
        currentBalance,
        highCreditAmount,
        overdueBalance,
        overdueAccounts: Number(primarySummary["PRIMARY-OVERDUE-NUMBER-OF-ACCOUNTS"] || overdueAccounts),
        zeroBalanceAccounts
      };
    }
  } else {
    // CIBIL (TransUnion V5 IDSPay) Parsing
    let report: any = null;
    let trueLinkReport: any = null;
    
    // Check if it's the new IDSPay format
    if (data?.steps) {
      const assetsStep = data.steps.find((s: any) => s.name === "GetCustomerAssets");
      trueLinkReport = assetsStep?.response?.GetCustomerAssetsResponse?.GetCustomerAssetsSuccess?.Asset?.TrueLinkCreditReport;
      
      if (trueLinkReport) {
        let cScore = trueLinkReport.Borrower?.CreditScore;
        if (Array.isArray(cScore)) cScore = cScore[0];
        
        let cEmail = "";
        const emailArr = trueLinkReport.Borrower?.EmailAddress;
        if (Array.isArray(emailArr) && emailArr.length > 0) {
          cEmail = emailArr[0].Email || "";
        } else if (emailArr?.Email) {
          cEmail = emailArr.Email;
        }

        personalInfo = {
            score: cScore?.riskScore || 0,
            email: cEmail
        };

        const tradeLines = trueLinkReport.TradeLinePartition || [];
        accounts = tradeLines.map((partition: any) => {
          const tl = partition.Tradeline || {};
          return {
            accountNumber: tl.accountNumber || "N/A",
            accountType: getAccountTypeString(tl.AccountType?.symbol, partition.accountTypeDescription || partition.accountTypeAbbreviation || tl.AccountType?.symbol),
            currentBalance: Number(tl.currentBalance || 0),
            highCreditAmount: Number(tl.highBalance || tl.CreditLimit || 0),
            memberShortName: tl.creditorName || "Unknown Lender",
            dateOpened: tl.dateOpened || "N/A",
            dateReported: tl.dateReported || "N/A",
            emiAmount: Number(tl.GrantedTrade?.EMIAmount && tl.GrantedTrade.EMIAmount !== "-1" ? tl.GrantedTrade.EMIAmount : 0),
            interest_rate: Number(tl.GrantedTrade?.interestRate && tl.GrantedTrade.interestRate !== "-1.00" ? tl.GrantedTrade.interestRate : 0),
            repaymentTenure: tl.termMonths && tl.termMonths !== "-1" ? tl.termMonths : "N/A",
            pastDueAmount: Number(tl.amountPastDue || 0)
          };
        });

        const inquiries = trueLinkReport.InquiryPartition || [];
        enquiries = inquiries.map((partition: any) => {
          const inq = partition.Inquiry || {};
          return {
            memberShortName: inq.subscriberName || "Unknown Lender",
            enquiryDate: inq.inquiryDate || "N/A",
            enquiryAmount: Number(inq.amount || 0)
          };
        });

        let currentBalance = 0;
        let highCreditAmount = 0;
        let overdueBalance = 0;
        let overdueAccounts = 0;
        let zeroBalanceAccounts = 0;

        accounts.forEach(acc => {
          currentBalance += acc.currentBalance;
          highCreditAmount += acc.highCreditAmount;
          overdueBalance += (acc as any).pastDueAmount || 0;
          if ((acc as any).pastDueAmount > 0) overdueAccounts += 1;
          if (acc.currentBalance <= 0) zeroBalanceAccounts += 1;
        });

        accountSummary = {
          totalAccounts: accounts.length,
          currentBalance,
          highCreditAmount,
          overdueBalance,
          overdueAccounts,
          zeroBalanceAccounts
        };

        inquirySummary = {
          totalInquiry: enquiries.length,
          inquiryPast30Days: undefined,
          inquiryPast12Months: undefined,
          inquiryPast24Months: undefined
        };
      }
    }

    // Fallback to old Surepass format if not IDSPay
    if (!trueLinkReport) {
      report = data?.credit_report?.[0];
      if (report) {
        const consumerSummary = report?.response?.consumerSummaryresp;
        if (consumerSummary?.accountSummary) {
            accountSummary = {
                totalAccounts: consumerSummary.accountSummary.totalAccounts || 0,
                currentBalance: consumerSummary.accountSummary.currentBalance || 0,
                highCreditAmount: consumerSummary.accountSummary.highCreditAmount || 0,
                overdueBalance: consumerSummary.accountSummary.overdueBalance || 0,
                overdueAccounts: consumerSummary.accountSummary.overdueAccounts || 0,
                zeroBalanceAccounts: consumerSummary.accountSummary.zeroBalanceAccounts || 0
            };
        }
        
        if (consumerSummary?.inquirySummary) {
            inquirySummary = {
                totalInquiry: consumerSummary.inquirySummary.totalInquiry || 0,
                inquiryPast30Days: consumerSummary.inquirySummary.inquiryPast30Days,
                inquiryPast12Months: consumerSummary.inquirySummary.inquiryPast12Months,
                inquiryPast24Months: consumerSummary.inquirySummary.inquiryPast24Months
            };
        }
        
        accounts = (report?.accounts || []).map((acc: any) => ({
          accountNumber: acc.accountNumber,
          accountType: getAccountTypeString(acc.accountType, acc.accountType),
          currentBalance: acc.currentBalance,
          highCreditAmount: acc.highCreditAmount,
          memberShortName: acc.memberShortName,
          dateOpened: acc.dateOpened,
          dateReported: acc.dateReported,
          emiAmount: acc.emiAmount,
          interest_rate: acc.interest_rate || 0,
          repaymentTenure: acc.repaymentTenure || "N/A"
        }));
        
        enquiries = (report?.enquiries || []).map((enq: any) => ({
            memberShortName: enq.memberShortName,
            enquiryDate: enq.enquiryDate,
            enquiryAmount: enq.enquiryAmount
        }));
      }
    }
  }

  return {
    accountSummary,
    inquirySummary,
    accounts,
    enquiries,
    personalInfo
  };
}
