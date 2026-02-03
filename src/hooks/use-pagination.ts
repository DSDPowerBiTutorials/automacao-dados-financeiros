import { useState, useMemo, useCallback } from "react";

interface UsePaginationOptions {
    pageSize?: number;
}

interface UsePaginationReturn<T> {
    currentPage: number;
    totalPages: number;
    paginatedData: T[];
    pageInfo: {
        start: number;
        end: number;
        total: number;
    };
    goToPage: (page: number) => void;
    nextPage: () => void;
    prevPage: () => void;
    firstPage: () => void;
    lastPage: () => void;
    canGoNext: boolean;
    canGoPrev: boolean;
}

/**
 * Hook global de paginação com 150 itens por página por padrão
 * @param data - Array de dados a paginar
 * @param options - Opções de configuração (pageSize default = 150)
 */
export function usePagination<T>(
    data: T[],
    options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
    const { pageSize = 150 } = options;
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = useMemo(() => {
        return Math.max(1, Math.ceil(data.length / pageSize));
    }, [data.length, pageSize]);

    // Reset para página 1 quando dados mudam significativamente
    useMemo(() => {
        if (currentPage > totalPages) {
            setCurrentPage(1);
        }
    }, [totalPages, currentPage]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return data.slice(startIndex, endIndex);
    }, [data, currentPage, pageSize]);

    const pageInfo = useMemo(() => {
        const start = data.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
        const end = Math.min(currentPage * pageSize, data.length);
        return { start, end, total: data.length };
    }, [data.length, currentPage, pageSize]);

    const canGoNext = currentPage < totalPages;
    const canGoPrev = currentPage > 1;

    const goToPage = useCallback(
        (page: number) => {
            const validPage = Math.max(1, Math.min(page, totalPages));
            setCurrentPage(validPage);
        },
        [totalPages]
    );

    const nextPage = useCallback(() => {
        if (canGoNext) {
            setCurrentPage((prev) => prev + 1);
        }
    }, [canGoNext]);

    const prevPage = useCallback(() => {
        if (canGoPrev) {
            setCurrentPage((prev) => prev - 1);
        }
    }, [canGoPrev]);

    const firstPage = useCallback(() => {
        setCurrentPage(1);
    }, []);

    const lastPage = useCallback(() => {
        setCurrentPage(totalPages);
    }, [totalPages]);

    return {
        currentPage,
        totalPages,
        paginatedData,
        pageInfo,
        goToPage,
        nextPage,
        prevPage,
        firstPage,
        lastPage,
        canGoNext,
        canGoPrev,
    };
}

export default usePagination;
