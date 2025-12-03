/**
 * Proteção de rotas de ações internas.
 * O objetivo é garantir que apenas páginas autorizadas do painel de ações
 * sejam registradas, mantendo rastreabilidade durante deploys automatizados.
 */
const allowedActions = ["reconciliation-center"]

export function isActionAuthorized(action: string) {
  return allowedActions.includes(action)
}

export function assertActionAuthorization(action: string) {
  if (!isActionAuthorized(action)) {
    throw new Error(`Ação não autorizada: ${action}. Atualize allowedActions para registrar novas páginas.`)
  }
}
