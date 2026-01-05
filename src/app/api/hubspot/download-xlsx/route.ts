import { NextRequest, NextResponse } from 'next/server';
import Workbook from 'exceljs';
import { sql } from '@/lib/sqlserver';

export async function GET(request: NextRequest) {
    try {
        const deals = await sql.request()
            .query(`SELECT TOP 100 * FROM [Jorge9660].[dbo].[Deals]`);

        const workbook = new Workbook();
        const worksheet = workbook.addWorksheet('Deals');

        if (deals.recordset.length === 0) {
            return NextResponse.json(
                { error: 'No deals found' },
                { status: 404 }
            );
        }

        const columns = Object.keys(deals.recordset[0]);
        worksheet.columns = columns.map(col => ({ header: col, key: col }));

        // Styling
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).height = 25;

        deals.recordset.forEach((deal, idx) => {
            const row = worksheet.addRow(deal);
            if (idx % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2F2F2' },
                };
            }
        });

        columns.forEach((col, idx) => {
            worksheet.getColumn(idx + 1).width = 18;
        });

        // Freeze first row
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="hubspot-deals-${new Date().toISOString().split('T')[0]}.xlsx"`,
            },
        });
    } catch (error) {
        console.error('Excel export error:', error);
        return NextResponse.json(
            { error: 'Failed to generate Excel file' },
            { status: 500 }
        );
    }
}
