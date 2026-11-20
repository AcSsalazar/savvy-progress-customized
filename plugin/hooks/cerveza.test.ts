import { expect, test } from 'claude-code/testing'
import { beerLevel } from './estilos'

test('cerveza: se llena rápido al principio y queda llena al terminar', () => {
  expect(beerLevel(0, false)).toBe(0)
  expect(beerLevel(3, false)).toBeGreaterThan(0.45)
  expect(beerLevel(10, false)).toBeGreaterThan(0.85)
  expect(beerLevel(10, false)).toBeLessThan(1)
  expect(beerLevel(1, true)).toBe(1)
})
