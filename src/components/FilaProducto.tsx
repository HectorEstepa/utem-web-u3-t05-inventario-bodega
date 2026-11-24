import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Producto } from '../db/inventario';
import { estadoDeStock, ETIQUETA_ESTADO } from '../lib/stock';
import { C, ESTADO_COLOR, TOQUE_MINIMO } from '../theme';

/**
 * React.memo evita volver a dibujar las filas que no cambiaron cuando se
 * actualiza el stock de una sola. Con 5.000 productos en una FlatList, esa
 * diferencia se ve directamente en los cuadros perdidos al desplazar.
 */
export const FilaProducto = React.memo(function FilaProducto({
  producto,
  onPress,
}: {
  producto: Producto;
  onPress: (p: Producto) => void;
}) {
  const estado = estadoDeStock(producto);
  const { texto, icono } = ETIQUETA_ESTADO[estado];
  const color = ESTADO_COLOR[estado];

  return (
    <Pressable
      onPress={() => onPress(producto)}
      accessibilityRole="button"
      accessibilityLabel={`${producto.nombre}, ${producto.stock} unidades, ${texto}`}
      style={({ pressed }) => [s.fila, { borderLeftColor: color }, pressed && s.presionada]}
    >
      <View style={s.izq}>
        <Text style={s.nombre} numberOfLines={2}>
          {producto.nombre}
        </Text>
        <Text style={s.codigo}>{producto.codigo}</Text>
      </View>
      <View style={s.der}>
        <Text style={[s.stock, { color }]}>{producto.stock}</Text>
        {/* El estado se comunica con color, texto e ícono a la vez. */}
        <View style={[s.chip, { backgroundColor: color }]}>
          <Text style={s.chipTexto}>
            {icono} {texto}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const s = StyleSheet.create({
  fila: {
    minHeight: TOQUE_MINIMO + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.linea,
    borderLeftWidth: 5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  presionada: { opacity: 0.7 },
  izq: { flex: 1, minWidth: 0 },
  der: { alignItems: 'flex-end', gap: 4 },
  nombre: { fontSize: 16, fontWeight: '700', color: C.navy },
  codigo: { fontSize: 12, color: C.gris, marginTop: 2, fontVariant: ['tabular-nums'] },
  stock: { fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  chip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipTexto: { color: C.blanco, fontSize: 10, fontWeight: '800' },
});
