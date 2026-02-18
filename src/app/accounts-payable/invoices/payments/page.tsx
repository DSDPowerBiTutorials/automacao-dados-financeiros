"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Wallet,
    TrendingDown,
    TrendingUp,
    Calendar,
    AlertCircle,
    CheckCircle2,
    BarChart3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getMadridDate, parseMadridDate } from "@/lib/date-utils";

interface BankAccount {
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
    id: number;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    schedule_date: string | null;
    payment_date: string | null;
    invoice_amount: number;
    currency: string;
    provider_code: string;
    bank_account_code: string | null;
    scope: string;
    is_reconciled: boolean;
}

interface AccountBalance {
    account: BankAccount;
    current_balance: number;
    scheduled_payments: number;
    paid_in_period: number;
    projected_balance: number;
}

export default function PaymentsPage() {
    const { selectedScope } = useGlobalScope();
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    // Date range filter
    const today = useMemo(() => getMadridDate(), []);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(today);
        d.setDate(d.getDate() - 30); // Last 30 days by default
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
    const [dateFilterType, setDateFilterType] = useState<"due_date" | "schedule_date" | "invoice_date" | "payment_date">("due_date");

    useEffect(() => {
        loadData();
    }, [selectedScope]);

    // Filter bank accounts by scope
    const visibleBankAccounts = useMemo(() => {
        if (selectedScope === "GLOBAL") {
            return bankAccounts;
        }
        return bankAccounts.filter(
            (acc) => acc.country === selectedScope || acc.applies_to_all_countries
        );
    }, [bankAccounts, selectedScope]);

    // Filter invoices by scope and date range
    const filteredInvoices = useMemo(() => {
        return allInvoices.filter((inv) => {
            // Scope filter
            if (selectedScope !== "GLOBAL" && inv.scope !== selectedScope) {
                return false;
            }

            // Get the date to compare based on filter type
            let dateToCompare: string | null = null;
            switch (dateFilterType) {
                case "due_date":
                    dateToCompare = inv.due_date;
                    break;
                case "schedule_date":
                    dateToCompare = inv.schedule_date;
                    break;
                case "invoice_date":
                    dateToCompare = inv.invoice_date;
                    break;
                case "payment_date":
                    dateToCompare = inv.payment_date;
                    break;
            }

            if (!dateToCompare) return false;

            const compareDate = parseMadridDate(dateToCompare);
            const startD = parseMadridDate(startDate);
            const endD = parseMadridDate(endDate);

            return compareDate >= startD && compareDate <= endD;
        });
    }, [allInvoices, selectedScope, startDate, endDate, dateFilterType]);

    // Separate by status
    const { pendingPayments, scheduledPayments, paidInPeriod } = useMemo(() => {
        const pending: Invoice[] = [];
        const scheduled: Invoice[] = [];
        const paid: Invoice[] = [];

        filteredInvoices.forEach((inv) => {
            const isPaid = inv.payment_date !== null || inv.is_reconciled;

            if (isPaid) {
                paid.push(inv);
            } else if (inv.schedule_date) {
                scheduled.push(inv);
            } else {
                pending.push(inv);
            }
        });

        return { pendingPayments: pending, scheduledPayments: scheduled, paidInPeriod: paid };
    }, [filteredInvoices]);

    // Calculate totals
    const totals = useMemo(() => {
        const pending = pendingPayments.reduce((sum, inv) => sum + inv.invoice_amount, 0);
        const scheduled = scheduledPayments.reduce((sum, inv) => sum + inv.invoice_amount, 0);
        const paid = paidInPeriod.reduce((sum, inv) => sum + inv.invoice_amount, 0);

        // Count invoices with due dates inside/outside period
        const todayDate = parseMadridDate(today.toISOString().split('T')[0]);
        const startD = parseMadridDate(startDate);
        const endD = parseMadridDate(endDate);
        const isPastPeriod = endD < todayDate;

        let duingInsidePeriod = 0;
        let dueOutsidePeriod = 0;

        [...pendingPayments, ...scheduledPayments].forEach((inv) => {
            if (inv.due_date) {
                const dueDate = parseMadridDate(inv.due_date);
                const isInPeriod = dueDate >= startD && dueDate <= endD;

                // If past period and invoice is paid, don't count it in due calculations
                if (isPastPeriod && (inv.payment_date || inv.is_reconciled)) {
                    return;
                }

                if (isInPeriod) {
                    duingInsidePeriod++;
                } else {
                    dueOutsidePeriod++;
                }
            }
        });

        return {
            pending,
            scheduled,
            paid,
            dueInsidePeriod: duingInsidePeriod,
            dueOutsidePeriod: dueOutsidePeriod
        };
    }, [pendingPayments, scheduledPayments, paidInPeriod, startDate, endDate, today]);

    // Account balances
    const accountBalances: AccountBalance[] = useMemo(() => {
        return visibleBankAccounts.map((account) => {
            const accountPending = pendingPayments.filter(
                (inv) => inv.bank_account_code === account.code
            );
            const accountScheduled = scheduledPayments.filter(
                (inv) => inv.bank_account_code === account.code
            );
            const accountPaid = paidInPeriod.filter(
                (inv) => inv.bank_account_code === account.code
            );

            const scheduled_payments = [...accountPending, ...accountScheduled].reduce(
                (sum, inv) => sum + inv.invoice_amount,
                0
            );
            const paid_in_period = accountPaid.reduce(
                (sum, inv) => sum + inv.invoice_amount,
                0
            );

            const current_balance = account.current_balance || 0;
            const projected_balance = current_balance - scheduled_payments;

            return {
                account,
                current_balance,
                scheduled_payments,
                paid_in_period,
                projected_balance,
            };
        });
    }, [visibleBankAccounts, pendingPayments, scheduledPayments, paidInPeriod]);

    // Summary card stats
    const summaryStats = useMemo(() => {
        const totalBalance = visibleBankAccounts.reduce(
            (sum, acc) => sum + (acc.current_balance || 0),
            0
        );
        const totalProjected = accountBalances.reduce(
            (sum, ab) => sum + ab.projected_balance,
            0
        );

        return {
            totalBalance,
            totalProjected,
            projection: totalProjected - totalBalance,
            pendingCount: pendingPayments.length,
            scheduledCount: scheduledPayments.length,
            paidCount: paidInPeriod.length,
        };
    }, [visibleBankAccounts, accountBalances, pendingPayments, scheduledPayments, paidInPeriod]);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load bank accounts
            const accountsQuery = supabase
                .from("bank_accounts")
                .select("code, name, bank_name, currency, country, applies_to_all_countries, current_balance, is_active")
                .eq("is_active", true);

            // Load invoices with schedule_date
            let invoicesQuery = supabase
                .from("invoices")
                .select("*")
                .not("schedule_date", "is", null);

            // Filter invoices by scope
            if (selectedScope !== "GLOBAL") {
                invoicesQuery = invoicesQuery.eq("scope", selectedScope);
            }

            const [accountsResult, invoicesResult] = await Promise.all([
                accountsQuery.order("code", { ascending: true }),
                invoicesQuery.order("schedule_date", { ascending: true }),
            ]);

            if (accountsResult.error) throw accountsResult.error;
            if (invoicesResult.error) throw invoicesResult.error;

            // Filter accounts by scope in memory
            let filteredAccounts = accountsResult.data || [];
            if (selectedScope !== "GLOBAL") {
                filteredAccounts = filteredAccounts.filter(
                    (acc) => acc.country === selectedScope || acc.applies_to_all_countries
                );
            }

            console.log(`✅ [${selectedScope}] Loaded ${filteredAccounts.length} bank accounts (from ${accountsResult.data?.length || 0} total)`);
            console.log(`✅ [${selectedScope}] Loaded ${invoicesResult.data?.length || 0} invoices with schedule_date`);

            setBankAccounts(filteredAccounts);
            setAllInvoices(invoicesResult.data || []);
        } catch (error: any) {
            console.error("Error loading data:", error);
            console.error("Error details:", {
                message: error?.message,
                details: error?.details,
                hint: error?.hint,
                code: error?.code
            });
            toast({
                title: "Error",
                description: error?.message || "Failed to load cash data",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-gray-200 rounded-lg"></div>
                    <div className="grid grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full px-6 space-y-6 py-6">
            {/* Header */}
            <header className="page-header-standard">
                <div>
                    <h1 className="header-title">Cash Management</h1>
                    <p className="header-subtitle">View cash position, scheduled payments, and account balances</p>
                </div>
            </header>

            {/* Date Filter Type Selector */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Filter By Date Type</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant={dateFilterType === "due_date" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setDateFilterType("due_date")}
                        >
                            Due Date
                        </Button>
                        <Button
                            variant={dateFilterType === "schedule_date" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setDateFilterType("schedule_date")}
                        >
                            Benefit Date (Schedule)
                        </Button>
                        <Button
                            variant={dateFilterType === "invoice_date" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setDateFilterType("invoice_date")}
                        >
                            Invoice Date
                        </Button>
                        <Button
                            variant={dateFilterType === "payment_date" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setDateFilterType("payment_date")}
                        >
                            Payment Date (Input)
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Date Range Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="space-y-4">
                        <div className="flex items-end gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">From Date</label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-36"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">To Date</label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-36"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <p className="text-sm font-medium text-gray-700 mb-2">Past Periods</p>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const d = new Date(today);
                                        d.setDate(d.getDate() - 30);
                                        setStartDate(d.toISOString().split('T')[0]);
                                        setEndDate(today.toISOString().split('T')[0]);
                                    }}>Last 30 Days</Button>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const d = new Date(today);
                                        d.setDate(d.getDate() - 25);
                                        setStartDate(d.toISOString().split('T')[0]);
                                        setEndDate(today.toISOString().split('T')[0]);
                                    }}>Last 25 Days</Button>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const d = new Date(today);
                                        d.setDate(d.getDate() - 20);
                                        setStartDate(d.toISOString().split('T')[0]);
                                        setEndDate(today.toISOString().split('T')[0]);
                                    }}>Last 20 Days</Button>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const d = new Date(today);
                                        d.setDate(d.getDate() - 15);
                                        setStartDate(d.toISOString().split('T')[0]);
                                        setEndDate(today.toISOString().split('T')[0]);
                                    }}>Last 15 Days</Button>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const d = new Date(today);
                                        d.setDate(d.getDate() - 10);
                                        setStartDate(d.toISOString().split('T')[0]);
                                        setEndDate(today.toISOString().split('T')[0]);
                                    }}>Last 10 Days</Button>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const d = new Date(today);
                                        d.setDate(d.getDate() - 7);
                                        setStartDate(d.toISOString().split('T')[0]);
                                        setEndDate(today.toISOString().split('T')[0]);
                                    }}>Past Week</Button>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-700 mb-2">Future Periods</p>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const d = new Date(today);
                                        d.setDate(d.getDate() + 7);
                                        setStartDate(today.toISOString().split('T')[0]);
                                        setEndDate(d.toISOString().split('T')[0]);
                                    }}>Next Week</Button>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const d = new Date(today);
                                        d.setDate(d.getDate() + 10);
                                        setStartDate(today.toISOString().split('T')[0]);
                                        setEndDate(d.toISOString().split('T')[0]);
                                    }}>Next 10 Days</Button>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const d = new Date(today);
                                        d.setDate(d.getDate() + 15);
                                        setStartDate(today.toISOString().split('T')[0]);
                                        setEndDate(d.toISOString().split('T')[0]);
                                    }}>Next 15 Days</Button>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const d = new Date(today);
                                        d.setDate(d.getDate() + 20);
                                        setStartDate(today.toISOString().split('T')[0]);
                                        setEndDate(d.toISOString().split('T')[0]);
                                    }}>Next 20 Days</Button>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const d = new Date(today);
                                        d.setDate(d.getDate() + 25);
                                        setStartDate(today.toISOString().split('T')[0]);
                                        setEndDate(d.toISOString().split('T')[0]);
                                    }}>Next 25 Days</Button>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const d = new Date(today);
                                        d.setDate(d.getDate() + 30);
                                        setStartDate(today.toISOString().split('T')[0]);
                                        setEndDate(d.toISOString().split('T')[0]);
                                    }}>Next 30 Days</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-5 gap-4">
                {/* Total Balance */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-blue-600" />
                            Current Balance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(summaryStats.totalBalance, "EUR")}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">All visible accounts</p>
                    </CardContent>
                </Card>

                {/* Pending Payments */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                            Pending ({summaryStats.pendingCount})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                            {formatCurrency(totals.pending, "EUR")}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Unscheduled payments</p>
                    </CardContent>
                </Card>

                {/* Scheduled Payments */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            Scheduled ({summaryStats.scheduledCount})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {formatCurrency(totals.scheduled, "EUR")}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {totals.dueInsidePeriod} due inside period
                        </p>
                    </CardContent>
                </Card>

                {/* Paid in Period */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            Paid ({summaryStats.paidCount})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(totals.paid, "EUR")}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">In selected period</p>
                    </CardContent>
                </Card>

                {/* Projected Balance */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-purple-600" />
                            Projected Balance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${summaryStats.projection >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(summaryStats.totalProjected, "EUR")}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {summaryStats.projection >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(summaryStats.projection), "EUR")}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Due Date Summary */}
            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-blue-900">
                                Due Inside Selected Period
                            </p>
                            <p className="text-3xl font-bold text-blue-700 mt-1">
                                {totals.dueInsidePeriod} invoices
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-medium text-gray-700">
                                Due Outside Period
                            </p>
                            <p className="text-2xl font-semibold text-gray-600 mt-1">
                                {totals.dueOutsidePeriod} invoices
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Bank Accounts Grid */}
            {accountBalances.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-blue-600" />
                            Account Status
                        </CardTitle>
                        <CardDescription>
                            Current balance, scheduled payments, and projected balance
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            {accountBalances.map((ab, idx) => (
                                <Card key={`account-${ab.account.code}-${idx}`} className="bg-gray-50">
                                    <CardContent className="pt-6">
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-sm font-medium text-gray-600">
                                                    {ab.account.name}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {ab.account.bank_name} • {ab.account.currency}
                                                </p>
                                            </div>

                                            {/* Current Balance */}
                                            <div>
                                                <p className="text-xs font-medium text-gray-500 mb-1">Current Balance</p>
                                                <p className="text-xl font-bold text-blue-600">
                                                    {formatCurrency(ab.current_balance, ab.account.currency)}
                                                </p>
                                            </div>

                                            {/* Scheduled */}
                                            {ab.scheduled_payments > 0 && (
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 mb-1">
                                                        Scheduled Payments
                                                    </p>
                                                    <p className="text-lg font-semibold text-red-600">
                                                        -{formatCurrency(ab.scheduled_payments, ab.account.currency)}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Paid in period */}
                                            {ab.paid_in_period > 0 && (
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 mb-1">
                                                        Paid in Period
                                                    </p>
                                                    <p className="text-lg font-semibold text-green-600">
                                                        {formatCurrency(ab.paid_in_period, ab.account.currency)}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Projected */}
                                            <div className="pt-2 border-t">
                                                <p className="text-xs font-medium text-gray-500 mb-1">
                                                    Projected Balance
                                                </p>
                                                <p className={`text-lg font-bold ${ab.projected_balance >= 0 ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                    {formatCurrency(ab.projected_balance, ab.account.currency)}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Pending Payments Section */}
            {pendingPayments.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-orange-600" />
                            Pending Payments ({pendingPayments.length})
                        </CardTitle>
                        <CardDescription>
                            Unscheduled invoices without a scheduled payment date
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50">
                                        <TableHead>Invoice</TableHead>
                                        <TableHead>Provider</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Account</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingPayments.map((inv) => (
                                        <TableRow key={inv.id}>
                                            <TableCell className="font-mono text-sm">
                                                {inv.invoice_number}
                                            </TableCell>
                                            <TableCell>{inv.provider_code}</TableCell>
                                            <TableCell>
                                                {formatDate(inv.due_date)}
                                            </TableCell>
                                            <TableCell className="font-semibold text-orange-600">
                                                {formatCurrency(inv.invoice_amount, inv.currency)}
                                            </TableCell>
                                            <TableCell>
                                                {inv.bank_account_code ? (
                                                    <Badge variant="outline">{inv.bank_account_code}</Badge>
                                                ) : (
                                                    <span className="badge-light-warning">
                                                        Not Assigned
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Scheduled Payments Section */}
            {scheduledPayments.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-blue-600" />
                            Scheduled Payments ({scheduledPayments.length})
                        </CardTitle>
                        <CardDescription>
                            Invoices with a scheduled payment date (benefit date)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50">
                                        <TableHead>Invoice</TableHead>
                                        <TableHead>Provider</TableHead>
                                        <TableHead>Schedule Date</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Account</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {scheduledPayments.map((inv) => (
                                        <TableRow key={inv.id}>
                                            <TableCell className="font-mono text-sm">
                                                {inv.invoice_number}
                                            </TableCell>
                                            <TableCell>{inv.provider_code}</TableCell>
                                            <TableCell className="font-semibold text-blue-600">
                                                {formatDate(inv.schedule_date!)}
                                            </TableCell>
                                            <TableCell>
                                                {formatDate(inv.due_date)}
                                            </TableCell>
                                            <TableCell className="font-semibold">
                                                {formatCurrency(inv.invoice_amount, inv.currency)}
                                            </TableCell>
                                            <TableCell>
                                                {inv.bank_account_code ? (
                                                    <Badge variant="outline">{inv.bank_account_code}</Badge>
                                                ) : (
                                                    <span className="badge-light-warning">
                                                        Not Assigned
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {paidInPeriod.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            Paid Invoices ({paidInPeriod.length})
                        </CardTitle>
                        <CardDescription>
                            Invoices paid in the selected period
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50">
                                        <TableHead>Invoice</TableHead>
                                        <TableHead>Provider</TableHead>
                                        <TableHead>Scheduled</TableHead>
                                        <TableHead>Paid Date</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Account</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paidInPeriod.map((inv) => (
                                        <TableRow key={inv.id} className="bg-green-50">
                                            <TableCell className="font-mono text-sm">
                                                {inv.invoice_number}
                                            </TableCell>
                                            <TableCell>{inv.provider_code}</TableCell>
                                            <TableCell>
                                                {formatDate(inv.schedule_date || inv.due_date)}
                                            </TableCell>
                                            <TableCell>
                                                {formatDate(inv.payment_date || "")}
                                            </TableCell>
                                            <TableCell className="font-semibold">
                                                {formatCurrency(inv.invoice_amount, inv.currency)}
                                            </TableCell>
                                            <TableCell>
                                                {inv.bank_account_code ? (
                                                    <Badge variant="outline">{inv.bank_account_code}</Badge>
                                                ) : (
                                                    <Badge variant="secondary">-</Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {toPayInPeriod.length === 0 && paidInPeriod.length === 0 && (
                <Card>
                    <CardContent className="pt-12 text-center">
                        <Calendar className="h-12 w-12 text-gray-700 dark:text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No invoices found in the selected period</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
