# Inventario de bodega con lectura de código de barras

**Tema 5 · Unidad 3 · Desarrollo de Aplicaciones Móviles y Web · UTEM 2026**

**Integrantes declarados en el proyecto:** Walter Olarte · Ulises Estepa · Camilo Arteaga

App Android/iOS para registrar recepción y despacho de productos desde un teléfono. Lee EAN-13, EAN-8 y UPC-A, permite crear productos desconocidos, conserva el inventario en SQLite y muestra alertas cuando el stock alcanza el mínimo. El ingreso manual permite trabajar sin permiso de cámara.

La base del fork procede de [waltZk8/utem-web-u3-t05-inventario-bodega](https://github.com/waltZk8/utem-web-u3-t05-inventario-bodega). Se conserva esa procedencia y se añaden correcciones y verificaciones. El equipo debe explicar qué partes desarrolló y cuáles adaptó.

> **Estado de entrega:** los requisitos funcionales de T05 están implementados y hay verificaciones automatizadas. Faltan evidencias en teléfono físico, resultados propios de medición, video y PDF final. La presentación contiene campos pendientes. Consulta [la revisión de la pauta](docs/REVISION_PAUTA.md).

## Ejecutar en un teléfono

Requisitos: Node.js 22.13 o superior (verificado con Node 24.20.0), npm, Git y Expo Go compatible con SDK 58. Android e iOS son los objetivos; la presentación HTML no es la app móvil.

```bash
git clone https://github.com/HectorEstepa/utem-web-u3-t05-inventario-bodega.git
cd utem-web-u3-t05-inventario-bodega
npm ci
npm run tipos
npm test
npx expo install --check
npm start
```

En Android, abre Expo Go y escanea el QR; en iOS, usa la cámara del sistema. El computador y el teléfono deben estar en una red que permita comunicarlos. Si la red los aísla, usa `npx expo start --tunnel` y acepta instalar la dependencia de túnel si Expo la solicita. La conexión carga el proyecto en desarrollo; las operaciones de inventario son locales.

Para comprobar persistencia sin Metro, usa un binario instalado. No borres datos de Expo Go ni desinstales la app durante la prueba: eso elimina su almacenamiento.

## Demostración del tema 5

1. Abre **Escanear**: revisa la explicación y permite la cámara. Prueba también denegar y continuar con **Ingreso manual**.
2. Escanea un envase real con EAN-13, EAN-8 o UPC-A válido. Si no existe, aparece **Código nuevo detectado** y el formulario de alta.
3. Para probar manualmente, usa `4006381333931`, nombre «Artículo de prueba», stock `10`, mínimo `5` y precio `1290` CLP. El código no certifica el nombre del producto.
4. Registra entrada de `3`: saldo `13`. Registra salida de `8`: saldo `5` y alerta **STOCK BAJO**.
5. Intenta salida de `6`: se rechaza conservando saldo `5`. Despacha `5`: saldo `0` y estado **AGOTADO**.
6. Cierra completamente y reabre: verifica producto, saldo e historial. Repite en modo avión con el binario instalado.
7. En **Ajustes → Diagnóstico y benchmark**, ejecuta M1 y registra resultados y entorno en [el protocolo de pruebas](docs/PRUEBAS_DISPOSITIVO.md).

El catálogo demo agrega cinco artículos **ficticios**, con códigos de dígito verificador válido, precios CLP y movimientos sintéticos. No es un catálogo comercial certificado ni se inserta automáticamente.

## Qué implementa y dónde

| Requisito T05 | Implementación |
| --- | --- |
| Escaneo y permisos | `PantallaEscaner.tsx`: explicación, permiso, rechazo, Ajustes, alternativa manual y error de cámara |
| Código desconocido y alta | `App.tsx`, `PantallaAlta.tsx`: consulta local y código precargado |
| Entrada y salida | `src/db/inventario.ts`: saldo e historial en una transacción exclusiva |
| Persistencia | `src/db/schema.ts`: SQLite, WAL y migraciones atómicas |
| Stock bajo | `src/lib/stock.ts`, ficha y listado: estado derivado, texto, símbolo y color |
| Medición propia | `src/bench/medicion.ts` y diagnóstico; **resultados físicos pendientes** |

También hay búsqueda, filtros, historial, edición, temas visuales, dashboard y exportación Excel de tres hojas. No hay servidor, cuentas ni sincronización entre teléfonos.

## Decisiones y límites

- **SQLite para inventario:** transacciones entre productos y movimientos y consultas por clave primaria. AsyncStorage guarda preferencias; M1 lo compara como arreglo JSON sin caché propia, no como todas las arquitecturas posibles con AsyncStorage.
- **Saldo y bitácora juntos:** se evita confirmar un saldo sin su movimiento. El estado de stock se deriva del saldo y el mínimo, sin guardar otra columna que pueda desactualizarse.
- **Montos enteros CLP:** el precio de cada movimiento se congela al registrarlo. Editar un precio no cambia movimientos anteriores.
- **Limitaciones:** sin respaldo automático, usuarios, facturación ni sincronización. Eliminar un producto elimina también su historial, previa confirmación; no es una bitácora contable inmutable. Excel incluye como máximo los últimos 2.000 movimientos y el resumen incluye todo el historial. No es un respaldo restaurable de la base.
- **Validación:** el bundle JS y las pruebas de escritorio no prueban cámara ni puente nativo de SQLite. Android e iOS necesitan validación física.

El catálogo demo anterior podía contener `7801610001625` y `7802900001015`, cuyos verificadores son incorrectos. Los nuevos ejemplos usan `7801610001622` y `7802900001018`. No se renombran registros existentes automáticamente: exporta y revisa tus datos antes de eliminar ejemplos antiguos.

## Mediciones

| Medición | Alcance |
| --- | --- |
| M1 | 5.000 artículos sintéticos, 30 búsquedas por motor, con calentamiento. p50, p95 y peor tiempo en ms. Limpia datos temporales al finalizar. |
| M2 | Promedio de las últimas 30 consultas de la sesión, por cámara o ingreso manual. Excluye reconocimiento y renderizado. |
| M3 | Desde evaluación de `App.tsx` hasta primer efecto del contenedor. Excluye inicio nativo, evaluación de dependencias y carga completa de Inicio. |

No se incluyen resultados inventados. Registrar modelo, SO, versión de app, Expo Go/desarrollo o release, repeticiones, capturas y valores. Desarrollo puede alterar tiempos y su razón; preferir release y explicar el entorno.

## Verificaciones

```bash
npm run tipos
npm test
npx expo install --check
npx expo export --platform android --platform ios --output-dir dist
```

Las 14 pruebas cubren GTIN, CLP, stock y SQLite real de Node: persistencia en disco, migración v1→v2, rollback, duplicados y datos inválidos. El adaptador no ejecuta Expo ni simula un teléfono. GitHub Actions repite estas verificaciones en push y pull request.

## APK para prueba física

Con cuenta Expo y EAS configurado para **su propio proyecto**:

```bash
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

`preview` genera APK para instalación interna. La compilación se hace en EAS y puede estar sujeta a límites de la cuenta. **No se generó ni instaló un APK en esta revisión.** Para compilar Android localmente se necesita JDK/SDK compatibles con el proyecto generado por Expo; para iOS localmente, macOS y Xcode.

## Entrega académica

- [Revisión de la pauta y pendientes](docs/REVISION_PAUTA.md).
- [Pruebas físicas y registro de mediciones](docs/PRUEBAS_DISPOSITIVO.md).
- [Guía del informe, declaración de IA y bibliografía](docs/GUIA_INFORME.md).
- [Presentación existente](docs/index.html): abrir en navegador y completar pendientes antes de grabar.

Según la pauta facilitada: **un solo PDF**, siete secciones y máximo cinco páginas de desarrollo. Video de 5 a 10 minutos, presentación y repositorio enlazados en portada. Faltan RUT, firmas y enlaces finales; completar esos datos privadamente en la entrega al docente.
