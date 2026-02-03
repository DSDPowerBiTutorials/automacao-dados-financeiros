import { useEffect, useCallback, useRef } from "react";

interface UseAutoCloseDialogOptions {
    /** Tempo em milissegundos antes de fechar (default: 3000ms) */
    delay?: number;
    /** Callback para fechar o dialog */
    onClose: () => void;
    /** Se true, o timer está ativo */
    isOpen: boolean;
    /** Se true, desabilita o auto-close (para dialogs que precisam de interação) */
    disabled?: boolean;
}

/**
 * Hook para auto-fechar dialogs de status após um período
 * Ideal para: "Upload Successful", "Saved!", "Deleted", etc.
 * 
 * @example
 * const { cancelAutoClose, resetTimer } = useAutoCloseDialog({
 *   isOpen: showSuccess,
 *   onClose: () => setShowSuccess(false),
 *   delay: 3000, // 3 segundos
 * });
 */
export function useAutoCloseDialog({
    delay = 3000,
    onClose,
    isOpen,
    disabled = false,
}: UseAutoCloseDialogOptions) {
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const startTimer = useCallback(() => {
        clearTimer();
        if (!disabled && isOpen) {
            timerRef.current = setTimeout(() => {
                onClose();
            }, delay);
        }
    }, [clearTimer, disabled, isOpen, onClose, delay]);

    // Inicia timer quando abre
    useEffect(() => {
        if (isOpen && !disabled) {
            startTimer();
        }
        return clearTimer;
    }, [isOpen, disabled, startTimer, clearTimer]);

    // Cancela timer manualmente (ex: hover sobre o dialog)
    const cancelAutoClose = useCallback(() => {
        clearTimer();
    }, [clearTimer]);

    // Reinicia timer (ex: mouse sai do dialog)
    const resetTimer = useCallback(() => {
        startTimer();
    }, [startTimer]);

    return {
        cancelAutoClose,
        resetTimer,
    };
}

export default useAutoCloseDialog;
