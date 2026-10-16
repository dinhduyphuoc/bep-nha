export const activityLevels = [
  { value: 'low', label: 'Ít vận động', description: 'Chủ yếu ngồi, ít tập thể dục', factor: 1.2 },
  { value: 'light', label: 'Vận động nhẹ', description: 'Tập nhẹ khoảng 1–3 ngày/tuần', factor: 1.375 },
  { value: 'moderate', label: 'Vận động vừa', description: 'Tập khoảng 3–5 ngày/tuần', factor: 1.55 },
  { value: 'high', label: 'Vận động nhiều', description: 'Tập nhiều khoảng 6–7 ngày/tuần', factor: 1.725 },
]

function number(value) {
  const text = String(value ?? '').trim().replace(',', '.')
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : NaN
}

export function calculateNutrition(input) {
  const age = number(input.age), height = number(input.height), weight = number(input.weight)
  const activity = activityLevels.find(item => item.value === input.activity)
  const errors = {}
  if (!['male', 'female'].includes(input.sex)) errors.sex = 'Bạn hãy chọn Nam hoặc Nữ.'
  if (!Number.isInteger(age) || age < 18 || age > 120) errors.age = 'Nhập số tuổi nguyên từ 18 đến 120. Công cụ chỉ dành cho người trưởng thành.'
  if (!Number.isFinite(height) || height < 50 || height > 250) errors.height = 'Nhập chiều cao từ 50 đến 250 cm.'
  if (!Number.isFinite(weight) || weight < 20 || weight > 500) errors.weight = 'Nhập cân nặng từ 20 đến 500 kg.'
  if (!activity) errors.activity = 'Bạn hãy chọn mức độ vận động.'
  if (Object.keys(errors).length) return { errors }
  const bmr = 10 * weight + 6.25 * height - 5 * age + (input.sex === 'male' ? 5 : -161)
  if (bmr <= 0) return { errors: { weight: 'Thông tin này cho kết quả không phù hợp. Bạn hãy kiểm tra lại tuổi, chiều cao và cân nặng.' } }
  const tdee = bmr * activity.factor
  // Round only at display boundaries; calculate all macros from the unrounded TDEE.
  return { errors: {}, result: {
    energy: Math.round(tdee), protein: Math.round(tdee * .2 / 4),
    carbs: Math.round(tdee * .5 / 4), fat: Math.round(tdee * .3 / 9),
  } }
}
