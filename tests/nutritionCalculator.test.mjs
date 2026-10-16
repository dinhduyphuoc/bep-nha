import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateNutrition } from '../src/lib/nutritionCalculator.js'

const male = { sex: 'male', age: '30', height: '175', weight: '70', activity: 'low' }
test('Mifflin–St Jeor: male, unrounded energy used to derive grams', () => {
  assert.deepEqual(calculateNutrition(male), {
    errors: {}, result: { energy: 1979, protein: 99, carbs: 247, fat: 66 },
  })
})
test('Mifflin–St Jeor: female, moderate activity', () => {
  assert.deepEqual(calculateNutrition({ sex: 'female', age: '30', height: '165', weight: '60', activity: 'moderate' }).result,
    { energy: 2046, protein: 102, carbs: 256, fat: 68 })
})
test('all four activity factors', () => {
  const energies = ['low', 'light', 'moderate', 'high'].map(activity => calculateNutrition({ ...male, activity }).result.energy)
  assert.deepEqual(energies, [1979, 2267, 2556, 2844])
})
test('Vietnamese decimal comma is accepted', () => {
  assert.deepEqual(calculateNutrition({ ...male, weight: '70,5', height: '175,5' }), calculateNutrition({ ...male, weight: '70.5', height: '175.5' }))
})
test('under 18 cannot receive any result; 18 can', () => {
  assert.equal(calculateNutrition({ ...male, age: '17' }).result, undefined)
  assert.ok(calculateNutrition({ ...male, age: '18' }).result)
})
test('reject missing, nonfinite, negative, malformed and unreasonable inputs', () => {
  for (const [field, values] of Object.entries({
    age: ['', '30.5', '121', 'Infinity', '-20'],
    weight: ['', '0', '-70', 'NaN', 'Infinity', '501', '70kg', '1e2'],
    height: ['', '0', '-175', '251', '165cm'],
    sex: ['', 'invalid'], activity: ['', 'invalid', 'toString'],
  })) {
    for (const value of values) {
      const actual = calculateNutrition({ ...male, [field]: value })
      assert.ok(actual.errors[field], `${field}: ${value}`)
      assert.equal(actual.result, undefined)
    }
  }
})
test('reject combinations producing nonpositive basal energy', () => {
  const actual = calculateNutrition({ sex: 'female', age: '120', height: '50', weight: '20', activity: 'low' })
  assert.equal(actual.result, undefined)
  assert.ok(actual.errors.weight)
})
