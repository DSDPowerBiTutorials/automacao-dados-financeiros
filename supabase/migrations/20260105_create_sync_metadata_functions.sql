-- Função auxiliar para incrementar total_records
CREATE OR REPLACE FUNCTION increment_sync_total_records(
  p_source TEXT,
  p_increment INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE sync_metadata
  SET total_records = COALESCE(total_records, 0) + p_increment
  WHERE source = p_source;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
