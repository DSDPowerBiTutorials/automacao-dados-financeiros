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
function formatYearMonth(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

    // Filter only clinics (is_clinic = true/Yes)
    const clinicTransactions = allTransactions.filter((tx) => {
        const isClinic = tx.custom_data?.is_clinic;
        return isClinic === true || isClinic === "Yes" || isClinic === "yes" || isClinic === "TRUE";
    });

    console.log(`   Found ${clinicTransactions.length} clinic transactions`);

    if (clinicTransactions.length === 0) {
        console.log("⚠️ No clinic transactions found. Exiting.");
        return;
    }

    // Step 2: Aggregate by email to create unique clinics
    console.log("\n📊 Step 2: Aggregating by email...");

    const clinicsMap = new Map();
    const monthlyStatsMap = new Map(); // key: email|year_month

    for (const tx of clinicTransactions) {
        const email = (tx.custom_data?.email || "").toLowerCase().trim();
        if (!email) continue;

        const txDate = new Date(tx.date);
        const yearMonth = formatYearMonth(txDate);
        const amount = parseEuropeanNumber(tx.amount);

        // Aggregate clinic master data
        if (!clinicsMap.has(email)) {
            clinicsMap.set(email, {
                email,
                name: tx.custom_data?.customer_name || tx.custom_data?.client_name || null,
                company_name: tx.custom_data?.company_name || null,
                country: tx.custom_data?.country || null,
                region: tx.custom_data?.region || null,
                level: tx.custom_data?.level || null,
                first_transaction_date: tx.date,
                last_transaction_date: tx.date,
                total_revenue: 0,
                transaction_count: 0,
                months: new Set(),
            });
        }

        const clinic = clinicsMap.get(email);
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

        // Update name if we have a better one
        if (!clinic.name && tx.custom_data?.customer_name) {
            clinic.name = tx.custom_data.customer_name;
        }

        // Monthly stats
        const monthKey = `${email}|${yearMonth}`;
        if (!monthlyStatsMap.has(monthKey)) {
            monthlyStatsMap.set(monthKey, {
                email,
                year_month: yearMonth,
                revenue: 0,
                transaction_count: 0,
                level: tx.custom_data?.level || null,
                region: tx.custom_data?.region || null,
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

    for (const [email, clinic] of clinicsMap) {
        const monthsArray = Array.from(clinic.months).sort().reverse();
        const lastMonths = monthsArray.slice(0, 3);

        let mrrSum = 0;
        let mrrCount = 0;

        for (const ym of lastMonths) {
            const stats = monthlyStatsMap.get(`${email}|${ym}`);
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

    for (const [email, clinic] of clinicsMap) {
        // Detect NEW event (first month)
        const firstMonth = formatYearMonth(clinic.first_transaction_date);
        events.push({
            email,
            event_type: "New",
            event_date: clinic.first_transaction_date,
            year_month: firstMonth,
            previous_status: null,
            new_status: "active",
            is_auto_detected: true,
            confirmed: true, // New is always confirmed automatically
        });

        // Detect potential CHURN (last transaction > 2 months ago)
        const lastTxDate = new Date(clinic.last_transaction_date);
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

        if (lastTxDate < twoMonthsAgo) {
            const churnMonth = formatYearMonth(new Date(lastTxDate.getFullYear(), lastTxDate.getMonth() + 1, 1));
            events.push({
                email,
                event_type: "Churn",
                event_date: new Date(lastTxDate.getFullYear(), lastTxDate.getMonth() + 1, 1).toISOString().split("T")[0],
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
        .select("id, email");

    if (fetchError) {
        console.error("❌ Error fetching clinic IDs:", fetchError.message);
        return;
    }

    const emailToId = new Map(insertedClinics.map(c => [c.email, c.id]));
    console.log(`   Fetched ${emailToId.size} clinic IDs`);

    // Insert monthly stats
    console.log("\n📊 Step 7: Inserting monthly stats...");
    const statsToInsert = Array.from(monthlyStatsMap.values())
        .map(s => ({
            clinic_id: emailToId.get(s.email),
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
            clinic_id: emailToId.get(e.email),
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
