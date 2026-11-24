import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { migrar } from './src/db/schema';
import { buscarPorCodigo, type Producto } from './src/db/inventario';
import { Cargando, ErrorEstado } from './src/components/Estados';
import { PantallaDashboard } from './src/screens/PantallaDashboard';
import { PantallaLista } from './src/screens/PantallaLista';
import { PantallaEscaner } from './src/screens/PantallaEscaner';
import { PantallaProducto } from './src/screens/PantallaProducto';
import { PantallaAlta } from './src/screens/PantallaAlta';
import { PantallaManual } from './src/screens/PantallaManual';
import { PantallaMedicion } from './src/screens/PantallaMedicion';
import { PantallaAjustes } from './src/screens/PantallaAjustes';
import { ProveedorTema, TOQUE_MINIMO, useTema } from './src/theme';

const T_INICIO_MODULO = performance.now();

type Pestana = 'resumen' | 'inventario' | 'escaner' | 'ajustes';

/**
 * Navegación tipada por unión discriminada:
 * - Cuatro pestañas principales estilo Apple HIG Tab Bar (Resumen · Inventario · Escanear · Ajustes).
 * - Cuatro subvistas modales con retorno garantizado a la pestaña previa.
 */
type Subvista =
  | { tipo: 'ninguna' }
  | { tipo: 'manual' }
  | { tipo: 'producto'; codigo: string }
  | { tipo: 'alta'; codigo: string }
  | { tipo: 'medicion' };

const TABS: ReadonlyArray<{ id: Pestana; etiqueta: string; icono: string }> = [
  { id: 'resumen', etiqueta: 'Resumen', icono: '▤' },
  { id: 'inventario', etiqueta: 'Inventario', icono: '▦' },
  { id: 'escaner', etiqueta: 'Escanear', icono: '⌗' },
  { id: 'ajustes', etiqueta: 'Ajustes', icono: '⚙' },
];

function ContenedorPrincipal() {
  const db = useSQLiteContext();
  const { paleta } = useTema();
  const [pestana, setPestana] = useState<Pestana>('resumen');
  const [subvista, setSubvista] = useState<Subvista>({ tipo: 'ninguna' });
  const [fallo, setFallo] = useState<string | null>(null);
  const [arranqueMs, setArranqueMs] = useState<number | null>(null);
  const [muestrasM2, setMuestrasM2] = useState<number[]>([]);
  const arranqueMedido = useRef(false);

  useEffect(() => {
    if (!arranqueMedido.current) {
      arranqueMedido.current = true;
      setArranqueMs(performance.now() - T_INICIO_MODULO);
    }
  }, []);

  const cerrarSubvista = useCallback(() => {
    Keyboard.dismiss();
    setSubvista({ tipo: 'ninguna' });
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (subvista.tipo !== 'ninguna') {
        cerrarSubvista();
        return true;
      }
      if (pestana !== 'resumen') {
        setPestana('resumen');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [subvista, pestana, cerrarSubvista]);

  const resolverCodigo = useCallback(
    async (codigo: string) => {
      const t0 = performance.now();
      try {
        const p: Producto | null = await buscarPorCodigo(db, codigo);
        const duracion = performance.now() - t0;
        setMuestrasM2((prev) => [...prev.slice(-29), duracion]);
        if (pestana === 'escaner') {
          setPestana('inventario');
        }
        setSubvista(p ? { tipo: 'producto', codigo } : { tipo: 'alta', codigo });
      } catch (e) {
        setFallo(e instanceof Error ? e.message : 'No se pudo consultar la bodega.');
      }
    },
    [db, pestana]
  );

  if (fallo) return <ErrorEstado mensaje={fallo} onReintentar={() => setFallo(null)} />;

  const mostrarTabBar = subvista.tipo === 'ninguna';

  return (
    <SafeAreaView
      style={[
        s.raiz,
        { backgroundColor: paleta.fondo },
        Platform.OS === 'android' ? { paddingTop: RNStatusBar.currentHeight ?? 0 } : null,
      ]}
    >
      <StatusBar style={paleta.oscura ? 'light' : 'dark'} />

      <View style={s.contenido}>
        {subvista.tipo === 'manual' ? (
          <PantallaManual onConfirmar={resolverCodigo} onCancelar={cerrarSubvista} />
        ) : subvista.tipo === 'producto' ? (
          <PantallaProducto codigo={subvista.codigo} onVolver={cerrarSubvista} />
        ) : subvista.tipo === 'alta' ? (
          <PantallaAlta
            codigo={subvista.codigo}
            onCreado={(codigo) => setSubvista({ tipo: 'producto', codigo })}
            onCancelar={cerrarSubvista}
          />
        ) : subvista.tipo === 'medicion' ? (
          <PantallaMedicion
            onVolver={cerrarSubvista}
            arranqueMs={arranqueMs}
            muestrasM2={muestrasM2}
          />
        ) : pestana === 'resumen' ? (
          <PantallaDashboard
            onAbrirCodigo={(codigo) => setSubvista({ tipo: 'producto', codigo })}
            onIrAEscanear={() => setPestana('escaner')}
          />
        ) : pestana === 'inventario' ? (
          <PantallaLista
            onEscanear={() => setPestana('escaner')}
            onManual={() => setSubvista({ tipo: 'manual' })}
            onAbrirProducto={(p) => setSubvista({ tipo: 'producto', codigo: p.codigo })}
          />
        ) : pestana === 'escaner' ? (
          <PantallaEscaner
            onLeido={resolverCodigo}
            onCancelar={() => setPestana('inventario')}
            onManual={() => {
              setPestana('inventario');
              setSubvista({ tipo: 'manual' });
            }}
          />
        ) : (
          <PantallaAjustes
            onAbrirMedicion={() => setSubvista({ tipo: 'medicion' })}
            arranqueMs={arranqueMs}
          />
        )}
      </View>

      {mostrarTabBar ? (
        <View
          style={[
            s.tabBar,
            {
              backgroundColor: paleta.barraTab,
              borderTopColor: paleta.separador,
            },
          ]}
        >
          {TABS.map((t) => {
            const activa = pestana === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  Keyboard.dismiss();
                  setPestana(t.id);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: activa }}
                style={({ pressed }) => [s.tabItem, pressed && { opacity: 0.7 }]}
              >
                <Text
                  style={[
                    s.tabIcono,
                    { color: activa ? paleta.acento : paleta.textoTerciario },
                  ]}
                >
                  {t.icono}
                </Text>
                <Text
                  style={[
                    s.tabTexto,
                    { color: activa ? paleta.acento : paleta.textoTerciario },
                    activa && { fontWeight: '700' },
                  ]}
                >
                  {t.etiqueta}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export default function Raiz() {
  return (
    <ProveedorTema>
      <Suspense fallback={<Cargando texto="Inicializando motor SQLite…" />}>
        <SQLiteProvider databaseName="bodega.db" onInit={migrar} useSuspense>
          <ContenedorPrincipal />
        </SQLiteProvider>
      </Suspense>
    </ProveedorTema>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1 },
  contenido: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 4 : 8,
  },
  tabItem: {
    flex: 1,
    minHeight: TOQUE_MINIMO,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabIcono: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
  },
  tabTexto: {
    fontSize: 11,
    fontWeight: '500',
  },
});
