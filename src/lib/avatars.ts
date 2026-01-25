/**
 * Sistema de Avatares para usuários
 * Mapeia usuários aos seus avatares na pasta public/avatars/
 */

// Mapeamento de emails/nomes para avatares
export const USER_AVATARS: Record<string, string> = {
    // Sistema
    'botella@system.local': '/avatars/botella.svg',
    'botella': '/avatars/botella.svg',

    // Usuários reais
    'fernando@digitalsmiledesign.com': '/avatars/Fernando.png',
    'fernando': '/avatars/Fernando.png',

    'sofia@digitalsmiledesign.com': '/avatars/Sofia.png',
    'sofia': '/avatars/Sofia.png',

    'jorge@digitalsmiledesign.com': '/avatars/Jorge.png',
    'jmarfetan@digitalsmiledesign.com': '/avatars/Jorge.png',
    'jorge': '/avatars/Jorge.png',

    'valeria@digitalsmiledesign.com': '/avatars/Valeria.png',
    'valeria': '/avatars/Valeria.png',
}

// Avatar padrão quando não encontrado
export const DEFAULT_AVATAR = '/avatars/default.svg'

// Avatar do BOTella
export const BOTELLA_AVATAR = '/avatars/botella.svg'

/**
 * Obtém URL do avatar para um usuário
 */
export function getAvatarUrl(identifier: string | null | undefined): string {
    if (!identifier) return DEFAULT_AVATAR

    const lowerIdentifier = identifier.toLowerCase().trim()

    // Busca direta
    if (USER_AVATARS[lowerIdentifier]) {
        return USER_AVATARS[lowerIdentifier]
    }

    // Busca por parte do email (antes do @)
    const emailPrefix = lowerIdentifier.split('@')[0]
    if (USER_AVATARS[emailPrefix]) {
        return USER_AVATARS[emailPrefix]
    }

    // Busca por nome no mapeamento
    for (const [key, value] of Object.entries(USER_AVATARS)) {
        if (key.includes(emailPrefix) || emailPrefix.includes(key.split('@')[0])) {
            return value
        }
    }

    return DEFAULT_AVATAR
}

/**
 * Gera iniciais a partir do nome (fallback)
 */
export function getInitials(name: string | null | undefined): string {
    if (!name) return '?'

    // BOTella especial
    if (name.toLowerCase().includes('botella')) {
        return '🤖'
    }

    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase()
    }

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Verifica se o identificador é do BOTella
 */
export function isBotella(identifier: string | null | undefined): boolean {
    if (!identifier) return false
    const lower = identifier.toLowerCase()
    return lower.includes('botella') || lower === 'sistema' || lower === 'system'
}

/**
 * Formata nome do BOTella com estilo
 */
export function formatBotName(format: 'html' | 'markdown' | 'plain' | 'react' = 'plain'): string {
    switch (format) {
        case 'html':
            return '<strong>BOT</strong>ella'
        case 'markdown':
            return '**BOT**ella'
        case 'react':
            return 'BOTella' // Componente React trata separadamente
        default:
            return 'BOTella'
    }
}

/**
 * Objeto de usuário do BOTella para uso em componentes
 */
export const BOTELLA_USER = {
    id: 'botella',
    email: 'botella@system.local',
    name: 'BOTella',
    avatar_url: BOTELLA_AVATAR,
}

/**
 * Lista de cores para avatares sem imagem (baseado no nome)
 */
const AVATAR_COLORS = [
    'from-blue-400 to-blue-600',
    'from-green-400 to-green-600',
    'from-purple-400 to-purple-600',
    'from-orange-400 to-orange-600',
    'from-pink-400 to-pink-600',
    'from-teal-400 to-teal-600',
    'from-indigo-400 to-indigo-600',
    'from-red-400 to-red-600',
]

/**
 * Obtém cor de gradiente baseada no nome (para avatares sem foto)
 */
export function getAvatarColor(name: string | null | undefined): string {
    if (!name) return AVATAR_COLORS[0]

    // BOTella sempre azul
    if (isBotella(name)) {
        return 'from-blue-500 to-purple-600'
    }

    // Hash simples do nome para cor consistente
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }

    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
