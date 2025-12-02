// Remova completamente as duas linhas abaixo (causam erro):
// const settlementDate = (values[settlementDateIndex] || '').trim()
// const settlementAmount = parseFloat((values[settlementAmountIndex] || '0').replace(/[^0-9.-]/g, '')) || 0

// E mantenha apenas este bloco funcional:
data.map((values: string[], index: number) => {
  const settlementDate = (values[settlementDateIndex] || '').trim();
  const settlementAmount =
    parseFloat((values[settlementAmountIndex] || '0').replace(/[^0-9.-]/g, '')) || 0;

  // Validações de consistência
  if (settlementAmount <= 0) return null;
  if (settlementAmount === 0 && !settlementDate) return null;

  // Renderização do item válido
  return (
    <div key={`${settlementDate}-${index}`} className="transaction-item">
      <p>Data de liquidação: {settlementDate}</p>
      <p>Valor: {settlementAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
    </div>
  );
});
