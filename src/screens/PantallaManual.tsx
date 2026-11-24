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
import { BarraSubpantalla } from '../components/BarraSubpantalla';
import { Boton } from '../components/Boton';
import { procesarLectura } from '../lib/gtin';
import { useTema } from '../theme';

const CODIGOS_EJEMPLO = [
  { etiqueta: 'EAN-13 GS1', codigo: '4006381333931' },
  { etiqueta: 'Café 250g', codigo: '5012345670003' },
  { etiqueta: 'EAN-8', codigo: '96385074' },
] as const;

/**
 * Ingreso manual del código GTIN.
 *
 * Corrección crítica de UX en iOS: el teclado numérico nativo ('number-pad')
 * no incluye tecla "Intro/Cerrar". Se envuelve en KeyboardAvoidingView +
 * ScrollView con keyboardShouldPersistTaps="handled", cierre al tocar fuera y
 * barra superior fija con botón "‹ Volver" y "Listo" siempre accesibles.
 */
export function PantallaManual({
  onConfirmar,
  onCancelar,
}: {
  onConfirmar: (codigo: string) => void;
  onCancelar: () => void;
}) {
  const { paleta } = useTema();
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);

  const confirmar = () => {
    Keyboard.dismiss();
    const r = procesarLectura(texto);
    if (r.ok) {
      onConfirmar(r.codigo);
      return;
    }
    setError(
      r.motivo === 'formato'
        ? 'Un código estándar GTIN tiene exactamente 8, 12 o 13 dígitos.'
        : 'El dígito verificador GS1 no coincide. Revisa si hay algún número mal copiado.'
    );
  };

  return (
    <View style={[s.raiz, { backgroundColor: paleta.fondo }]}>
      <BarraSubpantalla
        titulo="Ingreso manual"
        subtitulo="Validación GS1 en tiempo real"
        onVolver={onCancelar}
        mostrarCerrarTeclado
      />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Pressable onPress={() => Keyboard.dismiss()} style={s.tarjetaWrap}>
            <View
              style={[
                s.tarjeta,
                { backgroundColor: paleta.superficie, borderColor: paleta.borde },
              ]}
            >
              <Text style={[s.titulo, { color: paleta.texto }]}>Código de barras</Text>
              <Text style={[s.parrafo, { color: paleta.textoSecundario }]}>
                Ingresa los dígitos impresos bajo las barras del envase (EAN-8, UPC-A o EAN-13). Se
                valida el dígito verificador antes de consultar la bodega.
              </Text>

              <View
                style={[
                  s.cajaInput,
                  {
                    backgroundColor: paleta.inputFondo,
                    borderColor: error ? paleta.rojo : paleta.acento,
                  },
                ]}
              >
                <TextInput
                  value={texto}
                  onChangeText={(t) => {
                    setTexto(t.replace(/[^0-9]/g, ''));
                    setError(null);
                  }}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={confirmar}
                  maxLength={13}
                  placeholder="7801610001625"
                  placeholderTextColor={paleta.textoTerciario}
                  style={[s.input, { color: paleta.texto }]}
                  accessibilityLabel="Código de barras numérico"
                />
                {texto.length > 0 ? (
                  <Pressable
                    onPress={() => {
                      setTexto('');
                      setError(null);
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Limpiar código"
                    style={[s.btnLimpiar, { backgroundColor: paleta.textoTerciario }]}
                  >
                    <Text style={s.txtLimpiar}>✕</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={s.filaMeta}>
                <Text style={[s.contador, { color: paleta.textoTerciario }]}>
                  {texto.length} / 13 dígitos
                </Text>
                <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8}>
                  <Text style={[s.ocultarTeclado, { color: paleta.acento }]}>
                    Ocultar teclado ▾
                  </Text>
                </Pressable>
              </View>

              {error ? (
                <View style={[s.alertaError, { backgroundColor: paleta.rojoSuave }]}>
                  <Text style={[s.errorTexto, { color: paleta.rojo }]}>{error}</Text>
                </View>
              ) : null}

              <View style={s.acciones}>
                <Boton
                  titulo="Consultar o registrar producto"
                  onPress={confirmar}
                  deshabilitado={texto.length < 8}
                />
                <Boton titulo="Cancelar y volver" onPress={onCancelar} estilo="secundario" />
              </View>
            </View>

            <View
              style={[
                s.tarjeta,
                { backgroundColor: paleta.superficie, borderColor: paleta.borde },
              ]}
            >
              <Text style={[s.subtitulo, { color: paleta.textoSecundario }]}>
                CÓDIGOS GS1 RÁPIDOS DE PRUEBA
              </Text>
              <View style={s.chipsRow}>
                {CODIGOS_EJEMPLO.map((item) => (
                  <Pressable
                    key={item.codigo}
                    onPress={() => {
                      Keyboard.dismiss();
                      setTexto(item.codigo);
                      setError(null);
                    }}
                    style={[
                      s.chipPrueba,
                      {
                        backgroundColor: paleta.acentoSuave,
                        borderColor: paleta.borde,
                      },
                    ]}
                  >
                    <Text style={[s.chipTitulo, { color: paleta.acento }]}>{item.etiqueta}</Text>
                    <Text style={[s.chipCodigo, { color: paleta.textoSecundario }]}>
                      {item.codigo}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  tarjetaWrap: { gap: 14 },
  tarjeta: {
    borderRadius: 18,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  titulo: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  parrafo: { fontSize: 14, lineHeight: 20 },
  cajaInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 58,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingVertical: 12,
    fontVariant: ['tabular-nums'],
  },
  btnLimpiar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txtLimpiar: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  filaMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contador: { fontSize: 13, fontVariant: ['tabular-nums'] },
  ocultarTeclado: { fontSize: 13, fontWeight: '700' },
  alertaError: {
    borderRadius: 12,
    padding: 12,
  },
  errorTexto: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  acciones: { gap: 10, marginTop: 4 },
  subtitulo: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipPrueba: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipTitulo: { fontSize: 12, fontWeight: '700' },
  chipCodigo: { fontSize: 11, fontVariant: ['tabular-nums'], marginTop: 1 },
});
