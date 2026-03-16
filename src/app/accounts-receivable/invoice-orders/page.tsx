"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Upload,
    Download,
    Search,
    ArrowUpDown,
    Trash2,
    Pencil,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    FileText,
    Loader2,
    X,
    Eye,
    Filter,
    ArrowUp,
    ArrowDown,
    Zap,
    Settings2,
    Columns,
    Check,
    CalendarRange,
    Mail,
    ArrowRightLeft,
    Plus,
    CalendarIcon
} from "lucide-react";
import * as XLSX from "xlsx";
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, subYears } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { ScopeSelector } from "@/components/app/scope-selector";
import { type ScopeType, matchesScope } from "@/lib/scope-utils";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { PageHeader } from "@/components/ui/page-header";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Interface para Invoice Order (dados do CSV)
interface InvoiceOrder {
    id: string;
    invoice_id: string;
    invoice_number: string;
    order_id: string | null;
    order_number: string | null;
    date: string;
    description: string;
    amount: number;
    currency: string;
    reconciled: boolean;
    source: string;
    custom_data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

// Colunas disponíveis para exibição
interface ColumnConfig {
    key: string;
    label: string;
    visible: boolean;
    width?: string;
}

// Row parsed from upload API (not yet saved)
interface ParsedUploadRow {
    invoiceNumber: string;
    invoiceId: string;
    date: string;
    amount: number;
    description: string;
    orderNumber: string | null;
    currency: string;
    customerName: string;
    customerEmail: string;
    suggestedFA: string | null;
    suggestedFAName: string | null;
    faSource: "prior_mapping" | "keyword" | "none";
    customData: Record<string, unknown>;
}

interface DuplicateOverwrite {
    invoiceNumber: string;
    existingId: string;
}

interface ProductGroup {
    description: string;
    count: number;
    totalAmount: number;
    sampleDate: string;
    suggestedFA: string | null;
    faSource: "prior_mapping" | "keyword" | "none";
    indices: number[];
}

// ── FA Code Options ──
const FA_OPTIONS_POPUP1 = [
    { code: "101.1", label: "101.1 — DSD Course" },
    { code: "101.2", label: "101.2 — Others Courses" },
    { code: "101.3", label: "101.3 — Mastership" },
    { code: "101.4", label: "101.4 — PC Membership" },
    { code: "101.5", label: "101.5 — Partnerships" },
    { code: "102.0", label: "102.0 — Delight" },
    { code: "102.5", label: "102.5 — Consultancies" },
    { code: "102.6", label: "102.6 — Marketing Coaching" },
    { code: "102.7", label: "102.7 — Others" },
    { code: "103.0", label: "103.0 — Planning Center" },
    { code: "104.0", label: "104.0 — LAB" },
    { code: "105.1", label: "105.1 — Level 1" },
    { code: "105.2", label: "105.2 — CORE Partnerships" },
    { code: "105.3", label: "105.3 — Study Club" },
    { code: "105.4", label: "105.4 — Other Marketing Revenues" },
] as const;

const DELIGHT_SUB_OPTIONS = [
    { code: "102.1", label: "102.1 — Contracted ROW" },
    { code: "102.2", label: "102.2 — Contracted AMEX" },
    { code: "102.3", label: "102.3 — Level 3 New ROW" },
    { code: "102.4", label: "102.4 — Level 3 New AMEX" },
    { code: "102.5", label: "102.5 — Consultancies" },
    { code: "102.6", label: "102.6 — Marketing Coaching" },
    { code: "102.7", label: "102.7 — Others" },
] as const;

// Client classification → LAB/PC sub-account mapping
// Delight sub-codes + Level 1 + PC Membership determine LAB/PC sub-accounts
const CLIENT_TO_LAB_PC: Record<string, { lab: string; pc: string }> = {
    "102.1": { lab: "104.1", pc: "103.1" },
    "102.2": { lab: "104.2", pc: "103.2" },
    "102.3": { lab: "104.3", pc: "103.3" },
    "102.4": { lab: "104.4", pc: "103.4" },
    "101.4": { lab: "104.5", pc: "103.5" },  // PC Membership → Level 2
    "105.1": { lab: "104.6", pc: "103.6" },  // Level 1 → Level 1
};

// Full FA name lookup
const FA_NAMES: Record<string, string> = {
    "101.1": "DSD Course", "101.2": "Others Courses", "101.3": "Mastership",
    "101.4": "PC Membership", "101.5": "Partnerships",
    "102.0": "Delight", "102.1": "Contracted ROW", "102.2": "Contracted AMEX",
    "102.3": "Level 3 New ROW", "102.4": "Level 3 New AMEX",
    "102.5": "Consultancies", "102.6": "Marketing Coaching", "102.7": "Others",
    "103.0": "Planning Center", "103.1": "Level 3 ROW", "103.2": "Level 3 AMEX",
    "103.3": "Level 3 New ROW", "103.4": "Level 3 New AMEX",
    "103.5": "Level 2", "103.6": "Level 1", "103.7": "Not a Subscriber",
    "104.0": "LAB", "104.1": "Level 3 ROW", "104.2": "Level 3 AMEX",
    "104.3": "Level 3 New ROW", "104.4": "Level 3 New AMEX",
    "104.5": "Level 2", "104.6": "Level 1", "104.7": "Not a Subscriber",
    "105.1": "Level 1", "105.2": "CORE Partnerships",
    "105.3": "Study Club", "105.4": "Other Marketing Revenues",
};

const DEFAULT_COLUMNS: ColumnConfig[] = [
    { key: "invoice_date", label: "Invoice Date", visible: true, width: "100px" },
    { key: "invoice_number", label: "Invoice", visible: true, width: "130px" },
    { key: "order_date", label: "Order Date", visible: true, width: "100px" },
    { key: "order_number", label: "Order", visible: true, width: "110px" },
    { key: "order_status", label: "Order Status", visible: true, width: "100px" },
    { key: "description", label: "Products", visible: true, width: "200px" },
    { key: "client", label: "Client", visible: true, width: "150px" },
    { key: "email", label: "Email", visible: true, width: "180px" },
    { key: "discount", label: "Discount", visible: true, width: "90px" },
    { key: "amount", label: "Total", visible: true, width: "100px" },
    { key: "currency", label: "Currency", visible: true, width: "70px" },
    { key: "financial_account", label: "Fin. Account", visible: false, width: "120px" },
    { key: "reconciled", label: "Status", visible: false, width: "100px" }
];

function formatEuropeanNumber(value: number, decimals: number = 2): string {
    return value.toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatDate(date: string | null): string {
    if (!date) return "-";
    const d = new Date(date);
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
}

export default function InvoiceOrdersPage() {
    const { selectedScope, setSelectedScope } = useGlobalScope();
    const [invoiceOrders, setInvoiceOrders] = useState<InvoiceOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortField, setSortField] = useState<string>("date");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [showReconciled, setShowReconciled] = useState(true);
    const [selectedRow, setSelectedRow] = useState<InvoiceOrder | null>(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [reconciling, setReconciling] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number | "all">("all");

    // Column filters
    const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
    const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);
    const [dateFilterOpen, setDateFilterOpen] = useState(false);
    const [filterInvoice, setFilterInvoice] = useState("");
    const [filterOrder, setFilterOrder] = useState("");
    const [filterDescription, setFilterDescription] = useState("");
    const [filterClient, setFilterClient] = useState("");
    const [filterEmail, setFilterEmail] = useState("");
    const [filterFA, setFilterFA] = useState("");
    const [filterCurrency, setFilterCurrency] = useState("");
    const [filterOrderStatus, setFilterOrderStatus] = useState("");
    const [filterStatus, setFilterStatus] = useState("");

    // Edit dialog
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingRow, setEditingRow] = useState<InvoiceOrder | null>(null);
    const [editForm, setEditForm] = useState<{
        date: string; description: string; amount: string;
        financial_account_code: string; customer_name: string; customer_email: string;
    }>({ date: "", description: "", amount: "", financial_account_code: "", customer_name: "", customer_email: "" });
    const [saving, setSaving] = useState(false);

    // Add manual dialog
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [addForm, setAddForm] = useState({
        date: "", order_date: "", description: "", amount: "", discount: "",
        currency: "EUR", financial_account_code: "",
        customer_name: "", customer_email: "", company: "",
        invoice_number: "", order_number: "",
        country: "", payment_method: "", billing_entity: "",
        order_status: "", charged: "",
    });
    const ADD_FORM_EMPTY = {
        date: "", order_date: "", description: "", amount: "", discount: "",
        currency: "EUR", financial_account_code: "",
        customer_name: "", customer_email: "", company: "",
        invoice_number: "", order_number: "",
        country: "", payment_method: "", billing_entity: "",
        order_status: "", charged: "",
    };
    const [page, setPage] = useState(1);
    const [totalRows, setTotalRows] = useState(0);
    const PAGE_SIZE = 200;

    // Column visibility
    const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
    const [allCustomColumns, setAllCustomColumns] = useState<ColumnConfig[]>([]);

    // ── Upload Classification Popups ──
    const [uploadedRows, setUploadedRows] = useState<ParsedUploadRow[]>([]);
    const [duplicateOverwrites, setDuplicateOverwrites] = useState<DuplicateOverwrite[]>([]);
    const [classifyDialogOpen, setClassifyDialogOpen] = useState(false);
    const [delightDialogOpen, setDelightDialogOpen] = useState(false);
    const [rowFACodes, setRowFACodes] = useState<Record<number, string>>({}); // index → FA code
    const [delightCodes, setDelightCodes] = useState<Record<number, string>>({}); // index → delight sub-code
    const [clientHistory, setClientHistory] = useState<Record<string, string>>({}); // clientKey → prior 102.x code
    const [classifying, setClassifying] = useState(false);
    const [annualizeFlags, setAnnualizeFlags] = useState<Record<number, boolean>>({}); // index → annualize toggle
    const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
    const [productFACodes, setProductFACodes] = useState<Record<number, string>>({});
    const [annualizeDialogOpen, setAnnualizeDialogOpen] = useState(false);
    const [annualizeFilterFA, setAnnualizeFilterFA] = useState<string>("all");
    const [annualizeFilterProduct, setAnnualizeFilterProduct] = useState<string>("all");
    const [annualizedPreviews, setAnnualizedPreviews] = useState<Record<number, { date: string; installment: string }[]>>({});

    // ── Popup table sorting (shared pattern) ──
    const [popupSortField, setPopupSortField] = useState<string>("");
    const [popupSortDir, setPopupSortDir] = useState<"asc" | "desc">("asc");
    const handlePopupSort = (field: string) => {
        if (popupSortField === field) setPopupSortDir(popupSortDir === "asc" ? "desc" : "asc");
        else { setPopupSortField(field); setPopupSortDir("asc"); }
    };

    // ── Popup 0: Email Resolution ──
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [missingEmailClients, setMissingEmailClients] = useState<{ name: string; email: string; foundInDB: string | null; rowIndices: number[] }[]>([]);
    const [emailSearching, setEmailSearching] = useState(false);

    // ── Popup 4: LAB/PC Reallocation Review ──
    const [labPcDialogOpen, setLabPcDialogOpen] = useState(false);
    const [labPcReallocations, setLabPcReallocations] = useState<{ rowIndex: number; clientName: string; clientEmail: string; product: string; amount: number; date: string; originalCode: string; newCode: string; clientClass: string }[]>([]);
    const [pendingUpdatedCodes, setPendingUpdatedCodes] = useState<Record<number, string>>({});

    // Load data
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // First get total count
            let countQuery = supabase
                .from("csv_rows")
                .select("*", { count: "exact", head: true })
                .eq("source", "invoice-orders");

            if (selectedYear !== "all") {
                countQuery = countQuery
                    .gte("date", `${selectedYear}-01-01`)
                    .lte("date", `${selectedYear}-12-31`);
            }

            const { count } = await countQuery;
            setTotalRows(count || 0);

            // Then fetch paginated data
            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            let query = supabase
                .from("csv_rows")
                .select("*")
                .eq("source", "invoice-orders")
                .order("date", { ascending: false })
                .range(from, to);

            if (selectedYear !== "all") {
                query = query
                    .gte("date", `${selectedYear}-01-01`)
                    .lte("date", `${selectedYear}-12-31`);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            const mappedData: InvoiceOrder[] = (data || []).map((row) => ({
                id: row.id,
                invoice_id: row.custom_data?.ID || row.id,
                invoice_number: row.custom_data?.Number || row.description || "",
                order_id: row.custom_data?.order_id || null,
                order_number: row.custom_data?.order_number || null,
                date: row.date,
                description: row.description || "",
                amount: parseFloat(row.amount) || 0,
                currency: row.custom_data?.currency || "EUR",
                reconciled: row.reconciled || false,
                source: row.source,
                custom_data: row.custom_data || {},
                created_at: row.created_at,
                updated_at: row.updated_at
            }));

            setInvoiceOrders(mappedData);

            // Extract custom columns from first row
            if (mappedData.length > 0 && mappedData[0].custom_data) {
                const customKeys = Object.keys(mappedData[0].custom_data).filter(
                    (key) =>
                        !["ID", "Number", "order_id", "order_number", "currency", "file_name", "row_index"].includes(key)
                );
                const customCols: ColumnConfig[] = customKeys.map((key) => ({
                    key: `custom_${key}`,
                    label: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
                    visible: false,
                    width: "120px"
                }));
                setAllCustomColumns(customCols);
            }
        } catch (err) {
            console.error("Error loading data:", err);
            setError("Error loading data");
        } finally {
            setLoading(false);
        }
    }, [page, selectedYear]);

    useEffect(() => {
        loadData();
    }, [page, selectedYear]);

    // Handle file upload — now opens classification popup instead of directly inserting
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/csv/invoice-orders", {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                toast({
                    title: "Upload error",
                    description: result.error || "Unknown error",
                    variant: "destructive"
                });
                return;
            }

            const data = result.data;
            const parsed: ParsedUploadRow[] = data.parsedRows;
            const dupes: DuplicateOverwrite[] = data.duplicateOverwrites || [];

            // Build product groups
            const groupMap = new Map<string, ProductGroup>();
            for (let i = 0; i < parsed.length; i++) {
                const desc = parsed[i].description;
                if (groupMap.has(desc)) {
                    const g = groupMap.get(desc)!;
                    g.count++;
                    g.totalAmount += parsed[i].amount;
                    g.indices.push(i);
                    if (parsed[i].faSource === "prior_mapping" && g.faSource !== "prior_mapping") {
                        g.suggestedFA = parsed[i].suggestedFA;
                        g.faSource = parsed[i].faSource;
                    } else if (parsed[i].faSource === "keyword" && g.faSource === "none") {
                        g.suggestedFA = parsed[i].suggestedFA;
                        g.faSource = parsed[i].faSource;
                    }
                } else {
                    groupMap.set(desc, {
                        description: desc,
                        count: 1,
                        totalAmount: parsed[i].amount,
                        sampleDate: parsed[i].date,
                        suggestedFA: parsed[i].suggestedFA,
                        faSource: parsed[i].faSource,
                        indices: [i],
                    });
                }
            }
            const groups = [...groupMap.values()];

            // Initialize product FA codes from suggestions
            const initialProductCodes: Record<number, string> = {};
            for (let g = 0; g < groups.length; g++) {
                if (groups[g].suggestedFA) {
                    initialProductCodes[g] = groups[g].suggestedFA!;
                }
            }

            setProductGroups(groups);
            setProductFACodes(initialProductCodes);
            setUploadedRows(parsed);
            setDuplicateOverwrites(dupes);
            setRowFACodes({});
            setAnnualizeFlags({});
            setAnnualizedPreviews({});

            // Build client list for email review (always shown)
            const allClients = new Map<string, { email: string; indices: number[] }>();
            for (let i = 0; i < parsed.length; i++) {
                const name = parsed[i].customerName?.trim();
                if (!name) continue;
                if (!allClients.has(name)) {
                    allClients.set(name, { email: parsed[i].customerEmail?.trim() || "", indices: [] });
                }
                allClients.get(name)!.indices.push(i);
                // Keep first non-empty email found
                if (!allClients.get(name)!.email && parsed[i].customerEmail?.trim()) {
                    allClients.set(name, { ...allClients.get(name)!, email: parsed[i].customerEmail.trim() });
                }
            }

            // Search DB for prior emails for clients that are missing one
            setEmailSearching(true);
            const nameToEmail = new Map<string, string>();
            const hasMissing = [...allClients.values()].some(c => !c.email);
            if (hasMissing) {
                const { data: priorRows } = await supabase
                    .from("csv_rows")
                    .select("custom_data")
                    .eq("source", "invoice-orders")
                    .not("custom_data->customer_email", "is", null);

                if (priorRows) {
                    for (const r of priorRows) {
                        const cd = r.custom_data as Record<string, unknown> | null;
                        const priorName = (cd?.customer_name as string)?.trim()?.toLowerCase();
                        const priorEmail = (cd?.customer_email as string)?.trim();
                        if (priorName && priorEmail) {
                            nameToEmail.set(priorName, priorEmail);
                        }
                    }
                }
            }

            const clientEntries: typeof missingEmailClients = [];
            for (const [name, info] of allClients) {
                const csvEmail = info.email;
                const dbEmail = !csvEmail ? (nameToEmail.get(name.toLowerCase()) || null) : null;
                clientEntries.push({
                    name,
                    email: csvEmail || dbEmail || "",
                    foundInDB: dbEmail,
                    rowIndices: info.indices,
                });
            }

            setMissingEmailClients(clientEntries);
            setEmailSearching(false);
            setEmailDialogOpen(true);

            if (data.duplicateCount > 0) {
                toast({
                    title: `${data.duplicateCount} duplicates detected`,
                    description: "They will be updated (overwritten) upon confirmation."
                });
            }
        } catch (err) {
            console.error("Upload error:", err);
            toast({
                title: "Upload error",
                description: "Failed to upload the file",
                variant: "destructive"
            });
        } finally {
            setUploading(false);
            event.target.value = "";
        }
    };

    // ── Popup 0 → Confirm emails and proceed to Popup 1 ──
    const confirmEmails = () => {
        const incomplete = missingEmailClients.filter(c => !c.email.trim());
        if (incomplete.length > 0) {
            toast({
                title: "Missing emails",
                description: `${incomplete.length} client(s) still without email.`,
                variant: "destructive"
            });
            return;
        }

        // Apply emails to uploaded rows
        const updatedRows = [...uploadedRows];
        for (const client of missingEmailClients) {
            for (const idx of client.rowIndices) {
                updatedRows[idx] = { ...updatedRows[idx], customerEmail: client.email.trim() };
                if (updatedRows[idx].customData) {
                    updatedRows[idx].customData = { ...updatedRows[idx].customData, customer_email: client.email.trim() };
                }
            }
        }
        setUploadedRows(updatedRows);
        setEmailDialogOpen(false);
        setClassifyDialogOpen(true);
    };

    // ── Popup 1 → Next: apply product classifications to all rows, open Popup 2 ──
    const handleProductClassifyNext = () => {
        const unclassified = productGroups.filter((_, g) => !productFACodes[g]);
        if (unclassified.length > 0) {
            toast({
                title: "Incomplete classification",
                description: `${unclassified.length} products without a financial account.`,
                variant: "destructive"
            });
            return;
        }

        // Apply product FA codes to ALL individual rows
        const newRowFACodes: Record<number, string> = {};
        for (let g = 0; g < productGroups.length; g++) {
            const faCode = productFACodes[g];
            for (const rowIdx of productGroups[g].indices) {
                newRowFACodes[rowIdx] = faCode;
            }
        }
        setRowFACodes(newRowFACodes);
        setAnnualizeFlags({});
        setAnnualizedPreviews({});
        setAnnualizeFilterFA("all");
        setAnnualizeFilterProduct("all");
        setPopupSortField("");
        setPopupSortDir("asc");
        setClassifyDialogOpen(false);
        setAnnualizeDialogOpen(true);
    };

    // ── Popup 2 → Next: check for Delight or save ──
    const handleAnnualizeNext = async () => {
        const delightIndices = uploadedRows
            .map((_, i) => i)
            .filter((i) => rowFACodes[i] === "102.0");

        if (delightIndices.length > 0) {
            await fetchClientHistory(delightIndices);
            setAnnualizeDialogOpen(false);
            setPopupSortField(""); setPopupSortDir("asc");
            setDelightDialogOpen(true);
        } else {
            setAnnualizeDialogOpen(false);
            await saveWithAutoAssignment();
        }
    };

    // ── Toggle annualize preview with 12 installments ──
    const toggleAnnualizePreview = (rowIndex: number) => {
        const isCurrentlyOn = !!annualizeFlags[rowIndex];
        setAnnualizeFlags(prev => ({ ...prev, [rowIndex]: !isCurrentlyOn }));

        if (!isCurrentlyOn) {
            const row = uploadedRows[rowIndex];
            const baseDate = new Date(row.date + "T00:00:00Z");
            const baseMonth = baseDate.getUTCMonth();
            const baseYear = baseDate.getUTCFullYear();
            const baseDay = Math.min(baseDate.getUTCDate(), 28);

            const installments: { date: string; installment: string }[] = [];
            for (let m = 0; m < 12; m++) {
                const instMonth = baseMonth + m;
                const instYear = baseYear + Math.floor(instMonth / 12);
                const actualMonth = instMonth % 12;
                const instDate = `${instYear}-${String(actualMonth + 1).padStart(2, "0")}-${String(baseDay).padStart(2, "0")}`;
                installments.push({ date: instDate, installment: `${m + 1}/12` });
            }
            setAnnualizedPreviews(prev => ({ ...prev, [rowIndex]: installments }));
        } else {
            setAnnualizedPreviews(prev => {
                const next = { ...prev };
                delete next[rowIndex];
                return next;
            });
        }
    };

    // ── Fetch client history for Delight suggestion ──
    const fetchClientHistory = async (delightIndices: number[]) => {
        const clientKeys = new Set<string>();
        const clientEmails = new Set<string>();
        const clientNames = new Set<string>();

        for (const i of delightIndices) {
            const row = uploadedRows[i];
            if (row.customerEmail) clientEmails.add(row.customerEmail.toLowerCase());
            if (row.customerName) clientNames.add(row.customerName.toLowerCase());
        }

        // Query prior year 102.x classifications
        const currentYear = new Date().getFullYear();
        const priorYearStart = `${currentYear - 1}-01-01`;
        const priorYearEnd = `${currentYear - 1}-12-31`;

        const history: Record<string, string> = {};

        // Query by email first (more reliable)
        if (clientEmails.size > 0) {
            const emails = [...clientEmails];
            for (let i = 0; i < emails.length; i += 50) {
                const batch = emails.slice(i, i + 50);
                const { data } = await supabase
                    .from("csv_rows")
                    .select("custom_data")
                    .eq("source", "invoice-orders")
                    .gte("date", priorYearStart)
                    .lte("date", priorYearEnd)
                    .in("custom_data->>customer_email", batch)
                    .like("custom_data->>financial_account_code", "102.%");

                if (data) {
                    for (const row of data) {
                        const cd = row.custom_data as Record<string, unknown>;
                        const email = String(cd.customer_email || "").toLowerCase();
                        const faCode = String(cd.financial_account_code || "");
                        if (email && faCode.startsWith("102.") && faCode !== "102.0") {
                            history[`email:${email}`] = faCode;
                        }
                    }
                }
            }
        }

        // Also query by name for clients without email match
        if (clientNames.size > 0) {
            const names = [...clientNames];
            for (let i = 0; i < names.length; i += 50) {
                const batch = names.slice(i, i + 50);
                const { data } = await supabase
                    .from("csv_rows")
                    .select("custom_data")
                    .eq("source", "invoice-orders")
                    .gte("date", priorYearStart)
                    .lte("date", priorYearEnd)
                    .in("custom_data->>customer_name", batch)
                    .like("custom_data->>financial_account_code", "102.%");

                if (data) {
                    for (const row of data) {
                        const cd = row.custom_data as Record<string, unknown>;
                        const name = String(cd.customer_name || "").toLowerCase();
                        const faCode = String(cd.financial_account_code || "");
                        if (name && faCode.startsWith("102.") && faCode !== "102.0") {
                            if (!history[`name:${name}`]) {
                                history[`name:${name}`] = faCode;
                            }
                        }
                    }
                }
            }
        }

        // Build suggestions for Delight rows
        const newDelightCodes: Record<number, string> = {};
        for (const i of delightIndices) {
            const row = uploadedRows[i];
            const emailKey = row.customerEmail ? `email:${row.customerEmail.toLowerCase()}` : "";
            const nameKey = row.customerName ? `name:${row.customerName.toLowerCase()}` : "";

            const priorCode = (emailKey && history[emailKey]) || (nameKey && history[nameKey]) || null;

            if (priorCode) {
                // Apply renewal rules
                if (priorCode === "102.4") newDelightCodes[i] = "102.2"; // New AMEX → Contracted AMEX
                else if (priorCode === "102.3") newDelightCodes[i] = "102.1"; // New ROW → Contracted ROW
                else if (priorCode === "102.2") newDelightCodes[i] = "102.2"; // Keep Contracted AMEX
                else if (priorCode === "102.1") newDelightCodes[i] = "102.1"; // Keep Contracted ROW
                else newDelightCodes[i] = priorCode; // Other sub-codes: keep as-is
            }
            // No history → left blank for manual selection
        }

        setClientHistory(history);
        setDelightCodes(newDelightCodes);
    };

    // ── Build client classification map from all sources ──
    const buildClientClassMap = (codes: Record<number, string>) => {
        const clientClassMap = new Map<string, string>();

        // 1. Delight sub-codes (102.x)
        for (let i = 0; i < uploadedRows.length; i++) {
            const code = codes[i];
            if (code?.startsWith("102.") && code !== "102.0") {
                const row = uploadedRows[i];
                if (row.customerEmail) clientClassMap.set(row.customerEmail.toLowerCase(), code);
                if (row.customerName) clientClassMap.set(row.customerName.toLowerCase(), code);
            }
        }

        // 2. Level 1 (105.1) and PC Membership (101.4) — only if no Delight classification
        for (let i = 0; i < uploadedRows.length; i++) {
            const code = codes[i];
            if (code === "105.1" || code === "101.4") {
                const row = uploadedRows[i];
                if (row.customerEmail && !clientClassMap.has(row.customerEmail.toLowerCase())) {
                    clientClassMap.set(row.customerEmail.toLowerCase(), code);
                }
                if (row.customerName && !clientClassMap.has(row.customerName.toLowerCase())) {
                    clientClassMap.set(row.customerName.toLowerCase(), code);
                }
            }
        }
        return clientClassMap;
    };

    // ── Compute LAB/PC reallocations and open Popup 4 ──
    const openLabPcReview = (updatedCodes: Record<number, string>) => {
        const clientClassMap = buildClientClassMap(updatedCodes);
        const reallocations: typeof labPcReallocations = [];
        const finalCodes = { ...updatedCodes };

        for (let i = 0; i < uploadedRows.length; i++) {
            const currentCode = finalCodes[i];
            if (currentCode === "103.0" || currentCode === "104.0") {
                const row = uploadedRows[i];
                const clientKey = row.customerEmail?.toLowerCase() || row.customerName?.toLowerCase();
                let newCode: string;
                let clientClass = "";

                if (clientKey) {
                    const cls = clientClassMap.get(clientKey);
                    if (cls && CLIENT_TO_LAB_PC[cls]) {
                        newCode = currentCode === "104.0" ? CLIENT_TO_LAB_PC[cls].lab : CLIENT_TO_LAB_PC[cls].pc;
                        clientClass = cls;
                    } else {
                        newCode = currentCode === "104.0" ? "104.7" : "103.7";
                        clientClass = "none";
                    }
                } else {
                    newCode = currentCode === "104.0" ? "104.7" : "103.7";
                    clientClass = "none";
                }

                finalCodes[i] = newCode;
                reallocations.push({
                    rowIndex: i,
                    clientName: row.customerName || "-",
                    clientEmail: row.customerEmail || "",
                    product: row.description,
                    amount: row.amount,
                    date: row.date,
                    originalCode: currentCode,
                    newCode,
                    clientClass,
                });
            }
        }

        if (reallocations.length > 0) {
            setLabPcReallocations(reallocations);
            setPendingUpdatedCodes(finalCodes);
            setPopupSortField(""); setPopupSortDir("asc");
            setLabPcDialogOpen(true);
        } else {
            // No LAB/PC rows — save directly
            setRowFACodes(finalCodes);
            saveClassifications(finalCodes);
        }
    };

    // ── Popup 4 → Confirm & Save ──
    const handleLabPcConfirm = async () => {
        setRowFACodes(pendingUpdatedCodes);
        setLabPcDialogOpen(false);
        await saveClassifications(pendingUpdatedCodes);
    };

    // ── Popup 3 → Confirm: apply Delight sub-codes, then open LAB/PC review ──
    const handleDelightConfirm = async () => {
        // Validate all Delight rows have sub-code
        const delightIndices = uploadedRows
            .map((_, i) => i)
            .filter((i) => rowFACodes[i] === "102.0");

        const unclassified = delightIndices.filter((i) => !delightCodes[i]);
        if (unclassified.length > 0) {
            toast({
                title: "Incomplete Delight classification",
                description: `${unclassified.length} Delight rows without a sub-account assigned.`,
                variant: "destructive"
            });
            return;
        }

        // Apply Delight sub-codes to 102.0 rows
        const updatedCodes = { ...rowFACodes };
        for (const i of delightIndices) {
            updatedCodes[i] = delightCodes[i];
        }

        setDelightDialogOpen(false);
        openLabPcReview(updatedCodes);
    };

    // ── Save with LAB/PC auto-assignment (no Delight rows, but may have 105.1/101.4) ──
    const saveWithAutoAssignment = async () => {
        openLabPcReview({ ...rowFACodes });
    };

    // ── Save all classified rows to DB ──
    const saveClassifications = async (overrideCodes?: Record<number, string>) => {
        setClassifying(true);
        const codes = overrideCodes || rowFACodes;

        try {
            // Build duplicate overwrite lookup: invoiceNumber → existingId
            const dupeMap = new Map<string, string>();
            for (const d of duplicateOverwrites) {
                dupeMap.set(d.invoiceNumber, d.existingId);
            }

            const classifyRows = uploadedRows.map((row, i) => ({
                source: "invoice-orders",
                file_name: row.customData?.file_name || "upload",
                date: row.date,
                description: row.description,
                amount: row.amount,
                customData: row.customData,
                financialAccountCode: codes[i] || "",
                existingId: dupeMap.get(row.invoiceNumber) || undefined
            }));

            const response = await fetch("/api/invoice-orders/classify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows: classifyRows })
            });

            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error);

            // Handle annualize for flagged rows
            const annualizeCount = Object.entries(annualizeFlags).filter(([, v]) => v).length;
            if (annualizeCount > 0) {
                // We need to find the newly created row IDs to annualize.
                // Reload data and match by invoice number + date
                const { data: newData } = await supabase
                    .from("csv_rows")
                    .select("id, description, date, amount, custom_data")
                    .eq("source", "invoice-orders")
                    .order("created_at", { ascending: false })
                    .limit(uploadedRows.length + 10);

                if (newData) {
                    for (const [idxStr, flag] of Object.entries(annualizeFlags)) {
                        if (!flag) continue;
                        const idx = parseInt(idxStr);
                        const row = uploadedRows[idx];
                        // Find matching row in DB
                        const match = newData.find(
                            (d) => d.description === row.description &&
                                d.date === row.date &&
                                Math.abs(parseFloat(d.amount) - row.amount) < 0.01
                        );
                        if (match) {
                            await fetch("/api/invoice-orders/annualize", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ rowId: match.id })
                            });
                        }
                    }
                }
            }

            setClassifyDialogOpen(false);
            setAnnualizeDialogOpen(false);
            setDelightDialogOpen(false);
            setLabPcDialogOpen(false);

            const parts = [];
            if (result.data.inserted) parts.push(`${result.data.inserted} inserted`);
            if (result.data.overwritten) parts.push(`${result.data.overwritten} updated`);
            if (annualizeCount > 0) parts.push(`${annualizeCount} annualized`);

            toast({
                title: "Classification complete",
                description: parts.join(", ") + "."
            });

            loadData();
        } catch (err) {
            console.error("Classification error:", err);
            toast({
                title: "Classification error",
                description: String(err),
                variant: "destructive"
            });
        } finally {
            setClassifying(false);
        }
    };

    // Filter and sort
    const filteredData = useMemo(() => {
        let filtered = invoiceOrders;

        if (!showReconciled) {
            filtered = filtered.filter((inv) => !inv.reconciled);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (inv) =>
                    inv.invoice_number?.toLowerCase().includes(term) ||
                    inv.order_number?.toLowerCase().includes(term) ||
                    inv.description?.toLowerCase().includes(term) ||
                    Object.values(inv.custom_data || {}).some((v) =>
                        String(v).toLowerCase().includes(term)
                    )
            );
        }

        // Column filters
        if (filterDateFrom || filterDateTo) {
            filtered = filtered.filter((inv) => {
                if (!inv.date) return false;
                const d = new Date(inv.date + "T00:00:00");
                if (filterDateFrom && d < filterDateFrom) return false;
                if (filterDateTo && d > filterDateTo) return false;
                return true;
            });
        }
        if (filterInvoice) {
            const fi = filterInvoice.toLowerCase();
            filtered = filtered.filter((inv) => inv.invoice_number?.toLowerCase().includes(fi));
        }
        if (filterOrder) {
            const fo = filterOrder.toLowerCase();
            filtered = filtered.filter((inv) => inv.order_number?.toLowerCase().includes(fo));
        }
        if (filterDescription) {
            const fd = filterDescription.toLowerCase();
            filtered = filtered.filter((inv) => inv.description?.toLowerCase().includes(fd));
        }
        if (filterClient) {
            const fc = filterClient.toLowerCase();
            filtered = filtered.filter((inv) => ((inv.custom_data?.customer_name as string) || "").toLowerCase().includes(fc));
        }
        if (filterEmail) {
            const fe = filterEmail.toLowerCase();
            filtered = filtered.filter((inv) => ((inv.custom_data?.customer_email as string) || "").toLowerCase().includes(fe));
        }
        if (filterFA) {
            filtered = filtered.filter((inv) => {
                const code = (inv.custom_data?.financial_account_code as string) || "";
                const name = (inv.custom_data?.financial_account_name as string) || "";
                const combined = `${code} ${name}`.toLowerCase();
                return combined.includes(filterFA.toLowerCase());
            });
        }
        if (filterCurrency) {
            filtered = filtered.filter((inv) => inv.currency === filterCurrency);
        }
        if (filterStatus) {
            if (filterStatus === "reconciled") filtered = filtered.filter((inv) => inv.reconciled);
            if (filterStatus === "pending") filtered = filtered.filter((inv) => !inv.reconciled);
        }
        if (filterOrderStatus) {
            filtered = filtered.filter((inv) => {
                const st = ((inv.custom_data?.order_status as string) || "").toLowerCase();
                if (filterOrderStatus === "cancelled") return st === "cancelled" || st === "refunded" || st === "expired";
                if (filterOrderStatus === "active") return st !== "cancelled" && st !== "refunded" && st !== "expired";
                return st === filterOrderStatus.toLowerCase();
            });
        }

        // Sort
        filtered.sort((a, b) => {
            let aVal: string | number = "";
            let bVal: string | number = "";

            if (sortField === "amount" || sortField === "discount") {
                if (sortField === "amount") {
                    aVal = a.amount;
                    bVal = b.amount;
                } else {
                    aVal = Number(a.custom_data?.discount || 0);
                    bVal = Number(b.custom_data?.discount || 0);
                }
            } else if (sortField === "invoice_date" || sortField === "date") {
                aVal = a.date || "";
                bVal = b.date || "";
            } else if (sortField === "order_date") {
                aVal = (a.custom_data?.order_date as string) || "";
                bVal = (b.custom_data?.order_date as string) || "";
            } else if (sortField === "client") {
                aVal = ((a.custom_data?.customer_name as string) || "").toLowerCase();
                bVal = ((b.custom_data?.customer_name as string) || "").toLowerCase();
            } else if (sortField === "email") {
                aVal = ((a.custom_data?.customer_email as string) || "").toLowerCase();
                bVal = ((b.custom_data?.customer_email as string) || "").toLowerCase();
            } else if (sortField === "order_status") {
                aVal = ((a.custom_data?.order_status as string) || "").toLowerCase();
                bVal = ((b.custom_data?.order_status as string) || "").toLowerCase();
            } else if (sortField.startsWith("custom_")) {
                const key = sortField.replace("custom_", "");
                aVal = String(a.custom_data?.[key] || "");
                bVal = String(b.custom_data?.[key] || "");
            } else {
                aVal = String((a as Record<string, unknown>)[sortField] || "");
                bVal = String((b as Record<string, unknown>)[sortField] || "");
            }

            if (typeof aVal === "number" && typeof bVal === "number") {
                return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
            }
            return sortDirection === "asc"
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });

        return filtered;
    }, [invoiceOrders, showReconciled, searchTerm, sortField, sortDirection, filterDateFrom, filterDateTo, filterInvoice, filterOrder, filterDescription, filterClient, filterEmail, filterFA, filterCurrency, filterOrderStatus, filterStatus]);

    // Stats
    const stats = useMemo(() => {
        const total = filteredData.length;
        const reconciled = filteredData.filter((inv) => inv.reconciled).length;
        const unreconciled = total - reconciled;
        const totalAmount = filteredData.reduce((sum, inv) => sum + inv.amount, 0);

        return { total, reconciled, unreconciled, totalAmount };
    }, [filteredData]);

    // Handle sort
    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("desc");
        }
    };

    // Toggle column visibility
    const toggleColumn = (key: string) => {
        if (key.startsWith("custom_")) {
            setAllCustomColumns((prev) =>
                prev.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col))
            );
        } else {
            setColumns((prev) =>
                prev.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col))
            );
        }
    };

    // View details
    const viewDetails = (row: InvoiceOrder) => {
        setSelectedRow(row);
        setDetailsDialogOpen(true);
    };

    // Edit row
    const startEdit = (row: InvoiceOrder) => {
        setEditingRow(row);
        setEditForm({
            date: row.date || "",
            description: row.description || "",
            amount: String(row.amount),
            financial_account_code: (row.custom_data?.financial_account_code as string) || "",
            customer_name: (row.custom_data?.customer_name as string) || "",
            customer_email: (row.custom_data?.customer_email as string) || "",
        });
        setEditDialogOpen(true);
    };

    const saveEdit = async () => {
        if (!editingRow) return;
        setSaving(true);
        try {
            const updatedCustomData = { ...editingRow.custom_data };
            if (editForm.financial_account_code) {
                updatedCustomData.financial_account_code = editForm.financial_account_code;
                updatedCustomData.financial_account_name = FA_NAMES[editForm.financial_account_code] || "";
            }
            updatedCustomData.customer_name = editForm.customer_name;
            updatedCustomData.customer_email = editForm.customer_email;

            const { error } = await supabase.from("csv_rows").update({
                date: editForm.date,
                description: editForm.description,
                amount: parseFloat(editForm.amount) || 0,
                custom_data: updatedCustomData,
            }).eq("id", editingRow.id);

            if (error) throw error;
            toast({ title: "Record updated" });
            setEditDialogOpen(false);
            loadData();
        } catch (err) {
            console.error("Edit error:", err);
            toast({ title: "Error updating record", description: String(err), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    // Add manual invoice order
    const handleAddManual = async () => {
        if (!addForm.date || !addForm.description || !addForm.amount || !addForm.financial_account_code) {
            toast({ title: "Missing fields", description: "Date, description, amount and financial account are required.", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            const customData: Record<string, unknown> = {
                financial_account_code: addForm.financial_account_code,
                financial_account_name: FA_NAMES[addForm.financial_account_code] || "",
                customer_name: addForm.customer_name,
                customer_email: addForm.customer_email,
                company_name: addForm.company,
                invoice_number: addForm.invoice_number,
                order_number: addForm.order_number,
                order_date: addForm.order_date || null,
                discount: addForm.discount ? parseFloat(addForm.discount) || 0 : 0,
                country: addForm.country,
                payment_method: addForm.payment_method,
                billing_entity: addForm.billing_entity,
                order_status: addForm.order_status,
                charged: addForm.charged,
                manual_entry: true,
            };

            const { error } = await supabase.from("csv_rows").insert({
                source: "invoice-orders",
                file_name: "manual-entry",
                date: addForm.date,
                description: addForm.description,
                amount: parseFloat(addForm.amount) || 0,
                currency: addForm.currency || "EUR",
                custom_data: customData,
                reconciled: false,
            });

            if (error) throw error;
            toast({ title: "Invoice order created" });
            setAddDialogOpen(false);
            setAddForm(ADD_FORM_EMPTY);
            loadData();
        } catch (err) {
            console.error("Add error:", err);
            toast({ title: "Error creating record", description: String(err), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    // Delete row
    const deleteRow = async (id: string) => {
        if (!confirm("Are you sure you want to delete this record?")) return;

        try {
            const { error } = await supabase.from("csv_rows").delete().eq("id", id);

            if (error) throw error;

            toast({ title: "Record deleted" });
            loadData();
        } catch (err) {
            console.error("Delete error:", err);
            toast({
                title: "Error deleting",
                description: String(err),
                variant: "destructive"
            });
        }
    };

    // Delete all
    const deleteAll = async () => {
        if (!confirm("⚠️ Are you sure you want to delete ALL Invoice Orders records?")) return;
        if (!confirm("⚠️ This action CANNOT be undone! Continue?")) return;

        try {
            const response = await fetch("/api/csv-rows?source=invoice-orders", { method: "DELETE" });
            const result = await response.json();

            if (!result.success) throw new Error(result.error);

            toast({ title: "All records deleted" });
            loadData();
        } catch (err) {
            console.error("Delete all error:", err);
            toast({
                title: "Error deleting",
                description: String(err),
                variant: "destructive"
            });
        }
    };

    // Export to Excel
    const exportToExcel = () => {
        const exportData = filteredData.map((inv) => ({
            "Invoice #": inv.invoice_number,
            "Order #": inv.order_number || "",
            Date: formatDate(inv.date),
            Amount: inv.amount,
            Currency: inv.currency,
            Status: inv.reconciled ? "Reconciled" : "Pending",
            ...inv.custom_data
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Invoice Orders");
        XLSX.writeFile(wb, `invoice-orders-${new Date().toISOString().split("T")[0]}.xlsx`);
    };

    // Get all visible columns
    const visibleColumns = useMemo(() => {
        return [...columns.filter((c) => c.visible), ...allCustomColumns.filter((c) => c.visible)];
    }, [columns, allCustomColumns]);

    // Get cell value
    const getCellValue = (row: InvoiceOrder, colKey: string): React.ReactNode => {
        if (colKey === "invoice_date") return formatDate(row.date);
        if (colKey === "invoice_number") return row.invoice_number || "-";
        if (colKey === "order_date") {
            const od = (row.custom_data?.order_date as string) || "";
            return od ? formatDate(od) : "-";
        }
        if (colKey === "order_number") return row.order_number || "-";
        if (colKey === "order_status") {
            const status = (row.custom_data?.order_status as string) || "";
            if (!status) return <span className="text-gray-400">—</span>;
            const lower = status.toLowerCase();
            if (lower === "cancelled" || lower === "refunded" || lower === "expired")
                return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 text-xs">{status}</Badge>;
            if (lower === "completed" || lower === "paid" || lower === "processing")
                return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-300 dark:border-green-700 text-xs">{status}</Badge>;
            return <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 text-xs">{status}</Badge>;
        }
        if (colKey === "description") return row.description || "-";
        if (colKey === "client") return (row.custom_data?.customer_name as string) || "-";
        if (colKey === "email") return (row.custom_data?.customer_email as string) || "-";
        if (colKey === "discount") {
            const disc = Number(row.custom_data?.discount || 0);
            if (!disc) return "-";
            return (
                <span className="text-orange-500">
                    {formatEuropeanNumber(disc)}
                </span>
            );
        }
        if (colKey === "amount")
            return (
                <span className={row.amount >= 0 ? "text-green-400" : "text-red-400"}>
                    {formatEuropeanNumber(row.amount)}
                </span>
            );
        if (colKey === "currency") return row.currency;
        if (colKey === "financial_account") {
            const code = row.custom_data?.financial_account_code as string | null;
            const name = row.custom_data?.financial_account_name as string | null;
            if (!code) return <span className="text-gray-500">—</span>;
            return (
                <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 text-xs">
                    {code} {name ? `- ${name}` : ''}
                </Badge>
            );
        }
        if (colKey === "reconciled")
            return row.reconciled ? (
                <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Reconciled
                </Badge>
            ) : (
                <Badge className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                    <AlertCircle className="h-3 w-3 mr-1" /> Pending
                </Badge>
            );
        if (colKey === "date") return formatDate(row.date);
        if (colKey.startsWith("custom_")) {
            const key = colKey.replace("custom_", "");
            const value = row.custom_data?.[key];
            if (value === null || value === undefined) return "-";
            return String(value);
        }
        return "-";
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white">
            <div className="p-4 md:p-6 space-y-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <Breadcrumbs
                            items={[
                                { label: "Home", href: "/" },
                                { label: "Accounts Receivable", href: "/accounts-receivable" },
                                { label: "Invoice Orders" }
                            ]}
                        />
                        <div className="mt-2">
                            <PageHeader title="Invoice Orders" subtitle="Manage and reconcile Invoice Orders imported from CSV" />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Year toggle */}
                        <div className="flex items-center bg-gray-100 dark:bg-[#0a0a0a] rounded-lg p-0.5 border border-gray-200 dark:border-gray-700">
                            {(["all", 2024, 2025, 2026] as const).map((year) => (
                                <button
                                    key={year}
                                    onClick={() => { setSelectedYear(year); setPage(1); }}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${selectedYear === year
                                        ? "bg-blue-600 text-white shadow-sm"
                                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                        }`}
                                >
                                    {year === "all" ? "All" : year}
                                </button>
                            ))}
                        </div>
                        <ScopeSelector value={selectedScope} onValueChange={setSelectedScope} />
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-tour="ar-stats">
                    <Card className="bg-gray-100 dark:bg-black border-gray-200 dark:border-gray-700">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase">Total Invoices</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                                </div>
                                <FileText className="h-8 w-8 text-blue-400 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gray-100 dark:bg-black border-gray-200 dark:border-gray-700">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase">Reconciled</p>
                                    <p className="text-2xl font-bold text-green-400">{stats.reconciled}</p>
                                </div>
                                <CheckCircle2 className="h-8 w-8 text-green-400 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gray-100 dark:bg-black border-gray-200 dark:border-gray-700">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase">Pending</p>
                                    <p className="text-2xl font-bold text-yellow-400">{stats.unreconciled}</p>
                                </div>
                                <AlertCircle className="h-8 w-8 text-yellow-400 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gray-100 dark:bg-black border-gray-200 dark:border-gray-700">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase">Total Amount</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                        €{formatEuropeanNumber(stats.totalAmount)}
                                    </p>
                                </div>
                                <Zap className="h-8 w-8 text-purple-400 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Actions Bar */}
                <Card className="bg-gray-100 dark:bg-black border-gray-200 dark:border-gray-700">
                    <CardContent className="p-4">
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Upload Button */}
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    disabled={uploading}
                                />
                                <Button
                                    variant="outline"
                                    className="bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
                                    disabled={uploading}
                                >
                                    {uploading ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Upload className="h-4 w-4 mr-2" />
                                    )}
                                    Upload CSV
                                </Button>
                            </div>

                            {/* Add Manual */}
                            <Button
                                variant="outline"
                                className="bg-green-600 hover:bg-green-700 text-white border-green-500"
                                onClick={() => setAddDialogOpen(true)}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Manual
                            </Button>

                            {/* Refresh */}
                            <Button
                                variant="outline"
                                className="bg-gray-100 dark:bg-[#0a0a0a] hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                                onClick={loadData}
                                disabled={loading}
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                                Refresh
                            </Button>

                            {/* Export */}
                            <Button
                                variant="outline"
                                className="bg-gray-100 dark:bg-[#0a0a0a] hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                                onClick={exportToExcel}
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Export
                            </Button>

                            {/* Column Selector */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="bg-gray-100 dark:bg-[#0a0a0a] hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600">
                                        <Columns className="h-4 w-4 mr-2" />
                                        Columns
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-gray-100 dark:bg-black border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white w-56">
                                    <DropdownMenuLabel>Standard Columns</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-gray-100 dark:bg-[#0a0a0a]" />
                                    {columns.map((col) => (
                                        <DropdownMenuCheckboxItem
                                            key={col.key}
                                            checked={col.visible}
                                            onCheckedChange={() => toggleColumn(col.key)}
                                            className="text-gray-700 dark:text-gray-300 focus:bg-gray-700 focus:text-gray-900 dark:text-white"
                                        >
                                            {col.label}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                    {allCustomColumns.length > 0 && (
                                        <>
                                            <DropdownMenuSeparator className="bg-gray-100 dark:bg-[#0a0a0a]" />
                                            <DropdownMenuLabel>Custom Columns</DropdownMenuLabel>
                                            <DropdownMenuSeparator className="bg-gray-100 dark:bg-[#0a0a0a]" />
                                            {allCustomColumns.map((col) => (
                                                <DropdownMenuCheckboxItem
                                                    key={col.key}
                                                    checked={col.visible}
                                                    onCheckedChange={() => toggleColumn(col.key)}
                                                    className="text-gray-700 dark:text-gray-300 focus:bg-gray-700 focus:text-gray-900 dark:text-white"
                                                >
                                                    {col.label}
                                                </DropdownMenuCheckboxItem>
                                            ))}
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Delete All */}
                            {invoiceOrders.length > 0 && (
                                <Button
                                    variant="outline"
                                    className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border-red-600/50"
                                    onClick={deleteAll}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete All
                                </Button>
                            )}

                            <div className="flex-1" />

                            {/* Search */}
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                                <Input
                                    type="text"
                                    placeholder="Search invoices..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 bg-gray-100 dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
                                />
                            </div>

                            {/* Show Reconciled Toggle */}
                            <Button
                                variant="outline"
                                className={`border-gray-300 dark:border-gray-600 ${showReconciled ? "bg-gray-100 dark:bg-[#0a0a0a] text-gray-900 dark:text-white" : "bg-gray-100 dark:bg-black text-gray-500 dark:text-gray-400"
                                    }`}
                                onClick={() => setShowReconciled(!showReconciled)}
                            >
                                {showReconciled ? <Eye className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2 opacity-50" />}
                                {showReconciled ? "All" : "Pending Only"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Data Table */}
                <Card className="bg-gray-100 dark:bg-black border-gray-200 dark:border-gray-700" data-tour="invoice-table">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center h-64 text-red-400">
                                <AlertCircle className="h-6 w-6 mr-2" />
                                {error}
                            </div>
                        ) : filteredData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                                <FileText className="h-12 w-12 mb-4 opacity-50" />
                                <p className="text-lg">No Invoice Orders found</p>
                                <p className="text-sm">Upload a CSV file to get started</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-100 dark:bg-black/50 border-b border-gray-200 dark:border-gray-700">
                                            {visibleColumns.map((col) => (
                                                <th
                                                    key={col.key}
                                                    className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:bg-gray-100 dark:bg-[#0a0a0a]/50"
                                                    style={{ width: col.width }}
                                                    onClick={() => handleSort(col.key)}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        {col.label}
                                                        {sortField === col.key ? (
                                                            sortDirection === "asc" ? (
                                                                <ArrowUp className="h-3 w-3" />
                                                            ) : (
                                                                <ArrowDown className="h-3 w-3" />
                                                            )
                                                        ) : (
                                                            <ArrowUpDown className="h-3 w-3 opacity-30" />
                                                        )}
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-medium w-24">Actions</th>
                                        </tr>
                                        {/* Filter Row */}
                                        <tr className="bg-gray-50 dark:bg-black/30 border-b border-gray-200 dark:border-gray-700">
                                            {visibleColumns.map((col) => (
                                                <th key={`filter-${col.key}`} className="px-2 py-1">
                                                    {col.key === "invoice_date" && (
                                                        <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" className={`h-7 w-full text-xs justify-start font-normal bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white ${filterDateFrom || filterDateTo ? "text-gray-900 dark:text-white" : "text-gray-400"}`}>
                                                                    <CalendarIcon className="h-3 w-3 mr-1 shrink-0" />
                                                                    {filterDateFrom && filterDateTo
                                                                        ? `${format(filterDateFrom, "dd/MM")} - ${format(filterDateTo, "dd/MM/yy")}`
                                                                        : filterDateFrom
                                                                            ? `From ${format(filterDateFrom, "dd/MM/yy")}`
                                                                            : "Date range..."}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0 bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700" align="start">
                                                                <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-1">
                                                                    <Button variant="ghost" className="h-6 text-[10px] px-2" onClick={() => {
                                                                        const now = new Date();
                                                                        setFilterDateFrom(startOfMonth(subMonths(now, 1)));
                                                                        setFilterDateTo(endOfMonth(subMonths(now, 1)));
                                                                        setDateFilterOpen(false);
                                                                    }}>Last Month</Button>
                                                                    <Button variant="ghost" className="h-6 text-[10px] px-2" onClick={() => {
                                                                        const now = new Date();
                                                                        setFilterDateFrom(startOfYear(now));
                                                                        setFilterDateTo(now);
                                                                        setDateFilterOpen(false);
                                                                    }}>This Year</Button>
                                                                    <Button variant="ghost" className="h-6 text-[10px] px-2" onClick={() => {
                                                                        const now = new Date();
                                                                        setFilterDateFrom(startOfYear(subYears(now, 1)));
                                                                        setFilterDateTo(new Date(now.getFullYear() - 1, 11, 31));
                                                                        setDateFilterOpen(false);
                                                                    }}>Last Year</Button>
                                                                    {(filterDateFrom || filterDateTo) && (
                                                                        <Button variant="ghost" className="h-6 text-[10px] px-2 text-red-500" onClick={() => {
                                                                            setFilterDateFrom(undefined);
                                                                            setFilterDateTo(undefined);
                                                                            setDateFilterOpen(false);
                                                                        }}>Clear</Button>
                                                                    )}
                                                                </div>
                                                                <Calendar
                                                                    mode="range"
                                                                    selected={filterDateFrom && filterDateTo ? { from: filterDateFrom, to: filterDateTo } : filterDateFrom ? { from: filterDateFrom, to: undefined } : undefined}
                                                                    onSelect={(range) => {
                                                                        setFilterDateFrom(range?.from);
                                                                        setFilterDateTo(range?.to);
                                                                        if (range?.from && range?.to) setDateFilterOpen(false);
                                                                    }}
                                                                    numberOfMonths={2}
                                                                    className="text-gray-900 dark:text-white"
                                                                />
                                                            </PopoverContent>
                                                        </Popover>
                                                    )}
                                                    {col.key === "invoice_number" && (
                                                        <Input
                                                            type="text"
                                                            placeholder="Filter invoice..."
                                                            value={filterInvoice}
                                                            onChange={(e) => setFilterInvoice(e.target.value)}
                                                            className="h-7 text-xs bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
                                                        />
                                                    )}
                                                    {col.key === "order_number" && (
                                                        <Input
                                                            type="text"
                                                            placeholder="Filter order..."
                                                            value={filterOrder}
                                                            onChange={(e) => setFilterOrder(e.target.value)}
                                                            className="h-7 text-xs bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
                                                        />
                                                    )}
                                                    {col.key === "description" && (
                                                        <Input
                                                            type="text"
                                                            placeholder="Filter products..."
                                                            value={filterDescription}
                                                            onChange={(e) => setFilterDescription(e.target.value)}
                                                            className="h-7 text-xs bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
                                                        />
                                                    )}
                                                    {col.key === "client" && (
                                                        <Input
                                                            type="text"
                                                            placeholder="Filter client..."
                                                            value={filterClient}
                                                            onChange={(e) => setFilterClient(e.target.value)}
                                                            className="h-7 text-xs bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
                                                        />
                                                    )}
                                                    {col.key === "email" && (
                                                        <Input
                                                            type="text"
                                                            placeholder="Filter email..."
                                                            value={filterEmail}
                                                            onChange={(e) => setFilterEmail(e.target.value)}
                                                            className="h-7 text-xs bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
                                                        />
                                                    )}
                                                    {col.key === "currency" && (
                                                        <select
                                                            value={filterCurrency}
                                                            onChange={(e) => setFilterCurrency(e.target.value)}
                                                            className="h-7 w-full text-xs rounded-md bg-white dark:bg-[#0a0a0a] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white px-1"
                                                        >
                                                            <option value="">All</option>
                                                            <option value="EUR">EUR</option>
                                                            <option value="USD">USD</option>
                                                            <option value="GBP">GBP</option>
                                                        </select>
                                                    )}
                                                    {col.key === "order_status" && (
                                                        <select
                                                            value={filterOrderStatus}
                                                            onChange={(e) => setFilterOrderStatus(e.target.value)}
                                                            className="h-7 w-full text-xs rounded-md bg-white dark:bg-[#0a0a0a] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white px-1"
                                                        >
                                                            <option value="">All</option>
                                                            <option value="active">Active</option>
                                                            <option value="cancelled">Cancelled</option>
                                                            <option value="Completed">Completed</option>
                                                            <option value="Processing">Processing</option>
                                                        </select>
                                                    )}
                                                    {col.key === "financial_account" && (
                                                        <Input
                                                            type="text"
                                                            placeholder="Filter FA..."
                                                            value={filterFA}
                                                            onChange={(e) => setFilterFA(e.target.value)}
                                                            className="h-7 text-xs bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
                                                        />
                                                    )}
                                                    {col.key === "reconciled" && (
                                                        <select
                                                            value={filterStatus}
                                                            onChange={(e) => setFilterStatus(e.target.value)}
                                                            className="h-7 w-full text-xs rounded-md bg-white dark:bg-[#0a0a0a] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white px-1"
                                                        >
                                                            <option value="">All</option>
                                                            <option value="reconciled">Reconciled</option>
                                                            <option value="pending">Pending</option>
                                                        </select>
                                                    )}
                                                </th>
                                            ))}
                                            <th className="px-2 py-1" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredData.map((row) => (
                                            <tr
                                                key={row.id}
                                                className="border-b border-gray-200 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-[#111111]/30 transition-colors"
                                            >
                                                {visibleColumns.map((col) => (
                                                    <td key={col.key} className="px-3 py-2 text-gray-700 dark:text-gray-300">
                                                        {getCellValue(row, col.key)}
                                                    </td>
                                                ))}
                                                <td className="px-3 py-2 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-600"
                                                            onClick={() => viewDetails(row)}
                                                        >
                                                            <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-600"
                                                            onClick={() => startEdit(row)}
                                                        >
                                                            <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 hover:bg-red-600/30"
                                                            onClick={() => deleteRow(row.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-400" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Footer Stats & Pagination */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                    <div className="text-gray-500 text-sm">
                        Showing {filteredData.length} of {invoiceOrders.length} loaded
                        {totalRows > 0 && ` (${totalRows} total in database)`}
                        {selectedYear !== "all" && ` · Year: ${selectedYear}`}
                    </div>
                    {totalRows > PAGE_SIZE && (
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-40"
                            >
                                ← Prev
                            </Button>
                            <span className="text-sm text-gray-500">
                                Page {page} of {Math.ceil(totalRows / PAGE_SIZE)}
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={page >= Math.ceil(totalRows / PAGE_SIZE)}
                                onClick={() => setPage((p) => p + 1)}
                                className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-40"
                            >
                                Next →
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Details Dialog */}
            <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
                <DialogContent className="bg-gray-100 dark:bg-black border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-400" />
                            Invoice Details
                        </DialogTitle>
                        <DialogDescription className="text-gray-500 dark:text-gray-400">
                            {selectedRow?.invoice_number}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRow && (
                        <div className="space-y-4">
                            {/* Main Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-gray-500 dark:text-gray-400 text-xs">Invoice Number</Label>
                                    <p className="text-gray-900 dark:text-white font-mono">{selectedRow.invoice_number || "-"}</p>
                                </div>
                                <div>
                                    <Label className="text-gray-500 dark:text-gray-400 text-xs">Order Number</Label>
                                    <p className="text-gray-900 dark:text-white font-mono">{selectedRow.order_number || "-"}</p>
                                </div>
                                <div>
                                    <Label className="text-gray-500 dark:text-gray-400 text-xs">Date</Label>
                                    <p className="text-gray-900 dark:text-white">{formatDate(selectedRow.date)}</p>
                                </div>
                                <div>
                                    <Label className="text-gray-500 dark:text-gray-400 text-xs">Amount</Label>
                                    <p className="text-gray-900 dark:text-white font-mono">
                                        {selectedRow.currency} {formatEuropeanNumber(selectedRow.amount)}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-gray-500 dark:text-gray-400 text-xs">Status</Label>
                                    <p>
                                        {selectedRow.reconciled ? (
                                            <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                                                Reconciled
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                                                Pending
                                            </Badge>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Custom Data */}
                            {selectedRow.custom_data && Object.keys(selectedRow.custom_data).length > 0 && (
                                <div>
                                    <Label className="text-gray-500 dark:text-gray-400 text-xs block mb-2">Additional Details</Label>
                                    <div className="bg-gray-100 dark:bg-black/50 rounded-lg p-3 space-y-2">
                                        {Object.entries(selectedRow.custom_data)
                                            .filter(([key]) => !["file_name", "row_index"].includes(key))
                                            .map(([key, value]) => (
                                                <div key={key} className="flex justify-between text-sm">
                                                    <span className="text-gray-500 dark:text-gray-400">
                                                        {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                                                    </span>
                                                    <span className="text-gray-900 dark:text-white font-mono">
                                                        {value === null || value === undefined ? "-" : String(value)}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="h-5 w-5 text-blue-400" />
                            Edit Invoice Order
                        </DialogTitle>
                        <DialogDescription className="text-gray-500 dark:text-gray-400">
                            Update the fields below and save.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label className="text-gray-500 dark:text-gray-400 text-xs">Date</Label>
                            <Input
                                type="date"
                                value={editForm.date}
                                onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                                className="bg-white dark:bg-[#111] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <Label className="text-gray-500 dark:text-gray-400 text-xs">Description</Label>
                            <Input
                                value={editForm.description}
                                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                                className="bg-white dark:bg-[#111] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <Label className="text-gray-500 dark:text-gray-400 text-xs">Amount</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={editForm.amount}
                                onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                                className="bg-white dark:bg-[#111] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <Label className="text-gray-500 dark:text-gray-400 text-xs">Financial Account</Label>
                            <Input
                                value={editForm.financial_account_code}
                                onChange={(e) => setEditForm((f) => ({ ...f, financial_account_code: e.target.value }))}
                                placeholder="e.g. 102.0"
                                className="bg-white dark:bg-[#111] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <Label className="text-gray-500 dark:text-gray-400 text-xs">Customer Name</Label>
                            <Input
                                value={editForm.customer_name}
                                onChange={(e) => setEditForm((f) => ({ ...f, customer_name: e.target.value }))}
                                className="bg-white dark:bg-[#111] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <Label className="text-gray-500 dark:text-gray-400 text-xs">Customer Email</Label>
                            <Input
                                value={editForm.customer_email}
                                onChange={(e) => setEditForm((f) => ({ ...f, customer_email: e.target.value }))}
                                className="bg-white dark:bg-[#111] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>Cancel</Button>
                        <Button onClick={saveEdit} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══════════════════════════════════════════════════════════════
                POPUP 0 — Email Resolution (clients without email)
            ═══════════════════════════════════════════════════════════════ */}
            <Dialog open={emailDialogOpen} onOpenChange={(open) => { if (!emailSearching) setEmailDialogOpen(open); }}>
                <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-3xl max-h-[90vh] overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5 text-blue-400" />
                            Resolve Client Emails
                        </DialogTitle>
                        <DialogDescription className="text-gray-500 dark:text-gray-400">
                            {(() => {
                                const missing = missingEmailClients.filter(c => !c.email.trim()).length;
                                if (missing === 0) return `All ${missingEmailClients.length} client(s) have emails assigned. Review and proceed.`;
                                return `${missing} of ${missingEmailClients.length} client(s) without email. Confirm or enter their email to proceed.`;
                            })()}
                        </DialogDescription>
                    </DialogHeader>

                    {emailSearching ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-400 mr-2" />
                            <span className="text-gray-500">Searching previous purchases...</span>
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-gray-100 dark:bg-[#111111] border-b border-gray-200 dark:border-gray-700">
                                        <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Client</th>
                                        <th className="px-3 py-2 text-center text-xs text-gray-500 dark:text-gray-400 w-[60px]">Rows</th>
                                        <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400 w-[300px]">Email</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {missingEmailClients.map((client, idx) => (
                                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300 text-xs">
                                                <span className="block truncate max-w-[280px]" title={client.name}>
                                                    {client.name}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                {client.rowIndices.length}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="email"
                                                        placeholder="client@email.com"
                                                        value={client.email}
                                                        onChange={(e) => {
                                                            setMissingEmailClients(prev => prev.map((c, i) =>
                                                                i === idx ? { ...c, email: e.target.value } : c
                                                            ));
                                                        }}
                                                        className={`h-7 text-xs bg-white dark:bg-black border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white ${client.foundInDB ? "border-green-400 dark:border-green-700" : ""}`}
                                                    />
                                                    {client.foundInDB ? (
                                                        <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 text-[10px] whitespace-nowrap shrink-0">
                                                            found
                                                        </Badge>
                                                    ) : client.email.trim() && !client.foundInDB ? (
                                                        <Badge className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 text-[10px] whitespace-nowrap shrink-0">
                                                            csv
                                                        </Badge>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="shrink-0 pt-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0a0a0a] relative z-20">
                        <div className="flex items-center gap-2 w-full justify-between">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {missingEmailClients.filter(c => c.email.trim()).length}/{missingEmailClients.length} resolved
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={confirmEmails}
                                >
                                    Next →
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ═══════════════════════════════════════════════════════════════
                POPUP 1 — Product Classification (grouped by unique product)
            ═══════════════════════════════════════════════════════════════ */}
            <Dialog open={classifyDialogOpen} onOpenChange={(open) => { if (!classifying) setClassifyDialogOpen(open); }}>
                <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-4xl max-h-[90vh] overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <Settings2 className="h-5 w-5 text-blue-400" />
                            Classify Products — Financial Account
                        </DialogTitle>
                        <DialogDescription className="text-gray-500 dark:text-gray-400">
                            {productGroups.length} unique products ({uploadedRows.length} rows).
                            {duplicateOverwrites.length > 0 && (
                                <span className="text-amber-500 ml-2">
                                    {duplicateOverwrites.length} duplicates will be overwritten.
                                </span>
                            )}
                            {" "}Assign a financial account to each product.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-gray-100 dark:bg-[#111111] border-b border-gray-200 dark:border-gray-700">
                                    <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Product</th>
                                    <th className="px-3 py-2 text-center text-xs text-gray-500 dark:text-gray-400 w-[60px]">Qty</th>
                                    <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400 w-[110px]">Total</th>
                                    <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400 w-[260px]">Financial Account</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productGroups.map((group, g) => (
                                    <tr key={g} className="border-b border-gray-100 dark:border-gray-800">
                                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 text-xs">
                                            <span className="block truncate max-w-[350px]" title={group.description}>
                                                {group.description}
                                            </span>
                                            {group.faSource !== "none" && (
                                                <Badge className={`text-[10px] mt-0.5 ${group.faSource === "prior_mapping" ? "bg-green-900/20 text-green-500 border-green-800" : "bg-blue-900/20 text-blue-400 border-blue-800"}`}>
                                                    {group.faSource === "prior_mapping" ? "mapped" : "suggested"}
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-center text-xs text-gray-500 dark:text-gray-400 font-mono">
                                            {group.count}
                                        </td>
                                        <td className="px-3 py-2 text-right text-xs font-mono">
                                            <span className={group.totalAmount >= 0 ? "text-green-500" : "text-red-400"}>
                                                {formatEuropeanNumber(group.totalAmount)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <Select
                                                value={productFACodes[g] || ""}
                                                onValueChange={(val) => setProductFACodes(prev => ({ ...prev, [g]: val }))}
                                            >
                                                <SelectTrigger className="h-7 text-xs bg-white dark:bg-black border-gray-300 dark:border-gray-600">
                                                    <SelectValue placeholder="Select..." />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white dark:bg-black border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                                                    {FA_OPTIONS_POPUP1.map((opt) => (
                                                        <SelectItem key={opt.code} value={opt.code} className="text-xs">
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="shrink-0 pt-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0a0a0a] relative z-20">
                        <div className="flex items-center gap-2 w-full justify-between">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {Object.keys(productFACodes).length}/{productGroups.length} classified
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setClassifyDialogOpen(false)} disabled={classifying}>
                                    Cancel
                                </Button>
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={handleProductClassifyNext}
                                    disabled={classifying}
                                >
                                    Next →
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ═══════════════════════════════════════════════════════════════
                POPUP 2 — Annualize (individual rows with filters)
            ═══════════════════════════════════════════════════════════════ */}
            <Dialog open={annualizeDialogOpen} onOpenChange={(open) => { if (!classifying) setAnnualizeDialogOpen(open); }}>
                <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-6xl max-h-[90vh] overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarRange className="h-5 w-5 text-purple-400" />
                            Annualize Invoice Orders
                        </DialogTitle>
                        <DialogDescription className="text-gray-500 dark:text-gray-400">
                            {uploadedRows.length} classified rows. Select the ones to split into 12 monthly installments.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Filters */}
                    <div className="shrink-0 flex gap-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <Filter className="h-3.5 w-3.5 text-gray-400" />
                            <Select value={annualizeFilterFA} onValueChange={setAnnualizeFilterFA}>
                                <SelectTrigger className="h-7 text-xs w-[220px] bg-white dark:bg-black border-gray-300 dark:border-gray-600">
                                    <SelectValue placeholder="Financial Account" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-black border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                                    <SelectItem value="all" className="text-xs">All accounts</SelectItem>
                                    {[...new Set(Object.values(rowFACodes))].sort().map(code => (
                                        <SelectItem key={code} value={code} className="text-xs">
                                            {code} — {FA_NAMES[code] || code}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={annualizeFilterProduct} onValueChange={setAnnualizeFilterProduct}>
                                <SelectTrigger className="h-7 text-xs w-[260px] bg-white dark:bg-black border-gray-300 dark:border-gray-600">
                                    <SelectValue placeholder="Product" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-black border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                                    <SelectItem value="all" className="text-xs">All products</SelectItem>
                                    {[...new Set(uploadedRows.map(r => r.description))].sort().map(desc => (
                                        <SelectItem key={desc} value={desc} className="text-xs">
                                            {desc.length > 50 ? desc.slice(0, 50) + "…" : desc}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-gray-100 dark:bg-[#111111] border-b border-gray-200 dark:border-gray-700">
                                    {[
                                        { key: "date", label: "Date", align: "text-left", w: "w-[90px]" },
                                        { key: "client", label: "Client", align: "text-left", w: "w-[140px]" },
                                        { key: "product", label: "Product", align: "text-left", w: "" },
                                        { key: "amount", label: "Amount", align: "text-right", w: "w-[90px]" },
                                        { key: "account", label: "Account", align: "text-left", w: "w-[160px]" },
                                    ].map(c => (
                                        <th key={c.key} className={`px-2 py-2 ${c.align} text-xs text-gray-500 dark:text-gray-400 ${c.w} cursor-pointer hover:text-gray-700 dark:hover:text-gray-200`} onClick={() => handlePopupSort(c.key)}>
                                            <div className={`flex items-center gap-1 ${c.align === "text-right" ? "justify-end" : ""}`}>
                                                {c.label}
                                                {popupSortField === c.key ? (popupSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-2 py-2 text-center text-xs text-gray-500 dark:text-gray-400 w-[70px]">12x</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const filtered = uploadedRows.map((row, i) => ({ row, i, faCode: rowFACodes[i] || "" }))
                                        .filter(({ faCode }) => annualizeFilterFA === "all" || faCode === annualizeFilterFA)
                                        .filter(({ row }) => annualizeFilterProduct === "all" || row.description === annualizeFilterProduct);
                                    if (popupSortField) {
                                        filtered.sort((a, b) => {
                                            let va: string | number = "", vb: string | number = "";
                                            if (popupSortField === "date") { va = a.row.date || ""; vb = b.row.date || ""; }
                                            else if (popupSortField === "client") { va = (a.row.customerName || "").toLowerCase(); vb = (b.row.customerName || "").toLowerCase(); }
                                            else if (popupSortField === "product") { va = (a.row.description || "").toLowerCase(); vb = (b.row.description || "").toLowerCase(); }
                                            else if (popupSortField === "amount") { va = a.row.amount; vb = b.row.amount; }
                                            else if (popupSortField === "account") { va = a.faCode; vb = b.faCode; }
                                            if (va < vb) return popupSortDir === "asc" ? -1 : 1;
                                            if (va > vb) return popupSortDir === "asc" ? 1 : -1;
                                            return 0;
                                        });
                                    }
                                    return filtered.map(({ row, i, faCode }) => {

                                        const preview = annualizedPreviews[i];
                                        return (
                                            <React.Fragment key={i}>
                                                <tr className="border-b border-gray-100 dark:border-gray-800">
                                                    <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300 text-xs">{formatDate(row.date)}</td>
                                                    <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300 text-xs truncate max-w-[140px]" title={row.customerName}>
                                                        {row.customerName || "-"}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300 text-xs truncate max-w-[250px]" title={row.description}>
                                                        {row.description}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right text-xs font-mono">
                                                        <span className={row.amount >= 0 ? "text-green-500" : "text-red-400"}>
                                                            {formatEuropeanNumber(row.amount)}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400">
                                                        {faCode} — {FA_NAMES[faCode] || ""}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleAnnualizePreview(i)}
                                                            className={`h-6 w-6 rounded border flex items-center justify-center transition-colors ${annualizeFlags[i]
                                                                ? "bg-purple-600 border-purple-500 text-white"
                                                                : "border-gray-300 dark:border-gray-600 text-gray-400 hover:border-purple-400"
                                                                }`}
                                                            title="Annualize (12 monthly installments)"
                                                        >
                                                            <CalendarRange className="h-3.5 w-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                                {annualizeFlags[i] && preview && preview.map((inst, j) => (
                                                    <tr key={`${i}-inst-${j}`} className="bg-purple-50 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-900/20">
                                                        <td className="px-2 py-1 text-purple-600 dark:text-purple-400 text-[11px] pl-6">
                                                            {formatDate(inst.date)}
                                                        </td>
                                                        <td className="px-2 py-1 text-purple-500 dark:text-purple-400 text-[11px]">
                                                            {row.customerName || "-"}
                                                        </td>
                                                        <td className="px-2 py-1 text-purple-500 dark:text-purple-400 text-[11px]">
                                                            <span className="flex items-center gap-1">
                                                                <Badge className="bg-purple-600 text-white text-[9px] px-1 py-0">{inst.installment}</Badge>
                                                                {row.description}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1 text-right text-[11px] font-mono text-purple-500 dark:text-purple-400">
                                                            {formatEuropeanNumber(row.amount / 12)}
                                                        </td>
                                                        <td className="px-2 py-1 text-[11px] text-purple-500 dark:text-purple-400">
                                                            {faCode}
                                                        </td>
                                                        <td></td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>

                    <div className="shrink-0 pt-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0a0a0a] relative z-20">
                        <div className="flex items-center gap-2 w-full justify-between">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {Object.values(annualizeFlags).filter(Boolean).length > 0 ? (
                                    <span className="text-purple-500">
                                        {Object.values(annualizeFlags).filter(Boolean).length} to annualize (12x)
                                    </span>
                                ) : (
                                    <span>No rows selected for annualization</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => { setAnnualizeDialogOpen(false); setClassifyDialogOpen(true); }}
                                    disabled={classifying}
                                >
                                    ← Back
                                </Button>
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={handleAnnualizeNext}
                                    disabled={classifying}
                                >
                                    {classifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                    {uploadedRows.some((_, i) => rowFACodes[i] === "102.0") ? "Next →" : "Confirm"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ═══════════════════════════════════════════════════════════════
                POPUP 3 — Delight Sub-Classification
            ═══════════════════════════════════════════════════════════════ */}
            <Dialog open={delightDialogOpen} onOpenChange={(open) => { if (!classifying) setDelightDialogOpen(open); }}>
                <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-5xl max-h-[85vh] overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-purple-400" />
                            Delight Classification — Sub-account
                        </DialogTitle>
                        <DialogDescription className="text-gray-500 dark:text-gray-400">
                            Refine Delight (102.0) rows with the specific sub-account.
                            Auto-suggestions based on client history from the previous year.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-gray-100 dark:bg-[#111111] border-b border-gray-200 dark:border-gray-700">
                                    {[
                                        { key: "date", label: "Date", align: "text-left", w: "w-[90px]" },
                                        { key: "client", label: "Client", align: "text-left", w: "w-[160px]" },
                                        { key: "product", label: "Product", align: "text-left", w: "" },
                                        { key: "amount", label: "Amount", align: "text-right", w: "w-[90px]" },
                                    ].map(c => (
                                        <th key={c.key} className={`px-2 py-2 ${c.align} text-xs text-gray-500 dark:text-gray-400 ${c.w} cursor-pointer hover:text-gray-700 dark:hover:text-gray-200`} onClick={() => handlePopupSort(c.key)}>
                                            <div className={`flex items-center gap-1 ${c.align === "text-right" ? "justify-end" : ""}`}>
                                                {c.label}
                                                {popupSortField === c.key ? (popupSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-2 py-2 text-left text-xs text-gray-500 dark:text-gray-400 w-[260px]">Delight Sub-account</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const filtered = uploadedRows.map((row, i) => ({ row, i }))
                                        .filter(({ i }) => rowFACodes[i] === "102.0");
                                    if (popupSortField) {
                                        filtered.sort((a, b) => {
                                            let va: string | number = "", vb: string | number = "";
                                            if (popupSortField === "date") { va = a.row.date || ""; vb = b.row.date || ""; }
                                            else if (popupSortField === "client") { va = (a.row.customerName || "").toLowerCase(); vb = (b.row.customerName || "").toLowerCase(); }
                                            else if (popupSortField === "product") { va = (a.row.description || "").toLowerCase(); vb = (b.row.description || "").toLowerCase(); }
                                            else if (popupSortField === "amount") { va = a.row.amount; vb = b.row.amount; }
                                            if (va < vb) return popupSortDir === "asc" ? -1 : 1;
                                            if (va > vb) return popupSortDir === "asc" ? 1 : -1;
                                            return 0;
                                        });
                                    }
                                    return filtered.map(({ row, i }) => {
                                        const hasSuggestion = !!delightCodes[i];
                                        return (
                                            <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                                                <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300 text-xs">{formatDate(row.date)}</td>
                                                <td className="px-2 py-1.5 text-xs">
                                                    <div className="text-gray-700 dark:text-gray-300 truncate max-w-[160px]" title={row.customerName}>
                                                        {row.customerName || "-"}
                                                    </div>
                                                    {row.customerEmail && (
                                                        <div className="text-gray-400 text-[10px] truncate" title={row.customerEmail}>
                                                            {row.customerEmail}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300 text-xs truncate max-w-[250px]" title={row.description}>
                                                    {row.description}
                                                </td>
                                                <td className="px-2 py-1.5 text-right text-xs font-mono text-green-500">
                                                    {formatEuropeanNumber(row.amount)}
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <div className="flex items-center gap-1">
                                                        <Select
                                                            value={delightCodes[i] || ""}
                                                            onValueChange={(val) => setDelightCodes((prev) => ({ ...prev, [i]: val }))}
                                                        >
                                                            <SelectTrigger className={`h-7 text-xs border-gray-300 dark:border-gray-600 ${hasSuggestion ? "bg-green-50 dark:bg-green-900/10 border-green-400 dark:border-green-700" : "bg-white dark:bg-black"}`}>
                                                                <SelectValue placeholder="Select sub-account..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-white dark:bg-black border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                                                                {DELIGHT_SUB_OPTIONS.map((opt) => (
                                                                    <SelectItem key={opt.code} value={opt.code} className="text-xs">
                                                                        {opt.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        {hasSuggestion && (
                                                            <Badge className="bg-green-900/20 text-green-500 border-green-800 text-[10px] whitespace-nowrap">
                                                                auto
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>

                    <div className="shrink-0 pt-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0a0a0a] relative z-20">
                        <div className="flex items-center gap-2 w-full justify-between">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {Object.keys(delightCodes).length}/{uploadedRows.filter((_, i) => rowFACodes[i] === "102.0").length} classified
                                <span className="text-gray-400 ml-2">
                                    LAB (104.x) and PC (103.x) will be auto-assigned per client
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => { setDelightDialogOpen(false); setAnnualizeDialogOpen(true); }}
                                    disabled={classifying}
                                >
                                    ← Back
                                </Button>
                                <Button
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                    onClick={handleDelightConfirm}
                                    disabled={classifying}
                                >
                                    Next →
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            {/* ═══════════════════════════════════════════════════════════════
                POPUP 4 — LAB / Planning Center Reallocation Review
            ═══════════════════════════════════════════════════════════════ */}
            <Dialog open={labPcDialogOpen} onOpenChange={(open) => { if (!classifying) setLabPcDialogOpen(open); }}>
                <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-5xl max-h-[85vh] overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <ArrowRightLeft className="h-5 w-5 text-amber-500" />
                            LAB & Planning Center — Reallocation Review
                        </DialogTitle>
                        <DialogDescription className="text-gray-500 dark:text-gray-400">
                            {labPcReallocations.length} row(s) reallocated from LAB (104.0) and Planning Center (103.0) based on client subscription level.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-gray-100 dark:bg-[#111111] border-b border-gray-200 dark:border-gray-700">
                                    {[
                                        { key: "date", label: "Date", align: "text-left", w: "w-[80px]" },
                                        { key: "client", label: "Client", align: "text-left", w: "w-[150px]" },
                                        { key: "product", label: "Product", align: "text-left", w: "" },
                                        { key: "amount", label: "Amount", align: "text-right", w: "w-[80px]" },
                                        { key: "from", label: "From", align: "text-center", w: "w-[110px]" },
                                    ].map(c => (
                                        <th key={c.key} className={`px-2 py-2 ${c.align} text-xs text-gray-500 dark:text-gray-400 ${c.w} cursor-pointer hover:text-gray-700 dark:hover:text-gray-200`} onClick={() => handlePopupSort(c.key)}>
                                            <div className={`flex items-center gap-1 ${c.align === "text-right" ? "justify-end" : c.align === "text-center" ? "justify-center" : ""}`}>
                                                {c.label}
                                                {popupSortField === c.key ? (popupSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-2 py-2 text-center text-xs text-gray-500 dark:text-gray-400 w-[20px]"></th>
                                    <th className="px-2 py-2 text-center text-xs text-gray-500 dark:text-gray-400 w-[150px] cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => handlePopupSort("to")}>
                                        <div className="flex items-center gap-1 justify-center">
                                            To
                                            {popupSortField === "to" ? (popupSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                                        </div>
                                    </th>
                                    <th className="px-2 py-2 text-center text-xs text-gray-500 dark:text-gray-400 w-[110px] cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => handlePopupSort("based")}>
                                        <div className="flex items-center gap-1 justify-center">
                                            Based On
                                            {popupSortField === "based" ? (popupSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...labPcReallocations].sort((a, b) => {
                                    if (!popupSortField) return 0;
                                    let va: string | number = "", vb: string | number = "";
                                    if (popupSortField === "date") { va = a.date || ""; vb = b.date || ""; }
                                    else if (popupSortField === "client") { va = (a.clientName || "").toLowerCase(); vb = (b.clientName || "").toLowerCase(); }
                                    else if (popupSortField === "product") { va = (a.product || "").toLowerCase(); vb = (b.product || "").toLowerCase(); }
                                    else if (popupSortField === "amount") { va = a.amount; vb = b.amount; }
                                    else if (popupSortField === "from") { va = a.originalCode; vb = b.originalCode; }
                                    else if (popupSortField === "to") { va = a.newCode; vb = b.newCode; }
                                    else if (popupSortField === "based") { va = a.clientClass; vb = b.clientClass; }
                                    if (va < vb) return popupSortDir === "asc" ? -1 : 1;
                                    if (va > vb) return popupSortDir === "asc" ? 1 : -1;
                                    return 0;
                                }).map((r, idx) => (
                                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                                        <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300 text-xs">{formatDate(r.date)}</td>
                                        <td className="px-2 py-1.5 text-xs">
                                            <div className="text-gray-700 dark:text-gray-300 truncate max-w-[150px]" title={r.clientName}>
                                                {r.clientName}
                                            </div>
                                            {r.clientEmail && (
                                                <div className="text-gray-400 text-[10px] truncate" title={r.clientEmail}>
                                                    {r.clientEmail}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300 text-xs truncate max-w-[200px]" title={r.product}>
                                            {r.product}
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-xs font-mono text-green-500">
                                            {formatEuropeanNumber(r.amount)}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 text-[10px]">
                                                {r.originalCode} {FA_NAMES[r.originalCode] || ""}
                                            </Badge>
                                        </td>
                                        <td className="px-2 py-1.5 text-center text-gray-400">→</td>
                                        <td className="px-2 py-1.5 text-center">
                                            <Badge className={`text-[10px] border ${r.newCode.endsWith(".7")
                                                ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700"
                                                : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700"
                                                }`}>
                                                {r.newCode} {FA_NAMES[r.newCode] || ""}
                                            </Badge>
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            {r.clientClass === "none" ? (
                                                <span className="text-[10px] text-red-400">No subscription</span>
                                            ) : (
                                                <Badge className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-700 text-[10px]">
                                                    {r.clientClass} {FA_NAMES[r.clientClass] || ""}
                                                </Badge>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="shrink-0 pt-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0a0a0a] relative z-20">
                        <div className="flex items-center gap-2 w-full justify-between">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {labPcReallocations.filter(r => r.originalCode === "104.0").length} LAB · {labPcReallocations.filter(r => r.originalCode === "103.0").length} PC rows
                                <span className="text-red-400 ml-2">
                                    {labPcReallocations.filter(r => r.newCode.endsWith(".7")).length} Not a Subscriber
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setLabPcDialogOpen(false);
                                        // Go back: if there were delight rows, go to delight popup; otherwise annualize
                                        const hasDelight = uploadedRows.some((_, i) => rowFACodes[i] === "102.0" || delightCodes[i]);
                                        if (hasDelight) setDelightDialogOpen(true);
                                        else setAnnualizeDialogOpen(true);
                                    }}
                                    disabled={classifying}
                                >
                                    ← Back
                                </Button>
                                <Button
                                    className="bg-amber-600 hover:bg-amber-700 text-white"
                                    onClick={handleLabPcConfirm}
                                    disabled={classifying}
                                >
                                    {classifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                    Confirm & Save
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Manual Add Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700 sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900 dark:text-white text-lg">Add Invoice Order Manually</DialogTitle>
                        <DialogDescription className="text-gray-500 dark:text-gray-400">Fill in the fields below to create a new invoice order entry. Fields marked with * are required.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-3 max-h-[70vh] overflow-y-auto pr-1">
                        {/* ── Section: Dates & Currency ── */}
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Dates & Currency</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-700 dark:text-gray-300">Invoice Date *</Label>
                                    <Input type="date" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-700 dark:text-gray-300">Order Date</Label>
                                    <Input type="date" value={addForm.order_date} onChange={(e) => setAddForm({ ...addForm, order_date: e.target.value })} className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-700 dark:text-gray-300">Currency</Label>
                                    <Select value={addForm.currency} onValueChange={(v) => setAddForm({ ...addForm, currency: v })}>
                                        <SelectTrigger className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700">
                                            <SelectItem value="EUR">EUR</SelectItem>
                                            <SelectItem value="USD">USD</SelectItem>
                                            <SelectItem value="GBP">GBP</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* ── Section: Invoice & Order ── */}
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Invoice & Order</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-700 dark:text-gray-300">Invoice Number</Label>
                                    <Input value={addForm.invoice_number} onChange={(e) => setAddForm({ ...addForm, invoice_number: e.target.value })} placeholder="INV-001" className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-700 dark:text-gray-300">Order Number</Label>
                                    <Input value={addForm.order_number} onChange={(e) => setAddForm({ ...addForm, order_number: e.target.value })} placeholder="ORD-001" className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-700 dark:text-gray-300">Order Status</Label>
                                    <Select value={addForm.order_status} onValueChange={(v) => setAddForm({ ...addForm, order_status: v })}>
                                        <SelectTrigger className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"><SelectValue placeholder="Select status" /></SelectTrigger>
                                        <SelectContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700">
                                            <SelectItem value="Completed">Completed</SelectItem>
                                            <SelectItem value="Processing">Processing</SelectItem>
                                            <SelectItem value="Pending Payment">Pending Payment</SelectItem>
                                            <SelectItem value="Refunded">Refunded</SelectItem>
                                            <SelectItem value="Expired">Expired</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* ── Section: Product & Amount ── */}
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Product & Amount</p>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-700 dark:text-gray-300">Products / Description *</Label>
                                    <Input value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} placeholder="Product name or invoice description" className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-700 dark:text-gray-300">Total / Amount *</Label>
                                        <Input type="number" step="0.01" value={addForm.amount} onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })} placeholder="0.00" className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-700 dark:text-gray-300">Discount</Label>
                                        <Input type="number" step="0.01" value={addForm.discount} onChange={(e) => setAddForm({ ...addForm, discount: e.target.value })} placeholder="0.00" className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-700 dark:text-gray-300">Financial Account *</Label>
                                        <Select value={addForm.financial_account_code} onValueChange={(v) => setAddForm({ ...addForm, financial_account_code: v })}>
                                            <SelectTrigger className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"><SelectValue placeholder="Select FA" /></SelectTrigger>
                                            <SelectContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700 max-h-60">
                                                {FA_OPTIONS_POPUP1.map(fa => (
                                                    <SelectItem key={fa.code} value={fa.code} className="text-xs">{fa.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Section: Customer ── */}
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Customer</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-700 dark:text-gray-300">Client Name</Label>
                                    <Input value={addForm.customer_name} onChange={(e) => setAddForm({ ...addForm, customer_name: e.target.value })} placeholder="Customer / Clinic name" className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-700 dark:text-gray-300">Email</Label>
                                    <Input type="email" value={addForm.customer_email} onChange={(e) => setAddForm({ ...addForm, customer_email: e.target.value })} placeholder="email@example.com" className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-700 dark:text-gray-300">Company</Label>
                                    <Input value={addForm.company} onChange={(e) => setAddForm({ ...addForm, company: e.target.value })} placeholder="Company name" className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-700 dark:text-gray-300">Country</Label>
                                    <Input value={addForm.country} onChange={(e) => setAddForm({ ...addForm, country: e.target.value })} placeholder="e.g. Spain" className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                </div>
                            </div>
                        </div>

                        {/* ── Section: Payment & Billing ── */}
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Payment & Billing</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-700 dark:text-gray-300">Payment Method</Label>
                                    <Input value={addForm.payment_method} onChange={(e) => setAddForm({ ...addForm, payment_method: e.target.value })} placeholder="e.g. Credit Card, Bank Transfer" className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-700 dark:text-gray-300">Billing Entity</Label>
                                    <Input value={addForm.billing_entity} onChange={(e) => setAddForm({ ...addForm, billing_entity: e.target.value })} placeholder="e.g. DSD ES, DSD US" className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-700 dark:text-gray-300">Charged</Label>
                                    <Input value={addForm.charged} onChange={(e) => setAddForm({ ...addForm, charged: e.target.value })} placeholder="e.g. Yes, No, Partial" className="h-9 text-sm bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Cancel</Button>
                        <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleAddManual} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
