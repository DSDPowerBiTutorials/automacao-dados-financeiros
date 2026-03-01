"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";

interface CsvFileRow {
  source: string;
  created_at: string | null;
  url: string | null;
}

interface SourceItem {
  source: string;
  label: string;
}

const sources: SourceItem[] = [
  { source: "bankinter-eur", label: "Bankinter EUR" },
  { source: "bankinter-usd", label: "Bankinter USD" },
  { source: "sabadell-eur", label: "Sabadell EUR" },
];

export default function ReconciliationCenter() {
  const [rows, setRows] = useState<CsvFileRow[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    const loadRows = async () => {
      if (!supabase) {
        console.error(
          "❌ Supabase client not configured for reconciliation-center",
        );
        toast({
          title: "Supabase unavailable",
          description:
            "Configure Supabase environment variables to load uploads.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("csv_files")
          .select("source, created_at, url")
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        const sanitizedData = data ?? [];
        setRows(sanitizedData);

        const initialLinks: Record<string, string> = {};
        sanitizedData.forEach((item) => {
          if (item.url) {
            initialLinks[item.source] = item.url;
          }
        });
        setLinks(initialLinks);
      } catch (error) {
        console.error("❌ Error loading CSVs from Supabase:", error);
        toast({
          title: "Error loading data",
          description:
            "Could not load recent uploads. Please try again shortly.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    void loadRows();
  }, [toast]);

  const handleSave = async (src: string) => {
    if (!supabase) {
      console.error("❌ Supabase client not configured to save link");
      toast({
        title: "Supabase unavailable",
        description:
          "Configure Supabase environment variables to save links.",
        variant: "destructive",
      });
      return;
    }

    const link = links[src];
    if (!link) {
      toast({
        title: "Enter a link",
        description: "Add a valid URL before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving((prev) => ({ ...prev, [src]: true }));

    try {
      const { error } = await supabase
        .from("csv_files")
        .update({ url: link })
        .eq("source", src);

      if (error) {
        throw error;
      }

      toast({
        title: "Link updated",
        description: "URL successfully saved to Supabase.",
      });
    } catch (error) {
      console.error("❌ Error saving link to Supabase:", error);
      toast({
        title: "Error saving",
        description:
          "Could not update the link. Check the URL and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving((prev) => ({ ...prev, [src]: false }));
    }
  };

  const now = useMemo(() => new Date(), []);

  const getStatus = (createdAt: string | null) => {
    if (!createdAt) {
      return {
        label: "No upload",
        className: "badge-light-danger",
      };
    }

    const lastUpload = new Date(createdAt);
    const days = Math.floor((now.getTime() - lastUpload.getTime()) / 86400000);

    if (days <= 2) {
      return { label: "Up to date", className: "badge-light-success" };
    }

    if (days <= 4) {
      return { label: "Pending", className: "badge-light-warning" };
    }

    if (days <= 7) {
      return { label: "Attention", className: "badge-light-warning" };
    }

    return { label: "Outdated", className: "badge-light-danger" };
  };

  return (
    <div className="min-h-full">

      <main className="">
        <PageHeader title="Reconciliation Center" subtitle="Monitor CSV uploads per account and update reference links." />

        <section className="px-6 py-10">
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5" />
                <div>
                  <CardTitle className="text-xl">CSV Uploads</CardTitle>
                  <CardDescription className="text-gray-900 dark:text-white/80 text-sm">
                    Status and links of recent imports.
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
                    <th className="text-center py-3 px-4 font-bold">Status</th>
                    <th className="text-center py-3 px-4 font-bold">
                      Last Upload
                    </th>
                    <th className="text-left py-3 px-4 font-bold">
                      CSV Link
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map(({ source, label }) => {
                    const data = rows.find((row) => row.source === source);
                    const status = getStatus(data?.created_at ?? null);

                    return (
                      <tr key={source} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-semibold text-gray-800">
                          {label}
                        </td>
                        <td className="py-3 px-4 text-gray-700">CSV Upload</td>
                        <td className="py-3 px-4 text-center">
                          <span className={status.className}>
                            {status.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-gray-700">
                          {data?.created_at
                            ? format(new Date(data.created_at), "dd MMM yyyy")
                            : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Input
                              value={links[source] ?? ""}
                              onChange={(event) =>
                                setLinks({
                                  ...links,
                                  [source]: event.target.value,
                                })
                              }
                              className="flex-1"
                              placeholder="https://..."
                            />
                            <Button
                              onClick={() => void handleSave(source)}
                              disabled={isSaving[source]}
                            >
                              {isSaving[source] ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {isLoading && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 px-4 text-center text-gray-600"
                      >
                        <div className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Loading uploads...</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!isLoading && rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 px-4 text-center text-gray-600"
                      >
                        <div className="inline-flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>No uploads found in Supabase.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
