export type ModoPeriodo = 'hoy' | '3meses' | '6meses' | '1ano' | '7dias' | '30dias' | 'mes' | 'ano' | 'todo' | 'rango';
export interface SeleccionPeriodo { modo: ModoPeriodo; desde: string; hasta: string }
export interface Periodo {
  desde: number | null;
  /** Límite exclusivo: medianoche local del día siguiente al último elegido. */
  hasta: number | null;
  etiqueta: string;
  detalle: string;
}

export function fechaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function leerFechaLocal(texto: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw new Error('La fecha debe tener formato AAAA-MM-DD.');
  const [y = 0, m = 0, d = 0] = texto.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  if (fechaLocal(fecha) !== texto) throw new Error('La fecha no existe.');
  return fecha;
}

export function seleccionInicial(ahora = new Date()): SeleccionPeriodo {
  return { modo: 'mes', desde: fechaLocal(new Date(ahora.getFullYear(), ahora.getMonth(), 1)), hasta: fechaLocal(ahora) };
}

export function resolverPeriodo(s: SeleccionPeriodo, ahora = new Date()): Periodo {
  if (s.modo === 'todo') return { desde: null, hasta: null, etiqueta: 'Todo el historial', detalle: 'Sin límite de fechas' };
  const y = ahora.getFullYear(), m = ahora.getMonth(), d = ahora.getDate();
  let inicio = new Date(y, m, d), fin = new Date(y, m, d);
  let etiqueta = 'Hoy';
  switch (s.modo) {
    case '3meses': case '6meses': case '1ano': {
      const meses = s.modo === '3meses' ? 3 : s.modo === '6meses' ? 6 : 12;
      // Ventana móvil por meses, acotada al último día válido del mes destino.
      const ultimo = new Date(y, m - meses + 1, 0).getDate();
      inicio = new Date(y, m - meses, Math.min(d, ultimo));
      inicio.setDate(inicio.getDate() + 1);
      etiqueta = `Últimos ${meses === 12 ? '12' : meses} meses`; break;
    }
    case '7dias': inicio = new Date(y, m, d - 6); etiqueta = 'Últimos 7 días'; break;
    case '30dias': inicio = new Date(y, m, d - 29); etiqueta = 'Últimos 30 días'; break;
    case 'mes': inicio = new Date(y, m, 1); fin = new Date(y, m + 1, 0); etiqueta = 'Este mes'; break;
    case 'ano': inicio = new Date(y, 0, 1); fin = new Date(y, 11, 31); etiqueta = 'Este año'; break;
    case 'rango': inicio = leerFechaLocal(s.desde); fin = leerFechaLocal(s.hasta); etiqueta = 'Rango personalizado'; break;
  }
  if (inicio > fin) throw new Error('La fecha inicial debe ser anterior o igual a la final.');
  const siguiente = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() + 1);
  const formato = (v: Date) => v.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return { desde: inicio.getTime(), hasta: siguiente.getTime(), etiqueta, detalle: `${formato(inicio)} — ${formato(fin)} · días completos` };
}

export const TODO_EL_HISTORIAL: Periodo = resolverPeriodo({ modo: 'todo', desde: '', hasta: '' });

export function validarPeriodo(p: Periodo): void {
  if ((p.desde === null) !== (p.hasta === null) || (p.desde !== null && !Number.isFinite(p.desde)) || (p.hasta !== null && !Number.isFinite(p.hasta)) ||
    (p.desde !== null && p.hasta !== null && p.desde >= p.hasta)) throw new Error('El período de consulta no es válido.');
}
