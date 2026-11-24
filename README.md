# Inventario de bodega con lectura de código de barras

Tema T05 · Evaluación Unidad 3 · Desarrollo de Aplicaciones Móviles y Web · UTEM 2026
Walter Olarte · Ulises Estepa · Camilo Arteaga

Una app móvil multiplataforma (**iOS y Android**) para que un local pequeño controle su stock escaneando el código de
barras del producto al recibirlo y al despacharlo. Todo el inventario vive en el
teléfono: no hay servidor y la app funciona sin conexión.

## Levantar el proyecto

Requisitos: Node 22.13 o superior, un **iPhone físico con Expo Go** (para escaneo real de envases y mediciones en hardware) y opcionalmente **Android Emulator** (para validación cruzada de `BackHandler` y layout Android).
El escaneo se prueba en el equipo físico: el emulador no reproduce la lectura óptica real sobre un envase ni los tiempos del hardware de destino.

```bash
npm install
npx expo start
```

- **En iPhone físico:** abrir la app **Expo Go** (SDK 58) o la cámara nativa de iOS y escanear el código QR de la terminal. Computador y teléfono deben estar en la misma red Wi-Fi. Si la red los aísla (ej. Wi-Fi universitaria):

```bash
npx expo start --tunnel
```

- **En Android Emulator:** con el emulador abierto, presionar `a` en la terminal de Expo o ejecutar `npx expo start --android`.

### Verificaciones antes de subir código

```bash
npm run tipos   # tsc --noEmit, en modo estricto
npm test        # pruebas de la validación GTIN, corren en Node sin emulador
```

`npm test` verifica el algoritmo del dígito verificador contra códigos GS1 reales.
Es posible porque `src/lib` no importa React ni Expo.

### Medición de rendimiento y build instalable

La pantalla **Medir rendimiento** ejecuta **M1** (SQLite vs AsyncStorage sobre 5.000 productos, 30 muestras) y registra **M2** (latencia de consulta tras escaneo) y **M3** (tiempo de arranque JS → UI lista) directamente dentro de la app, sin requerir `adb`.

- **En iPhone físico (Expo Go):** permite medir sobre hardware real sin cuenta pagada de Apple Developer Program (US$ 99/año); se declara explícitamente el modo de ejecución (`__DEV__`) en el informe.
- **Build instalable Android (opcional):** si se dispone de equipo Android físico, se puede compilar el APK de release con:

```bash
npx eas build -p android --profile preview
```

El perfil `preview` de `eas.json` fija `android.buildType: "apk"`, formato instalable directamente en Android.

## Qué hace la app

| Pantalla | Qué resuelve |
|---|---|
| Lista | Productos ordenados con los agotados y los bajos primero, búsqueda y filtro de stock bajo |
| Escáner | Cámara con tipos de código restringidos y candado contra lecturas repetidas |
| Código manual | Ruta alternativa cuando no hay permiso de cámara o la etiqueta está dañada |
| Ficha del producto | Entrada, salida, alerta por estado del stock e historial de movimientos |
| Alta | Se abre sola cuando el código escaneado no existe, con el código ya cargado |
| Medición | Corre la comparación SQLite contra AsyncStorage en el propio teléfono |

## Estructura

```
App.tsx                      navegación propia y SQLiteProvider
src/lib/gtin.ts              validación del dígito verificador GS1
src/lib/stock.ts             estado derivado del stock y validación de movimientos
src/db/schema.ts             tablas, índices y migración
src/db/inventario.ts         consultas, todas parametrizadas
src/components/              Boton, FilaProducto, estados de carga
src/screens/                 las seis pantallas
src/bench/medicion.ts        medición M1
```

Ninguna pantalla ni componente consulta la base directamente: todo pasa por
`src/db/inventario.ts`. Cambiar de SQLite a otro motor obliga a modificar un solo archivo.

## Decisiones

**SQLite en vez de AsyncStorage.** AsyncStorage guarda pares de clave y valor, así que
buscar un producto obliga a leer el arreglo completo, parsearlo y recorrerlo. Con 5.000
productos eso ocurre en cada escaneo. SQLite resuelve por clave primaria. La medición
M1 compara ambos en el mismo teléfono.

**El stock se guarda como columna, y además queda la bitácora.** Calcularlo con `SUM()`
sobre los movimientos sería correcto pero crece sin techo. La columna se lee en tiempo
constante, y la consistencia se garantiza porque el `UPDATE` del stock y el `INSERT`
del movimiento van en la misma transacción exclusiva.

**El estado del stock no se guarda.** Es estado derivado de `stock` y `minimo`. Una
columna extra habría que recalcularla en cada movimiento y podría quedar
desincronizada.

**Navegación propia.** Seis pantallas y un flujo lineal se cubren con una unión
discriminada de TypeScript, sin dependencias. Con pestañas o enlaces profundos
correspondería cambiar a expo-router.

## Limitaciones conocidas

- La bodega vive solo en ese teléfono. No hay sincronización entre dispositivos ni
  respaldo: si se desinstala la app, el inventario se pierde.
- No hay alerta por notificación cuando un producto baja del mínimo. La alerta es
  visual y requiere abrir la app. Agregarla implicaría un permiso más, y la app está
  pensada para pedir el mínimo posible.
- No se registra quién hizo cada movimiento. Es deliberado: ese campo convertiría la
  base en un registro de datos personales de trabajadores.
- Solo se leen EAN-13, EAN-8 y UPC-A. Las etiquetas internas en Code 128 quedan fuera,
  porque son alfanuméricas y de largo libre y no tienen dígito verificador GTIN que
  validar. Soportarlas exigiría una segunda ruta de validación.
- Para medir rendimiento hay que instalar el APK de release. Los tiempos que entrega
  Expo Go corresponden al modo desarrollo y son sistemáticamente peores que los reales.
