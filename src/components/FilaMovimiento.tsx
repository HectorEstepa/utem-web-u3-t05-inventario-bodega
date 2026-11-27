import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MovimientoDetallado } from '../db/inventario';
import { formatearCLP } from '../lib/stock';
import { useTema } from '../theme';

export function FilaMovimiento({ movimiento: m, onPress }: { movimiento: MovimientoDetallado; onPress: (codigo: string) => void }) {
  const { paleta } = useTema();
  const entrada = m.tipo === 'IN';
  const color = entrada ? paleta.verde : paleta.salida;
  return (
    <Pressable onPress={() => onPress(m.codigo)} accessibilityRole="button" style={[s.fila, { backgroundColor: paleta.superficie, borderColor: paleta.borde }]}>
      <View style={s.encabezado}>
        <Text style={[s.tipo, { color }]}>{entrada ? '↙ Entrada' : '↗ Salida'} · {m.cantidad} u.</Text>
        <Text style={{ color: paleta.texto, fontWeight: '700' }}>{formatearCLP(m.cantidad * m.precio_unitario)}</Text>
      </View>
      <Text style={{ color: paleta.texto, fontWeight: '700', fontSize: 16 }}>{m.nombre_producto}</Text>
      <Text style={{ color: paleta.textoSecundario }}>GTIN {m.codigo} · operación #{m.id}</Text>
      <Text style={{ color: paleta.textoSecundario }}>{new Date(m.fecha).toLocaleString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
      {m.nota ? <Text style={{ color: paleta.texto }}>{m.nota}</Text> : null}
    </Pressable>
  );
}
const s = StyleSheet.create({ fila: { padding: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, gap: 5, marginBottom: 8 }, encabezado: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }, tipo: { fontWeight: '800' } });
