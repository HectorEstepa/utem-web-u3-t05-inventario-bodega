import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Boton } from '../components/Boton';
import { Cargando } from '../components/Estados';
import { procesarLectura } from '../lib/gtin';
import { C } from '../theme';

/**
 * Tipos restringidos a los que realmente se usan en un almacén chileno.
 * Aceptar los trece tipos que soporta expo-camera multiplica las lecturas
 * falsas sobre etiquetas de precio y códigos QR de publicidad.
 *
 * code128 queda fuera a propósito: es alfanumérico y de largo libre, así que
 * nunca pasaría la validación del dígito verificador GTIN y el usuario solo
 * vería "lectura incompleta". Soportar etiquetas internas del local exigiría
 * una segunda ruta de validación, y está fuera del alcance.
 */
const TIPOS = ['ean13', 'ean8', 'upc_a'] as const;

type Props = {
  onLeido: (codigo: string) => void;
  onCancelar: () => void;
  onManual: () => void;
};

export function PantallaEscaner({ onLeido, onCancelar, onManual }: Props) {
  const [permiso, pedirPermiso, consultarPermiso] = useCameraPermissions();
  const [explicado, setExplicado] = useState(false);
  const [codigoInvalido, setCodigoInvalido] = useState<string | null>(null);
  const [activa, setActiva] = useState(true);

  // La cámara dispara el callback varias veces por segundo sobre el mismo
  // código. Sin este candado, un solo escaneo abriría la ficha N veces.
  const bloqueado = useRef(false);

  useEffect(() => {
    // Solo puede haber una vista previa de cámara activa a la vez, y
    // dejarla encendida en segundo plano consume batería sin dar nada.
    // Se apaga al salir de primer plano y se limpia al desmontar.
    const sub = AppState.addEventListener('change', (e) => {
      setActiva(e === 'active');
      // Al volver de Ajustes el permiso pudo cambiar, y el hook no lo
      // consulta solo. Sin esto, el usuario que recién lo concedió sigue
      // viendo la pantalla de "sin acceso" hasta salir y volver a entrar.
      if (e === 'active') consultarPermiso();
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

  // 1. El permiso todavía se está consultando.
  if (!permiso) return <Cargando texto="Revisando el permiso de cámara…" />;

  // 2. No hay permiso y aún no explicamos por qué lo pedimos.
  //    La ventana del sistema no permite personalizar su texto, así que la
  //    explicación va antes, en una pantalla propia.
  if (!permiso.granted && !explicado) {
    return (
      <View style={s.centro}>
        <Text style={s.icono}>📷</Text>
        <Text style={s.titulo}>Necesitamos la cámara para leer códigos</Text>
        <Text style={s.parrafo}>
          La usamos solo mientras tengas esta pantalla abierta, para leer el código de barras del
          producto. No se guardan ni se envían fotos: la lectura ocurre en tu teléfono y lo único
          que queda registrado son los números del código.
        </Text>
        <Boton
          titulo="Permitir la cámara"
          onPress={async () => {
            setExplicado(true);
            await pedirPermiso();
          }}
        />
        <Boton titulo="Prefiero escribir el código" onPress={onManual} estilo="secundario" />
        <Text style={s.volver} onPress={onCancelar}>
          Volver
        </Text>
      </View>
    );
  }

  // 3. Permiso denegado de forma definitiva: el sistema ya no vuelve a
  //    preguntar, así que hay que mandar al usuario a Ajustes. La app sigue
  //    siendo útil por la vía manual.
  if (!permiso.granted) {
    return (
      <View style={s.centro}>
        <Text style={s.icono}>🔒</Text>
        <Text style={s.titulo}>Sin acceso a la cámara</Text>
        <Text style={s.parrafo}>
          {permiso.canAskAgain
            ? 'Puedes volver a intentarlo, o seguir trabajando con el código escrito a mano.'
            : 'El sistema ya no mostrará la ventana de permiso. Puedes activarlo en Ajustes, o seguir trabajando con el código escrito a mano.'}
        </Text>
        {permiso.canAskAgain ? (
          <Boton titulo="Pedir el permiso otra vez" onPress={() => pedirPermiso()} />
        ) : (
          <Boton titulo="Abrir Ajustes" onPress={() => Linking.openSettings()} />
        )}
        <Boton titulo="Escribir el código a mano" onPress={onManual} estilo="secundario" />
        <Text style={s.volver} onPress={onCancelar}>
          Volver
        </Text>
      </View>
    );
  }

  // 4. Código leído pero inválido: ni el formato ni el dígito verificador
  //    cuadran. Es un error del lector, no del usuario, y se dice así.
  if (codigoInvalido) {
    return (
      <View style={s.centro}>
        <Text style={s.icono}>⚠</Text>
        <Text style={[s.titulo, { color: C.rojo }]}>Lectura incompleta</Text>
        <Text style={s.parrafo}>
          Se leyó <Text style={s.mono}>{codigoInvalido}</Text>, pero no corresponde a un código de
          barras válido. Suele pasar con etiquetas arrugadas o con poca luz.
        </Text>
        <Boton titulo="Escanear de nuevo" onPress={reintentar} />
        <Boton titulo="Escribir el código a mano" onPress={onManual} estilo="secundario" />
      </View>
    );
  }

  // 5. Todo en orden: cámara activa.
  return (
    <View style={s.raiz}>
      {activa ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...TIPOS] }}
          onBarcodeScanned={alEscanear}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.navy }]} />
      )}
      <View style={s.marco} pointerEvents="none" />
      <View style={s.pie}>
        <Text style={s.pieTexto}>Apunta al código de barras del producto</Text>
        <Boton titulo="Cancelar" onPress={onCancelar} estilo="secundario" />
        <Text style={s.volver} onPress={onManual}>
          Escribir el código a mano
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#000' },
  marco: {
    position: 'absolute',
    top: '28%',
    left: '10%',
    right: '10%',
    height: '24%',
    borderWidth: 3,
    borderColor: C.teal,
    borderRadius: 16,
  },
  pie: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 18,
    paddingBottom: 28,
    backgroundColor: 'rgba(15,39,64,0.92)',
    gap: 10,
  },
  pieTexto: { color: '#fff', textAlign: 'center', fontSize: 15, fontWeight: '600' },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
    backgroundColor: C.fondo,
  },
  icono: { fontSize: 46 },
  titulo: { fontSize: 20, fontWeight: '800', color: C.navy, textAlign: 'center' },
  parrafo: { fontSize: 15, color: C.gris, textAlign: 'center', lineHeight: 22, marginBottom: 6 },
  mono: { fontWeight: '800', color: C.navy },
  volver: { color: C.azul, fontWeight: '700', fontSize: 15, padding: 10 },
});
