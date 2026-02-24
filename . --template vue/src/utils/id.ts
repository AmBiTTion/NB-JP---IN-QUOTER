export function nextId(prefix: string, existingIds: string[]): string {
  const regex = new RegExp(`^${prefix}_(\\d+)$`)
  let max = 0
  existingIds.forEach((id) => {
    const match = regex.exec(id)
    if (!match) return
    const num = Number(match[1])
    if (Number.isFinite(num) && num > max) max = num
  })
  return `${prefix}_${max + 1}`
}

export function nextIdFromRows<T extends { id: string }>(prefix: string, rows: T[]): string {
  return nextId(prefix, rows.map((row) => row.id))
}
