import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { BarraSubpantalla } from '../components/BarraSubpantalla';
import { Boton } from '../components/Boton';
import { Cargando } from '../components/Estados';
import {
  correrMedicion,
  limpiarMedicion,
  N_PRODUCTOS,
  type ResultadoBench,
} from '../bench/medicion';
import { useTema } from '../theme';

/**
 * Diagnóstico de rendimiento M1, M2 y M3 accesible desde Ajustes.
 */
export function PantallaMedicion({
  onVolver,
  arranqueMs,
  muestrasM2,
}: {
  onVolver: () => void;
  arranqueMs: number | null;
  muestrasM2: number[];
}) {
  const db = useSQLiteContext();
  const { paleta } = useTema();
  const [fase, setFase] = useState<'inicio' | 'corriendo' | 'listo' | 'error'>('inicio');
  const [res, setRes] = useState<ResultadoBench[]>([]);
  const [msg, setMsg] = useState('');

  const correr = async () => {
    setFase('corriendo');
    try {
      setRes(await correrMedicion(db));
      setFase('listo');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error en la medición.');
      setFase('error');
    }
  };

  if (fase === 'corriendo') {
    return <Cargando texto={`Sembrando ${N_PRODUCTOS.toLocaleString('es-CL')} productos y midiendo…`} />;
  }

  const sqlite = res.find((r) => r.motor === 'SQLite');
  const asyncS = res.find((r) => r.motor === 'AsyncStorage');
  const factor = sqlite && asyncS && sqlite.p95 > 0 ? asyncS.p95 / sqlite.p95 : null;
  const promedioM2 =
    muestrasM2.length > 0
      ? muestrasM2.reduce((acc, v) => acc + v, 0) / muestrasM2.length
      : null;

  return (
    <View style={[s.raiz, { backgroundColor: paleta.fondo }]}>
      <BarraSubpantalla
        titulo="Diagnóstico y benchmark"
        subtitulo="Telemetría M1 · M2 · M3"
        onVolver={onVolver}
      />

      <ScrollView contentContainerStyle={s.cont}>
        <View
          style={[
            s.tarjeta,
            { backgroundColor: paleta.superficie, borderColor: paleta.borde },
          ]}
        >
          <Text style={[s.kicker, { color: paleta.textoSecundario }]}>
            ENTORNO DE EJECUCIÓN DETECTADO
          </Text>
          <Text style={[s.entorno, { color: paleta.texto }]}>
            {Platform.OS === 'ios' ? 'iOS' : 'Android'} {String(Platform.Version)} ·{' '}
            {__DEV__ ? 'Modo Desarrollo (Expo Go / Metro)' : 'Binario Release'}
          </Text>
          {__DEV__ ? (
            <View style={[s.aviso, { backgroundColor: paleta.ambarSuave }]}>
              <Text style={[s.avisoTxt, { color: paleta.ambar }]}>
                En Expo Go (__DEV__) ambos motores comparten el mismo hardware real y sobrecarga JS,
                por lo que la razón relativa entre SQLite y AsyncStorage es reproducible.
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={[
            s.tarjeta,
            { backgroundColor: paleta.superficie, borderColor: paleta.borde },
          ]}
        >
          <Text style={[s.kicker, { color: paleta.textoSecundario }]}>
            TELEMETRÍA DE LA SESIÓN ACTUAL
          </Text>
          <View style={s.filaDato}>
            <Text style={[s.lblDato, { color: paleta.texto }]}>M3 · Arranque hasta UI lista</Text>
            <Text style={[s.valDato, { color: paleta.acento }]}>
              {arranqueMs !== null ? `${arranqueMs.toFixed(1)} ms` : '—'}
            </Text>
          </View>
          <View
            style={[
              s.filaDato,
              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: paleta.separador },
            ]}
          >
            <Text style={[s.lblDato, { color: paleta.texto }]}>
              M2 · Consulta tras escaneo ({muestrasM2.length} muestras)
            </Text>
            <Text style={[s.valDato, { color: paleta.acento }]}>
              {promedioM2 !== null ? `${promedioM2.toFixed(2)} ms` : 'Escanea primero'}
            </Text>
          </View>
        </View>

        <View
          style={[
            s.tarjeta,
            { backgroundColor: paleta.superficie, borderColor: paleta.borde },
          ]}
        >
          <Text style={[s.kicker, { color: paleta.textoSecundario }]}>
            PRUEBA M1 · SQLITE VS ASYNCSTORAGE ({N_PRODUCTOS.toLocaleString('es-CL')} SKUS)
          </Text>
          <Text style={[s.parrafo, { color: paleta.textoSecundario }]}>
            Ejecuta 30 búsquedas por código distinto en cada motor sobre 5.000 artículos para medir
            índice B-tree primario frente a lectura y parseo JSON lineal.
          </Text>

          {fase === 'error' ? (
            <Text style={[s.error, { color: paleta.rojo }]}>{msg}</Text>
          ) : null}

          {fase === 'listo' ? (
            <View
              style={[
                s.tabla,
                { borderColor: paleta.borde, backgroundColor: paleta.superficieElevada },
              ]}
            >
              <View style={[s.filaTabla, { borderBottomColor: paleta.separador }]}>
                <Text style={[s.celda, { flex: 1.5, textAlign: 'left', color: paleta.textoTerciario }]}>
                  MOTOR
                </Text>
                <Text style={[s.celda, { color: paleta.textoTerciario }]}>p50</Text>
                <Text style={[s.celda, { color: paleta.textoTerciario }]}>p95</Text>
                <Text style={[s.celda, { color: paleta.textoTerciario }]}>peor</Text>
              </View>
              {res.map((r) => (
                <View
                  key={r.motor}
                  style={[s.filaTabla, { borderBottomColor: paleta.separador }]}
                >
                  <Text
                    style={[
                      s.celda,
                      { flex: 1.5, textAlign: 'left', fontWeight: '800', color: paleta.texto },
                    ]}
                  >
                    {r.motor}
                  </Text>
                  <Text style={[s.celda, { color: paleta.texto }]}>{r.p50.toFixed(2)}</Text>
                  <Text style={[s.celda, { color: paleta.texto, fontWeight: '700' }]}>
                    {r.p95.toFixed(2)}
                  </Text>
                  <Text style={[s.celda, { color: paleta.textoSecundario }]}>
                    {r.peor.toFixed(2)}
                  </Text>
                </View>
              ))}
              {factor ? (
                <Text style={[s.conclusion, { color: paleta.acento }]}>
                  En percentil 95, AsyncStorage tardó {factor.toFixed(1)}× lo que SQLite (ms).
                </Text>
              ) : null}
            </View>
          ) : null}

          <Boton
            titulo={fase === 'listo' ? 'Repetir prueba M1' : 'Ejecutar prueba M1 (5.000 SKUs)'}
            onPress={correr}
          />
          {fase === 'listo' ? (
            <Boton
              titulo="Limpiar tabla temporal de prueba"
              onPress={() => limpiarMedicion(db).then(() => setFase('inicio'))}
              estilo="secundario"
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1 },
  cont: { padding: 16, paddingBottom: 40, gap: 14 },
  tarjeta: {
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  entorno: { fontSize: 15, fontWeight: '700' },
  aviso: { borderRadius: 12, padding: 11 },
  avisoTxt: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  filaDato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  lblDato: { flex: 1, fontSize: 14, fontWeight: '600' },
  valDato: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  parrafo: { fontSize: 14, lineHeight: 20 },
  error: { fontSize: 14, fontWeight: '700' },
  tabla: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  filaTabla: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  celda: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    fontSize: 13,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  conclusion: { padding: 12, fontSize: 14, fontWeight: '800' },
});
