"use client";

import * as React from "react";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsLeftIcon,
    ChevronsRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
    /** Página atual (1-indexed) */
    currentPage: number;
    /** Total de páginas */
    totalPages: number;
    /** Informações de range: { start, end, total } */
    pageInfo: {
        start: number;
        end: number;
        total: number;
    };
    /** Callbacks de navegação */
    onFirstPage: () => void;
    onPrevPage: () => void;
    onNextPage: () => void;
    onLastPage: () => void;
    onGoToPage?: (page: number) => void;
    /** Estados de navegação */
    canGoNext: boolean;
    canGoPrev: boolean;
    /** Mostrar botões first/last */
    showFirstLast?: boolean;
    /** Classe adicional */
    className?: string;
}

/**
 * Componente de controles de paginação reutilizável
 * Mostra: "Mostrando 1-150 de 500 registros" + botões de navegação
 */
export function PaginationControls({
    currentPage,
    totalPages,
    pageInfo,
    onFirstPage,
    onPrevPage,
    onNextPage,
    onLastPage,
    canGoNext,
    canGoPrev,
    showFirstLast = true,
    className = "",
}: PaginationControlsProps) {
    if (totalPages <= 1) {
        return (
            <div className={`flex items-center justify-between py-3 px-4 bg-gray-800/50 border-t border-gray-700 ${className}`}>
                <span className="text-sm text-gray-400">
                    Mostrando {pageInfo.total} {pageInfo.total === 1 ? "registro" : "registros"}
                </span>
            </div>
        );
    }

    return (
        <div className={`flex items-center justify-between py-3 px-4 bg-gray-800/50 border-t border-gray-700 ${className}`}>
            {/* Info de registros */}
            <span className="text-sm text-gray-400">
                Mostrando <span className="font-medium text-gray-200">{pageInfo.start}</span>
                {" - "}
                <span className="font-medium text-gray-200">{pageInfo.end}</span>
                {" de "}
                <span className="font-medium text-gray-200">{pageInfo.total}</span>
                {" registros"}
            </span>

            {/* Controles de navegação */}
            <div className="flex items-center gap-1">
                {showFirstLast && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onFirstPage}
                        disabled={!canGoPrev}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-white disabled:opacity-30"
                        title="Primeira página"
                    >
                        <ChevronsLeftIcon className="h-4 w-4" />
                    </Button>
                )}

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onPrevPage}
                    disabled={!canGoPrev}
                    className="h-8 px-2 text-gray-400 hover:text-white disabled:opacity-30"
                >
                    <ChevronLeftIcon className="h-4 w-4 mr-1" />
                    Anterior
                </Button>

                {/* Indicador de página */}
                <div className="flex items-center gap-2 px-3">
                    <span className="text-sm text-gray-400">
                        Página{" "}
                        <span className="font-medium text-white">{currentPage}</span>
                        {" de "}
                        <span className="font-medium text-gray-300">{totalPages}</span>
                    </span>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onNextPage}
                    disabled={!canGoNext}
                    className="h-8 px-2 text-gray-400 hover:text-white disabled:opacity-30"
                >
                    Próxima
                    <ChevronRightIcon className="h-4 w-4 ml-1" />
                </Button>

                {showFirstLast && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onLastPage}
                        disabled={!canGoNext}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-white disabled:opacity-30"
                        title="Última página"
                    >
                        <ChevronsRightIcon className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}

export default PaginationControls;
