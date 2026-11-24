import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { C, TOQUE_MINIMO } from '../theme';

type Estilo = 'primario' | 'secundario' | 'peligro' | 'exito';

const FONDO: Record<Estilo, string> = {
  primario: C.azul,
  secundario: C.blanco,
  peligro: C.rojo,
  exito: C.verde,
};

export function Boton({
  titulo,
  onPress,
  estilo = 'primario',
  deshabilitado = false,
  ancho,
}: {
  titulo: string;
  onPress: () => void;
  estilo?: Estilo;
  deshabilitado?: boolean;
  ancho?: ViewStyle['width'];
}) {
  const secundario = estilo === 'secundario';
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      // accessibilityRole y accessibilityState hacen que TalkBack lea el
      // botón como botón y anuncie si está deshabilitado.
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitado }}
      style={({ pressed }) => [
        s.base,
        { backgroundColor: FONDO[estilo], width: ancho },
        secundario && { borderWidth: 2, borderColor: C.azul },
        deshabilitado && { opacity: 0.45 },
        pressed && !deshabilitado && { opacity: 0.8 },
      ]}
    >
      <Text style={[s.texto, secundario && { color: C.azul }]}>{titulo}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: {
    minHeight: TOQUE_MINIMO,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sin altura fija: si el usuario tiene el tamaño de letra del sistema
  // aumentado, el texto crece y el botón crece con él en vez de cortarse.
  texto: { color: C.blanco, fontSize: 16, fontWeight: '800', textAlign: 'center' },
});
