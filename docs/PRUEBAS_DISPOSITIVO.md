# Pruebas en teléfono físico

**Pendiente de ejecutar por el equipo.** Registro para completar; no demuestra pruebas realizadas. Conservar capturas/grabaciones sin datos personales innecesarios.

## Entorno

| Dato | Valor real |
| --- | --- |
| Fecha, hora, responsable | Pendiente |
| Modelo físico, SO y versión | Pendiente |
| Versión de app y commit | Pendiente |
| Expo Go/desarrollo o APK/release | Pendiente |
| Batería, ahorro, temperatura, otras apps | Pendiente |
| Archivos o enlaces de evidencia | Pendiente |

## Casos funcionales

Registrar pasa/falla, resultado observado y evidencia. No marcar como hecho sin ejecutar.

| Caso | Acción | Resultado esperado | Resultado / evidencia |
| --- | --- | --- | --- |
| P01 | Abrir con base vacía | Carga y luego vacío con acción para agregar | Pendiente |
| P02 | Abrir escáner y denegar cámara | Explicación previa; alternativa manual disponible | Pendiente |
| P03 | Rechazar definitivamente y volver desde Ajustes del sistema | Acceso a Ajustes y permiso consultado al volver | Pendiente |
| P04 | Permitir y escanear un envase real | Una sola ficha/alta por lectura | Pendiente |
| P05 | Ingresar `4006381333932` | Error de verificador; ningún producto nuevo | Pendiente |
| P06 | Ingresar código desconocido `4006381333931` en base de prueba | Alta con código precargado y aviso | Pendiente |
| P07 | Crear stock 10, mínimo 5, precio 1290 | Saldo 10 e historial inicial | Pendiente |
| P08 | Entrada 3, salida 8 | Saldo 5 y STOCK BAJO | Pendiente |
| P09 | Salida 6 con saldo 5 | Rechazo; mismo saldo e historial | Pendiente |
| P10 | Salida 5 | Saldo 0 y AGOTADO | Pendiente |
| P11 | Cerrar proceso, activar modo avión y reabrir APK | Producto, saldo e historial conservados | Pendiente |
| P12 | Cámara a segundo plano y volver | Cámara suspendida fuera de primer plano y recuperada al volver | Pendiente |
| P13 | Buscar y cambiar filtros rápidamente | Última búsqueda gobierna resultados; vacío explicado | Pendiente |
| P14 | Cambiar tema y aumentar letra | Controles usables, sin información importante cortada | Pendiente |
| P15 | Exportar y abrir Excel | Cinco hojas, ceros iniciales y montos correctos | Pendiente |
| P16 | Dashboard: Hoy, Mes y rango del calendario; volver a Inicio | Fechas visibles y mismos flujos en ambas pantallas; stock actual sin cambiar | Pendiente |
| P17 | Elegir un rango sin operaciones | Flujos en cero e historial vacío, con existencias actuales conservadas | Pendiente |
| P18 | Abrir calendario, cambiar fechas y cancelar | El período aplicado sigue igual; rango invertido no puede aplicarse | Pendiente |
| P19 | Historial: buscar código/nota, filtrar tipo y cargar más | Fechas completas, ID, sin duplicados al paginar y vuelta correcta a ficha | Pendiente |
| P20 | Exportar el mismo rango desde Dashboard y Ajustes | Cinco hojas con las mismas fechas, totales por producto/día y filas que concuerdan con resumen | Pendiente |
| P21 | Cambiar a oscuro/alto contraste y revisar entradas/salidas | Salidas violetas legibles; rojo reservado a errores/estados críticos | Pendiente |

Si el código ya existe, usar otro envase o una base de prueba para P06. No borrar inventario real para reproducir casos.

## Medición propia

En **Ajustes → Diagnóstico y benchmark**, ejecutar M1 al menos tres veces en las mismas condiciones. Hay 5.000 registros temporales independientes del inventario, 30 búsquedas por motor y limpieza al finalizar.

| Corrida | SQLite p50 / p95 / peor (ms) | AsyncStorage p50 / p95 / peor (ms) | Evidencia |
| --- | --- | --- | --- |
| 1 | Pendiente | Pendiente | Pendiente |
| 2 | Pendiente | Pendiente | Pendiente |
| 3 | Pendiente | Pendiente | Pendiente |

Si se usa M2, anotar número de muestras por cámara o ingreso manual: mide consulta SQLite, no tiempo óptico de escaneo. M3 mide parte del inicio JS hasta el contenedor, no apertura desde tocar el icono.

En el informe explicar:

- Número, unidad, teléfono y entorno; tabla numerada y captura.
- M1 usa cachés calientes y ejecuta SQLite antes de AsyncStorage. Orden, temperatura y desarrollo pueden influir; la razón no es universal.
- AsyncStorage se compara leyendo/parseando un arreglo completo; una caché o índice propio cambiaría la comparación.
- Qué decisión apoyan los resultados y qué límites tuvo el experimento. Si no coinciden con la hipótesis, informar lo observado.

Un fallo también es evidencia: registrar mensaje, pasos para reproducir, intentos y limitación restante.

## Casos nuevos v1.5.0 (pendientes en dispositivo)

| Caso | Acción | Resultado esperado | Estado |
| --- | --- | --- | --- |
| P22 | En pantalla de 320–390 px, deslizar períodos y cambiar 1M/3M/6M/1A/Todo | Fechas visibles; gráfico se adapta; Inicio comparte rango | Pendiente |
| P23 | Tocar y arrastrar líneas; comparar con Tabla y flechas | Coinciden fechas y unidades; sin bloqueo del scroll fuera del gráfico | Pendiente |
| P24 | Rango vacío, un solo día, período >120 días y >8 años | Ceros válidos, un punto utilizable, agrupación día/mes/año explícita | Pendiente |
| P25 | Editar cantidad 10→8 con motivo; luego 8→0 y 0→5 | Stock actualizado; Ajuste con saldos, motivo y fecha; entradas/salidas sin cambio | Pendiente |
| P26 | Guardar sin motivo, cantidad vacía, cancelar, guardar sin variar cantidad y doble toque | Error legible sin cambios parciales; cancelar/sin diferencia no crean ajuste; doble toque no duplica | Pendiente |
| P27 | Actualizar sobre v2 con datos; exportar corrección y abrir Excel | Se conservan fichas/IDs; AJUSTE con saldos, motivo, diferencia y sin subtotal de flujo; probar ambos temas y lector de pantalla | Pendiente |
