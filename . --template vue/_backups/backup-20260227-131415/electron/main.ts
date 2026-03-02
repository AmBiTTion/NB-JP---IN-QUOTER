import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { Low } from 'lowdb'
import {
  exportExternalQuotationExcel,
  type ExternalQuotationPayload,
} from './exporters/exportExternalQuotationExcel'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

type Mode = 'FCL' | 'LCL'
type ContainerType = '20GP' | '40HQ'

interface Settings {
  fx_rate: number
  margin_pct: number
  quote_valid_days: number
  ui_theme?: 'classic' | 'neon' | 'minimal'
  auto_update_enabled?: boolean
  update_repo?: string
  money_format: {
    rmb_decimals: number
    usd_decimals: number
  }
  pricing_formula_mode: string
  rounding_policy: string
  terms_template: string
}

interface Product {
  id: string
  name: string
  name_en?: string
  description_en?: string
  image_path?: string
  refund_rate: number
  purchase_vat_rate: number
  invoice_tax_point: number
  pol_port_id: string
}

interface PackagingOption {
  id: string
  product_id: string
  name: string
  unit_weight_kg: number
  units_per_carton: number | null
  carton_price_rmb: number
  bag_price_rmb: number
  inner_pack_type: 'none' | 'carton' | 'woven_bag' | 'small_box' | 'big_box'
  unit_cbm: number | null
  carton_cbm: number | null
}

interface PackagingRecommendation {
  id: string
  product_id: string
  inner_pack_type?: 'none' | 'carton' | 'woven_bag' | 'small_box' | 'big_box' | null
  unit_weight_kg: number
  recommended_units_per_carton: number
  notes?: string | null
}

interface Factory {
  id: string
  name: string
  default_port_id: string | null
}

interface FactoryProductCost {
  id: string
  factory_id: string
  product_id: string
  cost_rmb_per_ton: number
}

interface Port {
  id: string
  name: string
  code: string
}

interface PortChargesRule {
  id: string
  port_id: string | null
  mode: Mode
  container_type: ContainerType | null
  base_rmb: number
  extra_rmb_per_ton: number
}

interface ContainerLoadRule {
  id: string
  product_id: string
  container_type: ContainerType
  max_tons: number
}

interface LandFreightRule {
  id: string
  mode: Mode
  factory_id: string | null
  container_type: ContainerType
  min_rmb_per_ton: number
  max_rmb_per_ton: number
  default_rmb_per_ton: number
}

interface FactoryPackagingOverride {
  id: string
  factory_id: string
  packaging_option_id: string
  carton_price_rmb_override?: number | null
  bag_price_rmb_override?: number | null
}

interface CalculationHistory {
  id: string
  timestamp: string
  payload: unknown
}

interface AppData {
  schema_version: number
  settings: Settings
  products: Product[]
  packaging_options: PackagingOption[]
  packaging_recommendations: PackagingRecommendation[]
  factories: Factory[]
  factory_product_costs: FactoryProductCost[]
  ports: Port[]
  port_charges_rules: PortChargesRule[]
  container_load_rules: ContainerLoadRule[]
  land_freight_rules: LandFreightRule[]
  factory_packaging_overrides: FactoryPackagingOverride[]
  history: CalculationHistory[]
}

interface LegacyProduct {
  name?: string
  vat_rate?: number | string | null
  refund_rate?: number | string | null
  price_per_ton?: number | string | null
  origin?: string
  custom_pkg_price?: number | string | null
  units_per_box?: number | string | null
  box_unit_price?: number | string | null
  shipping_fees?: Record<string, number>
  bag_weight?: number | string | null
  unit_weight_kg?: number | string | null
}

interface LegacyData {
  products?: LegacyProduct[]
  history?: unknown[]
}

type EditableTableKey =
  | 'products'
  | 'packaging_options'
  | 'packaging_recommendations'
  | 'factories'
  | 'factory_product_costs'
  | 'ports'
  | 'port_charges_rules'
  | 'container_load_rules'
  | 'land_freight_rules'
  | 'factory_packaging_overrides'

const SCHEMA_VERSION = 4
const EDITABLE_TABLES: EditableTableKey[] = [
  'products',
  'packaging_options',
  'packaging_recommendations',
  'factories',
  'factory_product_costs',
  'ports',
  'port_charges_rules',
  'container_load_rules',
  'land_freight_rules',
  'factory_packaging_overrides',
]

const file = path.join(process.cwd(), 'data.json')

class Utf8JsonFile<T> {
  private filename: string

  constructor(filename: string) {
    this.filename = filename
  }

  async read(): Promise<T | null> {
    try {
      const text = await readFile(this.filename, 'utf-8')
      const normalized = text.replace(/^\uFEFF/, '')
      return JSON.parse(normalized) as T
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'ENOENT') return null
      throw error
    }
  }

  async write(data: T): Promise<void> {
    const text = JSON.stringify(data, null, 2)
    await writeFile(this.filename, text, 'utf-8')
  }
}

const adapter = new Utf8JsonFile<AppData | LegacyData>(file)
const db = new Low<AppData | LegacyData>(adapter, createEmptyData())

process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
process.env.VITE_PUBLIC = path.join(process.env.APP_ROOT, 'public')

let win: BrowserWindow | null = null
let latestUpdateSnapshot: {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string | null
  htmlUrl: string | null
  publishedAt: string | null
  message: string
  checkedAtISO: string
} | null = null

function normalizeRepoName(value: unknown, fallback = 'AmBiTTion/NB-JP---IN-QUOTER'): string {
  const raw = String(value ?? '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '')
  if (!raw) return fallback
  const match = raw.match(/^[^/]+\/[^/]+$/)
  return match ? raw : fallback
}

function parseSemver(version: string): number[] {
  const clean = String(version ?? '').trim().replace(/^v/i, '')
  return clean
    .split('.')
    .map((n) => Number(n))
    .map((n) => (Number.isFinite(n) ? n : 0))
}

function isVersionGreater(a: string, b: string): boolean {
  const av = parseSemver(a)
  const bv = parseSemver(b)
  const maxLen = Math.max(av.length, bv.length, 3)
  for (let i = 0; i < maxLen; i += 1) {
    const ai = av[i] ?? 0
    const bi = bv[i] ?? 0
    if (ai > bi) return true
    if (ai < bi) return false
  }
  return false
}

async function checkGitHubLatestRelease(repo: string) {
  const url = `https://api.github.com/repos/${repo}/releases/latest`
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'NB-JP-IN-QUOTER',
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub release check failed: ${response.status}`)
  }

  const json = (await response.json()) as {
    tag_name?: string
    html_url?: string
    published_at?: string
  }
  return {
    latestVersion: String(json.tag_name ?? '').replace(/^v/i, ''),
    htmlUrl: json.html_url ? String(json.html_url) : null,
    publishedAt: json.published_at ? String(json.published_at) : null,
  }
}

async function checkForUpdatesInternal() {
  const appData = getAppData()
  const repo = normalizeRepoName(appData.settings.update_repo)
  const currentVersion = String(app.getVersion() || '0.0.0').replace(/^v/i, '')
  const checkedAtISO = new Date().toISOString()

  try {
    const latest = await checkGitHubLatestRelease(repo)
    const hasUpdate = latest.latestVersion
      ? isVersionGreater(latest.latestVersion, currentVersion)
      : false
    latestUpdateSnapshot = {
      hasUpdate,
      currentVersion,
      latestVersion: latest.latestVersion || null,
      htmlUrl: latest.htmlUrl,
      publishedAt: latest.publishedAt,
      message: hasUpdate ? '有新版本可更新' : '已是最新版本',
      checkedAtISO,
    }
    return { success: true, ...latestUpdateSnapshot }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    latestUpdateSnapshot = {
      hasUpdate: false,
      currentVersion,
      latestVersion: null,
      htmlUrl: null,
      publishedAt: null,
      message,
      checkedAtISO,
    }
    return { success: false, ...latestUpdateSnapshot }
  }
}

function resolveAppIconPath(): string {
  const candidates = [
    path.join(process.cwd(), 'resources', 'app.ico'),
    path.join(process.env.APP_ROOT ?? '', 'resources', 'app.ico'),
    path.join(process.resourcesPath, 'resources', 'app.ico'),
  ]
  return candidates.find((item) => item && item.trim().length > 0) ?? path.join(process.cwd(), 'resources', 'app.ico')
}

function createEmptyData(): AppData {
  return {
    schema_version: SCHEMA_VERSION,
    settings: {
      fx_rate: 6.9,
      margin_pct: 0.05,
      quote_valid_days: 7,
      ui_theme: 'classic',
      auto_update_enabled: true,
      update_repo: 'AmBiTTion/NB-JP---IN-QUOTER',
      money_format: {
        rmb_decimals: 4,
        usd_decimals: 4,
      },
      pricing_formula_mode: 'divide',
      rounding_policy: 'ceil',
      terms_template: '',
    },
    products: [],
    packaging_options: [],
    packaging_recommendations: [],
    factories: [],
    factory_product_costs: [],
    ports: [
      {
        id: 'port_default',
        name: 'Default POL',
        code: 'DEFAULT',
      },
    ],
    port_charges_rules: [
      {
        id: 'pcr_fcl_20gp_default',
        port_id: null,
        mode: 'FCL',
        container_type: '20GP',
        base_rmb: 3500,
        extra_rmb_per_ton: 0,
      },
      {
        id: 'pcr_fcl_40hq_default',
        port_id: null,
        mode: 'FCL',
        container_type: '40HQ',
        base_rmb: 4200,
        extra_rmb_per_ton: 0,
      },
      {
        id: 'pcr_lcl_default',
        port_id: null,
        mode: 'LCL',
        container_type: null,
        base_rmb: 400,
        extra_rmb_per_ton: 300,
      },
    ],
    container_load_rules: [],
    land_freight_rules: [],
    factory_packaging_overrides: [],
    history: [],
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toNumber(value: unknown, fallback: number): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalizeRate(value: unknown, fallback: number): number {
  const num = toNumber(value, fallback)
  return num > 1 ? num / 100 : num
}

function nonEmptyText(value: unknown, fallback: string): string {
  const str = String(value ?? '').trim()
  return str.length > 0 ? str : fallback
}

function normalizeUiTheme(
  value: unknown,
  fallback: 'classic' | 'neon' | 'minimal' = 'classic',
): 'classic' | 'neon' | 'minimal' {
  const v = String(value ?? '').trim()
  if (v === 'classic' || v === 'neon' || v === 'minimal') return v
  if (v === 'creative') return 'neon'
  return fallback
}

function toHistory(input: unknown[], fallbackTimestamp: string): CalculationHistory[] {
  return input.map((item, index) => {
    if (isObject(item)) {
      const maybeTimestamp = nonEmptyText(item.timestamp, '')
      return {
        id: nonEmptyText(item.id, `hist_${index + 1}`),
        timestamp: maybeTimestamp || fallbackTimestamp,
        payload: item,
      }
    }

    return {
      id: `hist_${index + 1}`,
      timestamp: fallbackTimestamp,
      payload: item,
    }
  })
}

function migrateLegacyData(raw: LegacyData): AppData {
  const oldProducts = Array.isArray(raw.products) ? raw.products : []
  const nowIso = new Date().toISOString()

  const portNameToId = new Map<string, string>()
  const ports: Port[] = []

  oldProducts.forEach((product) => {
    const shippingFees = isObject(product.shipping_fees)
      ? (product.shipping_fees as Record<string, number>)
      : {}
    Object.keys(shippingFees).forEach((portName) => {
      const key = nonEmptyText(portName, '')
      if (!key || portNameToId.has(key)) return
      const id = `port_${ports.length + 1}`
      portNameToId.set(key, id)
      ports.push({
        id,
        name: key,
        code: key.toUpperCase().replace(/\s+/g, '_').slice(0, 16),
      })
    })
  })

  if (ports.length === 0) {
    ports.push({
      id: 'port_default',
      name: 'Default POL',
      code: 'DEFAULT',
    })
  }

  const defaultPortId = ports[0].id

  const factories: Factory[] = []
  const factoryNameToId = new Map<string, string>()
  const getFactoryId = (origin: unknown): string => {
    const name = nonEmptyText(origin, 'Default Factory')
    if (factoryNameToId.has(name)) {
      return factoryNameToId.get(name) as string
    }

    const id = `factory_${factories.length + 1}`
    factoryNameToId.set(name, id)
    factories.push({
      id,
      name,
      default_port_id: defaultPortId,
    })
    return id
  }

  const products: Product[] = []
  const packagingOptions: PackagingOption[] = []
  const factoryProductCosts: FactoryProductCost[] = []
  const containerLoadRules: ContainerLoadRule[] = []
  const factoryPackagingOverrides: FactoryPackagingOverride[] = []
  const packagingRecommendations: PackagingRecommendation[] = []

  oldProducts.forEach((legacy, index) => {
    const productId = `prod_${index + 1}`
    const name = nonEmptyText(legacy.name, `Product ${index + 1}`)
    const invoiceTaxPoint = normalizeRate(legacy.vat_rate, 0.03)
    const refundRate = normalizeRate(legacy.refund_rate, 0.09)
    const shippingFees = isObject(legacy.shipping_fees)
      ? (legacy.shipping_fees as Record<string, number>)
      : {}
    const firstPortName = Object.keys(shippingFees)[0]
    const mappedPortId = firstPortName ? portNameToId.get(firstPortName) : null

    products.push({
      id: productId,
      name,
      refund_rate: refundRate,
      purchase_vat_rate: 0.13,
      invoice_tax_point: invoiceTaxPoint,
      pol_port_id: mappedPortId ?? defaultPortId,
    })

    const unitWeightKg = toNumber(legacy.bag_weight ?? legacy.unit_weight_kg, 4)
    const unitsPerCartonRaw = toNumber(legacy.units_per_box, 0)
    const unitsPerCarton = unitsPerCartonRaw > 0 ? Math.round(unitsPerCartonRaw) : null

    const packagingId = `pack_${index + 1}`
    packagingOptions.push({
      id: packagingId,
      product_id: productId,
      name: `${name} 默认包装`,
      unit_weight_kg: unitWeightKg,
      units_per_carton: unitsPerCarton,
      carton_price_rmb: toNumber(legacy.box_unit_price, 0),
      bag_price_rmb: toNumber(legacy.custom_pkg_price, 0),
      inner_pack_type: unitsPerCarton && unitsPerCarton > 0 ? 'carton' : 'none',
      unit_cbm: null,
      carton_cbm: null,
    })

    const factoryId = getFactoryId(legacy.origin)
    factoryProductCosts.push({
      id: `fpc_${index + 1}`,
      factory_id: factoryId,
      product_id: productId,
      cost_rmb_per_ton: toNumber(legacy.price_per_ton, 0),
    })

    containerLoadRules.push({
      id: `clr_${productId}_20gp`,
      product_id: productId,
      container_type: '20GP',
      max_tons: 17,
    })
    containerLoadRules.push({
      id: `clr_${productId}_40hq`,
      product_id: productId,
      container_type: '40HQ',
      max_tons: 25,
    })
    factoryPackagingOverrides.push({
      id: `fpo_${index + 1}`,
      factory_id: factoryId,
      packaging_option_id: packagingId,
      carton_price_rmb_override: toNumber(legacy.box_unit_price, 0),
      bag_price_rmb_override: toNumber(legacy.custom_pkg_price, 0),
    })
  })

  const landFreightRules: LandFreightRule[] = []
  factories.forEach((factory, index) => {
    landFreightRules.push({
      id: `lfr_${index + 1}_20gp`,
      mode: 'FCL',
      factory_id: factory.id,
      container_type: '20GP',
      min_rmb_per_ton: 1500,
      max_rmb_per_ton: 2500,
      default_rmb_per_ton: 1800,
    })
    landFreightRules.push({
      id: `lfr_${index + 1}_40hq`,
      mode: 'FCL',
      factory_id: factory.id,
      container_type: '40HQ',
      min_rmb_per_ton: 1800,
      max_rmb_per_ton: 3200,
      default_rmb_per_ton: 2200,
    })
  })

  if (landFreightRules.length === 0) {
    landFreightRules.push({
      id: 'lfr_default_20gp',
      mode: 'FCL',
      factory_id: null,
      container_type: '20GP',
      min_rmb_per_ton: 1500,
      max_rmb_per_ton: 2500,
      default_rmb_per_ton: 1800,
    })
    landFreightRules.push({
      id: 'lfr_default_40hq',
      mode: 'FCL',
      factory_id: null,
      container_type: '40HQ',
      min_rmb_per_ton: 1800,
      max_rmb_per_ton: 3200,
      default_rmb_per_ton: 2200,
    })
  }

  const historyInput = Array.isArray(raw.history) ? raw.history : []

  return {
    schema_version: SCHEMA_VERSION,
    settings: {
      fx_rate: 6.9,
      margin_pct: 0.05,
      quote_valid_days: 7,
      ui_theme: 'classic',
      auto_update_enabled: true,
      update_repo: 'AmBiTTion/NB-JP---IN-QUOTER',
      money_format: {
        rmb_decimals: 4,
        usd_decimals: 4,
      },
      pricing_formula_mode: 'divide',
      rounding_policy: 'ceil',
      terms_template: '',
    },
    products,
    packaging_options: packagingOptions,
    packaging_recommendations: packagingRecommendations,
    factories,
    factory_product_costs: factoryProductCosts,
    ports,
    port_charges_rules: [
      {
        id: 'pcr_fcl_20gp_default',
        port_id: null,
        mode: 'FCL',
        container_type: '20GP',
        base_rmb: 3500,
        extra_rmb_per_ton: 0,
      },
      {
        id: 'pcr_fcl_40hq_default',
        port_id: null,
        mode: 'FCL',
        container_type: '40HQ',
        base_rmb: 4200,
        extra_rmb_per_ton: 0,
      },
      {
        id: 'pcr_lcl_default',
        port_id: null,
        mode: 'LCL',
        container_type: null,
        base_rmb: 400,
        extra_rmb_per_ton: 300,
      },
    ],
    container_load_rules: containerLoadRules,
    land_freight_rules: landFreightRules,
    factory_packaging_overrides: factoryPackagingOverrides,
    history: toHistory(historyInput, nowIso),
  }
}

function isAppDataLike(raw: unknown): raw is AppData {
  if (!isObject(raw)) return false
  const candidate = raw as Record<string, unknown>
  return (
    Array.isArray((candidate as any).products) &&
    Array.isArray((candidate as any).packaging_options) &&
    Array.isArray((candidate as any).factories) &&
    Array.isArray((candidate as any).factory_product_costs) &&
    Array.isArray((candidate as any).factory_packaging_overrides)
  )
}

function normalizeAppData(raw: AppData): AppData {
  const normalized = { ...createEmptyData(), ...raw }
  normalized.schema_version = SCHEMA_VERSION
  normalized.settings = {
    fx_rate: toNumber(raw.settings?.fx_rate, 6.9),
    margin_pct: toNumber(raw.settings?.margin_pct, 0.05),
    quote_valid_days: toNumber(raw.settings?.quote_valid_days, 7),
    ui_theme: normalizeUiTheme(raw.settings?.ui_theme, 'classic'),
    auto_update_enabled:
      raw.settings?.auto_update_enabled === undefined
        ? true
        : Boolean(raw.settings?.auto_update_enabled),
    update_repo: normalizeRepoName(raw.settings?.update_repo, 'AmBiTTion/NB-JP---IN-QUOTER'),
    money_format: {
      rmb_decimals: toNumber(raw.settings?.money_format?.rmb_decimals, 4),
      usd_decimals: toNumber(raw.settings?.money_format?.usd_decimals, 4),
    },
    pricing_formula_mode: nonEmptyText(raw.settings?.pricing_formula_mode, 'divide'),
    rounding_policy: nonEmptyText(raw.settings?.rounding_policy, 'ceil'),
    terms_template: nonEmptyText(raw.settings?.terms_template, ''),
  }

  if (!Array.isArray(raw.ports) || raw.ports.length === 0) {
    normalized.ports = createEmptyData().ports
  }

  if (!Array.isArray(raw.port_charges_rules) || raw.port_charges_rules.length === 0) {
    normalized.port_charges_rules = createEmptyData().port_charges_rules
  }

  if (Array.isArray(raw.land_freight_rules)) {
    normalized.land_freight_rules = raw.land_freight_rules.map((rule: any) => {
      if (rule.min_rmb_per_ton !== undefined || rule.max_rmb_per_ton !== undefined) {
        return rule
      }
      return {
        ...rule,
        min_rmb_per_ton: toNumber(rule.min_rmb, 0),
        max_rmb_per_ton: toNumber(rule.max_rmb, 0),
        default_rmb_per_ton: toNumber(rule.default_rmb, 0),
        mode: rule.mode ?? 'FCL',
      }
    })
  }

  if (!Array.isArray(raw.packaging_recommendations)) {
    normalized.packaging_recommendations = []
  }

  if (!Array.isArray(raw.factory_packaging_overrides)) {
    normalized.factory_packaging_overrides = []
  }

  return normalized
}

function ensureAppData(raw: AppData | LegacyData | null | undefined): AppData {
  if (!raw) return createEmptyData()
  if (isAppDataLike(raw)) {
    return normalizeAppData(raw as AppData)
  }
  return migrateLegacyData(raw as LegacyData)
}

function getAppData(): AppData {
  return db.data as AppData
}

async function initializeDatabase(): Promise<void> {
  await db.read()
  db.data = ensureAppData(db.data)
  await db.write()
}

async function loadProducts(): Promise<Product[]> {
  return getAppData().products
}

function createWindow(): void {
  const appIconPath = resolveAppIconPath()

  win = new BrowserWindow({
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.webContents.on('did-finish-load', async () => {
    const products = await loadProducts()
    win?.webContents.send('product-data', products)
  })

  if (!VITE_DEV_SERVER_URL) {
    console.error('Dev server URL is missing. Please start the app with npm run dev.')
    app.quit()
    return
  }

  win.loadURL(VITE_DEV_SERVER_URL)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  app.setAppUserModelId('com.myquater.app')
  await initializeDatabase()
  createWindow()
  const appData = getAppData()
  if (appData.settings.auto_update_enabled !== false) {
    void checkForUpdatesInternal()
  }
})

ipcMain.on('request-products', async (event) => {
  const products = await loadProducts()
  event.sender.send('product-data', products)
})

ipcMain.handle('get-products', () => {
  return getAppData().products
})

ipcMain.handle('get-app-data', () => {
  return getAppData()
})

ipcMain.handle('replace-table', async (_event, payload: { table: EditableTableKey; records: unknown }) => {
  if (!payload || !EDITABLE_TABLES.includes(payload.table)) {
    return { success: false, message: 'Invalid table name' }
  }
  if (!Array.isArray(payload.records)) {
    return { success: false, message: 'Records must be an array' }
  }

  const appData = getAppData()
  ;(appData as unknown as Record<EditableTableKey, unknown[]>)[payload.table] = payload.records
  await db.write()
  return { success: true }
})

ipcMain.handle('update-settings', async (_event, settings: Partial<Settings>) => {
  const appData = getAppData()
  appData.settings = {
    fx_rate: toNumber(settings?.fx_rate, appData.settings.fx_rate ?? 6.9),
    margin_pct: toNumber(settings?.margin_pct, appData.settings.margin_pct ?? 0.05),
    quote_valid_days: toNumber(
      settings?.quote_valid_days,
      appData.settings.quote_valid_days ?? 7,
    ),
    ui_theme: normalizeUiTheme(settings?.ui_theme, appData.settings.ui_theme ?? 'classic'),
    auto_update_enabled:
      settings?.auto_update_enabled === undefined
        ? (appData.settings.auto_update_enabled ?? true)
        : Boolean(settings.auto_update_enabled),
    update_repo: normalizeRepoName(
      settings?.update_repo,
      appData.settings.update_repo ?? 'AmBiTTion/NB-JP---IN-QUOTER',
    ),
    money_format: {
      rmb_decimals: toNumber(
        settings?.money_format?.rmb_decimals,
        appData.settings.money_format?.rmb_decimals ?? 4,
      ),
      usd_decimals: toNumber(
        settings?.money_format?.usd_decimals,
        appData.settings.money_format?.usd_decimals ?? 4,
      ),
    },
    pricing_formula_mode: nonEmptyText(
      settings?.pricing_formula_mode,
      appData.settings.pricing_formula_mode ?? 'divide',
    ),
    rounding_policy: nonEmptyText(
      settings?.rounding_policy,
      appData.settings.rounding_policy ?? 'ceil',
    ),
    terms_template: nonEmptyText(
      settings?.terms_template,
      appData.settings.terms_template ?? '',
    ),
  }
  await db.write()
  return { success: true }
})

ipcMain.handle('check-for-updates', async () => {
  return checkForUpdatesInternal()
})

ipcMain.handle('open-update-download-page', async (_event, payload: { url?: string }) => {
  const appData = getAppData()
  const repo = normalizeRepoName(appData.settings.update_repo)
  const url =
    payload?.url && /^https?:\/\//.test(payload.url)
      ? payload.url
      : latestUpdateSnapshot?.htmlUrl ?? `https://github.com/${repo}/releases/latest`
  await shell.openExternal(url)
  return { success: true, url }
})

ipcMain.handle('get-history', () => {
  return getAppData().history
})

ipcMain.handle('save-calculation', async (_event, payload: unknown) => {
  const appData = getAppData()
  appData.history.push({
    id: `hist_${Date.now()}`,
    timestamp: new Date().toISOString(),
    payload,
  })
  await db.write()
  return { success: true }
})

ipcMain.handle('select-product-image', async (_event, payload: { productId: string }) => {
  try {
    const openResult = win
      ? await dialog.showOpenDialog(win, {
          title: '选择产品图片',
          properties: ['openFile'],
          filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg'] }],
        })
      : await dialog.showOpenDialog({
          title: '选择产品图片',
          properties: ['openFile'],
          filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg'] }],
        })

    if (openResult.canceled || openResult.filePaths.length === 0) {
      return { success: false, canceled: true, message: '用户取消选择。' }
    }

    const sourcePath = openResult.filePaths[0]
    const ext = path.extname(sourcePath).toLowerCase()
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
      return { success: false, message: '仅支持 png/jpg/jpeg 格式。' }
    }

    const safeProductId = String(payload?.productId ?? 'product').replace(/[^a-zA-Z0-9_-]/g, '_')
    const imageDir = path.join(app.getPath('userData'), 'product_images')
    await mkdir(imageDir, { recursive: true })
    const targetPath = path.join(imageDir, `${safeProductId}_${Date.now()}${ext}`)
    await copyFile(sourcePath, targetPath)
    await access(targetPath, fsConstants.F_OK)
    return { success: true, filePath: targetPath }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, message }
  }
})

ipcMain.handle('export-external-quotation-xlsx', async (_event, payload: ExternalQuotationPayload) => {
  try {
    const templatePath = path.join(process.cwd(), 'resources', 'quotation_template.xlsx')
    await access(templatePath, fsConstants.F_OK)

    const sanitize = (value: unknown, fallback: string) => {
      const raw = String(value ?? '').trim() || fallback
      return raw
        .replace(/[\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    }
    const fmtDate = (date: Date) => {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }

    const container = payload?.input?.containerType ?? payload?.quoteResult?.summary?.container_type ?? '20GP'
    const containerText = container === '20GP' ? '20FT' : '40HQ'
    const weight = Number(payload?.input?.unitWeightKg ?? 0)
    const weightText = Number.isFinite(weight) && weight > 0 ? `${Number(weight.toFixed(2)).toString()}KG` : '0KG'
    const productName = sanitize(
      payload?.input?.name_en || payload?.input?.productNameEn || payload?.input?.productName,
      'Cat Litter',
    )
    const dt = payload?.meta?.exportedAtISO ? new Date(payload.meta.exportedAtISO) : new Date()
    const dateText = fmtDate(dt)
    const baseName = `NINGBO JIUPENG TRADE CO. Quotation-${productName}-${weightText}${containerText}-${dateText}`
    const desktopPath = app.getPath('desktop')
    let outputPath = path.join(desktopPath, `${baseName}.xlsx`)

    let index = 1
    while (true) {
      try {
        await access(outputPath, fsConstants.F_OK)
        outputPath = path.join(desktopPath, `${baseName} (${index}).xlsx`)
        index += 1
      } catch {
        break
      }
    }

    await exportExternalQuotationExcel(payload, templatePath, outputPath)
    return { success: true, filePath: outputPath }
  } catch (error) {
    const code = (error as { code?: string })?.code
    const message =
      code === 'ENOENT'
        ? 'Template file resources/quotation_template.xlsx not found.'
        : error instanceof Error
          ? error.message
          : String(error)
    return { success: false, message }
  }
})

