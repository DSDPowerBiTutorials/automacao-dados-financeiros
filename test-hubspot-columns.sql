-- TESTE: Query para descobrir nomes exatos das colunas
-- Execute isto no SQL Server para ver quais campos existem

SELECT TOP 5
  DealId,
  dealname,
  hs_object_id,
  amount,
  closedate,
  dealstage,
  paid_status
FROM Deal
ORDER BY closedate DESC;
