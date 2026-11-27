import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { listarMovimientosGlobales, type Movimiento } from '../db/inventario';
import { formatearFechaHoraSlash, formatearFechaSlash } from '../lib/periodo';
import { useTema } from '../theme';
import { Boton } from './Boton';

export function ElegirEntradaCorreccion({
  codigo,
  seleccion,
  diferencia,
  onElegir,
}: {
  codigo: string;
  seleccion: Movimiento | null;
  diferencia: number;
  onElegir: (m: Movimiento) => void;
}) {
  const db = useSQLiteContext();
  const { paleta: c } = useTema();
  const [entradas, setEntradas] = useState<Movimiento[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [hayMas, setHayMas] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [reintento, setReintento] = useState(0);
  const generacion = useRef(0);
  const cargando = useRef(false);

  useEffect(() => {
    const n = ++generacion.current;
    cargando.current = true;
    setOcupado(true);
    setError('');
    setEntradas([]);
    listarMovimientosGlobales(db, { tipo: 'IN', codigo, limite: 51 })
      .then((filas) => {
        if (n !== generacion.current) return;
        const lista = filas.slice(0, 50);
        setEntradas(lista);
        setHayMas(filas.length > 50);
        // Autoselecciona la entrada reciente compatible para evitar pasos extra
        if (!seleccion && lista.length > 0) {
          const compatible = lista.find((m) => m.cantidad + diferencia >= 0) ?? lista[0];
          if (compatible) onElegir(compatible);
        }
      })
      .catch((e) => {
        if (n === generacion.current) {
          setError(e instanceof Error ? e.message : 'No se pudieron consultar las entradas.');
        }
      })
      .finally(() => {
        if (n === generacion.current) {
          cargando.current = false;
          setOcupado(false);
        }
      });
    return () => {
      generacion.current++;
    };
  }, [db, codigo, reintento]);

  const mas = async () => {
    const ultimo = entradas.at(-1);
    if (!ultimo || cargando.current) return;
    cargando.current = true;
    setOcupado(true);
    setError('');
    const n = generacion.current;
    try {
      const filas = await listarMovimientosGlobales(db, {
        tipo: 'IN',
        codigo,
        limite: 51,
        antesDe: { fecha: ultimo.fecha, id: ultimo.id },
      });
      if (n === generacion.current) {
        setEntradas((prev) => [...prev, ...filas.slice(0, 50)]);
        setHayMas(filas.length > 50);
      }
    } catch (e) {
      if (n === generacion.current) {
        setError(e instanceof Error ? e.message : 'No se pudo continuar.');
      }
    } finally {
      if (n === generacion.current) {
        cargando.current = false;
        setOcupado(false);
      }
    }
  };

  const cantidadFinal = seleccion ? seleccion.cantidad + diferencia : 0;
  const esInvalida = seleccion !== null && cantidadFinal < 0;

  return (
    <View style={s.contenedor}>
      <Text style={[s.ayuda, { color: c.textoSecundario }]}>
        Corrige una entrada equivocada: ajusta la cantidad original de esa recepción y el stock
        actual, sin registrar ninguna salida.
      </Text>

      {seleccion ? (
        <View
          style={[
            s.tarjetaSel,
            {
              backgroundColor: esInvalida ? c.rojoSuave : c.acentoSuave,
              borderColor: esInvalida ? c.rojo : c.acento,
            },
          ]}
        >
          <View style={s.filaTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Ionicons
                name={esInvalida ? 'alert-circle' : 'checkmark-circle'}
                size={16}
                color={esInvalida ? c.rojo : c.acento}
              />
              <Text style={[s.selTitulo, { color: c.texto }]}>
                Entrada #{seleccion.id} · {formatearFechaSlash(seleccion.fecha)}
              </Text>
            </View>
            {entradas.length > 1 ? (
              <Pressable onPress={() => setAbierto((v) => !v)} hitSlop={8}>
                <Text style={[s.linkCambiar, { color: c.acento }]}>
                  {abierto ? 'Ocultar' : 'Cambiar'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Text
            style={[
              s.selCambio,
              { color: esInvalida ? c.rojo : c.acento },
            ]}
          >
            Entrada: {seleccion.cantidad} u. → {cantidadFinal} u.
          </Text>

          <Text style={[s.selNota, { color: esInvalida ? c.rojo : c.textoSecundario }]}>
            {esInvalida
              ? 'Esta entrada no alcanza para esa reducción. Elige otra entrada o usa "Ajuste directo".'
              : 'Se actualiza el total de entradas y el stock. Las salidas quedan en $ 0 sin cambios.'}
          </Text>
        </View>
      ) : !ocupado && !entradas.length && !error ? (
        <View style={[s.vacioBox, { backgroundColor: c.inputFondo }]}>
          <Text style={[s.ayuda, { color: c.textoSecundario }]}>
            Este producto aún no tiene entradas registradas. Usa la pestaña{' '}
            <Text style={{ fontWeight: '800', color: c.texto }}>Ajuste directo</Text> para cambiar
            el stock.
          </Text>
        </View>
      ) : (
        <Boton
          estilo="secundario"
          compacto
          titulo={ocupado ? 'Buscando entradas…' : 'Elegir entrada a corregir'}
          onPress={() => setAbierto((v) => !v)}
        />
      )}

      {abierto ? (
        <View style={[s.listaBox, { borderColor: c.borde, backgroundColor: c.superficie }]}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 210 }}>
            {entradas.map((m) => {
              const activa = seleccion?.id === m.id;
              return (
                <Pressable
                  key={m.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activa }}
                  onPress={() => {
                    onElegir(m);
                    setAbierto(false);
                  }}
                  style={[
                    s.filaLista,
                    {
                      borderBottomColor: c.separador,
                      backgroundColor: activa ? c.acentoSuave : 'transparent',
                    },
                  ]}
                >
                  <View style={s.filaTop}>
                    <Text style={[s.listaTitulo, { color: c.texto }]}>
                      Entrada #{m.id} · {m.cantidad} u.
                    </Text>
                    {activa ? (
                      <Ionicons name="checkmark" size={16} color={c.acento} />
                    ) : null}
                  </View>
                  <Text style={[s.listaMeta, { color: c.textoSecundario }]}>
                    {formatearFechaHoraSlash(m.fecha)} · {m.nota || 'Sin nota'}
                  </Text>
                </Pressable>
              );
            })}
            {hayMas ? (
              <View style={{ padding: 10 }}>
                <Boton
                  titulo="Cargar más entradas"
                  estilo="secundario"
                  compacto
                  deshabilitado={ocupado}
                  onPress={mas}
                />
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      {error ? (
        <>
          <Text accessibilityRole="alert" style={{ color: c.rojo, fontSize: 13 }}>
            {error}
          </Text>
          <Boton
            titulo="Reintentar entradas"
            estilo="secundario"
            compacto
            onPress={() => setReintento((v) => v + 1)}
          />
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  contenedor: { gap: 10 },
  ayuda: { fontSize: 12.5, lineHeight: 18 },
  tarjetaSel: {
    padding: 12,
    gap: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  filaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selTitulo: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  linkCambiar: { fontSize: 12.5, fontWeight: '800' },
  selCambio: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  selNota: { fontSize: 12, lineHeight: 17 },
  vacioBox: { padding: 12, borderRadius: 12 },
  listaBox: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  filaLista: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listaTitulo: { fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  listaMeta: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
