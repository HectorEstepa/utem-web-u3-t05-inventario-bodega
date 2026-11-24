import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { Cargando, ErrorEstado } from '../components/Estados';
import { FilaProducto } from '../components/FilaProducto';
import {
  listarCriticos,
  obtenerResumenEjecutivo,
  sembrarCatalogoDemo,
  type Producto,
  type ResumenEjecutivo,
} from '../db/inventario';
import { formatearCLP } from '../lib/stock';
import { useTema } from '../theme';

/**
 * Pantalla Principal (Inicio):
 * Resumen comunicativo y limpio con lo justo para operar en bodega:
 * - Capital valorizado y estado general de salud.
 * - Accesos directos a Escáner, Ingreso manual y Dashboard detallado.
 * - Solo los artículos críticos (agotados o bajo mínimo) que requieren acción hoy.
 */
export function PantallaInicio({
  onEscanear,
  onManual,
  onIrDashboard,
  onIrInventario,
  onAbrirProducto,
}: {
  onEscanear: () => void;
  onManual: () => void;
  onIrDashboard: () => void;
  onIrInventario: () => void;
  onAbrirProducto: (p: Producto) => void;
}) {
  const db = useSQLiteContext();
  const { paleta } = useTema();
  const [resumen, setResumen] = useState<ResumenEjecutivo | null>(null);
  const [criticos, setCriticos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      const [res, crit] = await Promise.all([
        obtenerResumenEjecutivo(db),
        listarCriticos(db, 6),
      ]);
      setResumen(res);
      setCriticos(crit);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el estado de la bodega.');
    } finally {
      setCargando(false);
    }
  }, [db]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cargarDemo = async () => {
    setCargando(true);
    await sembrarCatalogoDemo(db);
    await cargar();
  };

  if (cargando) return <Cargando texto="Preparando resumen de bodega…" />;
  if (error || !resumen) {
    return <ErrorEstado mensaje={error ?? 'Error inesperado'} onReintentar={cargar} />;
  }

  return (
    <ScrollView
      style={[s.raiz, { backgroundColor: paleta.fondo }]}
      contentContainerStyle={s.cont}
    >
      {/* Cabecera minimalista */}
      <View style={s.header}>
        <View>
          <Text style={[s.saludo, { color: paleta.acento }]}>CONTROL DE BODEGA</Text>
          <Text style={[s.granTitulo, { color: paleta.texto }]}>Inicio</Text>
        </View>
      </View>

      {/* Tarjeta ejecutiva azul claro fino */}
      <View
        style={[
          s.heroCard,
          {
            backgroundColor: paleta.oscura ? '#0F253D' : '#0284C7',
            borderColor: paleta.oscura ? '#1E3A5F' : '#0369A1',
          },
        ]}
      >
        <View style={s.heroTop}>
          <Text style={s.heroKicker}>CAPITAL EN INVENTARIO</Text>
          <View style={s.heroPill}>
            <Text style={s.heroPillTxt}>{resumen.totalSkus} SKUs</Text>
          </View>
        </View>
        <Text style={s.heroMonto}>{formatearCLP(resumen.valorInventarioCLP)}</Text>
        <View style={s.heroPie}>
          <Text style={s.heroMeta}>
            {resumen.unidadesTotales.toLocaleString('es-CL')} unidades disponibles
          </Text>
          <Pressable onPress={onIrDashboard} style={s.heroLink}>
            <Text style={s.heroLinkTxt}>Ver dashboard</Text>
            <Ionicons name="chevron-forward" size={14} color="#E0F2FE" />
          </Pressable>
        </View>
      </View>

      {/* Accesos directos principales */}
      <View style={s.gridAcciones}>
        <Pressable
          onPress={onEscanear}
          accessibilityRole="button"
          accessibilityLabel="Escanear código de barras"
          style={({ pressed }) => [
            s.accionCard,
            { backgroundColor: paleta.superficie, borderColor: paleta.borde },
            pressed && { opacity: 0.78 },
          ]}
        >
          <View style={[s.iconoBox, { backgroundColor: paleta.acentoSuave }]}>
            <Ionicons name="barcode-outline" size={24} color={paleta.acento} />
          </View>
          <Text style={[s.accionTitulo, { color: paleta.texto }]}>Escanear</Text>
          <Text style={[s.accionSub, { color: paleta.textoSecundario }]}>
            Entrada, salida o alta
          </Text>
        </Pressable>

        <Pressable
          onPress={onManual}
          accessibilityRole="button"
          accessibilityLabel="Ingresar código manualmente"
          style={({ pressed }) => [
            s.accionCard,
            { backgroundColor: paleta.superficie, borderColor: paleta.borde },
            pressed && { opacity: 0.78 },
          ]}
        >
          <View style={[s.iconoBox, { backgroundColor: paleta.acentoSuave }]}>
            <Ionicons name="keypad-outline" size={22} color={paleta.acento} />
          </View>
          <Text style={[s.accionTitulo, { color: paleta.texto }]}>Código manual</Text>
          <Text style={[s.accionSub, { color: paleta.textoSecundario }]}>
            Validación GTIN rápida
          </Text>
        </Pressable>
      </View>

      {/* Tira comunicativa de flujo del día */}
      <Pressable
        onPress={onIrDashboard}
        style={({ pressed }) => [
          s.tiraResumen,
          { backgroundColor: paleta.superficie, borderColor: paleta.borde },
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={s.tiraCol}>
          <Text style={[s.tiraLbl, { color: paleta.textoTerciario }]}>SALIDAS / VENTAS</Text>
          <Text style={[s.tiraVal, { color: paleta.rojo }]}>
            {formatearCLP(resumen.salidasMontoCLP)}
          </Text>
        </View>
        <View style={[s.divisorVert, { backgroundColor: paleta.separador }]} />
        <View style={s.tiraCol}>
          <Text style={[s.tiraLbl, { color: paleta.textoTerciario }]}>ENTRADAS</Text>
          <Text style={[s.tiraVal, { color: paleta.verde }]}>
            {formatearCLP(resumen.entradasMontoCLP)}
          </Text>
        </View>
        <Ionicons name="bar-chart-outline" size={20} color={paleta.acento} />
      </Pressable>

      {/* Alertas de reposición (solo lo urgente) */}
      <View style={s.secRow}>
        <Text style={[s.secTitulo, { color: paleta.texto }]}>
          Alertas de reposición ({resumen.skusCriticos})
        </Text>
        <Pressable onPress={onIrInventario} hitSlop={8}>
          <Text style={[s.verTodo, { color: paleta.acento }]}>Ver inventario</Text>
        </Pressable>
      </View>

      {resumen.totalSkus === 0 ? (
        <View
          style={[
            s.cajaInfo,
            { backgroundColor: paleta.superficie, borderColor: paleta.borde },
          ]}
        >
          <Ionicons name="cube-outline" size={28} color={paleta.acento} />
          <Text style={[s.cajaTitulo, { color: paleta.texto }]}>Bodega sin artículos aún</Text>
          <Text style={[s.cajaSub, { color: paleta.textoSecundario }]}>
            Escanea un envase real o carga un catálogo demostrativo para explorar el inventario y el
            dashboard.
          </Text>
          <Pressable
            onPress={cargarDemo}
            style={[s.btnDemo, { backgroundColor: paleta.acentoSuave }]}
          >
            <Text style={[s.btnDemoTxt, { color: paleta.acento }]}>
              Cargar catálogo demostrativo
            </Text>
          </Pressable>
        </View>
      ) : criticos.length === 0 ? (
        <View
          style={[
            s.cajaOk,
            { backgroundColor: paleta.verdeSuave, borderColor: paleta.borde },
          ]}
        >
          <Ionicons name="checkmark-circle-outline" size={24} color={paleta.verde} />
          <View style={{ flex: 1 }}>
            <Text style={[s.okTitulo, { color: paleta.verde }]}>Stock en niveles óptimos</Text>
            <Text style={[s.okSub, { color: paleta.textoSecundario }]}>
              Ningún producto está agotado ni por debajo de su mínimo configurado.
            </Text>
          </View>
        </View>
      ) : (
        <View>
          {criticos.map((prod) => (
            <FilaProducto key={prod.codigo} producto={prod} onPress={onAbrirProducto} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1 },
  cont: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32, gap: 14 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  saludo: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  granTitulo: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, marginTop: 1 },
  badgeOffline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  badgeOfflineTxt: { fontSize: 12, fontWeight: '700' },
  heroCard: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    gap: 6,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroKicker: { color: '#BAE6FD', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  heroPillTxt: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' },
  heroMonto: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
    marginVertical: 2,
  },
  heroPie: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  heroMeta: { color: '#E0F2FE', fontSize: 13, fontWeight: '500' },
  heroLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  heroLinkTxt: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  gridAcciones: { flexDirection: 'row', gap: 10 },
  accionCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  iconoBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  accionTitulo: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  accionSub: { fontSize: 12 },
  tiraResumen: {
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tiraCol: { flex: 1, gap: 2 },
  tiraLbl: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  tiraVal: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  divisorVert: { width: 1, height: 30 },
  secRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  secTitulo: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  verTodo: { fontSize: 13.5, fontWeight: '700' },
  cajaInfo: {
    borderRadius: 18,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 8,
  },
  cajaTitulo: { fontSize: 16, fontWeight: '700' },
  cajaSub: { fontSize: 13.5, textAlign: 'center', lineHeight: 19 },
  btnDemo: { marginTop: 4, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  btnDemoTxt: { fontSize: 13.5, fontWeight: '700' },
  cajaOk: {
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  okTitulo: { fontSize: 15, fontWeight: '800' },
  okSub: { fontSize: 13, marginTop: 2 },
});
