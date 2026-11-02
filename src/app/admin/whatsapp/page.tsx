"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  MessageSquare,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Key,
  Settings,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Eye,
  Copy,
  Plus,
  Phone,
  Calendar,
  Zap,
  Globe,
  FileText,
  Check,
  ArrowRight,
  HelpCircle,
  Hash,
  Loader2,
  DollarSign,
  Radio,
  BarChart3,
  Layers,
  Image as ImageIcon,
  UploadCloud,
  X,
  History,
  Search,
  Filter,
  CheckCheck,
  FileSpreadsheet,
} from "lucide-react";
import ExcelEmiCampaign from "./ExcelEmiCampaign";

interface GatewayStatus {
  hasToken: boolean;
  maskedToken: string | null;
  tokenSource: string;
  otpTemplateId: string;
  businessNumber: string | null;
  callbackUrl: string | null;
}

export default function WhatsAppHubPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login");
    else if (user.role !== "admin") router.replace("/branch");
  }, [user, authLoading, router]);

  const [activeTab, setActiveTab] = useState<
    "otp" | "send" | "excel" | "messages" | "dlr" | "campaigns" | "templates" | "setup"
  >("excel");

  // Gateway status state
  const [statusLoading, setStatusLoading] = useState(true);
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [apiTokenOverride, setApiTokenOverride] = useState("");
  const [showOverrideInput, setShowOverrideInput] = useState(false);

  // Connection test
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);

  // Timezones state
  const [timezones, setTimezones] = useState<{ TimeZoneId: number; TimeZoneName: string }[]>([]);
  const [loadingTimezones, setLoadingTimezones] = useState(false);

  // 1. Send OTP State
  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("1234");
  const [otpTemplateId, setOtpTemplateId] = useState("");
  const [otpCallbackUrl, setOtpCallbackUrl] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpResponse, setOtpResponse] = useState<any>(null);

  // 2. Send Message State
  const [msgPhone, setMsgPhone] = useState("");
  const [msgTemplateId, setMsgTemplateId] = useState("");
  const [msgCampaignName, setMsgCampaignName] = useState("");
  const [msgSample, setMsgSample] = useState("");
  const [msgButtonExample, setMsgButtonExample] = useState("");
  const [msgCallbackUrl, setMsgCallbackUrl] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [selectedTimeZoneId, setSelectedTimeZoneId] = useState<number>(2);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgResponse, setMsgResponse] = useState<any>(null);
  const [msgFile, setMsgFile] = useState<File | null>(null);
  const [msgFilePreview, setMsgFilePreview] = useState<string | null>(null);

  // 3. DLR State
  const [dlrCampaignId, setDlrCampaignId] = useState("");
  const [loadingDlr, setLoadingDlr] = useState(false);
  const [dlrData, setDlrData] = useState<any>(null);
  const [dlrError, setDlrError] = useState<string | null>(null);

  // 4. Campaign Details State
  const [campaignQueryIds, setCampaignQueryIds] = useState("");
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignsList, setCampaignsList] = useState<any[]>([]);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);

  // 5. Templates State
  const [templatesList, setTemplatesList] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState("all");

  // 6. Sent Messages Log & Costing State
  const [messagesList, setMessagesList] = useState<any[]>([]);
  const [messageStats, setMessageStats] = useState<{
    totalMessages: number;
    totalDelivered: number;
    totalSubmitted: number;
    totalRejectedOrFailed: number;
    totalCost: number;
    currency: string;
    deliveryRatePercent: number;
  } | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState("");
  const [msgStatusFilter, setMsgStatusFilter] = useState("all");
  const [msgTypeFilter, setMsgTypeFilter] = useState("ALL");
  const [syncingDlrId, setSyncingDlrId] = useState<string | null>(null);
  const [syncingAllDlrs, setSyncingAllDlrs] = useState(false);
  const [selectedMessageDetail, setSelectedMessageDetail] = useState<any | null>(null);

  const currentMsgTemplate = templatesList.find(
    (t) => String(t.WhatsAppTemplateId) === String(msgTemplateId).trim()
  );
  const isMsgMediaTemplate =
    currentMsgTemplate?.TemplateTypeDescription?.toLowerCase() === "image" ||
    currentMsgTemplate?.TemplateTypeDescription?.toLowerCase() === "video" ||
    currentMsgTemplate?.TemplateTypeDescription?.toLowerCase() === "document" ||
    Number(currentMsgTemplate?.TemplateType) === 2 ||
    Number(currentMsgTemplate?.TemplateType) === 3 ||
    Number(currentMsgTemplate?.TemplateType) === 4;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMsgFile(file);
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setMsgFilePreview(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setMsgFilePreview(null);
      }
    }
  };

  const handleClearFile = () => {
    setMsgFile(null);
    setMsgFilePreview(null);
  };

  // Add Template Modal State
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    templateName: "",
    templateCategoryId: 2, // Utility
    customerWhatsAppNumber: "",
    bodyText: "",
    componentFormatId: 1, // Text
    headerText: "",
    footerText: "",
    exampleBodyText: "",
    buttonTypeId: 0,
    buttonText: "",
    buttonUrl: "",
    buttonPhoneNumber: "",
  });
  const [submittingTemplate, setSubmittingTemplate] = useState(false);
  const [templateSubmitResult, setTemplateSubmitResult] = useState<any>(null);

  // Copy helper
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Fetch status on mount
  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const tokenParam = apiTokenOverride ? `?apiToken=${encodeURIComponent(apiTokenOverride)}` : "";
      const res = await fetch(`/api/whatsapp?action=status${tokenParam}`);
      const data = await res.json();
      if (data.success) {
        setStatus(data.status);
        if (!otpTemplateId && data.status.otpTemplateId) {
          setOtpTemplateId(data.status.otpTemplateId);
        }
      }
    } catch (e) {
      console.error("Failed to load WhatsApp gateway status:", e);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [apiTokenOverride]);

  // Load Time Zones
  const fetchTimeZones = async () => {
    setLoadingTimezones(true);
    try {
      const tokenParam = apiTokenOverride ? `&apiToken=${encodeURIComponent(apiTokenOverride)}` : "";
      const res = await fetch(`/api/whatsapp?action=timezones${tokenParam}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.timezones)) {
        setTimezones(data.timezones);
      }
    } catch (e) {
      console.error("Failed to fetch time zones:", e);
    } finally {
      setLoadingTimezones(false);
    }
  };

  // Load Templates
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const tokenParam = apiTokenOverride ? `&apiToken=${encodeURIComponent(apiTokenOverride)}` : "";
      const res = await fetch(`/api/whatsapp?action=templates${tokenParam}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.templates)) {
        setTemplatesList(data.templates);
        if (!selectedTemplate && data.templates.length > 0) {
          setSelectedTemplate(data.templates[0]);
        }
      }
    } catch (e) {
      console.error("Failed to load templates:", e);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchTimeZones();
    fetchTemplates();
    fetchMessages();
  }, []);

  useEffect(() => {
    if (activeTab === "send" && timezones.length === 0) {
      fetchTimeZones();
    }
    if (activeTab === "templates" && templatesList.length === 0) {
      fetchTemplates();
    }
    if (activeTab === "messages") {
      fetchMessages();
    }
  }, [activeTab]);

  // Fetch messages from DB
  const fetchMessages = async (
    query = msgSearchQuery,
    status = msgStatusFilter,
    type = msgTypeFilter
  ) => {
    setLoadingMessages(true);
    try {
      const params = new URLSearchParams();
      params.append("action", "messages");
      if (query.trim()) params.append("search", query.trim());
      if (status && status !== "all") params.append("status", status);
      if (type && type !== "ALL") params.append("type", type);
      params.append("limit", "150");

      const res = await fetch(`/api/whatsapp?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setMessagesList(data.messages || []);
        setMessageStats(data.stats || null);
      }
    } catch (e) {
      console.error("Failed to load sent WhatsApp messages:", e);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Sync DLR for single message from MessageBot
  const handleSyncSingleDlr = async (campaignId: number | string) => {
    if (!campaignId) return;
    setSyncingDlrId(String(campaignId));
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync-dlr",
          campaignId,
          apiToken: apiTokenOverride || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.record) {
        setMessagesList((prev) =>
          prev.map((m) =>
            m.campaignId === Number(campaignId) ? { ...m, ...data.record } : m
          )
        );
        if (selectedMessageDetail?.campaignId === Number(campaignId)) {
          setSelectedMessageDetail((prev: any) => ({ ...prev, ...data.record }));
        }
      }
    } catch (err) {
      console.error("Failed to sync DLR for campaign", campaignId, err);
    } finally {
      setSyncingDlrId(null);
    }
  };

  // Sync DLR for all visible messages
  const handleSyncAllVisibleDlrs = async () => {
    const campaignIds = messagesList
      .filter((m) => m.campaignId)
      .map((m) => m.campaignId);

    if (campaignIds.length === 0) return;

    setSyncingAllDlrs(true);
    try {
      await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync-multiple-dlr",
          campaignIds,
          apiToken: apiTokenOverride || undefined,
        }),
      });
      await fetchMessages();
    } catch (err) {
      console.error("Failed to sync all visible DLRs:", err);
    } finally {
      setSyncingAllDlrs(false);
    }
  };

  // Test Connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionMessage(null);
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test-connection",
          apiToken: apiTokenOverride || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConnectionMessage({
          success: true,
          text: `${data.message} (${data.totalTimeZones} timezones available)`,
        });
      } else {
        setConnectionMessage({
          success: false,
          text: data.error || "Connection test failed.",
        });
      }
    } catch (err: any) {
      setConnectionMessage({
        success: false,
        text: err.message || "Network error while testing connection.",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Generate random 4-digit or 6-digit OTP
  const generateRandomOtp = (digits = 4) => {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    const code = Math.floor(min + Math.random() * (max - min + 1)).toString();
    setOtpCode(code);
  };

  // Handle Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingOtp(true);
    setOtpResponse(null);

    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send-otp",
          phoneNumber: otpPhone,
          otpCode: otpCode,
          templateId: otpTemplateId || "3",
          callbackUrl: otpCallbackUrl || undefined,
          apiToken: apiTokenOverride || undefined,
        }),
      });
      const data = await res.json();
      setOtpResponse(data);
      if (data.success && data.campaignId) {
        setDlrCampaignId(String(data.campaignId));
      }
      fetchMessages();
    } catch (err: any) {
      setOtpResponse({ success: false, error: err.message || "Failed to dispatch request." });
    } finally {
      setSendingOtp(false);
    }
  };

  // Handle Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isMsgMediaTemplate && !msgFile) {
      setMsgResponse({
        success: false,
        error: `Template #${msgTemplateId} (${currentMsgTemplate?.TemplateName || "Selected"}) is an Image/Media template. You must select or upload an image file before sending.`,
        data: {
          IsSuccess: false,
          ErrorCode: 34,
          ErrorDescription: "Upload file for media templates",
        },
      });
      return;
    }

    setSendingMsg(true);
    setMsgResponse(null);

    try {
      const formData = new FormData();
      formData.append("action", "send-message");
      formData.append("quickNumber", msgPhone);
      formData.append("templateId", msgTemplateId);
      if (msgCampaignName) formData.append("campaignName", msgCampaignName);
      if (msgSample) formData.append("sample", msgSample);
      if (msgButtonExample) formData.append("buttonExample", msgButtonExample);
      if (msgCallbackUrl) formData.append("callbackUrl", msgCallbackUrl);
      formData.append("isScheduled", String(isScheduled));
      if (isScheduled) {
        formData.append("timeZoneId", String(selectedTimeZoneId));
        if (scheduledDate) formData.append("finalEffectiveDate", scheduledDate);
        if (scheduledTime) formData.append("finalEffectiveTime", scheduledTime);
      }
      if (apiTokenOverride) formData.append("apiToken", apiTokenOverride);
      if (currentMsgTemplate?.TemplateName) {
        formData.append("templateName", currentMsgTemplate.TemplateName);
      }
      if (currentMsgTemplate?.TemplateTypeDescription) {
        formData.append("templateType", currentMsgTemplate.TemplateTypeDescription);
      }
      if (msgFile) {
        formData.append("templateFile", msgFile);
        const ext = msgFile.name.split(".").pop() || "png";
        formData.append("templateFileExtension", ext);
      }

      const res = await fetch("/api/whatsapp", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setMsgResponse(data);
      if (data.success && data.campaignId) {
        setDlrCampaignId(String(data.campaignId));
      }
      fetchMessages();
    } catch (err: any) {
      setMsgResponse({ success: false, error: err.message || "Failed to dispatch message." });
    } finally {
      setSendingMsg(false);
    }
  };

  // Handle Fetch DLR
  const handleFetchDlr = async (overrideId?: string) => {
    const idToFetch = overrideId || dlrCampaignId;
    if (!idToFetch) return;

    setLoadingDlr(true);
    setDlrError(null);
    setDlrData(null);

    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get-dlr",
          campaignId: idToFetch,
          apiToken: apiTokenOverride || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.dlr) {
        setDlrData(data.dlr);
      } else {
        setDlrError(data.error || "No delivery record returned for this Campaign ID.");
      }
    } catch (err: any) {
      setDlrError(err.message || "Failed to retrieve DLR.");
    } finally {
      setLoadingDlr(false);
    }
  };

  // Handle Fetch Campaigns
  const handleFetchCampaigns = async () => {
    if (!campaignQueryIds) return;
    setLoadingCampaigns(true);
    setCampaignsError(null);

    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get-campaigns",
          campaignIds: campaignQueryIds,
          apiToken: apiTokenOverride || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.campaigns)) {
        setCampaignsList(data.campaigns);
      } else {
        setCampaignsError(data.error || "Failed to fetch campaign details.");
      }
    } catch (err: any) {
      setCampaignsError(err.message || "Failed to query campaigns.");
    } finally {
      setLoadingCampaigns(false);
    }
  };

  // Handle Submit New Template
  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingTemplate(true);
    setTemplateSubmitResult(null);

    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-template",
          templateName: newTemplate.templateName,
          templateCategoryId: newTemplate.templateCategoryId,
          customerWhatsAppNumber: newTemplate.customerWhatsAppNumber,
          componentFormatId: newTemplate.componentFormatId,
          bodyText: newTemplate.bodyText || undefined,
          headerText: newTemplate.headerText || undefined,
          footerText: newTemplate.footerText || undefined,
          exampleBodyText: newTemplate.exampleBodyText || undefined,
          buttonTypeId: newTemplate.buttonTypeId > 0 ? newTemplate.buttonTypeId : undefined,
          buttonText: newTemplate.buttonText || undefined,
          buttonUrl: newTemplate.buttonUrl || undefined,
          buttonPhoneNumber: newTemplate.buttonPhoneNumber || undefined,
          apiToken: apiTokenOverride || undefined,
        }),
      });
      const data = await res.json();
      setTemplateSubmitResult(data);
      if (data.success) {
        fetchTemplates();
      }
    } catch (err: any) {
      setTemplateSubmitResult({ success: false, error: err.message || "Submission error." });
    } finally {
      setSubmittingTemplate(false);
    }
  };

  // Filtered Templates
  const filteredTemplates = templatesList.filter((t) => {
    if (templateCategoryFilter !== "all" && t.TemplateCategory !== templateCategoryFilter) {
      return false;
    }
    if (templateSearch.trim()) {
      const q = templateSearch.toLowerCase();
      return (
        t.TemplateName?.toLowerCase().includes(q) ||
        String(t.WhatsAppTemplateId).includes(q) ||
        t.TemplateStatusDescription?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (authLoading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-6 h-6 text-[#3F8EFC] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0A2540] font-sans selection:bg-[#0066FF] selection:text-white relative">
      {/* Subtle background dot grid matching website */}
      <div className="absolute inset-0 bg-[radial-gradient(#E2E8F0_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      {/* Top Header (Website Theme) */}
      <header className="border-b border-[#E2E8F0] bg-white/95 backdrop-blur-md sticky top-0 z-30 shadow-[0_2px_12px_-3px_rgba(50,50,93,0.06)] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0066FF] to-[#38BDF8] flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#0A2540]">
                  WhatsApp Messaging Hub
                </h1>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE]">
                  MessageBot API
                </span>
              </div>
              <p className="hidden md:block text-xs text-[#64748B]">
                Official Integration &middot; OTP Dispatch &middot; DLR Tracking &middot; Excel Bulk EMI Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Live Gateway Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-xs shadow-sm">
              <span
                className={`w-2 h-2 rounded-full ${
                  status?.hasToken ? "bg-[#15803D] animate-pulse" : "bg-amber-400"
                }`}
              />
              <span className="text-[#3C4F69] font-medium">
                {statusLoading
                  ? "Checking..."
                  : status?.hasToken
                  ? "Gateway Ready"
                  : "Token Needed"}
              </span>
            </div>

            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="max-sm:min-h-11 flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white transition shadow-sm disabled:opacity-50"
            >
              {testingConnection ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              <span>Test Ping</span>
            </button>

            <Link
              href="/admin"
              className="max-sm:min-h-11 inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-[#0A2540] hover:text-[#0066FF] bg-white hover:bg-slate-50 rounded-xl border border-[#E2E8F0] transition shadow-sm"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Connection status banner notification */}
        {connectionMessage && (
          <div
            className={`px-4 py-2 text-xs flex items-center justify-between border-t ${
              connectionMessage.success
                ? "bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]"
                : "bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]"
            }`}
          >
            <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
              {connectionMessage.success ? (
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              )}
              <span className="font-medium">{connectionMessage.text}</span>
            </div>
            <button
              onClick={() => setConnectionMessage(null)}
              className="max-sm:min-h-11 text-[#64748B] hover:text-[#0A2540] ml-2 text-base font-bold"
            >
              &times;
            </button>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-4 sm:space-y-6 relative z-10">
        {/* Token Alert / Quick Override */}
        {!status?.hasToken && !statusLoading && (
          <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-[#92400E]">
                  MessageBot WhatsApp API Token Not Configured in Environment
                </h4>
                <p className="text-xs text-[#B45309] mt-0.5">
                  Set <code className="bg-amber-100 px-1 py-0.5 rounded text-[#92400E] font-mono">MESSAGEBOT_WHATSAPP_API_TOKEN</code> in your <code className="bg-amber-100 px-1 py-0.5 rounded text-[#92400E] font-mono">.env</code> file, or test using the live token input below.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <button
                onClick={() => setShowOverrideInput(!showOverrideInput)}
                className="max-sm:min-h-11 text-xs px-3.5 py-1.5 rounded-xl bg-amber-100 text-[#92400E] hover:bg-amber-200 border border-amber-300 font-medium transition"
              >
                {showOverrideInput ? "Hide Token Input" : "Enter Test Token"}
              </button>
              <button
                onClick={() => setActiveTab("setup")}
                className="max-sm:min-h-11 text-xs px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition shadow-sm"
              >
                Setup Guide
              </button>
            </div>
          </div>
        )}

        {/* Live Token Override Box */}
        {showOverrideInput && (
          <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shadow-sm">
            <Key className="w-4 h-4 text-[#0066FF] shrink-0" />
            <input
              type="text"
              placeholder="Paste MessageBot API Token (e.g. qrOKq05UZPFr8Kjf)"
              value={apiTokenOverride}
              onChange={(e) => setApiTokenOverride(e.target.value)}
              className="max-sm:min-h-11 flex-1 bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2 max-sm:text-base text-xs text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 w-full font-mono"
            />
            <button
              onClick={fetchStatus}
              className="max-sm:min-h-11 px-4 py-2 text-xs font-semibold rounded-xl bg-[#0066FF] hover:bg-blue-700 text-white transition shrink-0 shadow-sm"
            >
              Apply Live Token
            </button>
          </div>
        )}

        {/* Navigation Tabs (Website Theme) */}
        <div className="flex items-center gap-1.5 bg-white border border-[#E2E8F0] p-1.5 rounded-2xl shadow-sm overflow-x-auto">
          {[
            { id: "excel", label: "Excel Bulk EMI Campaign", icon: FileSpreadsheet },
            { id: "otp", label: "Send OTP (Auth)", icon: Zap },
            { id: "send", label: "Send Message", icon: Send },
            {
              id: "messages",
              label: "Sent Messages & Costing",
              icon: History,
              count: messageStats?.totalMessages ?? messagesList.length,
            },
            { id: "dlr", label: "Delivery Reports (DLR)", icon: BarChart3 },
            { id: "campaigns", label: "Campaigns", icon: Layers },
            { id: "templates", label: "Template Studio", icon: FileText },
            { id: "setup", label: "Setup Checklist", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`max-sm:min-h-11 shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? "bg-[#0A2540] text-white shadow-md shadow-[#0A2540]/20"
                    : "text-[#3C4F69] hover:text-[#0A2540] hover:bg-[#F1F5F9]"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-[#0066FF]"}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: SEND OTP */}
        {activeTab === "otp" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-[24px] p-4 sm:p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#0A2540] flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#0066FF]" />
                    WhatsApp Send OTP API
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Dispatches instant WhatsApp verification OTPs using approved authentication templates
                  </p>
                </div>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE] font-mono font-bold">
                  POST /whatsapp/SendOtp
                </span>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0A2540] mb-1.5">
                    Recipient Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-xs text-[#64748B] font-mono font-bold">
                      +91
                    </div>
                    <input
                      type="text"
                      placeholder="9906785432"
                      value={otpPhone}
                      onChange={(e) => setOtpPhone(e.target.value)}
                      required
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl pl-12 pr-4 py-2.5 max-sm:text-base text-sm text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-mono transition shadow-sm font-medium"
                    />
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Accepts 10-digit Indian mobile number or with 91 prefix.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs font-bold text-[#0A2540]">
                        OTP Code <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => generateRandomOtp(4)}
                          className="max-sm:min-h-11 text-[11px] text-[#0066FF] hover:text-blue-700 font-semibold"
                        >
                          4-Digit
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => generateRandomOtp(6)}
                          className="max-sm:min-h-11 text-[11px] text-[#0066FF] hover:text-blue-700 font-semibold"
                        >
                          6-Digit
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="1234"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      required
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-4 py-2.5 max-sm:text-base text-sm text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-mono transition tracking-widest font-bold shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1.5">
                      Template ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="3"
                      value={otpTemplateId}
                      onChange={(e) => setOtpTemplateId(e.target.value)}
                      required
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-4 py-2.5 max-sm:text-base text-sm text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-mono transition shadow-sm font-medium"
                    />
                    <p className="text-[11px] text-[#64748B] mt-1">
                      Default: ID 3 (or from MESSAGEBOT_WHATSAPP_OTP_TEMPLATE_ID)
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0A2540] mb-1.5">
                    Callback URL <span className="text-[#64748B] font-normal">(Optional DLR Webhook)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://creditexpertindia.com/api/whatsapp/callback"
                    value={otpCallbackUrl}
                    onChange={(e) => setOtpCallbackUrl(e.target.value)}
                    className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-4 py-2.5 max-sm:text-base text-xs text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-mono transition shadow-sm font-medium"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={sendingOtp}
                    className="max-sm:min-h-11 w-full py-3 px-4 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white font-semibold text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {sendingOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Dispatching OTP via MessageBot...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send WhatsApp OTP</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* OTP Response & Preview Inspector */}
            <div className="lg:col-span-5 space-y-6">
              {/* Live Preview Card */}
              <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-4 sm:p-6 shadow-sm space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#0066FF]" />
                  Simulated WhatsApp Bubble
                </h4>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 relative overflow-hidden shadow-xs">
                  <div className="absolute top-0 left-0 w-1 bg-[#15803D] h-full" />
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-[#0A2540]">Credit Expert India</span>
                    <span className="text-[11px] text-[#64748B]">&bull; Just now</span>
                  </div>
                  <p className="text-xs text-[#3C4F69] leading-relaxed">
                    Your verification code for Credit Expert India account access is{" "}
                    <span className="bg-[#EAF3FF] text-[#0066FF] font-bold px-1.5 py-0.5 rounded border border-[#BFDBFE] font-mono">
                      {otpCode || "1234"}
                    </span>
                    . Valid for 10 minutes. Do not share this OTP with anyone.
                  </p>
                  <div className="mt-3 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B]">
                    <span>Secured with Meta WhatsApp Cloud</span>
                    <span className="text-[#15803D] font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Encrypted
                    </span>
                  </div>
                </div>
              </div>

              {/* Response Panel */}
              <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-4 sm:p-6 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Live Gateway Response
                  </h4>
                  {otpResponse && (
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        otpResponse.success
                          ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]"
                          : "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]"
                      }`}
                    >
                      {otpResponse.success ? "Accepted" : "Failed"}
                    </span>
                  )}
                </div>

                {otpResponse ? (
                  <div className="space-y-3">
                    {otpResponse.success && otpResponse.campaignId && (
                      <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] text-[#15803D] font-bold">
                            WhatsApp Campaign ID
                          </div>
                          <div className="text-xl font-mono font-bold text-[#0A2540]">
                            #{otpResponse.campaignId}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setActiveTab("dlr");
                            handleFetchDlr(String(otpResponse.campaignId));
                          }}
                          className="max-sm:min-h-11 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white transition flex items-center gap-1.5 shadow-sm"
                        >
                          <span>Track DLR</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <pre className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-mono text-[#0A2540] overflow-x-auto max-h-52">
                      {JSON.stringify(otpResponse, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-[#64748B]">
                    Submit the form to see real-time HTTP response and campaign tracking ID.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SEND MESSAGE */}
        {activeTab === "send" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white border border-[#E2E8F0] rounded-[24px] p-4 sm:p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#0A2540] flex items-center gap-2">
                    <Send className="w-5 h-5 text-[#0066FF]" />
                    WhatsApp Send Message API
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Send single or scheduled template notifications with dynamic parameters and action buttons
                  </p>
                </div>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE] font-mono font-bold">
                  POST /whatsapp/SendMessage
                </span>
              </div>

              <form onSubmit={handleSendMessage} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1.5">
                      Recipient Phone (QuickNumber) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="919999000000"
                      value={msgPhone}
                      onChange={(e) => setMsgPhone(e.target.value)}
                      required
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-4 py-2.5 max-sm:text-base text-xs text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-mono transition shadow-sm font-medium"
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <label className="block text-xs font-bold text-[#0A2540]">
                        Template <span className="text-red-500">*</span>
                      </label>
                      {currentMsgTemplate && (
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                            isMsgMediaTemplate
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]"
                          }`}
                        >
                          {isMsgMediaTemplate ? "📸 Media (Image) Template" : "📝 Text Template"}
                        </span>
                      )}
                    </div>

                    {templatesList.length > 0 ? (
                      <div className="space-y-2">
                        <select
                          value={msgTemplateId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMsgTemplateId(val);
                            if (val === "72" && !msgSample) {
                              setMsgSample("Rahul, 50000, 25000, CreditExpert");
                            } else if (val === "69" && !msgSample) {
                              setMsgSample("Rahul");
                            } else if (val === "71" && !msgSample) {
                              setMsgSample("Rahul, 50000, 25000, Bank, Manager");
                            }
                          }}
                          className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 max-sm:text-base text-xs text-[#0A2540] focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-medium transition shadow-sm"
                        >
                          <option value="">-- Choose an approved template --</option>
                          {templatesList.map((tpl) => (
                            <option key={tpl.WhatsAppTemplateId} value={tpl.WhatsAppTemplateId}>
                              #{tpl.WhatsAppTemplateId}: {tpl.TemplateName} ({tpl.TemplateTypeDescription || "Text"} • {tpl.TemplateCategory || "Utility"}) [{tpl.TemplateStatusDescription}]
                            </option>
                          ))}
                        </select>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B] px-1">
                          <span>Or enter raw template ID:</span>
                          <input
                            type="text"
                            value={msgTemplateId}
                            onChange={(e) => setMsgTemplateId(e.target.value)}
                            placeholder="e.g. 69, 72"
                            className="max-sm:min-h-11 w-24 bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1 max-sm:text-base text-xs text-[#0A2540] font-mono focus:outline-none focus:border-[#0066FF]"
                          />
                        </div>
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="e.g. 69 or 72"
                        value={msgTemplateId}
                        onChange={(e) => setMsgTemplateId(e.target.value)}
                        required
                        className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-4 py-2.5 max-sm:text-base text-xs text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-mono transition shadow-sm font-medium"
                      />
                    )}
                  </div>
                </div>

                {/* Media File Upload (Required for Image/Media templates to avoid ErrorCode 34) */}
                <div
                  className={`p-4 rounded-2xl border transition ${
                    isMsgMediaTemplate
                      ? "bg-blue-50/60 border-blue-200"
                      : "bg-[#F8FAFC] border-[#E2E8F0]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <ImageIcon
                        className={`w-4 h-4 ${
                          isMsgMediaTemplate ? "text-blue-600" : "text-[#0066FF]"
                        }`}
                      />
                      <span className="text-xs font-bold text-[#0A2540]">
                        Media Header File{" "}
                        {isMsgMediaTemplate ? (
                          <span className="text-red-500 font-semibold">
                            * (Required for Image Template)
                          </span>
                        ) : (
                          <span className="text-[#64748B] font-normal">(Optional for text templates)</span>
                        )}
                      </span>
                    </div>
                    {isMsgMediaTemplate && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold border border-blue-200">
                        Prevents ErrorCode 34
                      </span>
                    )}
                  </div>

                  {isMsgMediaTemplate && (
                    <p className="text-[11px] text-blue-800 mb-3 leading-relaxed">
                      ⚠️ Template #{msgTemplateId} (
                      <strong>{currentMsgTemplate?.TemplateName || "Selected"}</strong>) is configured with an <strong>Image Header</strong> on WhatsApp. Meta requires an image file (PNG, JPG) to be uploaded with this message, or it will be rejected with <em>ErrorCode 34 (&quot;Upload file for media templates&quot;)</em>.
                    </p>
                  )}

                  {!msgFile ? (
                    <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-[#CBD5E1] hover:border-[#0066FF] rounded-xl cursor-pointer bg-white hover:bg-blue-50/40 transition group shadow-xs">
                      <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-[#0066FF] transition mb-2" />
                      <span className="text-xs font-semibold text-[#0A2540] group-hover:text-[#0066FF] transition">
                        Click to upload header image or document
                      </span>
                      <span className="text-[11px] text-[#64748B] mt-1">
                        PNG, JPG, JPEG, WEBP or PDF (up to 5MB)
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-white border border-[#E2E8F0] shadow-xs">
                      <div className="flex flex-wrap items-center gap-3">
                        {msgFilePreview ? (
                          <img
                            src={msgFilePreview}
                            alt="Preview"
                            className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-semibold text-[#0A2540] truncate max-w-[220px] sm:max-w-xs">
                            {msgFile.name}
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            {(msgFile.size / 1024).toFixed(1)} KB • {msgFile.type || "file"}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="max-sm:min-h-11 max-sm:min-w-11 p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 border border-slate-200 transition"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1.5">
                      Sample Variables <span className="text-[#64748B] font-normal">(Comma separated)</span>
                    </label>
                    <input
                      type="text"
                      placeholder={
                        msgTemplateId === "72"
                          ? "e.g. Rahul, 50000, 25000, CreditExpert"
                          : msgTemplateId === "69"
                          ? "e.g. Rahul"
                          : "e.g. Rajesh, ₹5,00,000"
                      }
                      value={msgSample}
                      onChange={(e) => setMsgSample(e.target.value)}
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-4 py-2.5 max-sm:text-base text-xs text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition shadow-sm font-medium"
                    />
                    <div className="text-[11px] text-[#64748B] mt-1 space-y-0.5">
                      {msgTemplateId === "72" ? (
                        <p className="text-[#15803D] font-medium">
                          ✓ Template #72 requires 4 variables:{" "}
                          <code className="bg-slate-100 px-1 py-0.5 rounded text-[#0A2540]">{"{{1}} Name, {{2}} Current EMI, {{3}} New EMI, {{4}} Company"}</code>
                        </p>
                      ) : msgTemplateId === "69" ? (
                        <p className="text-[#15803D] font-medium">
                          ✓ Template #69 requires 1 variable: <code className="bg-slate-100 px-1 py-0.5 rounded text-[#0A2540]">{"{{1}} Name"}</code>
                        </p>
                      ) : msgTemplateId === "71" ? (
                        <p className="text-[#15803D] font-medium">
                          ✓ Template #71 requires 5 variables: <code className="bg-slate-100 px-1 py-0.5 rounded text-[#0A2540]">{"{{1}}, {{2}}, {{3}}, {{4}}, {{5}}"}</code>
                        </p>
                      ) : (
                        <p>
                          Populates template markers: <code className="text-[#0066FF] font-semibold">{`{{1}}`}</code>, <code className="text-[#0066FF] font-semibold">{`{{2}}`}</code>
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1.5">
                      Button Link / Example <span className="text-[#64748B] font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. creditexpertindia.com/eligibility"
                      value={msgButtonExample}
                      onChange={(e) => setMsgButtonExample(e.target.value)}
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-4 py-2.5 max-sm:text-base text-xs text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition shadow-sm font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1.5">
                      Campaign Name <span className="text-[#64748B] font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DebtConsolidation_Promo_Oct"
                      value={msgCampaignName}
                      onChange={(e) => setMsgCampaignName(e.target.value)}
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-4 py-2.5 max-sm:text-base text-xs text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition shadow-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1.5">
                      Callback URL <span className="text-[#64748B] font-normal">(Optional)</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://creditexpertindia.com/api/whatsapp/callback"
                      value={msgCallbackUrl}
                      onChange={(e) => setMsgCallbackUrl(e.target.value)}
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-4 py-2.5 max-sm:text-base text-xs text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-mono transition shadow-sm font-medium"
                    />
                  </div>
                </div>

                {/* Scheduled Delivery Switch */}
                <div className="pt-2 border-t border-[#E2E8F0]">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-[#0066FF]" />
                      <div>
                        <div className="text-xs font-bold text-[#0A2540]">
                          Schedule for Later Delivery
                        </div>
                        <div className="text-[11px] text-[#64748B]">
                          Automate execution at a specific date and time with TimeZone mapping
                        </div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isScheduled}
                        onChange={(e) => setIsScheduled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0066FF]"></div>
                    </label>
                  </div>

                  {isScheduled && (
                    <div className="mt-3 p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#0A2540] mb-1">
                          TimeZone
                        </label>
                        <select
                          value={selectedTimeZoneId}
                          onChange={(e) => setSelectedTimeZoneId(Number(e.target.value))}
                          className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-2.5 py-2 max-sm:text-base text-xs text-[#0A2540] focus:outline-none focus:border-[#0066FF] shadow-xs"
                        >
                          {timezones.length > 0 ? (
                            timezones.map((tz) => (
                              <option key={tz.TimeZoneId} value={tz.TimeZoneId}>
                                #{tz.TimeZoneId}: {tz.TimeZoneName}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value={2}>#2: UTC-11 (-11:00)</option>
                              <option value={62}>#62: India Standard Time (+05:30)</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#0A2540] mb-1">
                          Date (YYYY-MM-DD)
                        </label>
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          required={isScheduled}
                          className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-2.5 py-2 max-sm:text-base text-xs text-[#0A2540] focus:outline-none focus:border-[#0066FF] shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#0A2540] mb-1">
                          Time (HH:mm:ss)
                        </label>
                        <input
                          type="time"
                          step="1"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          required={isScheduled}
                          className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-2.5 py-2 max-sm:text-base text-xs text-[#0A2540] focus:outline-none focus:border-[#0066FF] shadow-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={sendingMsg}
                    className="max-sm:min-h-11 w-full py-3 px-4 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white font-semibold text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {sendingMsg ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending WhatsApp Message...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Dispatch Message</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Message Result */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-4 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Execution Status
                  </h4>
                  {msgResponse && (
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        msgResponse.success
                          ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]"
                          : "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]"
                      }`}
                    >
                      {msgResponse.success ? "Accepted" : "Rejected"}
                    </span>
                  )}
                </div>

                {msgResponse ? (
                  <div className="space-y-3">
                    {msgResponse.success && msgResponse.campaignId && (
                      <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0]">
                        <div className="text-[11px] text-[#15803D] font-bold">
                          New WhatsApp Campaign ID
                        </div>
                        <div className="text-xl font-mono font-bold text-[#0A2540] mt-0.5">
                          #{msgResponse.campaignId}
                        </div>
                        <button
                          onClick={() => {
                            setActiveTab("dlr");
                            handleFetchDlr(String(msgResponse.campaignId));
                          }}
                          className="max-sm:min-h-11 mt-3 w-full py-2 text-xs font-semibold rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white transition flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <span>Track Delivery Report</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Error Diagnostics for ErrorCode 34 and 33 */}
                    {!msgResponse.success &&
                      (msgResponse.data?.ErrorCode === 34 ||
                        msgResponse.error?.includes("media templates")) && (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                          <div className="font-bold flex items-center gap-1.5 text-amber-800">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Media File Required (ErrorCode 34)</span>
                          </div>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            The chosen template has an <strong>Image/Media header</strong>. WhatsApp
                            Cloud API requires an image file (PNG, JPG) to be uploaded in the
                            &ldquo;Media Header File&rdquo; box above before dispatching.
                          </p>
                        </div>
                      )}

                    {!msgResponse.success &&
                      (msgResponse.data?.ErrorCode === 33 ||
                        msgResponse.error?.includes("mismatch with body text")) && (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                          <div className="font-bold flex items-center gap-1.5 text-amber-800">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Sample Variables Mismatch (ErrorCode 33)</span>
                          </div>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            The number of comma-separated items in the <strong>Sample Variables</strong>{" "}
                            field does not match the placeholders required by this template. Check
                            the green helper guide below the Sample field for the exact count.
                          </p>
                        </div>
                      )}

                    <pre className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-mono text-[#0A2540] overflow-x-auto max-h-72">
                      {JSON.stringify(msgResponse, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-[#64748B]">
                    Send a message to see the generated Campaign ID and live response payload.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2.5: EXCEL BULK EMI CAMPAIGN */}
        {activeTab === "excel" && (
          <ExcelEmiCampaign
            templatesList={templatesList}
            apiTokenOverride={apiTokenOverride}
            onTrackDlr={(campaignId) => {
              setActiveTab("dlr");
              handleFetchDlr(campaignId);
            }}
            onRefreshMessages={fetchMessages}
          />
        )}

        {/* TAB 3: SENT MESSAGES HISTORY & COSTING */}
        {activeTab === "messages" && (
          <div className="space-y-6">
            {/* Header & Quick Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#0A2540] flex items-center gap-2">
                  <History className="w-5 h-5 text-[#0066FF]" />
                  Sent WhatsApp Messages & Costing Tracker
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Real-time database log of all customer dispatches with delivery status, read receipts, and billing cost
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleSyncAllVisibleDlrs}
                  disabled={syncingAllDlrs || messagesList.length === 0}
                  className="max-sm:min-h-11 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#0A2540] text-xs font-semibold border border-[#CBD5E1] transition flex items-center gap-2 disabled:opacity-50 shadow-sm"
                  title="Check live delivery reports from MessageBot for all messages"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${syncingAllDlrs ? "animate-spin text-[#0066FF]" : "text-slate-500"}`}
                  />
                  <span>{syncingAllDlrs ? "Syncing DLR..." : "Sync Live DLR"}</span>
                </button>
                <button
                  onClick={() => fetchMessages()}
                  disabled={loadingMessages}
                  className="max-sm:min-h-11 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#64748B] hover:text-[#0A2540] text-xs font-semibold border border-[#CBD5E1] transition flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMessages ? "animate-spin text-[#0066FF]" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
              <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm space-y-1">
                <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider flex flex-wrap items-center justify-between gap-2">
                  <span>Total Sent</span>
                  <MessageSquare className="w-4 h-4 text-[#0066FF]" />
                </div>
                <div className="text-2xl font-bold font-mono text-[#0A2540]">
                  {messageStats?.totalMessages ?? messagesList.length}
                </div>
                <div className="text-[11px] text-[#94A3B8]">Recorded in database</div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] shadow-sm space-y-1">
                <div className="text-[11px] font-semibold text-[#15803D] uppercase tracking-wider flex flex-wrap items-center justify-between gap-2">
                  <span>Reached / Delivered</span>
                  <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                </div>
                <div className="text-2xl font-bold font-mono text-[#15803D]">
                  {messageStats?.totalDelivered ?? 0}
                </div>
                <div className="text-[11px] text-[#166534] font-medium">
                  {messageStats?.deliveryRatePercent ?? 0}% Delivery Rate
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#EAF3FF] border border-[#BFDBFE] shadow-sm space-y-1">
                <div className="text-[11px] font-semibold text-[#0052CC] uppercase tracking-wider flex flex-wrap items-center justify-between gap-2">
                  <span>In Transit / Submitted</span>
                  <Clock className="w-4 h-4 text-[#0052CC]" />
                </div>
                <div className="text-2xl font-bold font-mono text-[#0052CC]">
                  {messageStats?.totalSubmitted ?? 0}
                </div>
                <div className="text-[11px] text-[#0066FF]">Awaiting carrier DLR</div>
              </div>

              <div className="p-4 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] shadow-sm space-y-1">
                <div className="text-[11px] font-semibold text-[#B91C1C] uppercase tracking-wider flex flex-wrap items-center justify-between gap-2">
                  <span>Rejected / Failed</span>
                  <AlertTriangle className="w-4 h-4 text-[#B91C1C]" />
                </div>
                <div className="text-2xl font-bold font-mono text-[#B91C1C]">
                  {messageStats?.totalRejectedOrFailed ?? 0}
                </div>
                <div className="text-[11px] text-[#DC2626]">Gateway or number rejects</div>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0A2540] to-[#0A2540] text-white shadow-md space-y-1 col-span-2 lg:col-span-1 border border-[#0A2540]">
                <div className="text-[11px] font-semibold text-blue-200 uppercase tracking-wider flex flex-wrap items-center justify-between gap-2">
                  <span>Total Billing Cost</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-white">
                  ₹{(messageStats?.totalCost ?? 0).toFixed(2)}
                </div>
                <div className="text-[11px] text-blue-200/90 font-mono">
                  {messageStats?.currency || "INR"} (Live gateway report)
                </div>
              </div>
            </div>

            {/* Search Bar & Filters */}
            <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by recipient phone, campaign ID (#666), template, or sample variables..."
                  value={msgSearchQuery}
                  onChange={(e) => {
                    const q = e.target.value;
                    setMsgSearchQuery(q);
                    fetchMessages(q, msgStatusFilter, msgTypeFilter);
                  }}
                  className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl pl-10 pr-4 py-2.5 max-sm:text-base text-xs text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition shadow-sm font-medium"
                />
                {msgSearchQuery && (
                  <button
                    onClick={() => {
                      setMsgSearchQuery("");
                      fetchMessages("", msgStatusFilter, msgTypeFilter);
                    }}
                    className="max-sm:min-h-11 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0A2540]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto shrink-0">
                {[
                  { id: "all", label: "All" },
                  { id: "delivered", label: "Delivered" },
                  { id: "submitted", label: "In Transit" },
                  { id: "failed", label: "Failed" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setMsgStatusFilter(s.id);
                      fetchMessages(msgSearchQuery, s.id, msgTypeFilter);
                    }}
                    className={`max-sm:min-h-11 shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      msgStatusFilter === s.id
                        ? "bg-[#0A2540] text-white shadow-sm"
                        : "bg-white hover:bg-slate-50 text-[#64748B] hover:text-[#0A2540] border border-[#CBD5E1]"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Type Filter */}
              <select
                value={msgTypeFilter}
                onChange={(e) => {
                  const t = e.target.value;
                  setMsgTypeFilter(t);
                  fetchMessages(msgSearchQuery, msgStatusFilter, t);
                }}
                className="max-sm:min-h-11 bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 max-sm:text-base text-xs text-[#0A2540] font-medium focus:outline-none focus:border-[#0066FF] shrink-0 w-full sm:w-auto shadow-sm"
              >
                <option value="ALL">All Types</option>
                <option value="MESSAGE">Custom Messages</option>
                <option value="OTP">OTP Verification</option>
              </select>
            </div>

            {/* Messages Table */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
              {loadingMessages ? (
                <div className="py-20 text-center text-xs text-[#64748B]">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0066FF]" />
                  Loading message history from database...
                </div>
              ) : messagesList.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#0A2540]">No Messages Found</h4>
                    <p className="text-xs text-[#64748B] max-w-sm mx-auto mt-1">
                      {msgSearchQuery || msgStatusFilter !== "all"
                        ? "No sent messages match your active filters. Try clearing your search query."
                        : "Messages dispatched from the Send Message or OTP tab will automatically appear here with live delivery status and costing."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Recipient Phone</th>
                        <th className="px-4 py-3">Campaign ID</th>
                        <th className="px-4 py-3">Template / Content</th>
                        <th className="px-4 py-3">Delivery Status</th>
                        <th className="px-4 py-3">Costing</th>
                        <th className="px-4 py-3">Sent Time</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {messagesList.map((msg) => {
                        const statusLower = (msg.dlrStatus || msg.status || "").toLowerCase();
                        const isDelivered =
                          statusLower.includes("delivered") ||
                          statusLower.includes("reached") ||
                          statusLower.includes("read");
                        const isSubmitted =
                          statusLower.includes("submitted") ||
                          statusLower.includes("accepted") ||
                          statusLower.includes("pending");
                        const isFailed =
                          statusLower.includes("rejected") || statusLower.includes("failed");

                        const isSyncing = syncingDlrId === String(msg.campaignId);

                        return (
                          <tr
                            key={msg.id || msg.campaignId}
                            className="hover:bg-[#F8FAFC]/80 transition"
                          >
                            {/* Recipient Phone */}
                            <td className="px-4 py-3.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-semibold text-[#0A2540]">
                                  {msg.recipientPhone || "N/A"}
                                </span>
                                <button
                                  onClick={() => handleCopy(msg.recipientPhone, `ph-${msg.id}`)}
                                  className="max-sm:min-h-11 text-slate-400 hover:text-[#0A2540] transition"
                                  title="Copy phone"
                                >
                                  {copiedKey === `ph-${msg.id}` ? (
                                    <Check className="w-3 h-3 text-[#15803D]" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                              <span className="text-[11px] text-[#64748B] font-medium uppercase">
                                {msg.type || "MESSAGE"}
                              </span>
                            </td>

                            {/* Campaign ID */}
                            <td className="px-4 py-3.5">
                              {msg.campaignId ? (
                                <span className="font-mono text-[#0066FF] font-bold bg-[#EAF3FF] px-2 py-0.5 rounded border border-[#BFDBFE]">
                                  #{msg.campaignId}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            {/* Template / Content */}
                            <td className="px-4 py-3.5 max-w-[240px]">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="font-semibold text-[#0A2540] truncate">
                                  {msg.templateName || `Template #${msg.templateId}`}
                                </span>
                                {msg.hasMedia && (
                                  <span className="text-[11px] px-1.5 py-0.2 rounded bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE] font-semibold">
                                    IMAGE
                                  </span>
                                )}
                              </div>
                              {msg.sample && (
                                <p className="text-[11px] text-[#64748B] truncate font-mono">
                                  {msg.sample}
                                </p>
                              )}
                            </td>

                            {/* Delivery Status */}
                            <td className="px-4 py-3.5">
                              {isDelivered ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">
                                  <CheckCircle2 className="w-3 h-3 text-[#15803D]" />
                                  <span>Delivered</span>
                                </span>
                              ) : isSubmitted ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#EAF3FF] text-[#0052CC] border border-[#BFDBFE]">
                                  <Clock className="w-3 h-3 text-[#0052CC]" />
                                  <span>In Transit</span>
                                </span>
                              ) : isFailed ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
                                  <AlertTriangle className="w-3 h-3 text-[#B91C1C]" />
                                  <span>{msg.dlrStatus || "Failed"}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-[#64748B] border border-slate-200">
                                  <span>{msg.dlrStatus || "Pending"}</span>
                                </span>
                              )}
                            </td>

                            {/* Costing */}
                            <td className="px-4 py-3.5">
                              <div className="font-mono font-bold text-[#0A2540]">
                                ₹{(msg.cost || 0).toFixed(2)}
                              </div>
                              <span className="text-[11px] text-[#64748B]">
                                {msg.totalSms || 1} msg credit
                              </span>
                            </td>

                            {/* Sent Time */}
                            <td className="px-4 py-3.5 text-[#64748B] font-mono text-[11px] whitespace-nowrap">
                              {msg.createdAt
                                ? new Date(msg.createdAt).toLocaleString("en-IN", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "-"}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {msg.campaignId && (
                                  <button
                                    onClick={() => handleSyncSingleDlr(msg.campaignId)}
                                    disabled={isSyncing}
                                    className="max-sm:min-h-11 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-[#0A2540] border border-[#CBD5E1] transition flex items-center gap-1 text-[11px] font-medium disabled:opacity-50 shadow-sm"
                                    title="Fetch live DLR status and costing from MessageBot"
                                  >
                                    <RefreshCw
                                      className={`w-3 h-3 ${isSyncing ? "animate-spin text-[#0066FF]" : "text-slate-500"}`}
                                    />
                                    <span>Sync DLR</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => setSelectedMessageDetail(msg)}
                                  className="max-sm:min-h-11 px-2.5 py-1 rounded-lg bg-[#EAF3FF] hover:bg-[#BFDBFE] text-[#0066FF] border border-[#BFDBFE] transition flex items-center gap-1 text-[11px] font-semibold"
                                  title="View message details"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Details</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Message Detail Modal */}
            {selectedMessageDetail && (
              <div className="fixed inset-0 z-50 bg-[#0A2540]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
                <div className="bg-white border border-[#E2E8F0] rounded-[24px] w-full max-w-2xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-5 shadow-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
                    <div>
                      <h4 className="text-base font-bold text-[#0A2540] flex items-center gap-2">
                        <span>Message Audit Details</span>
                        {selectedMessageDetail.campaignId && (
                          <span className="font-mono text-[#0066FF] text-sm font-bold bg-[#EAF3FF] px-2 py-0.5 rounded border border-[#BFDBFE]">
                            #{selectedMessageDetail.campaignId}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-[#64748B]">
                        Detailed audit trail, carrier delivery breakdown, and costing metrics
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedMessageDetail(null)}
                      className="max-sm:min-h-11 max-sm:min-w-11 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#64748B] hover:text-[#0A2540] transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quick Status Bar */}
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[11px] text-[#64748B] block uppercase font-semibold">Recipient</span>
                      <span className="font-mono font-bold text-[#0A2540] text-sm">
                        {selectedMessageDetail.recipientPhone}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#64748B] block uppercase font-semibold">
                        Delivery Status
                      </span>
                      <span className="font-bold text-[#15803D]">
                        {selectedMessageDetail.dlrStatus || "Submitted"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#64748B] block uppercase font-semibold">Total Cost</span>
                      <span className="font-mono font-bold text-[#0A2540] text-sm">
                        ₹{(selectedMessageDetail.cost || 0).toFixed(2)}{" "}
                        {selectedMessageDetail.currency || "INR"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#64748B] block uppercase font-semibold">Credits Used</span>
                      <span className="font-mono font-bold text-[#0A2540]">
                        {selectedMessageDetail.totalSms || 1} Unit
                      </span>
                    </div>
                  </div>

                  {/* Template & Payload Info */}
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                      Template & Content
                    </h5>
                    <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[#64748B] text-[11px] block font-semibold">Template ID</span>
                          <span className="font-mono text-[#0A2540] font-bold">
                            #{selectedMessageDetail.templateId}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748B] text-[11px] block font-semibold">Template Name</span>
                          <span className="text-[#0A2540] font-semibold">
                            {selectedMessageDetail.templateName || "N/A"}
                          </span>
                        </div>
                      </div>

                      {selectedMessageDetail.hasMedia && (
                        <div className="pt-2 border-t border-[#E2E8F0]">
                          <span className="text-[#64748B] text-[11px] block font-semibold">Media Header</span>
                          <div className="flex items-center gap-2 text-[#0066FF] font-mono text-[11px] mt-0.5 font-semibold">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>
                              {selectedMessageDetail.mediaFileName ||
                                `Attached .${selectedMessageDetail.mediaFileExtension || "png"}`}
                            </span>
                          </div>
                        </div>
                      )}

                      {selectedMessageDetail.sample && (
                        <div className="pt-2 border-t border-[#E2E8F0]">
                          <span className="text-[#64748B] text-[11px] block font-semibold">
                            Dynamic Variables Sent (Sample)
                          </span>
                          <div className="p-2.5 rounded-lg bg-white border border-[#CBD5E1] font-mono text-[11px] text-[#0066FF] mt-1 font-semibold">
                            {selectedMessageDetail.sample}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Raw DLR / Gateway Response */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                      Gateway & DLR Record
                    </h5>
                    <pre className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-mono text-[#0A2540] overflow-x-auto max-h-48">
                      {JSON.stringify(
                        selectedMessageDetail.dlrDetails ||
                          selectedMessageDetail.rawGatewayResponse ||
                          selectedMessageDetail,
                        null,
                        2
                      )}
                    </pre>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                    {selectedMessageDetail.campaignId && (
                      <button
                        onClick={() => handleSyncSingleDlr(selectedMessageDetail.campaignId)}
                        disabled={syncingDlrId === String(selectedMessageDetail.campaignId)}
                        className="max-sm:min-h-11 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#0A2540] text-xs font-semibold border border-[#CBD5E1] transition flex items-center gap-1.5 shadow-sm"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            syncingDlrId === String(selectedMessageDetail.campaignId)
                              ? "animate-spin text-[#0066FF]"
                              : "text-slate-500"
                          }`}
                        />
                        <span>Sync Live Status from MessageBot</span>
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedMessageDetail(null)}
                      className="max-sm:min-h-11 px-4 py-2 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white text-xs font-semibold transition shadow-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DELIVERY REPORTS (DLR) */}
        {activeTab === "dlr" && (
          <div className="space-y-6">
            <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-4 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-[#0A2540] flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[#0066FF]" />
                    WhatsApp Delivery Report (DLR)
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Query real-time delivery status, read receipts, and billing cost by Campaign ID
                  </p>
                </div>
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE]">
                  POST /Whatsapp/GetDlrDetails
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Enter WhatsApp Campaign ID (e.g. 2308 or from recent send)"
                  value={dlrCampaignId}
                  onChange={(e) => setDlrCampaignId(e.target.value)}
                  className="max-sm:min-h-11 flex-1 bg-white border border-[#CBD5E1] rounded-xl px-4 py-2.5 max-sm:text-base text-sm text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-mono transition shadow-sm font-medium"
                />
                <button
                  onClick={() => handleFetchDlr()}
                  disabled={loadingDlr || !dlrCampaignId}
                  className="max-sm:min-h-11 px-6 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white font-semibold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {loadingDlr ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>Fetch DLR Status</span>
                </button>
              </div>

              {dlrError && (
                <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#B91C1C] shrink-0" />
                  <span className="font-medium">{dlrError}</span>
                </div>
              )}

              {dlrData && (
                <div className="space-y-4 pt-2">
                  {/* Summary KPI Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] shadow-sm">
                      <div className="text-xs text-[#64748B] font-semibold">Total Messages Sent</div>
                      <div className="text-2xl font-bold font-mono text-[#0A2540] mt-1">
                        {dlrData.TotalSms}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] shadow-sm">
                      <div className="text-xs text-[#15803D] font-semibold">Campaign Cost</div>
                      <div className="text-2xl font-bold font-mono text-[#15803D] mt-1">
                        {dlrData.TotalCost} {dlrData.Currency || "INR"}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-[#EAF3FF] border border-[#BFDBFE] shadow-sm">
                      <div className="text-xs text-[#0052CC] font-semibold">Status Breakdown</div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {dlrData.CampaignStatus?.map((item: any, idx: number) => (
                          <span
                            key={idx}
                            className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                              item.DlrStatus === "Read"
                                ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]"
                                : item.DlrStatus === "Delivered"
                                ? "bg-[#CCFBF1] text-[#0F766E] border border-[#99F6E4]"
                                : "bg-white text-[#0052CC] border border-[#BFDBFE]"
                            }`}
                          >
                            {item.DlrStatus}: {item.NumberofSms}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Status table */}
                  <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-x-auto shadow-sm">
                    <table className="w-full min-w-[640px] text-left text-xs">
                      <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="px-4 py-3">Delivery Status</th>
                          <th className="px-4 py-3">Number of Messages</th>
                          <th className="px-4 py-3 text-right">Receipt Indicator</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] font-mono">
                        {dlrData.CampaignStatus?.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-[#F8FAFC]/80 transition">
                            <td className="px-4 py-3 font-semibold text-[#0A2540]">
                              {item.DlrStatus}
                            </td>
                            <td className="px-4 py-3 text-[#3C4F69] font-medium">{item.NumberofSms}</td>
                            <td className="px-4 py-3 text-right">
                              {item.DlrStatus === "Read" && (
                                <span className="text-[#15803D] font-bold">✓✓ Read</span>
                              )}
                              {item.DlrStatus === "Delivered" && (
                                <span className="text-[#0D9488] font-bold">✓✓ Delivered</span>
                              )}
                              {item.DlrStatus !== "Read" && item.DlrStatus !== "Delivered" && (
                                <span className="text-[#64748B]">✓ Sent</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: CAMPAIGNS */}
        {activeTab === "campaigns" && (
          <div className="space-y-6">
            <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-4 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-[#0A2540] flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[#0066FF]" />
                    WhatsApp Campaign Details Inspector
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Query one or more Campaign IDs (comma separated) for scheduling, submission, and run details
                  </p>
                </div>
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE]">
                  POST /whatsapp/GetWhatsAppCampaignDetails
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="e.g. 2404, 2405 (comma-separated)"
                  value={campaignQueryIds}
                  onChange={(e) => setCampaignQueryIds(e.target.value)}
                  className="max-sm:min-h-11 flex-1 bg-white border border-[#CBD5E1] rounded-xl px-4 py-2.5 max-sm:text-base text-sm text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 font-mono transition shadow-sm font-medium"
                />
                <button
                  onClick={handleFetchCampaigns}
                  disabled={loadingCampaigns || !campaignQueryIds}
                  className="max-sm:min-h-11 px-6 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white font-semibold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {loadingCampaigns ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  <span>Query Campaigns</span>
                </button>
              </div>

              {campaignsError && (
                <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] font-medium">
                  {campaignsError}
                </div>
              )}

              {campaignsList.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {campaignsList.map((c: any) => (
                    <div
                      key={c.WhatsAppCampaignId}
                      className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold font-mono text-[#0A2540]">
                            #{c.WhatsAppCampaignId}
                          </span>
                          <span className="text-xs text-[#64748B] truncate max-w-[160px] font-medium">
                            {c.CampaignName || "Unnamed Campaign"}
                          </span>
                        </div>
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                            c.CampaignStatusName === "Completed"
                              ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]"
                              : "bg-[#EAF3FF] text-[#0066FF] border border-[#BFDBFE]"
                          }`}
                        >
                          {c.CampaignStatusName || "Status " + c.CampaignStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#E2E8F0]">
                        <div>
                          <span className="text-[#64748B] block text-[11px] font-semibold">Audience</span>
                          <span className="font-semibold text-[#0A2540]">
                            {c.TotalAudience || 1} Recipients
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[11px] font-semibold">Submitted At</span>
                          <span className="font-mono text-[#3C4F69] text-[11px]">
                            {c.SubmittedDateTime || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[11px] font-semibold">Execution Date</span>
                          <span className="font-mono text-[#3C4F69] text-[11px]">
                            {c.FirstRunDateTime || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[11px] font-semibold">Scheduled?</span>
                          <span className="font-semibold text-[#0A2540]">
                            {c.IsScheduled ? "Yes" : "Immediate"}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => {
                            setActiveTab("dlr");
                            setDlrCampaignId(String(c.WhatsAppCampaignId));
                            handleFetchDlr(String(c.WhatsAppCampaignId));
                          }}
                          className="max-sm:min-h-11 w-full py-2 rounded-xl bg-white hover:bg-slate-50 border border-[#CBD5E1] text-xs text-[#0066FF] font-semibold transition flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>View Full DLR Breakdown</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: TEMPLATES STUDIO */}
        {activeTab === "templates" && (
          <div className="space-y-6">
            <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-4 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-[#0A2540] flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#0066FF]" />
                    WhatsApp Template Studio
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Browse Meta-approved templates, inspect approval status, and submit new templates
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={fetchTemplates}
                    disabled={loadingTemplates}
                    className="max-sm:min-h-11 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#0A2540] text-xs font-semibold border border-[#CBD5E1] transition flex items-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${loadingTemplates ? "animate-spin text-[#0066FF]" : "text-slate-500"}`}
                    />
                    <span>Refresh Templates</span>
                  </button>
                  <button
                    onClick={() => setShowAddTemplateModal(true)}
                    className="max-sm:min-h-11 px-3.5 py-2 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Template</span>
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder="Filter templates by name or ID..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="max-sm:min-h-11 flex-1 bg-white border border-[#CBD5E1] rounded-xl px-4 py-2.5 max-sm:text-base text-xs text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 w-full shadow-sm font-medium"
                />
                <select
                  value={templateCategoryFilter}
                  onChange={(e) => setTemplateCategoryFilter(e.target.value)}
                  className="max-sm:min-h-11 bg-white border border-[#CBD5E1] rounded-xl px-3 py-2.5 max-sm:text-base text-xs text-[#0A2540] font-medium focus:outline-none focus:border-[#0066FF] shrink-0 shadow-sm"
                >
                  <option value="all">All Categories</option>
                  <option value="Utility">Utility</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Authentication">Authentication</option>
                </select>
              </div>

              {/* Main Template Split Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                {/* Template List */}
                <div className="lg:col-span-5 space-y-2 max-h-[550px] overflow-y-auto pr-1">
                  {loadingTemplates ? (
                    <div className="py-12 text-center text-xs text-[#64748B]">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0066FF]" />
                      Loading templates from MessageBot gateway...
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#64748B] bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0]">
                      No templates found matching your filters.
                    </div>
                  ) : (
                    filteredTemplates.map((t) => {
                      const isSelected = selectedTemplate?.WhatsAppTemplateId === t.WhatsAppTemplateId;
                      return (
                        <div
                          key={t.WhatsAppTemplateId}
                          onClick={() => setSelectedTemplate(t)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? "bg-[#EAF3FF] border-[#0066FF] shadow-sm ring-1 ring-[#0066FF]/20"
                              : "bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-white"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-[#0A2540] font-mono">
                              {t.TemplateName}
                            </span>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                t.TemplateStatusDescription === "APPROVED"
                                  ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]"
                                  : "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]"
                              }`}
                            >
                              {t.TemplateStatusDescription}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B] font-medium">
                            <span>ID: #{t.WhatsAppTemplateId}</span>
                            <span>{t.TemplateCategory || "Utility"}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Selected Template Preview */}
                <div className="lg:col-span-7 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-5 space-y-4 shadow-sm">
                  {selectedTemplate ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
                        <div>
                          <h4 className="text-sm font-bold text-[#0A2540] font-mono">
                            {selectedTemplate.TemplateName}
                          </h4>
                          <span className="text-xs text-[#64748B] font-medium">
                            WhatsApp Template ID: #{selectedTemplate.WhatsAppTemplateId}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setActiveTab("send");
                              const tplId = String(selectedTemplate.WhatsAppTemplateId);
                              setMsgTemplateId(tplId);
                              if (tplId === "72" && !msgSample) {
                                setMsgSample("Rahul, 50000, 25000, CreditExpert");
                              } else if (tplId === "69" && !msgSample) {
                                setMsgSample("Rahul");
                              } else if (tplId === "71" && !msgSample) {
                                setMsgSample("Rahul, 50000, 25000, Bank, Manager");
                              }
                            }}
                            className="max-sm:min-h-11 px-3.5 py-1.5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Use in Send Message</span>
                          </button>
                        </div>
                      </div>

                      {/* Mockup Chat Bubble */}
                      <div className="max-w-md mx-auto bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-md space-y-2 relative">
                        {/* Image / Media Header Indicator */}
                        {(selectedTemplate.TemplateTypeDescription?.toLowerCase() === "image" ||
                          selectedTemplate.TemplateType === 2) && (
                          <div className="w-full h-32 rounded-xl bg-[#EAF3FF] border border-[#BFDBFE] flex flex-col items-center justify-center text-[#0066FF] gap-1.5 mb-2">
                            <ImageIcon className="w-8 h-8 text-[#0066FF]" />
                            <span className="text-[11px] font-semibold text-[#0066FF]">
                              Image Header (File Upload Required)
                            </span>
                            <span className="text-[11px] text-[#0066FF] font-mono">
                              Template #{selectedTemplate.WhatsAppTemplateId}
                            </span>
                          </div>
                        )}

                        {/* Header Text */}
                        {selectedTemplate.HeaderText && (
                          <div className="font-bold text-xs text-[#0A2540] pb-1">
                            {selectedTemplate.HeaderText}
                          </div>
                        )}

                        {/* Body Text */}
                        <div className="text-xs text-[#3C4F69] leading-relaxed whitespace-pre-wrap font-sans">
                          {selectedTemplate.BodyText ||
                            "No body text provided in template response."}
                        </div>

                        {/* Footer */}
                        {selectedTemplate.FooterText && (
                          <div className="text-[11px] text-[#94A3B8] pt-1">
                            {selectedTemplate.FooterText}
                          </div>
                        )}

                        {/* Button Action */}
                        {selectedTemplate.ButtonText && (
                          <div className="pt-2 border-t border-[#E2E8F0]">
                            <div className="w-full py-1.5 rounded-lg bg-[#EAF3FF] border border-[#BFDBFE] text-[#0066FF] text-xs font-semibold flex items-center justify-center gap-1">
                              <ExternalLink className="w-3 h-3" />
                              <span>{selectedTemplate.ButtonText}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Metadata Table */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                        <div className="p-2.5 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs">
                          <span className="text-[#64748B] block text-[11px] font-semibold">Meta FB ID</span>
                          <span className="font-mono text-[#0A2540] text-[11px] truncate block font-medium">
                            {selectedTemplate.FbTemplateId || "N/A"}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs">
                          <span className="text-[#64748B] block text-[11px] font-semibold">Language</span>
                          <span className="text-[#0A2540] font-medium">
                            {selectedTemplate.Language || "English"}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs">
                          <span className="text-[#64748B] block text-[11px] font-semibold">Registered Number</span>
                          <span className="font-mono text-[#0A2540] font-medium">
                            {selectedTemplate.WhatsAppNo || "Default Business"}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs">
                          <span className="text-[#64748B] block text-[11px] font-semibold">Created On</span>
                          <span className="font-mono text-[#0A2540] text-[11px] font-medium">
                            {selectedTemplate.CreateDateTime || "-"}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-20 text-center text-xs text-[#64748B]">
                      Select a template from the list to preview details and WhatsApp bubble rendering.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: SETUP & THINGS TO SETUP */}
        {activeTab === "setup" && (
          <div className="space-y-6">
            <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-4 sm:p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-bold text-[#0A2540] flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#0066FF]" />
                  Integration Setup & Requirements
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Checklist of required credentials, templates, and environment variables to activate full production WhatsApp messaging
                </p>
              </div>

              {/* Status Verification Checklist */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Environment Configuration Status
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Item 1 */}
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3 shadow-2xs">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        status?.hasToken
                          ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]"
                          : "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]"
                      }`}
                    >
                      {status?.hasToken ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#0A2540]">
                        MESSAGEBOT_WHATSAPP_API_TOKEN
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-0.5 font-medium">
                        {status?.hasToken
                          ? `Configured via ${status.tokenSource} (${status.maskedToken})`
                          : "Missing in .env! Required to authenticate all WhatsApp REST endpoints."}
                      </div>
                    </div>
                  </div>

                  {/* Item 2 */}
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3 shadow-2xs">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        status?.otpTemplateId
                          ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]"
                          : "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#0A2540]">
                        MESSAGEBOT_WHATSAPP_OTP_TEMPLATE_ID
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-0.5 font-medium">
                        Active: Template ID #{status?.otpTemplateId || "3"}. Registered in MessageBot authentication category.
                      </div>
                    </div>
                  </div>

                  {/* Item 3 */}
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3 shadow-2xs">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        status?.businessNumber
                          ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]"
                          : "bg-slate-100 text-[#64748B] border border-slate-200"
                      }`}
                    >
                      {status?.businessNumber ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Phone className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#0A2540]">
                        MESSAGEBOT_WHATSAPP_BUSINESS_NUMBER
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-0.5 font-medium">
                        {status?.businessNumber
                          ? `Registered: ${status.businessNumber}`
                          : "Optional/Default. Required when creating new templates via API."}
                      </div>
                    </div>
                  </div>

                  {/* Item 4 */}
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3 shadow-2xs">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        status?.callbackUrl
                          ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]"
                          : "bg-slate-100 text-[#64748B] border border-slate-200"
                      }`}
                    >
                      {status?.callbackUrl ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Globe className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#0A2540]">
                        MESSAGEBOT_WHATSAPP_CALLBACK_URL
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-0.5 font-medium">
                        {status?.callbackUrl
                          ? `Webhook: ${status.callbackUrl}`
                          : "Optional. Webhook endpoint to receive real-time delivery status."}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sample .env block */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Recommended .env Configuration
                  </h4>
                  <button
                    onClick={() =>
                      handleCopy(
                        `# MessageBot WhatsApp Gateway\nMESSAGEBOT_WHATSAPP_API_TOKEN=""\nMESSAGEBOT_WHATSAPP_BASE_URL="https://papi.messagebot.in"\nMESSAGEBOT_WHATSAPP_OTP_TEMPLATE_ID="3"\nMESSAGEBOT_WHATSAPP_BUSINESS_NUMBER="91XXXXXXXXXX"\nMESSAGEBOT_WHATSAPP_CALLBACK_URL="https://creditexpertindia.com/api/whatsapp/callback"`,
                        "env"
                      )
                    }
                    className="max-sm:min-h-11 text-xs text-[#0066FF] hover:text-[#0052cc] font-semibold flex items-center gap-1 transition"
                  >
                    {copiedKey === "env" ? (
                      <>
                        <Check className="w-3 h-3 text-[#15803D]" />
                        <span className="text-[#15803D]">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Snippet</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-[#0A2540] border border-[#0A2540] text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed shadow-inner">
                  {`# MessageBot WhatsApp Gateway
MESSAGEBOT_WHATSAPP_API_TOKEN="<YOUR_MESSAGEBOT_API_TOKEN>"
MESSAGEBOT_WHATSAPP_BASE_URL="https://papi.messagebot.in"
MESSAGEBOT_WHATSAPP_OTP_TEMPLATE_ID="3"
MESSAGEBOT_WHATSAPP_BUSINESS_NUMBER="919906785432"
MESSAGEBOT_WHATSAPP_CALLBACK_URL="https://creditexpertindia.com/api/whatsapp/callback"`}
                </pre>
              </div>

              {/* Step-by-Step Prerequisites */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  4 Steps to Complete Production WhatsApp Onboarding
                </h4>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3 shadow-2xs">
                    <span className="w-6 h-6 rounded-full bg-[#0066FF] text-white font-bold text-xs flex items-center justify-center shrink-0">
                      1
                    </span>
                    <div className="text-xs text-[#64748B]">
                      <span className="font-bold text-[#0A2540] block mb-0.5">
                        Log in to MessageBot Portal (www.messagebot.in)
                      </span>
                      Navigate to API Credentials and copy your unique WhatsApp API Token. (Note:
                      If you already use the SMS gateway, verify if your account uses the same or a
                      separate WhatsApp token).
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3 shadow-2xs">
                    <span className="w-6 h-6 rounded-full bg-[#0066FF] text-white font-bold text-xs flex items-center justify-center shrink-0">
                      2
                    </span>
                    <div className="text-xs text-[#64748B]">
                      <span className="font-bold text-[#0A2540] block mb-0.5">
                        Submit WhatsApp Template for Approval
                      </span>
                      In the MessageBot Template section (or via our Template Studio tab), register
                      your Authentication / OTP template. Meta typically approves utility & OTP
                      templates within 15–60 minutes.
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3 shadow-2xs">
                    <span className="w-6 h-6 rounded-full bg-[#0066FF] text-white font-bold text-xs flex items-center justify-center shrink-0">
                      3
                    </span>
                    <div className="text-xs text-[#64748B]">
                      <span className="font-bold text-[#0A2540] block mb-0.5">
                        Save Your Approved Template ID
                      </span>
                      Once approved by Meta, copy the numeric Template ID and set it as{" "}
                      <code className="text-[#0066FF] font-semibold bg-[#EAF3FF] px-1.5 py-0.5 rounded border border-[#BFDBFE]">
                        MESSAGEBOT_WHATSAPP_OTP_TEMPLATE_ID
                      </code>{" "}
                      in your <code className="text-[#0066FF] font-semibold bg-[#EAF3FF] px-1.5 py-0.5 rounded border border-[#BFDBFE]">.env</code>.
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3 shadow-2xs">
                    <span className="w-6 h-6 rounded-full bg-[#0066FF] text-white font-bold text-xs flex items-center justify-center shrink-0">
                      4
                    </span>
                    <div className="text-xs text-[#64748B]">
                      <span className="font-bold text-[#0A2540] block mb-0.5">
                        Test Real Dispatch in the Hub
                      </span>
                      Use the &quot;Send OTP&quot; or &quot;Send Message&quot; tabs to send a test message to your personal
                      mobile number. Check the live delivery report (DLR) to verify read receipts and
                      delivered status!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CREATE TEMPLATE */}
        {showAddTemplateModal && (
          <div className="fixed inset-0 z-50 bg-[#0A2540]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white border border-[#E2E8F0] rounded-[24px] max-w-lg w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
                <h3 className="text-sm font-bold text-[#0A2540] flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#0066FF]" />
                  Submit New WhatsApp Template
                </h3>
                <button
                  onClick={() => setShowAddTemplateModal(false)}
                  className="max-sm:min-h-11 text-slate-400 hover:text-[#0A2540] text-lg font-bold"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleAddTemplate} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-[#0A2540] mb-1">
                    Template Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. eligibility_otp_verification"
                    value={newTemplate.templateName}
                    onChange={(e) =>
                      setNewTemplate({ ...newTemplate, templateName: e.target.value })
                    }
                    required
                    className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-[#0A2540] font-mono placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 shadow-sm font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#0A2540] mb-1">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newTemplate.templateCategoryId}
                      onChange={(e) =>
                        setNewTemplate({
                          ...newTemplate,
                          templateCategoryId: Number(e.target.value) as 1 | 2 | 3,
                        })
                      }
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-[#0A2540] focus:outline-none focus:border-[#0066FF] shadow-sm font-medium"
                    >
                      <option value={2}>Utility (2)</option>
                      <option value={1}>Marketing (1)</option>
                      <option value={3}>Authentication (3)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#0A2540] mb-1">
                      Format <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newTemplate.componentFormatId}
                      onChange={(e) =>
                        setNewTemplate({
                          ...newTemplate,
                          componentFormatId: Number(e.target.value) as 1 | 2 | 3 | 4,
                        })
                      }
                      className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-[#0A2540] focus:outline-none focus:border-[#0066FF] shadow-sm font-medium"
                    >
                      <option value={1}>Text (1)</option>
                      <option value={2}>Image (2)</option>
                      <option value={3}>Video (3)</option>
                      <option value={4}>Document (4)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#0A2540] mb-1">
                    Registered WhatsApp Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 919906785432"
                    value={newTemplate.customerWhatsAppNumber}
                    onChange={(e) =>
                      setNewTemplate({
                        ...newTemplate,
                        customerWhatsAppNumber: e.target.value,
                      })
                    }
                    required
                    className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-[#0A2540] font-mono placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 shadow-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#0A2540] mb-1">Header Text</label>
                  <input
                    type="text"
                    placeholder="e.g. Credit Expert India Notification"
                    value={newTemplate.headerText}
                    onChange={(e) =>
                      setNewTemplate({ ...newTemplate, headerText: e.target.value })
                    }
                    className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 shadow-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#0A2540] mb-1">
                    Body Text <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Hello {{1}}, your verification code is {{2}}."
                    value={newTemplate.bodyText}
                    onChange={(e) =>
                      setNewTemplate({ ...newTemplate, bodyText: e.target.value })
                    }
                    required
                    className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 shadow-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#0A2540] mb-1">Footer Text</label>
                  <input
                    type="text"
                    placeholder="e.g. Thank you for choosing Credit Expert India"
                    value={newTemplate.footerText}
                    onChange={(e) =>
                      setNewTemplate({ ...newTemplate, footerText: e.target.value })
                    }
                    className="max-sm:min-h-11 w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-[#0A2540] placeholder-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 shadow-sm font-medium"
                  />
                </div>

                {templateSubmitResult && (
                  <div
                    className={`p-3.5 rounded-xl text-xs font-medium ${
                      templateSubmitResult.success
                        ? "bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D]"
                        : "bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C]"
                    }`}
                  >
                    {templateSubmitResult.success
                      ? templateSubmitResult.message || "Template submitted successfully!"
                      : templateSubmitResult.error}
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowAddTemplateModal(false)}
                    className="max-sm:min-h-11 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#64748B] hover:text-[#0A2540] border border-[#CBD5E1] text-xs font-semibold shadow-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTemplate}
                    className="max-sm:min-h-11 px-5 py-2 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white font-semibold text-xs shadow-sm flex items-center gap-1.5 transition"
                  >
                    {submittingTemplate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Submit Template</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
