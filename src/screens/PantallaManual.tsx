import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Boton } from '../components/Boton';
import { procesarLectura } from '../lib/gtin';
import { C } from '../theme';

/**
 * Ruta alternativa cuando no hay permiso de cámara, cuando la etiqueta está
 * dañada o cuando el teléfono no logra leerla. La app tiene que seguir
 * sirviendo aunque el usuario diga que no al permiso.
 */
export function PantallaManual({
  onConfirmar,
  onCancelar,
}: {
  onConfirmar: (codigo: string) => void;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);

  const confirmar = () => {
    const r = procesarLectura(texto);
    if (r.ok) {
      onConfirmar(r.codigo);
      return;
    }
    setError(
      r.motivo === 'formato'
        ? 'Un código de barras tiene 8, 12 o 13 dígitos. Revisa lo que escribiste.'
        : 'Los dígitos están completos pero el código no cuadra con su dígito verificador. Suele ser un número mal copiado.'
    );
  };

  return (
    <View style={s.raiz}>
      <Text style={s.titulo}>Escribe el código</Text>
      <Text style={s.parrafo}>
        Son los números impresos bajo las barras. Se validan antes de buscarlos en la bodega, así
        que un dígito mal copiado se detecta de inmediato.
      </Text>
      <TextInput
        value={texto}
        onChangeText={(t) => {
          setTexto(t.replace(/[^0-9]/g, ''));
          setError(null);
        }}
        keyboardType="number-pad"
        maxLength={13}
        placeholder="7801234567890"
        placeholderTextColor={C.gris}
        style={s.input}
        autoFocus
        accessibilityLabel="Código de barras"
      />
      <Text style={s.contador}>{texto.length} de 13 dígitos</Text>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Boton titulo="Buscar" onPress={confirmar} deshabilitado={texto.length < 8} />
      <Boton titulo="Cancelar" onPress={onCancelar} estilo="secundario" />
    </View>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.fondo, padding: 22, gap: 10, justifyContent: 'center' },
  titulo: { fontSize: 22, fontWeight: '900', color: C.navy },
  parrafo: { fontSize: 15, color: C.gris, lineHeight: 22, marginBottom: 8 },
  input: {
    backgroundColor: C.blanco,
    borderWidth: 2,
    borderColor: C.azul,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 2,
    color: C.navy,
    textAlign: 'center',
  },
  contador: { textAlign: 'center', color: C.gris, fontSize: 13, marginBottom: 4 },
  error: { color: C.rojo, fontWeight: '700', fontSize: 15, lineHeight: 21 },
});
