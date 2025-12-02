          const settlementDate = (values[settlementDateIndex] || '').trim()
          const settlementAmount = parseFloat((values[settlementAmountIndex] || '0').replace(/[^0-9.-]/g, '')) || 0
          
if (settlementAmount <= 0) return null;

if (settlementAmount === 0 && !settlementDate) return null;
