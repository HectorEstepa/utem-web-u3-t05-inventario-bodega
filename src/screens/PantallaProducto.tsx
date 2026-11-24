import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Boton } from '../components/Boton';
import { Cargando, ErrorEstado, Vacio } from '../components/Estados';
import {
  buscarPorCodigo,
  historial,
  registrarMovimiento,
  type Movimiento,
  type Producto,
} from '../db/inventario';
import { estadoDeStock, ETIQUETA_ESTADO, validarMovimiento } from '../lib/stock';
import { C, ESTADO_COLOR } from '../theme';

export function PantallaProducto({
  codigo,
  onVolver,
}: {
  codigo: string;
  onVolver: () => void;
}) {
  const db = useSQLiteContext();
  const [producto, setProducto] = useState<Producto | null>(null);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [cantidad, setCantidad] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [cargando, setCargando] = useState(true);

  // El estado de React se actualiza en el siguiente render, así que dos
  // toques dentro del mismo frame leerían `ocupado` en false los dos y
  // registrarían el movimiento por duplicado. El ref cambia al instante.
  const enVuelo = useRef(false);

  const refrescar = useCallback(async () => {
    try {
      const p = await buscarPorCodigo(db, codigo);
      setProducto(p);
      if (p) setMovs(await historial(db, codigo, 8));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el producto.');
    } finally {
      setCargando(false);
    }
  }, [db, codigo]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  const mover = useCallback(
    async (tipo: 'IN' | 'OUT') => {
      if (!producto || enVuelo.current) return;
      enVuelo.current = true;
      const n = Number(cantidad);
      // Se valida antes de abrir la transacción: un error de tipeo no debe
      // llegar a tocar la base.
      const problema = validarMovimiento(tipo, n, producto.stock);
      if (problema) {
        setError(problema);
        setAviso(null);
        enVuelo.current = false;
        return;
      }
      setOcupado(true);
      setError(null);
      try {
        const final = await registrarMovimiento(db, codigo, tipo, n);
        setAviso(
          `${tipo === 'IN' ? 'Entrada' : 'Salida'} de ${n} registrada. Stock: ${final}.`
        );
        setCantidad('1');
        await refrescar();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo registrar el movimiento.');
      } finally {
        setOcupado(false);
        enVuelo.current = false;
      }
    },
    [producto, cantidad, codigo, db, refrescar]
  );

  if (cargando) return <Cargando texto="Abriendo la ficha…" />;
  if (error && !producto) return <ErrorEstado mensaje={error} onReintentar={refrescar} />;
  if (!producto)
    return (
      <Vacio
        titulo="Producto no encontrado"
        detalle={`El código ${codigo} ya no está en la bodega. Puede haberse eliminado desde otro lado.`}
        accion={{ titulo: 'Volver a la lista', onPress: onVolver }}
      />
    );

  const estado = estadoDeStock(producto);
  const color = ESTADO_COLOR[estado];
  const { texto, icono } = ETIQUETA_ESTADO[estado];

  return (
    <ScrollView style={s.raiz} contentContainerStyle={s.cont} keyboardShouldPersistTaps="handled">
      <View style={[s.tarjeta, { borderLeftColor: color }]}>
        <Text style={s.nombre}>{producto.nombre}</Text>
        <Text style={s.codigo}>{producto.codigo}</Text>
        <View style={s.filaStock}>
          <Text style={[s.stock, { color }]}>{producto.stock}</Text>
          <View>
            <View style={[s.chip, { backgroundColor: color }]}>
              <Text style={s.chipTexto}>
                {icono} {texto}
              </Text>
            </View>
            <Text style={s.minimo}>mínimo: {producto.minimo}</Text>
          </View>
        </View>
        {/* Render condicional según el estado del stock. */}
        {estado === 'agotado' ? (
          <Text style={[s.alerta, { color: C.rojo }]}>
            Sin unidades en bodega. Registra una entrada antes de despachar.
          </Text>
        ) : estado === 'bajo' ? (
          <Text style={[s.alerta, { color: C.ambar }]}>
            Quedan {producto.stock} unidades, igual o por debajo del mínimo. Conviene reponer.
          </Text>
        ) : null}
      </View>

      <Text style={s.rotulo}>Cantidad</Text>
      <TextInput
        value={cantidad}
        onChangeText={(t) => setCantidad(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        style={s.input}
        accessibilityLabel="Cantidad del movimiento"
      />

      <View style={s.acciones}>
        <Boton
          titulo="Entrada"
          onPress={() => mover('IN')}
          estilo="exito"
          deshabilitado={ocupado}
          ancho="48%"
        />
        <Boton
          titulo="Salida"
          onPress={() => mover('OUT')}
          estilo="peligro"
          deshabilitado={ocupado || producto.stock === 0}
          ancho="48%"
        />
      </View>

      {error ? <Text style={[s.mensaje, { color: C.rojo }]}>{error}</Text> : null}
      {aviso ? <Text style={[s.mensaje, { color: C.verde }]}>{aviso}</Text> : null}

      <Text style={s.rotulo}>Últimos movimientos</Text>
      {movs.length === 0 ? (
        <Text style={s.vacio}>Todavía no hay movimientos registrados.</Text>
      ) : (
        movs.map((m) => (
          <View key={m.id} style={s.mov}>
            <Text style={[s.movTipo, { color: m.tipo === 'IN' ? C.verde : C.rojo }]}>
              {m.tipo === 'IN' ? '+' : '−'}
              {m.cantidad}
            </Text>
            <Text style={s.movFecha}>
              {new Date(m.fecha).toLocaleString('es-CL', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        ))
      )}

      <Boton titulo="Volver a la lista" onPress={onVolver} estilo="secundario" />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.fondo },
  cont: { padding: 16, paddingBottom: 40, gap: 10 },
  tarjeta: {
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.linea,
    borderLeftWidth: 6,
    borderRadius: 14,
    padding: 16,
  },
  nombre: { fontSize: 21, fontWeight: '900', color: C.navy },
  codigo: { fontSize: 13, color: C.gris, marginTop: 2 },
  filaStock: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  stock: { fontSize: 46, fontWeight: '900', fontVariant: ['tabular-nums'] },
  chip: { borderRadius: 9, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  chipTexto: { color: C.blanco, fontSize: 12, fontWeight: '800' },
  minimo: { fontSize: 12, color: C.gris, marginTop: 4 },
  alerta: { marginTop: 12, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  rotulo: {
    fontSize: 12,
    fontWeight: '800',
    color: C.azul,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
  },
  input: {
    backgroundColor: C.blanco,
    borderWidth: 1.5,
    borderColor: C.linea,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
    color: C.navy,
  },
  acciones: { flexDirection: 'row', justifyContent: 'space-between' },
  mensaje: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  vacio: { color: C.gris, fontSize: 14 },
  mov: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.linea,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  movTipo: { fontWeight: '900', fontSize: 16 },
  movFecha: { color: C.gris, fontSize: 13 },
});
