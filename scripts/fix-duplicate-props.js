const fs = require('fs');
const path = require('path');

const files = [
  'src/app/reports/bankinter/page.tsx',
  'src/app/reports/bankinter-eur/page.tsx',
  'src/app/reports/bankinter-usd/page.tsx',
  'src/app/reports/braintree/page.tsx',
  'src/app/reports/braintree-amex/page.tsx',
  'src/app/reports/braintree-eur/page.tsx',
  'src/app/reports/braintree-usd/page.tsx',
  'src/app/reports/braintree-transactions/page.tsx',
  'src/app/reports/gocardless/page.tsx',
  'src/app/reports/paypal/page.tsx',
  'src/app/reports/sabadell/page.tsx',
  'src/app/reports/stripe/page.tsx'
];

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    
    // Fix duplicate props in Button components
    // Pattern: size="sm" variant="outline" size="sm" className="..." variant="outline" size="sm" className="..."
    content = content.replace(
      /(<Button[^>]*)\s+size="sm"\s+variant="outline"\s+size="sm"\s+className="([^"]*)"\s+variant="outline"\s+size="sm"\s+className="([^"]*)"/g,
      '$1 variant="outline" size="sm" className="$2"'
    );
    
    // Fix pattern: variant="outline" size="sm" className="..." size="sm" variant="outline" size="sm" className="..."
    content = content.replace(
      /(<Button[^>]*)\s+variant="outline"\s+size="sm"\s+className="([^"]*)"\s+size="sm"\s+variant="outline"\s+size="sm"\s+className="([^"]*)"/g,
      '$1 variant="outline" size="sm" className="$2"'
    );
    
    // Fix simpler pattern: size="sm" variant="outline" size="sm"
    content = content.replace(
      /(<Button[^>]*)\s+size="sm"\s+variant="outline"\s+size="sm"/g,
      '$1 variant="outline" size="sm"'
    );
    
    // Fix pattern: className="..." size="sm" variant="outline" className="..."
    content = content.replace(
      /(<Button[^>]*)\s+className="([^"]*)"\s+size="sm"\s+variant="outline"\s+className="([^"]*)"/g,
      '$1 variant="outline" size="sm" className="$2"'
    );
    
    // Fix pattern with multiple duplicates
    content = content.replace(
      /(<Button[^>]*)\s+(variant|size|className)="([^"]*)"\s+\2="[^"]*"/g,
      '$1 $2="$3"'
    );
    
    fs.writeFileSync(file, content);
    console.log(`✅ Fixed ${file}`);
  } catch (err) {
    console.log(`⚠️  ${file}: ${err.message}`);
  }
});

console.log('\nDone!');
