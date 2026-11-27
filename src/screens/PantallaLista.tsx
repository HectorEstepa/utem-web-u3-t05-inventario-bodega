import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Cargando, ErrorEstado, Vacio } from '../components/Estados';
import { FilaProducto } from '../components/FilaProducto';
import { SelectorSegmentado } from '../components/SelectorSegmentado';
import {
  listarProductos,
  obtenerResumenEjecutivo,
  sembrarCatalogoDemo,
  type FiltroEstadoLista,
  type Producto,
} from '../db/inventario';
import { formatearCLP } from '../lib/stock';
import { useTema } from '../theme';

type Carga =
  | { fase: 'cargando' }
  | { fase: 'error'; mensaje: string }
  | {
      fase: 'listo';
      datos: Producto[];
      totalSkus: number;
      criticos: number;
      agotados: number;
      valorCLP: number;
    };

/**
 * Apartado principal de Inventario con estética Apple HIG:
 * - Resumen superior compacto (SKUs, capital valorizado CLP y alertas).
 * - Buscador estilo iOS Spotlight con botón limpiar y debounce de 250 ms.
 * - Control segmentado (Todos · Stock bajo · Agotados).
 * - FlatList virtualizada con acciones rápidas a cámara o ingreso manual.
 */
export function PantallaLista({
  onEscanear,
  onAbrirProducto,
  onManual,
}: {
  onEscanear: () => void;
  onAbrirProducto: (p: Producto) => void;
  onManual: () => void;
}) {
  const db = useSQLiteContext();
  const { paleta } = useTema();
  const [estado, setEstado] = useState<Carga>({ fase: 'cargando' });
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstadoLista>('todos');
  const primeraCarga = useRef(true);
  const ultimaConsulta = useRef(0);

  const cargar = useCallback(async () => {
    const consulta = ++ultimaConsulta.current;
    if (primeraCarga.current) setEstado({ fase: 'cargando' });
    try {
      const [datos, resumen] = await Promise.all([
        listarProductos(db, { filtroEstado: filtro, busqueda }),
        obtenerResumenEjecutivo(db),
      ]);
      if (consulta !== ultimaConsulta.current) return;
      setEstado({
        fase: 'listo',
        datos,
        totalSkus: resumen.totalSkus,
        criticos: resumen.skusCriticos,
        agotados: resumen.skusAgotados,
        valorCLP: resumen.valorInventarioCLP,
      });
      primeraCarga.current = false;
    } catch (e) {
      if (consulta !== ultimaConsulta.current) return;
      setEstado({
        fase: 'error',
        mensaje: e instanceof Error ? e.message : 'Error al abrir el inventario',
      });
    }
  }, [db, filtro, busqueda]);

  useEffect(() => {
    const t = setTimeout(cargar, busqueda ? 250 : 0);
    return () => {
      clearTimeout(t);
      ultimaConsulta.current++;
    };
  }, [cargar, busqueda]);

  const cargarDemo = useCallback(async () => {
    try {
      await sembrarCatalogoDemo(db);
      await cargar();
    } catch (e) {
      setEstado({ fase: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo cargar el catálogo.' });
    }
  }, [db, cargar]);

  const extraerClave = useCallback((p: Producto) => p.codigo, []);
  const render = useCallback(
    ({ item }: { item: Producto }) => <FilaProducto producto={item} onPress={onAbrirProducto} />,
    [onAbrirProducto]
  );

  const encabezado = useMemo(() => {
    if (estado.fase !== 'listo') return undefined;
    return (
      <View style={s.cabecera}>
        <View style={s.filaTitulo}>
          <View>
            <Text style={[s.granTitulo, { color: paleta.texto }]}>Inventario</Text>
            <Text style={[s.subtitulo, { color: paleta.textoSecundario }]}>
              {estado.totalSkus} SKUs · Capital {formatearCLP(estado.valorCLP)}
            </Text>
          </View>
          <View style={s.accionesRapidas}>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                onManual();
              }}
              accessibilityRole="button"
              accessibilityLabel="Ingresar código manualmente"
              style={[
                s.btnPildora,
                { backgroundColor: paleta.superficie, borderColor: paleta.borde },
              ]}
            >
              <Text style={[s.txtPildora, { color: paleta.acento }]}>⌨ Manual</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                onEscanear();
              }}
              accessibilityRole="button"
              accessibilityLabel="Escanear código de barras"
              style={[s.btnPildoraPrimaria, { backgroundColor: paleta.acento }]}
            >
              <Text style={s.txtPildoraPrimaria}>⌗ Escanear</Text>
            </Pressable>
          </View>
        </View>

        {/* Buscador estilo iOS */}
        <View style={[s.barraBusqueda, { backgroundColor: paleta.inputFondo }]}>
          <Text style={[s.lupa, { color: paleta.textoTerciario }]}>⌕</Text>
          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar artículo o código GTIN"
            placeholderTextColor={paleta.textoTerciario}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            style={[s.inputBusqueda, { color: paleta.texto }]}
            accessibilityLabel="Buscar en inventario"
          />
          {busqueda.length > 0 ? (
            <Pressable
              onPress={() => {
                setBusqueda('');
                Keyboard.dismiss();
              }}
              hitSlop={8}
              style={[s.btnClear, { backgroundColor: paleta.textoTerciario }]}
            >
              <Text style={s.txtClear}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        <SelectorSegmentado<FiltroEstadoLista>
          valor={filtro}
          onChange={setFiltro}
          opciones={[
            { valor: 'todos', etiqueta: `Todos (${estado.totalSkus})` },
            { valor: 'bajo', etiqueta: `Críticos (${estado.criticos})` },
            { valor: 'agotado', etiqueta: `Agotados (${estado.agotados})` },
          ]}
        />
      </View>
    );
  }, [estado, paleta, busqueda, filtro, onEscanear, onManual]);

  if (estado.fase === 'cargando') return <Cargando texto="Abriendo catálogo local…" />;
  if (estado.fase === 'error') {
    return <ErrorEstado mensaje={estado.mensaje} onReintentar={cargar} />;
  }

  return (
    <View style={[s.raiz, { backgroundColor: paleta.fondo }]}>
      <FlatList
        data={estado.datos}
        keyExtractor={extraerClave}
        renderItem={render}
        ListHeaderComponent={encabezado}
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={s.lista}
        ListEmptyComponent={
          estado.totalSkus === 0 && !busqueda ? (
            <Vacio
              titulo="Tu bodega aún está vacía"
              detalle="Escanea el código de barras de un producto para registrarlo, o carga un lote demostrativo realista con precios en CLP."
              accion={{ titulo: '⌗ Escanear primer artículo', onPress: onEscanear }}
              accionSecundaria={{ titulo: 'Cargar catálogo de ejemplo', onPress: cargarDemo }}
            />
          ) : (
            <Vacio
              titulo="Sin coincidencias"
              detalle={
                filtro !== 'todos'
                  ? 'No hay productos en este estado de stock.'
                  : `Ningún artículo coincide con "${busqueda}".`
              }
              accion={{
                titulo: 'Mostrar todo el inventario',
                onPress: () => {
                  setBusqueda('');
                  setFiltro('todos');
                },
              }}
            />
          )
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1 },
  lista: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, flexGrow: 1 },
  cabecera: { gap: 12, marginBottom: 14 },
  filaTitulo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  granTitulo: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  subtitulo: { fontSize: 13, fontWeight: '500', marginTop: 2, fontVariant: ['tabular-nums'] },
  accionesRapidas: { flexDirection: 'row', gap: 8 },
  btnPildora: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  txtPildora: { fontSize: 13, fontWeight: '700' },
  btnPildoraPrimaria: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txtPildoraPrimaria: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  barraBusqueda: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 42,
    gap: 8,
  },
  lupa: { fontSize: 18, fontWeight: '600' },
  inputBusqueda: { flex: 1, fontSize: 16, paddingVertical: 8 },
  btnClear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txtClear: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
