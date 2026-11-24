import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Producto } from '../db/inventario';
import { estadoDeStock, ETIQUETA_ESTADO, formatearCLP } from '../lib/stock';
import { coloresEstado, TOQUE_MINIMO, useTema } from '../theme';

/**
 * Fila de producto memorizada (React.memo) para que FlatList mantenga 60 fps
 * incluso con miles de SKUs. Muestra nombre, GTIN, precio unitario CLP,
 * valorización del lote y estado accesible (color + símbolo + texto).
 */
export const FilaProducto = React.memo(function FilaProducto({
  producto,
  onPress,
}: {
  producto: Producto;
  onPress: (p: Producto) => void;
}) {
  const { paleta } = useTema();
  const estado = estadoDeStock(producto);
  const { texto, icono } = ETIQUETA_ESTADO[estado];
  const tono = coloresEstado(paleta)[estado];
  const valorTotal = producto.stock * (producto.precio ?? 0);

  return (
    <Pressable
      onPress={() => onPress(producto)}
      accessibilityRole="button"
      accessibilityLabel={`${producto.nombre}, ${producto.stock} unidades, ${texto}, precio ${formatearCLP(producto.precio)}`}
      style={({ pressed }) => [
        s.fila,
        {
          backgroundColor: paleta.superficie,
          borderColor: paleta.borde,
        },
        pressed && { opacity: 0.74 },
      ]}
    >
      <View style={[s.indicador, { backgroundColor: tono.fg }]} />

      <View style={s.izq}>
        <Text style={[s.nombre, { color: paleta.texto }]} numberOfLines={2}>
          {producto.nombre}
        </Text>
        <Text style={[s.codigo, { color: paleta.textoTerciario }]}>
          GTIN {producto.codigo} · mín. {producto.minimo}
        </Text>
        <View style={s.filaPrecios}>
          <Text style={[s.precioUnit, { color: paleta.textoSecundario }]}>
            {producto.precio > 0 ? `${formatearCLP(producto.precio)} c/u` : 'Sin precio'}
          </Text>
          {producto.precio > 0 && producto.stock > 0 ? (
            <Text style={[s.valorTotal, { color: paleta.acento }]}>
              Total {formatearCLP(valorTotal)}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={s.der}>
        <Text style={[s.stock, { color: tono.fg }]}>{producto.stock}</Text>
        <View style={[s.chip, { backgroundColor: tono.bg }]}>
          <Text style={[s.chipTexto, { color: tono.fg }]}>
            {icono} {texto}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const s = StyleSheet.create({
  fila: {
    minHeight: TOQUE_MINIMO + 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: 12,
    paddingRight: 14,
    paddingLeft: 0,
    marginBottom: 10,
    overflow: 'hidden',
  },
  indicador: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 12,
  },
  izq: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  der: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 5,
    marginLeft: 10,
  },
  nombre: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  codigo: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  filaPrecios: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  precioUnit: {
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  valorTotal: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  stock: {
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  chip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipTexto: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
