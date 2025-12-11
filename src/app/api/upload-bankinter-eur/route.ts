/* eslint-disable */
/* prettier-ignore-start */
/* @auto-fix-disable */
/* @formatter:off */

// 🚫 This file must remain a server-side API Route.
// 🚫 DO NOT add "use client" or any browser-only imports.
// 🚫 DO NOT modify or reformat — protected from auto-fix bots.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import crypto from "crypto";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type SheetRow = (string | number)[];

function normalizeNumber(val?: any): number {
  if (val === undefined || val === null) return 0;
  return parseFloat(String(val).replace(/\./g, "").replace(",", ".").trim()) || 0;
}

function normalizeDate(val: any): string {
  if (!val) return "";
  if (typeof val === "number") {
    const { y, m, d } = XLSX.SSF.parse_date_code(val);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const parts = String(val).trim().split(/[\/\-]/);
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    const fullYear = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    return `${fullYear}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return "";
}

function safeTrim(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).replace(/^"+|"+$/g, "").trim();
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file)
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
