# Inventario de bodega con lectura de código de barras (v1.3.0)

**Tema T05 · Evaluación Unidad 3 · Desarrollo de Aplicaciones Móviles y Web · UTEM 2026**  
**Integrantes:** Walter Olarte · Ulises Estepa · Camilo Arteaga

Aplicación móvil multiplataforma (**Android e iOS**) construida con **Expo SDK 58**, **React Native 0.88**, **TypeScript estricto** y **SQLite (WAL)** para controlar el stock de un negocio 100% sin conexión: escaneo GTIN con linterna, alta de productos con precio entero en CLP, movimientos atómicos de entrada/salida, dashboard ejecutivo con exportación a Excel (`.xlsx` estilizado con fórmulas `=SUM`), modo claro/oscuro, alto contraste y banco de pruebas M1–M3.

---

## Levantar el proyecto en desarrollo (Expo Go)

**Requisitos:** Node.js `22.13+` / `26 LTS`, Git y Expo Go (Android o iOS).

```bash
git clone https://github.com/waltZk8/utem-web-u3-t05-inventario-bodega.git t05
cd t05
npm install
npm run tipos   # tsc --noEmit (0 errores)
npm test        # 9 pruebas unitarias (GTIN GS1 + stock + CLP)
npx expo start
```

Escanea el QR con tu teléfono en la misma red Wi-Fi (o usa `npx expo start --tunnel ngrok` si la red aísla dispositivos).

---

## Compilar APK de `release` en Android (Windows / macOS / Linux)

**Requisitos adicionales:** OpenJDK 17 (`JAVA_HOME`), Android SDK API 37, Build-Tools `37.0.0`, NDK `27.1.12297006` y CMake `3.22.1`. En Windows usar una ruta corta sin espacios (ej. `C:\dev\t05`).

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease        # en Windows PowerShell: .\gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

---

## Estructura del proyecto (4 capas)

```text
App.tsx                             navegación tipada de 5 pestañas + SQLiteProvider
src/theme.tsx                       paleta Azul Claro Fino, Modo Oscuro y Alto Contraste
src/lib/gtin.ts                     validación módulo 10 GS1 + normalización UPC-A→EAN-13
src/lib/stock.ts                    estado derivado del stock, reglas y formato CLP
src/lib/exportarExcel.ts            exportador .xlsx (3 hojas, bordes, colores y =SUM)
src/db/schema.ts                    esquema SQLite v2 (WAL, CHECK, migración v1→v2)
src/db/inventario.ts                consultas parametrizadas, transacciones y KPIs SQL
src/components/                     Boton, FilaProducto, Estados, BarraSubpantalla, SelectorSegmentado
src/screens/                        Inicio, Inventario, Escáner, Manual, Producto, Alta, Dashboard, Ajustes, Medición
src/bench/medicion.ts               benchmark M1 (SQLite vs AsyncStorage sobre 5.000 SKUs)
```

> **Invariante verificable:** ningún archivo dentro de `src/screens/` ni `src/components/` contiene sentencias SQL (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
