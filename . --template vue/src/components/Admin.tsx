import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Select as MantineSelect, Text } from '@mantine/core'
import type {
  AppData,
  ContainerLoadRule,
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
} from '@/types/domain'
import { nextIdFromRows } from '@/utils/id'
import { useUiTheme } from '@/ui/ThemeProvider'

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
  { key: 'products', label: '产品' },
  { key: 'packaging_options', label: '包装方案' },
  { key: 'packaging_recommendations', label: '推荐箱规' },
  { key: 'factories', label: '工厂' },
  { key: 'factory_product_costs', label: '工厂吨成本' },
  { key: 'ports', label: '港口' },
  { key: 'port_charges_rules', label: '港杂规则' },
  { key: 'container_load_rules', label: '装柜吨数' },
  { key: 'land_freight_rules', label: '国内段费用' },
  { key: 'factory_packaging_overrides', label: '工厂包装价覆盖' },
  { key: 'settings', label: '设置' },
]

const ID_PREFIX: Record<EditableTableKey, string> = {
  products: 'prod', packaging_options: 'pack', packaging_recommendations: 'pr', factories: 'fct',
  factory_product_costs: 'fpc', ports: 'port', port_charges_rules: 'pcr', container_load_rules: 'clr',
  land_freight_rules: 'lfr', factory_packaging_overrides: 'fpo',
}

const LABELS: Record<string, string> = {
  id: 'ID', name: '名称', product_id: '产品', factory_id: '工厂', packaging_option_id: '包装方案',
  refund_rate: '退税率', purchase_vat_rate: '增值税', invoice_tax_point: '开票点', pol_port_id: '起运港',
  unit_weight_kg: '每袋重量(kg)', units_per_carton: '每箱袋数', carton_price_rmb: '每箱纸箱成本(RMB)', bag_price_rmb: '每袋包装成本(RMB)',
  inner_pack_type: '内包装类型', cost_rmb_per_ton: '工厂吨成本(RMB/吨)', max_tons: '最大装柜吨数',
  port_id: '港口', mode: '运输模式', container_type: '柜型', base_rmb: '基础费用(RMB)', extra_rmb_per_ton: '超吨费用(RMB/吨)',
  min_rmb_per_ton: '最低每吨运费(RMB/吨)', max_rmb_per_ton: '最高每吨运费(RMB/吨)', default_rmb_per_ton: '默认每吨运费(RMB/吨)',
  fx_rate: '汇率', margin_pct: '毛利率', quote_valid_days: '报价有效期(天)', pricing_formula_mode: '定价公式模式',
  rounding_policy: '取整规则', terms_template: '条款模板', ui_theme: '界面主题', money_format_rmb_decimals: 'RMB 小数位', money_format_usd_decimals: 'USD 小数位',
  recommended_units_per_carton: '推荐每箱袋数', notes: '备注', carton_price_rmb_override: '纸箱价覆盖(RMB/箱)', bag_price_rmb_override: '袋材价覆盖(RMB/袋)',
}

const INNER_PACK_LABELS: Record<InnerPackType, string> = { none: '不装箱', carton: '纸箱', woven_bag: '编织袋', small_box: '小盒', big_box: '大盒' }

const inputBaseStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff',
}

const labelFor = (k: string, fb?: string) => LABELS[k] ?? fb ?? k
const createEmptyTables = (): TableState => ({
  products: [], packaging_options: [], packaging_recommendations: [], factories: [], factory_product_costs: [],
  ports: [], port_charges_rules: [], container_load_rules: [], land_freight_rules: [], factory_packaging_overrides: [],
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
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
        <thead><tr style={{ textAlign: 'left', color: '#cbd5f5' }}>{columns.map((c) => <th key={String(c.key)} style={{ padding: '8px 6px', width: c.width }}>{c.label}</th>)}<th style={{ padding: '8px 6px' }}>操作</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} style={{ borderTop: '1px solid #1f2937' }}>{columns.map((c) => {
          const raw = row[c.key] as unknown
          if (c.type === 'checkbox') return <td key={String(c.key)} style={{ padding: '8px 6px' }}><input type="checkbox" checked={Boolean(raw)} disabled={c.readOnly} onChange={(e) => onChange(row.id, c.key, e.target.checked)} /></td>
          if (c.type === 'select') return <td key={String(c.key)} style={{ padding: '8px 6px' }}><select className="ui-select" value={(raw ?? '') as string} disabled={c.readOnly} onChange={(e) => onChange(row.id, c.key, e.target.value)} style={inputBaseStyle}>{(c.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
          if (c.type === 'number') return <td key={String(c.key)} style={{ padding: '8px 6px' }}><input type="number" step={c.step ?? '0.01'} value={formatNumberInput(raw)} readOnly={c.readOnly} onChange={(e) => onChange(row.id, c.key, parseNumberInput(e.target.value, Boolean(c.nullable)))} style={{ ...inputBaseStyle, backgroundColor: c.readOnly ? '#111827' : '#0f172a' }} /></td>
          return <td key={String(c.key)} style={{ padding: '8px 6px' }}><input type="text" value={(raw ?? '') as string} readOnly={c.readOnly} onChange={(e) => onChange(row.id, c.key, e.target.value)} style={{ ...inputBaseStyle, backgroundColor: c.readOnly ? '#111827' : '#0f172a' }} /></td>
        })}<td style={{ padding: '8px 6px' }}>{renderActions && <span style={{ marginRight: 8 }}>{renderActions(row)}</span>}<button onClick={() => onDelete(row.id)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #7f1d1d', backgroundColor: '#2a1111', color: '#fecaca', cursor: 'pointer' }}>删除</button></td></tr>)}</tbody>
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
  const [settingsUiTheme, setSettingsUiTheme] = useState<'classic' | 'neon' | 'minimal'>('classic')
  const [settingsTermsTemplate, setSettingsTermsTemplate] = useState('')
  const [dirtyTables, setDirtyTables] = useState<EditableTableKey[]>([])
  const [dirtySettings, setDirtySettings] = useState(false)
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const autoSaveTimerRef = useRef<number | null>(null)
  const suppressAutoSaveRef = useRef(false)

  const autoSaveLabel = useMemo(() => {
    if (autoSaveState === 'saving') return '自动保存中'
    if (autoSaveState === 'error') return '自动保存失败'
    if (autoSaveState === 'saved') return '自动保存已保存'
    if (dirtyTables.length > 0 || dirtySettings) return '自动保存待保存'
    return '空闲'
  }, [autoSaveState, dirtyTables, dirtySettings])

  const autoSaveColor = autoSaveState === 'error' ? '#f87171' : autoSaveState === 'saving' ? '#fbbf24' : autoSaveState === 'saved' ? '#4ade80' : '#9ca3af'

  const loadData = useCallback(async () => {
    setError(''); setStatus('加载中...')
    try {
      // @ts-ignore
      const appData = (await window.ipcRenderer.invoke('get-app-data')) as AppData
      setData(appData)
      setTables({
        products: appData.products ?? [], packaging_options: appData.packaging_options ?? [], packaging_recommendations: appData.packaging_recommendations ?? [],
        factories: appData.factories ?? [], factory_product_costs: appData.factory_product_costs ?? [], ports: appData.ports ?? [],
        port_charges_rules: appData.port_charges_rules ?? [], container_load_rules: appData.container_load_rules ?? [],
        land_freight_rules: appData.land_freight_rules ?? [], factory_packaging_overrides: appData.factory_packaging_overrides ?? [],
      })
      setSettingsFxRate(String(appData.settings.fx_rate ?? 6.9)); setSettingsMarginPct(String(appData.settings.margin_pct ?? 0.05)); setSettingsQuoteValidDays(String(appData.settings.quote_valid_days ?? 7))
      setSettingsRmbDecimals(String(appData.settings.money_format?.rmb_decimals ?? 4)); setSettingsUsdDecimals(String(appData.settings.money_format?.usd_decimals ?? 4))
      setSettingsPricingFormulaMode(appData.settings.pricing_formula_mode ?? 'divide'); setSettingsRoundingPolicy(appData.settings.rounding_policy ?? 'ceil'); const rawUiTheme = String(appData.settings.ui_theme ?? 'classic'); const loadedUiTheme = ((rawUiTheme === 'creative' ? 'neon' : rawUiTheme) as 'classic' | 'neon' | 'minimal' | undefined) ?? 'classic'; setSettingsUiTheme(loadedUiTheme); setUiThemeKey(loadedUiTheme); setSettingsTermsTemplate(appData.settings.terms_template ?? '')
      suppressAutoSaveRef.current = true; setDirtyTables([]); setDirtySettings(false); setAutoSaveState('idle'); setStatus('数据已加载')
    } catch (e) {
      console.error(e); setError('加载失败，请检查控制台'); setStatus('')
    }
  }, [])
  useEffect(() => { void loadData() }, [loadData])

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

  const handleUploadProductImage = useCallback(async (productId: string) => {
    try {
      // @ts-ignore
      const result = (await window.ipcRenderer.invoke('select-product-image', { productId })) as { success: boolean; canceled?: boolean; filePath?: string; message?: string }
      if (!result.success) { if (!result.canceled) setError(result.message ?? '图片上传失败'); return }
      if (!result.filePath) { setError('未获取到图片路径'); return }
      updateRow('products', productId, 'image_path', result.filePath)
      setStatus('数据已加载'); setError('')
    } catch (e) { setError(`图片上传失败: ${String(e)}`) }
  }, [updateRow])

  const addRow = useCallback((table: EditableTableKey) => {
    const nextRow = (() => {
      switch (table) {
        case 'products': return { id: nextIdFromRows(ID_PREFIX.products, tables.products), name: '', name_en: '', description_en: '', image_path: '', refund_rate: 0, purchase_vat_rate: 0.13, invoice_tax_point: 0.03, pol_port_id: tables.ports[0]?.id ?? '' } satisfies Product
        case 'packaging_options': return { id: nextIdFromRows(ID_PREFIX.packaging_options, tables.packaging_options), product_id: tables.products[0]?.id ?? '', name: '', unit_weight_kg: 1, units_per_carton: null, carton_price_rmb: 0, bag_price_rmb: 0, inner_pack_type: 'none', unit_cbm: null, carton_cbm: null, default_selected: false } satisfies PackagingOption
        case 'packaging_recommendations': return { id: nextIdFromRows(ID_PREFIX.packaging_recommendations, tables.packaging_recommendations), product_id: tables.products[0]?.id ?? '', inner_pack_type: null, unit_weight_kg: 1, recommended_units_per_carton: 1, notes: '' } satisfies PackagingRecommendation
        case 'factories': return { id: nextIdFromRows(ID_PREFIX.factories, tables.factories), name: '', default_port_id: null } satisfies Factory
        case 'factory_product_costs': return { id: nextIdFromRows(ID_PREFIX.factory_product_costs, tables.factory_product_costs), factory_id: tables.factories[0]?.id ?? '', product_id: tables.products[0]?.id ?? '', cost_rmb_per_ton: 0 } satisfies FactoryProductCost
        case 'ports': return { id: nextIdFromRows(ID_PREFIX.ports, tables.ports), name: '', code: '', country: null } satisfies Port
        case 'port_charges_rules': return { id: nextIdFromRows(ID_PREFIX.port_charges_rules, tables.port_charges_rules), port_id: null, mode: 'FCL', container_type: '20GP', base_rmb: 0, extra_rmb_per_ton: 0 } satisfies PortChargesRule
        case 'container_load_rules': return { id: nextIdFromRows(ID_PREFIX.container_load_rules, tables.container_load_rules), product_id: tables.products[0]?.id ?? '', container_type: '20GP', max_tons: 0 } satisfies ContainerLoadRule
        case 'land_freight_rules': return { id: nextIdFromRows(ID_PREFIX.land_freight_rules, tables.land_freight_rules), mode: 'FCL', factory_id: null, container_type: '20GP', min_rmb_per_ton: 0, max_rmb_per_ton: 0, default_rmb_per_ton: 0 } satisfies LandFreightRule
        case 'factory_packaging_overrides': return { id: nextIdFromRows(ID_PREFIX.factory_packaging_overrides, tables.factory_packaging_overrides), factory_id: tables.factories[0]?.id ?? '', packaging_option_id: tables.packaging_options[0]?.id ?? '', carton_price_rmb_override: null, bag_price_rmb_override: null } satisfies FactoryPackagingOverride
        default: return null
      }
    })()
    if (!nextRow) return
    setTables((prev) => ({ ...prev, [table]: [...prev[table], nextRow] }) as TableState)
    markTableDirty(table)
  }, [tables, markTableDirty])
  const validateTable = useCallback((table: EditableTableKey): string[] => {
    const errors: string[] = []
    const rowPrefix = (key: EditableTableKey, i: number) => `${TABS.find((t) => t.key === key)?.label ?? key} 第${i + 1}行`
    if (table === 'products') {
      tables.products.forEach((r, i) => {
        const row = rowPrefix('products', i)
        if (isBlank(r.id)) errors.push(`${row}: ${labelFor('id')}不能为空`)
        if (isBlank(r.name)) errors.push(`${row}: ${labelFor('name')}不能为空`)
        if (!isFiniteNumber(r.refund_rate)) errors.push(`${row}: ${labelFor('refund_rate')}必须是数字`)
        if (!isFiniteNumber(r.purchase_vat_rate)) errors.push(`${row}: ${labelFor('purchase_vat_rate')}必须是数字`)
        if (!isFiniteNumber(r.invoice_tax_point)) errors.push(`${row}: ${labelFor('invoice_tax_point')}必须是数字`)
        if (isBlank(r.pol_port_id)) errors.push(`${row}: ${labelFor('pol_port_id')}不能为空`)
      }); return errors
    }
    if (table === 'packaging_options') {
      const count = new Map<string, number>()
      tables.packaging_options.forEach((r, i) => {
        const row = rowPrefix('packaging_options', i)
        if (isBlank(r.id)) errors.push(`${row}: ID不能为空`)
        if (isBlank(r.product_id)) errors.push(`${row}: 产品不能为空`)
        if (isBlank(r.name)) errors.push(`${row}: 名称不能为空`)
        if (!isFiniteNumber(r.unit_weight_kg)) errors.push(`${row}: 每袋重量必须是数字`)
        if (!isFiniteNumber(r.carton_price_rmb)) errors.push(`${row}: 纸箱成本必须是数字`)
        if (!isFiniteNumber(r.bag_price_rmb)) errors.push(`${row}: 包装成本必须是数字`)
        if (isBlank(r.inner_pack_type)) errors.push(`${row}: 内包装类型不能为空`)
        if (r.default_selected) count.set(r.product_id, (count.get(r.product_id) ?? 0) + 1)
      })
      count.forEach((n, productId) => { if (n > 1) errors.push(`包装方案: 产品 ${tables.products.find((x) => x.id === productId)?.name ?? productId} 的默认方案超过 1 个`) })
      return errors
    }
    if (table === 'factory_product_costs') {
      const dup = new Set<string>()
      tables.factory_product_costs.forEach((r, i) => {
        const row = rowPrefix('factory_product_costs', i)
        if (isBlank(r.id)) errors.push(`${row}: ID不能为空`)
        if (isBlank(r.factory_id)) errors.push(`${row}: 工厂不能为空`)
        if (isBlank(r.product_id)) errors.push(`${row}: 产品不能为空`)
        if (!isFiniteNumber(r.cost_rmb_per_ton)) errors.push(`${row}: 工厂吨成本必须是数字`)
        const key = `${r.factory_id}__${r.product_id}`
        if (dup.has(key)) errors.push(`${row}: 工厂 + 产品组合重复`)
        dup.add(key)
      }); return errors
    }
    const runBasic = <T extends { id: string }>(rows: T[], key: EditableTableKey, checks: Array<(row: T, rowLabel: string) => void>) => {
      rows.forEach((row, i) => { const rowLabel = rowPrefix(key, i); checks.forEach((fn) => fn(row, rowLabel)) })
    }
    if (table === 'packaging_recommendations') {
      runBasic(tables.packaging_recommendations, table, [
        (r, row) => { if (isBlank(r.id)) errors.push(`${row}: ID不能为空`) },
        (r, row) => { if (isBlank(r.product_id)) errors.push(`${row}: 产品不能为空`) },
        (r, row) => { if (!isFiniteNumber(r.unit_weight_kg)) errors.push(`${row}: 每袋重量必须是数字`) },
        (r, row) => { if (!isFiniteNumber(r.recommended_units_per_carton)) errors.push(`${row}: 推荐每箱袋数必须是数字`) },
      ])
    }
    if (table === 'factories') runBasic(tables.factories, table, [(r, row) => { if (isBlank(r.id)) errors.push(`${row}: ID不能为空`); if (isBlank(r.name)) errors.push(`${row}: 名称不能为空`) }])
    if (table === 'ports') runBasic(tables.ports, table, [(r, row) => { if (isBlank(r.id)) errors.push(`${row}: ID不能为空`); if (isBlank(r.name)) errors.push(`${row}: 名称不能为空`); if (isBlank(r.code)) errors.push(`${row}: 港口代码不能为空`) }])
    if (table === 'port_charges_rules') runBasic(tables.port_charges_rules, table, [(r, row) => { if (isBlank(r.id)) errors.push(`${row}: ID不能为空`); if (isBlank(r.mode)) errors.push(`${row}: 运输模式不能为空`); if (!isFiniteNumber(r.base_rmb)) errors.push(`${row}: 基础费用必须是数字`); if (!isFiniteNumber(r.extra_rmb_per_ton)) errors.push(`${row}: 超吨费用必须是数字`) }])
    if (table === 'container_load_rules') runBasic(tables.container_load_rules, table, [(r, row) => { if (isBlank(r.id)) errors.push(`${row}: ID不能为空`); if (isBlank(r.product_id)) errors.push(`${row}: 产品不能为空`); if (isBlank(r.container_type)) errors.push(`${row}: 柜型不能为空`); if (!isFiniteNumber(r.max_tons)) errors.push(`${row}: 最大装柜吨数必须是数字`) }])
    if (table === 'land_freight_rules') runBasic(tables.land_freight_rules, table, [(r, row) => { if (isBlank(r.id)) errors.push(`${row}: ID不能为空`); if (isBlank(r.mode)) errors.push(`${row}: 运输模式不能为空`); if (isBlank(r.container_type)) errors.push(`${row}: 柜型不能为空`); if (!isFiniteNumber(r.min_rmb_per_ton)) errors.push(`${row}: 最低每吨运费必须是数字`); if (!isFiniteNumber(r.max_rmb_per_ton)) errors.push(`${row}: 最高每吨运费必须是数字`); if (!isFiniteNumber(r.default_rmb_per_ton)) errors.push(`${row}: 默认每吨运费必须是数字`) }])
    if (table === 'factory_packaging_overrides') runBasic(tables.factory_packaging_overrides, table, [(r, row) => { if (isBlank(r.id)) errors.push(`${row}: ID不能为空`); if (isBlank(r.factory_id)) errors.push(`${row}: 工厂不能为空`); if (isBlank(r.packaging_option_id)) errors.push(`${row}: 包装方案不能为空`); if (r.carton_price_rmb_override !== null && r.carton_price_rmb_override !== undefined && !isFiniteNumber(r.carton_price_rmb_override)) errors.push(`${row}: 纸箱价覆盖必须是数字`); if (r.bag_price_rmb_override !== null && r.bag_price_rmb_override !== undefined && !isFiniteNumber(r.bag_price_rmb_override)) errors.push(`${row}: 袋材价覆盖必须是数字`) }])
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
        nextPackaging.push({ id: nextIdFromRows(ID_PREFIX.packaging_options, nextPackaging), product_id: p.id, name: `${p.name} 默认包装（需维护）`, unit_weight_kg: 1, units_per_carton: null, carton_price_rmb: 0, bag_price_rmb: 0, inner_pack_type: 'none', unit_cbm: null, carton_cbm: null, default_selected: true })
        touched.add('packaging_options')
      }
      current.factories.forEach((f) => {
        if (!nextCosts.some((x) => x.factory_id === f.id && x.product_id === p.id)) {
          nextCosts.push({ id: nextIdFromRows(ID_PREFIX.factory_product_costs, nextCosts), factory_id: f.id, product_id: p.id, cost_rmb_per_ton: 0 })
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
    if (source === 'auto') setAutoSaveState('saving'); else setStatus(`正在保存 ${table}...`)
    for (const target of [table, ...extra]) {
      // @ts-ignore
      const result = (await window.ipcRenderer.invoke('replace-table', { table: target, records: tablesToSave[target] as unknown as Array<Record<string, unknown>> })) as { success: boolean; message?: string }
      if (!result.success) { setError(result.message ?? `${target} 保存失败`); setStatus(''); setAutoSaveState('error'); return }
    }
    setDirtyTables((p) => p.filter((x) => ![table, ...extra].includes(x)))
    if (source === 'auto') setAutoSaveState('saved'); else setStatus(`${table} 已保存`)
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
    if (!Number.isFinite(fx) || fx <= 0) { setError('汇率 fx_rate 必须 > 0'); setAutoSaveState('error'); return }
    if (!Number.isFinite(margin) || margin < 0 || margin >= 1) { setError('毛利率 margin_pct 必须在 [0, 1) 范围内'); setAutoSaveState('error'); return }
    if (!Number.isFinite(quoteDays) || quoteDays <= 0) { setError('报价有效期天数必须 > 0'); setAutoSaveState('error'); return }
    if (!Number.isFinite(rmb) || rmb < 0) { setError('RMB 小数位数必须为非负整数'); setAutoSaveState('error'); return }
    if (!Number.isFinite(usd) || usd < 0) { setError('USD 小数位数必须为非负整数'); setAutoSaveState('error'); return }
    if (source === 'auto') setAutoSaveState('saving'); else setStatus('正在保存设置...')
    // @ts-ignore
    const result = (await window.ipcRenderer.invoke('update-settings', { fx_rate: fx, margin_pct: margin, quote_valid_days: quoteDays, ui_theme: settingsUiTheme, money_format: { rmb_decimals: rmb, usd_decimals: usd }, pricing_formula_mode: settingsPricingFormulaMode, rounding_policy: settingsRoundingPolicy, terms_template: settingsTermsTemplate })) as { success: boolean; message?: string }
    if (!result.success) { setError(result.message ?? '保存失败'); setStatus(''); setAutoSaveState('error'); return }
    setDirtySettings(false)
    window.dispatchEvent(new CustomEvent('ui-theme-change', { detail: { uiTheme: settingsUiTheme } }))
    if (source === 'auto') setAutoSaveState('saved'); else setStatus('设置已保存')
    if (!reload) {
      setData((prev) => prev ? ({ ...prev, settings: { ...prev.settings, fx_rate: fx, margin_pct: margin, quote_valid_days: quoteDays, ui_theme: settingsUiTheme, money_format: { rmb_decimals: rmb, usd_decimals: usd }, pricing_formula_mode: settingsPricingFormulaMode, rounding_policy: settingsRoundingPolicy, terms_template: settingsTermsTemplate } }) : prev)
    }
    if (reload) await loadData()
  }, [settingsFxRate, settingsMarginPct, settingsQuoteValidDays, settingsRmbDecimals, settingsUsdDecimals, settingsPricingFormulaMode, settingsRoundingPolicy, settingsUiTheme, settingsTermsTemplate, loadData])

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
    const productSelect = selectWithEmpty(productOptions, '请选择产品')
    const factorySelect = selectWithEmpty(factoryOptions, '请选择工厂')
    const packagingSelect = selectWithEmpty(packagingOptions, '请选择包装方案')
    const portSelect = selectWithEmpty(portOptions, '请选择港口')
    const innerPackSelect = selectWithEmpty(innerPackOptions, '请选择内包装')
    return {
      products: [] as Array<Column<Product>>,
      packaging_options: [
        { key: 'id', label: labelFor('id'), type: 'text', readOnly: true, width: 140 }, { key: 'product_id', label: labelFor('product_id'), type: 'select', options: productSelect },
        { key: 'name', label: labelFor('name'), type: 'text', width: 220 }, { key: 'unit_weight_kg', label: labelFor('unit_weight_kg'), type: 'number', step: '0.01' },
        { key: 'units_per_carton', label: labelFor('units_per_carton'), type: 'number', nullable: true, step: '1' }, { key: 'carton_price_rmb', label: labelFor('carton_price_rmb'), type: 'number' },
        { key: 'bag_price_rmb', label: labelFor('bag_price_rmb'), type: 'number' }, { key: 'inner_pack_type', label: labelFor('inner_pack_type'), type: 'select', options: innerPackOptions }, { key: 'default_selected', label: '默认', type: 'checkbox' },
      ] as Array<Column<PackagingOption>>,
      packaging_recommendations: [
        { key: 'id', label: 'ID', type: 'text', readOnly: true, width: 140 }, { key: 'product_id', label: '产品', type: 'select', options: productSelect }, { key: 'inner_pack_type', label: '内包装类型', type: 'select', options: innerPackSelect },
        { key: 'unit_weight_kg', label: '每袋重量(kg)', type: 'number', step: '0.01' }, { key: 'recommended_units_per_carton', label: '推荐每箱袋数', type: 'number', step: '1' }, { key: 'notes', label: '备注', type: 'text', width: 220 },
      ] as Array<Column<PackagingRecommendation>>,
      factories: [{ key: 'id', label: 'ID', type: 'text', readOnly: true, width: 140 }, { key: 'name', label: '名称', type: 'text', width: 220 }, { key: 'default_port_id', label: '默认港口', type: 'select', options: portSelect }] as Array<Column<Factory>>,
      factory_product_costs: [{ key: 'id', label: 'ID', type: 'text', readOnly: true, width: 140 }, { key: 'factory_id', label: '工厂', type: 'select', options: factorySelect }, { key: 'product_id', label: '产品', type: 'select', options: productSelect }, { key: 'cost_rmb_per_ton', label: '工厂吨成本(RMB/吨)', type: 'number' }] as Array<Column<FactoryProductCost>>,
      ports: [{ key: 'id', label: 'ID', type: 'text', readOnly: true, width: 140 }, { key: 'name', label: '名称', type: 'text', width: 200 }, { key: 'code', label: '港口代码', type: 'text', width: 120 }, { key: 'country', label: '国家/地区', type: 'text', width: 160 }] as Array<Column<Port>>,
      port_charges_rules: [{ key: 'id', label: 'ID', type: 'text', readOnly: true, width: 140 }, { key: 'port_id', label: '港口', type: 'select', options: portSelect }, { key: 'mode', label: '运输模式', type: 'select', options: [{ value: 'FCL', label: 'FCL' }, { value: 'LCL', label: 'LCL' }] }, { key: 'container_type', label: '柜型', type: 'select', options: [{ value: '', label: '空' }, { value: '20GP', label: '20GP' }, { value: '40HQ', label: '40HQ' }] }, { key: 'base_rmb', label: '基础费用(RMB)', type: 'number' }, { key: 'extra_rmb_per_ton', label: '超吨费用(RMB/吨)', type: 'number' }] as Array<Column<PortChargesRule>>,
      container_load_rules: [{ key: 'id', label: 'ID', type: 'text', readOnly: true, width: 140 }, { key: 'product_id', label: '产品', type: 'select', options: productSelect }, { key: 'container_type', label: '柜型', type: 'select', options: [{ value: '20GP', label: '20GP' }, { value: '40HQ', label: '40HQ' }] }, { key: 'max_tons', label: '最大装柜吨数', type: 'number' }] as Array<Column<ContainerLoadRule>>,
      land_freight_rules: [{ key: 'id', label: 'ID', type: 'text', readOnly: true, width: 140 }, { key: 'mode', label: '运输模式', type: 'select', options: [{ value: 'FCL', label: 'FCL' }, { value: 'LCL', label: 'LCL' }] }, { key: 'factory_id', label: '工厂', type: 'select', options: factorySelect }, { key: 'container_type', label: '柜型', type: 'select', options: [{ value: '20GP', label: '20GP' }, { value: '40HQ', label: '40HQ' }] }, { key: 'min_rmb_per_ton', label: '最低每吨运费(RMB/吨)', type: 'number' }, { key: 'max_rmb_per_ton', label: '最高每吨运费(RMB/吨)', type: 'number' }, { key: 'default_rmb_per_ton', label: '默认每吨运费(RMB/吨)', type: 'number' }] as Array<Column<LandFreightRule>>,
      factory_packaging_overrides: [{ key: 'id', label: 'ID', type: 'text', readOnly: true, width: 140 }, { key: 'factory_id', label: '工厂', type: 'select', options: factorySelect }, { key: 'packaging_option_id', label: '包装方案', type: 'select', options: packagingSelect }, { key: 'carton_price_rmb_override', label: '纸箱价覆盖(RMB/箱)', type: 'number', nullable: true }, { key: 'bag_price_rmb_override', label: '袋材价覆盖(RMB/袋)', type: 'number', nullable: true }] as Array<Column<FactoryPackagingOverride>>,
    }
  }, [factoryOptions, innerPackOptions, packagingOptions, portOptions, productOptions, selectWithEmpty])

  const sectionStyle: React.CSSProperties = { padding: 14, border: '1px solid #1f2937', borderRadius: 12, backgroundColor: '#111827' }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0b0f1a', color: '#e5e7eb', padding: 20 }}>
      <h1 style={{ marginTop: 0 }}>数据维护</h1>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => void loadData()} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', cursor: 'pointer' }}>刷新</button>
        <span style={{ color: '#93c5fd' }}>{status}</span><span style={{ color: autoSaveColor }}>{autoSaveLabel}</span>
      </div>
      {error && <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, border: '1px solid #7f1d1d', backgroundColor: '#2a1111', color: '#fecaca' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>{TABS.map((tab) => <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #1f2937', backgroundColor: activeTab === tab.key ? '#1f2937' : '#0f172a', color: '#fff', cursor: 'pointer' }}>{tab.label}</button>)}</div>      {activeTab === 'settings' && (
        <div style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>设置</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <div><label>{labelFor('fx_rate')}</label><input type="number" step="0.01" value={settingsFxRate} onChange={(e) => { setSettingsFxRate(e.target.value); setDirtySettings(true); setAutoSaveState('idle') }} style={{ ...inputBaseStyle, marginTop: 6, padding: 8 }} /></div>
            <div><label>{labelFor('margin_pct')}</label><input type="number" step="0.01" value={settingsMarginPct} onChange={(e) => { setSettingsMarginPct(e.target.value); setDirtySettings(true); setAutoSaveState('idle') }} style={{ ...inputBaseStyle, marginTop: 6, padding: 8 }} /></div>
            <div><label>{labelFor('quote_valid_days')}</label><input type="number" step="1" value={settingsQuoteValidDays} onChange={(e) => { setSettingsQuoteValidDays(e.target.value); setDirtySettings(true); setAutoSaveState('idle') }} style={{ ...inputBaseStyle, marginTop: 6, padding: 8 }} /></div>
            <div><label>{labelFor('money_format_rmb_decimals')}</label><input type="number" step="1" value={settingsRmbDecimals} onChange={(e) => { setSettingsRmbDecimals(e.target.value); setDirtySettings(true); setAutoSaveState('idle') }} style={{ ...inputBaseStyle, marginTop: 6, padding: 8 }} /></div>
            <div><label>{labelFor('money_format_usd_decimals')}</label><input type="number" step="1" value={settingsUsdDecimals} onChange={(e) => { setSettingsUsdDecimals(e.target.value); setDirtySettings(true); setAutoSaveState('idle') }} style={{ ...inputBaseStyle, marginTop: 6, padding: 8 }} /></div>
            <div><label>{labelFor('pricing_formula_mode')}</label><select className="ui-select" value={settingsPricingFormulaMode} onChange={(e) => { setSettingsPricingFormulaMode(e.target.value); setDirtySettings(true); setAutoSaveState('idle') }} style={{ ...inputBaseStyle, marginTop: 6, padding: 8 }}><option value="divide">cost/(1-margin)</option></select></div>
            <div><label>{labelFor('rounding_policy')}</label><select className="ui-select" value={settingsRoundingPolicy} onChange={(e) => { setSettingsRoundingPolicy(e.target.value); setDirtySettings(true); setAutoSaveState('idle') }} style={{ ...inputBaseStyle, marginTop: 6, padding: 8 }}><option value="ceil">向上取整</option></select></div>
            <div>
              <label>{labelFor('ui_theme')}</label>
              <MantineSelect
                mt={6}
                value={settingsUiTheme}
                data={[
                  { value: 'classic', label: 'Classic Admin (稳重)' },
                  { value: 'neon', label: 'Neon Creative (渐变霓虹)' },
                  { value: 'minimal', label: 'Minimal Clean (极简浅色)' },
                ]}
                onChange={(value) => {
                  const nextTheme = (value ?? 'classic') as 'classic' | 'neon' | 'minimal'
                  setSettingsUiTheme(nextTheme)
                  setUiThemeKey(nextTheme)
                  setDirtySettings(true)
                  setAutoSaveState('idle')
                }}
              />
              <Text size="xs" c="dimmed" mt={6}>
                主题切换会立即应用到全局界面，并在保存后持久化。
              </Text>
            </div>
            <div style={{ gridColumn: '1 / span 2' }}><label>{labelFor('terms_template')}</label><textarea className="no-scroll" value={settingsTermsTemplate} onChange={(e) => { setSettingsTermsTemplate(e.target.value); setDirtySettings(true); setAutoSaveState('idle') }} rows={3} style={{ ...inputBaseStyle, marginTop: 6, padding: 8 }} /></div>
            <div style={{ display: 'flex', alignItems: 'end' }}><button onClick={() => void saveSettings()} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', backgroundColor: '#4ade80', color: '#000', cursor: 'pointer', fontWeight: 700, height: 38 }}>保存</button></div>
          </div>
        </div>
      )}

      {activeTab !== 'settings' && (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ marginTop: 0 }}>{TABS.find((t) => t.key === activeTab)?.label ?? activeTab}</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => addRow(activeTab)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', cursor: 'pointer' }}>新增</button>
              <button onClick={() => void saveTable(activeTab)} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', backgroundColor: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>保存</button>
            </div>
          </div>

          {activeTab === 'products' && <div>{tables.products.map((row) => <div key={row.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 20, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ marginBottom: 12, color: '#e2e8f0', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Product: {row.id}</span>
              <button onClick={() => deleteRow('products', row.id)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #7f1d1d', backgroundColor: '#2a1111', color: '#fecaca', cursor: 'pointer' }}>删除</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr 0.8fr 0.8fr 0.8fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>ID</div>
                <input type="text" value={row.id} readOnly style={{ ...inputBaseStyle, backgroundColor: '#111827' }} />
              </div>
              <div>
                <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>名称</div>
                <input type="text" value={row.name ?? ''} onChange={(e) => updateRow('products', row.id, 'name', e.target.value)} style={inputBaseStyle} />
              </div>
              <div>
                <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>Name (EN)</div>
                <input type="text" value={row.name_en ?? ''} onChange={(e) => updateRow('products', row.id, 'name_en', e.target.value)} style={inputBaseStyle} />
              </div>
              <div>
                <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>出口退税率</div>
                <input type="number" value={formatNumberInput(row.refund_rate)} onChange={(e) => updateRow('products', row.id, 'refund_rate', parseNumberInput(e.target.value, false))} style={inputBaseStyle} />
              </div>
              <div>
                <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>采购增值税率</div>
                <input type="number" value={formatNumberInput(row.purchase_vat_rate)} onChange={(e) => updateRow('products', row.id, 'purchase_vat_rate', parseNumberInput(e.target.value, false))} style={inputBaseStyle} />
              </div>
              <div>
                <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>开票加点</div>
                <input type="number" value={formatNumberInput(row.invoice_tax_point)} onChange={(e) => updateRow('products', row.id, 'invoice_tax_point', parseNumberInput(e.target.value, false))} style={inputBaseStyle} />
              </div>
              <div>
                <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>起运港</div>
                <select className="ui-select" value={row.pol_port_id ?? ''} onChange={(e) => updateRow('products', row.id, 'pol_port_id', e.target.value)} style={inputBaseStyle}>{portOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>Description (EN)</div>
                <textarea
                  className="no-scroll"
                  value={row.description_en ?? ''}
                  onChange={(e) => updateRow('products', row.id, 'description_en', e.target.value)}
                  style={{ ...inputBaseStyle, minHeight: 80, padding: '8px 10px' }}
                />
              </div>
              <div
                style={{ width: 360, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}
              >
                <div>
                  <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>Image Path</div>
                  <input
                    type="text"
                    value={row.image_path ?? ''}
                    readOnly
                    style={{ ...inputBaseStyle, padding: '8px 10px', backgroundColor: '#111827' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => void handleUploadProductImage(row.id)}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #1d4ed8', backgroundColor: '#172554', color: '#bfdbfe', cursor: 'pointer' }}
                  >
                    上传图片
                  </button>
                </div>
              </div>
            </div>
          </div>)}</div>}

          {activeTab === 'packaging_options' && (
            <div>
              {tables.packaging_options.map((pack) => (
                <div
                  key={pack.id}
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 20,
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ color: '#e2e8f0', fontWeight: 700 }}>Packaging: {pack.id}</div>
                    <button
                      onClick={() => deleteRow('packaging_options', pack.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid #7f1d1d',
                        backgroundColor: '#2a1111',
                        color: '#fecaca',
                        cursor: 'pointer',
                      }}
                    >
                      删除
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.2fr 1.2fr',
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>ID</div>
                      <input
                        type="text"
                        value={pack.id}
                        readOnly
                        style={{ ...inputBaseStyle, backgroundColor: '#111827' }}
                      />
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>产品</div>
                      <select
                        className="ui-select"
                        value={pack.product_id}
                        onChange={(e) =>
                          updateRow('packaging_options', pack.id, 'product_id', e.target.value)
                        }
                        style={inputBaseStyle}
                      >
                        {productOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>名称</div>
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
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>每袋重量(kg)</div>
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
                      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>每箱袋数</div>
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
                      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>
                        每箱纸箱成本(RMB)
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
                      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>
                        每袋包装成本(RMB)
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
                      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>内包装类型</div>
                      <select
                        className="ui-select"
                        value={pack.inner_pack_type}
                        onChange={(e) =>
                          updateRow('packaging_options', pack.id, 'inner_pack_type', e.target.value)
                        }
                        style={inputBaseStyle}
                      >
                        {innerPackOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>默认</div>
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
          {activeTab === 'land_freight_rules' && <><div style={{ marginBottom: 8, color: '#9ca3af' }}>国内段费用按 RMB/吨 维护，可在报价页临时覆盖本次每吨运费。</div><EditableTable columns={columnsByTable.land_freight_rules} rows={tables.land_freight_rules} onChange={(id, k, v) => updateRow('land_freight_rules', id, String(k), v)} onDelete={(id) => deleteRow('land_freight_rules', id)} /></>}
          {activeTab === 'factory_packaging_overrides' && <EditableTable columns={columnsByTable.factory_packaging_overrides} rows={tables.factory_packaging_overrides} onChange={(id, k, v) => updateRow('factory_packaging_overrides', id, String(k), v)} onDelete={(id) => deleteRow('factory_packaging_overrides', id)} />}
        </div>
      )}

      {!data && <div style={{ marginTop: 12, color: '#9ca3af' }}>暂无数据</div>}
    </div>
  )
}
