import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Boton } from '../components/Boton';
import { Cargando } from '../components/Estados';
import {
  correrMedicion,
  limpiarMedicion,
  N_PRODUCTOS,
  type ResultadoBench,
} from '../bench/medicion';
import { C } from '../theme';

/**
 * Pantalla de medición M1, M2 y M3. Vive dentro de la app para que los números
 * se tomen directamente en el teléfono físico (iPhone en iOS o equipo Android)
 * sin depender de herramientas externas como adb.
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

  if (fase === 'corriendo')
    return <Cargando texto={`Sembrando ${N_PRODUCTOS} productos y midiendo…`} />;

  const sqlite = res.find((r) => r.motor === 'SQLite');
  const asyncS = res.find((r) => r.motor === 'AsyncStorage');
  const factor = sqlite && asyncS && sqlite.p95 > 0 ? asyncS.p95 / sqlite.p95 : null;
  const promedioM2 =
    muestrasM2.length > 0
      ? muestrasM2.reduce((acc, v) => acc + v, 0) / muestrasM2.length
      : null;

  return (
    <ScrollView style={s.raiz} contentContainerStyle={s.cont}>
      <Text style={s.titulo}>Medición M1 · M2 · M3</Text>
      <Text style={s.parrafo}>
        M1 busca un producto por su código en una bodega de {N_PRODUCTOS.toLocaleString('es-CL')}{' '}
        productos, 30 veces por motor, con un código distinto cada vez. Compara SQLite con clave
        primaria contra AsyncStorage con un arreglo JSON.
      </Text>
      <Text style={s.entorno}>
        Plataforma: {Platform.OS === 'ios' ? 'iOS' : 'Android'} {String(Platform.Version)} · Modo:{' '}
        {__DEV__ ? 'DESARROLLO (Expo Go / Metro)' : 'RELEASE'}
      </Text>

      <View style={s.tabla}>
        <View style={[s.fila, s.cabecera]}>
          <Text style={[s.celda, s.celdaCab, { flex: 1.6, textAlign: 'left' }]}>
            Telemetría de sesión
          </Text>
          <Text style={[s.celda, s.celdaCab]}>Valor</Text>
        </View>
        <View style={s.fila}>
          <Text style={[s.celda, { flex: 1.6, textAlign: 'left', fontWeight: '700' }]}>
            M3 · Arranque hasta UI lista
          </Text>
          <Text style={s.celda}>
            {arranqueMs !== null ? `${arranqueMs.toFixed(1)} ms` : '—'}
          </Text>
        </View>
        <View style={s.fila}>
          <Text style={[s.celda, { flex: 1.6, textAlign: 'left', fontWeight: '700' }]}>
            M2 · Consulta tras escaneo ({muestrasM2.length} muestras)
          </Text>
          <Text style={s.celda}>
            {promedioM2 !== null ? `${promedioM2.toFixed(2)} ms` : 'Escanea primero'}
          </Text>
        </View>
      </View>

      {__DEV__ ? (
        <Text style={s.advertencia}>
          Estás en modo desarrollo ({Platform.OS === 'ios' ? 'Expo Go en iPhone' : 'Expo Go / emulador'}).
          Registra explícitamente este entorno en el informe: en modo desarrollo el motor JS tiene
          sobrecarga adicional, aunque la razón relativa entre SQLite y AsyncStorage se mantiene
          sobre el hardware real.
        </Text>
      ) : null}

      {fase === 'error' ? <Text style={s.error}>{msg}</Text> : null}

      {fase === 'listo' ? (
        <View style={s.tabla}>
          <View style={[s.fila, s.cabecera]}>
            <Text style={[s.celda, s.celdaCab, { flex: 1.4, textAlign: 'left' }]}>Motor</Text>
            <Text style={[s.celda, s.celdaCab]}>p50</Text>
            <Text style={[s.celda, s.celdaCab]}>p95</Text>
            <Text style={[s.celda, s.celdaCab]}>peor</Text>
          </View>
          {res.map((r) => (
            <View key={r.motor} style={s.fila}>
              <Text style={[s.celda, { flex: 1.4, textAlign: 'left', fontWeight: '800' }]}>
                {r.motor}
              </Text>
              <Text style={s.celda}>{r.p50.toFixed(2)}</Text>
              <Text style={s.celda}>{r.p95.toFixed(2)}</Text>
              <Text style={s.celda}>{r.peor.toFixed(2)}</Text>
            </View>
          ))}
          <Text style={s.pie}>Tiempos en milisegundos · 30 muestras por motor</Text>
          {factor ? (
            <Text style={s.conclusion}>
              En p95, AsyncStorage tarda {factor.toFixed(1)} veces lo que SQLite.
            </Text>
          ) : null}
        </View>
      ) : null}

      <Boton titulo={fase === 'listo' ? 'Repetir medición M1' : 'Correr medición M1'} onPress={correr} />
      {fase === 'listo' ? (
        <Boton
          titulo="Borrar datos de prueba"
          onPress={() => limpiarMedicion(db).then(() => setFase('inicio'))}
          estilo="secundario"
        />
      ) : null}
      <Boton titulo="Volver" onPress={onVolver} estilo="secundario" />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.fondo },
  cont: { padding: 18, paddingBottom: 40, gap: 10 },
  titulo: { fontSize: 22, fontWeight: '900', color: C.navy },
  parrafo: { fontSize: 15, color: C.gris, lineHeight: 22 },
  entorno: { fontSize: 13, color: C.navy, fontWeight: '700' },
  advertencia: {
    backgroundColor: '#fff7ed',
    borderLeftWidth: 4,
    borderLeftColor: C.ambar,
    borderRadius: 8,
    padding: 10,
    color: '#b45309',
    fontSize: 13,
    lineHeight: 19,
  },
  error: { color: C.rojo, fontWeight: '700' },
  tabla: {
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.linea,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 6,
  },
  fila: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.linea },
  cabecera: { backgroundColor: C.navy },
  celda: {
    flex: 1,
    padding: 9,
    fontSize: 13,
    color: C.navy,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  celdaCab: { color: '#fff', fontWeight: '800' },
  pie: { padding: 9, fontSize: 12, color: C.gris },
  conclusion: { padding: 10, fontSize: 15, fontWeight: '800', color: C.azulOscuro },
});
