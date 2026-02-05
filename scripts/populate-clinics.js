#!/usr/bin/env node

/**
 * Script para popular tabelas de clinics a partir de csv_rows
 * 
 * Este script:
 * 1. Lê todas as transações de invoice-orders onde is_clinic = true
 * 2. Agrega por email para criar registros únicos na tabela clinics
 * 3. Cria estatísticas mensais por clinic
 * 4. Auto-detecta eventos (New, possíveis Churns)
 * 
 * Usage: node scripts/populate-clinics.js [--dry-run]
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const isDryRun = process.argv.includes("--dry-run");

// Helpers
function formatYearMonth(dateStr) {
    // Parsing manual sem conversão de timezone: extrai YYYY-MM da string diretamente
    if (!dateStr) return null;
    const str = String(dateStr).split("T")[0]; // Remove parte de hora se existir
    const [year, month] = str.split("-");
    if (!year || !month) return null;
    return `${year}-${month}`;
}

function parseEuropeanNumber(str) {
    if (typeof str === "number") return str;
    if (!str) return 0;
    return parseFloat(str.toString().replace(/\./g, "").replace(",", ".")) || 0;
}

// Main function
async function populateClinics() {
    console.log("🏥 Populate Clinics Script");
    console.log("==========================");
    if (isDryRun) {
        console.log("🔍 DRY RUN MODE - No changes will be made\n");
    }

    // Step 1: Fetch all invoice-orders transactions
    console.log("\n📊 Step 1: Fetching invoice-orders transactions...");

    let allTransactions = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
        const { data, error } = await supabase
            .from("csv_rows")
            .select("id, date, amount, custom_data")
            .eq("source", "invoice-orders")
            .order("date", { ascending: true })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error("❌ Error fetching transactions:", error.message);
            process.exit(1);
        }

        if (!data || data.length === 0) break;

        allTransactions = allTransactions.concat(data);
        offset += limit;

        if (data.length < limit) break;
    }

    console.log(`   Found ${allTransactions.length} total transactions`);

    // Filter only clinics by financial_account_code (102.x, 103.x, 104.x)
    const clinicTransactions = allTransactions.filter((tx) => {
        const faCode = tx.custom_data?.financial_account_code || "";
        return faCode.startsWith("102.") || faCode.startsWith("103.") || faCode.startsWith("104.");
    });

    console.log(`   Found ${clinicTransactions.length} clinic transactions`);

    if (clinicTransactions.length === 0) {
        console.log("⚠️ No clinic transactions found. Exiting.");
        return;
    }

    // Step 2: Aggregate by customer_name to create unique clinics
    console.log("\n📊 Step 2: Aggregating by customer_name...");

    const clinicsMap = new Map();
    const monthlyStatsMap = new Map(); // key: customerName|year_month

    for (const tx of clinicTransactions) {
        const customerName = (tx.custom_data?.customer_name || "").trim();
        if (!customerName) continue;

        const txDate = new Date(tx.date);
        const yearMonth = formatYearMonth(txDate);
        const amount = parseEuropeanNumber(tx.amount);

        // Determine region from FA code
        const faCode = tx.custom_data?.financial_account_code || "";
        const isAmex = faCode.endsWith(".2") || faCode.endsWith(".4"); // AMEX codes end in .2 or .4
        const region = isAmex ? "AMEX" : "ROW";

        // Determine level from FA code
        let level = null;
        if (faCode.includes(".1") || faCode.includes(".2")) level = "Level 3"; // Contracted
        else if (faCode.includes(".3") || faCode.includes(".4")) level = "Level 3 New";
        else if (faCode.includes(".5")) level = "Level 2";
        else if (faCode.includes(".6")) level = "Level 1";

        // Aggregate clinic master data
        if (!clinicsMap.has(customerName)) {
            clinicsMap.set(customerName, {
                email: customerName.toLowerCase().replace(/[^a-z0-9]/g, "_") + "@clinic.local", // Generate pseudo-email
                name: customerName,
                company_name: tx.custom_data?.company_name || null,
                country: tx.custom_data?.country || null,
                region: region,
                level: level,
                first_transaction_date: tx.date,
                last_transaction_date: tx.date,
                total_revenue: 0,
                transaction_count: 0,
                months: new Set(),
            });
        }

        const clinic = clinicsMap.get(customerName);
        clinic.total_revenue += amount;
        clinic.transaction_count++;
        clinic.months.add(yearMonth);

        // Track first and last transaction
        if (new Date(tx.date) < new Date(clinic.first_transaction_date)) {
            clinic.first_transaction_date = tx.date;
        }
        if (new Date(tx.date) > new Date(clinic.last_transaction_date)) {
            clinic.last_transaction_date = tx.date;
        }

        // Monthly stats
        const monthKey = `${customerName}|${yearMonth}`;
        if (!monthlyStatsMap.has(monthKey)) {
            monthlyStatsMap.set(monthKey, {
                customerName,
                year_month: yearMonth,
                revenue: 0,
                transaction_count: 0,
                level: level,
                region: region,
            });
        }

        const monthStats = monthlyStatsMap.get(monthKey);
        monthStats.revenue += amount;
        monthStats.transaction_count++;
    }

    console.log(`   Found ${clinicsMap.size} unique clinics`);
    console.log(`   Generated ${monthlyStatsMap.size} monthly stats records`);

    // Step 3: Calculate MRR (average of last 3 months with transactions)
    console.log("\n📊 Step 3: Calculating MRR...");

    for (const [customerName, clinic] of clinicsMap) {
        const monthsArray = Array.from(clinic.months).sort().reverse();
        const lastMonths = monthsArray.slice(0, 3);

        let mrrSum = 0;
        let mrrCount = 0;

        for (const ym of lastMonths) {
            const stats = monthlyStatsMap.get(`${customerName}|${ym}`);
            if (stats) {
                mrrSum += stats.revenue;
                mrrCount++;
            }
        }

        clinic.mrr = mrrCount > 0 ? mrrSum / mrrCount : 0;
        delete clinic.months; // Remove before insert
    }

    // Step 4: Detect events
    console.log("\n📊 Step 4: Detecting lifecycle events...");

    const events = [];
    const sortedMonths = Array.from(new Set(Array.from(monthlyStatsMap.values()).map(s => s.year_month))).sort();
    
    // Find the latest month in the dataset (use this as reference, not current date)
    const latestMonth = sortedMonths[sortedMonths.length - 1] || formatYearMonth(new Date().toISOString().split("T")[0]);
    const [latestYear, latestMonthNum] = latestMonth.split("-").map(Number);
    // Calculate 2 months before the latest data
    const refDate = new Date(latestYear, latestMonthNum - 1, 1); // Month is 0-indexed
    refDate.setMonth(refDate.getMonth() - 2);

    for (const [customerName, clinic] of clinicsMap) {
        // Detect NEW event (first month)
        const firstMonth = formatYearMonth(clinic.first_transaction_date);
        if (firstMonth) {
            events.push({
                customerName,
                event_type: "New",
                event_date: clinic.first_transaction_date,
                year_month: firstMonth,
                previous_status: null,
                new_status: "active",
                is_auto_detected: true,
                confirmed: true, // New is always confirmed automatically
            });
        }

        // Detect potential CHURN (last transaction > 2 months before latest data)
        const lastTxStr = String(clinic.last_transaction_date).split("T")[0];
        const [lastYear, lastMonthStr] = lastTxStr.split("-").map(Number);
        const lastTxDate = new Date(lastYear, lastMonthStr - 1, 1);

        if (lastTxDate < refDate) {
            // Calculate churn month (month after last transaction)
            const churnDate = new Date(lastYear, lastMonthStr, 1); // Next month after last tx
            const churnMonth = `${churnDate.getFullYear()}-${String(churnDate.getMonth() + 1).padStart(2, "0")}`;
            events.push({
                customerName,
                event_type: "Churn",
                event_date: `${churnDate.getFullYear()}-${String(churnDate.getMonth() + 1).padStart(2, "0")}-01`,
                year_month: churnMonth,
                previous_status: "active",
                new_status: "churned",
                is_auto_detected: true,
                confirmed: false, // Needs user confirmation
            });

            clinic.status = "churned";
        }
    }

    console.log(`   Detected ${events.length} events (${events.filter(e => e.event_type === "New").length} New, ${events.filter(e => e.event_type === "Churn").length} potential Churns)`);

    // Step 5: Insert into database
    if (isDryRun) {
        console.log("\n🔍 DRY RUN - Would insert:");
        console.log(`   - ${clinicsMap.size} clinics`);
        console.log(`   - ${monthlyStatsMap.size} monthly stats`);
        console.log(`   - ${events.length} events`);

        // Show sample data
        console.log("\n📋 Sample clinic data:");
        const sampleClinic = Array.from(clinicsMap.values())[0];
        console.log(JSON.stringify(sampleClinic, null, 2));

        return;
    }

    console.log("\n📊 Step 5: Inserting clinics into database...");

    // Clear existing data (optional - comment out if you want to append)
    console.log("   Clearing existing data...");
    await supabase.from("clinic_events").delete().neq("id", 0);
    await supabase.from("clinic_monthly_stats").delete().neq("id", 0);
    await supabase.from("clinics").delete().neq("id", 0);

    // Insert clinics
    const clinicsToInsert = Array.from(clinicsMap.values()).map(c => ({
        email: c.email,
        name: c.name,
        company_name: c.company_name,
        country: c.country,
        region: c.region,
        level: c.level,
        status: c.status || "active",
        first_transaction_date: c.first_transaction_date,
        last_transaction_date: c.last_transaction_date,
        mrr: c.mrr,
        total_revenue: c.total_revenue,
        transaction_count: c.transaction_count,
    }));

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < clinicsToInsert.length; i += batchSize) {
        const batch = clinicsToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from("clinics").insert(batch);
        if (error) {
            console.error(`   ❌ Error inserting clinics batch ${i}:`, error.message);
        } else {
            console.log(`   ✅ Inserted clinics ${i + 1}-${Math.min(i + batchSize, clinicsToInsert.length)}`);
        }
    }

    // Get clinic IDs for foreign keys
    console.log("\n📊 Step 6: Fetching clinic IDs...");
    const { data: insertedClinics, error: fetchError } = await supabase
        .from("clinics")
        .select("id, email, name");

    if (fetchError) {
        console.error("❌ Error fetching clinic IDs:", fetchError.message);
        return;
    }

    // Map by name (customerName) since that's our unique key
    const nameToId = new Map(insertedClinics.map(c => [c.name, c.id]));
    console.log(`   Fetched ${nameToId.size} clinic IDs`);

    // Insert monthly stats
    console.log("\n📊 Step 7: Inserting monthly stats...");
    const statsToInsert = Array.from(monthlyStatsMap.values())
        .map(s => ({
            clinic_id: nameToId.get(s.customerName),
            year_month: s.year_month,
            revenue: s.revenue,
            transaction_count: s.transaction_count,
            level: s.level,
            region: s.region,
        }))
        .filter(s => s.clinic_id); // Only insert if we have a valid clinic_id

    for (let i = 0; i < statsToInsert.length; i += batchSize) {
        const batch = statsToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from("clinic_monthly_stats").insert(batch);
        if (error) {
            console.error(`   ❌ Error inserting stats batch ${i}:`, error.message);
        } else {
            console.log(`   ✅ Inserted stats ${i + 1}-${Math.min(i + batchSize, statsToInsert.length)}`);
        }
    }

    // Insert events
    console.log("\n📊 Step 8: Inserting events...");
    const eventsToInsert = events
        .map(e => ({
            clinic_id: nameToId.get(e.customerName),
            event_type: e.event_type,
            event_date: e.event_date,
            year_month: e.year_month,
            previous_status: e.previous_status,
            new_status: e.new_status,
            is_auto_detected: e.is_auto_detected,
            confirmed: e.confirmed,
        }))
        .filter(e => e.clinic_id);

    for (let i = 0; i < eventsToInsert.length; i += batchSize) {
        const batch = eventsToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from("clinic_events").insert(batch);
        if (error) {
            console.error(`   ❌ Error inserting events batch ${i}:`, error.message);
        } else {
            console.log(`   ✅ Inserted events ${i + 1}-${Math.min(i + batchSize, eventsToInsert.length)}`);
        }
    }

    // Summary
    console.log("\n✅ Population complete!");
    console.log("=======================");
    console.log(`   Clinics: ${clinicsMap.size}`);
    console.log(`   Monthly Stats: ${statsToInsert.length}`);
    console.log(`   Events: ${eventsToInsert.length}`);
    console.log(`   - Active: ${Array.from(clinicsMap.values()).filter(c => c.status !== "churned").length}`);
    console.log(`   - Churned (pending confirmation): ${Array.from(clinicsMap.values()).filter(c => c.status === "churned").length}`);
}

populateClinics().catch(console.error);
