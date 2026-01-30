#!/usr/bin/env node
/**
 * Atualiza departmental_account_id baseado no tipo de produto
 * 
 * Lógica de inferência:
 * - Cursos, Courses, Residency, Mastership, Provider → Education (1.0.0 / 1.1.0)
 * - Design, Planning → Lab > Planning Center (2.1.1)
 * - Manufacture, LAB → Lab > Lab (2.1.0)
 * - Clinic Fee, Clinic Services → Lab > Delight (2.1.2)
 * - Subscription, Level 1/2 → Education (1.0.0 / 1.1.0)
 * - Corporate, Marketing → Corporate (3.0.0)
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs dos departmental_accounts
const DEPTS = {
  // Grupos (parent)
  EDUCATION_GROUP: "25c04275-bba1-42fc-b6ba-117dd039de33",    // 1.0.0 - Education
  LAB_GROUP: "2894b285-ba43-4e73-91c6-aa690ecd201f",          // 2.0.0 - Lab
  CORPORATE_GROUP: "a1bf80ec-948a-4385-90f9-762f5d536e14",    // 3.0.0 - Corporate
  
  // Subgrupos
  EDUCATION_SUB: "377e7aed-b949-4c15-ab6c-1e89cf12fd35",      // 1.1.0 - Education
  LAB_SUB: "0592eeb4-88e0-4022-b12e-dd1cf6eae6f1",            // 2.1.0 - Lab
  PLANNING_CENTER: "9e9a0ea4-2757-491e-bbf2-b1f34ea5025d",    // 2.1.1 - Planning Center
  DELIGHT: "57f27966-a2a0-4156-8dfd-557bd73e0b8f",            // 2.1.2 - Delight
  CORPORATE_SUB: "1ececfca-1247-4c2c-800a-c4eb319d5782",      // 3.1.0 - Corporate
  FINANCE: "ac575d18-2faa-43fd-9b9c-8fcf36f6117d",            // 3.1.1 - Finance
  MARKETING: "deb73212-ace9-4494-96b6-686a82f10d20",          // 3.1.2 - Marketing
};

/**
 * Infere o departamento baseado no nome do produto e financial_account_code
 */
function inferDepartment(product) {
  const name = (product.name || "").toLowerCase();
  const code = product.code || "";
  const finAcct = product.financial_account_code || "";
  const category = (product.category || "").toLowerCase();
  
  // === EDUCATION (Cursos, Mastership, Provider, Residency) ===
  const educationPatterns = [
    "course", "curso", "mastership", "master certification",
    "provider", "residency", "hands on", "livestream",
    "on demand", "workshop", "summit", "meeting", "festival",
    "kois & coachman", "clinical seville", "clinical october",
    "coordinators course", "dsd clinical", "case acceptance",
    "designing smiles", "aligners", "watchdsd", "dsd online content"
  ];
  
  if (educationPatterns.some(p => name.includes(p)) || 
      finAcct.startsWith("101.") || // Cursos, Mastership, Membership
      finAcct === "105.1" || // Level 1 subscriptions
      category === "course" || category === "residency" || category === "certification") {
    return {
      group: DEPTS.EDUCATION_GROUP,
      subgroup: DEPTS.EDUCATION_SUB,
      label: "Education"
    };
  }
  
  // === LAB > PLANNING CENTER (Design, Planning) ===
  const planningPatterns = [
    "design", "planning", "upper", "lower", "upper & lower",
    "shell design", "prep guides design", "prep kit design",
    "tad guide design", "sfot guide design", "crown lengthening guide design",
    "clic guide design", "bite splint design", "diagnostic design",
    "interdisciplinary", "restorative planning", "ortho planning",
    "perio analysis", "motivational mockup design", "natural restoration design",
    "implant partial planning", "planning center access"
  ];
  
  if (planningPatterns.some(p => name.includes(p)) && !name.includes("manufacture")) {
    // Apenas se for Design/Planning sem Manufacture
    if (finAcct === "103.0" || name.includes("design") || name.includes("planning")) {
      return {
        group: DEPTS.LAB_GROUP,
        subgroup: DEPTS.PLANNING_CENTER,
        label: "Lab > Planning Center"
      };
    }
  }
  
  // === LAB > LAB (Manufacture) ===
  const labPatterns = [
    "manufacture", "manufactured", "mfg", "temp manufacture",
    "components", "implant abutment", "denture manufacture"
  ];
  
  if (labPatterns.some(p => name.includes(p)) || finAcct === "104.0") {
    return {
      group: DEPTS.LAB_GROUP,
      subgroup: DEPTS.LAB_SUB,
      label: "Lab > Lab"
    };
  }
  
  // === LAB > DELIGHT (Clinic Services, Clinic Fee) ===
  const delightPatterns = [
    "clinic fee", "clinic services", "monthly fee",
    "contract management fee", "coaching", "growth hub",
    "consultancy", "pc product discounts", "clinic exclusive"
  ];
  
  if (delightPatterns.some(p => name.includes(p)) || 
      finAcct === "102.1" || finAcct === "102.5" || finAcct === "102.7" ||
      category === "clinic fee" || category === "coaching") {
    return {
      group: DEPTS.LAB_GROUP,
      subgroup: DEPTS.DELIGHT,
      label: "Lab > Delight"
    };
  }
  
  // === EDUCATION (Subscriptions - Level 1/2) ===
  const subscriptionPatterns = [
    "level 1", "level 2", "subscription", "annual eur", "annual usd",
    "monthly plan", "annual plan", "growth subscription", "customer hub"
  ];
  
  if (subscriptionPatterns.some(p => name.includes(p)) || 
      finAcct.startsWith("105.") ||
      category === "subscription") {
    return {
      group: DEPTS.EDUCATION_GROUP,
      subgroup: DEPTS.EDUCATION_SUB,
      label: "Education (Subscription)"
    };
  }
  
  // === CORPORATE (Marketing, Sponsorship) ===
  const corporatePatterns = [
    "marketing", "sponsorship", "sponsor", "collaboration agreement"
  ];
  
  if (corporatePatterns.some(p => name.includes(p))) {
    return {
      group: DEPTS.CORPORATE_GROUP,
      subgroup: DEPTS.MARKETING,
      label: "Corporate > Marketing"
    };
  }
  
  // === Fallback baseado em financial_account_code ===
  if (finAcct === "103.0") {
    return {
      group: DEPTS.LAB_GROUP,
      subgroup: DEPTS.PLANNING_CENTER,
      label: "Lab > Planning Center (by finAcct)"
    };
  }
  
  if (finAcct === "104.0") {
    return {
      group: DEPTS.LAB_GROUP,
      subgroup: DEPTS.LAB_SUB,
      label: "Lab > Lab (by finAcct)"
    };
  }
  
  // Não conseguiu inferir
  return null;
}

async function main() {
  console.log("=== Carregando produtos ===\n");
  
  const { data: products, error } = await supabase
    .from("products")
    .select("id, code, name, category, financial_account_code")
    .order("code");
  
  if (error) {
    console.error("Erro ao carregar produtos:", error);
    return;
  }
  
  console.log(`📦 Total de produtos: ${products.length}\n`);
  
  let updated = 0;
  let skipped = 0;
  let noMatch = 0;
  const errors = [];
  
  const stats = {
    "Education": 0,
    "Lab > Planning Center": 0,
    "Lab > Lab": 0,
    "Lab > Delight": 0,
    "Corporate > Marketing": 0,
  };
  
  for (const product of products) {
    const dept = inferDepartment(product);
    
    if (!dept) {
      noMatch++;
      console.log(`❓ ${product.code}: ${product.name.substring(0, 50)}... → SEM MATCH`);
      continue;
    }
    
    const { error: updateError } = await supabase
      .from("products")
      .update({
        departmental_account_group_id: dept.group,
        departmental_account_subgroup_id: dept.subgroup,
      })
      .eq("id", product.id);
    
    if (updateError) {
      errors.push({ code: product.code, error: updateError.message });
      console.log(`❌ ${product.code}: ERRO - ${updateError.message}`);
    } else {
      updated++;
      stats[dept.label.split(" (")[0]] = (stats[dept.label.split(" (")[0]] || 0) + 1;
      console.log(`✅ ${product.code}: ${product.name.substring(0, 40)}... → ${dept.label}`);
    }
  }
  
  console.log("\n=== RESUMO ===");
  console.log(`✅ Atualizados: ${updated}`);
  console.log(`⏭️ Sem match: ${noMatch}`);
  console.log(`❌ Erros: ${errors.length}`);
  
  console.log("\n=== POR DEPARTAMENTO ===");
  Object.entries(stats).forEach(([dept, count]) => {
    if (count > 0) console.log(`  ${dept}: ${count}`);
  });
  
  if (errors.length > 0) {
    console.log("\n=== ERROS ===");
    errors.forEach(e => console.log(`  ${e.code}: ${e.error}`));
  }
}

main().catch(console.error);
