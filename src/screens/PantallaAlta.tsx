import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Boton } from '../components/Boton';
import { crearProducto } from '../db/inventario';
import { C } from '../theme';

/**
 * Alta de producto: la ruta que se ofrece cuando el código escaneado
 * no existe en la base. El código llega ya cargado y no se puede editar,
 * porque es el que acaba de leer la cámara.
 */
export function PantallaAlta({
  codigo,
  onCreado,
  onCancelar,
}: {
  codigo: string;
  onCreado: (codigo: string) => void;
  onCancelar: () => void;
}) {
  const db = useSQLiteContext();
  const [nombre, setNombre] = useState('');
  const [stock, setStock] = useState('0');
  const [minimo, setMinimo] = useState('5');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const guardar = async () => {
    if (ocupado) return;
    if (!nombre.trim()) {
      setError('Escribe el nombre del producto.');
      return;
    }
    // Un mínimo en cero deja al producto fuera de la alerta para siempre:
    // estadoDeStock solo podría devolver agotado o en stock, nunca bajo.
    // Y como no hay pantalla de edición, el error sería permanente.
    const min = Number(minimo);
    if (!minimo.trim() || !Number.isInteger(min) || min < 1) {
      setError('El mínimo debe ser al menos 1, porque es el umbral de la alerta.');
      return;
    }
    const ini = Number(stock);
    if (!Number.isInteger(ini) || ini < 0 || ini > 99999) {
      setError('El stock inicial debe estar entre 0 y 99.999.');
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      await crearProducto(db, { codigo, nombre, stockInicial: ini, minimo: min });
      onCreado(codigo);
    } catch (e) {
      // El caso más probable es que el producto ya exista (PRIMARY KEY).
      const msg = e instanceof Error ? e.message : 'No se pudo guardar.';
      setError(
        msg.includes('UNIQUE')
          ? 'Ese código ya está registrado. Vuelve a la lista y búscalo.'
          : msg
      );
    } finally {
      setOcupado(false);
    }
  };

  return (
    <ScrollView style={s.raiz} contentContainerStyle={s.cont} keyboardShouldPersistTaps="handled">
      <View style={s.aviso}>
        <Text style={s.avisoTitulo}>Este código no está en la bodega</Text>
        <Text style={s.avisoTexto}>
          Se leyó <Text style={s.mono}>{codigo}</Text> y no corresponde a ningún producto
          registrado. Complétalo para darlo de alta.
        </Text>
      </View>

      <Text style={s.rotulo}>Código</Text>
      <TextInput value={codigo} editable={false} style={[s.input, s.inputBloqueado]} />

      <Text style={s.rotulo}>Nombre del producto</Text>
      <TextInput
        value={nombre}
        onChangeText={setNombre}
        placeholder="Ej: Bebida cola 1,5 L"
        placeholderTextColor={C.gris}
        style={s.input}
        autoFocus
        maxLength={80}
        accessibilityLabel="Nombre del producto"
      />

      <View style={s.fila}>
        <View style={s.mitad}>
          <Text style={s.rotulo}>Stock inicial</Text>
          <TextInput
            value={stock}
            onChangeText={(t) => setStock(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={5}
            style={s.input}
            accessibilityLabel="Stock inicial"
          />
        </View>
        <View style={s.mitad}>
          <Text style={s.rotulo}>Mínimo</Text>
          <TextInput
            value={minimo}
            onChangeText={(t) => setMinimo(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={5}
            style={s.input}
            accessibilityLabel="Stock mínimo para la alerta"
          />
        </View>
      </View>
      <Text style={s.ayuda}>
        Cuando el stock llegue al mínimo o baje de él, el producto aparece marcado en la lista.
      </Text>

      {error ? <Text style={s.error}>{error}</Text> : null}
      {ocupado ? <Text style={s.guardando}>Guardando el producto…</Text> : null}

      <Boton
        titulo={ocupado ? 'Guardando…' : 'Guardar producto'}
        onPress={guardar}
        deshabilitado={ocupado}
      />
      <Boton titulo="Cancelar" onPress={onCancelar} estilo="secundario" />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.fondo },
  cont: { padding: 16, paddingBottom: 40, gap: 8 },
  aviso: {
    backgroundColor: '#fff7ed',
    borderLeftWidth: 5,
    borderLeftColor: C.ambar,
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
  },
  avisoTitulo: { fontWeight: '800', color: '#b45309', fontSize: 16, marginBottom: 4 },
  avisoTexto: { color: C.navy, fontSize: 14, lineHeight: 20 },
  mono: { fontWeight: '800' },
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
    fontSize: 17,
    color: C.navy,
  },
  inputBloqueado: { backgroundColor: '#eaf4fd', color: C.gris },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  mitad: { flex: 1 },
  ayuda: { color: C.gris, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 6 },
  error: { color: C.rojo, fontWeight: '700', fontSize: 15, marginVertical: 4 },
  guardando: { color: C.azul, fontWeight: '700', fontSize: 15, marginVertical: 4 },
});
