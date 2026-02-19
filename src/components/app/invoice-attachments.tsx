"use client";

import React, { useState, useCallback } from "react";
import { Upload, X, FileText, Image, Loader2, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type Attachment = {
    id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    web_url?: string;
    signed_url?: string;
    kind: string;
    created_at: string;
};

interface InvoiceAttachmentsProps {
    entityType?: string;
    entityId?: number | null;
    batchId?: string | null;
    invoiceDate?: string;
    userId?: string;
    onBatchCreated?: (batchId: string) => void;
    className?: string;
}

const KIND_OPTIONS = [
    { value: "invoice_pdf", label: "Fatura (PDF)" },
    { value: "payment_proof", label: "Comprovante de pagamento" },
    { value: "contract", label: "Contrato" },
    { value: "receipt", label: "Recibo" },
    { value: "other", label: "Outro" }
];

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
    if (mimeType.startsWith("image/")) return Image;
    return FileText;
}

export function InvoiceAttachments({
    entityType = "invoice",
    entityId,
    batchId: initialBatchId,
    invoiceDate,
    userId,
    onBatchCreated,
    className
}: InvoiceAttachmentsProps) {
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [uploading, setUploading] = useState(false);
    const [batchId, setBatchId] = useState<string | null>(initialBatchId || null);
    const [selectedKind, setSelectedKind] = useState("invoice_pdf");

    // Load attachments
    const loadAttachments = useCallback(async () => {
        if (!entityId && !batchId) return;

        const params = entityId
            ? `entity_type=${entityType}&entity_id=${entityId}`
            : `batch_id=${batchId}`;

        try {
            const res = await fetch(`/api/attachments?${params}`);
            const data = await res.json();
            if (data.attachments) {
                setAttachments(data.attachments);
            }
        } catch (e) {
            console.error("Failed to load attachments:", e);
        }
    }, [entityType, entityId, batchId]);

    React.useEffect(() => {
        loadAttachments();
    }, [loadAttachments]);

    // Create batch if needed
    const ensureBatch = async (): Promise<string> => {
        if (batchId) return batchId;

        const res = await fetch("/api/attachment-batches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId })
        });

        const data = await res.json();
        if (data.batch_id) {
            setBatchId(data.batch_id);
            onBatchCreated?.(data.batch_id);
            return data.batch_id;
        }

        throw new Error("Failed to create batch");
    };

    // Handle file upload
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);

        try {
            for (const file of Array.from(files)) {
                // Validate
                const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
                if (!allowedTypes.includes(file.type)) {
                    toast({
                        title: "Tipo inválido",
                        description: `${file.name}: Apenas PDF, JPG, PNG são permitidos.`,
                        variant: "destructive",

                    });
                    continue;
                }

                if (file.size > 20 * 1024 * 1024) {
                    toast({
                        title: "Arquivo muito grande",
                        description: `${file.name}: Máximo 20MB.`,
                        variant: "destructive",

                    });
                    continue;
                }

                // Ensure batch exists
                const currentBatchId = entityId ? null : await ensureBatch();

                const formData = new FormData();
                formData.append("file", file);
                formData.append("entity_type", entityType);
                formData.append("kind", selectedKind);
                if (entityId) formData.append("entity_id", String(entityId));
                if (currentBatchId) formData.append("batch_id", currentBatchId);
                if (invoiceDate) formData.append("invoice_date", invoiceDate);
                if (userId) formData.append("user_id", userId);

                const res = await fetch("/api/attachments", {
                    method: "POST",
                    body: formData
                });

                const result = await res.json();

                if (result.success && result.attachment) {
                    setAttachments(prev => [result.attachment, ...prev]);
                    toast({
                        title: "Upload concluído",
                        description: file.name,

                    });
                } else {
                    throw new Error(result.error || "Upload failed");
                }
            }
        } catch (err: any) {
            toast({
                title: "Erro no upload",
                description: err.message,
                variant: "destructive",

            });
        } finally {
            setUploading(false);
            // Reset input
            e.target.value = "";
        }
    };

    // Delete attachment
    const handleDelete = async (attachment: Attachment) => {
        if (!confirm(`Remover ${attachment.file_name}?`)) return;

        try {
            const res = await fetch(`/api/attachments?id=${attachment.id}`, {
                method: "DELETE"
            });

            if (res.ok) {
                setAttachments(prev => prev.filter(a => a.id !== attachment.id));
                toast({ title: "Anexo removido" });
            }
        } catch (err) {
            console.error("Delete error:", err);
        }
    };

    return (
        <div className={className}>
            {/* Upload area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
                <div className="flex items-center gap-4">
                    {/* Kind selector */}
                    <select
                        value={selectedKind}
                        onChange={(e) => setSelectedKind(e.target.value)}
                        className="text-sm border rounded px-2 py-1 bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300"
                    >
                        {KIND_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>

                    {/* Upload button */}
                    <label className="flex-1">
                        <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            multiple
                            onChange={handleUpload}
                            disabled={uploading}
                            className="hidden"
                        />
                        <div className="flex items-center justify-center gap-2 cursor-pointer py-2 px-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-600 text-sm font-medium transition-colors">
                            {uploading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4" />
                                    Adicionar anexo
                                </>
                            )}
                        </div>
                    </label>
                </div>

                <p className="text-xs text-gray-500 mt-2 text-center">
                    PDF, JPG, PNG • Máx. 20MB
                </p>
            </div>

            {/* Attachments list */}
            {attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                    {attachments.map((att) => {
                        const Icon = getFileIcon(att.mime_type);
                        return (
                            <div
                                key={att.id}
                                className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg group"
                            >
                                <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-700 truncate">
                                        {att.file_name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {formatFileSize(att.size_bytes)} • {KIND_OPTIONS.find(k => k.value === att.kind)?.label || att.kind}
                                    </p>
                                </div>
                                {(att.signed_url || att.web_url) && (
                                    <a
                                        href={att.signed_url || att.web_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-700 text-xs"
                                    >
                                        Abrir
                                    </a>
                                )}
                                <button
                                    onClick={() => handleDelete(att)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-500 transition-opacity"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
