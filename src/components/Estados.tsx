import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Boton } from './Boton';
import { C } from '../theme';

/**
 * Los cuatro estados de una operación asíncrona: cargando, error, vacío y
 * con datos. Diseñar solo el caso exitoso deja pantallas en blanco cuando
 * algo falla, que es justo cuando el usuario más necesita saber qué pasó.
 */

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <View style={s.centro}>
      <ActivityIndicator size="large" color={C.azul} />
      <Text style={s.texto}>{texto}</Text>
    </View>
  );
}

export function ErrorEstado({
  mensaje,
  onReintentar,
}: {
  mensaje: string;
  onReintentar?: () => void;
}) {
  return (
    <View style={s.centro}>
      <Text style={s.icono}>⚠</Text>
      <Text style={[s.titulo, { color: C.rojo }]}>Algo salió mal</Text>
      <Text style={s.texto}>{mensaje}</Text>
      {onReintentar ? (
        <Boton titulo="Reintentar" onPress={onReintentar} estilo="secundario" />
      ) : null}
    </View>
  );
}

export function Vacio({
  titulo,
  detalle,
  accion,
}: {
  titulo: string;
  detalle: string;
  accion?: { titulo: string; onPress: () => void };
}) {
  return (
    <View style={s.centro}>
      <Text style={s.icono}>📦</Text>
      <Text style={s.titulo}>{titulo}</Text>
      <Text style={s.texto}>{detalle}</Text>
      {accion ? <Boton titulo={accion.titulo} onPress={accion.onPress} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  icono: { fontSize: 44 },
  titulo: { fontSize: 18, fontWeight: '800', color: C.navy, textAlign: 'center' },
  texto: { fontSize: 15, color: C.gris, textAlign: 'center', lineHeight: 22 },
});
