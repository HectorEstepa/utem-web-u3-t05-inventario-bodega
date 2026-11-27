import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GraficoEvolucion } from '../components/GraficoEvolucion';
import { obtenerEvolucion, type Evolucion } from '../db/evolucion';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Boton } from '../components/Boton';
import { Cargando, ErrorEstado, Vacio } from '../components/Estados';
import { SelectorSegmentado } from '../components/SelectorSegmentado';
import {
  listarMovimientosGlobales,
  obtenerResumenEjecutivo,
  sembrarCatalogoDemo,
  type MovimientoDetallado,
  type ResumenEjecutivo,
} from '../db/inventario';
import { exportarReporteExcel } from '../lib/exportarExcel';
import { formatearCLP } from '../lib/stock';
import { SelectorPeriodo } from '../components/SelectorPeriodo';
import { FilaMovimiento } from '../components/FilaMovimiento';
import { usePeriodo } from '../periodo';
import { useTema } from '../theme';

type FiltroMov = 'TODOS' | 'OUT' | 'IN' | 'ADJ';

/**
 * Dashboard Ejecutivo y Técnico:
 * - Stock actual separado de entradas/salidas del período compartido.
 * - Distribución visual de salud del stock (Óptimo / Stock bajo / Agotado).
 * - Top 5 productos por capital inmovilizado con barras proporcionales.
 * - Bitácora global filtrable de entradas y salidas.
 * - Historial paginado y exportación de cinco hojas del período.
 */
export function PantallaDashboard({
  onHistorial,
  onAbrirCodigo,
  onIrAEscanear,
}: {
  onHistorial: () => void;
  onAbrirCodigo: (codigo: string) => void;
  onIrAEscanear: () => void;
}) {
  const db = useSQLiteContext();
  const { periodo } = usePeriodo();
  const [evolucion, setEvolucion] = useState<Evolucion>({ puntos: [], agrupacion: 'día' });
  const [actualizado, setActualizado] = useState(() => new Date());
  const { paleta } = useTema();
  const [resumen, setResumen] = useState<ResumenEjecutivo | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoDetallado[]>([]);
  const [filtroMov, setFiltroMov] = useState<FiltroMov>('TODOS');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [mensajeExport, setMensajeExport] = useState<string | null>(null);

  const ultimaConsulta = useRef(0);
  const cargar = useCallback(async () => {
    const consulta = ++ultimaConsulta.current;
    setCargando(true);
    try {
      setError(null);
      const [res, movs, serie] = await Promise.all([
        obtenerResumenEjecutivo(db, periodo),
        listarMovimientosGlobales(db, { tipo: filtroMov, periodo, limite: 5 }),
        obtenerEvolucion(db, periodo),
      ]);
      if (consulta !== ultimaConsulta.current) return;
      setResumen(res);
      setEvolucion(serie);
      setActualizado(new Date());
      setMovimientos(movs);
    } catch (e) {
      if (consulta !== ultimaConsulta.current) return;
      setError(e instanceof Error ? e.message : 'Error al cargar las métricas ejecutivas.');
    } finally {
      if (consulta === ultimaConsulta.current) setCargando(false);
    }
  }, [db, filtroMov, periodo]);

  useEffect(() => {
    cargar();
    return () => { ultimaConsulta.current++; };
  }, [cargar]);

  const exportar = async () => {
    if (exportando) return;
    setExportando(true);
    setMensajeExport(null);
    try {
      const nombre = await exportarReporteExcel(db, periodo);
      setMensajeExport(`Reporte generado: ${nombre}`);
    } catch (e) {
      setMensajeExport(e instanceof Error ? e.message : 'No se pudo exportar el archivo Excel.');
    } finally {
      setExportando(false);
    }
  };

  const cargarDemo = async () => {
    setCargando(true);
    try { await sembrarCatalogoDemo(db); await cargar(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.'); setCargando(false); }
  };

  if (cargando) return <Cargando texto="Calculando métricas de bodega…" />;
  if (error || !resumen) {
    return <ErrorEstado mensaje={error ?? 'Sin datos disponibles'} onReintentar={cargar} />;
  }

  const totalSkus = Math.max(1, resumen.totalSkus);
  const pctOptimo = (resumen.skusOptimos / totalSkus) * 100;
  const pctBajo = (resumen.skusBajoMinimo / totalSkus) * 100;
  const pctAgotado = (resumen.skusAgotados / totalSkus) * 100;
  const maxTop = Math.max(1, ...(resumen.topValorizados.map((t) => t.valorTotal) || [1]));

  return (
    <ScrollView
      style={[s.raiz, { backgroundColor: paleta.fondo }]}
      contentContainerStyle={s.cont}
    >
      {/* Cabecera ejecutiva */}
      <View style={s.filaCabecera}>
        <View style={{ flex: 1 }}>
          <Text style={[s.granTitulo, { color: paleta.texto }]}>Dashboard</Text>
          <Text style={[s.subtitulo, { color: paleta.textoSecundario }]}>
            Stock actual y movimientos por período
          </Text>
        </View>
        <Pressable
          onPress={exportar}
          disabled={exportando}
          accessibilityRole="button"
          accessibilityLabel="Exportar reporte Excel"
          style={({ pressed }) => [
            s.btnExcel,
            { backgroundColor: paleta.acento },
            (pressed || exportando) && { opacity: 0.72 },
          ]}
        >
          <Text style={s.txtExcel}>{exportando ? 'Generando…' : 'Exportar .xlsx'}</Text>
        </Pressable>
      </View>

      <SelectorPeriodo />
      <GraficoEvolucion key={periodo.detalle} datos={evolucion} />
      {periodo.desde === null && resumen.primeraFecha !== null && resumen.ultimaFecha !== null ? (
        <Text style={{ color: paleta.textoSecundario }}>Registros incluidos: {new Date(resumen.primeraFecha).toLocaleString('es-CL')} — {new Date(resumen.ultimaFecha).toLocaleString('es-CL')}</Text>
      ) : null}

      {mensajeExport ? (
        <View style={[s.avisoBanner, { backgroundColor: paleta.acentoSuave }]}>
          <Text style={[s.avisoTexto, { color: paleta.acento }]}>{mensajeExport}</Text>
        </View>
      ) : null}

      {resumen.totalSkus === 0 ? (
        <View
          style={[
            s.tarjeta,
            { backgroundColor: paleta.superficie, borderColor: paleta.borde },
          ]}
        >
          <Vacio
            titulo="Sin movimientos registrados aún"
            detalle="Escanea productos reales o carga un lote de ejemplo con entradas, salidas y precios CLP para visualizar el dashboard y exportar Excel."
            accion={{ titulo: 'Cargar datos de demostración', onPress: cargarDemo }}
            accionSecundaria={{ titulo: 'Ir al escáner', onPress: onIrAEscanear }}
          />
        </View>
      ) : (
        <>
          {/* Tarjeta Hero: Capital en Bodega */}
          <View
            style={[
              s.heroCard,
              { backgroundColor: paleta.superficie, borderColor: paleta.borde },
            ]}
          >
            <Text style={[s.kicker, { color: paleta.textoTerciario }]}>
              STOCK ACTUAL · NO HISTÓRICO
            </Text>
            <Text style={[s.heroMonto, { color: paleta.texto }]}>
              {formatearCLP(resumen.valorInventarioCLP)}
            </Text>
            <View style={s.heroSubRow}>
              <Text style={[s.heroDetalle, { color: paleta.textoSecundario }]}>
                {resumen.unidadesTotales.toLocaleString('es-CL')} unidades físicas en{' '}
                {resumen.totalSkus} SKUs
              </Text>
              {resumen.skusCriticos > 0 ? (
                <View style={[s.pillAlerta, { backgroundColor: paleta.rojoSuave }]}>
                  <Text style={[s.pillAlertaTxt, { color: paleta.rojo }]}>
                    ! {resumen.skusCriticos} críticos
                  </Text>
                </View>
              ) : (
                <View style={[s.pillAlerta, { backgroundColor: paleta.verdeSuave }]}>
                  <Text style={[s.pillAlertaTxt, { color: paleta.verde }]}>✓ Stock saludable</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={{ color: paleta.textoSecundario }}>Stock actualizado {actualizado.toLocaleString('es-CL')}. Flujos: {periodo.detalle}.</Text>

          {/* KPIs de Flujo: Salidas/Ventas vs Entradas/Compras */}
          <View style={s.gridDos}>
            <View
              style={[
                s.kpiCard,
                { backgroundColor: paleta.superficie, borderColor: paleta.borde },
              ]}
            >
              <Text style={[s.kpiLabel, { color: paleta.textoTerciario }]}>
                SALIDAS / DESPACHOS
              </Text>
              <Text style={[s.kpiValor, { color: paleta.salida }]}>
                {formatearCLP(resumen.salidasMontoCLP)}
              </Text>
              <Text style={[s.kpiMeta, { color: paleta.textoSecundario }]}>
                ▼ {resumen.salidasUnidades.toLocaleString('es-CL')} unidades despachadas
              </Text>
            </View>

            <View
              style={[
                s.kpiCard,
                { backgroundColor: paleta.superficie, borderColor: paleta.borde },
              ]}
            >
              <Text style={[s.kpiLabel, { color: paleta.textoTerciario }]}>
                ENTRADAS / RECEPCIÓN
              </Text>
              <Text style={[s.kpiValor, { color: paleta.verde }]}>
                {formatearCLP(resumen.entradasMontoCLP)}
              </Text>
              <Text style={[s.kpiMeta, { color: paleta.textoSecundario }]}>
                ▲ {resumen.entradasUnidades.toLocaleString('es-CL')} unidades ingresadas
              </Text>
            </View>
          </View>

          {/* Distribución de Salud de Stock */}
          <View
            style={[
              s.tarjeta,
              { backgroundColor: paleta.superficie, borderColor: paleta.borde },
            ]}
          >
            <Text style={[s.kicker, { color: paleta.textoSecundario }]}>
              SALUD DEL CATÁLOGO ({resumen.totalSkus} SKUS)
            </Text>

            <View style={[s.barraApilada, { backgroundColor: paleta.inputFondo }]}>
              {pctOptimo > 0 ? (
                <View style={{ width: `${pctOptimo}%`, backgroundColor: paleta.verde }} />
              ) : null}
              {pctBajo > 0 ? (
                <View style={{ width: `${pctBajo}%`, backgroundColor: paleta.ambar }} />
              ) : null}
              {pctAgotado > 0 ? (
                <View style={{ width: `${pctAgotado}%`, backgroundColor: paleta.rojo }} />
              ) : null}
            </View>

            <View style={s.leyendaRow}>
              <Text style={[s.leyendaItem, { color: paleta.verde }]}>
                ✓ Óptimos: {resumen.skusOptimos}
              </Text>
              <Text style={[s.leyendaItem, { color: paleta.ambar }]}>
                ! Bajo mín.: {resumen.skusBajoMinimo}
              </Text>
              <Text style={[s.leyendaItem, { color: paleta.rojo }]}>
                ✕ Agotados: {resumen.skusAgotados}
              </Text>
            </View>
          </View>

          {/* Top 5 SKUs por Valorización */}
          <View
            style={[
              s.tarjeta,
              { backgroundColor: paleta.superficie, borderColor: paleta.borde },
            ]}
          >
            <Text style={[s.kicker, { color: paleta.textoSecundario }]}>
              TOP PRODUCTOS POR CAPITAL EN BODEGA
            </Text>
            {resumen.topValorizados.map((item) => {
              const anchoPct = Math.max(6, Math.round((item.valorTotal / maxTop) * 100));
              return (
                <Pressable
                  key={item.codigo}
                  onPress={() => onAbrirCodigo(item.codigo)}
                  style={s.topFila}
                >
                  <View style={s.topCabecera}>
                    <Text style={[s.topNombre, { color: paleta.texto }]} numberOfLines={1}>
                      {item.nombre}
                    </Text>
                    <Text style={[s.topMonto, { color: paleta.texto }]}>
                      {formatearCLP(item.valorTotal)}
                    </Text>
                  </View>
                  <View style={[s.pistaBarra, { backgroundColor: paleta.inputFondo }]}>
                    <View
                      style={[
                        s.rellenoBarra,
                        { width: `${anchoPct}%`, backgroundColor: paleta.acento },
                      ]}
                    />
                  </View>
                  <Text style={[s.topMeta, { color: paleta.textoTerciario }]}>
                    {item.stock} u. × {formatearCLP(item.precio)} · GTIN {item.codigo}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Bitácora global de entradas y salidas */}
          <View
            style={[
              s.tarjeta,
              { backgroundColor: paleta.superficie, borderColor: paleta.borde },
            ]}
          >
            <Text style={[s.kicker, { color: paleta.textoSecundario }]}>
              VISTA PREVIA · HASTA 5 MOVIMIENTOS DEL PERÍODO
            </Text>

            <SelectorSegmentado<FiltroMov>
              valor={filtroMov}
              onChange={setFiltroMov}
              opciones={[
                { valor: 'TODOS', etiqueta: 'Todos' },
                { valor: 'OUT', etiqueta: 'Salidas' },
                { valor: 'IN', etiqueta: 'Entradas' },
                { valor: 'ADJ', etiqueta: 'Ajustes' },
              ]}
            />

            {movimientos.length === 0 ? (
              <Text style={[s.sinMovs, { color: paleta.textoTerciario }]}>
                No hay movimientos para el filtro seleccionado.
              </Text>
            ) : (
              movimientos.map((m) => <FilaMovimiento key={m.id} movimiento={m} onPress={onAbrirCodigo} />)
            )}

            <Boton titulo="Abrir historial y buscar movimientos" onPress={onHistorial} estilo="secundario" />
            <Boton
              titulo={exportando ? 'Exportando…' : '⤓ Exportar reporte del período (.xlsx)'}
              onPress={exportar}
              estilo="secundario"
              deshabilitado={exportando}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1 },
  cont: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34, gap: 12 },
  filaCabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  granTitulo: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  subtitulo: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  btnExcel: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txtExcel: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  avisoBanner: { borderRadius: 12, padding: 11 },
  avisoTexto: { fontSize: 13, fontWeight: '700' },
  heroCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  heroMonto: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  heroSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  heroDetalle: { fontSize: 13, fontWeight: '500' },
  pillAlerta: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  pillAlertaTxt: { fontSize: 11.5, fontWeight: '800' },
  gridDos: { flexDirection: 'row', gap: 10 },
  kpiCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  kpiLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5 },
  kpiValor: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  kpiMeta: { fontSize: 11.5, fontWeight: '500' },
  tarjeta: {
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 11,
  },
  barraApilada: {
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  leyendaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  leyendaItem: { fontSize: 12, fontWeight: '700' },
  topFila: { gap: 4, paddingVertical: 3 },
  topCabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  topNombre: { flex: 1, fontSize: 14, fontWeight: '600' },
  topMonto: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pistaBarra: { height: 7, borderRadius: 4, overflow: 'hidden' },
  rellenoBarra: { height: '100%', borderRadius: 4 },
  topMeta: { fontSize: 11, fontVariant: ['tabular-nums'] },
  sinMovs: { fontSize: 13.5, paddingVertical: 6 },
  movFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  iconoMov: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movProd: { fontSize: 14, fontWeight: '600' },
  movSub: { fontSize: 11.5, marginTop: 1 },
  movDinero: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
