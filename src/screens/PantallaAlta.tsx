import React, { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { BarraSubpantalla } from '../components/BarraSubpantalla';
import { Boton } from '../components/Boton';
import { crearProducto } from '../db/inventario';
import { formatearCLP, validarPrecio } from '../lib/stock';
import { useTema } from '../theme';

/**
 * Alta de producto nuevo con precio unitario CLP, stock inicial y umbral
 * mínimo de alerta. Se abre automáticamente al escanear un GTIN válido que
 * aún no figura en SQLite.
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
  const { paleta } = useTema();
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('1');
  const [minimo, setMinimo] = useState('5');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const precioNum = Number(precio || '0');
  const stockNum = Number(stock || '0');
  const valorInicial =
    Number.isInteger(precioNum) && Number.isInteger(stockNum) ? precioNum * stockNum : 0;

  const guardar = async () => {
    if (ocupado) return;
    Keyboard.dismiss();

    if (!nombre.trim()) {
      setError('Escribe el nombre descriptivo del producto.');
      return;
    }
    const min = Number(minimo);
    if (!minimo.trim() || !Number.isInteger(min) || min < 1 || min > 99999) {
      setError('El stock mínimo debe ser al menos 1 para activar la alerta.');
      return;
    }
    const ini = Number(stock || '0');
    if (!Number.isInteger(ini) || ini < 0 || ini > 99999) {
      setError('El stock inicial debe estar entre 0 y 99.999 unidades.');
      return;
    }
    const pr = Number(precio || '0');
    const errPrecio = validarPrecio(pr);
    if (errPrecio) {
      setError(errPrecio);
      return;
    }

    setOcupado(true);
    setError(null);
    try {
      await crearProducto(db, {
        codigo,
        nombre,
        stockInicial: ini,
        minimo: min,
        precio: pr,
      });
      onCreado(codigo);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar.';
      setError(
        msg.includes('UNIQUE')
          ? 'Ese código ya está registrado en la bodega.'
          : msg
      );
    } finally {
      setOcupado(false);
    }
  };

  return (
    <View style={[s.raiz, { backgroundColor: paleta.fondo }]}>
      <BarraSubpantalla
        titulo="Nuevo producto"
        subtitulo={`GTIN ${codigo}`}
        onVolver={onCancelar}
        mostrarCerrarTeclado
      />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.cont}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Pressable onPress={() => Keyboard.dismiss()} style={s.bloque}>
            <View
              style={[
                s.banner,
                { backgroundColor: paleta.ambarSuave, borderColor: paleta.ambar },
              ]}
            >
              <Text style={[s.bannerTitulo, { color: paleta.ambar }]}>
                Código nuevo detectado
              </Text>
              <Text style={[s.bannerTexto, { color: paleta.texto }]}>
                El código <Text style={s.mono}>{codigo}</Text> aún no está registrado. Completa su
                ficha para incorporarlo al inventario.
              </Text>
            </View>

            <View
              style={[
                s.grupo,
                { backgroundColor: paleta.superficie, borderColor: paleta.borde },
              ]}
            >
              <Text style={[s.rotulo, { color: paleta.textoSecundario }]}>
                NOMBRE DEL ARTÍCULO
              </Text>
              <TextInput
                value={nombre}
                onChangeText={setNombre}
                placeholder="Ej: Aceite Maravilla 1 L"
                placeholderTextColor={paleta.textoTerciario}
                returnKeyType="done"
                maxLength={80}
                style={[
                  s.input,
                  { backgroundColor: paleta.inputFondo, color: paleta.texto },
                ]}
                accessibilityLabel="Nombre del producto"
              />

              <Text style={[s.rotulo, { color: paleta.textoSecundario }]}>
                PRECIO UNITARIO (CLP $)
              </Text>
              <TextInput
                value={precio}
                onChangeText={(t) => setPrecio(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="Ej: 2490"
                placeholderTextColor={paleta.textoTerciario}
                maxLength={8}
                style={[
                  s.input,
                  { backgroundColor: paleta.inputFondo, color: paleta.texto },
                ]}
                accessibilityLabel="Precio unitario en pesos chilenos"
              />

              <View style={s.filaDos}>
                <View style={s.mitad}>
                  <Text style={[s.rotulo, { color: paleta.textoSecundario }]}>
                    STOCK INICIAL
                  </Text>
                  <TextInput
                    value={stock}
                    onChangeText={(t) => setStock(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={5}
                    style={[
                      s.input,
                      { backgroundColor: paleta.inputFondo, color: paleta.texto },
                    ]}
                    accessibilityLabel="Stock inicial"
                  />
                </View>

                <View style={s.mitad}>
                  <Text style={[s.rotulo, { color: paleta.textoSecundario }]}>
                    UMBRAL MÍNIMO
                  </Text>
                  <TextInput
                    value={minimo}
                    onChangeText={(t) => setMinimo(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={5}
                    style={[
                      s.input,
                      { backgroundColor: paleta.inputFondo, color: paleta.texto },
                    ]}
                    accessibilityLabel="Stock mínimo de alerta"
                  />
                </View>
              </View>

              <View
                style={[
                  s.resumenValor,
                  { backgroundColor: paleta.acentoSuave },
                ]}
              >
                <Text style={[s.resumenEtiqueta, { color: paleta.textoSecundario }]}>
                  Valorización inicial en bodega
                </Text>
                <Text style={[s.resumenMonto, { color: paleta.acento }]}>
                  {formatearCLP(valorInicial)}
                </Text>
              </View>
            </View>

            {error ? (
              <View style={[s.cajaError, { backgroundColor: paleta.rojoSuave }]}>
                <Text style={[s.errorTexto, { color: paleta.rojo }]}>{error}</Text>
              </View>
            ) : null}

            <Boton
              titulo={ocupado ? 'Guardando en SQLite…' : 'Registrar producto'}
              onPress={guardar}
              deshabilitado={ocupado}
            />
            <Boton titulo="Cancelar" onPress={onCancelar} estilo="secundario" />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1 },
  flex: { flex: 1 },
  cont: { padding: 16, paddingBottom: 42 },
  bloque: { gap: 14 },
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  bannerTitulo: { fontSize: 15, fontWeight: '800' },
  bannerTexto: { fontSize: 14, lineHeight: 20 },
  mono: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  grupo: {
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  rotulo: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  filaDos: { flexDirection: 'row', gap: 10 },
  mitad: { flex: 1 },
  resumenValor: {
    marginTop: 6,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resumenEtiqueta: { fontSize: 13, fontWeight: '600' },
  resumenMonto: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cajaError: { borderRadius: 12, padding: 12 },
  errorTexto: { fontSize: 14, fontWeight: '700' },
});
