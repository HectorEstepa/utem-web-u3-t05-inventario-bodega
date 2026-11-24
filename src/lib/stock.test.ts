import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estadoDeStock,
  formatearCLP,
  validarMovimiento,
  validarPrecio,
} from './stock.ts';

test('deriva correctamente agotado, bajo y ok', () => {
  assert.equal(estadoDeStock({ stock: 0, minimo: 5 }), 'agotado');
  assert.equal(estadoDeStock({ stock: 5, minimo: 5 }), 'bajo');
  assert.equal(estadoDeStock({ stock: 12, minimo: 5 }), 'ok');
});

test('valida movimientos e informa saldo real al rechazar salida excesiva', () => {
  assert.equal(validarMovimiento('IN', 10, 0), null);
  assert.equal(validarMovimiento('OUT', 3, 5), null);
  assert.equal(
    validarMovimiento('OUT', 10, 3),
    'No puedes despachar 10: solo hay 3 en bodega.'
  );
  assert.notEqual(validarMovimiento('IN', 0, 5), null);
  assert.notEqual(validarMovimiento('IN', 2.5, 5), null);
});

test('valida precios enteros en CLP y formatea con separador chileno', () => {
  assert.equal(validarPrecio(0), null);
  assert.equal(validarPrecio(12990), null);
  assert.notEqual(validarPrecio(-100), null);
  assert.notEqual(validarPrecio(1990.5), null);
  assert.equal(formatearCLP(0), '$0');
  assert.equal(formatearCLP(12990), '$12.990');
  assert.equal(formatearCLP(1450000), '$1.450.000');
});
