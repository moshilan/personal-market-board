function validDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function chinaDay(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function chinaTime(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${parts.hour}:${parts.minute}`
}

export function collectionStatusForChina(collection = {}, now = new Date()) {
  const latestSuccessfulAt = validDate(collection.latestSuccessfulAt)
  const latestAttemptAt = validDate(collection.latestAttemptAt)
  const today = chinaDay(now)

  if (latestSuccessfulAt && chinaDay(latestSuccessfulAt) === today) {
    return { kind: 'updated', label: `已更新 · ${chinaTime(latestSuccessfulAt)}` }
  }
  if (collection.latestAttemptAt && (!latestAttemptAt || (chinaDay(latestAttemptAt) === today && !collection.latestAttemptSucceeded))) {
    return { kind: 'error', label: '数据异常' }
  }
  return { kind: 'pending', label: '待更新' }
}
