"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SyncMetadata {
  source: string;
  last_sync: string;
  records_synced: number;
  status: "success" | "error";
  error_message?: string;
}

export default function HubSpotSyncStatus() {
  const [metadata, setMetadata] = useState<SyncMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function loadMetadata() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sync_metadata")
        .select("*")
        .eq("source", "hubspot")
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Erro ao buscar metadados:", error);
      }

      if (data) {
        setMetadata(data);
      }
    } catch (error) {
      console.error("Erro ao carregar metadados:", error);
    } finally {
      setLoading(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    try {
      const response = await fetch("/api/hubspot/sync", {
        method: "POST",
      });

      const result = await response.json();

      if (result.success) {
        alert(`✓ ${result.count} deals sincronizados com sucesso!`);
        await loadMetadata();
      } else {
        alert(`Erro: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Erro ao sincronizar: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadMetadata();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>Carregando status...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        {metadata?.status === "success" ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : metadata?.status === "error" ? (
          <AlertCircle className="h-5 w-5 text-red-600" />
        ) : (
          <Clock className="h-5 w-5 text-gray-400" />
        )}
        
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-700">
            Última sincronização
          </span>
          {metadata?.last_sync ? (
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(metadata.last_sync), {
                addSuffix: true,
                locale: ptBR,
              })}
              {" • "}
              {metadata.records_synced.toLocaleString("pt-BR")} deals
            </span>
          ) : (
            <span className="text-xs text-gray-500">Nunca sincronizado</span>
          )}
        </div>
      </div>

      <Button
        onClick={syncNow}
        disabled={syncing}
        variant="outline"
        size="sm"
        className="ml-auto"
      >
        {syncing ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Sincronizando...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sincronizar Agora
          </>
        )}
      </Button>
    </div>
  );
}
