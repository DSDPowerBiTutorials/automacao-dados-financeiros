"use client";

import Link from "next/link";
import { BarChart3, PlugZap } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface IntegrationItem {
  source: string;
  type: string;
  difficulty: string;
  steps: string[];
  url: string;
}

const integrations: IntegrationItem[] = [
  {
    source: "PayPal",
    type: "REST API",
    difficulty: "🔴 Difícil",
    steps: ["OAuth 2.0", "Paginação", "Normalização → Supabase"],
    url: "https://developer.paypal.com/api/rest/",
  },
  {
    source: "Stripe",
    type: "REST API",
    difficulty: "🟠 Médio",
    steps: ["API key", "GET /charges", "Gravar no Supabase"],
    url: "https://stripe.com/docs/api",
  },
  {
    source: "GoCardless",
    type: "REST + Webhooks",
    difficulty: "🟠 Médio",
    steps: ["Access token", "Webhooks de evento", "Conciliação automática"],
    url: "https://developer.gocardless.com/api-reference/",
  },
  {
    source: "Braintree",
    type: "SDK + REST",
    difficulty: "🟠 Médio",
    steps: ["Autenticação sandbox", "Download de transações", "Cross-match"],
    url: "https://developer.paypal.com/braintree/docs",
  },
  {
    source: "Wise",
    type: "REST API",
    difficulty: "🟡 Moderado",
    steps: ["OAuth2", "GET /transactions", "Sincronizar → Supabase"],
    url: "https://api.transferwise.com",
  },
  {
    source: "Revolut",
    type: "REST API",
    difficulty: "🟡 Moderado",
    steps: ["Bearer token", "GET /transactions", "Salvar no Supabase"],
    url: "https://developer.revolut.com",
  },
  {
    source: "Pleo",
    type: "REST API + Webhooks",
    difficulty: "🟠 Médio",
    steps: ["API key", "GET /expenses", "Sincronizar no Supabase"],
    url: "https://developers.pleo.io",
  },
  {
    source: "Sabadell",
    type: "CSV + Portal API",
    difficulty: "🟢 Fácil",
    steps: [
      "Upload manual",
      "API opcional (SABI Connect)",
      "Ingestão automática",
    ],
    url: "https://www.bancsabadell.com",
  },
  {
    source: "DSD Web (Craft CMS)",
    type: "GraphQL + REST",
    difficulty: "🟡 Moderado",
    steps: ["API key", "Fetch via GraphQL", "Sincronizar no Supabase"],
    url: "https://dsdplanning.com/admin/graphql",
  },
];

export default function IntegrationInsights() {
  return (
    <div className="min-h-screen bg-white">

      <main className="">
        <header className="border-b border-[#0f1c34] bg-[#1a2b4a] text-white shadow-sm sticky top-0 z-20">
          <div className="container mx-auto px-6 py-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#2c3e5f] to-[#1a2b4a] flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1a2b4a]">
                Integration Insights Dashboard
              </h1>
              <p className="text-sm text-gray-600">
                Panorama das integrações API e híbridas conectadas ao Finance
                Hub.
              </p>
            </div>
          </div>
        </header>

        <section className="container mx-auto px-6 py-10">
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#2c3e5f] to-[#1a2b4a] text-white">
              <div className="flex items-center gap-3">
                <PlugZap className="h-5 w-5" />
                <div>
                  <CardTitle className="text-xl">APIs & Webhooks</CardTitle>
                  <CardDescription className="text-white/80 text-sm">
                    Prioridades de conectores e requisitos de implementação.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-bold">Fonte</th>
                    <th className="text-left py-3 px-4 font-bold">
                      Tipo de Integração
                    </th>
                    <th className="text-center py-3 px-4 font-bold">
                      Complexidade
                    </th>
                    <th className="text-left py-3 px-4 font-bold">Passos</th>
                    <th className="text-left py-3 px-4 font-bold">
                      Documentação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {integrations.map((integration) => (
                    <tr
                      key={integration.source}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 font-semibold text-gray-800">
                        {integration.source}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {integration.type}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {integration.difficulty}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        <ul className="list-disc list-inside space-y-1">
                          {integration.steps.map((step) => (
                            <li key={`${integration.source}-${step}`}>
                              {step}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={integration.url}
                          target="_blank"
                          className="text-blue-600 underline hover:text-blue-800"
                          aria-label={`Abrir documentação de ${integration.source}`}
                        >
                          {integration.url}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
