# Automação de Dados Financeiros

Sistema de conciliação financeira desenvolvido em Next.js + TypeScript, integrado ao Supabase para autenticação, armazenamento de arquivos e persistência de registros processados. O objetivo é receber lançamentos bancários (como Bankinter EUR/USD), processar arquivos CSV e conciliar pagamentos de fontes como Braintree, Stripe e GoCardless, garantindo rastreabilidade contábil.

## Tecnologias principais
- Next.js (App Router) e React 18
- Tailwind CSS e shadcn/ui
- Supabase (Auth, Storage e Tables)
- TypeScript com tipagem compartilhada entre front-end e APIs

## Rotas e domínio do problema
- `/reports/{source}`: visão detalhada por origem, como `/reports/bankinter-eur` ou `/reports/braintree-eur`.
- Uploads de CSV armazenados no bucket `csv_files` e linhas persistidas na tabela `csv_rows`.
- Lógica de conciliação automática compara datas dentro de ±3 dias e valores aproximados para marcar registros como `conciliado`.

## Desenvolvimento local
1. Instale dependências com `npm install`.
2. Inicie o servidor de desenvolvimento com `npm run dev` e acesse [http://localhost:3000](http://localhost:3000).
3. Ajustes adicionais devem manter padrões de lint e tipagem (Prettier + ESLint + `tsc --noEmit`).

## Boas práticas
- Preserve interfaces e estruturas existentes, evitando refatorações fora do escopo.
- Em uploads, aceite apenas `.csv`, forneça feedback visual ao usuário e registre erros no console.
- Não exponha chaves do Supabase e não edite arquivos de ambiente locais.
