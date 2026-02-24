import ExcelJS from 'exceljs'
import path from 'node:path'
import { access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'

export interface ExternalQuotationPayload {
  quoteResult: {
    summary: {
      sell_usd_per_bag: number
      bags_int: number
      tons: number
      mode: 'FCL' | 'LCL'
      container_type: '20GP' | '40HQ'
    }
    breakdown: Record<string, number>
    warnings: string[]
  }
  input: {
    productName: string
    name_en?: string
    description_en?: string
    productNameEn?: string
    descriptionEn?: string
    description?: string
    packagingText?: string
    quantityBagsInt?: number
    containerType?: '20GP' | '40HQ'
    polPortName?: string
    polPortNameEn?: string
    mode?: 'FCL' | 'LCL'
    tons?: number
    unitWeightKg?: number
    unitsPerCarton?: number | null
    customerName?: string
    image_path?: string
  }
  settings?: {
    companyName?: string
    address?: string
    postCode?: string
    tel?: string
    whatsapp?: string
    wechat?: string
    email?: string
    quote_valid_days?: number
    terms_template?: string
    export_from_name?: string
  }
  meta?: {
    appVersion?: string
    exportedAtISO?: string
  }
}

function formatDateDDMMYYYY(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function asNumber(input: unknown, fallback = 0): number {
  const num = Number(input)
  return Number.isFinite(num) ? num : fallback
}

function formatKg(n: number): string {
  const rounded = Number(n.toFixed(2))
  return String(rounded)
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function containsChinese(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text)
}

function resolvePortNameEnglish(input: ExternalQuotationPayload['input']): string {
  if (isNonEmptyText(input.polPortNameEn)) return input.polPortNameEn.trim()
  const raw = (input.polPortName ?? '').trim()
  if (!raw) return 'Tianjin Port'

  const map: Record<string, string> = {
    '天津': 'Tianjin Port',
    '青岛': 'Qingdao Port',
    '上海': 'Shanghai Port',
  }
  for (const key of Object.keys(map)) {
    if (raw.includes(key)) return map[key]
  }

  if (containsChinese(raw)) return 'Tianjin Port'
  return raw
}

function buildDescriptionEnglish(input: ExternalQuotationPayload['input']): string {
  const productName = isNonEmptyText(input.name_en)
    ? input.name_en.trim()
    : isNonEmptyText(input.productNameEn)
      ? input.productNameEn.trim()
      : 'Cat Litter'
  const descriptionEn = isNonEmptyText(input.description_en)
    ? input.description_en.trim()
    : isNonEmptyText(input.descriptionEn)
      ? input.descriptionEn.trim()
      : ''
  const unitWeightKg = asNumber(input.unitWeightKg, 0)
  const lines = [`${productName}`]
  if (descriptionEn) lines.push(descriptionEn)
  lines.push(`Net Weight: ${formatKg(unitWeightKg)}kg per bag`)
  return lines.join('\n')
}

function buildPackagingEnglish(input: ExternalQuotationPayload['input']): string {
  const unitWeightKg = asNumber(input.unitWeightKg, 0)
  const unitsPerCarton = asNumber(input.unitsPerCarton, 0)
  if (unitsPerCarton <= 0) {
    return `${formatKg(unitWeightKg)}kg per bag\nNo carton packing`
  }
  return `${formatKg(unitWeightKg)}kg per bag\n${unitsPerCarton} bags per carton\nCarton packing`
}

function buildQuantityBlock(containerType: '20GP' | '40HQ', bagsInt: number): string {
  return `1 x ${containerType}\n${bagsInt.toLocaleString()} Bags`
}

function buildRemarksEnglish(settings: ExternalQuotationPayload['settings'], portName: string): string {
  const quoteValidDays = asNumber(settings?.quote_valid_days, 0)
  return `FOB ${portName}.\nValidity: ${quoteValidDays} days from quotation date.\nPayment Terms: T/T.`
}

export async function exportExternalQuotationExcel(
  payload: ExternalQuotationPayload,
  templatePath: string,
  outputPath: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(templatePath)
  const sheet = workbook.getWorksheet('Quotation')
  if (!sheet) {
    throw new Error('Template is missing worksheet "Quotation".')
  }

  const exportedAt = payload.meta?.exportedAtISO ? new Date(payload.meta.exportedAtISO) : new Date()
  const quotationDate = formatDateDDMMYYYY(exportedAt)
  const bagsInt = asNumber(payload.quoteResult?.summary?.bags_int, 0)
  const sellUsdPerBag = asNumber(payload.quoteResult?.summary?.sell_usd_per_bag, 0)
  const amountUsd = Number((sellUsdPerBag * bagsInt).toFixed(2))
  const containerType = payload.input?.containerType ?? payload.quoteResult?.summary?.container_type ?? '20GP'
  const polPortName = resolvePortNameEnglish(payload.input)
  const descriptionText = buildDescriptionEnglish(payload.input)
  const packagingText = buildPackagingEnglish(payload.input)
  const quantityBlockText = buildQuantityBlock(containerType, bagsInt)
  const remarksText = buildRemarksEnglish(payload.settings, polPortName)

  const whatsapp = payload.settings?.whatsapp?.trim()
  const wechat = payload.settings?.wechat?.trim()
  const email = payload.settings?.email?.trim()
  const contactItems: string[] = []
  if (whatsapp) contactItems.push(`WhatsApp: ${whatsapp}`)
  if (wechat) contactItems.push(`Wechat: ${wechat}`)
  if (email) contactItems.push(`Email: ${email}`)

  if (isNonEmptyText(payload.settings?.companyName)) {
    sheet.getCell('C1').value = payload.settings.companyName.trim()
  }
  if (isNonEmptyText(payload.settings?.address)) {
    sheet.getCell('C2').value = payload.settings.address.trim()
  }
  if (isNonEmptyText(payload.settings?.postCode)) {
    sheet.getCell('C3').value = payload.settings.postCode.trim()
  }
  if (isNonEmptyText(payload.settings?.tel)) {
    sheet.getCell('C4').value = payload.settings.tel.trim()
  }
  if (contactItems.length > 0) {
    sheet.getCell('C5').value = contactItems.join(' | ')
  }

  if (isNonEmptyText(payload.input?.customerName)) {
    sheet.getCell('B3').value = payload.input.customerName.trim()
  }
  if (isNonEmptyText(payload.settings?.export_from_name)) {
    sheet.getCell('A4').value = `From: ${payload.settings.export_from_name.trim()}`
  }
  if (isNonEmptyText(quotationDate)) {
    sheet.getCell('A5').value = `Quotation Date: ${quotationDate}`
  }

  sheet.getCell('B9').value = descriptionText
  sheet.getCell('C9').value = packagingText
  sheet.getCell('D9').value = quantityBlockText
  sheet.getCell('E9').value = Number(sellUsdPerBag.toFixed(2))
  sheet.getCell('F9').value = amountUsd
  sheet.getCell('G9').value = polPortName
  sheet.getCell('H9').value = remarksText

  try {
    const logoPath = path.join(process.cwd(), 'resources', 'logo.png')
    await access(logoPath, fsConstants.F_OK)
    const logoImageId = workbook.addImage({
      filename: logoPath,
      extension: 'png',
    })
    sheet.addImage(logoImageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 120, height: 50 },
    })
  } catch {
    // Skip logo insertion when logo file is unavailable.
  }

  if (isNonEmptyText(payload.input?.image_path)) {
    const imagePath = payload.input.image_path.trim()
    try {
      await access(imagePath, fsConstants.F_OK)
      const extRaw = path.extname(imagePath).toLowerCase().replace('.', '')
      const extension = extRaw === 'jpg' ? 'jpeg' : extRaw
      if (extension === 'png' || extension === 'jpeg') {
        const imageId = workbook.addImage({
          filename: imagePath,
          extension: extension as 'png' | 'jpeg',
        })
        sheet.addImage(imageId, {
          tl: { col: 0, row: 8 },
          ext: { width: 140, height: 140 },
        })
      }
    } catch {
      // Keep template default image when product image is unavailable.
    }
  }

  const d9Alignment = sheet.getCell('D9').alignment ?? {}
  sheet.getCell('D9').alignment = { ...d9Alignment, wrapText: true }
  const h9Alignment = sheet.getCell('H9').alignment ?? {}
  sheet.getCell('H9').alignment = { ...h9Alignment, wrapText: true }

  await workbook.xlsx.writeFile(outputPath)
}
