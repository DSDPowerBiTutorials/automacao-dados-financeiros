import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export default function PlaceholderPage({
    title,
    description,
    backHref = "/dashboard",
    backLabel = "Voltar ao Dashboard",
}: {
    title: string;
    description?: string;
    backHref?: string;
    backLabel?: string;
}) {
    return (
        <div className="flex flex-col h-full">
            <PageHeader title={title} subtitle={description} />

            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-2">
                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Página em construção.</p>
                    <Link
                        href={backHref}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                        {backLabel}
                    </Link>
                </div>
            </div>
        </div>
    );
}
