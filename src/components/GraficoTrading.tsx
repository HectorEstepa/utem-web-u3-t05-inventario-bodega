import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PuntoFinanciero } from '../db/inventario';
import { formatearCLP } from '../lib/stock';
import { useTema } from '../theme';

type MetricaGrafico = 'capital' | 'unidades';
type RangoVentana = '10' | '25' | 'TODO';

const ALTURA_LIENZO = 192;
const PADDING_SUP = 14;
const PADDING_INF = 26; // espacio reservado para barras de volumen

function formatearCompacto(valor: number, metrica: MetricaGrafico): string {
  if (metrica === 'unidades') {
    if (valor >= 1000) return `${(valor / 1000).toFixed(1)}k u`;
    return `${Math.round(valor)} u`;
  }
  const abs = Math.abs(valor);
  if (abs >= 1_000_000) return `$ ${(valor / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `$ ${Math.round(valor / 1000)}k`;
  if (abs >= 1_000) return `$ ${(valor / 1000).toFixed(1)}k`;
  return `$ ${Math.round(valor)}`;
}

function formatearHoraCorta(ms: number): string {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

/**
 * Gráfico financiero interactivo estilo bolsa/trading construido 100% en
 * React Native puro (cero dependencias nativas). Muestra la evolución
 * cronológica del capital ($ CLP) o unidades físicas en bodega, con área
 * bajo la curva, volumen de entradas/salidas, grilla Y, línea de apertura y
 * cursor interactivo al tocar cualquier punto.
 */
export function GraficoTrading({ serie }: { serie: PuntoFinanciero[] }) {
  const { paleta } = useTema();
  const [metrica, setMetrica] = useState<MetricaGrafico>('capital');
  const [rango, setRango] = useState<RangoVentana>('25');
  const [anchoLienzo, setAnchoLienzo] = useState(0);
  const [indiceActivo, setIndiceActivo] = useState<number | null>(null);

  const ventana = useMemo(() => {
    if (serie.length === 0) return [];
    const base =
      rango === '10'
        ? serie.slice(-10)
        : rango === '25'
          ? serie.slice(-25)
          : serie;

    // Si solo existe 1 movimiento, antepone punto de apertura en 0 para trazar tendencia
    if (base.length === 1 && base[0]) {
      const unico = base[0];
      const apertura: PuntoFinanciero = {
        id: 0,
        fecha: unico.fecha - 60_000,
        capitalCLP: Math.max(0, unico.capitalCLP - unico.deltaCLP),
        unidades: Math.max(0, unico.unidades - unico.deltaUnidades),
        deltaCLP: 0,
        deltaUnidades: 0,
        tipo: 'IN',
        producto: 'Apertura de bodega',
        nota: 'Saldo inicial del período',
      };
      return [apertura, unico];
    }
    return base;
  }, [serie, rango]);

  // Al cambiar de rango o llegar nuevos datos, selecciona el último punto
  useEffect(() => {
    setIndiceActivo(ventana.length > 0 ? ventana.length - 1 : null);
  }, [ventana.length, rango]);

  const valores = useMemo(
    () => ventana.map((p) => (metrica === 'capital' ? p.capitalCLP : p.unidades)),
    [ventana, metrica]
  );

  const volumenes = useMemo(
    () =>
      ventana.map((p) =>
        Math.abs(metrica === 'capital' ? p.deltaCLP : p.deltaUnidades)
      ),
    [ventana, metrica]
  );

  if (ventana.length === 0) {
    return (
      <View
        style={[
          s.tarjeta,
          { backgroundColor: paleta.superficie, borderColor: paleta.borde },
        ]}
      >
        <Text style={[s.kicker, { color: paleta.textoSecundario }]}>
          EVOLUCIÓN DE CAPITAL · GRÁFICO FINANCIERO
        </Text>
        <Text style={[s.vacioTxt, { color: paleta.textoTerciario }]}>
          Registra al menos un movimiento de entrada o salida para ver la curva de evolución
          financiera de tu bodega.
        </Text>
      </View>
    );
  }

  const idxSel =
    indiceActivo !== null && indiceActivo >= 0 && indiceActivo < ventana.length
      ? indiceActivo
      : ventana.length - 1;
  const puntoSel = ventana[idxSel]!;
  const valApertura = valores[0] ?? 0;
  const valCierre = valores[valores.length - 1] ?? 0;
  const valSel = valores[idxSel] ?? valCierre;

  const deltaPeriodo = valSel - valApertura;
  const pctPeriodo =
    valApertura > 0
      ? (deltaPeriodo / valApertura) * 100
      : deltaPeriodo > 0
        ? 100
        : 0;
  const esAlcista = deltaPeriodo >= 0;

  const colorLinea = esAlcista ? paleta.verde : paleta.rojo;
  const colorArea = esAlcista ? 'rgba(22, 163, 74, 0.14)' : 'rgba(220, 38, 38, 0.14)';
  const colorBadgeBg = esAlcista ? paleta.verdeSuave : paleta.rojoSuave;

  const minRaw = Math.min(...valores);
  const maxRaw = Math.max(...valores);
  const amplitud = maxRaw - minRaw;
  const minY = amplitud === 0 ? Math.max(0, minRaw * 0.8) : Math.max(0, minRaw - amplitud * 0.1);
  const maxY = amplitud === 0 ? Math.max(1, maxRaw * 1.15) : maxRaw + amplitud * 0.1;
  const rangoY = Math.max(1, maxY - minY);
  const maxVol = Math.max(1, ...volumenes);

  const altoUtil = ALTURA_LIENZO - PADDING_SUP - PADDING_INF;
  const yDe = (v: number) => PADDING_SUP + altoUtil * (1 - (v - minY) / rangoY);

  const pasoX =
    ventana.length > 1 && anchoLienzo > 0 ? anchoLienzo / (ventana.length - 1) : 0;

  const coordenadas = ventana.map((_, i) => ({
    x: ventana.length === 1 ? anchoLienzo / 2 : i * pasoX,
    y: yDe(valores[i] ?? 0),
  }));

  const ticksY = [
    maxY,
    minY + rangoY * 0.66,
    minY + rangoY * 0.33,
    minY,
  ];

  const yApertura = yDe(valApertura);
  const puntoInicio = ventana[0]!;
  const puntoMedio = ventana[Math.floor((ventana.length - 1) / 2)]!;
  const puntoFin = ventana[ventana.length - 1]!;

  return (
    <View
      style={[
        s.tarjeta,
        { backgroundColor: paleta.superficie, borderColor: paleta.borde },
      ]}
    >
      {/* Cabecera tipo terminal financiera */}
      <View style={s.filaTop}>
        <View style={{ flex: 1 }}>
          <Text style={[s.kicker, { color: paleta.textoTerciario }]}>
            EVOLUCIÓN DE BODEGA · GRÁFICO FINANCIERO
          </Text>
          <View style={s.filaPrecio}>
            <Text style={[s.precioPrincipal, { color: paleta.texto }]}>
              {metrica === 'capital'
                ? formatearCLP(valSel)
                : `${valSel.toLocaleString('es-CL')} u.`}
            </Text>
            <View style={[s.badgeDelta, { backgroundColor: colorBadgeBg }]}>
              <Ionicons
                name={esAlcista ? 'trending-up' : 'trending-down'}
                size={13}
                color={colorLinea}
              />
              <Text style={[s.txtDelta, { color: colorLinea }]}>
                {deltaPeriodo >= 0 ? '+' : ''}
                {metrica === 'capital'
                  ? formatearCLP(deltaPeriodo)
                  : `${deltaPeriodo.toLocaleString('es-CL')} u.`}{' '}
                ({pctPeriodo >= 0 ? '+' : ''}
                {pctPeriodo.toFixed(1)}%)
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Selectores de métrica y ventana */}
      <View style={s.barraControles}>
        <View style={[s.grupoPills, { backgroundColor: paleta.inputFondo }]}>
          <Pressable
            onPress={() => setMetrica('capital')}
            style={[
              s.pill,
              metrica === 'capital' && { backgroundColor: paleta.superficie },
            ]}
          >
            <Text
              style={[
                s.pillTxt,
                { color: metrica === 'capital' ? paleta.acento : paleta.textoSecundario },
              ]}
            >
              Capital CLP
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMetrica('unidades')}
            style={[
              s.pill,
              metrica === 'unidades' && { backgroundColor: paleta.superficie },
            ]}
          >
            <Text
              style={[
                s.pillTxt,
                { color: metrica === 'unidades' ? paleta.acento : paleta.textoSecundario },
              ]}
            >
              Unidades
            </Text>
          </Pressable>
        </View>

        <View style={[s.grupoPills, { backgroundColor: paleta.inputFondo }]}>
          {(['10', '25', 'TODO'] as const).map((r) => {
            const activo = rango === r;
            return (
              <Pressable
                key={r}
                onPress={() => setRango(r)}
                style={[
                  s.pillMini,
                  activo && { backgroundColor: paleta.acento },
                ]}
              >
                <Text
                  style={[
                    s.pillMiniTxt,
                    { color: activo ? '#FFFFFF' : paleta.textoSecundario },
                  ]}
                >
                  {r === 'TODO' ? 'Todo' : `${r}M`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Franja de inspección explícita del punto seleccionado */}
      <View
        style={[
          s.stripInspector,
          { backgroundColor: paleta.superficieElevada, borderColor: paleta.borde },
        ]}
      >
        <View style={s.inspectorTop}>
          <Text style={[s.inspectorFecha, { color: paleta.textoSecundario }]}>
            {formatearHoraCorta(puntoSel.fecha)} · Mov #{idxSel + 1}/{ventana.length}
          </Text>
          <Text
            style={[
              s.inspectorDelta,
              {
                color:
                  puntoSel.deltaUnidades > 0
                    ? paleta.verde
                    : puntoSel.deltaUnidades < 0
                      ? paleta.rojo
                      : paleta.textoTerciario,
              },
            ]}
          >
            {puntoSel.deltaUnidades > 0
              ? `▲ +${puntoSel.deltaUnidades} u. (+${formatearCLP(puntoSel.deltaCLP)})`
              : puntoSel.deltaUnidades < 0
                ? `▼ ${puntoSel.deltaUnidades} u. (${formatearCLP(puntoSel.deltaCLP)})`
                : 'Apertura'}
          </Text>
        </View>
        <Text style={[s.inspectorProducto, { color: paleta.texto }]} numberOfLines={1}>
          {puntoSel.producto} ·{' '}
          <Text style={{ color: paleta.textoSecundario, fontWeight: '500' }}>
            {puntoSel.nota}
          </Text>
        </Text>
      </View>

      {/* Área del gráfico: Eje Y + Lienzo interactivo */}
      <View style={s.bloqueGrafico}>
        {/* Eje Y */}
        <View style={s.ejeY}>
          {ticksY.map((t, i) => (
            <Text key={i} style={[s.lblEjeY, { color: paleta.textoTerciario }]} numberOfLines={1}>
              {formatearCompacto(t, metrica)}
            </Text>
          ))}
        </View>

        {/* Lienzo de curva + área + volumen + crosshair */}
        <View
          style={[s.lienzo, { borderColor: paleta.separador }]}
          onLayout={(e) => setAnchoLienzo(e.nativeEvent.layout.width)}
        >
          {/* Grilla horizontal */}
          {[0, 0.33, 0.66, 1].map((frac, i) => (
            <View
              key={`g-${i}`}
              style={[
                s.lineaGrilla,
                {
                  top: PADDING_SUP + altoUtil * frac,
                  borderBottomColor: paleta.separador,
                },
              ]}
            />
          ))}

          {/* Línea de referencia de apertura */}
          <View
            style={[
              s.lineaApertura,
              {
                top: yApertura,
                borderBottomColor: paleta.textoTerciario,
              },
            ]}
          />

          {/* Relleno de área bajo la curva + barras de volumen */}
          {anchoLienzo > 0
            ? coordenadas.map((pt, i) => {
                const anchoCol = Math.max(4, pasoX > 0 ? pasoX : anchoLienzo / 2);
                const leftCol = Math.max(0, pt.x - anchoCol / 2);
                const altoArea = Math.max(2, PADDING_SUP + altoUtil - pt.y);
                const vol = volumenes[i] ?? 0;
                const altoVol = Math.max(2, Math.round((vol / maxVol) * (PADDING_INF - 6)));
                const esEntrada = (ventana[i]?.tipo ?? 'IN') === 'IN';
                return (
                  <React.Fragment key={`col-${i}`}>
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: leftCol,
                        top: pt.y,
                        width: Math.min(anchoCol, anchoLienzo - leftCol),
                        height: altoArea,
                        backgroundColor: colorArea,
                      }}
                    />
                    {/* Barra mini de volumen en la base */}
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: Math.max(0, pt.x - Math.min(4, anchoCol * 0.3)),
                        bottom: 2,
                        width: Math.max(3, Math.min(8, anchoCol * 0.55)),
                        height: altoVol,
                        borderRadius: 2,
                        backgroundColor: esEntrada
                          ? 'rgba(22, 163, 74, 0.45)'
                          : 'rgba(220, 38, 38, 0.45)',
                      }}
                    />
                  </React.Fragment>
                );
              })
            : null}

          {/* Segmentos continuos de la línea principal */}
          {anchoLienzo > 0
            ? coordenadas.map((pt, i) => {
                const sig = coordenadas[i + 1];
                if (!sig) return null;
                const dx = sig.x - pt.x;
                const dy = sig.y - pt.y;
                const longitud = Math.hypot(dx, dy);
                if (longitud < 0.5) return null;
                const angulo = Math.atan2(dy, dx);
                const cx = (pt.x + sig.x) / 2;
                const cy = (pt.y + sig.y) / 2;
                const grosor = 2.6;
                return (
                  <View
                    key={`seg-${i}`}
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: cx - longitud / 2,
                      top: cy - grosor / 2,
                      width: longitud,
                      height: grosor,
                      borderRadius: 2,
                      backgroundColor: colorLinea,
                      transform: [{ rotate: `${angulo}rad` }],
                    }}
                  />
                );
              })
            : null}

          {/* Crosshair vertical y nodo resaltado en el punto activo */}
          {anchoLienzo > 0 && coordenadas[idxSel] ? (
            <>
              <View
                pointerEvents="none"
                style={[
                  s.crosshairV,
                  {
                    left: coordenadas[idxSel]!.x,
                    borderLeftColor: colorLinea,
                  },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  s.nodoHalo,
                  {
                    left: coordenadas[idxSel]!.x - 9,
                    top: coordenadas[idxSel]!.y - 9,
                    backgroundColor: colorBadgeBg,
                    borderColor: colorLinea,
                  },
                ]}
              >
                <View style={[s.nodoCentro, { backgroundColor: colorLinea }]} />
              </View>
            </>
          ) : null}

          {/* Zonas táctiles por columna para inspeccionar cualquier punto */}
          {anchoLienzo > 0 ? (
            <View style={s.capaTactil}>
              {ventana.map((p, i) => (
                <Pressable
                  key={`tap-${p.id}-${i}`}
                  style={s.columnaTactil}
                  onPress={() => setIndiceActivo(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Inspeccionar movimiento ${i + 1}: ${p.producto}`}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {/* Eje X de fechas */}
      <View style={s.ejeX}>
        <Text style={[s.lblEjeX, { color: paleta.textoTerciario }]}>
          {formatearHoraCorta(puntoInicio.fecha)}
        </Text>
        <Text style={[s.lblEjeX, { color: paleta.textoTerciario }]}>
          {formatearHoraCorta(puntoMedio.fecha)}
        </Text>
        <Text style={[s.lblEjeX, { color: paleta.textoTerciario }]}>
          {formatearHoraCorta(puntoFin.fecha)}
        </Text>
      </View>

      {/* Resumen estadístico de sesión (Apertura / Máximo / Mínimo / Cierre) */}
      <View style={[s.gridStats, { borderTopColor: paleta.separador }]}>
        <View style={s.statItem}>
          <Text style={[s.statLbl, { color: paleta.textoTerciario }]}>APERTURA</Text>
          <Text style={[s.statVal, { color: paleta.texto }]}>
            {formatearCompacto(valApertura, metrica)}
          </Text>
        </View>
        <View style={s.statItem}>
          <Text style={[s.statLbl, { color: paleta.textoTerciario }]}>MÁXIMO</Text>
          <Text style={[s.statVal, { color: paleta.verde }]}>
            {formatearCompacto(maxRaw, metrica)}
          </Text>
        </View>
        <View style={s.statItem}>
          <Text style={[s.statLbl, { color: paleta.textoTerciario }]}>MÍNIMO</Text>
          <Text style={[s.statVal, { color: paleta.rojo }]}>
            {formatearCompacto(minRaw, metrica)}
          </Text>
        </View>
        <View style={s.statItem}>
          <Text style={[s.statLbl, { color: paleta.textoTerciario }]}>ACTUAL</Text>
          <Text style={[s.statVal, { color: paleta.acento }]}>
            {formatearCompacto(valCierre, metrica)}
          </Text>
        </View>
      </View>

      <Text style={[s.ayudaTap, { color: paleta.textoTerciario }]}>
        Toca cualquier punto de la curva para inspeccionar fecha, variación y movimiento.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  tarjeta: {
    borderRadius: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 11,
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  vacioTxt: { fontSize: 13, lineHeight: 19 },
  filaTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  filaPrecio: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  precioPrincipal: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  badgeDelta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  txtDelta: {
    fontSize: 11.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  barraControles: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  grupoPills: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pillTxt: { fontSize: 12, fontWeight: '700' },
  pillMini: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pillMiniTxt: { fontSize: 11.5, fontWeight: '800' },
  stripInspector: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 8,
    gap: 3,
  },
  inspectorTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  inspectorFecha: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  inspectorDelta: { fontSize: 11.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  inspectorProducto: { fontSize: 12.5, fontWeight: '700' },
  bloqueGrafico: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: ALTURA_LIENZO,
    gap: 6,
  },
  ejeY: {
    width: 52,
    paddingTop: PADDING_SUP - 6,
    paddingBottom: PADDING_INF - 4,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  lblEjeY: { fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'] },
  lienzo: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  lineaGrilla: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lineaApertura: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.45,
  },
  crosshairV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.65,
  },
  nodoHalo: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodoCentro: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  capaTactil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
  },
  columnaTactil: {
    flex: 1,
    height: '100%',
  },
  ejeX: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 58,
    marginTop: -4,
  },
  lblEjeX: { fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'] },
  gridStats: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 6,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statLbl: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4 },
  statVal: { fontSize: 12.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ayudaTap: { fontSize: 11, textAlign: 'center', marginTop: -2 },
});
