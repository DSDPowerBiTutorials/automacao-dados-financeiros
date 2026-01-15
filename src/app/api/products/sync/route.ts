import { NextRequest, NextResponse } from "next/server";
import { getSQLServerConnection } from "@/lib/sqlserver";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * API para sincronizar produtos do HubSpot LineItem
 * 
 * GET /api/products/sync - Sincroniza novos produtos
 * POST /api/products/sync - Mesmo que GET (para webhooks)
 * 
 * Query params:
 * - force=true: Re-sincroniza todos os produtos (não apenas novos)
 */
export async function GET(request: NextRequest) {
  return syncProducts(request);
}

export async function POST(request: NextRequest) {
  return syncProducts(request);
}

async function syncProducts(request: NextRequest) {
  const startTime = Date.now();
  const force = request.nextUrl.searchParams.get("force") === "true";

  try {
    console.log("🔄 Iniciando sincronização de produtos...");

    // Conectar ao SQL Server (HubSpot)
    const pool = await getSQLServerConnection();

    // Query para buscar produtos únicos do LineItem
    const query = `
      SELECT DISTINCT
        li.name AS product_name,
        li.description AS product_description,
        li.hs_sku AS product_sku,
        li.price AS default_price,
        COUNT(*) as usage_count,
        SUM(CAST(ISNULL(li.amount, 0) AS DECIMAL(12,2))) as total_revenue
      FROM LineItem li
      WHERE li.name IS NOT NULL 
        AND LEN(TRIM(li.name)) > 0
      GROUP BY 
        li.name,
        li.description,
        li.hs_sku,
        li.price
      ORDER BY usage_count DESC
    `;

    const result = await pool.request().query(query);
    const hubspotProducts = result.recordset;

    console.log(`📦 Produtos no HubSpot: ${hubspotProducts.length}`);

    // Buscar produtos existentes no Supabase
    const { data: existingProducts, error: fetchError } = await supabase
      .from("products")
      .select("name, code, id");

    if (fetchError) {
      throw new Error(`Erro ao buscar produtos existentes: ${fetchError.message}`);
    }

    const existingNames = new Set(
      (existingProducts || []).map((p) => (p.name || "").trim().toLowerCase())
    );

    console.log(`✅ Produtos existentes no Supabase: ${existingNames.size}`);

    // Filtrar apenas novos produtos
    const newProducts = hubspotProducts.filter(
      (p) => !existingNames.has((p.product_name || "").trim().toLowerCase())
    );

    console.log(`➕ Novos produtos a inserir: ${newProducts.length}`);

    if (newProducts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nenhum novo produto encontrado",
        stats: {
          hubspot_total: hubspotProducts.length,
          existing: existingNames.size,
          new_products: 0,
          inserted: 0,
          duration_ms: Date.now() - startTime,
        },
      });
    }

    // Gerar próximo código sequencial
    const { data: lastProduct } = await supabase
      .from("products")
      .select("code")
      .like("code", "PROD-%")
      .order("code", { ascending: false })
      .limit(1)
      .single();

    let nextCode = 1;
    if (lastProduct?.code) {
      const match = lastProduct.code.match(/PROD-(\d+)/);
      if (match) {
        nextCode = parseInt(match[1]) + 1;
      }
    }

    // Preparar produtos para inserção
    const productsToInsert = newProducts.map((p, index) => {
      const code = p.product_sku || `PROD-${String(nextCode + index).padStart(4, "0")}`;

      // Detectar categoria pelo nome
      let category = "Other";
      const name = (p.product_name || "").toLowerCase();

      if (name.includes("clinic") || name.includes("clínica")) {
        category = "Clinic Fee";
      } else if (name.includes("residency")) {
        category = "Residency";
      } else if (name.includes("course") || name.includes("curso")) {
        category = "Course";
      } else if (name.includes("workshop") || name.includes("module")) {
        category = "Workshop/Module";
      } else if (name.includes("subscription") || name.includes("assinatura")) {
        category = "Subscription";
      } else if (name.includes("coaching")) {
        category = "Coaching";
      } else if (name.includes("certification")) {
        category = "Certification";
      } else if (name.includes("planning")) {
        category = "Planning";
      } else if (name.includes("design")) {
        category = "Design";
      } else if (name.includes("manufacture")) {
        category = "Manufacture";
      }

      return {
        code,
        name: p.product_name,
        description: p.product_description || null,
        default_price: p.default_price ? parseFloat(p.default_price) : null,
        currency: "EUR",
        category,
        product_type: "service",
        scope: "GLOBAL",
        is_active: true,
        source: "hubspot-lineitem",
        external_id: p.product_sku || null,
      };
    });

    // Inserir em lotes
    const batchSize = 50;
    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < productsToInsert.length; i += batchSize) {
      const batch = productsToInsert.slice(i, i + batchSize);

      const { error } = await supabase.from("products").insert(batch);

      if (error) {
        errors.push(`Lote ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }

    const duration = Date.now() - startTime;

    console.log(`✅ Sincronização concluída: ${inserted} produtos inseridos em ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: `${inserted} novos produtos sincronizados`,
      stats: {
        hubspot_total: hubspotProducts.length,
        existing: existingNames.size,
        new_products: newProducts.length,
        inserted,
        errors: errors.length > 0 ? errors : undefined,
        duration_ms: duration,
      },
      sample_new_products: newProducts.slice(0, 10).map((p) => p.product_name),
    });
  } catch (error) {
    console.error("❌ Erro na sincronização:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
