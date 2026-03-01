"use client";

import Link from "next/link";
import { PlugZap } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
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
    difficulty: "Hard",
    steps: ["OAuth 2.0", "Pagination", "Normalize → Supabase"],
    url: "https://developer.paypal.com/api/rest/",
  },
  {
    source: "Stripe",
    type: "REST API",
    difficulty: "Medium",
    steps: ["API key", "GET /charges", "Save to Supabase"],
    url: "https://stripe.com/docs/api",
  },
  {
    source: "GoCardless",
    type: "REST + Webhooks",
    difficulty: "Medium",
    steps: ["Access token", "Event webhooks", "Auto reconciliation"],
    url: "https://developer.gocardless.com/api-reference/",
  },
  {
    source: "Braintree",
    type: "SDK + REST",
    difficulty: "Medium",
    steps: ["Sandbox auth", "Download transactions", "Cross-match"],
    url: "https://developer.paypal.com/braintree/docs",
  },
  {
    source: "Wise",
    type: "REST API",
    difficulty: "Moderate",
    steps: ["OAuth2", "GET /transactions", "Sync → Supabase"],
    url: "https://api.transferwise.com",
  },
  {
    source: "Revolut",
    type: "REST API",
    difficulty: "Moderate",
    steps: ["Bearer token", "GET /transactions", "Save to Supabase"],
    url: "https://developer.revolut.com",
  },
  {
    source: "Pleo",
    type: "REST API + Webhooks",
    difficulty: "Medium",
    steps: ["API key", "GET /expenses", "Sync to Supabase"],
    url: "https://developers.pleo.io",
  },
  {
    source: "Sabadell",
    type: "CSV + Portal API",
    difficulty: "Easy",
    steps: [
      "Manual upload",
      "Optional API (SABI Connect)",
      "Auto ingestion",
    ],
    url: "https://www.bancsabadell.com",
  },
  {
    source: "DSD Web (Craft CMS)",
    type: "GraphQL + REST",
    difficulty: "Moderate",
    steps: ["API key", "Fetch via GraphQL", "Sync to Supabase"],
    url: "https://dsdplanning.com/admin/graphql",
  },
];

export default function IntegrationInsights() {
  return (
    <div className="min-h-full">

      <main className="">
        <PageHeader title="Integration Insights Dashboard" subtitle="Overview of API and hybrid integrations connected to the Finance Hub." />

        <section className="px-6 py-10">
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#2c3e5f] to-[#1a2b4a] text-white">
              <div className="flex items-center gap-3">
                <PlugZap className="h-5 w-5" />
                <div>
                  <CardTitle className="text-xl">APIs & Webhooks</CardTitle>
                  <CardDescription className="text-gray-900 dark:text-white/80 text-sm">
                    Connector priorities and implementation requirements.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="overflow-x-auto p-0">
              <table className="table-standard">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-bold">Source</th>
                    <th className="text-left py-3 px-4 font-bold">
                      Integration Type
                    </th>
                    <th className="text-center py-3 px-4 font-bold">
                      Complexity
                    </th>
                    <th className="text-left py-3 px-4 font-bold">Steps</th>
                    <th className="text-left py-3 px-4 font-bold">
                      Documentation
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
                        <span
                          className={
                            integration.difficulty === "Hard"
                              ? "badge-light-danger"
                              : integration.difficulty === "Medium"
                                ? "badge-light-warning"
                                : integration.difficulty === "Moderate"
                                  ? "badge-light-info"
                                  : "badge-light-success"
                          }
                        >
                          {integration.difficulty}
                        </span>
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
                          aria-label={`Open ${integration.source} documentation`}
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
