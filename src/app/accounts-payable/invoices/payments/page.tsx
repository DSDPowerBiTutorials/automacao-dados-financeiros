"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Wallet,
    Calendar,
    AlertCircle,
    TrendingUp,
    TrendingDown,
    Search,
    Filter,
    DollarSign,
    Clock,
    CheckCircle2,
    XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getMadridDate, parseMadridDate } from "@/lib/date-utils";

interface BankAccount {
    id: string;
    code: string;
    name: string;
    bank_name: string;
    currency: string;
    country: string;
    applies_to_all_countries: boolean;
    current_balance?: number;
    is_active: boolean;
}

interface Invoice {
    id: string;
    invoice_number: string;
    invoice_date: string;
    schedule_date: string;
    due_date: string;
    payment_date: string | null;
    invoice_amount: number;
    currency: string;
    provider_code: string;
    bank_account_code: string | null;
    payment_status: string | null;
    description: string;
    scope: "ES" | "US";
    is_reconciled: boolean;
}

interface PaymentSummary {
    total_scheduled: number;
    total_unscheduled: number;
    total_paid: number;
    total_overdue: number;
    count_scheduled: number;
    count_unscheduled: number;
    count_paid: number;
    count_overdue: number;
}

interface BankAccountBalance {
    account: BankAccount;
    current_balance: number;
    scheduled_payments: number;
    projected_balance: number;
    payment_count: number;
}

export default function PaymentsPage() {
    const { selectedScope } = useGlobalScope();
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "SCHEDULED" | "UNSCHEDULED" | "PAID" | "OVERDUE">("ALL");
    const [accountFilter, setAccountFilter] = useState<string>("ALL");
    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, [selectedScope]);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load bank accounts
            let accountsQuery = supabase
                .from("bank_accounts")
                .select("*")
                .eq("is_active", true);

            // Load invoices
            let invoicesQuery = supabase
                .from("invoices")
                .select("*");

            // Apply scope filter
            if (selectedScope === "GLOBAL") {
                // For GLOBAL view, load all accounts and invoices
                // Bank accounts filter by country or applies_to_all_countries
                accountsQuery = accountsQuery.or("country.in.(ES,US),applies_to_all_countries.eq.true");
                invoicesQuery = invoicesQuery.in("scope", ["ES", "US"]);
            } else {
                // Filter bank accounts by country matching scope
                accountsQuery = accountsQuery.or(`country.eq.${selectedScope},applies_to_all_countries.eq.true`);
                invoicesQuery = invoicesQuery.eq("scope", selectedScope);
            }

            // Order queries
            accountsQuery = accountsQuery.order("code", { ascending: true });
            invoicesQuery = invoicesQuery.order("due_date", { ascending: true, nullsFirst: false });

            const [accountsResult, invoicesResult] = await Promise.all([
                accountsQuery,
                invoicesQuery,
            ]);

            if (accountsResult.error) {
                console.error("Bank accounts error:", accountsResult.error);
                throw accountsResult.error;
            }
            if (invoicesResult.error) {
                console.error("Invoices error:", invoicesResult.error);
                throw invoicesResult.error;
            }

            console.log(`✅ Loaded ${accountsResult.data?.length || 0} bank accounts`);
            console.log(`✅ Loaded ${invoicesResult.data?.length || 0} invoices`);

            setBankAccounts(accountsResult.data || []);
            setInvoices(invoicesResult.data || []);
        } catch (error) {
            console.error("Error loading data:", error);
            toast({
                title: "Error",
                description: "Failed to load payment data. Please check the console for details.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    // Calculate payment summary
    const paymentSummary: PaymentSummary = useMemo(() => {
        const today = getMadridDate();
        today.setHours(0, 0, 0, 0);

        let total_scheduled = 0;
        let total_unscheduled = 0;
        let total_paid = 0;
        let total_overdue = 0;
        let count_scheduled = 0;
        let count_unscheduled = 0;
        let count_paid = 0;
        let count_overdue = 0;

        invoices.forEach((inv) => {
            const scheduleDate = parseMadridDate(inv.schedule_date);
            const isPaid = inv.payment_date !== null || inv.is_reconciled;
            const hasAccount = inv.bank_account_code !== null && inv.bank_account_code !== "";
            const isOverdue = scheduleDate < today && !isPaid;

            if (isPaid) {
                total_paid += inv.invoice_amount;
                count_paid++;
            } else if (isOverdue) {
                total_overdue += inv.invoice_amount;
                count_overdue++;
            } else if (hasAccount) {
                total_scheduled += inv.invoice_amount;
                count_scheduled++;
            } else {
                total_unscheduled += inv.invoice_amount;
                count_unscheduled++;
            }
        });

        return {
            total_scheduled,
            total_unscheduled,
            total_paid,
            total_overdue,
            count_scheduled,
            count_unscheduled,
            count_paid,
            count_overdue,
        };
    }, [invoices]);

    // Calculate bank account balances
    const accountBalances: BankAccountBalance[] = useMemo(() => {
        return bankAccounts.map((account) => {
            const accountInvoices = invoices.filter(
                (inv) =>
                    inv.bank_account_code === account.code &&
                    !inv.payment_date &&
                    !inv.is_reconciled
            );

            const scheduled_payments = accountInvoices.reduce(
                (sum, inv) => sum + inv.invoice_amount,
                0
            );

            // For now, current_balance is 0 (will be updated later with real data)
            const current_balance = account.current_balance || 0;
            const projected_balance = current_balance - scheduled_payments;

            return {
                account,
                current_balance,
                scheduled_payments,
                projected_balance,
                payment_count: accountInvoices.length,
            };
        });
    }, [bankAccounts, invoices]);

    // Separate scheduled and unscheduled invoices
    const { scheduledInvoices, unscheduledInvoices } = useMemo(() => {
        const scheduled: Invoice[] = [];
        const unscheduled: Invoice[] = [];

        const today = getMadridDate();
        today.setHours(0, 0, 0, 0);

        invoices.forEach((inv) => {
            const hasAccount = inv.bank_account_code !== null && inv.bank_account_code !== "";

            if (hasAccount) {
                scheduled.push(inv);
            } else {
                unscheduled.push(inv);
            }
        });

        return { scheduledInvoices: scheduled, unscheduledInvoices: unscheduled };
    }, [invoices]);

    // Filter scheduled invoices
    const filteredScheduledInvoices = useMemo(() => {
        const today = getMadridDate();
        today.setHours(0, 0, 0, 0);

        return scheduledInvoices.filter((inv) => {
            // Search filter
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                if (
                    !inv.invoice_number?.toLowerCase().includes(search) &&
                    !inv.provider_code?.toLowerCase().includes(search) &&
                    !inv.description?.toLowerCase().includes(search)
                ) {
                    return false;
                }
            }

            // Account filter
            if (accountFilter !== "ALL" && accountFilter !== "NONE") {
                if (inv.bank_account_code !== accountFilter) return false;
            }

            // Status filter
            if (statusFilter !== "ALL" && statusFilter !== "UNSCHEDULED") {
                const scheduleDate = parseMadridDate(inv.schedule_date);
                const isPaid = inv.payment_date !== null || inv.is_reconciled;
                const isOverdue = scheduleDate < today && !isPaid;

                if (statusFilter === "PAID" && !isPaid) return false;
                if (statusFilter === "OVERDUE" && !isOverdue) return false;
                if (statusFilter === "SCHEDULED" && (isPaid || isOverdue)) return false;
            }

            return true;
        });
    }, [scheduledInvoices, searchTerm, statusFilter, accountFilter]);

    // Filter unscheduled invoices
    const filteredUnscheduledInvoices = useMemo(() => {
        return unscheduledInvoices.filter((inv) => {
            // Search filter
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                if (
                    !inv.invoice_number?.toLowerCase().includes(search) &&
                    !inv.provider_code?.toLowerCase().includes(search) &&
                    !inv.description?.toLowerCase().includes(search)
                ) {
                    return false;
                }
            }

            // Status filter - only show unscheduled if filter is ALL or UNSCHEDULED
            if (statusFilter !== "ALL" && statusFilter !== "UNSCHEDULED") {
                return false;
            }

            return true;
        });
    }, [unscheduledInvoices, searchTerm, statusFilter]);

    const getStatusBadge = (invoice: Invoice) => {
        const today = getMadridDate();
        today.setHours(0, 0, 0, 0);
        const scheduleDate = parseMadridDate(invoice.schedule_date);
        const isPaid = invoice.payment_date !== null || invoice.is_reconciled;
        const hasAccount = invoice.bank_account_code !== null && invoice.bank_account_code !== "";
        const isOverdue = scheduleDate < today && !isPaid;

        if (isPaid) {
            return (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Paid
                </Badge>
            );
        }
        if (isOverdue) {
            return (
                <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                    <XCircle className="h-3 w-3 mr-1" />
                    Overdue
                </Badge>
            );
        }
        if (hasAccount) {
            return (
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                    <Calendar className="h-3 w-3 mr-1" />
                    Scheduled
                </Badge>
            );
        }
        return (
            <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unscheduled
            </Badge>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading payment data...</p>
                </div>
            </div>
        );
    }

    const mainCurrency = selectedScope === "US" ? "USD" : "EUR";

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Management</h1>
                <p className="text-gray-600">
                    Monitor cash flow, bank balances, and payment schedules
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Scheduled Payments</CardTitle>
                        <Calendar className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(paymentSummary.total_scheduled, mainCurrency)}</div>
                        <p className="text-xs text-gray-600 mt-1">
                            {paymentSummary.count_scheduled} invoice{paymentSummary.count_scheduled !== 1 ? "s" : ""}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Unscheduled</CardTitle>
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(paymentSummary.total_unscheduled, mainCurrency)}</div>
                        <p className="text-xs text-gray-600 mt-1">
                            {paymentSummary.count_unscheduled} invoice{paymentSummary.count_unscheduled !== 1 ? "s" : ""} without bank account
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                        <XCircle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {formatCurrency(paymentSummary.total_overdue, mainCurrency)}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                            {paymentSummary.count_overdue} invoice{paymentSummary.count_overdue !== 1 ? "s" : ""} past due
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Paid</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(paymentSummary.total_paid, mainCurrency)}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                            {paymentSummary.count_paid} invoice{paymentSummary.count_paid !== 1 ? "s" : ""} completed
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Bank Account Balances */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-blue-600" />
                        Bank Account Balances & Projections
                    </CardTitle>
                    <CardDescription>
                        Current balances and projected balances after scheduled payments
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {accountBalances.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">No active bank accounts found</p>
                        ) : (
                            accountBalances.map((balance) => (
                                <div
                                    key={balance.account.id}
                                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="font-semibold text-gray-900">{balance.account.name}</h3>
                                            <Badge variant="outline" className="text-xs">
                                                {balance.account.code}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                {balance.account.currency}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-gray-600">{balance.account.bank_name}</p>
                                    </div>

                                    <div className="flex items-center gap-8">
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 mb-1">Current Balance</p>
                                            <p className="text-lg font-bold text-gray-900">
                                                {formatCurrency(balance.current_balance, balance.account.currency)}
                                            </p>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 mb-1">Scheduled Payments</p>
                                            <p className="text-lg font-semibold text-red-600">
                                                -{formatCurrency(balance.scheduled_payments, balance.account.currency)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {balance.payment_count} payment{balance.payment_count !== 1 ? "s" : ""}
                                            </p>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 mb-1">Projected Balance</p>
                                            <p
                                                className={`text-lg font-bold ${balance.projected_balance >= 0 ? "text-green-600" : "text-red-600"
                                                    }`}
                                            >
                                                {formatCurrency(balance.projected_balance, balance.account.currency)}
                                            </p>
                                            {balance.projected_balance < 0 && (
                                                <div className="flex items-center gap-1 text-red-600 text-xs mt-1">
                                                    <TrendingDown className="h-3 w-3" />
                                                    Insufficient funds
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Scheduled Payments */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        Payment Schedule
                    </CardTitle>
                    <CardDescription>Payments with assigned bank accounts and schedule dates</CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="flex flex-wrap gap-4 mb-6">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search invoices..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Status</SelectItem>
                                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                                <SelectItem value="UNSCHEDULED">Unscheduled</SelectItem>
                                <SelectItem value="PAID">Paid</SelectItem>
                                <SelectItem value="OVERDUE">Overdue</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={accountFilter} onValueChange={setAccountFilter}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Bank Account" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Accounts</SelectItem>
                                {bankAccounts.map((acc) => (
                                    <SelectItem key={acc.id} value={acc.code}>
                                        {acc.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Invoice</TableHead>
                                    <TableHead>Provider</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Schedule Date</TableHead>
                                    <TableHead>Bank Account</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredScheduledInvoices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                            No scheduled payments found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredScheduledInvoices.map((invoice) => (
                                        <TableRow key={invoice.id}>
                                            <TableCell className="font-medium">
                                                <div>
                                                    <p className="font-semibold">{invoice.invoice_number}</p>
                                                    <p className="text-xs text-gray-500">{formatDate(invoice.invoice_date)}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{invoice.provider_code}</p>
                                                    {invoice.description && (
                                                        <p className="text-xs text-gray-500 truncate max-w-[200px]">
                                                            {invoice.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <p className="font-semibold">
                                                    {formatCurrency(invoice.invoice_amount, invoice.currency)}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{formatDate(invoice.schedule_date)}</p>
                                                    {invoice.payment_date && (
                                                        <p className="text-xs text-green-600">
                                                            Paid: {formatDate(invoice.payment_date)}
                                                        </p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{invoice.bank_account_code}</Badge>
                                            </TableCell>
                                            <TableCell>{getStatusBadge(invoice)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm">
                                                    View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Summary */}
                    <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                        <p>
                            Showing {filteredScheduledInvoices.length} of {scheduledInvoices.length} scheduled payment
                            {scheduledInvoices.length !== 1 ? "s" : ""}
                        </p>
                        <p>
                            Total:{" "}
                            <span className="font-semibold">
                                {formatCurrency(
                                    filteredScheduledInvoices.reduce((sum, inv) => sum + inv.invoice_amount, 0),
                                    mainCurrency
                                )}
                            </span>
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Unscheduled Payments */}
            <Card className="border-yellow-200 bg-yellow-50/30">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                        Unscheduled Payments
                    </CardTitle>
                    <CardDescription>
                        Invoices without bank account assignment - organize these payments to add them to your schedule
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Table */}
                    <div className="border rounded-lg overflow-hidden bg-white">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Invoice</TableHead>
                                    <TableHead>Provider</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Due Date</TableHead>
                                    <TableHead>Days Until Due</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUnscheduledInvoices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                            {statusFilter === "UNSCHEDULED" || statusFilter === "ALL"
                                                ? "No unscheduled payments - all invoices have been organized!"
                                                : "No unscheduled payments match the current filter"}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUnscheduledInvoices.map((invoice) => {
                                        const today = getMadridDate();
                                        today.setHours(0, 0, 0, 0);
                                        const dueDate = parseMadridDate(invoice.due_date);
                                        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                        const isOverdue = daysUntilDue < 0;

                                        return (
                                            <TableRow key={invoice.id} className={isOverdue ? "bg-red-50" : ""}>
                                                <TableCell className="font-medium">
                                                    <div>
                                                        <p className="font-semibold">{invoice.invoice_number}</p>
                                                        <p className="text-xs text-gray-500">{formatDate(invoice.invoice_date)}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{invoice.provider_code}</p>
                                                        {invoice.description && (
                                                            <p className="text-xs text-gray-500 truncate max-w-[200px]">
                                                                {invoice.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="font-semibold">
                                                        {formatCurrency(invoice.invoice_amount, invoice.currency)}
                                                    </p>
                                                </TableCell>
                                                <TableCell>
                                                    <p className={`font-medium ${isOverdue ? "text-red-600" : ""}`}>
                                                        {formatDate(invoice.due_date)}
                                                    </p>
                                                </TableCell>
                                                <TableCell>
                                                    {isOverdue ? (
                                                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                                                            <XCircle className="h-3 w-3 mr-1" />
                                                            {Math.abs(daysUntilDue)} day{Math.abs(daysUntilDue) !== 1 ? "s" : ""} overdue
                                                        </Badge>
                                                    ) : daysUntilDue === 0 ? (
                                                        <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                                                            <Clock className="h-3 w-3 mr-1" />
                                                            Due today
                                                        </Badge>
                                                    ) : daysUntilDue <= 7 ? (
                                                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                                            <Clock className="h-3 w-3 mr-1" />
                                                            {daysUntilDue} day{daysUntilDue !== 1 ? "s" : ""} left
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline">
                                                            {daysUntilDue} days left
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" className="text-blue-600 hover:text-blue-700">
                                                        Schedule Payment
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Summary */}
                    {filteredUnscheduledInvoices.length > 0 && (
                        <div className="mt-4 flex items-center justify-between text-sm">
                            <p className="text-gray-600">
                                Showing {filteredUnscheduledInvoices.length} of {unscheduledInvoices.length} unscheduled payment
                                {unscheduledInvoices.length !== 1 ? "s" : ""}
                            </p>
                            <div className="flex items-center gap-4">
                                <p className="text-gray-600">
                                    Total:{" "}
                                    <span className="font-semibold text-yellow-700">
                                        {formatCurrency(
                                            filteredUnscheduledInvoices.reduce((sum, inv) => sum + inv.invoice_amount, 0),
                                            mainCurrency
                                        )}
                                    </span>
                                </p>
                                <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white">
                                    Organize All Payments
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
