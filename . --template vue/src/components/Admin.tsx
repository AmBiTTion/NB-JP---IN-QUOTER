import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Select as MantineSelect, Text } from '@mantine/core'
import type {
  AppData,
  CalculationHistory,
  ContainerLoadRule,
  Customer,
  EditableTableKey,
  Factory,
  FactoryPackagingOverride,
  FactoryProductCost,
  InnerPackType,
  LandFreightRule,
  PackagingOption,
  PackagingRecommendation,
  Port,
  PortChargesRule,
  Product,
  UserRole,
  UserProfile,
} from '@/types/domain'
import { nextIdFromRows } from '@/utils/id'
import { useUiTheme } from '@/ui/ThemeProvider'
import { ta, tf } from '@/i18n/admin'
import {
  applyCustomThemeOverrides,
  defaultCustomThemeOverrides,
  loadCustomThemeOverrides,
  saveCustomThemeOverrides,
  type CustomThemeOverrides,
} from '@/ui/customTheme'

type TabKey = EditableTableKey | 'settings'
type ColumnType = 'text' | 'number' | 'select' | 'checkbox'

type TableState = {
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
  customers: Customer[]
}

type Column<T> = {
  key: keyof T
  label: string
  type: ColumnType
  options?: Array<{ value: string; label: string }>
  width?: number
  nullable?: boolean
  readOnly?: boolean
  step?: string
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'products', label: ta('tabs.products') },
  { key: 'packaging_options', label: ta('tabs.packaging_options') },
  { key: 'packaging_recommendations', label: ta('tabs.packaging_recommendations') },
  { key: 'factories', label: ta('tabs.factories') },
  { key: 'factory_product_costs', label: ta('tabs.factory_product_costs') },
  { key: 'ports', label: ta('tabs.ports') },
  { key: 'port_charges_rules', label: ta('tabs.port_charges_rules') },
  { key: 'container_load_rules', label: ta('tabs.container_load_rules') },
  { key: 'land_freight_rules', label: ta('tabs.land_freight_rules') },
  { key: 'factory_packaging_overrides', label: ta('tabs.factory_packaging_overrides') },
  { key: 'customers', label: ta('tabs.customers') },
  { key: 'settings', label: ta('tabs.settings') },
]

const ID_PREFIX: Record<EditableTableKey, string> = {
  products: 'prod', packaging_options: 'pack', packaging_recommendations: 'pr', factories: 'fct',
  factory_product_costs: 'fpc', ports: 'port', port_charges_rules: 'pcr', container_load_rules: 'clr',
  land_freight_rules: 'lfr', factory_packaging_overrides: 'fpo', customers: 'cus',
}

const LABELS: Record<string, string> = {
  id: ta('fields.id'), name: ta('fields.name'), product_id: ta('fields.product_id'), factory_id: ta('fields.factory_id'), packaging_option_id: ta('fields.packaging_option_id'),
  refund_rate: ta('fields.refund_rate'), purchase_vat_rate: ta('fields.purchase_vat_rate'), invoice_tax_point: ta('fields.invoice_tax_point'), pol_port_id: ta('fields.pol_port_id'),
  unit_weight_kg: ta('fields.unit_weight_kg'), units_per_carton: ta('fields.units_per_carton'), carton_price_rmb: ta('fields.carton_price_rmb'), bag_price_rmb: ta('fields.bag_price_rmb'),
  inner_pack_type: ta('fields.inner_pack_type'), cost_rmb_per_ton: ta('fields.cost_rmb_per_ton'), max_tons: ta('fields.max_tons'),
  port_id: ta('fields.port_id'), mode: ta('fields.mode'), container_type: ta('fields.container_type'), base_rmb: ta('fields.base_rmb'), extra_rmb_per_ton: ta('fields.extra_rmb_per_ton'),
  min_rmb_per_ton: ta('fields.min_rmb_per_ton'), max_rmb_per_ton: ta('fields.max_rmb_per_ton'), default_rmb_per_ton: ta('fields.default_rmb_per_ton'),
  cost_unit: ta('fields.cost_unit'),
  fx_rate: ta('fields.fx_rate'), margin_pct: ta('fields.margin_pct'), quote_valid_days: ta('fields.quote_valid_days'), pricing_formula_mode: ta('fields.pricing_formula_mode'),
  rounding_policy: ta('fields.rounding_policy'), terms_template: ta('fields.terms_template'), ui_theme: ta('fields.ui_theme'), money_format_rmb_decimals: ta('fields.money_format_rmb_decimals'), money_format_usd_decimals: ta('fields.money_format_usd_decimals'),
  recommended_units_per_carton: ta('fields.recommended_units_per_carton'), notes: ta('fields.notes'), carton_price_rmb_override: ta('fields.carton_price_rmb_override'), bag_price_rmb_override: ta('fields.bag_price_rmb_override'),
  contact: ta('fields.contact'),
  default_port_id: ta('fields.default_port_id'),
  customer_terms_template: ta('fields.customer_terms_template'),
}

const INNER_PACK_LABELS: Record<InnerPackType, string> = { none: ta('innerPack.none'), carton: ta('innerPack.carton'), woven_bag: ta('innerPack.woven_bag'), small_box: ta('innerPack.small_box'), big_box: ta('innerPack.big_box') }

const inputBaseStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 12,
  border: '1px solid var(--border-1)',
  backgroundColor: 'var(--surface-2)',
  color: '#fff',
}
const fieldLabelStyle: React.CSSProperties = { color: 'var(--text-dim)', fontSize: 12, marginBottom: 6 }

const labelFor = (k: string, fb?: string) => LABELS[k] ?? fb ?? k
const createEmptyTables = (): TableState => ({
  products: [], packaging_options: [], packaging_recommendations: [], factories: [], factory_product_costs: [],
  ports: [], port_charges_rules: [], container_load_rules: [], land_freight_rules: [], factory_packaging_overrides: [],
  customers: [],
})
const isBlank = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim().length === 0)
const isFiniteNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const parseNumberInput = (v: string, nullable: boolean): number | null => {
  const t = v.trim(); if (t === '') return nullable ? null : Number.NaN; const n = Number(t); return Number.isFinite(n) ? n : Number.NaN
}
const formatNumberInput = (v: unknown) => (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v)) ? '' : String(v))

function EditableTable<T extends { id: string }>(props: {
  columns: Array<Column<T>>; rows: T[]; onChange: (rowId: string, key: keyof T, value: unknown) => void; onDelete: (rowId: string) => void; renderActions?: (row: T) => ReactNode
}) {
  const { columns, rows, onChange, onDelete, renderActions } = props
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="admin-table">
        <thead><tr style={{ textAlign: 'left' }}>{columns.map((c) => <th key={String(c.key)} style={{ width: c.width }}>{c.label}</th>)}<th>{ta('common.action')}</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>{columns.map((c) => {
          const raw = row[c.key] as unknown
          if (c.type === 'checkbox') return <td key={String(c.key)}><input type="checkbox" checked={Boolean(raw)} disabled={c.readOnly} onChange={(e) => onChange(row.id, c.key, e.target.checked)} /></td>
          if (c.type === 'select') return <td key={String(c.key)}><MantineSelect className="ui-select" value={((raw ?? '') as string) || ''} disabled={c.readOnly} onChange={(value) => onChange(row.id, c.key, value ?? '')} data={c.options ?? []} searchable={false} allowDeselect={false} styles={{ input: inputBaseStyle, dropdown: { backgroundColor: 'var(--surface-2)' } }} /></td>
          if (c.type === 'number') return <td key={String(c.key)}><input type="number" step={c.step ?? '0.01'} value={formatNumberInput(raw)} readOnly={c.readOnly} onChange={(e) => onChange(row.id, c.key, parseNumberInput(e.target.value, Boolean(c.nullable)))} style={{ ...inputBaseStyle, backgroundColor: 'var(--surface-2)' }} /></td>
          return <td key={String(c.key)}><input type="text" value={(raw ?? '') as string} readOnly={c.readOnly} onChange={(e) => onChange(row.id, c.key, e.target.value)} style={{ ...inputBaseStyle, backgroundColor: 'var(--surface-2)' }} /></td>
        })}<td>{renderActions && <span style={{ marginRight: 8 }}>{renderActions(row)}</span>}<button className="btn-danger-soft" onClick={() => onDelete(row.id)}>{ta('common.delete')}</button></td></tr>)}</tbody>
      </table>
    </div>
  )
}
export default function Admin() {
  const { setUiThemeKey } = useUiTheme()
  const [data, setData] = useState<AppData | null>(null)
  const [tables, setTables] = useState<TableState>(createEmptyTables())
  const [activeTab, setActiveTab] = useState<TabKey>('products')
  const [settingsFxRate, setSettingsFxRate] = useState('6.9')
  const [settingsMarginPct, setSettingsMarginPct] = useState('0.05')
  const [settingsQuoteValidDays, setSettingsQuoteValidDays] = useState('7')
  const [settingsRmbDecimals, setSettingsRmbDecimals] = useState('4')
  const [settingsUsdDecimals, setSettingsUsdDecimals] = useState('4')
  const [settingsPricingFormulaMode, setSettingsPricingFormulaMode] = useState('divide')
  const [settingsRoundingPolicy, setSettingsRoundingPolicy] = useState('ceil')
  const [settingsUiTheme, setSettingsUiTheme] = useState<'classic' | 'neon' | 'minimal' | 'paper'>('classic')
  const [settingsTermsTemplate, setSettingsTermsTemplate] = useState('')
  const [settingsUserProfiles, setSettingsUserProfiles] = useState<UserProfile[]>([])
  const [settingsActiveUserProfileId, setSettingsActiveUserProfileId] = useState('')
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [logsModalOpen, setLogsModalOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState<CalculationHistory[]>([])
  const [operationLogs, setOperationLogs] = useState<CalculationHistory[]>([])
  const [logActionFilter, setLogActionFilter] = useState('all')
  const [logSortOrder, setLogSortOrder] = useState<'desc' | 'asc'>('desc')
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [dirtyTables, setDirtyTables] = useState<EditableTableKey[]>([])
  const [dirtySettings, setDirtySettings] = useState(false)
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addDraftTable, setAddDraftTable] = useState<EditableTableKey | null>(null)
  const [addDraftRow, setAddDraftRow] = useState<Record<string, unknown> | null>(null)
  const [themeCustomOpen, setThemeCustomOpen] = useState(false)
  const [themeDraft, setThemeDraft] = useState<CustomThemeOverrides>(defaultCustomThemeOverrides)
  const autoSaveTimerRef = useRef<number | null>(null)
  const suppressAutoSaveRef = useRef(false)

  const autoSaveLabel = useMemo(() => {
    if (autoSaveState === 'saving') return ta('status.autoSaving')
    if (autoSaveState === 'error') return ta('status.autoSaveError')
    if (autoSaveState === 'saved') return ta('status.autoSaved')
    if (dirtyTables.length > 0 || dirtySettings) return ta('status.autoSavePending')
    return ta('status.idle')
  }, [autoSaveState, dirtyTables, dirtySettings])

  const autoSaveToneClass = autoSaveState === 'error'
    ? 'status-error'
    : autoSaveState === 'saving'
      ? 'status-warning'
      : autoSaveState === 'saved'
        ? 'status-success'
        : 'status-info'

  const loadData = useCallback(async () => {
    setError(''); setStatus(ta('statusText.loadingData'))
    try {
      // @ts-ignore
      const appData = (await window.ipcRenderer.invoke('get-app-data')) as AppData
      setData(appData)
      setTables({
        products: appData.products ?? [], packaging_options: appData.packaging_options ?? [], packaging_recommendations: appData.packaging_recommendations ?? [],
        factories: appData.factories ?? [], factory_product_costs: appData.factory_product_costs ?? [], ports: appData.ports ?? [],
        port_charges_rules: appData.port_charges_rules ?? [], container_load_rules: appData.container_load_rules ?? [],
        land_freight_rules: appData.land_freight_rules ?? [], factory_packaging_overrides: appData.factory_packaging_overrides ?? [], customers: appData.customers ?? [],
      })
      setSettingsFxRate(String(appData.settings.fx_rate ?? 6.9)); setSettingsMarginPct(String(appData.settings.margin_pct ?? 0.05)); setSettingsQuoteValidDays(String(appData.settings.quote_valid_days ?? 7))
      setSettingsRmbDecimals(String(appData.settings.money_format?.rmb_decimals ?? 4)); setSettingsUsdDecimals(String(appData.settings.money_format?.usd_decimals ?? 4))
      setSettingsPricingFormulaMode(appData.settings.pricing_formula_mode ?? 'divide'); setSettingsRoundingPolicy(appData.settings.rounding_policy ?? 'ceil'); const rawUiTheme = String(appData.settings.ui_theme ?? 'classic'); const loadedUiTheme = ((rawUiTheme === 'creative' ? 'neon' : rawUiTheme) as 'classic' | 'neon' | 'minimal' | 'paper' | undefined) ?? 'classic'; setSettingsUiTheme(loadedUiTheme); setUiThemeKey(loadedUiTheme); setSettingsTermsTemplate(appData.settings.terms_template ?? '')
      const profiles = (appData.settings.user_profiles ?? [{ id: 'user_default', name: ta('user.defaultName') }]).filter((p) => p?.id && p?.name)
      setSettingsUserProfiles(profiles)
      setSettingsActiveUserProfileId(appData.settings.active_user_profile_id ?? profiles[0]?.id ?? 'user_default')
      suppressAutoSaveRef.current = true; setDirtyTables([]); setDirtySettings(false); setAutoSaveState('idle'); setStatus(ta('common.dataLoaded'))
    } catch (e) {
      console.error(e); setError(ta('statusText.loadFailed')); setStatus('')
    }
  }, [])
  useEffect(() => { void loadData() }, [loadData])

  useEffect(() => {
    setThemeDraft(loadCustomThemeOverrides())
  }, [])

  const productOptions = useMemo(() => tables.products.map((x) => ({ value: x.id, label: x.name || x.id })), [tables.products])
  const factoryOptions = useMemo(() => tables.factories.map((x) => ({ value: x.id, label: x.name || x.id })), [tables.factories])
  const packagingOptions = useMemo(() => tables.packaging_options.map((x) => ({ value: x.id, label: x.name || x.id })), [tables.packaging_options])
  const portOptions = useMemo(() => tables.ports.map((x) => ({ value: x.id, label: x.name || x.id })), [tables.ports])
  const innerPackOptions: Array<{ value: InnerPackType; label: string }> = useMemo(() => Object.entries(INNER_PACK_LABELS).map(([v, l]) => ({ value: v as InnerPackType, label: l })), [])

  const markTableDirty = useCallback((table: EditableTableKey) => { setDirtyTables((p) => (p.includes(table) ? p : [...p, table])); setAutoSaveState('idle') }, [])

  const updateRow = useCallback((table: EditableTableKey, rowId: string, key: string, value: unknown) => {
    const nextValue = table === 'packaging_recommendations' && key === 'inner_pack_type' && value === '' ? null : value
    setTables((prev) => {
      const list = prev[table] as unknown as Array<Record<string, unknown>>
      const next = list.map((r) => (r.id === rowId ? { ...r, [key]: nextValue } : r))
      return { ...prev, [table]: next } as TableState
    })
    markTableDirty(table)
  }, [markTableDirty])

  const deleteRow = useCallback((table: EditableTableKey, rowId: string) => {
    setTables((prev) => {
      const list = prev[table] as unknown as Array<Record<string, unknown>>
      return { ...prev, [table]: list.filter((r) => r.id !== rowId) } as TableState
    })
    markTableDirty(table)
  }, [markTableDirty])

  const buildNewRow = useCallback((table: EditableTableKey) => {
    return (() => {
      switch (table) {
        case 'products': return { id: nextIdFromRows(ID_PREFIX.products, tables.products), name: '', name_en: '', description_en: '', image_path: '', refund_rate: 0, purchase_vat_rate: 0.13, invoice_tax_point: 0.03, pol_port_id: tables.ports[0]?.id ?? '' } satisfies Product
        case 'packaging_options': return { id: nextIdFromRows(ID_PREFIX.packaging_options, tables.packaging_options), product_id: tables.products[0]?.id ?? '', name: '', unit_weight_kg: 1, units_per_carton: null, carton_price_rmb: 0, bag_price_rmb: 0, inner_pack_type: 'none', unit_cbm: null, carton_cbm: null, default_selected: false } satisfies PackagingOption
        case 'packaging_recommendations': return { id: nextIdFromRows(ID_PREFIX.packaging_recommendations, tables.packaging_recommendations), product_id: tables.products[0]?.id ?? '', inner_pack_type: null, unit_weight_kg: 1, recommended_units_per_carton: 1, notes: '' } satisfies PackagingRecommendation
        case 'factories': return { id: nextIdFromRows(ID_PREFIX.factories, tables.factories), name: '', default_port_id: null } satisfies Factory
        case 'factory_product_costs': return { id: nextIdFromRows(ID_PREFIX.factory_product_costs, tables.factory_product_costs), factory_id: tables.factories[0]?.id ?? '', product_id: tables.products[0]?.id ?? '', cost_rmb_per_ton: 0, cost_unit: 'ton' } satisfies FactoryProductCost
        case 'ports': return { id: nextIdFromRows(ID_PREFIX.ports, tables.ports), name: '', code: '', country: null } satisfies Port
        case 'port_charges_rules': return { id: nextIdFromRows(ID_PREFIX.port_charges_rules, tables.port_charges_rules), port_id: null, mode: 'FCL', container_type: '20GP', base_rmb: 0, extra_rmb_per_ton: 0 } satisfies PortChargesRule
        case 'container_load_rules': return { id: nextIdFromRows(ID_PREFIX.container_load_rules, tables.container_load_rules), product_id: tables.products[0]?.id ?? '', container_type: '20GP', max_tons: 0 } satisfies ContainerLoadRule
        case 'land_freight_rules': return { id: nextIdFromRows(ID_PREFIX.land_freight_rules, tables.land_freight_rules), mode: 'FCL', factory_id: null, container_type: '20GP', min_rmb_per_ton: 0, max_rmb_per_ton: 0, default_rmb_per_ton: 0 } satisfies LandFreightRule
        case 'factory_packaging_overrides': return { id: nextIdFromRows(ID_PREFIX.factory_packaging_overrides, tables.factory_packaging_overrides), factory_id: tables.factories[0]?.id ?? '', packaging_option_id: tables.packaging_options[0]?.id ?? '', carton_price_rmb_override: null, bag_price_rmb_override: null } satisfies FactoryPackagingOverride
        case 'customers': return { id: nextIdFromRows(ID_PREFIX.customers, tables.customers), name: '', contact: '', default_port_id: null, terms_template: '' } satisfies Customer
        default: return null
      }
    })()
  }, [tables])

  const openAddModal = useCallback((table: EditableTableKey) => {
    const nextRow = buildNewRow(table)
    if (!nextRow) return
    setAddDraftTable(table)
    setAddDraftRow(nextRow as unknown as Record<string, unknown>)
    setAddModalOpen(true)
  }, [buildNewRow])

  const confirmAddRow = useCallback(() => {
    if (!addDraftTable || !addDraftRow) return
    setTables((prev) => ({ ...prev, [addDraftTable]: [...prev[addDraftTable], addDraftRow] }) as TableState)
    markTableDirty(addDraftTable)
    setAddModalOpen(false)
    setAddDraftTable(null)
    setAddDraftRow(null)
  }, [addDraftRow, addDraftTable, markTableDirty])

  const cancelAddRow = useCallback(() => {
    setAddModalOpen(false)
    setAddDraftTable(null)
    setAddDraftRow(null)
  }, [])
  const validateTable = useCallback((table: EditableTableKey): string[] => {
    const errors: string[] = []
    const rowPrefix = (key: EditableTableKey, i: number) => tf('validation.rowPrefix', { table: TABS.find((t) => t.key === key)?.label ?? key, index: i + 1 })
    const req = ta('validation.required')
    const num = ta('validation.mustBeNumber')
    const idLabel = ta('fields.id')
    if (table === 'products') {
      tables.products.forEach((r, i) => {
        const row = rowPrefix('products', i)
        if (isBlank(r.id)) errors.push(`${row}: ${labelFor('id')}${req}`)
        if (isBlank(r.name)) errors.push(`${row}: ${labelFor('name')}${req}`)
        if (!isFiniteNumber(r.refund_rate)) errors.push(`${row}: ${labelFor('refund_rate')}${num}`)
        if (!isFiniteNumber(r.purchase_vat_rate)) errors.push(`${row}: ${labelFor('purchase_vat_rate')}${num}`)
        if (!isFiniteNumber(r.invoice_tax_point)) errors.push(`${row}: ${labelFor('invoice_tax_point')}${num}`)
        if (isBlank(r.pol_port_id)) errors.push(`${row}: ${labelFor('pol_port_id')}${req}`)
      }); return errors
    }
    if (table === 'packaging_options') {
      const count = new Map<string, number>()
      tables.packaging_options.forEach((r, i) => {
        const row = rowPrefix('packaging_options', i)
        if (isBlank(r.id)) errors.push(`${row}: ${idLabel}${req}`)
        if (isBlank(r.product_id)) errors.push(`${row}: ${ta('fields.product_id')}${req}`)
        if (isBlank(r.name)) errors.push(`${row}: ${ta('fields.name')}${req}`)
        if (!isFiniteNumber(r.unit_weight_kg)) errors.push(`${row}: ${ta('fields.unit_weight_kg')}${num}`)
        if (!isFiniteNumber(r.carton_price_rmb)) errors.push(`${row}: ${ta('fields.carton_price_rmb')}${num}`)
        if (!isFiniteNumber(r.bag_price_rmb)) errors.push(`${row}: ${ta('fields.bag_price_rmb')}${num}`)
        if (isBlank(r.inner_pack_type)) errors.push(`${row}: ${ta('fields.inner_pack_type')}${req}`)
        if (r.default_selected) count.set(r.product_id, (count.get(r.product_id) ?? 0) + 1)
      })
      count.forEach((n, productId) => { if (n > 1) errors.push(tf('validation.defaultPackTooMany', { product: tables.products.find((x) => x.id === productId)?.name ?? productId })) })
      return errors
    }
    if (table === 'factory_product_costs') {
      const dup = new Set<string>()
      tables.factory_product_costs.forEach((r, i) => {
        const row = rowPrefix('factory_product_costs', i)
        if (isBlank(r.id)) errors.push(`${row}: ${idLabel}${req}`)
        if (isBlank(r.factory_id)) errors.push(`${row}: ${ta('fields.factory_id')}${req}`)
        if (isBlank(r.product_id)) errors.push(`${row}: ${ta('fields.product_id')}${req}`)
        if (!isFiniteNumber(r.cost_rmb_per_ton)) errors.push(`${row}: ${ta('fields.cost_rmb_per_ton')}${num}`)
        const key = `${r.factory_id}__${r.product_id}`
        if (dup.has(key)) errors.push(`${row}: ${ta('validation.duplicateFactoryProduct')}`)
        dup.add(key)
      }); return errors
    }
    const runBasic = <T extends { id: string }>(rows: T[], key: EditableTableKey, checks: Array<(row: T, rowLabel: string) => void>) => {
      rows.forEach((row, i) => { const rowLabel = rowPrefix(key, i); checks.forEach((fn) => fn(row, rowLabel)) })
    }
    if (table === 'packaging_recommendations') {
      runBasic(tables.packaging_recommendations, table, [
        (r, row) => { if (isBlank(r.id)) errors.push(`${row}: ${idLabel}${req}`) },
        (r, row) => { if (isBlank(r.product_id)) errors.push(`${row}: ${ta('fields.product_id')}${req}`) },
        (r, row) => { if (!isFiniteNumber(r.unit_weight_kg)) errors.push(`${row}: ${ta('fields.unit_weight_kg')}${num}`) },
        (r, row) => { if (!isFiniteNumber(r.recommended_units_per_carton)) errors.push(`${row}: ${ta('fields.recommended_units_per_carton')}${num}`) },
      ])
    }
    if (table === 'factories') runBasic(tables.factories, table, [(r, row) => { if (isBlank(r.id)) errors.push(`${row}: ${idLabel}${req}`); if (isBlank(r.name)) errors.push(`${row}: ${ta('fields.name')}${req}`) }])
    if (table === 'ports') runBasic(tables.ports, table, [(r, row) => { if (isBlank(r.id)) errors.push(`${row}: ${idLabel}${req}`); if (isBlank(r.name)) errors.push(`${row}: ${ta('fields.name')}${req}`); if (isBlank(r.code)) errors.push(`${row}: ${ta('fields.code')}${req}`) }])
    if (table === 'port_charges_rules') runBasic(tables.port_charges_rules, table, [(r, row) => { if (isBlank(r.id)) errors.push(`${row}: ${idLabel}${req}`); if (isBlank(r.mode)) errors.push(`${row}: ${ta('fields.mode')}${req}`); if (!isFiniteNumber(r.base_rmb)) errors.push(`${row}: ${ta('fields.base_rmb')}${num}`); if (!isFiniteNumber(r.extra_rmb_per_ton)) errors.push(`${row}: ${ta('fields.extra_rmb_per_ton')}${num}`) }])
    if (table === 'container_load_rules') runBasic(tables.container_load_rules, table, [(r, row) => { if (isBlank(r.id)) errors.push(`${row}: ${idLabel}${req}`); if (isBlank(r.product_id)) errors.push(`${row}: ${ta('fields.product_id')}${req}`); if (isBlank(r.container_type)) errors.push(`${row}: ${ta('fields.container_type')}${req}`); if (!isFiniteNumber(r.max_tons)) errors.push(`${row}: ${ta('fields.max_tons')}${num}`) }])
    if (table === 'land_freight_rules') runBasic(tables.land_freight_rules, table, [(r, row) => { if (isBlank(r.id)) errors.push(`${row}: ${idLabel}${req}`); if (isBlank(r.mode)) errors.push(`${row}: ${ta('fields.mode')}${req}`); if (isBlank(r.container_type)) errors.push(`${row}: ${ta('fields.container_type')}${req}`); if (!isFiniteNumber(r.min_rmb_per_ton)) errors.push(`${row}: ${ta('fields.min_rmb_per_ton')}${num}`); if (!isFiniteNumber(r.max_rmb_per_ton)) errors.push(`${row}: ${ta('fields.max_rmb_per_ton')}${num}`); if (!isFiniteNumber(r.default_rmb_per_ton)) errors.push(`${row}: ${ta('fields.default_rmb_per_ton')}${num}`) }])
    if (table === 'factory_packaging_overrides') runBasic(tables.factory_packaging_overrides, table, [(r, row) => { if (isBlank(r.id)) errors.push(`${row}: ${idLabel}${req}`); if (isBlank(r.factory_id)) errors.push(`${row}: ${ta('fields.factory_id')}${req}`); if (isBlank(r.packaging_option_id)) errors.push(`${row}: ${ta('fields.packaging_option_id')}${req}`); if (r.carton_price_rmb_override !== null && r.carton_price_rmb_override !== undefined && !isFiniteNumber(r.carton_price_rmb_override)) errors.push(`${row}: ${ta('fields.carton_price_rmb_override')}${num}`); if (r.bag_price_rmb_override !== null && r.bag_price_rmb_override !== undefined && !isFiniteNumber(r.bag_price_rmb_override)) errors.push(`${row}: ${ta('fields.bag_price_rmb_override')}${num}`) }])
    if (table === 'customers') runBasic(tables.customers, table, [(r, row) => { if (isBlank(r.id)) errors.push(`${row}: ${idLabel}${req}`); if (isBlank(r.name)) errors.push(`${row}: ${ta('fields.name')}${req}`) }])
    return errors
  }, [tables])

  const applyProductDefaults = useCallback((current: TableState) => {
    const existing = new Set((data?.products ?? []).map((x) => x.id))
    const newProducts = current.products.filter((x) => !existing.has(x.id))
    if (newProducts.length === 0) return { tables: current, touched: [] as EditableTableKey[] }
    const nextPackaging = [...current.packaging_options]; const nextCosts = [...current.factory_product_costs]; const nextContainers = [...current.container_load_rules]
    const touched = new Set<EditableTableKey>()
    newProducts.forEach((p) => {
      if (!nextPackaging.some((x) => x.product_id === p.id)) {
        nextPackaging.push({ id: nextIdFromRows(ID_PREFIX.packaging_options, nextPackaging), product_id: p.id, name: tf('statusText.newProductDefaultPack', { name: p.name }), unit_weight_kg: 1, units_per_carton: null, carton_price_rmb: 0, bag_price_rmb: 0, inner_pack_type: 'none', unit_cbm: null, carton_cbm: null, default_selected: true })
        touched.add('packaging_options')
      }
      current.factories.forEach((f) => {
        if (!nextCosts.some((x) => x.factory_id === f.id && x.product_id === p.id)) {
          nextCosts.push({ id: nextIdFromRows(ID_PREFIX.factory_product_costs, nextCosts), factory_id: f.id, product_id: p.id, cost_rmb_per_ton: 0, cost_unit: 'ton' })
          touched.add('factory_product_costs')
        }
      })
      ;(['20GP', '40HQ'] as Array<ContainerLoadRule['container_type']>).forEach((c) => {
        if (!nextContainers.some((x) => x.product_id === p.id && x.container_type === c)) {
          nextContainers.push({ id: nextIdFromRows(ID_PREFIX.container_load_rules, nextContainers), product_id: p.id, container_type: c, max_tons: 0 })
          touched.add('container_load_rules')
        }
      })
    })
    return { tables: { ...current, packaging_options: nextPackaging, factory_product_costs: nextCosts, container_load_rules: nextContainers }, touched: [...touched] }
  }, [data?.products])
  const saveTable = useCallback(async (table: EditableTableKey, options: { reload?: boolean; source?: 'manual' | 'auto' } = {}) => {
    const { reload = true, source = 'manual' } = options
    setError('')
    const errs = validateTable(table)
    if (errs.length) { setError(errs[0]); setAutoSaveState('error'); return }
    let tablesToSave = tables; let extra: EditableTableKey[] = []
    if (table === 'products') {
      const r = applyProductDefaults(tables); tablesToSave = r.tables; extra = r.touched
      if (extra.length) { suppressAutoSaveRef.current = true; setTables(tablesToSave) }
    }
    if (source === 'auto') setAutoSaveState('saving'); else setStatus(tf('statusText.savingTable', { table }))
    for (const target of [table, ...extra]) {
      // @ts-ignore
      const result = (await window.ipcRenderer.invoke('replace-table', { table: target, records: tablesToSave[target] as unknown as Array<Record<string, unknown>> })) as { success: boolean; message?: string }
      if (!result.success) { setError(result.message ?? tf('statusText.saveTableFailed', { table: target })); setStatus(''); setAutoSaveState('error'); return }
    }
    setDirtyTables((p) => p.filter((x) => ![table, ...extra].includes(x)))
    if (source === 'auto') setAutoSaveState('saved'); else setStatus(tf('statusText.tableSaved', { table }))
    if (!reload) {
      setData((prev) => {
        if (!prev) return prev
        const next = { ...prev } as AppData
        const anyNext = next as unknown as Record<string, unknown>
        ;[table, ...extra].forEach((k) => { anyNext[k] = tablesToSave[k] as unknown })
        return next
      })
    }
    if (reload) await loadData()
  }, [tables, validateTable, applyProductDefaults, loadData])

  const saveSettings = useCallback(async (options: { reload?: boolean; source?: 'manual' | 'auto' } = {}) => {
    const { reload = true, source = 'manual' } = options
    const fx = Number(settingsFxRate), margin = Number(settingsMarginPct), quoteDays = Number(settingsQuoteValidDays), rmb = Number(settingsRmbDecimals), usd = Number(settingsUsdDecimals)
    if (!Number.isFinite(fx) || fx <= 0) { setError(ta('validation.fxPositive')); setAutoSaveState('error'); return }
    if (!Number.isFinite(margin) || margin < 0 || margin >= 1) { setError(ta('validation.marginRange')); setAutoSaveState('error'); return }
    if (!Number.isFinite(quoteDays) || quoteDays <= 0) { setError(ta('validation.quoteDaysPositive')); setAutoSaveState('error'); return }
    if (!Number.isFinite(rmb) || rmb < 0) { setError(ta('validation.rmbDecimals')); setAutoSaveState('error'); return }
    if (!Number.isFinite(usd) || usd < 0) { setError(ta('validation.usdDecimals')); setAutoSaveState('error'); return }
    if (source === 'auto') setAutoSaveState('saving'); else setStatus(ta('statusText.savingSettings'))
    // @ts-ignore
    const result = (await window.ipcRenderer.invoke('update-settings', { fx_rate: fx, margin_pct: margin, quote_valid_days: quoteDays, ui_theme: settingsUiTheme, money_format: { rmb_decimals: rmb, usd_decimals: usd }, pricing_formula_mode: settingsPricingFormulaMode, rounding_policy: settingsRoundingPolicy, terms_template: settingsTermsTemplate, user_profiles: settingsUserProfiles, active_user_profile_id: settingsActiveUserProfileId })) as { success: boolean; message?: string }
    if (!result.success) { setError(result.message ?? ta('statusText.saveFailed')); setStatus(''); setAutoSaveState('error'); return }
    setDirtySettings(false)
    window.dispatchEvent(new CustomEvent('ui-theme-change', { detail: { uiTheme: settingsUiTheme } }))
    if (source === 'auto') setAutoSaveState('saved'); else setStatus(ta('statusText.settingsSaved'))
    if (!reload) {
      setData((prev) => prev ? ({ ...prev, settings: { ...prev.settings, fx_rate: fx, margin_pct: margin, quote_valid_days: quoteDays, ui_theme: settingsUiTheme, money_format: { rmb_decimals: rmb, usd_decimals: usd }, pricing_formula_mode: settingsPricingFormulaMode, rounding_policy: settingsRoundingPolicy, terms_template: settingsTermsTemplate, user_profiles: settingsUserProfiles, active_user_profile_id: settingsActiveUserProfileId } }) : prev)
    }
    if (reload) await loadData()
  }, [settingsFxRate, settingsMarginPct, settingsQuoteValidDays, settingsRmbDecimals, settingsUsdDecimals, settingsPricingFormulaMode, settingsRoundingPolicy, settingsUiTheme, settingsTermsTemplate, settingsUserProfiles, settingsActiveUserProfileId, loadData])

  useEffect(() => {
    if (suppressAutoSaveRef.current) { suppressAutoSaveRef.current = false; return }
    if (dirtyTables.length === 0 && !dirtySettings) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = window.setTimeout(async () => {
      if (dirtySettings) await saveSettings({ reload: false, source: 'auto' })
      for (const t of [...dirtyTables]) await saveTable(t, { reload: false, source: 'auto' })
    }, 900)
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current) }
  }, [dirtyTables, dirtySettings, saveSettings, saveTable])

  const selectWithEmpty = useCallback((options: Array<{ value: string; label: string }>, emptyLabel: string) => [{ value: '', label: emptyLabel }, ...options], [])

  const columnsByTable = useMemo(() => {
    const productSelect = selectWithEmpty(productOptions, ta('select.product'))
    const factorySelect = selectWithEmpty(factoryOptions, ta('select.factory'))
    const packagingSelect = selectWithEmpty(packagingOptions, ta('select.packaging'))
    const portSelect = selectWithEmpty(portOptions, ta('select.port'))
    const innerPackSelect = selectWithEmpty(innerPackOptions, ta('select.innerPack'))
    return {
      products: [
        { key: 'id', label: labelFor('id'), type: 'text', readOnly: true, width: 140 },
        { key: 'name', label: labelFor('name'), type: 'text', width: 220 },
        { key: 'refund_rate', label: labelFor('refund_rate'), type: 'number' },
        { key: 'purchase_vat_rate', label: labelFor('purchase_vat_rate'), type: 'number' },
        { key: 'invoice_tax_point', label: labelFor('invoice_tax_point'), type: 'number' },
        { key: 'pol_port_id', label: labelFor('pol_port_id'), type: 'select', options: portSelect },
      ] as Array<Column<Product>>,
      packaging_options: [
        { key: 'id', label: labelFor('id'), type: 'text', readOnly: true, width: 140 }, { key: 'product_id', label: labelFor('product_id'), type: 'select', options: productSelect },
        { key: 'name', label: labelFor('name'), type: 'text', width: 220 }, { key: 'unit_weight_kg', label: labelFor('unit_weight_kg'), type: 'number', step: '0.01' },
        { key: 'units_per_carton', label: labelFor('units_per_carton'), type: 'number', nullable: true, step: '1' }, { key: 'carton_price_rmb', label: labelFor('carton_price_rmb'), type: 'number' },
        { key: 'bag_price_rmb', label: labelFor('bag_price_rmb'), type: 'number' }, { key: 'inner_pack_type', label: labelFor('inner_pack_type'), type: 'select', options: innerPackOptions }, { key: 'default_selected', label: ta('common.defaultMark'), type: 'checkbox' },
      ] as Array<Column<PackagingOption>>,
      packaging_recommendations: [
        { key: 'id', label: ta('fields.id'), type: 'text', readOnly: true, width: 140 }, { key: 'product_id', label: ta('fields.product_id'), type: 'select', options: productSelect }, { key: 'inner_pack_type', label: ta('fields.inner_pack_type'), type: 'select', options: innerPackSelect },
        { key: 'unit_weight_kg', label: ta('fields.unit_weight_kg'), type: 'number', step: '0.01' }, { key: 'recommended_units_per_carton', label: ta('fields.recommended_units_per_carton'), type: 'number', step: '1' }, { key: 'notes', label: ta('fields.notes'), type: 'text', width: 220 },
      ] as Array<Column<PackagingRecommendation>>,
      factories: [{ key: 'id', label: ta('fields.id'), type: 'text', readOnly: true, width: 140 }, { key: 'name', label: ta('fields.name'), type: 'text', width: 220 }, { key: 'default_port_id', label: ta('fields.default_port_id'), type: 'select', options: portSelect }] as Array<Column<Factory>>,
      factory_product_costs: [
        { key: 'id', label: ta('fields.id'), type: 'text', readOnly: true, width: 140 },
        { key: 'factory_id', label: ta('fields.factory_id'), type: 'select', options: factorySelect },
        { key: 'product_id', label: ta('fields.product_id'), type: 'select', options: productSelect },
        { key: 'cost_rmb_per_ton', label: ta('fields.cost_rmb_per_ton'), type: 'number' },
        { key: 'cost_unit', label: ta('fields.cost_unit'), type: 'select', options: [{ value: 'ton', label: ta('unit.ton') }, { value: 'bag', label: ta('unit.bag') }, { value: 'piece', label: ta('unit.piece') }, { value: 'carton', label: ta('unit.carton') }] },
      ] as Array<Column<FactoryProductCost>>,
      ports: [{ key: 'id', label: ta('fields.id'), type: 'text', readOnly: true, width: 140 }, { key: 'name', label: ta('fields.name'), type: 'text', width: 200 }, { key: 'code', label: ta('fields.code'), type: 'text', width: 120 }, { key: 'country', label: ta('fields.country'), type: 'text', width: 160 }] as Array<Column<Port>>,
      port_charges_rules: [{ key: 'id', label: ta('fields.id'), type: 'text', readOnly: true, width: 140 }, { key: 'port_id', label: ta('fields.port_id'), type: 'select', options: portSelect }, { key: 'mode', label: ta('fields.mode'), type: 'select', options: [{ value: 'FCL', label: 'FCL' }, { value: 'LCL', label: 'LCL' }] }, { key: 'container_type', label: ta('fields.container_type'), type: 'select', options: [{ value: '', label: 'N/A' }, { value: '20GP', label: '20GP' }, { value: '40HQ', label: '40HQ' }] }, { key: 'base_rmb', label: ta('fields.base_rmb'), type: 'number' }, { key: 'extra_rmb_per_ton', label: ta('fields.extra_rmb_per_ton'), type: 'number' }] as Array<Column<PortChargesRule>>,
      container_load_rules: [{ key: 'id', label: ta('fields.id'), type: 'text', readOnly: true, width: 140 }, { key: 'product_id', label: ta('fields.product_id'), type: 'select', options: productSelect }, { key: 'container_type', label: ta('fields.container_type'), type: 'select', options: [{ value: '20GP', label: '20GP' }, { value: '40HQ', label: '40HQ' }] }, { key: 'max_tons', label: ta('fields.max_tons'), type: 'number' }] as Array<Column<ContainerLoadRule>>,
      land_freight_rules: [{ key: 'id', label: ta('fields.id'), type: 'text', readOnly: true, width: 140 }, { key: 'mode', label: ta('fields.mode'), type: 'select', options: [{ value: 'FCL', label: 'FCL' }, { value: 'LCL', label: 'LCL' }] }, { key: 'factory_id', label: ta('fields.factory_id'), type: 'select', options: factorySelect }, { key: 'container_type', label: ta('fields.container_type'), type: 'select', options: [{ value: '20GP', label: '20GP' }, { value: '40HQ', label: '40HQ' }] }, { key: 'min_rmb_per_ton', label: ta('fields.min_rmb_per_ton'), type: 'number' }, { key: 'max_rmb_per_ton', label: ta('fields.max_rmb_per_ton'), type: 'number' }, { key: 'default_rmb_per_ton', label: ta('fields.default_rmb_per_ton'), type: 'number' }] as Array<Column<LandFreightRule>>,
      factory_packaging_overrides: [{ key: 'id', label: ta('fields.id'), type: 'text', readOnly: true, width: 140 }, { key: 'factory_id', label: ta('fields.factory_id'), type: 'select', options: factorySelect }, { key: 'packaging_option_id', label: ta('fields.packaging_option_id'), type: 'select', options: packagingSelect }, { key: 'carton_price_rmb_override', label: ta('fields.carton_price_rmb_override'), type: 'number', nullable: true }, { key: 'bag_price_rmb_override', label: ta('fields.bag_price_rmb_override'), type: 'number', nullable: true }] as Array<Column<FactoryPackagingOverride>>,
      customers: [{ key: 'id', label: ta('fields.id'), type: 'text', readOnly: true, width: 140 }, { key: 'name', label: ta('fields.name'), type: 'text', width: 220 }, { key: 'contact', label: labelFor('contact'), type: 'text', width: 220 }, { key: 'default_port_id', label: labelFor('default_port_id'), type: 'select', options: portSelect }, { key: 'terms_template', label: labelFor('customer_terms_template'), type: 'text', width: 260 }] as Array<Column<Customer>>,
    }
  }, [factoryOptions, innerPackOptions, packagingOptions, portOptions, productOptions, selectWithEmpty])

  const draftColumns = useMemo(() => {
    if (!addDraftTable) return []
    return (columnsByTable[addDraftTable] as unknown as Array<Column<Record<string, unknown>>>) ?? []
  }, [addDraftTable, columnsByTable])

  const updateDraftField = useCallback((key: string, value: unknown) => {
    setAddDraftRow((prev) => (prev ? { ...prev, [key]: value } : prev))
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      // @ts-ignore
      const list = (await window.ipcRenderer.invoke('get-history')) as CalculationHistory[]
      const allItems = Array.isArray(list) ? list : []
      setHistoryItems(
        allItems.filter((item) => {
          const payload = item.payload as Record<string, unknown>
          return payload?.kind === 'quote' || payload?.kind === undefined
        }),
      )
      // @ts-ignore
      const logs = (await window.ipcRenderer.invoke('get-operation-logs')) as CalculationHistory[]
      setOperationLogs(Array.isArray(logs) ? logs : [])
    } catch (e) {
      setError(`${ta('log.loadFailed')}: ${String(e)}`)
    }
  }, [])

  const exportHistoryJson = useCallback(() => {
    const payload = JSON.stringify(
      {
        quote_history: historyItems,
        operation_logs: operationLogs,
      },
      null,
      2,
    )
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    const a = document.createElement('a')
    a.href = url
    a.download = `quote-history-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [historyItems, operationLogs])

  const addUserProfile = useCallback(() => {
    const id = `user_${Date.now()}`
    const next = [...settingsUserProfiles, { id, name: `${ta('user.namePrefix')}${settingsUserProfiles.length + 1}` }]
    setSettingsUserProfiles(next)
    setSettingsActiveUserProfileId(id)
    setDirtySettings(true)
    setAutoSaveState('idle')
  }, [settingsUserProfiles])

  const updateUserProfileField = useCallback((id: string, key: keyof UserProfile, value: string) => {
    setSettingsUserProfiles((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)))
    setDirtySettings(true)
    setAutoSaveState('idle')
  }, [])

  const deleteUserProfile = useCallback((id: string) => {
    setSettingsUserProfiles((prev) => {
      const next = prev.filter((item) => item.id !== id)
      if (settingsActiveUserProfileId === id && next.length > 0) {
        setSettingsActiveUserProfileId(next[0].id)
      }
      return next.length > 0 ? next : [{ id: 'user_default', name: ta('user.defaultName') }]
    })
    setDirtySettings(true)
    setAutoSaveState('idle')
  }, [settingsActiveUserProfileId])

  const logActionOptions = useMemo(() => {
    const actions = new Set<string>()
    operationLogs.forEach((item) => {
      const payload = item.payload as Record<string, unknown>
      const action = String(payload?.action ?? '').trim()
      if (action) actions.add(action)
    })
    return [{ value: 'all', label: ta('common.allActions') }, ...Array.from(actions).map((action) => ({ value: action, label: action }))]
  }, [operationLogs])

  const filteredOperationLogs = useMemo(() => {
    const list = operationLogs.filter((item) => {
      if (logActionFilter === 'all') return true
      const payload = item.payload as Record<string, unknown>
      return String(payload?.action ?? '') === logActionFilter
    })
    return list.sort((a, b) => {
      const ta = Date.parse(a.timestamp)
      const tb = Date.parse(b.timestamp)
      return logSortOrder === 'desc' ? tb - ta : ta - tb
    })
  }, [operationLogs, logActionFilter, logSortOrder])

  const sectionStyle: React.CSSProperties = { padding: 14 }

  return (
    <div className="admin-page" style={{ minHeight: '100vh', backgroundColor: 'transparent', color: 'var(--text)', padding: 20 }}>
      {error && <div className="status-box status-error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="admin-tabs-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map((tab) => <button className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`} key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: '8px 14px', cursor: 'pointer' }}>{tab.label}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <span className="status-pill status-info">{status || ta('common.ready')}</span>
          <span className={`status-pill ${autoSaveToneClass}`}>{autoSaveLabel}</span>
        </div>
      </div>
      {activeTab === 'settings' && (
        <div className="panel" style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>{ta('common.settings')}</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="subpanel settings-group" style={{ padding: 14 }}>
              <div className="section-title" style={{ marginBottom: 10 }}>{ta('settingsSection.basic')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
                <div><label>{labelFor('fx_rate')}</label><input type="number" step="0.01" value={settingsFxRate} onChange={(e) => { setSettingsFxRate(e.target.value); setDirtySettings(true); setAutoSaveState('idle') }} style={{ ...inputBaseStyle, marginTop: 6, padding: 8 }} /></div>
                <div><label>{labelFor('margin_pct')}</label><input type="number" step="0.01" value={settingsMarginPct} onChange={(e) => { setSettingsMarginPct(e.target.value); setDirtySettings(true); setAutoSaveState('idle') }} style={{ ...inputBaseStyle, marginTop: 6, padding: 8 }} /></div>
                <div><label>{labelFor('quote_valid_days')}</label><input type="number" step="1" value={settingsQuoteValidDays} onChange={(e) => { setSettingsQuoteValidDays(e.target.value); setDirtySettings(true); setAutoSaveState('idle') }} style={{ ...inputBaseStyle, marginTop: 6, padding: 8 }} /></div>
                <div><label>{labelFor('money_format_rmb_decimals')}</label><input type="number" step="1" value={settingsRmbDecimals} onChange={(e) => { setSettingsRmbDecimals(e.target.value); setDirtySettings(true); setAutoSaveState('idle') }} style={{ ...inputBaseStyle, marginTop: 6, padding: 8 }} /></div>
                <div><label>{labelFor('money_format_usd_decimals')}</label><input type="number" step="1" value={settingsUsdDecimals} onChange={(e) => { setSettingsUsdDecimals(e.target.value); setDirtySettings(true); setAutoSaveState('idle') }} style={{ ...inputBaseStyle, marginTop: 6, padding: 8 }} /></div>
                <div><label>{labelFor('rounding_policy')}</label><MantineSelect className="ui-select" mt={6} value={settingsRoundingPolicy} onChange={(value) => { setSettingsRoundingPolicy(value ?? 'ceil'); setDirtySettings(true); setAutoSaveState('idle') }} data={[{ value: 'ceil', label: ta('fields.rounding_policy') }]} searchable={false} allowDeselect={false} styles={{ input: inputBaseStyle, dropdown: { backgroundColor: 'var(--surface-2)' } }} /></div>
              </div>
            </div>

            <div className="subpanel settings-group" style={{ padding: 14 }}>
              <div className="section-title" style={{ marginBottom: 10 }}>{ta('settingsSection.pricingTheme')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
                <div><label>{labelFor('pricing_formula_mode')}</label><MantineSelect className="ui-select" mt={6} value={settingsPricingFormulaMode} onChange={(value) => { setSettingsPricingFormulaMode(value ?? 'divide'); setDirtySettings(true); setAutoSaveState('idle') }} data={[{ value: 'divide', label: 'cost/(1-margin)' }]} searchable={false} allowDeselect={false} styles={{ input: inputBaseStyle, dropdown: { backgroundColor: 'var(--surface-2)' } }} /></div>
                <div>
                  <label>{labelFor('ui_theme')}</label>
                  <MantineSelect
                    className="ui-select"
                    mt={6}
                    value={settingsUiTheme}
                    data={[
                      { value: 'classic', label: ta('theme.classic') },
                      { value: 'neon', label: ta('theme.neon') },
                      { value: 'minimal', label: ta('theme.minimal') },
                      { value: 'paper', label: ta('theme.paper') },
                    ]}
                    onChange={(value) => {
                      const nextTheme = (value ?? 'classic') as 'classic' | 'neon' | 'minimal' | 'paper'
                      setSettingsUiTheme(nextTheme)
                      setUiThemeKey(nextTheme)
                      setDirtySettings(true)
                      setAutoSaveState('idle')
                    }}
                    searchable={false}
                    allowDeselect={false}
                    styles={{ input: inputBaseStyle, dropdown: { backgroundColor: 'var(--surface-2)' } }}
                  />
                </div>
                <div>
                  <label>{ta('settingsSection.currentUser')}</label>
                  <MantineSelect
                    className="ui-select"
                    mt={6}
                    value={settingsActiveUserProfileId || null}
                    data={settingsUserProfiles.map((item) => ({ value: item.id, label: item.name }))}
                    onChange={(value) => {
                      setSettingsActiveUserProfileId(value ?? '')
                      setDirtySettings(true)
                      setAutoSaveState('idle')
                    }}
                    searchable={false}
                    allowDeselect={false}
                    styles={{ input: inputBaseStyle, dropdown: { backgroundColor: 'var(--surface-2)' } }}
                  />
                </div>
              </div>
              <div className="settings-action-row" style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-outline-neon settings-action-btn" onClick={() => setThemeCustomOpen(true)}>{ta('settingsSection.themeCustomize')}</button>
                <button className="btn-primary settings-action-btn" onClick={() => setProfileModalOpen(true)}>{ta('settingsSection.userManage')}</button>
              </div>
              <Text size="xs" c="dimmed" mt={8}>{ta('hint.theme')}</Text>
            </div>

            <div className="subpanel settings-group" style={{ padding: 14 }}>
              <div className="section-title" style={{ marginBottom: 10 }}>{ta('settingsSection.dataRecords')}</div>
              <div className="settings-action-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-outline-neon settings-action-btn" onClick={() => { void loadHistory(); setHistoryModalOpen(true) }}>{ta('common.quoteHistory')}</button>
                <button className="btn-outline-neon settings-action-btn" onClick={() => { void loadHistory(); setLogsModalOpen(true) }}>{ta('common.operationLogs')}</button>
                <button className="btn-primary settings-action-btn" onClick={() => { void loadHistory(); exportHistoryJson() }}>{ta('common.exportJson')}</button>
              </div>
            </div>

            <div className="subpanel settings-group" style={{ padding: 14 }}>
              <div className="section-title" style={{ marginBottom: 10 }}>{labelFor('terms_template')}</div>
              <textarea className="no-scroll" value={settingsTermsTemplate} onChange={(e) => { setSettingsTermsTemplate(e.target.value); setDirtySettings(true); setAutoSaveState('idle') }} rows={3} style={{ ...inputBaseStyle, minHeight: 88 }} />
            </div>
          </div>
        </div>
      )}

      {activeTab !== 'settings' && (
        <div className="panel" style={sectionStyle}>
          <div className="admin-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h2 style={{ marginTop: 0 }}>{TABS.find((t) => t.key === activeTab)?.label ?? activeTab}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn-primary admin-add-btn" onClick={() => openAddModal(activeTab)} style={{ cursor: 'pointer', fontWeight: 700 }}>{ta('common.add')}</button>
            </div>
          </div>

          {activeTab === 'products' && <div>{tables.products.map((row) => <div key={row.id} className="subpanel admin-card" style={{ padding: 16, marginBottom: 24 }}>
            <div className="admin-card-header" style={{ marginBottom: 12, color: 'var(--text)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Product: {row.id}</span>
              <button className="btn-danger-soft" onClick={() => deleteRow('products', row.id)} style={{ cursor: 'pointer' }}>{ta('common.delete')}</button>
            </div>
            <div className="admin-card-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr 0.8fr 0.8fr 0.8fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={fieldLabelStyle}>ID</div>
                <input type="text" value={row.id} readOnly style={inputBaseStyle} />
              </div>
              <div>
                <div style={fieldLabelStyle}>{ta('fields.name')}</div>
                <input type="text" value={row.name ?? ''} onChange={(e) => updateRow('products', row.id, 'name', e.target.value)} style={inputBaseStyle} />
              </div>
              <div>
                <div style={fieldLabelStyle}>Name (EN)</div>
                <input type="text" value={row.name_en ?? ''} onChange={(e) => updateRow('products', row.id, 'name_en', e.target.value)} style={inputBaseStyle} />
              </div>
              <div>
                <div style={fieldLabelStyle}>{ta('fields.refund_rate')}</div>
                <input type="number" value={formatNumberInput(row.refund_rate)} onChange={(e) => updateRow('products', row.id, 'refund_rate', parseNumberInput(e.target.value, false))} style={inputBaseStyle} />
              </div>
              <div>
                <div style={fieldLabelStyle}>{ta('fields.purchase_vat_rate')}</div>
                <input type="number" value={formatNumberInput(row.purchase_vat_rate)} onChange={(e) => updateRow('products', row.id, 'purchase_vat_rate', parseNumberInput(e.target.value, false))} style={inputBaseStyle} />
              </div>
              <div>
                <div style={fieldLabelStyle}>{ta('fields.invoice_tax_point')}</div>
                <input type="number" value={formatNumberInput(row.invoice_tax_point)} onChange={(e) => updateRow('products', row.id, 'invoice_tax_point', parseNumberInput(e.target.value, false))} style={inputBaseStyle} />
              </div>
              <div>
                  <div style={fieldLabelStyle}>{ta('fields.pol_port_id')}</div>
                  <MantineSelect className="ui-select" value={row.pol_port_id ?? ''} onChange={(value) => updateRow('products', row.id, 'pol_port_id', value ?? '')} data={portOptions} searchable={false} allowDeselect={false} styles={{ input: inputBaseStyle, dropdown: { backgroundColor: 'var(--surface-2)' } }} />
                </div>
            </div>
            <div>
              <div style={fieldLabelStyle}>Description (EN)</div>
              <textarea
                className="no-scroll"
                value={row.description_en ?? ''}
                onChange={(e) => updateRow('products', row.id, 'description_en', e.target.value)}
                style={{ ...inputBaseStyle, minHeight: 80 }}
              />
            </div>
          </div>)}</div>}

          {activeTab === 'packaging_options' && (
            <div>
              {tables.packaging_options.map((pack) => (
                <div key={pack.id} className="subpanel admin-card" style={{ padding: 16, marginBottom: 24 }}>
                  <div
                    className="admin-card-header"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ color: 'var(--text)', fontWeight: 700 }}>Packaging: {pack.id}</div>
                    <button
                      className="btn-danger-soft"
                      onClick={() => deleteRow('packaging_options', pack.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {ta('common.delete')}
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.2fr 1.2fr',
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div style={fieldLabelStyle}>ID</div>
                      <input
                        type="text"
                        value={pack.id}
                        readOnly
                        style={inputBaseStyle}
                      />
                    </div>
                    <div>
                      <div style={fieldLabelStyle}>{ta('fields.product_id')}</div>
                      <MantineSelect
                        className="ui-select"
                        value={pack.product_id}
                        onChange={(value) =>
                          updateRow('packaging_options', pack.id, 'product_id', value ?? '')
                        }
                        data={productOptions}
                        searchable={false}
                        allowDeselect={false}
                        styles={{ input: inputBaseStyle, dropdown: { backgroundColor: 'var(--surface-2)' } }}
                      />
                    </div>
                    <div>
                      <div style={fieldLabelStyle}>{ta('fields.name')}</div>
                      <input
                        type="text"
                        value={pack.name}
                        onChange={(e) => updateRow('packaging_options', pack.id, 'name', e.target.value)}
                        style={inputBaseStyle}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 0.7fr',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={fieldLabelStyle}>{ta('fields.unit_weight_kg')}</div>
                      <input
                        type="number"
                        step="0.01"
                        value={formatNumberInput(pack.unit_weight_kg)}
                        onChange={(e) =>
                          updateRow(
                            'packaging_options',
                            pack.id,
                            'unit_weight_kg',
                            parseNumberInput(e.target.value, false),
                          )
                        }
                        style={inputBaseStyle}
                      />
                    </div>
                    <div>
                      <div style={fieldLabelStyle}>{ta('fields.units_per_carton')}</div>
                      <input
                        type="number"
                        step="1"
                        value={formatNumberInput(pack.units_per_carton)}
                        onChange={(e) =>
                          updateRow(
                            'packaging_options',
                            pack.id,
                            'units_per_carton',
                            parseNumberInput(e.target.value, true),
                          )
                        }
                        style={inputBaseStyle}
                      />
                    </div>
                    <div>
                      <div style={fieldLabelStyle}>
                        {ta('fields.carton_price_rmb')}
                      </div>
                      <input
                        type="number"
                        value={formatNumberInput(pack.carton_price_rmb)}
                        onChange={(e) =>
                          updateRow(
                            'packaging_options',
                            pack.id,
                            'carton_price_rmb',
                            parseNumberInput(e.target.value, false),
                          )
                        }
                        style={inputBaseStyle}
                      />
                    </div>
                    <div>
                      <div style={fieldLabelStyle}>
                        {ta('fields.bag_price_rmb')}
                      </div>
                      <input
                        type="number"
                        value={formatNumberInput(pack.bag_price_rmb)}
                        onChange={(e) =>
                          updateRow(
                            'packaging_options',
                            pack.id,
                            'bag_price_rmb',
                            parseNumberInput(e.target.value, false),
                          )
                        }
                        style={inputBaseStyle}
                      />
                    </div>
                    <div>
                      <div style={fieldLabelStyle}>{ta('fields.inner_pack_type')}</div>
                      <MantineSelect
                        className="ui-select"
                        value={pack.inner_pack_type}
                        onChange={(value) =>
                          updateRow('packaging_options', pack.id, 'inner_pack_type', value ?? 'none')
                        }
                        data={innerPackOptions}
                        searchable={false}
                        allowDeselect={false}
                        styles={{ input: inputBaseStyle, dropdown: { backgroundColor: 'var(--surface-2)' } }}
                      />
                    </div>
                    <div>
                      <div style={fieldLabelStyle}>{ta('common.defaultMark')}</div>
                      <input
                        type="checkbox"
                        checked={Boolean(pack.default_selected)}
                        onChange={(e) =>
                          updateRow('packaging_options', pack.id, 'default_selected', e.target.checked)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'packaging_recommendations' && <EditableTable columns={columnsByTable.packaging_recommendations} rows={tables.packaging_recommendations} onChange={(id, k, v) => updateRow('packaging_recommendations', id, String(k), v)} onDelete={(id) => deleteRow('packaging_recommendations', id)} />}
          {activeTab === 'factories' && <EditableTable columns={columnsByTable.factories} rows={tables.factories} onChange={(id, k, v) => updateRow('factories', id, String(k), v)} onDelete={(id) => deleteRow('factories', id)} />}
          {activeTab === 'factory_product_costs' && <EditableTable columns={columnsByTable.factory_product_costs} rows={tables.factory_product_costs} onChange={(id, k, v) => updateRow('factory_product_costs', id, String(k), v)} onDelete={(id) => deleteRow('factory_product_costs', id)} />}
          {activeTab === 'ports' && <EditableTable columns={columnsByTable.ports} rows={tables.ports} onChange={(id, k, v) => updateRow('ports', id, String(k), v)} onDelete={(id) => deleteRow('ports', id)} />}
          {activeTab === 'port_charges_rules' && <EditableTable columns={columnsByTable.port_charges_rules} rows={tables.port_charges_rules} onChange={(id, k, v) => updateRow('port_charges_rules', id, String(k), v)} onDelete={(id) => deleteRow('port_charges_rules', id)} />}
          {activeTab === 'container_load_rules' && <EditableTable columns={columnsByTable.container_load_rules} rows={tables.container_load_rules} onChange={(id, k, v) => updateRow('container_load_rules', id, String(k), v)} onDelete={(id) => deleteRow('container_load_rules', id)} />}
          {activeTab === 'land_freight_rules' && <><div className="status-box status-info" style={{ marginBottom: 8 }}>{ta('hint.landFreight')}</div><EditableTable columns={columnsByTable.land_freight_rules} rows={tables.land_freight_rules} onChange={(id, k, v) => updateRow('land_freight_rules', id, String(k), v)} onDelete={(id) => deleteRow('land_freight_rules', id)} /></>}
          {activeTab === 'factory_packaging_overrides' && <EditableTable columns={columnsByTable.factory_packaging_overrides} rows={tables.factory_packaging_overrides} onChange={(id, k, v) => updateRow('factory_packaging_overrides', id, String(k), v)} onDelete={(id) => deleteRow('factory_packaging_overrides', id)} />}
          {activeTab === 'customers' && <EditableTable columns={columnsByTable.customers} rows={tables.customers} onChange={(id, k, v) => updateRow('customers', id, String(k), v)} onDelete={(id) => deleteRow('customers', id)} />}
        </div>
      )}

      {addModalOpen && addDraftTable && addDraftRow && (
        <div className="modal-backdrop">
          <div className="modal-card glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{ta('common.add')} {TABS.find((t) => t.key === addDraftTable)?.label ?? addDraftTable}</h3>
              <button className="btn-outline-neon" onClick={cancelAddRow}>{ta('common.close')}</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {draftColumns
                .filter((c) => c.key !== 'id')
                .map((column) => {
                  const raw = addDraftRow[column.key as string] as unknown
                  if (column.type === 'checkbox') {
                    return (
                      <label key={String(column.key)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(raw)}
                          onChange={(e) => updateDraftField(String(column.key), e.target.checked)}
                        />
                        {column.label}
                      </label>
                    )
                  }
                  if (column.type === 'select') {
                    return (
                      <div key={String(column.key)}>
                        <div style={fieldLabelStyle}>{column.label}</div>
                        <MantineSelect
                          className="ui-select"
                          value={((raw ?? '') as string) || ''}
                          onChange={(value) => updateDraftField(String(column.key), value ?? '')}
                          data={column.options ?? []}
                          searchable={false}
                          allowDeselect={false}
                          styles={{ input: inputBaseStyle, dropdown: { backgroundColor: 'var(--surface-2)' } }}
                        />
                      </div>
                    )
                  }
                  if (column.type === 'number') {
                    return (
                      <div key={String(column.key)}>
                        <div style={fieldLabelStyle}>{column.label}</div>
                        <input
                          type="number"
                          step={column.step ?? '0.01'}
                          value={formatNumberInput(raw)}
                          onChange={(e) =>
                            updateDraftField(
                              String(column.key),
                              parseNumberInput(e.target.value, Boolean(column.nullable)),
                            )
                          }
                          style={inputBaseStyle}
                        />
                      </div>
                    )
                  }
                  return (
                    <div key={String(column.key)}>
                      <div style={fieldLabelStyle}>{column.label}</div>
                      <input
                        type="text"
                        value={(raw ?? '') as string}
                        onChange={(e) => updateDraftField(String(column.key), e.target.value)}
                        style={inputBaseStyle}
                      />
                    </div>
                  )
                })}
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn-outline-neon" onClick={cancelAddRow}>{ta('common.cancel')}</button>
              <button className="btn-primary" onClick={confirmAddRow}>{ta('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      {historyModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card glass-card" style={{ width: 920, maxWidth: '94vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{ta('common.quoteHistory')}</h3>
              <button className="btn-outline-neon" onClick={() => setHistoryModalOpen(false)}>{ta('common.close')}</button>
            </div>
            <div className="subpanel" style={{ maxHeight: '70vh', overflow: 'auto', padding: 10 }}>
              {historyItems.length === 0 ? (
                <div style={{ color: 'var(--text-dim)' }}>{ta('common.noHistory')}</div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>{ta('log.time')}</th>
                      <th>{ta('log.summary')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyItems.slice().reverse().map((item) => {
                      const payload = item.payload as Record<string, unknown>
                      const quoteData = (payload?.kind === 'quote' ? payload?.data : payload) as Record<string, unknown>
                      const product = String((quoteData?.input as Record<string, unknown>)?.productName ?? '-')
                      const customer = String((quoteData?.input as Record<string, unknown>)?.customerName ?? '')
                      const versionTag = String(quoteData?.version_tag ?? '')
                      const mode = String((quoteData?.summary as Record<string, unknown>)?.mode ?? '-')
                      return (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td>{item.timestamp}</td>
                          <td>{customer ? `${customer} / ` : ''}{product} / {mode}{versionTag ? ` / ${versionTag}` : ''}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {logsModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card glass-card" style={{ width: 920, maxWidth: '94vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{ta('common.operationLogs')}</h3>
              <button className="btn-outline-neon" onClick={() => setLogsModalOpen(false)}>{ta('common.close')}</button>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <div style={{ width: 260 }}>
                <MantineSelect
                  className="ui-select"
                  value={logActionFilter}
                  onChange={(value) => setLogActionFilter(value ?? 'all')}
                  data={logActionOptions}
                  searchable={false}
                  allowDeselect={false}
                  styles={{ input: inputBaseStyle, dropdown: { backgroundColor: 'var(--surface-2)' } }}
                />
              </div>
              <button className="btn-outline-neon" onClick={() => setLogSortOrder((p) => (p === 'desc' ? 'asc' : 'desc'))}>
                {logSortOrder === 'desc' ? ta('log.newest') : ta('log.oldest')}
              </button>
            </div>
            <div className="subpanel" style={{ maxHeight: '70vh', overflow: 'auto', padding: 10 }}>
              {filteredOperationLogs.length === 0 ? (
                <div style={{ color: 'var(--text-dim)' }}>{ta('common.noLogs')}</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {filteredOperationLogs.map((item) => {
                    const payload = item.payload as Record<string, unknown>
                    const action = String(payload?.action ?? item.id)
                    return (
                      <li key={item.id} style={{ marginBottom: 8 }}>
                        <span style={{ color: 'var(--text-dim)' }}>{item.timestamp}</span>
                        <span style={{ marginLeft: 8 }}>{action}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {profileModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card glass-card" style={{ width: 1040, maxWidth: '96vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{ta('user.title')}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" onClick={addUserProfile}>{ta('common.add')}</button>
                <button className="btn-outline-neon" onClick={() => setProfileModalOpen(false)}>{ta('common.close')}</button>
              </div>
            </div>
            <div className="subpanel" style={{ maxHeight: '70vh', overflow: 'auto', padding: 10 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{ta('user.name')}</th>
                    <th>{ta('user.role')}</th>
                    <th>{ta('user.company')}</th>
                    <th>{ta('user.address')}</th>
                    <th>{ta('user.tel')}</th>
                    <th>Email</th>
                    <th>{ta('common.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {settingsUserProfiles.map((profile) => (
                    <tr key={profile.id}>
                      <td><input style={inputBaseStyle} value={profile.id} readOnly /></td>
                      <td><input style={inputBaseStyle} value={profile.name ?? ''} onChange={(e) => updateUserProfileField(profile.id, 'name', e.target.value)} /></td>
                      <td>
                        <MantineSelect
                          className="ui-select"
                          value={(profile.role ?? 'sales') as UserRole}
                          onChange={(value) => updateUserProfileField(profile.id, 'role', (value ?? 'sales') as UserRole)}
                          data={[
                            { value: 'admin', label: ta('user.admin') },
                            { value: 'sales', label: ta('user.sales') },
                            { value: 'audit', label: ta('user.audit') },
                          ]}
                          searchable={false}
                          allowDeselect={false}
                          styles={{ input: inputBaseStyle, dropdown: { backgroundColor: 'var(--surface-2)' } }}
                        />
                      </td>
                      <td><input style={inputBaseStyle} value={profile.companyName ?? ''} onChange={(e) => updateUserProfileField(profile.id, 'companyName', e.target.value)} /></td>
                      <td><input style={inputBaseStyle} value={profile.address ?? ''} onChange={(e) => updateUserProfileField(profile.id, 'address', e.target.value)} /></td>
                      <td><input style={inputBaseStyle} value={profile.tel ?? ''} onChange={(e) => updateUserProfileField(profile.id, 'tel', e.target.value)} /></td>
                      <td><input style={inputBaseStyle} value={profile.email ?? ''} onChange={(e) => updateUserProfileField(profile.id, 'email', e.target.value)} /></td>
                      <td><button className="btn-danger-soft" onClick={() => deleteUserProfile(profile.id)}>{ta('common.delete')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {themeCustomOpen && (
        <div className="modal-backdrop">
          <div className="modal-card glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{ta('themeCustom.title')}</h3>
              <button className="btn-outline-neon" onClick={() => setThemeCustomOpen(false)}>{ta('common.close')}</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <div><div style={fieldLabelStyle}>{ta('themeCustom.bgA')}</div><input type="color" value={themeDraft.bg0} onChange={(e) => setThemeDraft((p) => ({ ...p, bg0: e.target.value }))} style={inputBaseStyle} /></div>
              <div><div style={fieldLabelStyle}>{ta('themeCustom.bgB')}</div><input type="color" value={themeDraft.bg1} onChange={(e) => setThemeDraft((p) => ({ ...p, bg1: e.target.value }))} style={inputBaseStyle} /></div>
              <div><div style={fieldLabelStyle}>{ta('themeCustom.text')}</div><input type="color" value={themeDraft.text} onChange={(e) => setThemeDraft((p) => ({ ...p, text: e.target.value }))} style={inputBaseStyle} /></div>
              <div><div style={fieldLabelStyle}>{ta('themeCustom.textDim')}</div><input type="color" value={themeDraft.textDim} onChange={(e) => setThemeDraft((p) => ({ ...p, textDim: e.target.value }))} style={inputBaseStyle} /></div>
              <div><div style={fieldLabelStyle}>{ta('themeCustom.surface1')}</div><input type="color" value={themeDraft.surface1} onChange={(e) => setThemeDraft((p) => ({ ...p, surface1: e.target.value }))} style={inputBaseStyle} /></div>
              <div><div style={fieldLabelStyle}>{ta('themeCustom.surface2')}</div><input type="color" value={themeDraft.surface2} onChange={(e) => setThemeDraft((p) => ({ ...p, surface2: e.target.value }))} style={inputBaseStyle} /></div>
              <div><div style={fieldLabelStyle}>{ta('themeCustom.border')}</div><input type="color" value={themeDraft.border1} onChange={(e) => setThemeDraft((p) => ({ ...p, border1: e.target.value }))} style={inputBaseStyle} /></div>
              <div><div style={fieldLabelStyle}>{ta('themeCustom.primary')}</div><input type="color" value={themeDraft.primary} onChange={(e) => setThemeDraft((p) => ({ ...p, primary: e.target.value }))} style={inputBaseStyle} /></div>
              <div><div style={fieldLabelStyle}>{ta('themeCustom.accent1')}</div><input type="color" value={themeDraft.accent} onChange={(e) => setThemeDraft((p) => ({ ...p, accent: e.target.value }))} style={inputBaseStyle} /></div>
              <div><div style={fieldLabelStyle}>{ta('themeCustom.accent2')}</div><input type="color" value={themeDraft.accent2} onChange={(e) => setThemeDraft((p) => ({ ...p, accent2: e.target.value }))} style={inputBaseStyle} /></div>
              <div>
                <div style={fieldLabelStyle}>{ta('themeCustom.glassIntensity')}</div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round((themeDraft.glassIntensity ?? 0.2) * 100)}
                  onChange={(e) =>
                    setThemeDraft((p) => ({ ...p, glassIntensity: Number(e.target.value) / 100 }))
                  }
                  style={{ ...inputBaseStyle, padding: '6px 10px' }}
                />
                <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 4 }}>
                  {Math.round((themeDraft.glassIntensity ?? 0.2) * 100)}%
                </div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div style={fieldLabelStyle}>{ta('themeCustom.fontFamily')}</div>
                <input type="text" value={themeDraft.fontFamily} onChange={(e) => setThemeDraft((p) => ({ ...p, fontFamily: e.target.value }))} style={inputBaseStyle} />
              </div>
              <div>
                <div style={fieldLabelStyle}>{ta('themeCustom.bgUpload')}</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => setThemeDraft((p) => ({ ...p, backgroundImage: String(reader.result ?? '') }))
                    reader.readAsDataURL(file)
                  }}
                  style={inputBaseStyle}
                />
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button className="btn-danger-soft" onClick={() => setThemeDraft((p) => ({ ...p, backgroundImage: '' }))}>{ta('themeCustom.clearBg')}</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-outline-neon" onClick={() => { setThemeDraft(defaultCustomThemeOverrides); applyCustomThemeOverrides(defaultCustomThemeOverrides); saveCustomThemeOverrides(defaultCustomThemeOverrides) }}>{ta('themeCustom.reset')}</button>
                <button className="btn-primary" onClick={() => { applyCustomThemeOverrides(themeDraft); saveCustomThemeOverrides(themeDraft); setSettingsUiTheme('paper'); setUiThemeKey('paper'); setDirtySettings(true); setThemeCustomOpen(false) }}>{ta('themeCustom.applySave')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!data && <div style={{ marginTop: 12, color: 'var(--text-dim)' }}>{ta('common.noData')}</div>}
    </div>
  )
}
