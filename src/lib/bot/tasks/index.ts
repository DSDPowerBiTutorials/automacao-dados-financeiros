/**
 * BOT Tasks Registry
 * 
 * Exporta todas as tasks disponíveis para o sistema BOTella.
 * Cada task deve exportar uma função execute e metadata.
 */

// Swift Commission Task
export {
    executeSwiftCommissionTask,
    swiftCommissionTaskMeta,
    SWIFT_COMMISSION_CONFIG
} from './swift-commission-task'

// Adicionar novas tasks aqui conforme forem criadas
// export { executeXyzTask, xyzTaskMeta } from './xyz-task'

// Registry de todas as tasks para o dispatcher
import { swiftCommissionTaskMeta } from './swift-commission-task'

export const ALL_TASKS = [
    swiftCommissionTaskMeta,
    // Adicionar novas tasks aqui
]

// Mapa para lookup rápido por key
export const TASK_MAP = new Map(
    ALL_TASKS.map(task => [task.key, task])
)

// Helper para executar task por key
export async function executeTaskByKey(key: string): Promise<{
    success: boolean
    result?: unknown
    error?: string
}> {
    const task = TASK_MAP.get(key)

    if (!task) {
        return {
            success: false,
            error: `Task "${key}" não encontrada`
        }
    }

    try {
        const result = await task.execute()
        return { success: true, result }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }
    }
}
