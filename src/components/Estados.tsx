import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Boton } from './Boton';
import { useTema } from '../theme';

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  const { paleta } = useTema();
  return (
    <View style={[s.centro, { backgroundColor: paleta.fondo }]}>
      <ActivityIndicator size="large" color={paleta.acento} />
      <Text style={[s.texto, { color: paleta.textoSecundario }]}>{texto}</Text>
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
  const { paleta } = useTema();
  return (
    <View style={[s.centro, { backgroundColor: paleta.fondo }]}>
      <View style={[s.burbuja, { backgroundColor: paleta.rojoSuave }]}>
        <Text style={[s.simbolo, { color: paleta.rojo }]}>!</Text>
      </View>
      <Text style={[s.titulo, { color: paleta.texto }]}>No pudimos completar la acción</Text>
      <Text style={[s.texto, { color: paleta.textoSecundario }]}>{mensaje}</Text>
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
  accionSecundaria,
}: {
  titulo: string;
  detalle: string;
  accion?: { titulo: string; onPress: () => void };
  accionSecundaria?: { titulo: string; onPress: () => void };
}) {
  const { paleta } = useTema();
  return (
    <View style={[s.centro, { backgroundColor: 'transparent' }]}>
      <View style={[s.burbuja, { backgroundColor: paleta.acentoSuave }]}>
        <Text style={[s.simbolo, { color: paleta.acento }]}>□</Text>
      </View>
      <Text style={[s.titulo, { color: paleta.texto }]}>{titulo}</Text>
      <Text style={[s.texto, { color: paleta.textoSecundario }]}>{detalle}</Text>
      {accion ? <Boton titulo={accion.titulo} onPress={accion.onPress} /> : null}
      {accionSecundaria ? (
        <Boton
          titulo={accionSecundaria.titulo}
          onPress={accionSecundaria.onPress}
          estilo="secundario"
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  burbuja: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  simbolo: {
    fontSize: 26,
    fontWeight: '800',
  },
  titulo: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  texto: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
  },
});
