"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
    Upload,
    Download,
    Trash2,
    FolderOpen,
    FileText,
    FileSpreadsheet,
    Image,
    File,
    Video,
    Loader2,
    ChevronRight,
    ArrowLeft,
    RefreshCw,
    Search,
    HardDrive,
    Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DriveFile {
    id: string;
    name: string;
    path: string;
    size: number;
    mimeType: string;
    createdAt: string;
    updatedAt: string;
}

interface DriveFolder {
    name: string;
    path: string;
}

interface BucketConfig {
    id: string;
    label: string;
    description: string;
}

const BUCKETS: BucketConfig[] = [
    {
        id: "csv_files",
        label: "Extratos & CSVs",
        description: "Ficheiros CSV/XLSX de extratos bancários e pagamentos",
    },
    {
        id: "attachments",
        label: "Faturas & Anexos",
        description: "PDFs de faturas, comprovativos de pagamento",
    },
    {
        id: "ws-attachments",
        label: "Workstream",
        description: "Anexos de tarefas e projetos",
    },
    {
        id: "tutorial-videos",
        label: "Vídeos Tutoriais",
        description: "Vídeos de instrução da aplicação (.mp4, .webm)",
    },
];

function getMaxSizeForBucket(bucket: string): number {
    return bucket === "tutorial-videos" ? 50 * 1024 * 1024 : 50 * 1024 * 1024;
}

function getAcceptForBucket(bucket: string): string {
    return bucket === "tutorial-videos"
        ? "video/mp4,video/webm,.mp4,.webm"
        : ".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.doc,.docx,.txt";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
    if (!dateStr) return "—";
    try {
        return new Date(dateStr).toLocaleDateString("pt-PT", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return dateStr;
    }
}

function getFileIcon(name: string, mimeType: string) {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "csv" || ext === "xlsx" || ext === "xls")
        return FileSpreadsheet;
    if (ext === "mp4" || ext === "webm" || mimeType.startsWith("video/"))
        return Video;
    if (mimeType.startsWith("image/")) return Image;
    if (ext === "pdf" || mimeType === "application/pdf") return FileText;
    return File;
}

function getFileColor(name: string, mimeType: string) {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "csv" || ext === "xlsx" || ext === "xls")
        return "text-green-600 dark:text-green-400";
    if (ext === "mp4" || ext === "webm" || mimeType.startsWith("video/"))
        return "text-blue-600 dark:text-blue-400";
    if (mimeType.startsWith("image/"))
        return "text-purple-600 dark:text-purple-400";
    if (ext === "pdf" || mimeType === "application/pdf")
        return "text-red-600 dark:text-red-400";
    return "text-gray-500 dark:text-gray-400";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function FileExplorer() {
    const [activeBucket, setActiveBucket] = useState<string>("csv_files");
    const [currentFolder, setCurrentFolder] = useState<string>("");
    const [folders, setFolders] = useState<DriveFolder[]>([]);
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

    // ---------------------------------------------------------------------------
    // Fetch files
    // ---------------------------------------------------------------------------
    const loadFiles = useCallback(async () => {
        setLoading(true);
        setSelectedFiles(new Set());
        try {
            const params = new URLSearchParams({
                bucket: activeBucket,
                folder: currentFolder,
            });
            const res = await fetch(`/api/drive/list?${params}`);
            const data = await res.json();

            if (data.success) {
                setFolders(data.folders || []);
                setFiles(data.files || []);
            } else {
                toast({
                    title: "Erro ao listar ficheiros",
                    description: data.error,
                    variant: "destructive",
                });
            }
        } catch (err) {
            toast({
                title: "Erro de conexão",
                description: "Não foi possível carregar ficheiros.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [activeBucket, currentFolder]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    // ---------------------------------------------------------------------------
    // Navigation
    // ---------------------------------------------------------------------------
    const navigateToFolder = (folderPath: string) => {
        setCurrentFolder(folderPath);
        setSearchTerm("");
    };

    const navigateBack = () => {
        const parts = currentFolder.split("/").filter(Boolean);
        parts.pop();
        setCurrentFolder(parts.join("/"));
        setSearchTerm("");
    };

    const breadcrumbs = currentFolder
        ? currentFolder.split("/").filter(Boolean)
        : [];

    // ---------------------------------------------------------------------------
    // Download
    // ---------------------------------------------------------------------------
    const handleDownload = async (file: DriveFile) => {
        try {
            const params = new URLSearchParams({
                bucket: activeBucket,
                path: file.path,
            });
            const res = await fetch(`/api/drive/download?${params}`);
            const data = await res.json();

            if (data.success && data.url) {
                window.open(data.url, "_blank");
            } else {
                toast({
                    title: "Erro no download",
                    description: data.error,
                    variant: "destructive",
                });
            }
        } catch {
            toast({
                title: "Erro no download",
                description: "Não foi possível gerar URL.",
                variant: "destructive",
            });
        }
    };

    // ---------------------------------------------------------------------------
    // Upload — direct to Supabase via signed URL (bypasses Vercel body limit)
    // ---------------------------------------------------------------------------
    const uploadViaSignedUrl = (file: globalThis.File, bucket: string, folder: string): Promise<boolean> => {
        return new Promise(async (resolve) => {
            try {
                // 1. Get signed upload URL from our API
                const res = await fetch("/api/drive/upload-url", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        bucket,
                        folder: folder || undefined,
                        fileName: file.name,
                        contentType: file.type || "application/octet-stream",
                    }),
                });
                const data = await res.json();
                if (!data.success) {
                    toast({ title: `Erro: ${file.name}`, description: data.error, variant: "destructive" });
                    resolve(false);
                    return;
                }

                // 2. Upload directly to Supabase Storage with progress tracking
                const xhr = new XMLHttpRequest();
                xhr.upload.addEventListener("progress", (evt) => {
                    if (evt.lengthComputable) {
                        setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
                    }
                });
                xhr.addEventListener("load", () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(true);
                    } else {
                        toast({ title: `Erro: ${file.name}`, description: `Upload falhou (${xhr.status})`, variant: "destructive" });
                        resolve(false);
                    }
                });
                xhr.addEventListener("error", () => {
                    toast({ title: `Erro: ${file.name}`, description: "Erro de rede durante o upload.", variant: "destructive" });
                    resolve(false);
                });

                xhr.open("PUT", data.signedUrl);
                xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
                xhr.send(file);
            } catch {
                toast({ title: `Erro: ${file.name}`, description: "Não foi possível iniciar o upload.", variant: "destructive" });
                resolve(false);
            }
        });
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList || fileList.length === 0) return;

        setUploading(true);
        setUploadProgress(null);
        let successCount = 0;
        const maxSize = getMaxSizeForBucket(activeBucket);
        const maxSizeMB = Math.round(maxSize / (1024 * 1024));

        try {
            for (const file of Array.from(fileList)) {
                if (file.size > maxSize) {
                    toast({
                        title: "Ficheiro muito grande",
                        description: `${file.name}: Máximo ${maxSizeMB}MB.`,
                        variant: "destructive",
                    });
                    continue;
                }

                setUploadProgress(0);

                // Use signed URL upload for tutorial-videos or large files (>4MB)
                // to bypass Vercel's serverless body size limit
                const useDirectUpload = activeBucket === "tutorial-videos" || file.size > 4 * 1024 * 1024;

                if (useDirectUpload) {
                    const ok = await uploadViaSignedUrl(file, activeBucket, currentFolder);
                    if (ok) successCount++;
                } else {
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("bucket", activeBucket);
                    if (currentFolder) formData.append("folder", currentFolder);

                    const res = await fetch("/api/drive/upload", {
                        method: "POST",
                        body: formData,
                    });
                    const result = await res.json();

                    if (result.success) {
                        successCount++;
                    } else {
                        toast({
                            title: `Erro: ${file.name}`,
                            description: result.error,
                            variant: "destructive",
                        });
                    }
                }
            }

            if (successCount > 0) {
                toast({
                    title: "Upload concluído",
                    description: `${successCount} ficheiro(s) enviado(s).`,
                });
                loadFiles();
            }
        } catch (err: any) {
            toast({
                title: "Erro no upload",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setUploading(false);
            setUploadProgress(null);
            e.target.value = "";
        }
    };

    // ---------------------------------------------------------------------------
    // Delete
    // ---------------------------------------------------------------------------
    const handleDelete = async (filePaths: string[]) => {
        if (filePaths.length === 0) return;
        const confirmed = confirm(
            `Remover ${filePaths.length} ficheiro(s)? Esta ação é irreversível.`
        );
        if (!confirmed) return;

        try {
            const res = await fetch("/api/drive/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bucket: activeBucket, paths: filePaths }),
            });
            const data = await res.json();

            if (data.success) {
                toast({
                    title: "Ficheiros removidos",
                    description: `${data.deleted} ficheiro(s) apagado(s).`,
                });
                setSelectedFiles(new Set());
                loadFiles();
            } else {
                toast({
                    title: "Erro ao remover",
                    description: data.error,
                    variant: "destructive",
                });
            }
        } catch {
            toast({
                title: "Erro",
                description: "Não foi possível remover.",
                variant: "destructive",
            });
        }
    };

    // ---------------------------------------------------------------------------
    // Selection
    // ---------------------------------------------------------------------------
    const toggleSelection = (path: string) => {
        setSelectedFiles((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedFiles.size === filteredFiles.length) {
            setSelectedFiles(new Set());
        } else {
            setSelectedFiles(new Set(filteredFiles.map((f) => f.path)));
        }
    };

    // ---------------------------------------------------------------------------
    // Filter
    // ---------------------------------------------------------------------------
    const filteredFiles = searchTerm
        ? files.filter((f) =>
            f.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : files;

    const totalSize = filteredFiles.reduce((acc, f) => acc + (f.size || 0), 0);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    return (
        <div className="space-y-4">
            {/* Bucket Tabs */}
            <div className="flex gap-2 flex-wrap">
                {BUCKETS.map((b) => (
                    <button
                        key={b.id}
                        onClick={() => {
                            setActiveBucket(b.id);
                            setCurrentFolder("");
                            setSearchTerm("");
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeBucket === b.id
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            }`}
                    >
                        {b.label}
                    </button>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 flex-1 min-w-0">
                    {currentFolder && (
                        <button
                            onClick={navigateBack}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                    )}
                    <button
                        onClick={() => setCurrentFolder("")}
                        className="hover:text-blue-600 font-medium"
                    >
                        {BUCKETS.find((b) => b.id === activeBucket)?.label || activeBucket}
                    </button>
                    {breadcrumbs.map((part, i) => (
                        <React.Fragment key={i}>
                            <ChevronRight className="h-3 w-3 flex-shrink-0" />
                            <button
                                onClick={() =>
                                    navigateToFolder(
                                        breadcrumbs.slice(0, i + 1).join("/")
                                    )
                                }
                                className="hover:text-blue-600 truncate"
                            >
                                {part}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                {/* Search */}
                <div className="relative w-60">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Procurar ficheiros..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 h-9"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadFiles}
                        disabled={loading}
                    >
                        <RefreshCw
                            className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
                        />
                        Atualizar
                    </Button>

                    <label>
                        <input
                            type="file"
                            multiple
                            onChange={handleUpload}
                            disabled={uploading}
                            className="hidden"
                            accept={getAcceptForBucket(activeBucket)}
                        />
                        <Button
                            variant="default"
                            size="sm"
                            asChild
                            disabled={uploading}
                        >
                            <span className="cursor-pointer">
                                {uploading ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                    <Upload className="h-4 w-4 mr-1" />
                                )}
                                Upload
                            </span>
                        </Button>
                    </label>

                    {selectedFiles.size > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(Array.from(selectedFiles))}
                        >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Apagar ({selectedFiles.size})
                        </Button>
                    )}
                </div>
            </div>

            {/* Upload progress bar */}
            {uploading && uploadProgress !== null && (
                <div className="px-1 space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                        <span>A enviar ficheiro…</span>
                        <span className="font-medium">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-200"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Stats bar */}
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 px-1">
                <span>
                    {filteredFiles.length} ficheiro(s) • {folders.length} pasta(s)
                </span>
                <span>{formatFileSize(totalSize)} total</span>
                {selectedFiles.size > 0 && (
                    <span className="text-blue-600">
                        {selectedFiles.size} selecionado(s)
                    </span>
                )}
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            )}

            {/* Empty state */}
            {!loading && folders.length === 0 && filteredFiles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
                    <HardDrive className="h-16 w-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">Pasta vazia</p>
                    <p className="text-sm mt-1">
                        Arraste ficheiros ou clique em Upload para adicionar.
                    </p>
                </div>
            )}

            {/* File list */}
            {!loading && (folders.length > 0 || filteredFiles.length > 0) && (
                <div className="border rounded-lg overflow-hidden dark:border-gray-700">
                    {/* Header */}
                    <div className="grid grid-cols-[auto_1fr_120px_160px_80px] gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">
                        <div className="w-6">
                            {filteredFiles.length > 0 && (
                                <input
                                    type="checkbox"
                                    checked={
                                        selectedFiles.size === filteredFiles.length &&
                                        filteredFiles.length > 0
                                    }
                                    onChange={selectAll}
                                    className="rounded"
                                />
                            )}
                        </div>
                        <div>Nome</div>
                        <div>Tamanho</div>
                        <div>Data</div>
                        <div className="text-center">Ações</div>
                    </div>

                    {/* Folders */}
                    {folders.map((folder) => (
                        <div
                            key={folder.path}
                            onClick={() => navigateToFolder(folder.path)}
                            className="grid grid-cols-[auto_1fr_120px_160px_80px] gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer items-center border-b dark:border-gray-700/50 last:border-b-0"
                        >
                            <div className="w-6" />
                            <div className="flex items-center gap-3 min-w-0">
                                <FolderOpen className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                    {folder.name}
                                </span>
                            </div>
                            <div className="text-sm text-gray-400">—</div>
                            <div className="text-sm text-gray-400">—</div>
                            <div />
                        </div>
                    ))}

                    {/* Files */}
                    {filteredFiles.map((file) => {
                        const Icon = getFileIcon(file.name, file.mimeType);
                        const color = getFileColor(file.name, file.mimeType);
                        const isSelected = selectedFiles.has(file.path);

                        return (
                            <div
                                key={file.id}
                                className={`grid grid-cols-[auto_1fr_120px_160px_80px] gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 items-center border-b dark:border-gray-700/50 last:border-b-0 ${isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""
                                    }`}
                            >
                                <div className="w-6">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelection(file.path)}
                                        className="rounded"
                                    />
                                </div>
                                <div className="flex items-center gap-3 min-w-0">
                                    <Icon className={`h-5 w-5 flex-shrink-0 ${color}`} />
                                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                                        {file.name}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {formatFileSize(file.size)}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {formatDate(file.createdAt)}
                                </div>
                                <div className="flex items-center justify-center gap-1">
                                    <button
                                        onClick={() => {
                                            const url = `${window.location.origin}/api/share?bucket=${currentBucket}&path=${encodeURIComponent(file.path)}`;
                                            navigator.clipboard.writeText(url);
                                            toast({ title: "Link copiado!", description: "Qualquer pessoa com o link pode aceder ao ficheiro." });
                                        }}
                                        className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600 dark:text-green-400 transition-colors"
                                        title="Copiar link público"
                                    >
                                        <Link2 className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDownload(file)}
                                        className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400 transition-colors"
                                        title="Download"
                                    >
                                        <Download className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete([file.path])}
                                        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 dark:text-red-400 transition-colors"
                                        title="Apagar"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
