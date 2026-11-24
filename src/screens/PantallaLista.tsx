import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Boton } from '../components/Boton';
import { Cargando, ErrorEstado, Vacio } from '../components/Estados';
import { FilaProducto } from '../components/FilaProducto';
import { contarStockBajo, listarProductos, type Producto } from '../db/inventario';
import { C } from '../theme';

type Carga =
  | { fase: 'cargando' }
  | { fase: 'error'; mensaje: string }
  | { fase: 'listo'; datos: Producto[]; bajos: number };

export function PantallaLista({
  onEscanear,
  onAbrirProducto,
  onManual,
  onMedicion,
}: {
  onEscanear: () => void;
  onAbrirProducto: (p: Producto) => void;
  onManual: () => void;
  onMedicion: () => void;
}) {
  const db = useSQLiteContext();
  const [estado, setEstado] = useState<Carga>({ fase: 'cargando' });
  const [busqueda, setBusqueda] = useState('');
  const [soloBajos, setSoloBajos] = useState(false);

  // La pantalla completa solo se reemplaza por el indicador en la PRIMERA
  // carga. En las recargas se mantienen los datos anteriores en pantalla:
  // si no, el TextInput de búsqueda se desmonta en cada tecleo, el teclado
  // se cierra y escribir una palabra completa se vuelve imposible.
  const primeraCarga = useRef(true);

  const cargar = useCallback(async () => {
    if (primeraCarga.current) setEstado({ fase: 'cargando' });
    try {
      const [datos, bajos] = await Promise.all([
        listarProductos(db, { soloStockBajo: soloBajos, busqueda }),
        contarStockBajo(db),
      ]);
      setEstado({ fase: 'listo', datos, bajos });
      primeraCarga.current = false;
    } catch (e) {
      setEstado({ fase: 'error', mensaje: e instanceof Error ? e.message : 'Error desconocido' });
    }
  }, [db, soloBajos, busqueda]);

  useEffect(() => {
    // 250 ms de espera antes de consultar: evita una consulta por tecla
    // mientras el usuario escribe. Con 5.000 filas la diferencia se nota.
    const t = setTimeout(cargar, busqueda ? 250 : 0);
    return () => clearTimeout(t);
  }, [cargar, busqueda]);

  const extraerClave = useCallback((p: Producto) => p.codigo, []);
  const render = useCallback(
    ({ item }: { item: Producto }) => <FilaProducto producto={item} onPress={onAbrirProducto} />,
    [onAbrirProducto]
  );

  const encabezado = useMemo(
    () => (
      <View>
        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar por nombre o código"
          placeholderTextColor={C.gris}
          style={s.input}
          accessibilityLabel="Buscar producto"
        />
        {estado.fase === 'listo' && estado.bajos > 0 ? (
          <Boton
            titulo={
              soloBajos
                ? 'Ver todos los productos'
                : `Ver solo stock bajo (${estado.bajos})`
            }
            onPress={() => setSoloBajos((v) => !v)}
            estilo={soloBajos ? 'secundario' : 'peligro'}
          />
        ) : null}
      </View>
    ),
    [busqueda, estado, soloBajos]
  );

  if (estado.fase === 'cargando') return <Cargando texto="Abriendo la bodega…" />;
  if (estado.fase === 'error')
    return <ErrorEstado mensaje={estado.mensaje} onReintentar={cargar} />;

  return (
    <View style={s.raiz}>
      {estado.datos.length === 0 && !busqueda && !soloBajos ? (
        <Vacio
          titulo="La bodega está vacía"
          detalle="Escanea el primer producto para darlo de alta."
          accion={{ titulo: 'Escanear', onPress: onEscanear }}
        />
      ) : (
        <FlatList
          data={estado.datos}
          keyExtractor={extraerClave}
          renderItem={render}
          ListHeaderComponent={encabezado}
          // FlatList solo dibuja lo visible; con 5.000 productos un .map()
          // construiría 5.000 vistas y bloquearía el hilo principal.
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.lista}
          ListEmptyComponent={
            <Vacio
              titulo="Sin resultados"
              detalle={
                soloBajos
                  ? 'Ningún producto está bajo su mínimo.'
                  : `Nada coincide con "${busqueda}".`
              }
            />
          }
        />
      )}
      <View style={s.barra}>
        <Boton titulo="📷  Escanear" onPress={onEscanear} ancho="100%" />
        <View style={s.enlaces}>
          <Text style={s.ayuda} onPress={onManual}>
            Código a mano
          </Text>
          <Text style={s.ayuda} onPress={onMedicion}>
            Medir rendimiento
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.fondo },
  lista: { padding: 14, paddingBottom: 24, flexGrow: 1 },
  input: {
    backgroundColor: C.blanco,
    borderWidth: 1.5,
    borderColor: C.linea,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: C.navy,
    marginBottom: 10,
  },
  barra: {
    padding: 14,
    paddingBottom: 22,
    backgroundColor: C.blanco,
    borderTopWidth: 1,
    borderTopColor: C.linea,
    gap: 8,
  },
  enlaces: { flexDirection: 'row', justifyContent: 'center', gap: 22 },
  ayuda: { textAlign: 'center', color: C.azul, fontSize: 14, fontWeight: '600', padding: 6 },
});
