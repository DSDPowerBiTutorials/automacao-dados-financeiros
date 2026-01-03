"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Search, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Customer {
    code: string;
    name: string;
    tax_id: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    country: string;
    currency: string;
    payment_terms: string;
    credit_limit: number | null;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [formData, setFormData] = useState({
        code: "",
        name: "",
        tax_id: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        postal_code: "",
        country: "ES",
        currency: "EUR",
        payment_terms: "net_30",
        credit_limit: "",
        notes: "",
    });

    useEffect(() => {
        loadCustomers();
    }, []);

    async function loadCustomers() {
        try {
            const { data, error } = await supabase
                .from("customers")
                .select("*")
                .order("code");

            if (error) throw error;
            setCustomers(data || []);
        } catch (error: any) {
            toast({
                title: "Error loading customers",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        try {
            if (!formData.name || !formData.country) {
                toast({
                    title: "Validation error",
                    description: "Name and Country are required",
                    variant: "destructive",
                });
                return;
            }

            // Generate code if new customer
            let code = formData.code;
            if (!editingCustomer) {
                const { data: existing } = await supabase
                    .from("customers")
                    .select("code")
                    .like("code", `${formData.country}-CU%`)
                    .order("code", { ascending: false })
                    .limit(1);

                if (existing && existing.length > 0) {
                    const lastCode = existing[0].code;
                    const lastNumber = parseInt(lastCode.split("-CU")[1]) || 0;
                    code = `${formData.country}-CU${String(lastNumber + 1).padStart(5, "0")}`;
                } else {
                    code = `${formData.country}-CU00001`;
                }
            }

            const customerData = {
                code,
                name: formData.name,
                tax_id: formData.tax_id || null,
                email: formData.email || null,
                phone: formData.phone || null,
                address: formData.address || null,
                city: formData.city || null,
                postal_code: formData.postal_code || null,
                country: formData.country,
                currency: formData.currency,
                payment_terms: formData.payment_terms,
                credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : null,
                notes: formData.notes || null,
                is_active: true,
                updated_at: new Date().toISOString(),
            };

            if (editingCustomer) {
                const { error } = await supabase
                    .from("customers")
                    .update(customerData)
                    .eq("code", editingCustomer.code);

                if (error) throw error;
                toast({ title: "Customer updated successfully" });
            } else {
                const { error } = await supabase.from("customers").insert(customerData);

                if (error) throw error;
                toast({ title: "Customer created successfully" });
            }

            setIsDialogOpen(false);
            setEditingCustomer(null);
            setFormData({
                code: "",
                name: "",
                tax_id: "",
                email: "",
                phone: "",
                address: "",
                city: "",
                postal_code: "",
                country: "ES",
                currency: "EUR",
                payment_terms: "net_30",
                credit_limit: "",
                notes: "",
            });
            loadCustomers();
        } catch (error: any) {
            toast({
                title: "Error saving customer",
                description: error.message,
                variant: "destructive",
            });
        }
    }

    async function handleDelete(customer: Customer) {
        if (!confirm(`Delete customer ${customer.name}?`)) return;

        try {
            const { error } = await supabase.from("customers").delete().eq("code", customer.code);

            if (error) throw error;
            toast({ title: "Customer deleted successfully" });
            loadCustomers();
        } catch (error: any) {
            toast({
                title: "Error deleting customer",
                description: error.message,
                variant: "destructive",
            });
        }
    }

    function handleEdit(customer: Customer) {
        setEditingCustomer(customer);
        setFormData({
            code: customer.code,
            name: customer.name,
            tax_id: customer.tax_id || "",
            email: customer.email || "",
            phone: customer.phone || "",
            address: customer.address || "",
            city: customer.city || "",
            postal_code: customer.postal_code || "",
            country: customer.country,
            currency: customer.currency,
            payment_terms: customer.payment_terms,
            credit_limit: customer.credit_limit?.toString() || "",
            notes: customer.notes || "",
        });
        setIsDialogOpen(true);
    }

    function handleAddNew() {
        setEditingCustomer(null);
        setFormData({
            code: "",
            name: "",
            tax_id: "",
            email: "",
            phone: "",
            address: "",
            city: "",
            postal_code: "",
            country: "ES",
            currency: "EUR",
            payment_terms: "net_30",
            credit_limit: "",
            notes: "",
        });
        setIsDialogOpen(true);
    }

    const filteredCustomers = useMemo(() => {
        return customers.filter(
            (c) =>
                c.name.toLowerCase().includes(search.toLowerCase()) ||
                c.code.toLowerCase().includes(search.toLowerCase()) ||
                c.email?.toLowerCase().includes(search.toLowerCase()) ||
                c.tax_id?.toLowerCase().includes(search.toLowerCase())
        );
    }, [customers, search]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Customers</h1>
                    <p className="text-gray-500 mt-1">Manage customer information for Accounts Receivable</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={handleAddNew}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Customer
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingCustomer ? "Edit Customer" : "New Customer"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="name">Customer Name *</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Customer Inc."
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="tax_id">Tax ID / VAT</Label>
                                    <Input
                                        id="tax_id"
                                        value={formData.tax_id}
                                        onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                                        placeholder="B12345678"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="customer@example.com"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input
                                        id="phone"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+34 123 456 789"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="address">Address</Label>
                                <Input
                                    id="address"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Street address"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="city">City</Label>
                                    <Input
                                        id="city"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        placeholder="Madrid"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="postal_code">Postal Code</Label>
                                    <Input
                                        id="postal_code"
                                        value={formData.postal_code}
                                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                                        placeholder="28001"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="country">Country *</Label>
                                    <Select
                                        value={formData.country}
                                        onValueChange={(val) => setFormData({ ...formData, country: val })}
                                        required
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ES">Spain (ES)</SelectItem>
                                            <SelectItem value="US">United States (US)</SelectItem>
                                            <SelectItem value="PT">Portugal (PT)</SelectItem>
                                            <SelectItem value="FR">France (FR)</SelectItem>
                                            <SelectItem value="DE">Germany (DE)</SelectItem>
                                            <SelectItem value="GB">United Kingdom (GB)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="currency">Currency</Label>
                                    <Select
                                        value={formData.currency}
                                        onValueChange={(val) => setFormData({ ...formData, currency: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="EUR">EUR (€)</SelectItem>
                                            <SelectItem value="USD">USD ($)</SelectItem>
                                            <SelectItem value="GBP">GBP (£)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="payment_terms">Payment Terms</Label>
                                    <Select
                                        value={formData.payment_terms}
                                        onValueChange={(val) => setFormData({ ...formData, payment_terms: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="immediate">Immediate</SelectItem>
                                            <SelectItem value="net_15">Net 15 days</SelectItem>
                                            <SelectItem value="net_30">Net 30 days</SelectItem>
                                            <SelectItem value="net_45">Net 45 days</SelectItem>
                                            <SelectItem value="net_60">Net 60 days</SelectItem>
                                            <SelectItem value="net_90">Net 90 days</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="credit_limit">Credit Limit</Label>
                                    <Input
                                        id="credit_limit"
                                        type="number"
                                        step="0.01"
                                        value={formData.credit_limit}
                                        onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                                        placeholder="50000.00"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Additional notes about this customer..."
                                    rows={3}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSave}>
                                    {editingCustomer ? "Update" : "Create"} Customer
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Customer List</CardTitle>
                    <CardDescription>
                        {customers.length} customers registered
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search by name, code, email, or tax ID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-12">Loading customers...</div>
                    ) : filteredCustomers.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            No customers found. Add your first customer to get started.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Tax ID</TableHead>
                                    <TableHead>Country</TableHead>
                                    <TableHead>Currency</TableHead>
                                    <TableHead>Payment Terms</TableHead>
                                    <TableHead>Credit Limit</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCustomers.map((customer) => (
                                    <TableRow key={customer.code}>
                                        <TableCell className="font-mono text-sm">{customer.code}</TableCell>
                                        <TableCell className="font-medium">{customer.name}</TableCell>
                                        <TableCell className="text-sm text-gray-600">{customer.tax_id || "—"}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{customer.country}</Badge>
                                        </TableCell>
                                        <TableCell>{customer.currency}</TableCell>
                                        <TableCell className="text-sm">{customer.payment_terms.replace("_", " ")}</TableCell>
                                        <TableCell className="text-right">
                                            {customer.credit_limit
                                                ? `${customer.currency} ${customer.credit_limit.toLocaleString()}`
                                                : "—"}
                                        </TableCell>
                                        <TableCell>
                                            {customer.is_active ? (
                                                <Badge variant="default" className="gap-1">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="gap-1">
                                                    <XCircle className="h-3 w-3" />
                                                    Inactive
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEdit(customer)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(customer)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
