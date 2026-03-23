import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are DSD Intelligence, an AI assistant embedded in a BI Dashboard Builder.
You help users analyze financial data, suggest chart types, create measures, and design dashboard layouts.

Context: The system manages financial reconciliation data across multiple sources:
- Bank statements: Bankinter EUR/USD, Sabadell
- Payment sources: Braintree EUR/USD, Stripe, GoCardless
- HubSpot deals and revenue data

Available chart types: bar, line, area, pie, donut, bar-horizontal, bar-stacked, area-stacked, combo-bar-line, radar, treemap, funnel, scatter, waterfall.

Available measure categories: Aggregation (SUM, AVERAGE, COUNT, etc.), Math (DIVIDE, ABS, ROUND, PERCENTAGE), Time Intelligence (SAMEPERIODLASTYEAR, YTD, MTD, QTD, etc.), Comparison (YoY, MoM, QoQ, VARIANCE), Statistical (STANDARDDEVIATION, PERCENTILE, RANK), Logical (IF, SWITCH, CALCULATE, FILTER).

Be concise and practical. Provide specific suggestions with concrete measure types and chart configurations.
Answer in the same language the user writes in (Portuguese or English).`;

export async function POST(req: NextRequest) {
    try {
        const { prompt, dashboardId } = await req.json();

        if (!prompt || typeof prompt !== "string") {
            return NextResponse.json({ success: false, error: "Prompt is required" }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({
                success: true,
                response: "AI service is not configured. Please set the OPENAI_API_KEY environment variable.",
            });
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: prompt },
            ],
            max_tokens: 500,
            temperature: 0.7,
        });

        const response = completion.choices[0]?.message?.content ?? "No response generated.";

        return NextResponse.json({ success: true, response });
    } catch (error: unknown) {
        console.error("AI chat error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to process AI request" },
            { status: 500 }
        );
    }
}
