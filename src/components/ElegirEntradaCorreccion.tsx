import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { listarMovimientosGlobales, type Movimiento } from '../db/inventario';
import { useTema } from '../theme';
import { Boton } from './Boton';

export function ElegirEntradaCorreccion({ codigo, seleccion, diferencia, onElegir }: {
  codigo: string; seleccion: Movimiento | null; diferencia: number; onElegir: (m: Movimiento) => void;
}) {
  const db = useSQLiteContext(); const { paleta: c } = useTema();
  const [entradas, setEntradas] = useState<Movimiento[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [hayMas, setHayMas] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [reintento, setReintento] = useState(0);
  const generacion = useRef(0); const cargando = useRef(false);
  useEffect(() => {
    const n = ++generacion.current; cargando.current = true; setOcupado(true); setError(''); setEntradas([]);
    listarMovimientosGlobales(db, { tipo: 'IN', codigo, limite: 51 })
      .then((filas) => { if (n === generacion.current) { setEntradas(filas.slice(0, 50)); setHayMas(filas.length > 50); } })
      .catch((e) => { if (n === generacion.current) setError(e instanceof Error ? e.message : 'No se pudieron consultar las entradas.'); })
      .finally(() => { if (n === generacion.current) { cargando.current = false; setOcupado(false); } });
    return () => { generacion.current++; };
  }, [db, codigo, reintento]);
  const mas = async () => {
    const ultimo = entradas.at(-1); if (!ultimo || cargando.current) return;
    cargando.current = true; setOcupado(true); setError(''); const n = generacion.current;
    try {
      const filas = await listarMovimientosGlobales(db, { tipo: 'IN', codigo, limite: 51, antesDe: { fecha: ultimo.fecha, id: ultimo.id } });
      if (n === generacion.current) { setEntradas((prev) => [...prev, ...filas.slice(0, 50)]); setHayMas(filas.length > 50); }
    } catch (e) { if (n === generacion.current) setError(e instanceof Error ? e.message : 'No se pudo continuar.'); }
    finally { if (n === generacion.current) { cargando.current = false; setOcupado(false); } }
  };
  return <View style={{ gap: 10 }}>
    <Text style={{ color: c.textoSecundario }}>Selecciona la recepción que anotaste mal. Se rectifica su cantidad en la fecha original y se conserva una constancia de la corrección de hoy.</Text>
    <Boton estilo="secundario" titulo={seleccion ? `Cambiar entrada #${seleccion.id}` : 'Elegir la entrada que quiero corregir'} onPress={() => setAbierto(!abierto)} />
    {abierto ? <ScrollView nestedScrollEnabled style={{ maxHeight: 240 }}>
      {entradas.map((m) => <Pressable key={m.id} accessibilityRole="button" accessibilityState={{ selected: seleccion?.id === m.id }}
        onPress={() => { onElegir(m); setAbierto(false); }} style={{ minHeight: 48, padding: 12, gap: 4, borderBottomWidth: 1, borderColor: c.borde }}>
        <Text style={{ color: c.texto, fontWeight: '700' }}>Entrada #{m.id} · {m.cantidad} u.</Text>
        <Text style={{ color: c.textoSecundario }}>{new Date(m.fecha).toLocaleString('es-CL')} · {m.nota || 'Sin nota'}</Text>
      </Pressable>)}
      {!ocupado && !entradas.length && !error ? <Text style={{ color: c.textoSecundario }}>Este producto no tiene entradas registradas. Para una diferencia física usa Ajuste de conteo.</Text> : null}
      {ocupado ? <Text style={{ color: c.textoSecundario }}>Consultando entradas…</Text> : null}
      {hayMas ? <Boton titulo="Cargar más entradas" estilo="secundario" deshabilitado={ocupado} onPress={mas} /> : null}
    </ScrollView> : null}
    {error ? <><Text accessibilityRole="alert" style={{ color: c.rojo }}>{error}</Text><Boton titulo="Reintentar entradas" estilo="secundario" onPress={() => setReintento((v) => v + 1)} /></> : null}
    {seleccion ? <View style={{ padding: 12, gap: 4, borderRadius: 12, backgroundColor: c.acentoSuave }}>
      <Text style={{ color: c.texto }}>Entrada #{seleccion.id} · {new Date(seleccion.fecha).toLocaleDateString('es-CL')}</Text>
      <Text style={{ color: seleccion.cantidad + diferencia < 0 ? c.rojo : c.acento, fontWeight: '800' }}>Entrada: {seleccion.cantidad} → {seleccion.cantidad + diferencia} u.</Text>
      <Text style={{ color: c.texto }}>Cambia el total de entradas y el stock. Las salidas permanecen iguales.</Text>
    </View> : null}
  </View>;
}
