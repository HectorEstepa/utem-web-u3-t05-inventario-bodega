import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTema } from '../theme';

export function SelectorSegmentado<T extends string>({
  opciones,
  valor,
  onChange,
}: {
  opciones: ReadonlyArray<{ valor: T; etiqueta: string }>;
  valor: T;
  onChange: (v: T) => void;
}) {
  const { paleta } = useTema();

  return (
    <View style={[s.contenedor, { backgroundColor: paleta.inputFondo }]}>
      {opciones.map((op) => {
        const activo = op.valor === valor;
        return (
          <Pressable
            key={op.valor}
            onPress={() => onChange(op.valor)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
            style={[
              s.item,
              activo && [
                s.itemActivo,
                {
                  backgroundColor: paleta.superficie,
                  borderColor: paleta.borde,
                },
              ],
            ]}
          >
            <Text
              style={[
                s.texto,
                { color: activo ? paleta.texto : paleta.textoSecundario },
                activo && s.textoActivo,
              ]}
            >
              {op.etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  contenedor: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 11,
    padding: 3,
    gap: 3,
  },
  item: {
    flex: 1,
    minWidth: 65,
    minHeight: 44,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  itemActivo: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  texto: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  textoActivo: {
    fontWeight: '700',
  },
});
