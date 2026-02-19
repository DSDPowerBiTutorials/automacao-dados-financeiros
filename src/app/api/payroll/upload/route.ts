import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

// ════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════

interface PayrollEmployee {
    employeeId: string;
    lastName1: string;
    lastName2: string;
    firstName: string;
    fullName: string;
    department: string;
    departmentCode: string;
    concepts: PayrollConcept[];
    totalBruto: number;
    totalDeducciones: number;
    totalLiquido: number;
    ssEmpresa: number;
    ssTrabajador: number;
    costeEmpresa: number;
    irpf: number;
    irpfPercent: number;
    diasCotizados: number;
}

interface PayrollConcept {
    code: number;
    description: string;
    amount: number;
    isDeduction: boolean;
}

interface DepartmentSummary {
    name: string;
    code: string;
    employeeCount: number;
    totalBruto: number;
    totalDeducciones: number;
    totalLiquido: number;
    ssEmpresa: number;
    costeEmpresa: number;
    concepts: PayrollConcept[];
}

interface PayrollData {
    period: string;
    company: string;
    nif: string;
    currency: string;
    departments: DepartmentSummary[];
    employees: PayrollEmployee[];
    totals: {
        totalBruto: number;
        totalDeducciones: number;
        totalLiquido: number;
        ssEmpresa: number;
        ssTrabajador: number;
        ssTotal: number;
        costeEmpresa: number;
        employeeCount: number;
        irpfTotal: number;
    };
}

// ════════════════════════════════════════════════════════
// Parser
// ════════════════════════════════════════════════════════

function parsePayrollXLSX(buffer: ArrayBuffer): PayrollData {
    const wb = XLSX.read(buffer, { type: "array" });
    const sheetNames = wb.SheetNames;

    const employees: PayrollEmployee[] = [];
    const departments: DepartmentSummary[] = [];

    let period = "";
    let company = "";
    let nif = "";
    let currency = "Euro";

    // Sheets come in pairs: odd = individual employees, even = department totals
    // Last even sheet also has company totals
    for (let i = 0; i < sheetNames.length; i += 2) {
        const individualSheet = wb.Sheets[sheetNames[i]];
        const summarySheet = wb.Sheets[sheetNames[i + 1]];

        const indData: (string | number)[][] = XLSX.utils.sheet_to_json(
            individualSheet,
            { header: 1, defval: "" },
        );
        const sumData: (string | number)[][] = summarySheet
            ? XLSX.utils.sheet_to_json(summarySheet, { header: 1, defval: "" })
            : [];

        // Extract metadata from row 1-4
        if (!period && indData[3]) {
            const periodStr = String(indData[3][0] || "");
            period = periodStr.replace(/^DEL\s+/, "").trim();
        }
        if (!company && indData[4]) {
            const compStr = String(indData[4][0] || "");
            const match = compStr.match(
                /Empresa:\s+\d+-(.+?)\s+NIF:\s+(.+?)$/,
            );
            if (match) {
                company = match[1].trim();
                nif = match[2].trim();
            }
        }
        if (indData[1]) {
            const curStr = String(indData[1][0] || "");
            if (curStr.includes("Euro")) currency = "Euro";
        }

        // Department name from row 1, col D
        const deptFull = String(indData[1]?.[3] || "").trim();
        const deptMatch = deptFull.match(/^(\d+)\s+(.+)$/);
        const deptCode = deptMatch ? deptMatch[1] : "";
        const deptName = deptMatch ? deptMatch[2] : deptFull;

        // Employee IDs from row 3, starting col D (index 3)
        const employeeIds: string[] = [];
        if (indData[3]) {
            for (let c = 3; c < indData[3].length; c++) {
                const val = String(indData[3][c] || "").trim();
                if (val && val !== "TOTAL") employeeIds.push(val);
            }
        }

        // Employee names from rows 4-6
        const lastNames1: string[] = [];
        const lastNames2: string[] = [];
        const firstNames: string[] = [];

        for (let c = 3; c < 3 + employeeIds.length; c++) {
            lastNames1.push(String(indData[4]?.[c] || "").trim());
            lastNames2.push(String(indData[5]?.[c] || "").trim());
            firstNames.push(String(indData[6]?.[c] || "").trim());
        }

        // Find key rows
        let totalBrutoRow = -1;
        let totalDeduccionesRow = -1;
        let totalLiquidoRow = -1;

        for (let r = 0; r < indData.length; r++) {
            const firstCell = String(indData[r]?.[0] || "").trim();
            if (firstCell === "TOTAL BRUTO") totalBrutoRow = r;
            if (firstCell === "TOTAL DEDUCCIONES") totalDeduccionesRow = r;
            if (firstCell === "TOTAL LIQUIDO") totalLiquidoRow = r;
        }

        // Parse concepts (rows between row 10 and TOTAL BRUTO) = earnings
        // Parse deductions (rows between TOTAL BRUTO and TOTAL DEDUCCIONES)
        const earningRows: number[] = [];
        const deductionRows: number[] = [];

        for (let r = 10; r < indData.length; r++) {
            const code = indData[r]?.[1];
            if (typeof code === "number" && code > 0) {
                if (r < totalBrutoRow) {
                    earningRows.push(r);
                } else if (r > totalBrutoRow && r < totalDeduccionesRow) {
                    deductionRows.push(r);
                }
            }
        }

        // Find SS and cost rows
        const findRow = (label: string): number => {
            for (let r = totalLiquidoRow; r < indData.length; r++) {
                if (String(indData[r]?.[0] || "").trim().startsWith(label)) return r;
            }
            return -1;
        };

        const ssEmpresaRow = findRow("SEGURIDAD SOCIAL EMPRESA");
        const ssTrabajadorRow = findRow("SEGURIDAD SOCIAL TRABAJADOR");
        const costeEmpresaRow = findRow("COSTE EMPRESA");
        const diasCotizadosRow = findRow("DIAS COTIZADOS");

        // Build employee objects
        for (let idx = 0; idx < employeeIds.length; idx++) {
            const col = 3 + idx;
            const concepts: PayrollConcept[] = [];

            for (const r of earningRows) {
                const amount = Number(indData[r]?.[col]) || 0;
                if (amount !== 0) {
                    concepts.push({
                        code: Number(indData[r]?.[1]),
                        description: String(indData[r]?.[2] || "").trim(),
                        amount,
                        isDeduction: false,
                    });
                }
            }

            for (const r of deductionRows) {
                const amount = Number(indData[r]?.[col]) || 0;
                if (amount !== 0) {
                    concepts.push({
                        code: Number(indData[r]?.[1]),
                        description: String(indData[r]?.[2] || "").trim(),
                        amount,
                        isDeduction: true,
                    });
                }
            }

            const totalBruto =
                totalBrutoRow >= 0 ? Number(indData[totalBrutoRow]?.[col]) || 0 : 0;
            const totalDeducciones =
                totalDeduccionesRow >= 0
                    ? Number(indData[totalDeduccionesRow]?.[col]) || 0
                    : 0;
            const totalLiquido =
                totalLiquidoRow >= 0
                    ? Number(indData[totalLiquidoRow]?.[col]) || 0
                    : 0;
            const ssEmpresa =
                ssEmpresaRow >= 0
                    ? Number(indData[ssEmpresaRow]?.[col]) || 0
                    : 0;
            const ssTrabajador =
                ssTrabajadorRow >= 0
                    ? Number(indData[ssTrabajadorRow]?.[col]) || 0
                    : 0;
            const costeEmpresa =
                costeEmpresaRow >= 0
                    ? Number(indData[costeEmpresaRow]?.[col]) || 0
                    : 0;
            const diasCotizados =
                diasCotizadosRow >= 0
                    ? Number(indData[diasCotizadosRow]?.[col]) || 0
                    : 0;

            // Find IRPF
            const irpfConcept = concepts.find((c) => c.code === 999);
            const irpf = irpfConcept ? irpfConcept.amount : 0;

            // Base IRPF for percentage calculation
            let baseIrpfRow = -1;
            for (let r = totalLiquidoRow; r < indData.length; r++) {
                if (
                    String(indData[r]?.[0] || "")
                        .trim()
                        .startsWith("BASE I.R.P.F. DINERARIA")
                )
                    baseIrpfRow = r;
            }
            const baseIrpf =
                baseIrpfRow >= 0
                    ? Number(indData[baseIrpfRow]?.[col]) || 0
                    : 0;
            const irpfPercent =
                baseIrpf > 0 ? Math.round((irpf / baseIrpf) * 10000) / 100 : 0;

            const fullName = [firstNames[idx], lastNames1[idx], lastNames2[idx]]
                .filter(Boolean)
                .join(" ");

            employees.push({
                employeeId: employeeIds[idx],
                lastName1: lastNames1[idx],
                lastName2: lastNames2[idx],
                firstName: firstNames[idx],
                fullName,
                department: deptName,
                departmentCode: deptCode,
                concepts,
                totalBruto,
                totalDeducciones,
                totalLiquido,
                ssEmpresa,
                ssTrabajador,
                costeEmpresa,
                irpf,
                irpfPercent,
                diasCotizados,
            });
        }

        // Department summary from summary sheet
        if (sumData.length > 0) {
            const deptConcepts: PayrollConcept[] = [];
            let dTotalBruto = 0;
            let dTotalDeducciones = 0;
            let dTotalLiquido = 0;
            let dSSEmpresa = 0;
            let dCosteEmpresa = 0;
            let dTotalBrutoRow = -1;
            let dTotalDeduccionesRow = -1;
            let dTotalLiquidoRow = -1;

            // The department total is in column D (index 3)
            const sumCol = 3;

            for (let r = 0; r < sumData.length; r++) {
                const label = String(sumData[r]?.[0] || "").trim();
                if (label === "TOTAL BRUTO") dTotalBrutoRow = r;
                if (label === "TOTAL DEDUCCIONES") dTotalDeduccionesRow = r;
                if (label === "TOTAL LIQUIDO") dTotalLiquidoRow = r;
            }

            // Parse concepts
            for (let r = 10; r < sumData.length; r++) {
                const code = sumData[r]?.[1];
                if (typeof code === "number" && code > 0) {
                    const amount = Number(sumData[r]?.[sumCol]) || 0;
                    if (amount !== 0) {
                        const isDeduction =
                            dTotalBrutoRow >= 0 &&
                            dTotalDeduccionesRow >= 0 &&
                            r > dTotalBrutoRow &&
                            r < dTotalDeduccionesRow;
                        deptConcepts.push({
                            code,
                            description: String(sumData[r]?.[2] || "").trim(),
                            amount,
                            isDeduction,
                        });
                    }
                }
            }

            dTotalBruto =
                dTotalBrutoRow >= 0
                    ? Number(sumData[dTotalBrutoRow]?.[sumCol]) || 0
                    : 0;
            dTotalDeducciones =
                dTotalDeduccionesRow >= 0
                    ? Number(sumData[dTotalDeduccionesRow]?.[sumCol]) || 0
                    : 0;
            dTotalLiquido =
                dTotalLiquidoRow >= 0
                    ? Number(sumData[dTotalLiquidoRow]?.[sumCol]) || 0
                    : 0;

            // Find SS Empresa and Coste Empresa
            for (let r = (dTotalLiquidoRow >= 0 ? dTotalLiquidoRow : 0); r < sumData.length; r++) {
                const label = String(sumData[r]?.[0] || "").trim();
                if (label.startsWith("SEGURIDAD SOCIAL EMPRESA"))
                    dSSEmpresa = Number(sumData[r]?.[sumCol]) || 0;
                if (label.startsWith("COSTE EMPRESA"))
                    dCosteEmpresa = Number(sumData[r]?.[sumCol]) || 0;
            }

            // Get employee count from summary
            let dEmpCount = 0;
            for (let r = 0; r < sumData.length; r++) {
                if (
                    String(sumData[r]?.[0] || "")
                        .trim()
                        .startsWith("TOTAL TRABAJADORES")
                ) {
                    dEmpCount = Number(sumData[r]?.[sumCol]) || 0;
                }
            }

            departments.push({
                name: deptName,
                code: deptCode,
                employeeCount: dEmpCount || employeeIds.length,
                totalBruto: dTotalBruto,
                totalDeducciones: dTotalDeducciones,
                totalLiquido: dTotalLiquido,
                ssEmpresa: dSSEmpresa,
                costeEmpresa: dCosteEmpresa,
                concepts: deptConcepts,
            });
        }
    }

    // Get company totals from last summary sheet
    const lastSumSheet = wb.Sheets[sheetNames[sheetNames.length - 1]];
    const lastSumData: (string | number)[][] = XLSX.utils.sheet_to_json(
        lastSumSheet,
        { header: 1, defval: "" },
    );

    // Company total is in the last column of the last summary sheet
    const lastCol = lastSumData[3]
        ? lastSumData[3].length - 1
        : lastSumData[4]
            ? lastSumData[4].length - 1
            : 4;

    let companyTotals = {
        totalBruto: 0,
        totalDeducciones: 0,
        totalLiquido: 0,
        ssEmpresa: 0,
        ssTrabajador: 0,
        ssTotal: 0,
        costeEmpresa: 0,
        employeeCount: 0,
        irpfTotal: 0,
    };

    for (let r = 0; r < lastSumData.length; r++) {
        const label = String(lastSumData[r]?.[0] || "").trim();
        const val = Number(lastSumData[r]?.[lastCol]) || 0;

        if (label === "TOTAL BRUTO") companyTotals.totalBruto = val;
        if (label === "TOTAL DEDUCCIONES") companyTotals.totalDeducciones = val;
        if (label === "TOTAL LIQUIDO") companyTotals.totalLiquido = val;
        if (label.startsWith("SEGURIDAD SOCIAL EMPRESA"))
            companyTotals.ssEmpresa = val;
        if (label.startsWith("SEGURIDAD SOCIAL TRABAJADOR"))
            companyTotals.ssTrabajador = val;
        if (label.startsWith("SEGURIDAD SOCIAL TOTAL"))
            companyTotals.ssTotal = val;
        if (label.startsWith("COSTE EMPRESA")) companyTotals.costeEmpresa = val;
        if (label.startsWith("TOTAL TRABAJADORES"))
            companyTotals.employeeCount = val;
    }

    // Find IRPF total from concepts
    for (let r = 0; r < lastSumData.length; r++) {
        const code = lastSumData[r]?.[1];
        if (code === 999) {
            companyTotals.irpfTotal = Number(lastSumData[r]?.[lastCol]) || 0;
        }
    }

    return {
        period,
        company,
        nif,
        currency,
        departments,
        employees,
        totals: companyTotals,
    };
}

// ════════════════════════════════════════════════════════
// POST handler
// ════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: "No file provided" },
                { status: 400 },
            );
        }

        if (
            !file.name.endsWith(".xlsx") &&
            !file.name.endsWith(".xls")
        ) {
            return NextResponse.json(
                { success: false, error: "File must be .xlsx or .xls" },
                { status: 400 },
            );
        }

        const buffer = await file.arrayBuffer();
        const data = parsePayrollXLSX(buffer);

        return NextResponse.json({
            success: true,
            data,
            fileName: file.name,
            fileSize: file.size,
        });
    } catch (error: unknown) {
        console.error("Payroll upload error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to parse payroll file",
            },
            { status: 500 },
        );
    }
}
