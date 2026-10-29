import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseBureauData } from '@/lib/bureauParsers';

const extractContactInfo = (bureau: string, data: any) => {
  let latestAddress = "N/A";
  let latestEmail = "N/A";
  let latestPhone = "N/A";
  if (!data) return { latestAddress, latestEmail, latestPhone };
  const strData = JSON.stringify(data);

  if (bureau.startsWith("crif")) {
    const newReport = data?.result_json?.parsed_data?.["B2C-REPORT"]?.["REPORT-DATA"]?.["STANDARD-DATA"];
    if (newReport?.DEMOGS?.VARIATIONS) {
      const addrVars = newReport.DEMOGS.VARIATIONS.find((v: any) => v.TYPE === "ADDRESS-VARIATIONS")?.VARIATION || [];
      if (addrVars.length > 0) latestAddress = addrVars[0].VALUE || "N/A";
      const emailVars = newReport.DEMOGS.VARIATIONS.find((v: any) => v.TYPE === "EMAIL-VARIATIONS")?.VARIATION || [];
      if (emailVars.length > 0) latestEmail = emailVars[0].VALUE || "N/A";
      const phoneVars = newReport.DEMOGS.VARIATIONS.find((v: any) => v.TYPE === "PHONE-VARIATIONS")?.VARIATION || [];
      if (phoneVars.length > 0) latestPhone = phoneVars[0].VALUE || "N/A";
    }
  } else if (bureau.startsWith("experian")) {
    const emailMatch = strData.match(/"EMailId"\s*:\s*"([^"]+)"/i);
    if (emailMatch && emailMatch[1]) latestEmail = emailMatch[1];
    
    const phoneMatch = strData.match(/"MobilePhoneNumber"\s*:\s*"([^"]+)"/i);
    if (phoneMatch && phoneMatch[1]) latestPhone = phoneMatch[1];
    
    const addrMatch = strData.match(/"First_Line_Of_Address_non_normalized"\s*:\s*"([^"]+)"/i);
    const addrMatch2 = strData.match(/"Second_Line_Of_Address_non_normalized"\s*:\s*"([^"]+)"/i);
    const cityMatch = strData.match(/"City_non_normalized"\s*:\s*"([^"]+)"/i);
    if (addrMatch && addrMatch[1]) {
      latestAddress = addrMatch[1] + (addrMatch2 && addrMatch2[1] ? " " + addrMatch2[1] : "") + (cityMatch && cityMatch[1] ? ", " + cityMatch[1] : "");
    }
  } else {
    const emailMatch = strData.match(/"Email"\s*:\s*"([^"]+)"/i) || strData.match(/"EmailAddress"\s*:\s*"([^"]+)"/i);
    if (emailMatch && emailMatch[1]) latestEmail = emailMatch[1];
    
    const phoneMatch = strData.match(/"phone_number"\s*:\s*"([^"]+)"/i) || strData.match(/"MobilePhoneNumber"\s*:\s*"([^"]+)"/i) || strData.match(/"TelephoneNumber"\s*:\s*"([^"]+)"/i) || strData.match(/"Number"\s*:\s*"([^"]+)"/i);
    if (phoneMatch && phoneMatch[1]) latestPhone = phoneMatch[1];
    
    const addrMatch = strData.match(/"StreetAddress"\s*:\s*"([^"]+)"/i) || strData.match(/"AddressLine1"\s*:\s*"([^"]+)"/i);
    const cityMatch = strData.match(/"City"\s*:\s*"([^"]+)"/i);
    if (addrMatch && addrMatch[1]) {
      latestAddress = addrMatch[1] + (cityMatch && cityMatch[1] ? ", " + cityMatch[1] : "");
    }
  }
  return { latestAddress, latestEmail, latestPhone };
};

const getExperianPaymentHistory = (cibilData: any, accountNumber: string) => {
  try {
    let rJson = cibilData?.result_json || cibilData?.data?.result_json;
    if (typeof rJson === 'string') rJson = JSON.parse(rJson);
    const expReport = rJson?.INProfileResponse || cibilData?.credit_report;
    let caisAccounts = expReport?.CAIS_Account?.CAIS_Account_DETAILS || [];
    if (!Array.isArray(caisAccounts)) caisAccounts = [caisAccounts];

    const rawAcc = caisAccounts.find((r: any) => r.Account_Number === accountNumber);
    if (rawAcc && rawAcc.CAIS_Account_History) {
      const hist = Array.isArray(rawAcc.CAIS_Account_History) ? rawAcc.CAIS_Account_History : [rawAcc.CAIS_Account_History];
      const dpdStr = hist.slice(0, 24).map((h: any) => h.Days_Past_Due || "0").join(" ");
      return dpdStr ? `DPD History (Last 24m): ${dpdStr}` : "";
    }
  } catch (e) {}
  return "";
};

const getCrifPaymentHistory = (cibilData: any, accountNumber: string) => {
  try {
    const responses = cibilData?.result_json?.parsed_data?.["B2C-REPORT"]?.["REPORT-DATA"]?.["STANDARD-DATA"]?.RESPONSES?.RESPONSE || [];
    const accList = Array.isArray(responses) ? responses : [responses];
    const acc = accList.find((a: any) => {
      const an = a?.["ACCOUNT-NUMBER"] || "";
      return an === accountNumber || an.includes(accountNumber) || accountNumber.includes(an);
    });
    if (acc && acc.HISTORY) {
      const historyArr = Array.isArray(acc.HISTORY) ? acc.HISTORY : [acc.HISTORY];
      const combined = historyArr.find((h: any) => h.NAME === "COMBINED-PAYMENT-HISTORY" || h.NAME === "PAYMENT-HISTORY");
      if (combined && combined.VALUES) {
        return `DPD History: ${combined.VALUES.split('|').filter(Boolean).slice(0, 24).join(' ')}`;
      }
    }
  } catch (e) {}
  return "";
};

const getGenericPaymentHistory = (cibilData: any, accountNumber: string) => {
  try {
    const assetsStep = cibilData?.steps?.find((s: any) => s.name === "GetCustomerAssets");
    const trueLinkReport = assetsStep?.response?.GetCustomerAssetsResponse?.GetCustomerAssetsSuccess?.Asset?.TrueLinkCreditReport;
    if (trueLinkReport) {
      const tradeLines = trueLinkReport.TradeLinePartition || [];
      const tlPartition = tradeLines.find((partition: any) => partition.Tradeline?.accountNumber === accountNumber || String(partition.Tradeline?.accountNumber).includes(accountNumber));
      if (tlPartition) {
        const historyStatus = tlPartition.Tradeline?.GrantedTrade?.PayStatusHistory?.status;
        if (historyStatus) {
          return `DPD History: ${historyStatus.replace(/,/g, ' ').trim()}`;
        }
      }
    }

    const strData = JSON.stringify(cibilData);
    const regex = new RegExp(`"AccountNumber"\\s*:\\s*"${accountNumber}"[\\s\\S]*?"PaymentHistoryProfile"\\s*:\\s*"([^"]+)"`, 'i');
    const match = strData.match(regex);
    if (match && match[1]) {
      return `Payment Profile: ${match[1]}`;
    }
  } catch(e) {}
  return "";
};

const fetchImageAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const drawCoverPage = async (doc: any, bureau: string, cibilData: any, formData: any, parsed: any) => {
  const { accountSummary, accounts, enquiries, personalInfo } = parsed;
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 60;

  try {
    const logoBase64 = await fetchImageAsBase64('/img/logo_with_name.png');
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', (pageWidth - 95) / 2, currentY - 10, 95, 50);
    }
  } catch(e) {}
  currentY += 70;

  const firstName = formData.firstName || 'User';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(`Hey ${firstName},`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  const monthYear = new Date().toLocaleString('en-US', { month: 'short', year: '2-digit' });
  doc.text(`here is your Credit Report for ${monthYear}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 30;

  let displayBureau = bureau.toUpperCase();
  if (displayBureau.includes('V1_JSON') || displayBureau.includes('CIBIL')) displayBureau = 'TRANSUNION CIBIL';
  else if (displayBureau.includes('EXPERIAN')) displayBureau = 'EXPERIAN';
  else if (displayBureau.includes('CRIF')) displayBureau = 'CRIF HIGH MARK';

  doc.setFontSize(10);
  doc.text(`Powered by `, pageWidth / 2, currentY, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  let bureauColor: [number, number, number] = [0, 153, 204];
  if (bureau.toLowerCase().includes('experian')) bureauColor = [0, 38, 99];
  if (bureau.toLowerCase().includes('crif')) bureauColor = [185, 43, 39];
  doc.setTextColor(bureauColor[0], bureauColor[1], bureauColor[2]);
  doc.text(`${displayBureau}`, pageWidth / 2 + 5, currentY, { align: 'left' });
  currentY += 60;

  const score = personalInfo?.score || cibilData?.credit_score || 0;
  let scoreBand = "NA";
  let scoreColor: [number, number, number] = [200, 200, 200];
  if (score >= 750) { scoreBand = "VERY GOOD"; scoreColor = [34, 197, 94]; }
  else if (score >= 700) { scoreBand = "GOOD"; scoreColor = [234, 179, 8]; }
  else if (score >= 600) { scoreBand = "AVERAGE"; scoreColor = [249, 115, 22]; }
  else if (score > 300) { scoreBand = "POOR"; scoreColor = [239, 68, 68]; }

  const radius = 80;
  const cx = pageWidth / 2;
  const cy = currentY + radius - 20;

  // Draw semi-circle gauge
  doc.setLineWidth(12);
  const step = 0.05;
  for (let a = Math.PI; a >= 0; a -= step) {
     let color: [number, number, number] = [239, 68, 68]; // Red (300-600)
     if (a <= Math.PI * 0.5 && a > Math.PI * 0.333) color = [249, 115, 22]; // Orange (600-700)
     else if (a <= Math.PI * 0.333 && a > Math.PI * 0.25) color = [234, 179, 8]; // Yellow (700-750)
     else if (a <= Math.PI * 0.25) color = [34, 197, 94]; // Green (750-900)

     doc.setDrawColor(color[0], color[1], color[2]);
     const x1 = cx + radius * Math.cos(a);
     const y1 = cy - radius * Math.sin(a);
     const x2 = cx + radius * Math.cos(a - step);
     const y2 = cy - radius * Math.sin(a - step);
     doc.line(x1, y1, x2, y2);
  }

  // Draw score indicator dot
  const normalizedScore = Math.min(Math.max(score, 300), 900);
  const scoreAngle = Math.PI * (1 - (normalizedScore - 300) / 600);
  const indX = cx + radius * Math.cos(scoreAngle);
  const indY = cy - radius * Math.sin(scoreAngle);
  
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(2);
  doc.circle(indX, indY, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(30, 41, 59);
  doc.text(`${score}`, cx, cy - 15, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.text(`${scoreBand}`, cx, cy + 5, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(239, 68, 68);
  doc.text(`300`, cx - radius - 20, cy, { align: 'center' });
  doc.setTextColor(34, 197, 94);
  doc.text(`900`, cx + radius + 20, cy, { align: 'center' });

  currentY += 100;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text("Your free credit report is a detailed analysis of", pageWidth / 2, currentY, { align: 'center' });
  doc.text("your credit score and your credit accounts", pageWidth / 2, currentY + 15, { align: 'center' });

  currentY += 40;

  const boxWidth = 400;
  const boxX = (pageWidth - boxWidth) / 2;
  const boxHeight = 220;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text("Report Summary", pageWidth / 2, currentY, { align: 'center' });
  currentY += 15;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(252, 252, 253);
  doc.setLineWidth(1);
  doc.roundedRect(boxX, currentY, boxWidth, boxHeight, 10, 10, 'FD');

  let activeLoans = 0;
  let activeCreditCards = 0;
  let totalLoanLimit = 0;
  let totalCardLimit = 0;
  let totalLoanBal = 0;
  let totalCardBal = 0;

  (accounts || []).forEach((acc: any) => {
    if (acc.currentBalance > 0) {
      if (acc.accountType.toLowerCase().includes('card')) {
        activeCreditCards++;
        totalCardLimit += acc.highCreditAmount;
        totalCardBal += acc.currentBalance;
      } else {
        activeLoans++;
        totalLoanLimit += acc.highCreditAmount;
        totalLoanBal += acc.currentBalance;
      }
    }
  });

  const formatRupee = (num: number) => "Rs. " + num.toLocaleString('en-IN');

  let y = currentY + 30;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`${activeLoans} Active Loans`, boxX + 20, y);
  doc.text(`${formatRupee(totalLoanBal)}`, boxX + boxWidth - 20, y, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Total loan ${formatRupee(totalLoanLimit)}`, boxX + 20, y + 15);
  doc.text(`Current Outstanding`, boxX + boxWidth - 20, y + 15, { align: 'right' });

  y += 30;
  doc.setDrawColor(226, 232, 240);
  doc.line(boxX + 20, y, boxX + boxWidth - 20, y);
  y += 20;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`${activeCreditCards} Active Credit Cards`, boxX + 20, y);
  doc.text(`${formatRupee(totalCardBal)}`, boxX + boxWidth - 20, y, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Total limit ${formatRupee(totalCardLimit)}`, boxX + 20, y + 15);
  doc.text(`Current Outstanding`, boxX + boxWidth - 20, y + 15, { align: 'right' });

  y += 30;
  doc.line(boxX + 20, y, boxX + boxWidth - 20, y);
  y += 20;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Overdue Payments`, boxX + 20, y);
  doc.text(`${accountSummary?.overdueAccounts || 0}`, boxX + boxWidth - 20, y, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Outstanding amount past due date`, boxX + 20, y + 15);

  y += 30;
  doc.line(boxX + 20, y, boxX + boxWidth - 20, y);
  y += 20;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Recent Enquiries`, boxX + 20, y);
  doc.text(`${enquiries?.length || 0}`, boxX + boxWidth - 20, y, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Total enquiries`, boxX + 20, y + 15);
};

const addHeaderToAllPages = async (doc: any, bureauColor: [number, number, number]) => {
  const pageCount = doc.internal.getNumberOfPages();
  let logoBase64: string | null = null;
  try {
    logoBase64 = await fetchImageAsBase64('/img/logo_with_name.png');
  } catch(e) {}

  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i);
    
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 40, 15, 75, 40);
    }
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(40, 60, doc.internal.pageSize.getWidth() - 40, 60);

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated through Credit Expert India. This report is strictly confidential.', 40, doc.internal.pageSize.getHeight() - 20);
  }
};

const generateExperianPDFReport = async (bureau: string, cibilData: any, formData: any) => {
  const parsed = parseBureauData(bureau, cibilData);
  const { accountSummary, accounts, enquiries, personalInfo } = parsed;
  const contactInfo = extractContactInfo(bureau, cibilData);

  const doc = new jsPDF('p', 'pt', 'a4');
  
  const deepPurple: [number, number, number] = [90, 26, 139];
  const deepBlue: [number, number, number] = [0, 38, 99];
  const lightPurple: [number, number, number] = [230, 230, 250];

  await drawCoverPage(doc, bureau, cibilData, formData, parsed);
  doc.addPage();

  let currentY = 80;

  const drawSectionTitle = (title: string, y: number) => {
    doc.setFillColor(deepBlue[0], deepBlue[1], deepBlue[2]);
    doc.rect(40, y - 12, doc.internal.pageSize.getWidth() - 80, 16, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), 45, y - 1);
    return y + 15;
  };

  currentY = drawSectionTitle('Consumer Information', currentY);

  const safeName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim() || 'N/A';
  autoTable(doc, {
    startY: currentY,
    theme: 'plain',
    body: [
      ['Report Date:', new Date().toLocaleDateString('en-CA'), 'Consumer:', safeName.toUpperCase()],
      ['PAN:', (formData.pan || 'N/A').toUpperCase(), 'Email:', contactInfo.latestEmail],
      ['Phone:', formData.mobile || contactInfo.latestPhone, 'Address:', contactInfo.latestAddress]
    ],
    styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0] },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: deepBlue, cellWidth: 80 },
      1: { cellWidth: 150 },
      2: { fontStyle: 'bold', textColor: deepBlue, cellWidth: 80 },
      3: { }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 25;

  const allAccounts = accounts || [];
  
  if (allAccounts.length > 0) {
    currentY = drawSectionTitle('Account Details (All Loans)', currentY);

    allAccounts.forEach((acc: any) => {
      if (currentY > doc.internal.pageSize.getHeight() - 100) {
        doc.addPage();
        currentY = 80;
      }
      
      const historyStr = getExperianPaymentHistory(cibilData, acc.accountNumber);
      const isClosed = Number(acc.currentBalance) <= 0;
      const statusStr = isClosed ? "CLOSED" : "ACTIVE";
      const emiStr = acc.emiAmount ? `Rs. ${acc.emiAmount}` : 'NA';
      const tenureStr = acc.repaymentTenure && acc.repaymentTenure !== 'N/A' && acc.repaymentTenure !== '-1' ? `${acc.repaymentTenure} months` : 'NA';
      const intRateStr = acc.interest_rate ? `${acc.interest_rate}%` : 'NA';

      autoTable(doc, {
        startY: currentY,
        theme: 'plain',
        headStyles: { fillColor: lightPurple, textColor: deepBlue, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, textColor: [0, 0, 0] },
        head: [['LENDER / ACCOUNT', 'DATES & DETAILS', 'STATUS & AMOUNTS']],
        body: [
          [
            `Lender: ${acc.memberShortName || 'Unknown'}\nAcc No: ${acc.accountNumber || 'N/A'}\nType: ${acc.accountType || 'N/A'}\nStatus: ${statusStr}`,
            `Opened: ${acc.dateOpened || 'N/A'}\nReported: ${acc.dateReported || 'N/A'}\nTenure: ${acc.repaymentTenure || 'N/A'}`,
            `High Credit: Rs. ${acc.highCreditAmount || 0}\nBalance: Rs. ${acc.currentBalance || 0}\nEMI: ${emiStr}\nPast Due: Rs. ${acc.pastDueAmount || 0}\nTenure: ${tenureStr}\nInterest: ${intRateStr}`
          ],
          [
            { content: historyStr, colSpan: 3, styles: { fontStyle: 'italic', textColor: [80, 80, 80] } }
          ]
        ],
        styles: { cellPadding: 4, lineColor: lightPurple, lineWidth: 0.5 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    });
    
    currentY += 15;
  }

  if (enquiries && enquiries.length > 0) {
    if (currentY > doc.internal.pageSize.getHeight() - 150) {
      doc.addPage();
      currentY = 80;
    }

    currentY = drawSectionTitle('Recent Enquiries', currentY);

    const enquiriesBody = enquiries.slice(0, 30).map((enq: any) => [
      enq.memberShortName || 'Unknown Lender',
      enq.enquiryDate || 'N/A',
      enq.enquiryPurpose || 'N/A',
      `Rs. ${enq.enquiryAmount || 0}`
    ]);

    autoTable(doc, {
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: lightPurple, textColor: deepPurple, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [0, 0, 0] },
      head: [['Institution Name', 'Enquiry Date', 'Purpose', 'Amount']],
      body: enquiriesBody,
      alternateRowStyles: { fillColor: [245, 245, 250] }
    });
  }

  await addHeaderToAllPages(doc, deepBlue);
  doc.save(`Experian_Report_${safeName.replace(/\s+/g, '_')}.pdf`);
};

const generateCrifPDFReport = async (bureau: string, cibilData: any, formData: any) => {
  const parsed = parseBureauData(bureau, cibilData);
  const { accountSummary, accounts, enquiries, personalInfo } = parsed;
  const contactInfo = extractContactInfo(bureau, cibilData);

  const doc = new jsPDF('p', 'pt', 'a4');
  
  const maroon: [number, number, number] = [185, 43, 39];
  const darkGray: [number, number, number] = [50, 50, 50];
  const lightOrange: [number, number, number] = [255, 245, 238];
  
  await drawCoverPage(doc, bureau, cibilData, formData, parsed);
  doc.addPage();

  let currentY = 80;
  const safeName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim() || 'N/A';

  const drawSectionTitle = (title: string, y: number) => {
    doc.setFillColor(maroon[0], maroon[1], maroon[2]);
    doc.rect(40, y - 12, doc.internal.pageSize.getWidth() - 80, 16, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), 45, y - 1);
    return y + 15;
  };

  currentY = drawSectionTitle('Consumer Information', currentY);

  autoTable(doc, {
    startY: currentY,
    theme: 'plain',
    body: [
      ['Report Date:', new Date().toLocaleDateString('en-CA'), 'Consumer:', safeName.toUpperCase()],
      ['PAN:', (formData.pan || 'N/A').toUpperCase(), 'Email:', contactInfo.latestEmail],
      ['Phone:', formData.mobile || contactInfo.latestPhone, 'Address:', contactInfo.latestAddress]
    ],
    styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0] },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: maroon, cellWidth: 80 },
      1: { cellWidth: 150 },
      2: { fontStyle: 'bold', textColor: maroon, cellWidth: 80 },
      3: { }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 25;

  const allAccounts = accounts || [];
  
  if (allAccounts.length > 0) {
    currentY = drawSectionTitle('Account Details', currentY);

    allAccounts.forEach((acc: any) => {
      if (currentY > doc.internal.pageSize.getHeight() - 100) {
        doc.addPage();
        currentY = 80;
      }
      
      const historyStr = getCrifPaymentHistory(cibilData, acc.accountNumber);
      const isClosed = Number(acc.currentBalance) <= 0;
      const statusStr = isClosed ? "CLOSED" : "ACTIVE";
      const emiStr = acc.emiAmount ? `Rs. ${acc.emiAmount}` : 'NA';
      const tenureStr = acc.repaymentTenure && acc.repaymentTenure !== 'N/A' && acc.repaymentTenure !== '-1' ? `${acc.repaymentTenure} months` : 'NA';
      const intRateStr = acc.interest_rate ? `${acc.interest_rate}%` : 'NA';

      autoTable(doc, {
        startY: currentY,
        theme: 'plain',
        headStyles: { fillColor: lightOrange, textColor: maroon, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, textColor: [0, 0, 0] },
        head: [['LENDER / ACCOUNT', 'DATES & DETAILS', 'STATUS & AMOUNTS']],
        body: [
          [
            `Lender: ${acc.memberShortName || 'Unknown'}\nAcc No: ${acc.accountNumber || 'N/A'}\nType: ${acc.accountType || 'N/A'}\nStatus: ${statusStr}`,
            `Opened: ${acc.dateOpened || 'N/A'}\nReported: ${acc.dateReported || 'N/A'}\nTenure: ${acc.repaymentTenure || 'N/A'}`,
            `High Credit: Rs. ${acc.highCreditAmount || 0}\nBalance: Rs. ${acc.currentBalance || 0}\nEMI: ${emiStr}\nPast Due: Rs. ${acc.pastDueAmount || 0}\nTenure: ${tenureStr}\nInterest: ${intRateStr}`
          ],
          [
            { content: historyStr, colSpan: 3, styles: { fontStyle: 'italic', textColor: [80, 80, 80] } }
          ]
        ],
        styles: { cellPadding: 4, lineColor: lightOrange, lineWidth: 0.5 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    });
    
    currentY += 15;
  }

  if (enquiries && enquiries.length > 0) {
    if (currentY > doc.internal.pageSize.getHeight() - 150) {
      doc.addPage();
      currentY = 80;
    }

    currentY = drawSectionTitle('Recent Enquiries', currentY);

    const enquiriesBody = enquiries.slice(0, 30).map((enq: any) => [
      enq.memberShortName || 'Unknown Lender',
      enq.enquiryDate || 'N/A',
      enq.enquiryPurpose || 'N/A',
      `Rs. ${enq.enquiryAmount || 0}`
    ]);

    autoTable(doc, {
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: lightOrange, textColor: maroon, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [0, 0, 0] },
      head: [['Institution Name', 'Enquiry Date', 'Purpose', 'Amount']],
      body: enquiriesBody,
      alternateRowStyles: { fillColor: [252, 252, 252] }
    });
  }

  await addHeaderToAllPages(doc, maroon);
  doc.save(`CRIF_Report_${safeName.replace(/\s+/g, '_')}.pdf`);
};

const generateCibilPDFReport = async (bureau: string, cibilData: any, formData: any) => {
  const parsed = parseBureauData(bureau, cibilData);
  const { accountSummary, accounts, enquiries, personalInfo } = parsed;
  const contactInfo = extractContactInfo(bureau, cibilData);

  const doc = new jsPDF('p', 'pt', 'a4');
  
  const cyanBlue: [number, number, number] = [0, 153, 204];
  const lightBlue: [number, number, number] = [230, 242, 255];
  const lightText: [number, number, number] = [100, 100, 100];

  await drawCoverPage(doc, bureau, cibilData, formData, parsed);
  doc.addPage();

  let currentY = 80;
  const safeName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim() || 'N/A';
  
  const drawSectionTitle = (title: string, y: number) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(cyanBlue[0], cyanBlue[1], cyanBlue[2]);
    doc.text(title, 40, y);
    return y + 10;
  };

  currentY = drawSectionTitle('CONSUMER INFORMATION:', currentY);
  
  autoTable(doc, {
    startY: currentY,
    theme: 'plain',
    body: [
      ['NAME:', safeName.toUpperCase(), 'GENDER:', formData.gender ? formData.gender.toUpperCase() : 'MALE'],
      ['DATE OF BIRTH:', formData.dob || 'N/A', '', '']
    ],
    styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0] },
    columnStyles: {
      0: { fontStyle: 'italic', textColor: lightText, cellWidth: 80 },
      1: { fontStyle: 'bold', cellWidth: 150 },
      2: { fontStyle: 'italic', textColor: lightText, cellWidth: 80 },
      3: { fontStyle: 'bold' }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  currentY = drawSectionTitle('IDENTIFICATION(S):', currentY);

  autoTable(doc, {
    startY: currentY,
    theme: 'plain',
    headStyles: { fillColor: [255, 255, 255], textColor: cyanBlue, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, fontStyle: 'bold', textColor: [0, 0, 0] },
    head: [['IDENTIFICATION TYPE', 'IDENTIFICATION NUMBER']],
    body: [
      ['INCOME TAX ID NUMBER (PAN)', (formData.pan || 'N/A').toUpperCase()]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  currentY = drawSectionTitle('CONTACT(S):', currentY);

  autoTable(doc, {
    startY: currentY,
    theme: 'plain',
    headStyles: { fillColor: [255, 255, 255], textColor: cyanBlue, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, fontStyle: 'bold', textColor: [0, 0, 0] },
    head: [['CONTACT TYPE', 'DETAILS']],
    body: [
      ['Email Address', contactInfo.latestEmail],
      ['Phone Number', formData.mobile || contactInfo.latestPhone],
      ['Address', contactInfo.latestAddress]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 25;

  const allAccounts = accounts || [];
  
  if (allAccounts.length > 0) {
    currentY = drawSectionTitle('ACCOUNT(S) (ALL LOANS):', currentY);

    allAccounts.forEach((acc: any) => {
      if (currentY > doc.internal.pageSize.getHeight() - 100) {
        doc.addPage();
        currentY = 80;
      }
      
      const historyStr = getGenericPaymentHistory(cibilData, acc.accountNumber);
      const isClosed = Number(acc.currentBalance) <= 0;
      const statusStr = isClosed ? "CLOSED" : "ACTIVE";
      const emiStr = acc.emiAmount ? `Rs. ${acc.emiAmount}` : 'NA';
      const tenureStr = acc.repaymentTenure && acc.repaymentTenure !== 'N/A' && acc.repaymentTenure !== '-1' ? `${acc.repaymentTenure} months` : 'NA';
      const intRateStr = acc.interest_rate ? `${acc.interest_rate}%` : 'NA';

      autoTable(doc, {
        startY: currentY,
        theme: 'plain',
        headStyles: { fillColor: lightBlue, textColor: cyanBlue, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, textColor: [0, 0, 0] },
        head: [['ACCOUNT', 'DATES', 'AMOUNTS']],
        body: [
          [
            `MEMBER NAME: ${acc.memberShortName || 'Unknown'}\nACCOUNT NUMBER: ${acc.accountNumber || 'N/A'}\nTYPE: ${acc.accountType || 'N/A'}\nSTATUS: ${statusStr}`,
            `OPENED: ${acc.dateOpened || 'N/A'}\nDATE REPORTED: ${acc.dateReported || 'N/A'}`,
            `HIGH CREDIT AMOUNT: ${acc.highCreditAmount || 0}\nCURRENT BALANCE: ${acc.currentBalance || 0}\nEMI AMOUNT: ${emiStr}\nPAST DUE: ${acc.pastDueAmount || 0}\nTENURE: ${tenureStr}\nINTEREST: ${intRateStr}`
          ],
          [
            { content: historyStr, colSpan: 3, styles: { fontStyle: 'italic', textColor: [100, 100, 100] } }
          ]
        ],
        styles: { cellPadding: 3 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 5;
    });
    
    currentY += 10;
  }

  if (enquiries && enquiries.length > 0) {
    if (currentY > doc.internal.pageSize.getHeight() - 150) {
      doc.addPage();
      currentY = 80;
    }

    currentY = drawSectionTitle('ENQUIRIES:', currentY);

    const enquiriesBody = enquiries.slice(0, 30).map((enq: any) => [
      enq.memberShortName || 'Unknown Lender',
      enq.enquiryDate || 'N/A',
      enq.enquiryPurpose || 'N/A',
      enq.enquiryAmount || 0
    ]);

    autoTable(doc, {
      startY: currentY,
      theme: 'plain',
      headStyles: { fillColor: lightBlue, textColor: cyanBlue, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [0, 0, 0], fontStyle: 'bold' },
      head: [['MEMBER', 'ENQUIRY DATE', 'ENQUIRY PURPOSE', 'ENQUIRY AMOUNT']],
      body: enquiriesBody,
      alternateRowStyles: { fillColor: [250, 250, 250] }
    });
  }

  await addHeaderToAllPages(doc, cyanBlue);
  doc.save(`CIBIL_REPORT_${safeName.replace(/\s+/g, '_')}.pdf`);
};

export const generatePDFReport = async (bureau: string, cibilData: any, formData: any) => {
  const b = bureau ? bureau.toLowerCase() : '';
  
  if (b.includes('experian')) {
    return await generateExperianPDFReport(bureau, cibilData, formData);
  } else if (b.includes('crif')) {
    return await generateCrifPDFReport(bureau, cibilData, formData);
  }
  
  return await generateCibilPDFReport(bureau, cibilData, formData);
};
