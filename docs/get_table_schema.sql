create or replace function get_table_schema(table_name_input text)
returns table (
  column_name text,
  data_type text,
  is_nullable text,
  column_default text
)
language sql as $$
  select
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
  from information_schema.columns c
  where c.table_name = table_name_input
  order by c.ordinal_position;
$$;
