import { AlertCircle } from "lucide-react";

export default function UnderConstructionPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[#1e1f21] text-gray-900 dark:text-white">
            <div className="flex flex-col items-center gap-4 p-8 rounded-lg border border-yellow-600 bg-yellow-900/10">
                <AlertCircle className="h-12 w-12 text-yellow-400" />
                <h1 className="text-2xl font-bold text-yellow-300">Página em construção</h1>
                <p className="text-lg text-yellow-200">Esta funcionalidade estará disponível em breve.</p>
            </div>
        </div>
    );
}
