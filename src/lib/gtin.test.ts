/**
 * Pruebas de la validación GTIN.
 *
 * Corre con Node, sin levantar la app ni el emulador:
 *     npm test
 *
 * Esto es posible porque src/lib no importa React ni Expo. Los códigos de
 * referencia son GTIN reales publicados por GS1 y por fabricantes, no
 * inventados: si el algoritmo estuviera mal, estos casos fallarían.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
// La extensión .ts es obligatoria: Node resuelve módulos ESM por ruta exacta.
import {
  calcularDigitoVerificador,
  esGtinValido,
  normalizarGtin,
  procesarLectura,
} from './gtin.ts';

test('acepta códigos GTIN reales', () => {
  assert.equal(esGtinValido('4006381333931'), true, 'EAN-13 de ejemplo de GS1');
  assert.equal(esGtinValido('5012345670003'), true, 'EAN-13 del instructivo de GS1 UK');
  assert.equal(esGtinValido('96385074'), true, 'EAN-8');
  assert.equal(esGtinValido('036000291452'), true, 'UPC-A');
});

test('rechaza un código con el dígito verificador alterado', () => {
  // Mismo código válido de arriba con el último dígito cambiado de 1 a 2.
  assert.equal(esGtinValido('4006381333932'), false);
});

test('rechaza largos y caracteres que no son GTIN', () => {
  assert.equal(esGtinValido('123'), false, 'muy corto');
  assert.equal(esGtinValido('12345678901234'), false, 'largo no válido');
  assert.equal(esGtinValido('abcdefghijklm'), false, 'no numérico');
  assert.equal(esGtinValido(''), false, 'vacío');
});

test('calcula el dígito verificador', () => {
  assert.equal(calcularDigitoVerificador('400638133393'), 1);
  assert.equal(calcularDigitoVerificador('501234567000'), 3);
  assert.equal(calcularDigitoVerificador('abc'), null);
});

test('normaliza UPC-A a 13 dígitos para no duplicar el producto', () => {
  assert.equal(normalizarGtin('036000291452'), '0036000291452');
  assert.equal(normalizarGtin('4006381333931'), '4006381333931');
});

test('procesarLectura distingue el tipo de falla', () => {
  assert.deepEqual(procesarLectura(' 4006381333931 '), { ok: true, codigo: '4006381333931' });
  assert.deepEqual(procesarLectura('12x'), { ok: false, motivo: 'formato', codigo: '12x' });
  assert.deepEqual(procesarLectura('4006381333932'), {
    ok: false,
    motivo: 'verificador',
    codigo: '4006381333932',
  });
});
