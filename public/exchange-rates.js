export const SUPPORTED_CURRENCIES = [
  { code: 'CNY', name: '人民币', displayUnit: 1 }, { code: 'USD', name: '美元', displayUnit: 1 },
  { code: 'HKD', name: '港币', displayUnit: 1 }, { code: 'JPY', name: '日元', displayUnit: 100 },
  { code: 'EUR', name: '欧元', displayUnit: 1 }, { code: 'GBP', name: '英镑', displayUnit: 1 },
  { code: 'KRW', name: '韩元', displayUnit: 100 }, { code: 'SGD', name: '新加坡元', displayUnit: 1 },
]
export function convertExchangeRate(amount, from, to, rates) {
  if (typeof amount === 'string' && amount.trim() === '') return null
  const value = Number(amount); const fromRate = rates?.rates?.[from]; const toRate = rates?.rates?.[to]
  if (!rates?.available || !Number.isFinite(value) || value < 0 || !Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0) return null
  return value * toRate / fromRate
}
