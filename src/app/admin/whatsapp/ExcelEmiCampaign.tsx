"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Square,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  Send,
  Search,
  Filter,
  Calculator,
  ArrowRight,
  HelpCircle,
  Sparkles,
  Check,
  ChevronLeft,
  ChevronRight,
  Sliders,
  DollarSign,
  TrendingDown,
  Phone,
  User,
  Clock,
  Layers,
  Image as ImageIcon,
  X,
  ShieldCheck,
  ExternalLink,
  GripVertical,
  ArrowUp,
  ArrowDown,
  PenLine,
  Users,
  Tag,
  FlaskConical,
  RotateCcw,
  Copy,
  MinusCircle,
  Building2,
  Percent,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  calculateEmiDifference,
  formatInrCurrency,
  sanitizeIndianPhoneNumber,
  resolveVariableValue,
  formatSampleStringForApi,
  KNOWN_TEMPLATE_REQUIREMENTS,
  VariableSlotConfig,
  VARIABLE_SOURCE_OPTIONS,
  VARIABLE_PRESETS,
  EmiCalculationResult,
  PhoneFormatOption,
  PHONE_FORMAT_OPTIONS,
  inspectPhoneColumnFormat,
  cleanHyperlinkText,
} from "@/lib/emiCalculations";

interface ExcelEmiCampaignProps {
  templatesList: any[];
  apiTokenOverride?: string;
  onTrackDlr?: (campaignId: string) => void;
  onRefreshMessages?: () => void;
}

interface ParsedSheetData {
  name: string;
  rowCount: number;
  columns: string[];
  rows: Record<string, any>[];
}

interface RowProcessingResult {
  rowIndex: number;
  row: Record<string, any>;
  name: string;
  phoneInfo: {
    raw: string;
    formatted: string;
    isValid: boolean;
    error?: string;
    detectedFormat?: string;
  };
  principal: number;
  tenure: number;
  currentRoi: number;
  calc: EmiCalculationResult;
  sampleString: string;
}

interface DispatchLogItem {
  id: string;
  timestamp: string;
  rowIndex: number;
  name: string;
  phone: string;
  campaignId?: number;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  error?: string;
  sampleString: string;
}

export interface TestExtraField {
  id: string;
  key: string;
  value: string;
}

interface CustomTestDetails {
  name: string;
  phone: string;
  amount: number;
  tenure: number;
  currentRoi: number;
  targetRoi: number;
  companyName: string;
}

const DEFAULT_TEST_DETAILS: CustomTestDetails = {
  name: "Rahul Sharma",
  phone: "",
  amount: 200000,
  tenure: 24,
  currentRoi: 23.5,
  targetRoi: 9.99,
  companyName: "Credit Expert India",
};

export default function ExcelEmiCampaign({
  templatesList,
  apiTokenOverride,
  onTrackDlr,
  onRefreshMessages,
}: ExcelEmiCampaignProps) {
  // 1. Workbook State
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [sheets, setSheets] = useState<ParsedSheetData[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>("");
  const [parsingFile, setParsingFile] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. Column Mapping State
  const [nameCol, setNameCol] = useState("");
  const [amountCol, setAmountCol] = useState("");
  const [tenureCol, setTenureCol] = useState("");
  const [roiCol, setRoiCol] = useState("");
  const [phoneCol, setPhoneCol] = useState("");
  const [phoneFormatMode, setPhoneFormatMode] = useState<PhoneFormatOption>("auto");
  const [phoneDefaultCountryCode, setPhoneDefaultCountryCode] = useState<string>("91");
  const [autoDetectedPhoneHint, setAutoDetectedPhoneHint] = useState<{
    detectedMode: PhoneFormatOption;
    summary: string;
    hasSpacesOrDashes: boolean;
    validRatio: number;
  } | null>(null);
  const [tenureUnit, setTenureUnit] = useState<"months" | "years">("months");
  const [targetRoi, setTargetRoi] = useState<number>(9.99);

  // 3. Template & Media State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("72");
  const [campaignName, setCampaignName] = useState<string>("");
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [headerFilePreview, setHeaderFilePreview] = useState<string | null>(null);

  // 4. Dynamic Variable Slots State
  const [variableSlots, setVariableSlots] = useState<VariableSlotConfig[]>(
    VARIABLE_PRESETS.reduce_emi_72
  );
  // Drag and drop state
  const [draggedSlotIndex, setDraggedSlotIndex] = useState<number | null>(null);
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);

  // 4b. Single Column Keyword Filter State (Target Specific Audience from Excel)
  const [columnFilterCol, setColumnFilterCol] = useState<string>("");
  const [columnFilterKeyword, setColumnFilterKeyword] = useState<string>("");
  const [columnFilterCondition, setColumnFilterCondition] = useState<
    "contains" | "exact" | "starts_with" | "does_not_contain"
  >("contains");
  const [columnFilterCaseSensitive, setColumnFilterCaseSensitive] = useState<boolean>(false);

  const handleClearColumnFilter = () => {
    setColumnFilterKeyword("");
    setColumnFilterCol("");
    setCurrentPage(1);
  };

  // 5. Preview & Filter State
  const [previewSearch, setPreviewSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "valid" | "invalid" | "savings">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // 6. Batch Dispatch State
  const [dispatchRange, setDispatchRange] = useState<"count" | "test" | "range" | "all">("count");
  const [customPeopleCount, setCustomPeopleCount] = useState<number>(50);
  const [customRangeStart, setCustomRangeStart] = useState<number>(1);
  const [customRangeEnd, setCustomRangeEnd] = useState<number>(50);
  const [throttleDelayMs, setThrottleDelayMs] = useState<number>(400);

  // 7. Custom Single Test Sandbox State
  const [isTestBoxOpen, setIsTestBoxOpen] = useState<boolean>(true);
  const [testDetails, setTestDetails] = useState<CustomTestDetails>(DEFAULT_TEST_DETAILS);
  const [sendingCustomTest, setSendingCustomTest] = useState<boolean>(false);
  const [customTestResponse, setCustomTestResponse] = useState<any>(null);
  const [testExtraFields, setTestExtraFields] = useState<TestExtraField[]>([]);

  const [dispatchStatus, setDispatchStatus] = useState<
    "idle" | "running" | "paused" | "completed" | "aborted"
  >("idle");
  const [progressIndex, setProgressIndex] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [dispatchLogs, setDispatchLogs] = useState<DispatchLogItem[]>([]);
  const [stats, setStats] = useState({ success: 0, failed: 0, skipped: 0 });
  const [failedRowsList, setFailedRowsList] = useState<RowProcessingResult[]>([]);

  // Refs for pause/stop control
  const isPausedRef = useRef(false);
  const isAbortedRef = useRef(false);

  // Current active template object
  const currentTemplate = useMemo(() => {
    return templatesList.find((t) => String(t.WhatsAppTemplateId) === String(selectedTemplateId).trim());
  }, [templatesList, selectedTemplateId]);

  const isMediaTemplate = useMemo(() => {
    if (!currentTemplate) return selectedTemplateId === "72" || selectedTemplateId === "71";
    const desc = (currentTemplate?.TemplateTypeDescription || "").toLowerCase();
    const typeNum = Number(currentTemplate?.TemplateType);
    return desc === "image" || desc === "video" || desc === "document" || typeNum === 2 || typeNum === 3;
  }, [currentTemplate, selectedTemplateId]);

  // Set default campaign name based on file
  useEffect(() => {
    if (fileName && !campaignName) {
      const clean = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      setCampaignName(`EMI_${clean}_${selectedSheetName || "Batch"}`);
    }
  }, [fileName, selectedSheetName]);

  // Comprehensive Auto-detect columns based on common real-world patterns & banking aliases
  const autoDetectColumns = (columns: string[]) => {
    const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

    const findCol = (exactList: string[], partialList: string[]) => {
      // 1. Exact clean match
      for (const pattern of exactList) {
        const found = columns.find((c) => cleanStr(c) === pattern);
        if (found) return found;
      }
      // 2. Partial includes match
      for (const pattern of partialList) {
        const found = columns.find((c) => cleanStr(c).includes(pattern));
        if (found) return found;
      }
      return "";
    };

    const detectedName = findCol(
      [
        "candidatename",
        "customername",
        "clientname",
        "applicantname",
        "borrowername",
        "fullname",
        "name",
        "candidate",
        "leadname",
        "lead",
        "client",
        "customer",
        "borrower",
        "applicant",
        "membername",
        "partyname",
      ],
      ["candidatename", "candidate", "custname", "clientname", "applicant", "borrower", "fullname", "lead", "name"]
    );

    const detectedAmount = findCol(
      [
        "disbursementamount",
        "sanctionamount",
        "disbursement_amount",
        "loanamount",
        "loan_amount",
        "amount",
        "principal",
        "loanamt",
        "disbursedamt",
        "disbursed",
        "sanctionamt",
        "pos",
        "balance",
        "outstanding",
        "currentbalance",
        "loanvalue",
        "netdisbursed",
        "principalamt",
      ],
      ["disburs", "loanamt", "amount", "sanction", "principal", "balance", "pos", "outstanding"]
    );

    const detectedTenure = findCol(
      [
        "tenor",
        "tenure",
        "months",
        "duration",
        "period",
        "term",
        "loanterm",
        "tenuremonths",
        "tenormonths",
      ],
      ["tenor", "tenure", "term", "month", "duration", "period"]
    );

    const detectedRoi = findCol(
      [
        "roi",
        "interestrate",
        "rate",
        "rateofinterest",
        "interest",
        "rateofint",
        "intrate",
        "currentroi",
        "existingroi",
      ],
      ["roi", "interest", "rate", "intrate"]
    );

    const detectedPhone = findCol(
      [
        "standardizedmobileno",
        "mobileno",
        "mobile",
        "phone",
        "contact",
        "whatsappno",
        "standardizedphone",
        "mobilenumber",
        "phonenumber",
        "contactnumber",
        "contactno",
        "cell",
        "cellphone",
        "whatsapp",
        "custmobile",
      ],
      ["mobile", "phone", "contact", "whatsapp", "cell"]
    );

    setNameCol(detectedName);
    setAmountCol(detectedAmount);
    setTenureCol(detectedTenure);
    setRoiCol(detectedRoi);
    setPhoneCol(detectedPhone);

    return {
      name: detectedName,
      amount: detectedAmount,
      tenure: detectedTenure,
      roi: detectedRoi,
      phone: detectedPhone,
    };
  };

  // Robust Workbook Buffer Processing Engine (handles XLSX, XLS, CSV, multi-sheet, and header detection)
  const processWorkbookBuffer = (buffer: ArrayBuffer, name: string, sizeStr: string) => {
    const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      throw new Error("No sheets found in the uploaded Excel workbook.");
    }

    const parsedSheets: ParsedSheetData[] = [];

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;

      // Pre-process any cells with =HYPERLINK(...) formulas or cell hyperlinks
      // to ensure cell.v and cell.w contain the clean friendly name instead of formulas/URLs
      for (const cellKey of Object.keys(ws)) {
        if (cellKey.startsWith("!")) continue;
        const cell = ws[cellKey];
        if (cell) {
          if (cell.f && /HYPERLINK/i.test(cell.f)) {
            const clean = cleanHyperlinkText(cell.f);
            if (clean && (!cell.v || String(cell.v).includes("HYPERLINK"))) {
              cell.v = clean;
              cell.w = clean;
            }
          } else if (cell.v && typeof cell.v === "string" && /HYPERLINK/i.test(cell.v)) {
            cell.v = cleanHyperlinkText(cell.v);
            cell.w = cell.v;
          }
        }
      }

      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
      let cols: string[] = [];
      let rows = rawRows;

      if (rawRows.length > 0) {
        const keys = Object.keys(rawRows[0]);
        const validKeys = keys.filter((k) => !k.startsWith("__EMPTY") && k.trim() !== "");

        // If headers appear merged or on row 2, inspect raw row arrays
        if (validKeys.length < 2) {
          const rawArray = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
          const headerRowIdx = rawArray.findIndex(
            (r) => Array.isArray(r) && r.filter((c) => String(c ?? "").trim().length > 0).length >= 2
          );
          if (headerRowIdx !== -1 && headerRowIdx < rawArray.length - 1) {
            const headerRow = rawArray[headerRowIdx].map((c) => String(c ?? "").trim());
            const dataRows: Record<string, any>[] = [];
            for (let ri = headerRowIdx + 1; ri < rawArray.length; ri++) {
              const rowArr = rawArray[ri];
              if (!rowArr || rowArr.every((c) => String(c ?? "").trim() === "")) continue;
              const obj: Record<string, any> = {};
              headerRow.forEach((h, ci) => {
                if (h) obj[h] = rowArr[ci] ?? "";
              });
              dataRows.push(obj);
            }
            cols = headerRow.filter(Boolean);
            rows = dataRows;
          } else {
            cols = keys;
          }
        } else {
          cols = keys.map((k) => k.trim());
        }
      }

      // Ensure all cell values across all columns are cleaned of hyperlink formulas/tags
      const sanitizedRows = rows.map((r) => {
        const cleanedRow: Record<string, any> = {};
        for (const [k, v] of Object.entries(r)) {
          cleanedRow[k] = typeof v === "string" ? cleanHyperlinkText(v) : v;
        }
        return cleanedRow;
      });

      parsedSheets.push({
        name: sheetName,
        rowCount: sanitizedRows.length,
        columns: cols,
        rows: sanitizedRows,
      });
    }

    const firstActiveSheet = parsedSheets.find((s) => s.rowCount > 0) || parsedSheets[0];
    if (!firstActiveSheet || firstActiveSheet.rowCount === 0) {
      setSheets(parsedSheets);
      setSelectedSheetName(parsedSheets[0]?.name || "");
      setFileName(name);
      setFileSize(sizeStr);
      setParseError("Workbook loaded, but all sheets appear to have 0 data rows.");
      return;
    }

    setFileName(name);
    setFileSize(sizeStr);
    setSheets(parsedSheets);
    setSelectedSheetName(firstActiveSheet.name);

    // Reset column filter & pagination
    setColumnFilterCol("");
    setColumnFilterKeyword("");
    setCurrentPage(1);

    // Auto-detect columns on active sheet
    const detected = autoDetectColumns(firstActiveSheet.columns);

    // Sync Row 1 to single test sandbox immediately
    if (firstActiveSheet.rows.length > 0) {
      const first = firstActiveSheet.rows[0];
      const rawPhone = detected.phone ? first[detected.phone] : "";
      const phoneInfo = sanitizeIndianPhoneNumber(rawPhone, phoneFormatMode, phoneDefaultCountryCode);
      const rawAmt = detected.amount ? String(first[detected.amount] ?? "").replace(/,/g, "").trim() : "";
      const principal = parseFloat(rawAmt) || 200000;
      const rawTenure = detected.tenure ? String(first[detected.tenure] ?? "").replace(/,/g, "").trim() : "";
      const tenure = parseInt(rawTenure, 10) || 24;
      const rawRoi = detected.roi ? String(first[detected.roi] ?? "").replace(/%/g, "").trim() : "";
      const currentRoi = parseFloat(rawRoi) || 23.5;
      const customerName = detected.name ? String(first[detected.name] ?? "").trim() : "";

      setTestDetails({
        name: customerName || "Customer 1",
        phone: phoneInfo.isValid ? phoneInfo.formatted : (phoneInfo.raw || ""),
        amount: principal > 0 ? principal : 200000,
        tenure: tenure > 0 ? tenure : 24,
        currentRoi: currentRoi > 0 ? currentRoi : 23.5,
        targetRoi: targetRoi,
        companyName: "Credit Expert India",
      });
    }

    const clean = name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    setCampaignName(`EMI_${clean}_${firstActiveSheet.name || "Batch"}`);
  };

  // Load a user-supplied file
  const loadFile = async (file: File) => {
    setParsingFile(true);
    setParseError(null);
    try {
      const buffer = await file.arrayBuffer();
      const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + " MB";
      processWorkbookBuffer(buffer, file.name, sizeStr);
    } catch (err: any) {
      console.error("[Excel Parse Error]:", err);
      setParseError(err.message || "Failed to parse Excel file. Please ensure it is a valid .xlsx, .xls, or .csv file.");
    } finally {
      setParsingFile(false);
    }
  };

  // Handle Excel File Upload from standard <input type="file" />
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // Crucial: clear so re-uploading the same file always triggers onChange
    if (!file) return;
    await loadFile(file);
  };

  // File Drag & drop event handlers
  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleFileDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await loadFile(file);
  };

  // Clear/Reset entire workbook state
  const handleClearWorkbook = () => {
    setFileName(null);
    setFileSize(null);
    setSheets([]);
    setSelectedSheetName("");
    setNameCol("");
    setAmountCol("");
    setTenureCol("");
    setRoiCol("");
    setPhoneCol("");
    setColumnFilterKeyword("");
    setColumnFilterCol("");
    setCurrentPage(1);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle Loading Demo Dec-25.xlsx directly from /data/Dec-25.xlsx
  const handleLoadDemoDec25 = async () => {
    setParsingFile(true);
    setParseError(null);

    try {
      const res = await fetch("/data/Dec-25.xlsx");
      if (!res.ok) {
        throw new Error(`Failed to load /data/Dec-25.xlsx (${res.status})`);
      }
      const buffer = await res.arrayBuffer();
      const sizeStr = (buffer.byteLength / (1024 * 1024)).toFixed(2) + " MB";
      processWorkbookBuffer(buffer, "Dec-25.xlsx", sizeStr);
    } catch (err: any) {
      console.error("[Demo Load Error]:", err);
      setParseError(err.message || "Failed to load sample Dec-25.xlsx.");
    } finally {
      setParsingFile(false);
    }
  };

  // Re-run auto-detection when switching sheet
  const handleSheetChange = (sheetName: string) => {
    setSelectedSheetName(sheetName);
    setCurrentPage(1);

    let activeCols: string[] = [];
    let activeRowsList: Record<string, any>[] = [];

    if (sheetName === "all") {
      activeCols = Array.from(new Set(sheets.flatMap((s) => s.columns)));
      activeRowsList = sheets.flatMap((s) => s.rows);
    } else {
      const target = sheets.find((s) => s.name === sheetName);
      if (target) {
        activeCols = target.columns;
        activeRowsList = target.rows;
      }
    }

    const detected = autoDetectColumns(activeCols);

    if (activeRowsList.length > 0) {
      const first = activeRowsList[0];
      const rawPhone = detected.phone ? first[detected.phone] : "";
      const phoneInfo = sanitizeIndianPhoneNumber(rawPhone, phoneFormatMode, phoneDefaultCountryCode);
      const rawAmt = detected.amount ? String(first[detected.amount] ?? "").replace(/,/g, "").trim() : "";
      const principal = parseFloat(rawAmt) || 200000;
      const rawTenure = detected.tenure ? String(first[detected.tenure] ?? "").replace(/,/g, "").trim() : "";
      const tenure = parseInt(rawTenure, 10) || 24;
      const rawRoi = detected.roi ? String(first[detected.roi] ?? "").replace(/%/g, "").trim() : "";
      const currentRoi = parseFloat(rawRoi) || 23.5;
      const customerName = detected.name ? String(first[detected.name] ?? "").trim() : "";

      setTestDetails({
        name: customerName || "Customer 1",
        phone: phoneInfo.isValid ? phoneInfo.formatted : (phoneInfo.raw || ""),
        amount: principal > 0 ? principal : 200000,
        tenure: tenure > 0 ? tenure : 24,
        currentRoi: currentRoi > 0 ? currentRoi : 23.5,
        targetRoi: targetRoi,
        companyName: "Credit Expert India",
      });
    }
  };

  // Raw rows from selected sheet or combined "all" (unfiltered)
  const rawActiveRows = useMemo(() => {
    if (!sheets || sheets.length === 0) return [];
    if (selectedSheetName === "all") {
      return sheets.flatMap((s) => s.rows);
    }
    const current = sheets.find((s) => s.name === selectedSheetName);
    return current ? current.rows : [];
  }, [sheets, selectedSheetName]);

  // Check if column keyword filter is actively applied
  const isColumnFilterActive = Boolean(
    columnFilterKeyword.trim() && (columnFilterCol || columnFilterCol === "__ALL__")
  );

  // Active working dataset (filtered by single column keyword if active)
  const activeRows = useMemo(() => {
    if (!isColumnFilterActive) {
      return rawActiveRows;
    }

    const kwRaw = columnFilterKeyword.trim();
    const kw = columnFilterCaseSensitive ? kwRaw : kwRaw.toLowerCase();

    return rawActiveRows.filter((row) => {
      if (columnFilterCol === "__ALL__" || !columnFilterCol) {
        const values = Object.values(row);
        if (columnFilterCondition === "does_not_contain") {
          return !values.some((v) => {
            const str = columnFilterCaseSensitive ? String(v ?? "") : String(v ?? "").toLowerCase();
            return str.includes(kw);
          });
        }
        return values.some((v) => {
          const str = columnFilterCaseSensitive ? String(v ?? "") : String(v ?? "").toLowerCase();
          if (columnFilterCondition === "exact") return str === kw;
          if (columnFilterCondition === "starts_with") return str.startsWith(kw);
          return str.includes(kw);
        });
      }

      const rawVal = row[columnFilterCol];
      if (rawVal === undefined || rawVal === null) {
        return columnFilterCondition === "does_not_contain";
      }

      const valStr = columnFilterCaseSensitive ? String(rawVal) : String(rawVal).toLowerCase();

      switch (columnFilterCondition) {
        case "exact":
          return valStr === kw;
        case "starts_with":
          return valStr.startsWith(kw);
        case "does_not_contain":
          return !valStr.includes(kw);
        case "contains":
        default:
          return valStr.includes(kw);
      }
    });
  }, [
    rawActiveRows,
    isColumnFilterActive,
    columnFilterCol,
    columnFilterKeyword,
    columnFilterCondition,
    columnFilterCaseSensitive,
  ]);

  // Top frequent values for selected column (to suggest 1-click filter chips)
  const topColumnSuggestions = useMemo(() => {
    if (!columnFilterCol || columnFilterCol === "__ALL__" || rawActiveRows.length === 0) {
      return [];
    }

    const counts: Record<string, number> = {};
    for (let i = 0; i < rawActiveRows.length; i++) {
      const val = rawActiveRows[i][columnFilterCol];
      if (val !== undefined && val !== null) {
        const s = String(val).trim();
        if (s && s !== "-" && s !== "null" && s !== "undefined" && s.length <= 40) {
          counts[s] = (counts[s] || 0) + 1;
        }
      }
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([value, count]) => ({ value, count }));
  }, [columnFilterCol, rawActiveRows]);

  // Available column names for dropdowns
  const availableColumns = useMemo(() => {
    if (!sheets || sheets.length === 0) return [];
    if (selectedSheetName === "all") {
      return Array.from(new Set(sheets.flatMap((s) => s.columns)));
    }
    const current = sheets.find((s) => s.name === selectedSheetName);
    return current ? current.columns : [];
  }, [sheets, selectedSheetName]);

  // Process rows with calculations and sample strings
  const processedData: RowProcessingResult[] = useMemo(() => {
    if (!nameCol && !amountCol) return [];

    return activeRows.map((row, index) => {
      const name = cleanHyperlinkText(row[nameCol]);
      const rawPhone = row[phoneCol];
      const phoneInfo = sanitizeIndianPhoneNumber(rawPhone, phoneFormatMode, phoneDefaultCountryCode);

      // Parse loan amount
      const rawAmt = String(row[amountCol] ?? "").replace(/,/g, "").trim();
      const principal = parseFloat(rawAmt) || 0;

      // Parse tenure
      const rawTenure = String(row[tenureCol] ?? "").replace(/,/g, "").trim();
      let tenure = parseInt(rawTenure, 10) || 0;
      if (tenureUnit === "years" && tenure > 0) {
        tenure = tenure * 12;
      }

      // Parse ROI
      const rawRoi = String(row[roiCol] ?? "").replace(/%/g, "").trim();
      const currentRoi = parseFloat(rawRoi) || 0;

      // Calculate EMI and savings
      const calc = calculateEmiDifference(principal, currentRoi, targetRoi, tenure);

      // Resolve dynamic variable slots
      const sampleValues = variableSlots.map((slot, sIdx) =>
        resolveVariableValue(
          slot,
          row,
          { nameCol, amountCol, tenureCol, roiCol },
          calc,
          targetRoi,
          variableSlots,
          sIdx
        )
      );

      const sampleString = formatSampleStringForApi(sampleValues);

      return {
        rowIndex: index + 1,
        row,
        name,
        phoneInfo,
        principal,
        tenure,
        currentRoi,
        calc,
        sampleString,
      };
    });
  }, [
    activeRows,
    nameCol,
    amountCol,
    tenureCol,
    roiCol,
    phoneCol,
    phoneFormatMode,
    phoneDefaultCountryCode,
    tenureUnit,
    targetRoi,
    variableSlots,
  ]);

  // Filtered rows for preview
  const filteredData = useMemo(() => {
    return processedData.filter((item) => {
      if (filterMode === "valid" && !item.phoneInfo.isValid) return false;
      if (filterMode === "invalid" && item.phoneInfo.isValid) return false;
      if (filterMode === "savings" && !item.calc.isEligibleForSavings) return false;

      if (previewSearch.trim()) {
        const q = previewSearch.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesPhone = item.phoneInfo.formatted.includes(q) || item.phoneInfo.raw.includes(q);
        return matchesName || matchesPhone;
      }

      return true;
    });
  }, [processedData, filterMode, previewSearch]);

  // Pagination for preview
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;

  // Analyze phone column format whenever phoneCol or activeRows change
  useEffect(() => {
    if (!phoneCol || activeRows.length === 0) {
      setAutoDetectedPhoneHint(null);
      return;
    }
    const samples = activeRows.slice(0, 50).map((r) => r[phoneCol]);
    const hint = inspectPhoneColumnFormat(samples);
    setAutoDetectedPhoneHint(hint);
  }, [phoneCol, activeRows]);

  // Overall phone number validity stats for current processed dataset
  const phoneStats = useMemo(() => {
    if (!processedData || processedData.length === 0) {
      return { total: 0, valid: 0, invalid: 0, validPercent: 0 };
    }
    const total = processedData.length;
    let valid = 0;
    for (const item of processedData) {
      if (item.phoneInfo.isValid) valid++;
    }
    return {
      total,
      valid,
      invalid: total - valid,
      validPercent: total > 0 ? Math.round((valid / total) * 100) : 0,
    };
  }, [processedData]);

  // Live row-by-row phone sample transformations for UI inspection
  const phoneSamples = useMemo(() => {
    if (!phoneCol || activeRows.length === 0) return [];
    return activeRows.slice(0, 4).map((row, idx) => {
      const rawVal = row[phoneCol];
      const info = sanitizeIndianPhoneNumber(rawVal, phoneFormatMode, phoneDefaultCountryCode);
      return {
        index: idx + 1,
        name: nameCol ? cleanHyperlinkText(row[nameCol]) : `Row ${idx + 1}`,
        raw: rawVal === undefined || rawVal === null ? "" : String(rawVal),
        formatted: info.formatted,
        isValid: info.isValid,
        error: info.error,
        detectedFormat: info.detectedFormat,
      };
    });
  }, [activeRows, phoneCol, phoneFormatMode, phoneDefaultCountryCode, nameCol]);

  // Header image handlers
  const handleHeaderFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setHeaderFile(file);
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => setHeaderFilePreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setHeaderFilePreview(null);
      }
    }
  };

  const handleClearHeaderFile = () => {
    setHeaderFile(null);
    setHeaderFilePreview(null);
  };

  const handleLoadSampleHeaderImage = async () => {
    try {
      const response = await fetch("/personal_loann.webp");
      const blob = await response.blob();
      const file = new File([blob], "credit_expert_banner.webp", { type: "image/webp" });
      setHeaderFile(file);
      const reader = new FileReader();
      reader.onload = () => setHeaderFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } catch (e) {
      console.error("Failed to load sample header image", e);
    }
  };

  // Variable Slot management
  const addVariableSlot = () => {
    const newId = `var-${Date.now()}-${variableSlots.length + 1}`;
    setVariableSlots([
      ...variableSlots,
      {
        id: newId,
        sourceType: "current_emi",
        mode: "select",
        formatAsCurrency: false,
      },
    ]);
  };

  const removeVariableSlot = (index: number) => {
    if (variableSlots.length <= 1) return;
    const updated = variableSlots.filter((_, i) => i !== index);
    setVariableSlots(updated);
  };

  const updateVariableSlot = (index: number, updates: Partial<VariableSlotConfig>) => {
    const updated = [...variableSlots];
    updated[index] = { ...updated[index], ...updates };
    setVariableSlots(updated);
  };

  // Reorder slots
  const moveSlot = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= variableSlots.length ||
      toIndex >= variableSlots.length
    ) {
      return;
    }
    const updated = [...variableSlots];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setVariableSlots(updated);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSlotIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedSlotIndex === null) return;
    if (dragOverSlotIndex !== index) {
      setDragOverSlotIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedSlotIndex === null) return;
    moveSlot(draggedSlotIndex, index);
    setDraggedSlotIndex(null);
    setDragOverSlotIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedSlotIndex(null);
    setDragOverSlotIndex(null);
  };

  const applyPreset = (presetKey: string) => {
    if (VARIABLE_PRESETS[presetKey]) {
      setVariableSlots(JSON.parse(JSON.stringify(VARIABLE_PRESETS[presetKey])));
    }
  };

  // LIVE TEST SANDBOX CALCULATIONS & SAMPLE STRING
  const testCalc = useMemo(() => {
    return calculateEmiDifference(
      testDetails.amount,
      testDetails.currentRoi,
      testDetails.targetRoi,
      testDetails.tenure
    );
  }, [testDetails.amount, testDetails.currentRoi, testDetails.targetRoi, testDetails.tenure]);

  const testSampleString = useMemo(() => {
    const mockRow: Record<string, any> = {
      [nameCol || "name"]: testDetails.name,
      [amountCol || "amount"]: testDetails.amount,
      [tenureCol || "tenure"]: testDetails.tenure,
      [roiCol || "roi"]: testDetails.currentRoi,
      [phoneCol || "phone"]: testDetails.phone,
      name: testDetails.name,
      amount: testDetails.amount,
      tenure: testDetails.tenure,
      roi: testDetails.currentRoi,
      company: testDetails.companyName,
    };

    // Merge custom extra test fields
    testExtraFields.forEach((field) => {
      const trimmed = field.key.trim();
      if (trimmed) {
        mockRow[trimmed] = field.value;
      }
    });

    const sampleValues = variableSlots.map((slot, sIdx) =>
      resolveVariableValue(
        slot,
        mockRow,
        {
          nameCol: nameCol || "name",
          amountCol: amountCol || "amount",
          tenureCol: tenureCol || "tenure",
          roiCol: roiCol || "roi",
        },
        testCalc,
        testDetails.targetRoi,
        variableSlots,
        sIdx
      )
    );

    return formatSampleStringForApi(sampleValues);
  }, [variableSlots, testDetails, testCalc, nameCol, amountCol, tenureCol, roiCol, testExtraFields]);

  // Load row 1 data into test details
  const handleLoadRowOneIntoTest = () => {
    if (processedData.length > 0) {
      const first = processedData[0];
      setTestDetails({
        name: first.name || "Rahul Sharma",
        phone: first.phoneInfo.formatted || "",
        amount: first.principal || 200000,
        tenure: first.tenure || 24,
        currentRoi: first.currentRoi || 23.5,
        targetRoi: targetRoi,
        companyName: "Credit Expert India",
      });

      // Auto-populate extra fields from any unmapped columns in Row 1
      const mappedColSet = new Set(
        [nameCol, amountCol, tenureCol, roiCol, phoneCol].filter(Boolean)
      );
      const otherCols = Object.keys(first.row).filter(
        (k) => !mappedColSet.has(k) && !k.startsWith("__EMPTY") && String(first.row[k] ?? "").trim() !== ""
      );

      if (otherCols.length > 0) {
        setTestExtraFields(
          otherCols.map((colKey, i) => ({
            id: `extra-field-${Date.now()}-${i}`,
            key: colKey,
            value: String(first.row[colKey] ?? ""),
          }))
        );
      }
    }
  };

  // Reset test details to defaults
  const handleResetTestDefaults = () => {
    setTestDetails(DEFAULT_TEST_DETAILS);
    setTestExtraFields([]);
    setCustomTestResponse(null);
  };

  // Extra field handlers for Sandbox
  const addTestExtraField = (initialKey = "", initialVal = "") => {
    setTestExtraFields((prev) => [
      ...prev,
      {
        id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        key: initialKey,
        value: initialVal,
      },
    ]);
  };

  const updateTestExtraField = (id: string, updates: Partial<TestExtraField>) => {
    setTestExtraFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeTestExtraField = (id: string) => {
    setTestExtraFields((prev) => prev.filter((f) => f.id !== id));
  };

  // Dispatch Custom Single Test
  const handleSendCustomTest = async () => {
    const phoneCheck = sanitizeIndianPhoneNumber(testDetails.phone, phoneFormatMode, phoneDefaultCountryCode);
    if (!phoneCheck.isValid) {
      alert(`Please enter a valid recipient phone number:\n${phoneCheck.error || "Empty"}`);
      return;
    }

    if (isMediaTemplate && !headerFile) {
      alert(
        `Template #${selectedTemplateId} (${currentTemplate?.TemplateName || "Selected"}) is an Image/Media template. Please upload a header image file before dispatching test.`
      );
      return;
    }

    const reqInfo = KNOWN_TEMPLATE_REQUIREMENTS[selectedTemplateId];
    if (reqInfo && variableSlots.length !== reqInfo.count) {
      const apply = window.confirm(
        `⚠️ Variable Count Warning (Prevents Meta ErrorCode 33):\n\nTemplate #${selectedTemplateId} (${reqInfo.name}) expects EXACTLY ${reqInfo.count} variables, but you currently have ${variableSlots.length} variables configured.\n\nRequired variables: ${reqInfo.description}\n\nClick "OK" to automatically load the correct ${reqInfo.count}-slot preset now, or "Cancel" to send anyway.`
      );
      if (apply) {
        applyPreset(reqInfo.presetKey);
        return;
      }
    }

    const confirmMsg = `Send single test WhatsApp message to +${phoneCheck.formatted}?\n\nCustomer: ${testDetails.name}\nCalculated Sample:\n"${testSampleString}"`;
    if (!window.confirm(confirmMsg)) return;

    setSendingCustomTest(true);
    setCustomTestResponse(null);

    try {
      const formData = new FormData();
      formData.append("action", "send-message");
      formData.append("quickNumber", phoneCheck.formatted);
      formData.append("templateId", selectedTemplateId);
      formData.append("sample", testSampleString);
      formData.append("campaignName", `${campaignName || "Test"}_Sandbox_${testDetails.name.replace(/\s+/g, "_")}`);
      if (apiTokenOverride) formData.append("apiToken", apiTokenOverride);
      if (currentTemplate?.TemplateName) formData.append("templateName", currentTemplate.TemplateName);
      if (currentTemplate?.TemplateTypeDescription) {
        formData.append("templateType", currentTemplate.TemplateTypeDescription);
      }
      if (headerFile) {
        formData.append("templateFile", headerFile);
        const ext = headerFile.name.split(".").pop() || "png";
        formData.append("templateFileExtension", ext);
      }

      const res = await fetch("/api/whatsapp", {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(45000),
      });
      const data = await res.json();
      setCustomTestResponse(data);

      if (data.success) {
        if (onRefreshMessages) onRefreshMessages();
      }
    } catch (err: any) {
      setCustomTestResponse({
        success: false,
        error:
          err.name === "TimeoutError"
            ? "Request timed out after 45s. Check network or gateway latency."
            : err.message || "Network exception while contacting WhatsApp API.",
      });
    } finally {
      setSendingCustomTest(false);
    }
  };

  // Launch Batch Dispatch (supports retry of failed recipients)
  const handleStartBatchDispatch = async (itemsOverride?: RowProcessingResult[]) => {
    if (processedData.length === 0) {
      alert("No data available to send.");
      return;
    }

    if (isMediaTemplate && !headerFile) {
      alert(
        `Template #${selectedTemplateId} (${currentTemplate?.TemplateName || "Selected"}) is an Image/Media template. Please upload a header image file before starting the batch.`
      );
      return;
    }

    // Determine target subset based on scope
    let itemsToProcess: RowProcessingResult[] = [];
    const isRetryMode = Boolean(itemsOverride && itemsOverride.length > 0);

    if (isRetryMode && itemsOverride) {
      itemsToProcess = itemsOverride;
    } else if (dispatchRange === "count") {
      const startIdx = Math.max(0, customRangeStart - 1);
      const count = Math.max(1, customPeopleCount);
      const endIdx = Math.min(processedData.length, startIdx + count);
      itemsToProcess = processedData.slice(startIdx, endIdx);
    } else if (dispatchRange === "test") {
      itemsToProcess = processedData.slice(0, 10);
    } else if (dispatchRange === "range") {
      const startIdx = Math.max(0, customRangeStart - 1);
      const endIdx = Math.min(processedData.length, customRangeEnd);
      itemsToProcess = processedData.slice(startIdx, endIdx);
    } else {
      itemsToProcess = processedData;
    }

    if (itemsToProcess.length === 0) {
      alert("Selected range or count contains 0 rows.");
      return;
    }

    const reqInfo = KNOWN_TEMPLATE_REQUIREMENTS[selectedTemplateId];
    if (reqInfo && variableSlots.length !== reqInfo.count) {
      const apply = window.confirm(
        `⚠️ Variable Count Warning (Prevents Meta ErrorCode 33):\n\nTemplate #${selectedTemplateId} (${reqInfo.name}) expects EXACTLY ${reqInfo.count} variables, but you currently have ${variableSlots.length} variables configured.\n\nRequired variables: ${reqInfo.description}\n\nClick "OK" to automatically load the correct ${reqInfo.count}-slot preset now, or "Cancel" to send anyway.`
      );
      if (apply) {
        applyPreset(reqInfo.presetKey);
        return;
      }
    }

    const filterNotice =
      isColumnFilterActive && !isRetryMode
        ? `\n\n🎯 Target Filter Active: Column "${columnFilterCol === "__ALL__" ? "All Columns" : columnFilterCol}" ${columnFilterCondition} "${columnFilterKeyword}"\n(${itemsToProcess.length} of ${rawActiveRows.length.toLocaleString()} total workbook records)`
        : "";

    const confirmPrefix = isRetryMode
      ? `Retry dispatching to ${itemsToProcess.length} previously failed recipients?`
      : `Are you sure you want to launch this campaign to ${itemsToProcess.length} recipients?${filterNotice}`;

    const confirmMsg = `${confirmPrefix}\n\n• Template: #${selectedTemplateId} (${currentTemplate?.TemplateName || "Selected"})\n• Throttle: ${throttleDelayMs}ms delay between requests\n• Target ROI: ${targetRoi}%\n• Sample: "${itemsToProcess[0]?.sampleString || ""}"`;
    if (!window.confirm(confirmMsg)) return;

    // Reset controls
    isPausedRef.current = false;
    isAbortedRef.current = false;
    setDispatchStatus("running");
    setTotalToProcess(itemsToProcess.length);
    setProgressIndex(0);

    let currentSuccess = isRetryMode ? stats.success : 0;
    let currentFailed = 0;
    let currentSkipped = isRetryMode ? stats.skipped : 0;
    const newFailedItems: RowProcessingResult[] = [];

    if (!isRetryMode) {
      setStats({ success: 0, failed: 0, skipped: 0 });
      setDispatchLogs([]);
      setFailedRowsList([]);
    } else {
      setStats((prev) => ({ ...prev, failed: 0 }));
      setFailedRowsList([]);
    }

    for (let i = 0; i < itemsToProcess.length; i++) {
      if (isAbortedRef.current) {
        setDispatchStatus("aborted");
        break;
      }

      while (isPausedRef.current && !isAbortedRef.current) {
        await new Promise((r) => setTimeout(r, 300));
      }

      if (isAbortedRef.current) {
        setDispatchStatus("aborted");
        break;
      }

      const item = itemsToProcess[i];
      setProgressIndex(i + 1);

      // Validate phone number
      if (!item.phoneInfo.isValid) {
        currentSkipped++;
        setStats({ success: currentSuccess, failed: currentFailed, skipped: currentSkipped });
        setDispatchLogs((prev) => [
          {
            id: `log-${Date.now()}-${i}`,
            timestamp: new Date().toLocaleTimeString(),
            rowIndex: item.rowIndex,
            name: item.name || "N/A",
            phone: item.phoneInfo.raw || "Empty",
            status: "SKIPPED",
            error: item.phoneInfo.error || "Invalid mobile number",
            sampleString: item.sampleString,
          },
          ...prev.slice(0, 49),
        ]);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("action", "send-message");
        formData.append("quickNumber", item.phoneInfo.formatted);
        formData.append("templateId", selectedTemplateId);
        formData.append("sample", item.sampleString);
        formData.append("campaignName", `${campaignName || "Bulk"}_Row${item.rowIndex}`);
        if (apiTokenOverride) formData.append("apiToken", apiTokenOverride);
        if (currentTemplate?.TemplateName) formData.append("templateName", currentTemplate.TemplateName);
        if (currentTemplate?.TemplateTypeDescription) {
          formData.append("templateType", currentTemplate.TemplateTypeDescription);
        }
        if (headerFile) {
          formData.append("templateFile", headerFile);
          const ext = headerFile.name.split(".").pop() || "png";
          formData.append("templateFileExtension", ext);
        }

        const res = await fetch("/api/whatsapp", {
          method: "POST",
          body: formData,
          signal: AbortSignal.timeout(45000),
        });
        const data = await res.json();

        if (data.success && data.campaignId) {
          currentSuccess++;
          setStats({ success: currentSuccess, failed: currentFailed, skipped: currentSkipped });
          setDispatchLogs((prev) => [
            {
              id: `log-${Date.now()}-${i}`,
              timestamp: new Date().toLocaleTimeString(),
              rowIndex: item.rowIndex,
              name: item.name,
              phone: item.phoneInfo.formatted,
              campaignId: Number(data.campaignId),
              status: "SUCCESS",
              sampleString: item.sampleString,
            },
            ...prev.slice(0, 49),
          ]);
        } else {
          currentFailed++;
          newFailedItems.push(item);
          setFailedRowsList([...newFailedItems]);
          setStats({ success: currentSuccess, failed: currentFailed, skipped: currentSkipped });
          setDispatchLogs((prev) => [
            {
              id: `log-${Date.now()}-${i}`,
              timestamp: new Date().toLocaleTimeString(),
              rowIndex: item.rowIndex,
              name: item.name,
              phone: item.phoneInfo.formatted,
              status: "FAILED",
              error: data.error || "Gateway rejected message",
              sampleString: item.sampleString,
            },
            ...prev.slice(0, 49),
          ]);
        }
      } catch (err: any) {
        currentFailed++;
        newFailedItems.push(item);
        setFailedRowsList([...newFailedItems]);
        setStats({ success: currentSuccess, failed: currentFailed, skipped: currentSkipped });
        setDispatchLogs((prev) => [
          {
            id: `log-${Date.now()}-${i}`,
            timestamp: new Date().toLocaleTimeString(),
            rowIndex: item.rowIndex,
            name: item.name,
            phone: item.phoneInfo.formatted,
            status: "FAILED",
            error:
              err.name === "TimeoutError"
                ? "Request timed out after 45s"
                : err.message || "Network exception",
            sampleString: item.sampleString,
          },
          ...prev.slice(0, 49),
        ]);
      }

      if (i < itemsToProcess.length - 1 && throttleDelayMs > 0) {
        await new Promise((r) => setTimeout(r, throttleDelayMs));
      }
    }

    if (!isAbortedRef.current) {
      setDispatchStatus("completed");
    }

    if (onRefreshMessages) onRefreshMessages();
  };

  const handlePause = () => {
    isPausedRef.current = true;
    setDispatchStatus("paused");
  };

  const handleResume = () => {
    isPausedRef.current = false;
    setDispatchStatus("running");
  };

  const handleAbort = () => {
    if (window.confirm("Abort this campaign batch? Messages already sent will not be recalled.")) {
      isAbortedRef.current = true;
      setDispatchStatus("aborted");
    }
  };

  return (
    <div className="space-y-6 text-[#0A2540]">
      {/* Hidden Global Workbook File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* SECTION HEADER CARD (Credit Expert India Website Theme) */}
      <div className="bg-white border border-[#E2E8F0] rounded-[28px] p-4 sm:p-8 shadow-[0_2px_16px_-3px_rgba(50,50,93,0.06),0_4px_6px_-2px_rgba(0,0,0,0.03)] relative overflow-hidden">
        {/* Subtle decorative Misty Skyline image from homepage */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-15 pointer-events-none overflow-hidden">
          <img
            src="/Misty India Skyline with Orbital Arcs.webp"
            alt="Decorative Skyline"
            className="w-full h-full object-cover object-left"
          />
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <span className="p-2.5 rounded-xl bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE] shadow-sm">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0A2540] tracking-tight">
                Excel Bulk EMI Campaign Engine
              </h2>
              <span className="text-[11px] px-3 py-1 rounded-full bg-[#F0FDF4] text-[#15803D] font-bold border border-[#BBF7D0] uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-[#15803D]" />
                Automated 9.99% EMI Reduction
              </span>
            </div>
            <p className="text-sm text-[#3C4F69] max-w-2xl leading-relaxed">
              Upload customer portfolios (like <code className="bg-[#F1F5F9] text-[#0A2540] px-1.5 py-0.5 rounded font-mono font-semibold">Dec-25.xlsx</code>), automatically calculate current vs 9.99% reduced EMIs, configure drag &amp; drop WhatsApp variable tags, test with custom details, and launch personalized campaigns.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {fileName ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-3 bg-white border border-[#E2E8F0] rounded-2xl px-4 py-2.5 shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-[#EAF3FF] flex items-center justify-center text-[#0066FF]">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#0A2540] truncate max-w-[170px]" title={fileName}>
                      {fileName}
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      {fileSize} &bull; {sheets.length} sheet{sheets.length > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="max-sm:min-h-11 px-3.5 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-[#0A2540] hover:text-[#0066FF] font-semibold text-xs transition border border-[#CBD5E1] hover:border-[#0066FF] shadow-xs flex items-center gap-1.5"
                  title="Upload another Excel file"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-[#0066FF]" />
                  <span>Change</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearWorkbook}
                  className="max-sm:min-h-11 max-sm:min-w-11 p-2.5 rounded-2xl bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 font-semibold text-xs transition border border-[#CBD5E1] hover:border-red-300 shadow-xs"
                  title="Clear loaded workbook"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={parsingFile}
                  className="max-sm:min-h-11 px-4 py-2.5 rounded-2xl bg-[#0066FF] hover:bg-[#0052cc] text-white font-semibold text-xs transition flex items-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload Excel File</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadDemoDec25}
                  disabled={parsingFile}
                  className="max-sm:min-h-11 px-3.5 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-[#0A2540] font-semibold text-xs transition flex items-center gap-1.5 border border-[#CBD5E1] shadow-xs disabled:opacity-50"
                  title="Load sample Dec-25.xlsx demo workbook"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#0066FF]" />
                  <span>Sample Dec-25.xlsx</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STEP 1: UPLOAD & MULTI-SHEET SELECTOR */}
      <div className="bg-white border border-[#E2E8F0] rounded-[28px] p-4 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE] flex items-center justify-center text-xs font-bold shadow-sm">
              1
            </span>
            <div>
              <h3 className="text-base font-bold text-[#0A2540]">Upload Excel File &amp; Select Sheet</h3>
              <p className="text-xs text-[#64748B]">Select multi-sheet workbook or combine all sheets</p>
            </div>
          </div>
          {sheets.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {isColumnFilterActive ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-blue-700 font-bold flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200 shadow-sm">
                    <Filter className="w-3.5 h-3.5 text-[#0066FF]" />
                    {activeRows.length.toLocaleString()} / {rawActiveRows.length.toLocaleString()} rows (Filtered)
                  </span>
                  <button
                    type="button"
                    onClick={handleClearColumnFilter}
                    className="max-sm:min-h-11 text-[11px] font-semibold text-slate-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition"
                    title="Clear column filter"
                  >
                    Clear Filter
                  </button>
                </div>
              ) : (
                <span className="text-xs text-[#15803D] font-bold flex items-center gap-1.5 bg-[#F0FDF4] px-3 py-1.5 rounded-full border border-[#BBF7D0] shadow-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  {activeRows.length.toLocaleString()} total rows loaded
                </span>
              )}
            </div>
          )}
        </div>

        {sheets.length === 0 ? (
          <div className="space-y-4">
            {/* Interactive Drag & Drop Area */}
            <div
              onDragOver={handleFileDragOver}
              onDragEnter={handleFileDragEnter}
              onDragLeave={handleFileDragLeave}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-2xl cursor-pointer transition-all shadow-sm ${isDragging
                  ? "border-[#0066FF] bg-blue-50/70 ring-4 ring-[#0066FF]/20 scale-[1.01]"
                  : "border-[#CBD5E1] hover:border-[#0066FF] bg-gradient-to-b from-[#F8FAFC] to-[#F1F5F9] hover:from-[#F0F7FF] hover:to-[#EAF3FF]"
                }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-sm mb-3 ${isDragging
                    ? "bg-[#0066FF] text-white animate-bounce"
                    : "bg-[#EAF3FF] text-[#0066FF]"
                  }`}
              >
                <UploadCloud className="w-7 h-7" />
              </div>
              <span className="text-base font-bold text-[#0A2540]">
                {parsingFile
                  ? "Reading & parsing workbook sheets..."
                  : isDragging
                    ? "Drop your Excel workbook here"
                    : "Drag & drop your Excel workbook here, or click to browse"}
              </span>
              <span className="text-xs text-[#64748B] mt-1.5 text-center max-w-md">
                Supports <code className="font-mono text-[#0A2540] font-semibold">.xlsx</code>,{" "}
                <code className="font-mono text-[#0A2540] font-semibold">.xls</code>, and{" "}
                <code className="font-mono text-[#0A2540] font-semibold">.csv</code> (multi-sheet workbooks supported)
              </span>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  disabled={parsingFile}
                  className="max-sm:min-h-11 px-5 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Browse File from Computer</span>
                </button>
              </div>
            </div>

            {/* Clearly Separated Sample Demo Loader */}
            <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#EAF3FF] text-[#0066FF] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0A2540]">Need sample data to test with?</div>
                  <div className="text-[11px] text-[#64748B]">
                    Load our pre-packaged sample portfolio (<code className="font-mono text-[#0A2540]">Dec-25.xlsx</code> with 2 sheets &amp; 49,664 records)
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLoadDemoDec25}
                disabled={parsingFile}
                className="max-sm:min-h-11 px-4 py-2 rounded-xl text-xs font-semibold bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0A2540] transition border border-[#CBD5E1] flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0066FF]" />
                <span>Load Sample Dec-25.xlsx</span>
              </button>
            </div>

            {parseError && (
              <div className="mt-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-8">
                <label className="block text-xs font-bold text-[#0A2540] mb-2 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#0066FF]" />
                  Select Workbook Sheet:
                </label>
                <div className="flex flex-wrap gap-2">
                  {sheets.map((sheet) => (
                    <button
                      key={sheet.name}
                      type="button"
                      onClick={() => handleSheetChange(sheet.name)}
                      className={`max-sm:min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 border ${selectedSheetName === sheet.name
                          ? "bg-[#0066FF] text-white border-[#0066FF] shadow-md shadow-blue-500/20"
                          : "bg-white text-[#3C4F69] border-[#E2E8F0] hover:border-[#0066FF] hover:bg-slate-50"
                        }`}
                    >
                      <span>{sheet.name}</span>
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded-md font-mono ${selectedSheetName === sheet.name
                            ? "bg-blue-700 text-white"
                            : "bg-[#F1F5F9] text-[#64748B]"
                          }`}
                      >
                        {sheet.rowCount.toLocaleString()} rows
                      </span>
                    </button>
                  ))}

                  {sheets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleSheetChange("all")}
                      className={`max-sm:min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 border ${selectedSheetName === "all"
                          ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20"
                          : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                        }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>All Sheets Combined</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md font-mono bg-blue-100 text-blue-800">
                        {sheets.reduce((acc, s) => acc + s.rowCount, 0).toLocaleString()} rows
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div className="md:col-span-4 flex md:justify-end items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="max-sm:min-h-11 cursor-pointer text-xs font-semibold text-[#0A2540] hover:text-[#0066FF] px-3.5 py-2 rounded-xl border border-[#E2E8F0] hover:border-[#0066FF] bg-white hover:bg-blue-50/50 transition flex items-center gap-2 shadow-sm"
                >
                  <UploadCloud className="w-4 h-4 text-[#0066FF]" />
                  <span>Upload different file</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearWorkbook}
                  className="max-sm:min-h-11 max-sm:min-w-11 p-2 rounded-xl text-xs font-semibold bg-white border border-[#E2E8F0] hover:border-red-300 hover:text-red-600 text-slate-400 hover:bg-red-50/50 transition shadow-sm"
                  title="Remove file and reset"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* SINGLE COLUMN KEYWORD FILTER PANEL */}
            <div className="mt-4 pt-4 border-t border-[#E2E8F0] space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#EAF3FF] text-[#0066FF] flex items-center justify-center shrink-0">
                    <Filter className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0A2540] flex items-center gap-2">
                      <span>Filter Entire Excel by Column Keyword</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-[#0066FF] border border-blue-200 font-semibold">
                        Target Specific Audience
                      </span>
                    </h4>
                  </div>
                </div>

                {isColumnFilterActive && (
                  <button
                    type="button"
                    onClick={handleClearColumnFilter}
                    className="max-sm:min-h-11 text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 transition self-start sm:self-auto"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear Filter &amp; Show All {rawActiveRows.length.toLocaleString()}</span>
                  </button>
                )}
              </div>

              <p className="text-xs text-[#64748B]">
                Filter records by any column keyword (e.g., Company, City, State, or Status). The campaign and calculations will only apply to matching rows.
              </p>

              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] border border-[#CBD5E1] space-y-3.5 shadow-xs">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* Column to filter */}
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-[#0A2540] mb-1">
                      1. Select Column to Filter:
                    </label>
                    <select
                      value={columnFilterCol}
                      onChange={(e) => {
                        setColumnFilterCol(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] font-medium focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 shadow-xs"
                    >
                      <option value="">-- Choose Column to Filter --</option>
                      <option value="__ALL__">🌐 All Columns (Search Entire Row)</option>
                      {availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Match condition */}
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-[#0A2540] mb-1">
                      2. Match Rule:
                    </label>
                    <select
                      value={columnFilterCondition}
                      onChange={(e: any) => {
                        setColumnFilterCondition(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] font-medium focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 shadow-xs"
                    >
                      <option value="contains">Contains Keyword</option>
                      <option value="exact">Exact Match (Equals)</option>
                      <option value="starts_with">Starts With</option>
                      <option value="does_not_contain">Does Not Contain (Exclude)</option>
                    </select>
                  </div>

                  {/* Keyword Input & Case Toggle */}
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-[#0A2540] mb-1">
                      3. Keyword / Value to Match:
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={columnFilterKeyword}
                          onChange={(e) => {
                            setColumnFilterKeyword(e.target.value);
                            setCurrentPage(1);
                          }}
                          placeholder={
                            columnFilterCol && columnFilterCol !== "__ALL__"
                              ? `Type keyword for "${columnFilterCol}"...`
                              : "Type keyword (e.g. TCS, DELHI, UJJAIN)..."
                          }
                          className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl pl-8 pr-8 py-2 max-sm:text-base text-xs text-[#0A2540] placeholder-slate-400 font-medium focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 shadow-xs"
                        />
                        {columnFilterKeyword && (
                          <button
                            type="button"
                            onClick={() => {
                              setColumnFilterKeyword("");
                              setCurrentPage(1);
                            }}
                            className="max-sm:min-h-11 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            title="Clear keyword"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setColumnFilterCaseSensitive(!columnFilterCaseSensitive);
                          setCurrentPage(1);
                        }}
                        title={
                          columnFilterCaseSensitive
                            ? "Case Sensitive is ON (click to make case-insensitive)"
                            : "Case Insensitive (click to match exact case)"
                        }
                        className={`max-sm:min-h-11 px-2.5 py-2 rounded-xl text-xs font-mono font-bold transition border ${columnFilterCaseSensitive
                            ? "bg-[#0066FF] text-white border-[#0066FF]"
                            : "bg-white text-[#64748B] border-[#CBD5E1] hover:text-[#0A2540]"
                          }`}
                      >
                        Aa
                      </button>
                    </div>
                  </div>
                </div>

                {/* Popular value suggestions for selected column */}
                {topColumnSuggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                    <span className="text-[#64748B] font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Popular in <span className="font-semibold text-[#0A2540]">{columnFilterCol}:</span>
                    </span>
                    {topColumnSuggestions.map(({ value, count }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setColumnFilterKeyword(value);
                          setColumnFilterCondition("exact");
                          setCurrentPage(1);
                        }}
                        className={`max-sm:min-h-11 px-2 py-0.5 rounded-lg text-[11px] font-medium transition border flex items-center gap-1 ${columnFilterKeyword === value && columnFilterCondition === "exact"
                            ? "bg-[#0066FF] text-white border-[#0066FF] shadow-xs"
                            : "bg-white text-[#3C4F69] border-[#CBD5E1] hover:border-[#0066FF] hover:bg-blue-50/50"
                          }`}
                      >
                        <span className="truncate max-w-[140px]">{value}</span>
                        <span className="text-[11px] opacity-75 font-mono">({count.toLocaleString()})</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Live Match Summary Bar */}
                {isColumnFilterActive && (
                  <div
                    className={`p-3 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 border ${activeRows.length > 0
                        ? "bg-emerald-50/90 text-emerald-900 border-emerald-200"
                        : "bg-amber-50 text-amber-900 border-amber-200"
                      }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${activeRows.length > 0 ? "text-emerald-600" : "text-amber-500"
                          }`}
                      />
                      <span>
                        {activeRows.length > 0 ? (
                          <>
                            <strong>{activeRows.length.toLocaleString()}</strong> of{" "}
                            {rawActiveRows.length.toLocaleString()} rows match (
                            {((activeRows.length / (rawActiveRows.length || 1)) * 100).toFixed(1)}%) •{" "}
                            <strong>{(rawActiveRows.length - activeRows.length).toLocaleString()}</strong> rows excluded.
                            Campaign dispatch will send <em>only</em> to these {activeRows.length.toLocaleString()} matching records.
                          </>
                        ) : (
                          <>
                            No rows matched keyword &quot;<strong>{columnFilterKeyword}</strong>&quot; in{" "}
                            <strong>{columnFilterCol === "__ALL__" ? "All Columns" : columnFilterCol}</strong>. Try another keyword or change match rule.
                          </>
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearColumnFilter}
                      className="max-sm:min-h-11 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-[#0A2540] shadow-xs"
                    >
                      Clear Filter
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {sheets.length > 0 && (
        <>
          {/* STEP 2: COLUMN MAPPING & RATE PARAMETERS */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE] flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <h3 className="text-base font-bold text-[#0A2540]">Map Excel Columns &amp; Loan Parameters</h3>
              </div>
              <span className="text-xs text-[#64748B]">
                Match sheet headers to calculate EMIs and customer variables
              </span>
            </div>

            {/* Column Auto-Detection Status Banner */}
            {!nameCol || !phoneCol ? (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                <div className="flex flex-wrap items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Required Columns Missing:</strong> Please select matching columns below for:{" "}
                    <strong>
                      {[
                        !nameCol && "Customer / Candidate Name",
                        !phoneCol && "Mobile / Phone",
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </strong>
                    .
                  </span>
                </div>
                <span className="text-[11px] text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md self-start sm:self-auto font-medium">
                  {[nameCol, phoneCol].filter(Boolean).length}/2 Essential Mapped
                </span>
              </div>
            ) : !amountCol || !tenureCol || !roiCol ? (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Essential columns mapped: <strong>{nameCol}</strong> (Name) &amp; <strong>{phoneCol}</strong> (Phone). Ready for messaging!
                    <span className="block sm:inline sm:ml-1 text-slate-500 text-[11px]">
                      (Loan Amount, Tenure &amp; ROI are optional unless your template uses EMI calculations).
                    </span>
                  </span>
                </div>
                <span className="text-[11px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md font-semibold shrink-0">
                  Ready (General Campaign)
                </span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    All 5 columns mapped: <strong>{nameCol}</strong> (Name), <strong>{amountCol}</strong> (Amount), <strong>{tenureCol}</strong> (Tenure), <strong>{roiCol}</strong> (ROI), <strong>{phoneCol}</strong> (Phone). Full EMI calculation engine active!
                  </span>
                </div>
                <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md font-semibold shrink-0">
                  5/5 Full EMI Ready
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Column 1: Customer Name */}
              <div>
                <label className="block text-xs font-bold text-[#0A2540] mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#0066FF]" />
                  Customer / Candidate Name <span className="text-red-500">*</span>
                </label>
                <select
                  value={nameCol}
                  onChange={(e) => setNameCol(e.target.value)}
                  className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-medium transition shadow-sm"
                >
                  <option value="">-- Choose Column --</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#64748B] mt-1 truncate">
                  e.g. Candidate Name / CUSTOMERNAME
                </p>
              </div>

              {/* Column 2: Total Amount */}
              <div>
                <label className="block text-xs font-bold text-[#0A2540] mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-[#0066FF]" />
                  Total Amount (Loan) <span className="text-slate-400 font-normal text-[11px] ml-1">(Optional)</span>
                </label>
                <select
                  value={amountCol}
                  onChange={(e) => setAmountCol(e.target.value)}
                  className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-medium transition shadow-sm"
                >
                  <option value="">-- Choose Column --</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#64748B] mt-1 truncate">
                  e.g. DISBURSEMENTAMOUNT
                </p>
              </div>

              {/* Column 3: Tenure */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="text-xs font-bold text-[#0A2540] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#0066FF]" />
                    Tenure <span className="text-slate-400 font-normal text-[11px] ml-1">(Optional)</span>
                  </label>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setTenureUnit("months")}
                      className={`max-sm:min-h-11 px-1.5 py-0.5 rounded ${tenureUnit === "months"
                          ? "bg-[#0066FF] text-white font-bold"
                          : "text-[#64748B] hover:text-[#0A2540]"
                        }`}
                    >
                      Mos
                    </button>
                    <button
                      type="button"
                      onClick={() => setTenureUnit("years")}
                      className={`max-sm:min-h-11 px-1.5 py-0.5 rounded ${tenureUnit === "years"
                          ? "bg-[#0066FF] text-white font-bold"
                          : "text-[#64748B] hover:text-[#0A2540]"
                        }`}
                    >
                      Yrs
                    </button>
                  </div>
                </div>
                <select
                  value={tenureCol}
                  onChange={(e) => setTenureCol(e.target.value)}
                  className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-medium transition shadow-sm"
                >
                  <option value="">-- Choose Column --</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#64748B] mt-1 truncate">
                  e.g. TENOR ({tenureUnit === "months" ? "Months" : "Years"})
                </p>
              </div>

              {/* Column 4: Current ROI */}
              <div>
                <label className="block text-xs font-bold text-[#0A2540] mb-1.5 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
                  Current ROI (%) <span className="text-slate-400 font-normal text-[11px] ml-1">(Optional)</span>
                </label>
                <select
                  value={roiCol}
                  onChange={(e) => setRoiCol(e.target.value)}
                  className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-medium transition shadow-sm"
                >
                  <option value="">-- Choose Column --</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#64748B] mt-1 truncate">
                  e.g. ROI (e.g. 23.5)
                </p>
              </div>

              {/* Column 5: Phone Number */}
              <div>
                <label className="block text-xs font-bold text-[#0A2540] mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#0066FF]" />
                  Mobile / WhatsApp <span className="text-red-500">*</span>
                </label>
                <select
                  value={phoneCol}
                  onChange={(e) => setPhoneCol(e.target.value)}
                  className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-medium transition shadow-sm"
                >
                  <option value="">-- Choose Column --</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#64748B] mt-1 truncate">
                  e.g. standardizedMobileNo
                </p>
              </div>
            </div>

            {/* Phone Number Treatment & Format Rule Option Selector Panel */}
            {phoneCol && (
              <div className="mt-3 p-4 rounded-2xl bg-gradient-to-br from-blue-50/90 via-[#F8FAFC] to-blue-50/70 border border-[#BFDBFE] space-y-3.5 shadow-xs">
                {/* Header & Validity Count Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[#BFDBFE]">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#0066FF] text-white flex items-center justify-center shadow-xs">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#0A2540] flex items-center gap-2">
                        <span>Phone Number Column Format Rule</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#0066FF]/10 text-[#0066FF] font-mono font-semibold">
                          Column: {phoneCol}
                        </span>
                      </h4>
                      <p className="text-[11px] text-[#64748B]">
                        Select how phone numbers in this column are structured (plain 10-digit, with 91, 91 with space, or mixed).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    {/* Live Validation Counter Badge */}
                    {phoneStats.invalid === 0 ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold flex items-center gap-1.5 shadow-xs">
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                        {phoneStats.valid.toLocaleString()} / {phoneStats.total.toLocaleString()} Valid (100%)
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold flex items-center gap-1.5 shadow-xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        {phoneStats.valid.toLocaleString()} Valid · {phoneStats.invalid.toLocaleString()} Invalid
                      </span>
                    )}

                    {/* Country Code Prefix Setting */}
                    <div className="flex items-center gap-1 bg-white border border-[#CBD5E1] rounded-xl px-2.5 py-1 shadow-xs">
                      <span className="text-[11px] font-bold text-[#64748B]">Prefix:</span>
                      <span className="text-[11px] font-mono font-bold text-[#0066FF]">+</span>
                      <input
                        type="text"
                        value={phoneDefaultCountryCode}
                        onChange={(e) => setPhoneDefaultCountryCode(e.target.value.replace(/\D/g, "") || "91")}
                        className="max-sm:min-h-11 w-7 text-[11px] font-mono font-bold text-[#0A2540] focus:outline-none text-center bg-transparent"
                        title="Default country dialing code (defaults to 91 for India)"
                      />
                    </div>
                  </div>
                </div>

                {/* Auto Detection Intelligence Tip */}
                {autoDetectedPhoneHint && (
                  <div className="p-2.5 rounded-xl bg-white/80 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#0A2540]">
                    <div className="flex flex-wrap items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#0066FF] shrink-0" />
                      <span>
                        <strong>Smart Auto-Analysis:</strong> {autoDetectedPhoneHint.summary}
                      </span>
                    </div>
                    {phoneFormatMode !== autoDetectedPhoneHint.detectedMode && (
                      <button
                        type="button"
                        onClick={() => setPhoneFormatMode(autoDetectedPhoneHint.detectedMode)}
                        className="max-sm:min-h-11 text-[11px] font-semibold text-[#0066FF] hover:underline self-start sm:self-auto shrink-0"
                      >
                        Apply Detected Mode
                      </button>
                    )}
                  </div>
                )}

                {/* Selectable Format Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  {PHONE_FORMAT_OPTIONS.map((opt) => {
                    const isSelected = phoneFormatMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPhoneFormatMode(opt.id)}
                        className={`max-sm:min-h-11 max-sm:min-w-11 text-left p-3 rounded-xl border transition-all duration-150 flex flex-col justify-between ${
                          isSelected
                            ? "bg-white border-[#0066FF] ring-2 ring-[#0066FF]/20 shadow-sm"
                            : "bg-white/60 hover:bg-white border-[#CBD5E1] text-[#3C4F69] hover:border-[#94A3B8]"
                        }`}
                      >
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <span
                              className={`text-xs font-bold ${
                                isSelected ? "text-[#0066FF]" : "text-[#0A2540]"
                              }`}
                            >
                              {opt.label}
                            </span>
                            {opt.badge && (
                              <span className="text-[11px] uppercase px-1.5 py-0.5 rounded-md font-bold bg-[#0066FF] text-white">
                                {opt.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#64748B] leading-snug line-clamp-2">
                            {opt.description}
                          </p>
                        </div>
                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <code className="text-[11px] font-mono text-[#0066FF] font-semibold truncate max-w-[140px]">
                            {opt.example}
                          </code>
                          <span
                            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[11px] shrink-0 ${
                              isSelected
                                ? "bg-[#0066FF] text-white font-bold"
                                : "border border-slate-300"
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Live Sample Transformations (from user's real file rows) */}
                {phoneSamples.length > 0 && (
                  <div className="pt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-bold text-[#3C4F69] flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-[#0066FF]" />
                        Live Row Sanitization Preview (Sheet: {selectedSheetName || "Active"}):
                      </span>
                      <span className="text-[11px] text-[#64748B]">
                        Formatted to WhatsApp API requirement (+91XXXXXXXXXX)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {phoneSamples.map((sample) => (
                        <div
                          key={sample.index}
                          className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs shadow-2xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B] mb-1">
                            <span className="font-semibold text-[#0A2540] truncate max-w-[120px]">
                              {sample.name}
                            </span>
                            <span className="font-mono text-[11px]">Row {sample.index}</span>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-slate-500 truncate">
                              Excel: <span className="font-mono font-medium text-slate-700">{sample.raw || "(empty)"}</span>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                              <span className="text-[11px] font-mono font-bold text-[#0066FF] truncate">
                                ➔ +{sample.formatted}
                              </span>
                              {sample.isValid ? (
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-0.5">
                                  <Check className="w-3 h-3 text-emerald-600" /> Valid
                                </span>
                              ) : (
                                <span
                                  className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-semibold flex items-center gap-0.5"
                                  title={sample.error}
                                >
                                  <AlertTriangle className="w-3 h-3 text-red-500" /> Invalid
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Target ROI Parameter Banner */}
            <div className="pt-2 flex flex-wrap items-center gap-4 bg-[#F0FDF4] p-3.5 rounded-xl border border-[#BBF7D0]">
              <div className="flex flex-wrap items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#15803D]" />
                <span className="text-xs font-bold text-[#0A2540]">Target Reduced ROI:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max="30"
                  value={targetRoi}
                  onChange={(e) => setTargetRoi(parseFloat(e.target.value) || 9.99)}
                  className="max-sm:min-h-11 w-24 bg-white border border-[#86EFAC] rounded-lg px-2.5 py-1 max-sm:text-base text-xs text-[#15803D] font-mono font-bold focus:outline-none focus:border-[#15803D] text-center shadow-sm"
                />
                <span className="text-xs font-bold text-[#15803D]">%</span>
              </div>
              <p className="text-xs text-[#374151]">
                Reduced interest rate used to calculate <strong>New Monthly EMI</strong> and <strong>Monthly Savings</strong>.
              </p>
            </div>
          </div>

          {/* STEP 3: TEMPLATE & DYNAMIC VARIABLE SLOT CONFIGURATOR */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE] flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <h3 className="text-base font-bold text-[#0A2540]">
                  WhatsApp Template &amp; Variable Slots Configurator
                </h3>
              </div>
              <span className="text-xs text-[#0066FF] font-semibold flex items-center gap-1 bg-[#EAF3FF] px-2.5 py-1 rounded-full border border-[#BFDBFE]">
                <GripVertical className="w-3.5 h-3.5" />
                Drag to reorder &bull; Write custom text &amp; tags
              </span>
            </div>

            {/* Template Selector & Media Upload */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-6 space-y-4">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label className="block text-xs font-bold text-[#0A2540]">
                      Approved WhatsApp Template <span className="text-red-500">*</span>
                    </label>
                    {currentTemplate && (
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${isMediaTemplate
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]"
                          }`}
                      >
                        {isMediaTemplate ? "📸 Media (Image) Template" : "📝 Text Template"}
                      </span>
                    )}
                  </div>

                  <select
                    value={selectedTemplateId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedTemplateId(val);
                      const req = KNOWN_TEMPLATE_REQUIREMENTS[val];
                      if (req && req.presetKey) {
                        applyPreset(req.presetKey);
                      }
                    }}
                    className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2.5 max-sm:text-base text-xs text-[#0A2540] focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-medium transition shadow-sm"
                  >
                    {templatesList.map((tpl) => (
                      <option key={tpl.WhatsAppTemplateId} value={tpl.WhatsAppTemplateId}>
                        #{tpl.WhatsAppTemplateId}: {tpl.TemplateName} (
                        {tpl.TemplateTypeDescription || "Text"} &bull; {tpl.TemplateCategory || "Utility"}) [
                        {tpl.TemplateStatusDescription}]
                      </option>
                    ))}
                    {!templatesList.some((t) => String(t.WhatsAppTemplateId) === "78") && (
                      <option value="78">#78: excelv3 (Image &bull; Utility) [APPROVED]</option>
                    )}
                    {!templatesList.some((t) => String(t.WhatsAppTemplateId) === "77") && (
                      <option value="77">#77: excelv2 (Image &bull; Marketing) [APPROVED]</option>
                    )}
                    {!templatesList.some((t) => String(t.WhatsAppTemplateId) === "72") && (
                      <option value="72">#72: reduce_emi (Image &bull; Utility) [APPROVED]</option>
                    )}
                    {!templatesList.some((t) => String(t.WhatsAppTemplateId) === "71") && (
                      <option value="71">#71: crminqueri (Image &bull; Marketing) [APPROVED]</option>
                    )}
                  </select>

                  {/* Template Variable Count Requirements & Mismatch Alert */}
                  <div className="mt-2 text-xs">
                    {(() => {
                      const req = KNOWN_TEMPLATE_REQUIREMENTS[selectedTemplateId];
                      if (!req) {
                        return (
                          <p className="text-[#64748B]">
                            Configured variables will be sent in comma-separated order to the gateway.
                          </p>
                        );
                      }

                      const hasMismatch = variableSlots.length !== req.count;
                      return (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Requires Exactly {req.count} Variables
                            </span>
                            <span className="text-[11px] text-[#15803D] font-mono">
                              {req.description}
                            </span>
                          </div>

                          {hasMismatch && (
                            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                              <span className="flex items-center gap-1.5 font-semibold">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                Mismatch: Template #{selectedTemplateId} expects {req.count} variables, but you have {variableSlots.length} slots.
                              </span>
                              <button
                                type="button"
                                onClick={() => applyPreset(req.presetKey)}
                                className="max-sm:min-h-11 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shrink-0 shadow-2xs"
                              >
                                Fix: Load {req.count}-Slot Preset
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0A2540] mb-1.5">
                    Campaign Tag / Name <span className="text-[#64748B] font-normal">(Optional for tracking)</span>
                  </label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. Dec25_EMI_Campaign_Batch1"
                    className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2 max-sm:text-base text-xs text-[#0A2540] placeholder-[#94A3B8] focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition shadow-sm font-medium"
                  />
                </div>
              </div>

              {/* Media File Upload for Image Templates */}
              <div className="lg:col-span-6">
                <div
                  className={`p-4 rounded-xl border transition h-full flex flex-col justify-between ${isMediaTemplate
                      ? "bg-blue-50/60 border-blue-200"
                      : "bg-[#F8FAFC] border-[#E2E8F0]"
                    }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <ImageIcon
                          className={`w-4 h-4 ${isMediaTemplate ? "text-blue-600" : "text-slate-500"
                            }`}
                        />
                        <span className="text-xs font-bold text-[#0A2540]">
                          Header Media File{" "}
                          {isMediaTemplate ? (
                            <span className="text-red-500 font-semibold">* (Required for #72 &amp; #71)</span>
                          ) : (
                            <span className="text-[#64748B] font-normal">(Optional)</span>
                          )}
                        </span>
                      </div>
                      {isMediaTemplate && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold border border-blue-200">
                          Prevents ErrorCode 34
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#64748B] mb-3">
                      Required by Meta when sending image-header templates. Upload banner once; it will be sent with all campaign rows.
                    </p>
                  </div>

                  {!headerFile ? (
                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#CBD5E1] hover:border-[#0066FF] rounded-xl cursor-pointer bg-white hover:bg-slate-50 transition group shadow-sm">
                      <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-[#0066FF] transition mb-1" />
                      <span className="text-xs font-semibold text-[#0A2540] group-hover:text-[#0066FF] transition">
                        Select Campaign Header Image
                      </span>
                      <span className="text-[11px] text-[#64748B] mt-0.5">
                        PNG, JPG, JPEG or WEBP (up to 5MB)
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleHeaderFileChange}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
                      <div className="flex flex-wrap items-center gap-3">
                        {headerFilePreview ? (
                          <img
                            src={headerFilePreview}
                            alt="Header preview"
                            className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-bold text-[#0A2540] truncate max-w-[200px]">
                            {headerFile.name}
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            {(headerFile.size / 1024).toFixed(1)} KB &bull; Attached to campaign
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearHeaderFile}
                        className="max-sm:min-h-11 max-sm:min-w-11 p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 border border-slate-200 transition"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Variable Slots Mapping Card */}
            <div className="space-y-4 pt-3.5 border-t border-[#E2E8F0]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#0066FF]" />
                  <span className="text-xs font-bold text-[#0A2540]">Variable Slots Configurator:</span>
                  <span className="text-xs text-[#64748B]">
                    ({variableSlots.length} active slot{variableSlots.length > 1 ? "s" : ""})
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[#64748B] font-medium">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => applyPreset("excelv3_78")}
                    className="max-sm:min-h-11 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE] hover:bg-blue-100 transition flex items-center gap-1 shadow-2xs"
                  >
                    <Sparkles className="w-3 h-3 text-[#0066FF]" />
                    #78 excelv3 (6 vars)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("reduce_emi_72")}
                    className="max-sm:min-h-11 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE] hover:bg-blue-100 transition flex items-center gap-1 shadow-2xs"
                  >
                    <Sparkles className="w-3 h-3 text-[#0066FF]" />
                    #72 reduce_emi (4 vars)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("crminqueri_71")}
                    className="max-sm:min-h-11 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-[#3C4F69] border border-slate-200 hover:bg-slate-200 transition"
                  >
                    #71 crm (5 vars)
                  </button>
                  <button
                    type="button"
                    onClick={addVariableSlot}
                    className="max-sm:min-h-11 px-3 py-1 rounded-lg text-xs font-semibold bg-[#0066FF] hover:bg-blue-700 text-white transition flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-3 h-3" />
                    Add Slot
                  </button>
                </div>
              </div>

              {/* DRAG AND DROP SLOTS LIST */}
              <div className="space-y-3">
                {variableSlots.map((slot, idx) => {
                  const isDifferenceMode = slot.mode === "difference" || slot.sourceType === "difference";
                  const isCustomMode = slot.mode === "custom" || slot.sourceType === "custom_text";
                  const isSelectMode = !isDifferenceMode && !isCustomMode;
                  const isDraggingThis = draggedSlotIndex === idx;
                  const isDragOverThis = dragOverSlotIndex === idx;

                  return (
                    <div
                      key={slot.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`p-4 rounded-xl border transition-all duration-200 ${isDragOverThis
                          ? "bg-blue-50/80 border-[#0066FF] shadow-lg scale-[1.01]"
                          : isDraggingThis
                            ? "opacity-40 border-dashed border-[#0066FF] bg-slate-50"
                            : isDifferenceMode
                              ? "bg-[#F8FAFC] border-amber-200 hover:border-amber-300 shadow-sm"
                              : isCustomMode
                                ? "bg-[#FAF8FF] border-blue-200 hover:border-blue-300 shadow-sm"
                                : "bg-[#F8FAFC] border-[#E2E8F0] hover:border-slate-300 shadow-sm"
                        }`}
                    >
                      <div className="flex flex-col gap-3">
                        {/* Top Row: Handle, Slot Badge, 3-Mode Switcher, and Position Controls */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2.5">
                            {/* Drag Handle */}
                            <div
                              className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg text-slate-400 hover:text-[#0066FF] hover:bg-white transition flex items-center justify-center border border-transparent hover:border-slate-200"
                              title="Drag to change variable position"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>

                            {/* Variable Slot Number */}
                            <span className="px-2.5 py-1 rounded-lg bg-[#EAF3FF] text-[#0066FF] font-mono font-bold text-xs border border-[#BFDBFE] shrink-0">
                              {`{{${idx + 1}}}`}
                            </span>

                            {/* Mode Switcher: Predefined Tag vs Difference (A - B) vs Custom Text */}
                            <div className="flex items-center bg-white rounded-lg p-0.5 border border-[#CBD5E1] text-xs shadow-sm">
                              <button
                                type="button"
                                onClick={() =>
                                  updateVariableSlot(idx, {
                                    mode: "select",
                                    sourceType:
                                      slot.sourceType === "custom_text" || slot.sourceType === "difference"
                                        ? "current_emi"
                                        : slot.sourceType,
                                  })
                                }
                                className={`max-sm:min-h-11 px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 ${isSelectMode
                                    ? "bg-[#0066FF] text-white font-semibold shadow-sm"
                                    : "text-[#64748B] hover:text-[#0A2540]"
                                  }`}
                              >
                                <Tag className="w-3 h-3" />
                                <span>Predefined Tag</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateVariableSlot(idx, {
                                    mode: "difference",
                                    sourceType: "difference",
                                    diffOperandA: slot.diffOperandA || "current_emi",
                                    diffOperandB: slot.diffOperandB || "new_emi",
                                    diffAbsolute: slot.diffAbsolute ?? false,
                                    diffRound: slot.diffRound ?? true,
                                    formatAsCurrency: slot.formatAsCurrency ?? true,
                                    includeRupeeSymbol: slot.includeRupeeSymbol ?? false,
                                  })
                                }
                                className={`max-sm:min-h-11 px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 ${isDifferenceMode
                                    ? "bg-amber-600 text-white font-semibold shadow-sm"
                                    : "text-[#64748B] hover:text-[#0A2540]"
                                  }`}
                              >
                                <MinusCircle className="w-3 h-3" />
                                <span>Difference (A − B)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateVariableSlot(idx, {
                                    mode: "custom",
                                    sourceType: "custom_text",
                                    customText: slot.customText || slot.staticValue || "",
                                  })
                                }
                                className={`max-sm:min-h-11 px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 ${isCustomMode
                                    ? "bg-blue-600 text-white font-semibold shadow-sm"
                                    : "text-[#64748B] hover:text-[#0A2540]"
                                  }`}
                              >
                                <PenLine className="w-3 h-3" />
                                <span>Write Custom Text</span>
                              </button>
                            </div>
                          </div>

                          {/* Reorder Buttons (Up/Down) & Delete */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => moveSlot(idx, idx - 1)}
                              disabled={idx === 0}
                              className="max-sm:min-h-11 max-sm:min-w-11 p-1.5 rounded-lg text-slate-500 hover:text-[#0A2540] hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-25 disabled:pointer-events-none transition"
                              title="Move variable up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSlot(idx, idx + 1)}
                              disabled={idx === variableSlots.length - 1}
                              className="max-sm:min-h-11 max-sm:min-w-11 p-1.5 rounded-lg text-slate-500 hover:text-[#0A2540] hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-25 disabled:pointer-events-none transition"
                              title="Move variable down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeVariableSlot(idx)}
                              disabled={variableSlots.length <= 1}
                              className="max-sm:min-h-11 max-sm:min-w-11 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-25 disabled:pointer-events-none ml-1"
                              title="Remove variable slot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* MODE 1: DIFFERENCE OF 2 OTHERS (A − B) */}
                        {isDifferenceMode ? (
                          <div className="pt-1 space-y-3">
                            <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3.5 space-y-3">
                              {/* Subtraction Row: Operand A − Operand B */}
                              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
                                {/* Operand A */}
                                <div className="flex-1">
                                  <label className="block text-[11px] font-bold text-amber-950 mb-1">
                                    Value A (Minuend)
                                  </label>
                                  <select
                                    value={slot.diffOperandA || "current_emi"}
                                    onChange={(e) =>
                                      updateVariableSlot(idx, { diffOperandA: e.target.value })
                                    }
                                    className="max-sm:min-h-11 w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 max-sm:text-base text-xs text-[#0A2540] font-medium focus:outline-none focus:border-[#0066FF] shadow-xs"
                                  >
                                    <optgroup label="Calculated EMI & Loan Values">
                                      <option value="current_emi">Current Monthly EMI</option>
                                      <option value="new_emi">New Monthly EMI (@ 9.99%)</option>
                                      <option value="emi_diff">Monthly EMI Savings</option>
                                      <option value="total_savings">Total Savings Over Tenure</option>
                                      <option value="total_amount">Total Loan Amount</option>
                                      <option value="tenure">Tenure (Months)</option>
                                      <option value="current_roi">Current ROI (%)</option>
                                      <option value="new_roi">Target ROI (%)</option>
                                    </optgroup>
                                    {variableSlots.length > 1 && (
                                      <optgroup label="Other Variable Slots">
                                        {variableSlots.map((s, sIdx) => {
                                          if (sIdx === idx) return null;
                                          return (
                                            <option key={`opA-slot-${sIdx}`} value={`slot:${sIdx}`}>
                                              Slot {`{{${sIdx + 1}}}`} ({s.sourceType})
                                            </option>
                                          );
                                        })}
                                      </optgroup>
                                    )}
                                    {availableColumns.length > 0 && (
                                      <optgroup label="Excel Sheet Columns">
                                        {availableColumns.map((col) => (
                                          <option key={`opA-col-${col}`} value={`col:${col}`}>
                                            Excel Col: {col}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </select>
                                </div>

                                {/* Minus Sign */}
                                <div className="flex items-center justify-center self-center px-1 pt-0 md:pt-4">
                                  <div className="w-7 h-7 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                                    −
                                  </div>
                                </div>

                                {/* Operand B */}
                                <div className="flex-1">
                                  <label className="block text-[11px] font-bold text-amber-950 mb-1">
                                    Value B (Subtrahend)
                                  </label>
                                  <select
                                    value={slot.diffOperandB || "new_emi"}
                                    onChange={(e) =>
                                      updateVariableSlot(idx, { diffOperandB: e.target.value })
                                    }
                                    className="max-sm:min-h-11 w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 max-sm:text-base text-xs text-[#0A2540] font-medium focus:outline-none focus:border-[#0066FF] shadow-xs"
                                  >
                                    <optgroup label="Calculated EMI & Loan Values">
                                      <option value="current_emi">Current Monthly EMI</option>
                                      <option value="new_emi">New Monthly EMI (@ 9.99%)</option>
                                      <option value="emi_diff">Monthly EMI Savings</option>
                                      <option value="total_savings">Total Savings Over Tenure</option>
                                      <option value="total_amount">Total Loan Amount</option>
                                      <option value="tenure">Tenure (Months)</option>
                                      <option value="current_roi">Current ROI (%)</option>
                                      <option value="new_roi">Target ROI (%)</option>
                                    </optgroup>
                                    {variableSlots.length > 1 && (
                                      <optgroup label="Other Variable Slots">
                                        {variableSlots.map((s, sIdx) => {
                                          if (sIdx === idx) return null;
                                          return (
                                            <option key={`opB-slot-${sIdx}`} value={`slot:${sIdx}`}>
                                              Slot {`{{${sIdx + 1}}}`} ({s.sourceType})
                                            </option>
                                          );
                                        })}
                                      </optgroup>
                                    )}
                                    {availableColumns.length > 0 && (
                                      <optgroup label="Excel Sheet Columns">
                                        {availableColumns.map((col) => (
                                          <option key={`opB-col-${col}`} value={`col:${col}`}>
                                            Excel Col: {col}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </select>
                                </div>
                              </div>

                              {/* Difference Formatting & Live Preview */}
                              <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950">
                                <div className="flex flex-wrap items-center gap-3">
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={slot.formatAsCurrency ?? true}
                                      onChange={(e) =>
                                        updateVariableSlot(idx, { formatAsCurrency: e.target.checked })
                                      }
                                      className="rounded border-amber-300 text-amber-600 focus:ring-0 w-3.5 h-3.5"
                                    />
                                    <span>Format Indian Numbering (e.g. 1,296)</span>
                                  </label>

                                  {(slot.formatAsCurrency ?? true) && (
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={slot.includeRupeeSymbol ?? false}
                                        onChange={(e) =>
                                          updateVariableSlot(idx, {
                                            includeRupeeSymbol: e.target.checked,
                                          })
                                        }
                                        className="rounded border-amber-300 text-amber-600 focus:ring-0 w-3.5 h-3.5"
                                      />
                                      <span>Include ₹ Symbol</span>
                                    </label>
                                  )}

                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={slot.diffAbsolute ?? false}
                                      onChange={(e) =>
                                        updateVariableSlot(idx, { diffAbsolute: e.target.checked })
                                      }
                                      className="rounded border-amber-300 text-amber-600 focus:ring-0 w-3.5 h-3.5"
                                    />
                                    <span>Absolute Value |A − B|</span>
                                  </label>
                                </div>

                                {/* Live Preview chip */}
                                <div className="flex items-center gap-1.5 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-[11px] font-mono text-amber-900 shadow-xs">
                                  <span className="font-sans font-semibold text-amber-700">
                                    {processedData.length > 0 ? "Row 1 Output:" : "Preview:"}
                                  </span>
                                  <span className="font-bold text-[#0A2540]">
                                    {resolveVariableValue(
                                      slot,
                                      processedData.length > 0
                                        ? processedData[0].row
                                        : {
                                          [amountCol || "amount"]: testDetails.amount,
                                          [tenureCol || "tenure"]: testDetails.tenure,
                                          [roiCol || "roi"]: testDetails.currentRoi,
                                          [nameCol || "name"]: testDetails.name,
                                          amount: testDetails.amount,
                                          tenure: testDetails.tenure,
                                          roi: testDetails.currentRoi,
                                          name: testDetails.name,
                                          company: testDetails.companyName,
                                          ...testExtraFields.reduce((acc, f) => {
                                            if (f.key.trim()) acc[f.key.trim()] = f.value;
                                            return acc;
                                          }, {} as Record<string, any>),
                                        },
                                      {
                                        nameCol: nameCol || "name",
                                        amountCol: amountCol || "amount",
                                        tenureCol: tenureCol || "tenure",
                                        roiCol: roiCol || "roi",
                                      },
                                      processedData.length > 0 ? processedData[0].calc : testCalc,
                                      processedData.length > 0 ? targetRoi : testDetails.targetRoi,
                                      variableSlots,
                                      idx
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : !isCustomMode ? (
                          /* MODE 2: PREDEFINED TAG SELECTOR */
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
                            <div className="min-w-[240px] flex-1">
                              <select
                                value={slot.sourceType}
                                onChange={(e) => {
                                  const val = e.target.value as any;
                                  if (val === "difference") {
                                    updateVariableSlot(idx, {
                                      mode: "difference",
                                      sourceType: "difference",
                                      diffOperandA: slot.diffOperandA || "current_emi",
                                      diffOperandB: slot.diffOperandB || "new_emi",
                                      diffAbsolute: slot.diffAbsolute ?? false,
                                      diffRound: slot.diffRound ?? true,
                                      formatAsCurrency: slot.formatAsCurrency ?? true,
                                    });
                                  } else if (val === "custom_text") {
                                    updateVariableSlot(idx, {
                                      mode: "custom",
                                      sourceType: "custom_text",
                                    });
                                  } else {
                                    updateVariableSlot(idx, {
                                      sourceType: val,
                                      mode: "select",
                                    });
                                  }
                                }}
                                className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-medium transition shadow-sm"
                              >
                                {VARIABLE_SOURCE_OPTIONS.filter((o) => o.value !== "custom_text").map(
                                  (opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label} ({opt.example})
                                    </option>
                                  )
                                )}
                              </select>
                            </div>

                            {/* Additional Options for Predefined Tags */}
                            <div className="flex flex-wrap items-center gap-3">
                              {slot.sourceType === "static_text" && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-[#64748B]">Fixed Text:</span>
                                  <input
                                    type="text"
                                    value={slot.staticValue ?? ""}
                                    onChange={(e) =>
                                      updateVariableSlot(idx, { staticValue: e.target.value })
                                    }
                                    placeholder="e.g. Credit Expert India"
                                    className="max-sm:min-h-11 bg-white border border-[#CBD5E1] rounded-xl px-3 py-1.5 max-sm:text-base text-xs text-[#0A2540] font-mono focus:outline-none focus:border-[#0066FF] w-full sm:w-48 shadow-sm"
                                  />
                                </div>
                              )}

                              {slot.sourceType === "custom_column" && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-[#64748B]">Sheet Column:</span>
                                  <select
                                    value={slot.customColumnName ?? ""}
                                    onChange={(e) =>
                                      updateVariableSlot(idx, { customColumnName: e.target.value })
                                    }
                                    className="max-sm:min-h-11 bg-white border border-[#CBD5E1] rounded-xl px-3 py-1.5 max-sm:text-base text-xs text-[#0A2540] font-mono focus:outline-none focus:border-[#0066FF] shadow-sm"
                                  >
                                    <option value="">-- Select Column --</option>
                                    {availableColumns.map((col) => (
                                      <option key={col} value={col}>
                                        {col}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {(slot.sourceType === "current_emi" ||
                                slot.sourceType === "new_emi" ||
                                slot.sourceType === "emi_diff" ||
                                slot.sourceType === "total_savings" ||
                                slot.sourceType === "total_amount") && (
                                  <div className="flex flex-wrap items-center gap-3">
                                    <label className="flex items-center gap-1.5 text-xs text-[#3C4F69] cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={slot.formatAsCurrency ?? false}
                                        onChange={(e) =>
                                          updateVariableSlot(idx, { formatAsCurrency: e.target.checked })
                                        }
                                        className="rounded border-[#CBD5E1] text-[#0066FF] focus:ring-0 w-3.5 h-3.5"
                                      />
                                      <span>Format Indian Numbering</span>
                                    </label>

                                    {slot.formatAsCurrency && (
                                      <label className="flex items-center gap-1 text-xs text-[#3C4F69] cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={slot.includeRupeeSymbol ?? false}
                                          onChange={(e) =>
                                            updateVariableSlot(idx, {
                                              includeRupeeSymbol: e.target.checked,
                                            })
                                          }
                                          className="rounded border-[#CBD5E1] text-[#0066FF] focus:ring-0 w-3.5 h-3.5"
                                        />
                                        <span>Include ₹ Symbol</span>
                                      </label>
                                    )}
                                  </div>
                                )}
                            </div>
                          </div>
                        ) : (
                          /* MODE 3: CUSTOM TEXT INPUT & TOKEN CHIPS */
                          <div className="space-y-2 pt-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={slot.customText ?? slot.staticValue ?? ""}
                                onChange={(e) =>
                                  updateVariableSlot(idx, {
                                    customText: e.target.value,
                                    staticValue: e.target.value,
                                  })
                                }
                                placeholder="Type custom text or write tokens e.g. Credit Expert India, or Offer: ₹{emi_diff} saved!"
                                className="max-sm:min-h-11 w-full bg-white border border-blue-300 rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-mono transition shadow-sm"
                              />
                            </div>

                            {/* Clickable Quick Tokens to Insert */}
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="text-[#64748B] font-medium">Click to insert tag:</span>
                              {[
                                { label: "+ Name", token: "{name}" },
                                { label: "+ Current EMI", token: "{current_emi}" },
                                { label: "+ New EMI", token: "{new_emi}" },
                                { label: "+ Monthly Savings", token: "{emi_diff}" },
                                { label: "+ Total Savings", token: "{total_savings}" },
                                { label: "+ Difference (A − B)", token: "{diff:current_emi-new_emi}" },
                                { label: "+ Loan Amount", token: "{amount}" },
                                { label: "+ Tenure", token: "{tenure}" },
                                { label: "+ Current ROI", token: "{roi}" },
                                { label: "+ Company", token: "{company}" },
                              ].map((t) => (
                                <button
                                  key={t.token}
                                  type="button"
                                  onClick={() => {
                                    const current = slot.customText || slot.staticValue || "";
                                    const next = current ? `${current} ${t.token}` : t.token;
                                    updateVariableSlot(idx, { customText: next, staticValue: next });
                                  }}
                                  className="max-sm:min-h-11 px-2.5 py-0.5 rounded-lg bg-white border border-[#CBD5E1] text-blue-700 hover:text-blue-900 hover:border-blue-400 hover:bg-blue-50 transition shadow-xs"
                                >
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sample Output Preview for Row 1 */}
              {processedData.length > 0 && (
                <div className="mt-3.5 p-3.5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[11px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                      Live Sample Preview (Row 1)
                    </span>
                    <span className="text-xs text-[#065F46] font-mono font-bold">
                      &quot;{processedData[0].sampleString}&quot;
                    </span>
                  </div>
                  <span className="text-[11px] text-[#047857]">
                    Dispatched exactly in this comma-separated format
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* STEP 4: REAL-TIME CALCULATION & DATA PREVIEW TABLE */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-3.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="w-7 h-7 rounded-lg bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE] flex items-center justify-center text-xs font-bold shrink-0">
                  4
                </span>
                <h3 className="text-base font-bold text-[#0A2540]">
                  Calculation Preview ({filteredData.length.toLocaleString()} matching rows)
                </h3>
                {isColumnFilterActive && (
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-[#0066FF] border border-blue-200 font-semibold flex items-center gap-1.5 shadow-2xs">
                    <Filter className="w-3 h-3 text-[#0066FF]" />
                    <span>
                      Filter: <strong>{columnFilterCol === "__ALL__" ? "All Cols" : columnFilterCol}</strong> {columnFilterCondition === "contains" ? "~" : "="} &quot;<strong>{columnFilterKeyword}</strong>&quot;
                    </span>
                    <button
                      type="button"
                      onClick={handleClearColumnFilter}
                      className="max-sm:min-h-11 hover:text-red-600 ml-1 text-slate-400 hover:text-red-600 transition"
                      title="Clear column filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>

              {/* Filter Pills & Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={previewSearch}
                    onChange={(e) => {
                      setPreviewSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search name or phone..."
                    className="max-sm:min-h-11 pl-8 pr-3 py-1.5 bg-white border border-[#CBD5E1] rounded-xl max-sm:text-base text-xs text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 w-full sm:w-48 shadow-sm font-medium"
                  />
                </div>

                <div className="flex items-center bg-[#F1F5F9] p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode("all");
                      setCurrentPage(1);
                    }}
                    className={`max-sm:min-h-11 px-2.5 py-1 rounded-lg transition ${filterMode === "all"
                        ? "bg-[#0066FF] text-white font-semibold shadow-xs"
                        : "text-[#64748B] hover:text-[#0A2540]"
                      }`}
                  >
                    All ({processedData.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode("valid");
                      setCurrentPage(1);
                    }}
                    className={`max-sm:min-h-11 px-2.5 py-1 rounded-lg transition ${filterMode === "valid"
                        ? "bg-[#0066FF] text-white font-semibold shadow-xs"
                        : "text-[#64748B] hover:text-[#0A2540]"
                      }`}
                  >
                    Valid Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode("invalid");
                      setCurrentPage(1);
                    }}
                    className={`max-sm:min-h-11 px-2.5 py-1 rounded-lg transition ${filterMode === "invalid"
                        ? "bg-red-600 text-white font-semibold shadow-xs"
                        : "text-[#64748B] hover:text-[#0A2540]"
                      }`}
                  >
                    Invalid Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode("savings");
                      setCurrentPage(1);
                    }}
                    className={`max-sm:min-h-11 px-2.5 py-1 rounded-lg transition ${filterMode === "savings"
                        ? "bg-[#0066FF] text-white font-semibold shadow-xs"
                        : "text-[#64748B] hover:text-[#0A2540]"
                      }`}
                  >
                    Eligible for Savings
                  </button>
                </div>

                {/* Quick Phone Rule Switcher directly in Table Toolbar */}
                {phoneCol && (
                  <div className="flex items-center gap-1.5 bg-[#F1F5F9] border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                    <Phone className="w-3.5 h-3.5 text-[#0066FF]" />
                    <span className="font-semibold text-[#0A2540] hidden sm:inline">Phone Rule:</span>
                    <select
                      value={phoneFormatMode}
                      onChange={(e) => setPhoneFormatMode(e.target.value as PhoneFormatOption)}
                      className="max-sm:min-h-11 bg-transparent max-sm:text-base text-xs text-[#0066FF] font-semibold focus:outline-none cursor-pointer"
                      title="Switch phone formatting rule applied to column"
                    >
                      {PHONE_FORMAT_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.shortLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] shadow-xs">
              <table className="w-full min-w-[720px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[#3C4F69] border-b border-[#E2E8F0] font-bold">
                    <th className="py-3 px-3.5">#</th>
                    <th className="py-3 px-3.5">Customer Name</th>
                    <th className="py-3 px-3.5">Mobile (WhatsApp)</th>
                    <th className="py-3 px-3.5 text-right">Loan Amount</th>
                    <th className="py-3 px-3.5 text-center">Tenure</th>
                    <th className="py-3 px-3.5 text-center">Cur ROI</th>
                    <th className="py-3 px-3.5 text-right text-slate-800">Current EMI</th>
                    <th className="py-3 px-3.5 text-right text-[#0066FF]">New EMI (@9.99%)</th>
                    <th className="py-3 px-3.5 text-right text-emerald-600">Monthly Savings</th>
                    <th className="py-3 px-3.5">Generated Sample String</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {paginatedData.map((item) => (
                    <tr
                      key={item.rowIndex}
                      className="hover:bg-[#F8FAFC]/80 transition group"
                    >
                      <td className="py-2.5 px-3.5 font-mono text-xs text-slate-500">
                        {item.rowIndex}
                      </td>
                      <td className="py-2.5 px-3.5 font-semibold text-[#0A2540] truncate max-w-[150px]">
                        {item.name || <span className="text-slate-400 italic">No name</span>}
                      </td>
                      <td className="py-2.5 px-3.5">
                        {item.phoneInfo.isValid ? (
                          <div>
                            <span className="text-emerald-700 font-mono font-medium flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              +{item.phoneInfo.formatted}
                            </span>
                            {item.phoneInfo.detectedFormat && (
                              <span className="text-[11px] text-slate-400 font-sans block pl-4">
                                {item.phoneInfo.detectedFormat}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span
                            className="text-red-600 font-mono text-xs flex items-center gap-1"
                            title={item.phoneInfo.error}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            {item.phoneInfo.raw || "Empty"}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-slate-800">
                        {formatInrCurrency(item.principal, { showSymbol: true })}
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-mono text-slate-700">
                        {item.tenure}m
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-mono text-amber-700 font-bold bg-amber-50/50 rounded">
                        {item.currentRoi}%
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-slate-900 font-bold">
                        {formatInrCurrency(item.calc.currentEmi, { showSymbol: true })}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-[#0066FF] font-bold">
                        {formatInrCurrency(item.calc.newEmi, { showSymbol: true })}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-emerald-600 font-bold">
                        {formatInrCurrency(item.calc.monthlySavings, { showSymbol: true })}
                      </td>
                      <td className="py-2.5 px-3.5 text-[11px] font-mono text-slate-500 truncate max-w-[220px]">
                        &quot;{item.sampleString}&quot;
                      </td>
                    </tr>
                  ))}
                  {paginatedData.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-xs text-slate-500">
                        No rows found matching the current filter or search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1">
                <div>
                  Showing Page <strong className="text-[#0A2540]">{currentPage}</strong> of{" "}
                  <strong className="text-[#0A2540]">{totalPages}</strong> (
                  {filteredData.length.toLocaleString()} total rows)
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="max-sm:min-h-11 max-sm:min-w-11 p-1.5 rounded-lg bg-white border border-[#CBD5E1] hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none text-[#0A2540] transition shadow-xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="max-sm:min-h-11 max-sm:min-w-11 p-1.5 rounded-lg bg-white border border-[#CBD5E1] hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none text-[#0A2540] transition shadow-xs"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* DEDICATED SECTION 4.5: SINGLE TEST SANDBOX (CUSTOM DETAILS WITH PRE-FILLED DEFAULTS) */}
          <div className="bg-gradient-to-br from-white via-white to-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-4 sm:p-6 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.12)] space-y-4 relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0] flex items-center justify-center text-xs font-bold shadow-xs">
                  <FlaskConical className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-[#0A2540] flex items-center gap-2">
                    Single Test Message Sandbox
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#EAF3FF] text-[#0066FF] font-bold border border-[#BFDBFE]">
                      Custom Details with Pre-filled Defaults
                    </span>
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Test your configured WhatsApp variables with any custom numbers before running bulk campaigns
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {processedData.length > 0 && (
                  <button
                    type="button"
                    onClick={handleLoadRowOneIntoTest}
                    className="max-sm:min-h-11 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-[#0A2540] border border-[#CBD5E1] transition flex items-center gap-1.5 shadow-xs"
                    title="Load Row 1 from uploaded Excel"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#0066FF]" />
                    <span>Load Row 1</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetTestDefaults}
                  className="max-sm:min-h-11 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-[#64748B] border border-[#CBD5E1] transition flex items-center gap-1 shadow-xs"
                  title="Reset to default test values"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Defaults</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsTestBoxOpen(!isTestBoxOpen)}
                  className="max-sm:min-h-11 max-sm:min-w-11 p-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-500 border border-[#CBD5E1] transition shadow-xs"
                  title="Toggle Sandbox"
                >
                  {isTestBoxOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isTestBoxOpen && (
              <div className="space-y-4 pt-1">
                {/* Editable Test Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                  {/* Test Recipient Phone */}
                  <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
                    <label className="block text-xs font-bold text-[#0A2540] mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#0066FF]" />
                      Recipient Phone (WhatsApp) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={testDetails.phone}
                      onChange={(e) => setTestDetails({ ...testDetails, phone: e.target.value })}
                      placeholder="e.g. 919827322519 or 10-digits"
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] font-mono placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition shadow-sm font-medium"
                    />
                    <p className="text-[11px] text-[#64748B] mt-0.5">Auto adds 91 prefix for 10-digits</p>
                  </div>

                  {/* Test Customer Name */}
                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1.5 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#0066FF]" />
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={testDetails.name}
                      onChange={(e) => setTestDetails({ ...testDetails, name: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition shadow-sm font-medium"
                    />
                    <p className="text-[11px] text-[#64748B] mt-0.5">Default: Rahul Sharma</p>
                  </div>

                  {/* Test Loan Amount */}
                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1.5 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-[#0066FF]" />
                      Loan Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="1000"
                      value={testDetails.amount}
                      onChange={(e) =>
                        setTestDetails({
                          ...testDetails,
                          amount: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] font-mono focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition shadow-sm font-medium"
                    />
                    <p className="text-[11px] text-[#64748B] mt-0.5">Default: ₹2,00,000</p>
                  </div>

                  {/* Test Tenure */}
                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#0066FF]" />
                      Tenure (Months)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={360}
                      value={testDetails.tenure}
                      onChange={(e) =>
                        setTestDetails({
                          ...testDetails,
                          tenure: Math.max(1, parseInt(e.target.value, 10) || 1),
                        })
                      }
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] font-mono focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition shadow-sm font-medium"
                    />
                    <p className="text-[11px] text-[#64748B] mt-0.5">Default: 24 Months</p>
                  </div>

                  {/* Test Current ROI */}
                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1.5 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
                      Current ROI (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={1}
                      max={50}
                      value={testDetails.currentRoi}
                      onChange={(e) =>
                        setTestDetails({
                          ...testDetails,
                          currentRoi: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] font-mono focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition shadow-sm font-medium"
                    />
                    <p className="text-[11px] text-[#64748B] mt-0.5">Default: 23.5%</p>
                  </div>

                  {/* Test Target ROI */}
                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1.5 flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-emerald-600" />
                      Target ROI (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={1}
                      max={50}
                      value={testDetails.targetRoi}
                      onChange={(e) =>
                        setTestDetails({
                          ...testDetails,
                          targetRoi: parseFloat(e.target.value) || 9.99,
                        })
                      }
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] font-mono focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition shadow-sm font-medium"
                    />
                    <p className="text-[11px] text-[#64748B] mt-0.5">Default: 9.99%</p>
                  </div>
                </div>

                {/* ADDITIONAL CUSTOM FIELDS CARD */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[#0A2540] flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#0066FF]" />
                        Additional Test Fields & Excel Columns
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE]">
                        {testExtraFields.length} {testExtraFields.length === 1 ? "field" : "fields"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => addTestExtraField()}
                      className="max-sm:min-h-11 px-3 py-1.5 rounded-xl bg-[#0066FF] hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Field</span>
                    </button>
                  </div>

                  {/* Quick Add from Uploaded Sheet Columns */}
                  {availableColumns.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs pt-0.5">
                      <span className="text-[11px] text-[#64748B] font-medium">Quick add from Excel:</span>
                      {availableColumns
                        .filter((col) => !testExtraFields.some((f) => f.key.toLowerCase() === col.toLowerCase()))
                        .slice(0, 10)
                        .map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => {
                              const rowVal = processedData.length > 0 ? String(processedData[0].row[col] ?? "") : "";
                              addTestExtraField(col, rowVal);
                            }}
                            className="px-2 py-0.5 rounded-lg bg-[#F1F5F9] border border-slate-200 text-[#0A2540] hover:bg-[#EAF3FF] hover:border-[#BFDBFE] hover:text-[#0066FF] text-[11px] font-mono transition flex items-center gap-1 shadow-2xs"
                          >
                            <Plus className="w-2.5 h-2.5 text-[#0066FF]" />
                            <span>{col}</span>
                          </button>
                        ))}
                    </div>
                  )}

                  {/* List of Extra Fields */}
                  {testExtraFields.length === 0 ? (
                    <div className="py-4 px-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-[#64748B]">
                      No additional fields added. Click{" "}
                      <button
                        type="button"
                        onClick={() => addTestExtraField()}
                        className="max-sm:min-h-11 font-semibold text-[#0066FF] hover:underline"
                      >
                        + Add Field
                      </button>{" "}
                      to simulate any Excel column (e.g. City, Sanction Amount, Bank Name) or custom tokens for testing.
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <datalist id="excel-col-suggestions">
                        {availableColumns.map((col) => (
                          <option key={col} value={col} />
                        ))}
                      </datalist>

                      {testExtraFields.map((field) => (
                        <div
                          key={field.id}
                          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-slate-300 transition"
                        >
                          {/* Field Key */}
                          <div className="sm:w-56 shrink-0">
                            <label className="block text-[11px] font-semibold text-[#64748B] mb-0.5 sm:hidden">
                              Field / Column Name
                            </label>
                            <input
                              type="text"
                              list="excel-col-suggestions"
                              value={field.key}
                              onChange={(e) => updateTestExtraField(field.id, { key: e.target.value })}
                              placeholder="e.g. City or SANCTIONAMOUNT"
                              className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 max-sm:text-base text-xs text-[#0A2540] font-mono focus:outline-none focus:border-[#0066FF] shadow-xs"
                            />
                          </div>

                          <span className="hidden sm:inline text-slate-400 font-bold">:</span>

                          {/* Field Value */}
                          <div className="flex-1">
                            <label className="block text-[11px] font-semibold text-[#64748B] mb-0.5 sm:hidden">
                              Value
                            </label>
                            <input
                              type="text"
                              value={field.value}
                              onChange={(e) => updateTestExtraField(field.id, { value: e.target.value })}
                              placeholder="Value for test message"
                              className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 max-sm:text-base text-xs text-[#0A2540] font-mono focus:outline-none focus:border-[#0066FF] shadow-xs"
                            />
                          </div>

                          {/* Token Hint Badge */}
                          {field.key.trim() && (
                            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500 font-mono px-2 py-1 rounded-md bg-white border border-slate-200 shrink-0">
                              <span className="text-[#64748B]">Token:</span>
                              <span className="text-blue-600 font-bold">&#123;{field.key.trim()}&#125;</span>
                            </div>
                          )}

                          {/* Remove Button */}
                          <button
                            type="button"
                            onClick={() => removeTestExtraField(field.id)}
                            className="max-sm:min-h-11 max-sm:min-w-11 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition shrink-0 self-end sm:self-center"
                            title="Remove field"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* TEST HEADER MEDIA ATTACHMENT CARD */}
                <div
                  className={`p-3.5 rounded-xl border transition-all ${isMediaTemplate && !headerFile
                      ? "bg-amber-50/70 border-amber-300 shadow-sm"
                      : headerFile
                        ? "bg-white border-[#BBF7D0] shadow-xs"
                        : "bg-white border-[#E2E8F0] shadow-xs"
                    }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <ImageIcon
                        className={`w-4 h-4 ${isMediaTemplate
                            ? headerFile
                              ? "text-emerald-600"
                              : "text-amber-600"
                            : "text-slate-500"
                          }`}
                      />
                      <span className="text-xs font-bold text-[#0A2540]">
                        Header Media File for Test
                      </span>
                      {isMediaTemplate ? (
                        headerFile ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F0FDF4] text-emerald-700 font-bold border border-[#BBF7D0] flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" /> Image Attached &amp; Ready
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-300">
                            Required for Template #{selectedTemplateId} ({currentTemplate?.TemplateName || "Selected"})
                          </span>
                        )
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                          Optional (Text Template)
                        </span>
                      )}
                    </div>

                    {/* Quick Load Sample Banner */}
                    {!headerFile && (
                      <button
                        type="button"
                        onClick={handleLoadSampleHeaderImage}
                        className="max-sm:min-h-11 px-2.5 py-1 rounded-lg bg-[#EAF3FF] hover:bg-blue-100 text-[#0066FF] border border-[#BFDBFE] text-[11px] font-semibold transition flex items-center gap-1.5 shadow-2xs"
                        title="Load official Credit Expert India banner image from app"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#0066FF]" />
                        <span>Use Sample Banner</span>
                      </button>
                    )}
                  </div>

                  {headerFile ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200">
                      <div className="flex flex-wrap items-center gap-3">
                        {headerFilePreview ? (
                          <img
                            src={headerFilePreview}
                            alt="Header preview"
                            className="w-12 h-12 object-cover rounded-lg border border-slate-200 shadow-2xs"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-bold text-[#0A2540] truncate max-w-[280px]">
                            {headerFile.name}
                          </div>
                          <div className="text-[11px] text-[#64748B] flex items-center gap-2">
                            <span>{(headerFile.size / 1024).toFixed(1)} KB</span>
                            <span>&bull;</span>
                            <span className="text-emerald-700 font-semibold">Attached to Test &amp; Batch Campaign</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <label className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold cursor-pointer transition shadow-2xs">
                          <span>Change</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleHeaderFileChange}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleClearHeaderFile}
                          className="max-sm:min-h-11 max-sm:min-w-11 p-1.5 rounded-lg bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 transition shadow-2xs"
                          title="Remove image"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <label className="flex-1 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-[#CBD5E1] hover:border-[#0066FF] rounded-xl cursor-pointer bg-white hover:bg-slate-50 transition group shadow-2xs">
                        <UploadCloud className="w-4 h-4 text-slate-400 group-hover:text-[#0066FF] transition" />
                        <span className="text-xs font-semibold text-[#0A2540] group-hover:text-[#0066FF] transition">
                          Click or Drag to Upload Test Header Image
                        </span>
                        <span className="text-[11px] text-[#64748B]">
                          (PNG, JPG, WEBP up to 5MB)
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleHeaderFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Live Calculated Output & Sample Preview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-1">
                  {/* Financial Metrics Card */}
                  <div className="md:col-span-6 bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
                    <div>
                      <div className="text-[11px] text-[#64748B] font-medium">Current Monthly EMI</div>
                      <div className="text-sm font-bold font-mono text-[#0A2540]">
                        {formatInrCurrency(testCalc.currentEmi, { showSymbol: true })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#64748B] font-medium">New EMI (@ {testDetails.targetRoi}%)</div>
                      <div className="text-sm font-bold font-mono text-[#0066FF]">
                        {formatInrCurrency(testCalc.newEmi, { showSymbol: true })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#64748B] font-medium">Monthly Savings</div>
                      <div className="text-sm font-bold font-mono text-emerald-600">
                        {formatInrCurrency(testCalc.monthlySavings, { showSymbol: true })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#64748B] font-medium">Total Savings ({testDetails.tenure}m)</div>
                      <div className="text-sm font-bold font-mono text-blue-700">
                        {formatInrCurrency(testCalc.totalSavings, { showSymbol: true })}
                      </div>
                    </div>
                  </div>

                  {/* Dispatch Action & Resolved Sample Output */}
                  <div className="md:col-span-6 flex flex-col justify-between gap-2 bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE]">
                        Test Sample Output
                      </span>
                      <button
                        type="button"
                        onClick={handleSendCustomTest}
                        disabled={sendingCustomTest}
                        className="max-sm:min-h-11 px-4 py-1.5 rounded-xl bg-[#15803D] hover:bg-[#15803D] disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition shrink-0"
                      >
                        {sendingCustomTest ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>{sendingCustomTest ? "Dispatching..." : "Send Test WhatsApp"}</span>
                      </button>
                    </div>

                    <div className="text-xs font-mono text-emerald-800 font-medium truncate bg-[#F0FDF4] px-3 py-1.5 rounded-lg border border-[#BBF7D0]">
                      &quot;{testSampleString}&quot;
                    </div>
                  </div>
                </div>

                {/* Test Result Feedback Banner */}
                {customTestResponse && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 shadow-xs ${customTestResponse.success
                        ? "bg-[#F0FDF4] border-[#86EFAC] text-emerald-800"
                        : "bg-red-50 border-red-200 text-red-700"
                      }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {customTestResponse.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      <span>
                        {customTestResponse.success
                          ? `✅ Test WhatsApp message dispatched! Campaign ID: #${customTestResponse.campaignId}`
                          : `❌ Gateway Error: ${customTestResponse.error || "Failed to dispatch test"}`}
                      </span>
                    </div>

                    {customTestResponse.success && customTestResponse.campaignId && onTrackDlr && (
                      <button
                        type="button"
                        onClick={() => onTrackDlr(String(customTestResponse.campaignId))}
                        className="max-sm:min-h-11 px-3 py-1 rounded-lg bg-[#0066FF] hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center gap-1 shrink-0 shadow-xs"
                      >
                        <span>Track DLR</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 5: BATCH DISPATCH CONTROLLER & EXECUTION ENGINE */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE] flex items-center justify-center text-xs font-bold">
                  5
                </span>
                <h3 className="text-base font-bold text-[#0A2540]">Launch Bulk Batch Campaign</h3>
              </div>
              <span className="text-xs text-[#64748B]">
                Safe queued dispatch with custom count &amp; rate-limiting
              </span>
            </div>

            {/* Active Column Keyword Filter Banner */}
            {isColumnFilterActive && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0066FF] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Filter className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0A2540] flex items-center gap-2">
                      <span>Column Keyword Filter Active</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
                        {processedData.length.toLocaleString()} matching recipients
                      </span>
                    </p>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      Dispatch will only send to records where <strong className="text-[#0A2540]">{columnFilterCol === "__ALL__" ? "any column" : columnFilterCol}</strong> {columnFilterCondition === "contains" ? "contains" : columnFilterCondition === "exact" ? "equals" : columnFilterCondition === "starts_with" ? "starts with" : "does not contain"} &quot;<strong className="text-[#0066FF]">{columnFilterKeyword}</strong>&quot;.
                      ({rawActiveRows.length - processedData.length} records excluded from this dispatch).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearColumnFilter}
                  className="max-sm:min-h-11 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white border border-[#CBD5E1] hover:border-[#0066FF] text-[#0A2540] shrink-0 transition shadow-xs self-start sm:self-auto"
                >
                  Clear Filter (Send to All {rawActiveRows.length.toLocaleString()})
                </button>
              </div>
            )}

            {/* Dispatch Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-5">
              {/* Range & Custom People Count Selector */}
              <div className="lg:col-span-8 space-y-3">
                <label className="block text-xs font-bold text-[#0A2540]">
                  Select Recipients Scope / How Many People:
                </label>

                {/* Scope Selection Tabs */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDispatchRange("count")}
                    className={`max-sm:min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border ${dispatchRange === "count"
                        ? "bg-[#0066FF] text-white border-[#0066FF] shadow-md shadow-blue-500/20"
                        : "bg-white text-[#3C4F69] border-[#E2E8F0] hover:bg-slate-50"
                      }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Send to Custom Count</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispatchRange("range")}
                    className={`max-sm:min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold transition border ${dispatchRange === "range"
                        ? "bg-[#0066FF] text-white border-[#0066FF] shadow-md shadow-blue-500/20"
                        : "bg-white text-[#3C4F69] border-[#E2E8F0] hover:bg-slate-50"
                      }`}
                  >
                    Specific Row Range
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispatchRange("all")}
                    className={`max-sm:min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold transition border ${dispatchRange === "all"
                        ? "bg-[#0066FF] text-white border-[#0066FF] shadow-md shadow-blue-500/20"
                        : "bg-white text-[#3C4F69] border-[#E2E8F0] hover:bg-slate-50"
                      }`}
                  >
                    {isColumnFilterActive
                      ? `All Filtered (${processedData.length.toLocaleString()} People)`
                      : `Entire Sheet (${processedData.length.toLocaleString()} People)`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispatchRange("test")}
                    className={`max-sm:min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold transition border ${dispatchRange === "test"
                        ? "bg-[#0066FF] text-white border-[#0066FF] shadow-md shadow-blue-500/20"
                        : "bg-white text-[#3C4F69] border-[#E2E8F0] hover:bg-slate-50"
                      }`}
                  >
                    First 10 Rows
                  </button>
                </div>

                {/* Scope 1: CUSTOM PEOPLE COUNT CONTROLS */}
                {dispatchRange === "count" && (
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-3 shadow-inner">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-[#0A2540] font-bold">Send to first:</span>
                        <input
                          type="number"
                          min={1}
                          max={processedData.length}
                          value={customPeopleCount}
                          onChange={(e) =>
                            setCustomPeopleCount(
                              Math.max(1, parseInt(e.target.value, 10) || 1)
                            )
                          }
                          className="max-sm:min-h-11 w-24 bg-white border border-[#0066FF] rounded-lg px-2.5 py-1 max-sm:text-base text-sm font-bold text-[#0066FF] font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs"
                        />
                        <span className="text-xs text-[#0A2540] font-bold">people</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                        <span>Starting from row:</span>
                        <input
                          type="number"
                          min={1}
                          max={processedData.length}
                          value={customRangeStart}
                          onChange={(e) =>
                            setCustomRangeStart(
                              Math.max(1, parseInt(e.target.value, 10) || 1)
                            )
                          }
                          className="max-sm:min-h-11 w-16 bg-white border border-[#CBD5E1] rounded-lg px-2 py-1 max-sm:text-base text-xs text-[#0A2540] font-mono text-center focus:outline-none focus:border-[#0066FF] shadow-xs"
                        />
                      </div>
                    </div>

                    {/* Quick Count Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-[#64748B] font-medium">Quick Counts:</span>
                      {[10, 25, 50, 100, 250, 500, 1000].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setCustomPeopleCount(count)}
                          className={`max-sm:min-h-11 px-2.5 py-0.5 rounded-lg text-xs font-mono transition border ${customPeopleCount === count
                              ? "bg-[#0066FF] text-white border-[#0066FF] font-bold shadow-xs"
                              : "bg-white text-[#3C4F69] border-[#CBD5E1] hover:border-[#0066FF]"
                            }`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>

                    <div className="text-xs text-[#15803D] font-bold flex items-center gap-1.5 bg-[#F0FDF4] p-2 rounded-lg border border-[#BBF7D0]">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>
                        Targeting <strong>{Math.min(customPeopleCount, processedData.length)}</strong> people (Rows {customRangeStart} to {Math.min(processedData.length, customRangeStart + customPeopleCount - 1)} of {processedData.length.toLocaleString()} total).
                      </span>
                    </div>
                  </div>
                )}

                {/* Scope 2: CUSTOM RANGE (FROM X TO Y) */}
                {dispatchRange === "range" && (
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] flex items-center gap-3 shadow-inner">
                    <span className="text-xs text-[#64748B]">From Row:</span>
                    <input
                      type="number"
                      min={1}
                      max={processedData.length}
                      value={customRangeStart}
                      onChange={(e) => setCustomRangeStart(parseInt(e.target.value, 10) || 1)}
                      className="max-sm:min-h-11 w-20 bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1 max-sm:text-base text-xs text-[#0A2540] font-mono focus:outline-none focus:border-[#0066FF] text-center shadow-xs"
                    />
                    <span className="text-xs text-[#64748B]">To Row:</span>
                    <input
                      type="number"
                      min={1}
                      max={processedData.length}
                      value={customRangeEnd}
                      onChange={(e) => setCustomRangeEnd(parseInt(e.target.value, 10) || 50)}
                      className="max-sm:min-h-11 w-20 bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1 max-sm:text-base text-xs text-[#0A2540] font-mono focus:outline-none focus:border-[#0066FF] text-center shadow-xs"
                    />
                    <span className="text-xs text-[#0066FF] font-bold">
                      ({Math.max(0, customRangeEnd - customRangeStart + 1)} recipients)
                    </span>
                  </div>
                )}
              </div>

              {/* Throttle Settings Side Column */}
              <div className="lg:col-span-4 space-y-3">
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2 h-full flex flex-col justify-between shadow-xs">
                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1.5">
                      Throttle Delay Between Calls:
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={100}
                        max={5000}
                        step={100}
                        value={throttleDelayMs}
                        onChange={(e) => setThrottleDelayMs(parseInt(e.target.value, 10) || 400)}
                        className="max-sm:min-h-11 w-24 bg-white border border-[#CBD5E1] rounded-xl px-3 py-1.5 max-sm:text-base text-xs text-[#0A2540] font-mono focus:outline-none focus:border-[#0066FF] text-center font-bold shadow-xs"
                      />
                      <span className="text-xs text-[#64748B]">ms (400ms recommended)</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#64748B]">
                    Paces requests to prevent WhatsApp rate limits &amp; carrier blocking
                  </p>
                </div>
              </div>
            </div>

            {/* Launch / Pause / Resume / Cancel Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-3.5 border-t border-[#E2E8F0]">
              <div className="flex flex-wrap items-center gap-3">
                {dispatchStatus === "idle" ||
                  dispatchStatus === "completed" ||
                  dispatchStatus === "aborted" ? (
                  <button
                    type="button"
                    onClick={() => handleStartBatchDispatch()}
                    className="max-sm:min-h-11 px-6 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#15803D] text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>
                      Launch Batch Campaign (
                      {dispatchRange === "count"
                        ? `${Math.min(customPeopleCount, processedData.length)} People`
                        : dispatchRange === "range"
                          ? `${Math.max(0, customRangeEnd - customRangeStart + 1)} People`
                          : dispatchRange === "test"
                            ? "10 Test People"
                            : `${processedData.length.toLocaleString()} People`}
                      )
                    </span>
                  </button>
                ) : dispatchStatus === "running" ? (
                  <button
                    type="button"
                    onClick={handlePause}
                    className="max-sm:min-h-11 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 transition"
                  >
                    <Pause className="w-4 h-4 fill-white" />
                    <span>Pause Campaign</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleResume}
                    className="max-sm:min-h-11 px-6 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#15803D] text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 transition"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Resume Campaign</span>
                  </button>
                )}

                {/* Quick Retry for Failed Recipients */}
                {failedRowsList.length > 0 &&
                  (dispatchStatus === "idle" ||
                    dispatchStatus === "completed" ||
                    dispatchStatus === "aborted") && (
                    <button
                      type="button"
                      onClick={() => handleStartBatchDispatch(failedRowsList)}
                      className="max-sm:min-h-11 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-600/25 transition"
                      title="Re-dispatch only the rows that previously encountered network timeouts or errors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Retry Failed ({failedRowsList.length})</span>
                    </button>
                  )}

                {(dispatchStatus === "running" || dispatchStatus === "paused") && (
                  <button
                    type="button"
                    onClick={handleAbort}
                    className="max-sm:min-h-11 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-2 transition shadow-sm"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    <span>Stop / Abort</span>
                  </button>
                )}
              </div>

              {/* Progress Summary Pills */}
              <div className="flex items-center gap-2 text-xs">
                <span className="px-3 py-1 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0A2540] font-mono shadow-xs">
                  Progress: <strong>{progressIndex}</strong> / {totalToProcess}
                </span>
                <span className="px-3 py-1 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] font-mono shadow-xs">
                  Success: <strong>{stats.success}</strong>
                </span>
                <span className="px-3 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 font-mono shadow-xs">
                  Failed: <strong>{stats.failed}</strong>
                </span>
                {stats.skipped > 0 && (
                  <span className="px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-mono shadow-xs">
                    Skipped: <strong>{stats.skipped}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Visual Progress Bar */}
            {totalToProcess > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="w-full bg-[#E2E8F0] h-2.5 rounded-full overflow-hidden shadow-inner">
                  <div
                    className={`h-full transition-all duration-300 ${dispatchStatus === "completed"
                        ? "bg-[#15803D]"
                        : dispatchStatus === "paused"
                          ? "bg-amber-500"
                          : dispatchStatus === "aborted"
                            ? "bg-red-600"
                            : "bg-[#15803D]"
                      }`}
                    style={{
                      width: `${Math.min(100, (progressIndex / totalToProcess) * 100)}%`,
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
                  <span>
                    Status:{" "}
                    <strong
                      className={`uppercase ${dispatchStatus === "running"
                          ? "text-[#15803D]"
                          : dispatchStatus === "paused"
                            ? "text-amber-600"
                            : dispatchStatus === "completed"
                              ? "text-[#15803D] font-bold"
                              : "text-slate-600"
                        }`}
                    >
                      {dispatchStatus}
                    </strong>
                  </span>
                  <span className="font-bold text-[#0A2540]">
                    {((progressIndex / totalToProcess) * 100 || 0).toFixed(1)}% Completed
                  </span>
                </div>
              </div>
            )}

            {/* Execution Activity Log */}
            {dispatchLogs.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#0A2540]">
                  <span>Real-Time Execution Log (Recent 50 items)</span>
                  <span className="text-[11px] text-[#64748B] font-normal">
                    Automatically logged to Sent Messages history
                  </span>
                </div>

                <div className="rounded-xl border border-[#CBD5E1] bg-white max-h-60 overflow-y-auto divide-y divide-slate-100 font-mono text-xs shadow-inner">
                  {dispatchLogs.map((log) => (
                    <div
                      key={log.id}
                      className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 hover:bg-[#F8FAFC] transition"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-[11px] text-[#94A3B8]">{log.timestamp}</span>
                        <span className="text-xs text-[#64748B]">Row #{log.rowIndex}</span>
                        <span className="font-semibold text-[#0A2540] truncate max-w-[140px]">
                          {log.name}
                        </span>
                        <span className="text-[#64748B] text-xs">+{log.phone}</span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {log.status === "SUCCESS" ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0] font-bold">
                              CAMPAIGN #{log.campaignId}
                            </span>
                            {onTrackDlr && log.campaignId && (
                              <button
                                type="button"
                                onClick={() => onTrackDlr(String(log.campaignId))}
                                className="max-sm:min-h-11 text-xs text-[#0066FF] hover:underline flex items-center gap-0.5 font-semibold"
                              >
                                DLR <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        ) : log.status === "SKIPPED" ? (
                          <span
                            className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold"
                            title={log.error}
                          >
                            SKIPPED
                          </span>
                        ) : (
                          <span
                            className="text-[11px] px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-bold truncate max-w-[180px]"
                            title={log.error}
                          >
                            FAILED: {log.error}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
