import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Platform,
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
import { PantallaLista } from './src/screens/PantallaLista';
import { PantallaEscaner } from './src/screens/PantallaEscaner';
import { PantallaProducto } from './src/screens/PantallaProducto';
import { PantallaAlta } from './src/screens/PantallaAlta';
import { PantallaManual } from './src/screens/PantallaManual';
import { PantallaMedicion } from './src/screens/PantallaMedicion';
import { C } from './src/theme';

// Marca de tiempo al cargar el módulo JS para medir M3 (arranque hasta
// primera pantalla interactiva) directamente en iPhone o Android sin adb.
const T_INICIO_MODULO = performance.now();

/**
 * Navegación propia en vez de una biblioteca.
 *
 * La app tiene seis pantallas y un solo flujo lineal (lista → escáner →
 * ficha o alta). Una unión discriminada de TypeScript cubre ese caso con
 * cero dependencias, y el compilador obliga a manejar todos los casos del
 * switch. Si el proyecto creciera a pestañas o enlaces profundos, la
 * decisión correcta sería cambiar a expo-router.
 */
type Vista =
  | { nombre: 'lista' }
  | { nombre: 'escaner' }
  | { nombre: 'manual' }
  | { nombre: 'producto'; codigo: string }
  | { nombre: 'alta'; codigo: string }
  | { nombre: 'medicion' };

const TITULOS: Record<Vista['nombre'], string> = {
  lista: 'Bodega',
  escaner: 'Escanear producto',
  manual: 'Código manual',
  producto: 'Movimiento',
  alta: 'Producto nuevo',
  medicion: 'Medición de rendimiento',
};

function App() {
  const db = useSQLiteContext();
  const [vista, setVista] = useState<Vista>({ nombre: 'lista' });
  const [fallo, setFallo] = useState<string | null>(null);
  const [arranqueMs, setArranqueMs] = useState<number | null>(null);
  const [muestrasM2, setMuestrasM2] = useState<number[]>([]);
  const arranqueMedido = useRef(false);

  // Registra M3 una sola vez cuando el árbol interactivo termina de montar
  // tras abrir SQLite y correr migraciones.
  useEffect(() => {
    if (!arranqueMedido.current) {
      arranqueMedido.current = true;
      setArranqueMs(performance.now() - T_INICIO_MODULO);
    }
  }, []);

  const irALista = useCallback(() => setVista({ nombre: 'lista' }), []);

  // El botón físico de Android debe volver a la lista en vez de cerrar la
  // app. Sin esto, el usuario pierde el flujo a mitad de un movimiento.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (vista.nombre === 'lista') return false; // deja que el sistema cierre
      irALista();
      return true;
    });
    return () => sub.remove();
  }, [vista, irALista]);

  /**
   * Punto donde se decide qué hacer con un código: si existe, va a la ficha;
   * si no, va al alta con el código ya cargado. Mide M2 (latencia de consulta
   * y transición) en cada lectura para respaldar el informe con datos propios.
   */
  const resolverCodigo = useCallback(
    async (codigo: string) => {
      const t0 = performance.now();
      try {
        const p: Producto | null = await buscarPorCodigo(db, codigo);
        const duracion = performance.now() - t0;
        setMuestrasM2((prev) => [...prev.slice(-29), duracion]);
        setVista(p ? { nombre: 'producto', codigo } : { nombre: 'alta', codigo });
      } catch (e) {
        setFallo(e instanceof Error ? e.message : 'No se pudo consultar la bodega.');
      }
    },
    [db]
  );

  if (fallo) return <ErrorEstado mensaje={fallo} onReintentar={() => setFallo(null)} />;

  return (
    <SafeAreaView
      style={[
        s.raiz,
        Platform.OS === 'android' ? { paddingTop: RNStatusBar.currentHeight ?? 0 } : null,
      ]}
    >
      {/* expo-status-bar en vez de StatusBar de react-native: desde RN 0.88
          el modo edge-to-edge de Android ignora backgroundColor. */}
      <StatusBar style="light" />
      <View style={s.barra}>
        <Text style={s.titulo}>{TITULOS[vista.nombre]}</Text>
        <Text style={s.subtitulo}>Inventario de bodega</Text>
      </View>

      {vista.nombre === 'lista' ? (
        <PantallaLista
          onEscanear={() => setVista({ nombre: 'escaner' })}
          onManual={() => setVista({ nombre: 'manual' })}
          onMedicion={() => setVista({ nombre: 'medicion' })}
          onAbrirProducto={(p) => setVista({ nombre: 'producto', codigo: p.codigo })}
        />
      ) : vista.nombre === 'medicion' ? (
        <PantallaMedicion
          onVolver={irALista}
          arranqueMs={arranqueMs}
          muestrasM2={muestrasM2}
        />
      ) : vista.nombre === 'escaner' ? (
        <PantallaEscaner
          onLeido={resolverCodigo}
          onCancelar={irALista}
          onManual={() => setVista({ nombre: 'manual' })}
        />
      ) : vista.nombre === 'manual' ? (
        <PantallaManual onConfirmar={resolverCodigo} onCancelar={irALista} />
      ) : vista.nombre === 'producto' ? (
        <PantallaProducto codigo={vista.codigo} onVolver={irALista} />
      ) : (
        <PantallaAlta
          codigo={vista.codigo}
          onCreado={(codigo) => setVista({ nombre: 'producto', codigo })}
          onCancelar={irALista}
        />
      )}
    </SafeAreaView>
  );
}

export default function Raiz() {
  return (
    // useSuspense deja que SQLiteProvider muestre el fallback mientras
    // abre la base y corre las migraciones, en vez de parpadear en blanco.
    <Suspense fallback={<Cargando texto="Preparando la base local…" />}>
      <SQLiteProvider databaseName="bodega.db" onInit={migrar} useSuspense>
        <App />
      </SQLiteProvider>
    </Suspense>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.fondo },
  barra: { backgroundColor: C.azul, paddingHorizontal: 18, paddingVertical: 14 },
  titulo: { color: '#fff', fontSize: 20, fontWeight: '900' },
  subtitulo: { color: '#cfe6f7', fontSize: 12, marginTop: 2 },
});
