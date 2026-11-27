import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import type { Evolucion, PuntoEvolucion } from '../db/evolucion';
import { useTema } from '../theme';
import { SelectorSegmentado } from './SelectorSegmentado';

const fecha = (n: number) => new Date(n).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const intervalo = (p: PuntoEvolucion) => `${fecha(p.desde)} — ${fecha(p.hasta - 1)}`;

export function GraficoEvolucion({ datos }: { datos: Evolucion }) {
  const { paleta: c } = useTema();
  const [ancho, setAncho] = useState(280);
  const [indice, setIndice] = useState<number | null>(null);
  const [tabla, setTabla] = useState(false);
  const [tipo, setTipo] = useState<'entradas' | 'salidas'>('entradas');
  const color = tipo === 'entradas' ? c.verde : c.salida;
  const etiqueta = tipo === 'entradas' ? 'Entradas' : 'Salidas';
  const { puntos } = datos;
  const i = Math.max(0, Math.min(indice ?? puntos.length - 1, puntos.length - 1));
  const seleccionado = puntos[i];
  const izquierda = 46, derecha = Math.max(izquierda + 1, ancho - 12), arriba = 14, abajo = 184;
  const maximo = Math.max(1, ...puntos.map((p) => p[tipo]));
  const techo = maximo <= 4 ? 4 : Math.ceil(maximo / 4) * 4;
  const x = (n: number) => puntos.length <= 1 ? (izquierda + derecha) / 2 : izquierda + n * (derecha - izquierda) / (puntos.length - 1);
  const y = (n: number) => abajo - n / techo * (abajo - arriba);
  const elegir = (px: number) => setIndice(Math.max(0, Math.min(puntos.length - 1, Math.round((px - izquierda) / (derecha - izquierda) * (puntos.length - 1)))));
  return <View style={{ backgroundColor: c.superficie, borderColor: c.borde, borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 }}>
    <Text style={{ color: c.texto, fontSize: 19, fontWeight: '800' }}>Evolución por fecha</Text>
    <SelectorSegmentado valor={tipo} onChange={setTipo} opciones={[
      { valor: 'entradas', etiqueta: 'Entradas' }, { valor: 'salidas', etiqueta: 'Salidas' },
    ]} />
    <Text style={{ color, fontWeight: '800', fontSize: 18 }}>{etiqueta} · unidades por {datos.agrupacion}</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {['Gráfico', 'Tabla'].map((nombre, j) => <Pressable key={nombre} accessibilityRole="button" accessibilityState={{ selected: tabla === !!j }}
        onPress={() => setTabla(!!j)} style={{ minHeight: 44, padding: 12, borderBottomWidth: tabla === !!j ? 2 : 0, borderColor: c.acento }}>
        <Text style={{ color: tabla === !!j ? c.acento : c.textoSecundario, fontWeight: '700' }}>{nombre}</Text>
      </Pressable>)}
    </View>
    <Text style={{ color: c.textoSecundario }}>Cada punto muestra cuánto {tipo === 'entradas' ? 'entró' : 'salió'} en ese intervalo. Los totales de arriba corresponden al período completo.</Text>
    {!puntos.length ? <Text style={{ color: c.textoSecundario }}>No hay entradas ni salidas registradas.</Text> : tabla ?
      <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled>
        <Text style={{ color: c.texto, fontWeight: '700', marginBottom: 10 }}>Fecha · {etiqueta} (u.)</Text>
        {puntos.map((p) => <View key={p.desde} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: c.borde, gap: 4 }}>
          <Text style={{ color: c.texto }}>{intervalo(p)}</Text>
          <Text style={{ color }}>{etiqueta}: {p[tipo].toLocaleString('es-CL')} u.</Text>
        </View>)}
      </ScrollView> : <>
      <View accessibilityLiveRegion="polite" style={{ backgroundColor: c.inputFondo, borderRadius: 12, padding: 12, gap: 4 }}>
        <Text style={{ color: c.texto, fontWeight: '700' }}>{seleccionado ? intervalo(seleccionado) : ''}</Text>
        <Text style={{ color, fontSize: 20, fontWeight: '800' }}>{etiqueta}: {seleccionado?.[tipo].toLocaleString('es-CL')} u.</Text>
      </View>
      <View onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => elegir(e.nativeEvent.locationX)} onResponderMove={(e) => elegir(e.nativeEvent.locationX)}
        accessibilityLabel={`Evolución de ${etiqueta.toLowerCase()}. Usa Tabla para consultar todos los valores.`}>
        <Svg width={ancho} height={222} pointerEvents="none">
          {[0, 1, 2, 3, 4].map((n) => <React.Fragment key={n}>
            <Line x1={izquierda} x2={derecha} y1={y(n * techo / 4)} y2={y(n * techo / 4)} stroke={c.borde} />
            <SvgText x={izquierda - 6} y={y(n * techo / 4) + 4} textAnchor="end" fill={c.textoSecundario} fontSize={10}>{Intl.NumberFormat('es-CL', { notation: 'compact' }).format(n * techo / 4)}</SvgText>
          </React.Fragment>)}
          <Polyline points={puntos.map((p, j) => `${x(j)},${y(p[tipo])}`).join(' ')} fill="none" stroke={color} strokeWidth={3} />
          <Line x1={x(i)} x2={x(i)} y1={arriba} y2={abajo} stroke={c.acento} strokeDasharray="4 4" />
          {seleccionado ? <Circle cx={x(i)} cy={y(seleccionado[tipo])} r={5} fill={color} /> : null}
          {[0, Math.floor((puntos.length - 1) / 2), puntos.length - 1].filter((v, j, a) => a.indexOf(v) === j).map((j, k) => <SvgText key={j} x={x(j)} y={210} textAnchor={k === 0 ? 'start' : j === puntos.length - 1 ? 'end' : 'middle'} fill={c.textoSecundario} fontSize={10}>{fecha(puntos[j]!.desde)}</SvgText>)}
        </Svg>
      </View>
      <Text style={{ color: c.textoTerciario, fontSize: 12 }}>Toca o desliza sobre el gráfico para consultar una fecha.</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        {[-1, 1].map((paso) => <Pressable key={paso} accessibilityRole="button" disabled={i + paso < 0 || i + paso >= puntos.length}
          onPress={() => setIndice(i + paso)} style={{ padding: 12, minHeight: 44 }}>
          <Text style={{ color: i + paso < 0 || i + paso >= puntos.length ? c.textoTerciario : c.acento }}>{paso < 0 ? '‹ Fecha anterior' : 'Fecha siguiente ›'}</Text>
        </Pressable>)}
      </View>
    </>}
  </View>;
}
