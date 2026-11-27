import React, { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { BarraSubpantalla } from '../components/BarraSubpantalla';
import { SelectorPeriodo } from '../components/SelectorPeriodo';
import { SelectorSegmentado } from '../components/SelectorSegmentado';
import { FilaMovimiento } from '../components/FilaMovimiento';
import { Boton } from '../components/Boton';
import { contarMovimientos, listarMovimientosGlobales, type MovimientoDetallado } from '../db/inventario';
import { usePeriodo } from '../periodo';
import { useTema } from '../theme';

const TAMANO = 50;
type Tipo = 'TODOS' | 'IN' | 'OUT';

export function PantallaHistorial({ codigo, onVolver, onAbrirCodigo }: { codigo?: string; onVolver: () => void; onAbrirCodigo: (codigo: string) => void }) {
  const db = useSQLiteContext();
  const { periodo } = usePeriodo();
  const { paleta } = useTema();
  const [tipo, setTipo] = useState<Tipo>('TODOS');
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filas, setFilas] = useState<MovimientoDetallado[]>([]);
  const [total, setTotal] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const generacion = useRef(0);
  const enVuelo = useRef(false);
  useEffect(() => { const t = setTimeout(() => setBusqueda(texto), 250); return () => clearTimeout(t); }, [texto]);
  useEffect(() => {
    const n = ++generacion.current;
    setCargando(true); enVuelo.current = true; setError(null); setFilas([]); setTotal(0); setHayMas(false);
    Promise.all([listarMovimientosGlobales(db, { periodo, tipo, codigo, busqueda, limite: TAMANO + 1 }), contarMovimientos(db, { periodo, tipo, codigo, busqueda })])
      .then(([datos, cantidad]) => { if (n === generacion.current) { setFilas(datos.slice(0, TAMANO)); setHayMas(datos.length > TAMANO); setTotal(cantidad); } })
      .catch((e) => { if (n === generacion.current) setError(e instanceof Error ? e.message : 'No se pudo leer el historial.'); })
      .finally(() => { if (n === generacion.current) { setCargando(false); enVuelo.current = false; } });
    return () => { generacion.current++; };
  }, [db, periodo, tipo, codigo, busqueda, intento]);

  const cargarMas = async () => {
    const ultimo = filas.at(-1);
    if (enVuelo.current || !hayMas || !ultimo) return;
    const n = generacion.current;
    enVuelo.current = true; setCargando(true); setError(null);
    try {
      const datos = await listarMovimientosGlobales(db, { periodo, tipo, codigo, busqueda, antesDe: { fecha: ultimo.fecha, id: ultimo.id }, limite: TAMANO + 1 });
      if (n === generacion.current) { setFilas((prev) => [...prev, ...datos.slice(0, TAMANO)]); setHayMas(datos.length > TAMANO); }
    } catch (e) { if (n === generacion.current) setError(e instanceof Error ? e.message : 'No se pudieron cargar más movimientos.'); }
    finally { if (n === generacion.current) { enVuelo.current = false; setCargando(false); } }
  };

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <BarraSubpantalla titulo="Historial de movimientos" subtitulo={codigo ? `Producto ${codigo}` : 'Entradas y salidas de la bodega'} onVolver={onVolver} />
      <FlatList data={filas} keyExtractor={(m) => String(m.id)} keyboardShouldPersistTaps="handled" contentContainerStyle={s.lista}
        renderItem={({ item }) => <FilaMovimiento movimiento={item} onPress={onAbrirCodigo} />}
        ListHeaderComponent={<View style={{ gap: 12, marginBottom: 14 }}>
          <SelectorPeriodo />
          <TextInput value={texto} onChangeText={setTexto} placeholder="Buscar producto, código o nota" accessibilityLabel="Buscar movimientos"
            placeholderTextColor={paleta.textoTerciario} style={[s.input, { backgroundColor: paleta.inputFondo, color: paleta.texto }]} />
          <SelectorSegmentado<Tipo> valor={tipo} onChange={setTipo} opciones={[{ valor: 'TODOS', etiqueta: 'Todos' }, { valor: 'IN', etiqueta: 'Entradas' }, { valor: 'OUT', etiqueta: 'Salidas' }]} />
          <Text style={{ color: paleta.textoSecundario }}>{cargando && !filas.length ? 'Consultando…' : `${filas.length} de ${total} movimientos · más recientes primero`}</Text>
        </View>}
        ListEmptyComponent={!cargando && !error ? <Text style={{ color: paleta.textoSecundario }}>No hay movimientos para estas fechas y filtros. Prueba con Todo o modifica la búsqueda.</Text> : undefined}
        ListFooterComponent={<View style={{ gap: 10 }}>
          {error ? <><Text accessibilityRole="alert" style={{ color: paleta.rojo }}>{error}</Text><Boton titulo="Reintentar consulta" estilo="secundario" onPress={() => setIntento((i) => i + 1)} /></> : null}
          {hayMas ? <Boton titulo={cargando ? 'Cargando…' : 'Cargar 50 más'} deshabilitado={cargando} estilo="secundario" onPress={cargarMas} /> : null}
        </View>} />
    </View>
  );
}
const s = StyleSheet.create({ lista: { padding: 16, paddingBottom: 36 }, input: { minHeight: 48, padding: 12, borderRadius: 12, fontSize: 16 } });
