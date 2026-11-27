import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fechaLocal, leerFechaLocal, resolverPeriodo, seleccionInicial } from './periodo.ts';

test('mes y año completos, febrero bisiesto y cambios de año', () => {
  const ahora = new Date(2024, 1, 15, 12);
  const mes = resolverPeriodo(seleccionInicial(ahora), ahora);
  assert.equal(mes.desde, new Date(2024, 1, 1).getTime());
  assert.equal(mes.hasta, new Date(2024, 2, 1).getTime());
  const siete = resolverPeriodo({ ...seleccionInicial(), modo: '7dias' }, new Date(2026, 0, 3));
  assert.equal(siete.desde, new Date(2025, 11, 28).getTime());
  assert.equal(siete.hasta, new Date(2026, 0, 4).getTime());
  const ano = resolverPeriodo({ ...seleccionInicial(), modo: 'ano' }, new Date(2026, 11, 31));
  assert.equal(ano.hasta, new Date(2027, 0, 1).getTime());
});

test('rango incluye día final completo, rechaza fechas imposibles e inversión', () => {
  const rango = resolverPeriodo({ modo: 'rango', desde: '2026-11-26', hasta: '2026-11-26' });
  assert.equal(rango.desde, new Date(2026, 10, 26).getTime());
  assert.equal(rango.hasta, new Date(2026, 10, 27).getTime());
  assert.throws(() => leerFechaLocal('2026-02-30'), /no existe/);
  assert.throws(() => leerFechaLocal('26/11/2026'), /formato/);
  assert.throws(() => resolverPeriodo({ modo: 'rango', desde: '2026-11-27', hasta: '2026-11-26' }), /anterior/);
  assert.equal(fechaLocal(leerFechaLocal('2026-11-26')), '2026-11-26');
});

test('días son fechas de calendario local, sin sumar 24 horas en cambio de horario', () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = 'America/Santiago';
    const p = resolverPeriodo({ modo: 'rango', desde: '2026-09-06', hasta: '2026-09-06' });
    assert.equal(p.desde, new Date(2026, 8, 6).getTime());
    assert.equal(p.hasta, new Date(2026, 8, 7).getTime());
    assert.equal(resolverPeriodo({ modo: 'todo', desde: '', hasta: '' }).hasta, null);
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
