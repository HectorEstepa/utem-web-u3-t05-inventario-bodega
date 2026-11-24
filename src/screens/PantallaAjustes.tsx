import React, { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { useSQLiteContext } from 'expo-sqlite';
import { Boton } from '../components/Boton';
import { SelectorSegmentado } from '../components/SelectorSegmentado';
import { sembrarCatalogoDemo } from '../db/inventario';
import { VERSION_ESQUEMA } from '../db/schema';
import { exportarReporteExcel } from '../lib/exportarExcel';
import { useTema, VERSION_APP, type PreferenciaTema } from '../theme';

/**
 * Apartado de Configuración, Accesibilidad y Información Técnica estilo Ajustes de iOS:
 * - Apariencia (Automático del sistema · Claro · Oscuro).
 * - Accesibilidad (Modo Alto Contraste + soporte Dynamic Type).
 * - Permisos del sistema (estado en vivo de cámara + acceso directo a Ajustes).
 * - Herramientas de datos (Exportar Excel .xlsx · Cargar catálogo demo · Diagnóstico M1–M3).
 * - Ficha técnica verificable (Versión, SDK, SQLite WAL, privacidad Ley 21.719).
 */
export function PantallaAjustes({
  onAbrirMedicion,
  arranqueMs,
}: {
  onAbrirMedicion: () => void;
  arranqueMs: number | null;
}) {
  const db = useSQLiteContext();
  const { paleta, preferencia, altoContraste, cambiarPreferencia, alternarAltoContraste } =
    useTema();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const exportar = async () => {
    if (ocupado) return;
    setOcupado(true);
    setMensaje(null);
    try {
      const archivo = await exportarReporteExcel(db);
      setMensaje(`Archivo exportado: ${archivo}`);
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'Error al exportar Excel.');
    } finally {
      setOcupado(false);
    }
  };

  const poblarDemo = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      await sembrarCatalogoDemo(db);
      setMensaje('Catálogo de demostración cargado (5 SKUs con entradas, salidas y precios CLP).');
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo cargar el lote de prueba.');
    } finally {
      setOcupado(false);
    }
  };

  const estadoCamara = !permiso
    ? 'Consultando…'
    : permiso.granted
      ? '✓ Concedido'
      : permiso.canAskAgain
        ? 'No solicitado aún'
        : '✕ Bloqueado en sistema';

  return (
    <ScrollView
      style={[s.raiz, { backgroundColor: paleta.fondo }]}
      contentContainerStyle={s.cont}
    >
      <Text style={[s.granTitulo, { color: paleta.texto }]}>Ajustes</Text>
      <Text style={[s.subtitulo, { color: paleta.textoSecundario }]}>
        Apariencia, accesibilidad, datos y diagnóstico
      </Text>

      {mensaje ? (
        <View style={[s.banner, { backgroundColor: paleta.acentoSuave }]}>
          <Text style={[s.bannerTxt, { color: paleta.acento }]}>{mensaje}</Text>
        </View>
      ) : null}

      {/* Apariencia y Accesibilidad */}
      <Text style={[s.secHeader, { color: paleta.textoSecundario }]}>
        APARIENCIA Y ACCESIBILIDAD
      </Text>
      <View
        style={[
          s.grupo,
          { backgroundColor: paleta.superficie, borderColor: paleta.borde },
        ]}
      >
        <View style={s.bloqueInterno}>
          <Text style={[s.filaTitulo, { color: paleta.texto }]}>Tema visual</Text>
          <Text style={[s.filaSub, { color: paleta.textoSecundario }]}>
            Adapta la interfaz a bodegas oscuras o luz directa del día
          </Text>
          <View style={{ marginTop: 8 }}>
            <SelectorSegmentado<PreferenciaTema>
              valor={preferencia}
              onChange={cambiarPreferencia}
              opciones={[
                { valor: 'sistema', etiqueta: 'Automático' },
                { valor: 'claro', etiqueta: 'Claro' },
                { valor: 'oscuro', etiqueta: 'Oscuro' },
              ]}
            />
          </View>
        </View>

        <View
          style={[
            s.filaSwitch,
            { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: paleta.separador },
          ]}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[s.filaTitulo, { color: paleta.texto }]}>Modo de alto contraste</Text>
            <Text style={[s.filaSub, { color: paleta.textoSecundario }]}>
              Refuerza bordes, textos y semáforos de stock (accesibilidad visual / daltonismo)
            </Text>
          </View>
          <Switch
            value={altoContraste}
            onValueChange={alternarAltoContraste}
            trackColor={{ false: paleta.inputFondo, true: paleta.acento }}
          />
        </View>
      </View>

      {/* Permisos y Accesos del Sistema */}
      <Text style={[s.secHeader, { color: paleta.textoSecundario }]}>
        PERMISOS Y ACCESOS DEL SISTEMA
      </Text>
      <View
        style={[
          s.grupo,
          { backgroundColor: paleta.superficie, borderColor: paleta.borde },
        ]}
      >
        <View style={s.filaInfo}>
          <Text style={[s.filaTitulo, { color: paleta.texto }]}>Cámara (lectura GTIN)</Text>
          <Text
            style={[
              s.valorDerecha,
              { color: permiso?.granted ? paleta.verde : paleta.ambar },
            ]}
          >
            {estadoCamara}
          </Text>
        </View>
        <View
          style={[
            s.filaInfo,
            { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: paleta.separador },
          ]}
        >
          <Text style={[s.filaTitulo, { color: paleta.texto }]}>Micrófono y ubicación</Text>
          <Text style={[s.valorDerecha, { color: paleta.textoTerciario }]}>
            Deshabilitados por diseño
          </Text>
        </View>
        <View
          style={[
            s.bloqueBotones,
            { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: paleta.separador },
          ]}
        >
          {permiso && !permiso.granted && permiso.canAskAgain ? (
            <Boton titulo="Conceder permiso de cámara" onPress={() => pedirPermiso()} compacto />
          ) : null}
          <Boton
            titulo="Abrir configuración del teléfono"
            onPress={() => Linking.openSettings()}
            estilo="secundario"
            compacto
          />
        </View>
      </View>

      {/* Gestión de Datos y Diagnóstico */}
      <Text style={[s.secHeader, { color: paleta.textoSecundario }]}>
        DATOS, EXPORTACIÓN Y RENDIMIENTO
      </Text>
      <View
        style={[
          s.grupo,
          { backgroundColor: paleta.superficie, borderColor: paleta.borde },
        ]}
      >
        <Pressable
          onPress={exportar}
          disabled={ocupado}
          style={({ pressed }) => [s.filaAccion, pressed && { opacity: 0.65 }]}
        >
          <View>
            <Text style={[s.filaTitulo, { color: paleta.acento }]}>
              ⤓ Exportar inventario y movimientos (.xlsx)
            </Text>
            <Text style={[s.filaSub, { color: paleta.textoSecundario }]}>
              Libro Excel con 3 hojas: Resumen Ejecutivo, Inventario y Movimientos
            </Text>
          </View>
          <Text style={[s.chevron, { color: paleta.textoTerciario }]}>›</Text>
        </Pressable>

        <Pressable
          onPress={poblarDemo}
          disabled={ocupado}
          style={({ pressed }) => [
            s.filaAccion,
            { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: paleta.separador },
            pressed && { opacity: 0.65 },
          ]}
        >
          <View>
            <Text style={[s.filaTitulo, { color: paleta.texto }]}>
              Cargar catálogo demostrativo
            </Text>
            <Text style={[s.filaSub, { color: paleta.textoSecundario }]}>
              Agrega 5 artículos reales GS1 con precios CLP y movimientos de prueba
            </Text>
          </View>
          <Text style={[s.chevron, { color: paleta.textoTerciario }]}>›</Text>
        </Pressable>

        <Pressable
          onPress={onAbrirMedicion}
          style={({ pressed }) => [
            s.filaAccion,
            { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: paleta.separador },
            pressed && { opacity: 0.65 },
          ]}
        >
          <View>
            <Text style={[s.filaTitulo, { color: paleta.texto }]}>
              Diagnóstico y benchmark (M1 · M2 · M3)
            </Text>
            <Text style={[s.filaSub, { color: paleta.textoSecundario }]}>
              SQLite vs AsyncStorage (5.000 SKUs) · Arranque actual:{' '}
              {arranqueMs !== null ? `${arranqueMs.toFixed(0)} ms` : '—'}
            </Text>
          </View>
          <Text style={[s.chevron, { color: paleta.textoTerciario }]}>›</Text>
        </Pressable>
      </View>

      {/* Acerca de la aplicación */}
      <Text style={[s.secHeader, { color: paleta.textoSecundario }]}>
        INFORMACIÓN TÉCNICA Y VERSIÓN
      </Text>
      <View
        style={[
          s.grupo,
          { backgroundColor: paleta.superficie, borderColor: paleta.borde },
        ]}
      >
        <View style={s.filaInfo}>
          <Text style={[s.filaTitulo, { color: paleta.texto }]}>Versión de la app</Text>
          <Text style={[s.valorDerecha, { color: paleta.textoSecundario }]}>
            v{VERSION_APP} (Esquema SQLite v{VERSION_ESQUEMA})
          </Text>
        </View>
        <View
          style={[
            s.filaInfo,
            { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: paleta.separador },
          ]}
        >
          <Text style={[s.filaTitulo, { color: paleta.texto }]}>Motor y plataforma</Text>
          <Text style={[s.valorDerecha, { color: paleta.textoSecundario }]}>
            Expo SDK 58 · RN 0.88 · {Platform.OS === 'ios' ? 'iOS' : 'Android'}
          </Text>
        </View>
        <View
          style={[
            s.filaInfo,
            { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: paleta.separador },
          ]}
        >
          <Text style={[s.filaTitulo, { color: paleta.texto }]}>Persistencia y red</Text>
          <Text style={[s.valorDerecha, { color: paleta.verde }]}>
            SQLite WAL · 100% Offline
          </Text>
        </View>
        <View
          style={[
            s.filaInfo,
            { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: paleta.separador },
          ]}
        >
          <Text style={[s.filaTitulo, { color: paleta.texto }]}>Privacidad (Ley 21.719)</Text>
          <Text style={[s.valorDerecha, { color: paleta.textoSecundario }]}>
            0 datos personales
          </Text>
        </View>
        <View
          style={[
            s.filaInfo,
            { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: paleta.separador },
          ]}
        >
          <Text style={[s.filaTitulo, { color: paleta.texto }]}>Equipo UTEM · T05</Text>
          <Text style={[s.valorDerecha, { color: paleta.textoSecundario }]}>
            Olarte · Estepa · Arteaga
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1 },
  cont: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 38, gap: 8 },
  granTitulo: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  subtitulo: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  banner: { borderRadius: 12, padding: 12, marginVertical: 4 },
  bannerTxt: { fontSize: 13.5, fontWeight: '700' },
  secHeader: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 10,
    marginLeft: 6,
  },
  grupo: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  bloqueInterno: { padding: 15 },
  filaSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
  },
  filaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 13,
    gap: 10,
  },
  filaAccion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 13,
    gap: 10,
  },
  bloqueBotones: { padding: 12, gap: 8 },
  filaTitulo: { fontSize: 15.5, fontWeight: '600' },
  filaSub: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  valorDerecha: { fontSize: 13.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  chevron: { fontSize: 22, fontWeight: '400' },
});
