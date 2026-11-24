import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Boton } from '../components/Boton';
import { Cargando } from '../components/Estados';
import { procesarLectura } from '../lib/gtin';
import { TOQUE_MINIMO, useTema } from '../theme';

/**
 * Simbologías restringidas a códigos comerciales estándar en Chile (GTIN):
 * evita falsos positivos sobre códigos QR publicitarios o etiquetas internas.
 */
const TIPOS = ['ean13', 'ean8', 'upc_a'] as const;

type Props = {
  onLeido: (codigo: string) => void;
  onCancelar: () => void;
  onManual: () => void;
};

export function PantallaEscaner({ onLeido, onCancelar, onManual }: Props) {
  const { paleta } = useTema();
  const [permiso, pedirPermiso, consultarPermiso] = useCameraPermissions();
  const [explicado, setExplicado] = useState(false);
  const [codigoInvalido, setCodigoInvalido] = useState<string | null>(null);
  const [linterna, setLinterna] = useState(false);
  const [activa, setActiva] = useState(true);

  const bloqueado = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (e) => {
      const enFrente = e === 'active';
      setActiva(enFrente);
      if (!enFrente) setLinterna(false);
      if (enFrente) consultarPermiso();
    });
    return () => {
      sub.remove();
      bloqueado.current = false;
    };
  }, [consultarPermiso]);

  const alEscanear = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (bloqueado.current) return;
      bloqueado.current = true;

      const r = procesarLectura(data);
      if (r.ok) {
        Vibration.vibrate(35);
        onLeido(r.codigo);
        return;
      }
      setCodigoInvalido(r.codigo || '(ilegible)');
    },
    [onLeido]
  );

  const reintentar = useCallback(() => {
    setCodigoInvalido(null);
    bloqueado.current = false;
  }, []);

  // 1. Consultando estado inicial del permiso.
  if (!permiso) return <Cargando texto="Verificando acceso a la cámara…" />;

  // 2. Explicación contextual propia previa al diálogo nativo del sistema.
  if (!permiso.granted && !explicado) {
    return (
      <View style={[s.centro, { backgroundColor: paleta.fondo }]}>
        <View
          style={[
            s.tarjetaEstado,
            { backgroundColor: paleta.superficie, borderColor: paleta.borde },
          ]}
        >
          <View style={[s.iconoCirculo, { backgroundColor: paleta.acentoSuave }]}>
            <Text style={[s.iconoTxt, { color: paleta.acento }]}>⌗</Text>
          </View>
          <Text style={[s.titulo, { color: paleta.texto }]}>
            Acceso a cámara para lectura GTIN
          </Text>
          <Text style={[s.parrafo, { color: paleta.textoSecundario }]}>
            Se utiliza únicamente mientras esta vista permanece abierta para decodificar códigos de
            barras en tu propio dispositivo. No se capturan fotografías, audio ni se envían imágenes
            por red.
          </Text>
          <Boton
            titulo="Continuar y permitir cámara"
            onPress={async () => {
              setExplicado(true);
              await pedirPermiso();
            }}
          />
          <Boton titulo="Ingresar código manualmente" onPress={onManual} estilo="secundario" />
          <Boton titulo="Volver al inventario" onPress={onCancelar} estilo="fantasma" compacto />
        </View>
      </View>
    );
  }

  // 3. Permiso rechazado (recuperable o bloqueado en Ajustes).
  if (!permiso.granted) {
    return (
      <View style={[s.centro, { backgroundColor: paleta.fondo }]}>
        <View
          style={[
            s.tarjetaEstado,
            { backgroundColor: paleta.superficie, borderColor: paleta.borde },
          ]}
        >
          <View style={[s.iconoCirculo, { backgroundColor: paleta.ambarSuave }]}>
            <Text style={[s.iconoTxt, { color: paleta.ambar }]}>!</Text>
          </View>
          <Text style={[s.titulo, { color: paleta.texto }]}>Cámara desactivada</Text>
          <Text style={[s.parrafo, { color: paleta.textoSecundario }]}>
            {permiso.canAskAgain
              ? 'Puedes volver a solicitar el permiso de cámara o trabajar normalmente ingresando los números del código a mano.'
              : 'El permiso fue deshabilitado en el sistema. Puedes activarlo en Ajustes o continuar trabajando con ingreso manual.'}
          </Text>
          {permiso.canAskAgain ? (
            <Boton titulo="Solicitar permiso nuevamente" onPress={() => pedirPermiso()} />
          ) : (
            <Boton titulo="Abrir Ajustes del sistema" onPress={() => Linking.openSettings()} />
          )}
          <Boton titulo="Escribir código manualmente" onPress={onManual} estilo="secundario" />
          <Boton titulo="Volver" onPress={onCancelar} estilo="fantasma" compacto />
        </View>
      </View>
    );
  }

  // 4. Lectura óptica corrupta (falló validación módulo 10 GS1).
  if (codigoInvalido) {
    return (
      <View style={[s.centro, { backgroundColor: paleta.fondo }]}>
        <View
          style={[
            s.tarjetaEstado,
            { backgroundColor: paleta.superficie, borderColor: paleta.borde },
          ]}
        >
          <View style={[s.iconoCirculo, { backgroundColor: paleta.rojoSuave }]}>
            <Text style={[s.iconoTxt, { color: paleta.rojo }]}>✕</Text>
          </View>
          <Text style={[s.titulo, { color: paleta.texto }]}>Lectura incompleta</Text>
          <Text style={[s.parrafo, { color: paleta.textoSecundario }]}>
            Se capturó <Text style={[s.mono, { color: paleta.texto }]}>{codigoInvalido}</Text>, pero
            no supera el dígito verificador GS1. Acerca el envase o activa la linterna si hay poca
            luz en la bodega.
          </Text>
          <Boton titulo="Intentar lectura nuevamente" onPress={reintentar} />
          <Boton titulo="Escribir código manualmente" onPress={onManual} estilo="secundario" />
        </View>
      </View>
    );
  }

  // 5. Cámara activa con mirilla tipo iOS Wallet / Scanner y linterna.
  return (
    <View style={s.raiz}>
      {activa ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={linterna}
          barcodeScannerSettings={{ barcodeTypes: [...TIPOS] }}
          onBarcodeScanned={alEscanear}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
      )}

      {/* Barra superior flotante sobre cámara */}
      <View style={s.topOverlay}>
        <Pressable
          onPress={onCancelar}
          accessibilityRole="button"
          accessibilityLabel="Cerrar escáner"
          style={[s.pildoraOscura, { flexDirection: 'row', gap: 4 }]}
        >
          <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
          <Text style={s.txtOverlay}>Volver</Text>
        </Pressable>

        <Pressable
          onPress={() => setLinterna((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={linterna ? 'Apagar linterna' : 'Encender linterna'}
          style={[
            s.pildoraOscura,
            { flexDirection: 'row', gap: 6 },
            linterna && { backgroundColor: '#F59E0B' },
          ]}
        >
          <Ionicons
            name={linterna ? 'flashlight' : 'flashlight-outline'}
            size={16}
            color={linterna ? '#111114' : '#FFFFFF'}
          />
          <Text style={[s.txtOverlay, linterna && { color: '#111114' }]}>
            {linterna ? 'Luz ON' : 'Linterna'}
          </Text>
        </Pressable>
      </View>

      {/* Visor central */}
      <View style={s.visorWrap} pointerEvents="none">
        <View style={s.marco}>
          <View style={[s.esquina, s.esqTL]} />
          <View style={[s.esquina, s.esqTR]} />
          <View style={[s.esquina, s.esqBL]} />
          <View style={[s.esquina, s.esqBR]} />
        </View>
        <Text style={s.guiaVisor}>Centra el código EAN-13, EAN-8 o UPC-A</Text>
      </View>

      {/* Panel inferior flotante */}
      <View style={s.pie}>
        <Boton titulo="Ingresar código manualmente" onPress={onManual} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#000' },
  topOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  pildoraOscura: {
    minHeight: TOQUE_MINIMO - 6,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: 'rgba(18,18,22,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txtOverlay: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  visorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  marco: {
    width: '100%',
    maxWidth: 320,
    height: 170,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.38)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  esquina: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: '#30D158',
  },
  esqTL: { top: -1, left: -1, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 20 },
  esqTR: { top: -1, right: -1, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 20 },
  esqBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 20,
  },
  esqBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 20,
  },
  guiaVisor: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.58)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  pie: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 22,
    backgroundColor: 'rgba(18,18,22,0.88)',
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  tarjetaEstado: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    padding: 22,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconoCirculo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  iconoTxt: { fontSize: 26, fontWeight: '800' },
  titulo: { fontSize: 20, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  parrafo: { fontSize: 14.5, textAlign: 'center', lineHeight: 21, marginBottom: 4 },
  mono: { fontWeight: '800', fontVariant: ['tabular-nums'] },
});
