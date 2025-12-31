#!/usr/bin/env node

/**
 * Script para atualizar todas as páginas Braintree com os mesmos filtros e ordenação do braintree-eur
 */

const fs = require('fs');
const path = require('path');

// Ler o template braintree-eur
const templatePath = path.join(__dirname, '../src/app/reports/braintree-eur/page.tsx');
const template = fs.readFileSync(templatePath, 'utf8');

// Páginas para atualizar
const pages = [
    { currency: 'USD', merchantId: 'digitalsmiledesignUSD', file: 'braintree-usd' },
    { currency: 'GBP', merchantId: 'digitalsmiledesignGBP', file: 'braintree-gbp' },
    { currency: 'AUD', merchantId: 'digitalsmiledesignAUD', file: 'braintree-aud' },
];

pages.forEach(({ currency, merchantId, file }) => {
    console.log(`Updating ${file}...`);

    let content = template;

    // Substituir todas as referências EUR por currency específica
    content = content.replace(/BraintreeEURRow/g, `Braintree${currency}Row`);
    content = content.replace(/BraintreeEURPage/g, `Braintree${currency}Page`);
    content = content.replace(/Braintree EUR/g, `Braintree ${currency}`);
    content = content.replace(/braintree-eur/g, file);
    content = content.replace(/digitalsmiledesignEUR/g, merchantId);
    content = content.replace(/\[Braintree EUR\]/g, `[Braintree ${currency}]`);

    // Substituir símbolo de moeda nos filtros
    const currencySymbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'AUD' ? 'A$' : '€';
    content = content.replace(/Amount \{">"} €/g, `Amount {">"} ${currencySymbol}`);
    content = content.replace(/Amount \{"<"\} €/g, `Amount {"<"} ${currencySymbol}`);

    // Garantir que o filtro de merchant account default seja o correto
    content = content.replace(
        /return !merchantAccount \|\| merchantAccount === "digitalsmiledesign[A-Z]+" \|\| row\.source === "braintree-[a-z]+";/,
        `return !merchantAccount || merchantAccount === "${merchantId}" || row.source === "${file}";`
    );

    // Salvar o arquivo
    const targetPath = path.join(__dirname, `../src/app/reports/${file}/page.tsx`);
    fs.writeFileSync(targetPath, content, 'utf8');
    console.log(`✓ ${file} updated successfully!`);
});

console.log('\n✅ All Braintree pages updated successfully!');
