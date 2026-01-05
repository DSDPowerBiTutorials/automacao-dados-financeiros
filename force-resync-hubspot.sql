-- Deletar TODOS os dados antigos do HubSpot
DELETE FROM csv_rows WHERE source = 'hubspot';

-- Verificar que foi deletado
SELECT COUNT(*) as total_hubspot_rows FROM csv_rows WHERE source = 'hubspot';
