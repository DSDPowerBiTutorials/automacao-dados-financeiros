import { NextResponse } from 'next/server';

const PLEO_TOKEN = process.env.PLEO_API_TOKEN;

// Endpoint de teste para diagnosticar problemas com a API Pleo
export async function GET() {
  try {
    if (!PLEO_TOKEN) {
      return NextResponse.json({
        success: false,
        error: 'PLEO_API_TOKEN não configurado'
      }, { status: 500 });
    }

    // Testar todos os endpoints possíveis
    const bases = [
      'https://external.pleo.io/v2',
      'https://external.pleo.io/v1',
      'https://api.pleo.io/v2',
      'https://api.pleo.io/v1'
    ];

    const endpoints = [
      'expenses',
      'transactions',
      'export',
      'spending',
      'users/me',
      'companies',
      'cards'
    ];

    const results: Array<{
      url: string;
      status?: number;
      statusText?: string;
      ok: boolean;
      contentType?: string | null;
      error?: string;
      sampleData?: any;
      parseError?: string;
    }> = [];

    for (const base of bases) {
      for (const endpoint of endpoints) {
        const url = `${base}/${endpoint}`;
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${PLEO_TOKEN}`,
              'Accept': 'application/json'
            }
          });

          const result: any = {
            url,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            contentType: response.headers.get('content-type')
          };

          // Se encontrou um endpoint que funciona, tentar buscar dados
          if (response.ok) {
            try {
              const data = await response.json();
              result.sampleData = data;
            } catch (e) {
              result.parseError = 'Failed to parse JSON';
            }
          }
          
          results.push(result);
        } catch (error: any) {
          results.push({
            url,
            error: error.message,
            ok: false
          });
        }
      }
    }

    // Informações do token
    const tokenInfo = {
      configured: !!PLEO_TOKEN,
      length: PLEO_TOKEN?.length,
      prefix: PLEO_TOKEN?.substring(0, 20) + '...'
    };

    return NextResponse.json({
      success: true,
      tokenInfo,
      results,
      workingEndpoints: results.filter(r => r.ok),
      summary: {
        total: results.length,
        working: results.filter(r => r.ok).length,
        failing: results.filter(r => !r.ok).length
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
