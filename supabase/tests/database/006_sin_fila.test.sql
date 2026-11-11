-- La fila virtual ya no existe: ni la tabla, ni sus funciones, ni la referencia desde cobros.
begin;
select plan(6);

select hasnt_table('public', 'fila', 'la tabla fila no existe');
select hasnt_type('public', 'estado_fila', 'el tipo estado_fila no existe');
select hasnt_column('public', 'cobros', 'fila_id', 'cobros ya no referencia a la fila');
select hasnt_function('public', 'anotar_fila', 'anotar_fila no existe');
select hasnt_function('public', 'llamar_siguiente', 'llamar_siguiente no existe');
-- Lo que sigue funcionando para el público
select has_function('public', 'ocupados', array['date', 'date'], 'ocupados() sigue existiendo');

select * from finish();
rollback;
