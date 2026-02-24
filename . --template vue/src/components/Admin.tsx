import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AppData,
  ContainerLoadRule,
  EditableTableKey,
  Factory,
  FactoryPackagingOverride,
  FactoryProductCost,
  InnerPackType,
  LandFreightRule,
  PackagingRecommendation,
  PackagingOption,
  Port,
  PortChargesRule,
  Product,
} from '@/types/domain'
import { INNER_PACK_LABELS, labelFor } from '@/utils/fieldLabels'
import { nextIdFromRows } from '@/utils/id'

type TabKey = EditableTableKey | 'settings'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'products', label: '浜у搧' },
  { key: 'packaging_options', label: '鍖呰鏂规' },
  { key: 'packaging_recommendations', label: '鎺ㄨ崘绠辫' },
  { key: 'factories', label: '宸ュ巶' },
  { key: 'factory_product_costs', label: '工厂吨成本' },
  { key: 'ports', label: '娓彛' },
  { key: 'port_charges_rules', label: '娓潅瑙勫垯' },
  { key: 'container_load_rules', label: '瑁呮煖鍚ㄦ暟' },
  { key: 'land_freight_rules', label: '国内段费用' },
  { key: 'factory_packaging_overrides', label: '工厂包装价覆盖' },
  { key: 'settings', label: '璁剧疆' },
]

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

type ColumnType = 'text' | 'number' | 'select' | 'checkbox'

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

function createEmptyTables(): TableState {
  return {
    products: [],
    packaging_options: [],
    packaging_recommendations: [],
    factories: [],
    factory_product_costs: [],
    ports: [],
    port_charges_rules: [],
    container_load_rules: [],
    land_freight_rules: [],
    factory_packaging_overrides: [],
  }
}

const ID_PREFIX: Record<EditableTableKey, string> = {
  products: 'prod',
  packaging_options: 'pack',
  packaging_recommendations: 'pr',
  factories: 'fct',
  factory_product_costs: 'fpc',
  ports: 'port',
  port_charges_rules: 'pcr',
  container_load_rules: 'clr',
  land_freight_rules: 'lfr',
  factory_packaging_overrides: 'fpo',
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  return false
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseNumberInput(value: string, nullable: boolean): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return nullable ? null : Number.NaN
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : Number.NaN
}

function formatNumberInput(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' && !Number.isFinite(value)) return ''
  return String(value)
}

function EditableTable<T extends { id: string }>(props: {
  columns: Array<Column<T>>
  rows: T[]
  onChange: (rowId: string, key: keyof T, value: unknown) => void
  onDelete: (rowId: string) => void
  renderActions?: (row: T) => ReactNode
}) {
  const { columns, rows, onChange, onDelete, renderActions } = props

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#cbd5f5' }}>
            {columns.map((col) => (
              <th key={String(col.key)} style={{ padding: '8px 6px', width: col.width }}>
                {col.label}
              </th>
            ))}
            <th style={{ padding: '8px 6px' }}>鎿嶄綔</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={{ borderTop: '1px solid #1f2937' }}>
              {columns.map((col) => {
                const rawValue = row[col.key] as unknown
                const cellStyle = { padding: '8px 6px' }

                if (col.type === 'checkbox') {
                  return (
                    <td key={String(col.key)} style={cellStyle}>
                      <input
                        type="checkbox"
                        checked={Boolean(rawValue)}
                        disabled={col.readOnly}
                        onChange={(e) => onChange(row.id, col.key, e.target.checked)}
                      />
                    </td>
                  )
                }

                if (col.type === 'select') {
                  return (
                    <td key={String(col.key)} style={cellStyle}>
                      <select
                        value={(rawValue ?? '') as string}
                        disabled={col.readOnly}
                        onChange={(e) => onChange(row.id, col.key, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: '1px solid #334155',
                          backgroundColor: '#0f172a',
                          color: '#fff',
                        }}
                      >
                        {(col.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  )
                }

                if (col.type === 'number') {
                  return (
                    <td key={String(col.key)} style={cellStyle}>
                      <input
                        type="number"
                        step={col.step ?? '0.01'}
                        value={formatNumberInput(rawValue)}
                        readOnly={col.readOnly}
                        onChange={(e) =>
                          onChange(
                            row.id,
                            col.key,
                            parseNumberInput(e.target.value, Boolean(col.nullable)),
                          )
                        }
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: '1px solid #334155',
                          backgroundColor: col.readOnly ? '#111827' : '#0f172a',
                          color: '#fff',
                        }}
                      />
                    </td>
                  )
                }

                return (
                  <td key={String(col.key)} style={cellStyle}>
                    <input
                      type="text"
                      value={(rawValue ?? '') as string}
                      readOnly={col.readOnly}
                      onChange={(e) => onChange(row.id, col.key, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid #334155',
                        backgroundColor: col.readOnly ? '#111827' : '#0f172a',
                        color: '#fff',
                      }}
                    />
                  </td>
                )
              })}
              <td style={{ padding: '8px 6px' }}>
                {renderActions && (
                  <div style={{ display: 'inline-flex', gap: 8, marginRight: 8 }}>
                    {renderActions(row)}
                  </div>
                )}
                <button
                  onClick={() => onDelete(row.id)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #7f1d1d',
                    backgroundColor: '#2a1111',
                    color: '#fecaca',
                    cursor: 'pointer',
                  }}
                >
                  鍒犻櫎
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export default function Admin() {
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
    return '鑷姩淇濆瓨绌洪棽'
  }, [autoSaveState, dirtyTables, dirtySettings])

  const autoSaveColor =
    autoSaveState === 'error'
      ? '#f87171'
      : autoSaveState === 'saving'
        ? '#fbbf24'
        : autoSaveState === 'saved'
          ? '#4ade80'
          : '#9ca3af'

  const loadData = async () => {
    setError('')
    setStatus('鍔犺浇涓?..')
    try {
      // @ts-ignore
      const appData = (await window.ipcRenderer.invoke('get-app-data')) as AppData
      setData(appData)
      setSettingsFxRate(String(appData.settings.fx_rate ?? 6.9))
      setSettingsMarginPct(String(appData.settings.margin_pct ?? 0.05))
      setSettingsQuoteValidDays(String(appData.settings.quote_valid_days ?? 7))
      setSettingsRmbDecimals(String(appData.settings.money_format?.rmb_decimals ?? 4))
      setSettingsUsdDecimals(String(appData.settings.money_format?.usd_decimals ?? 4))
      setSettingsPricingFormulaMode(appData.settings.pricing_formula_mode ?? 'divide')
      setSettingsRoundingPolicy(appData.settings.rounding_policy ?? 'ceil')
      setSettingsTermsTemplate(appData.settings.terms_template ?? '')
      suppressAutoSaveRef.current = true
      setTables({
        products: appData.products ?? [],
        packaging_options: appData.packaging_options ?? [],
        packaging_recommendations: appData.packaging_recommendations ?? [],
        factories: appData.factories ?? [],
        factory_product_costs: appData.factory_product_costs ?? [],
        ports: appData.ports ?? [],
        port_charges_rules: appData.port_charges_rules ?? [],
        container_load_rules: appData.container_load_rules ?? [],
        land_freight_rules: appData.land_freight_rules ?? [],
        factory_packaging_overrides: appData.factory_packaging_overrides ?? [],
      })
      setDirtyTables([])
      setDirtySettings(false)
      setAutoSaveState('idle')
      setStatus('数据已加载')
    } catch (e) {
      console.error(e)
      setError('加载失败，请检查控制台。')
      setStatus('')
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const productOptions = useMemo(
    () =>
      tables.products.map((item) => ({
        value: item.id,
        label: item.name || item.id,
      })),
    [tables.products],
  )

  const factoryOptions = useMemo(
    () =>
      tables.factories.map((item) => ({
        value: item.id,
        label: item.name || item.id,
      })),
    [tables.factories],
  )

  const packagingOptions = useMemo(
    () =>
      tables.packaging_options.map((item) => ({
        value: item.id,
        label: item.name || item.id,
      })),
    [tables.packaging_options],
  )

  const portOptions = useMemo(
    () =>
      tables.ports.map((item) => ({
        value: item.id,
        label: item.name || item.id,
      })),
    [tables.ports],
  )

  const innerPackOptions: Array<{ value: InnerPackType; label: string }> = Object.entries(
    INNER_PACK_LABELS,
  ).map(([value, label]) => ({
    value: value as InnerPackType,
    label,
  }))

  const updateRow = (table: EditableTableKey, rowId: string, key: string, value: unknown) => {
    let nextValue = value
    if (table === 'packaging_recommendations' && key === 'inner_pack_type' && value === '') {
      nextValue = null
    }
    setTables((prev) => {
      const list = prev[table] as unknown as Array<Record<string, unknown>>
      const next = list.map((row) => (row.id === rowId ? { ...row, [key]: nextValue } : row))
      return { ...prev, [table]: next } as TableState
    })
    markTableDirty(table)
  }

  const deleteRow = (table: EditableTableKey, rowId: string) => {
    setTables((prev) => {
      const list = prev[table] as unknown as Array<Record<string, unknown>>
      const next = list.filter((row) => row.id !== rowId)
      return { ...prev, [table]: next } as TableState
    })
    markTableDirty(table)
  }

  const handleUploadProductImage = async (productId: string) => {
    try {
      // @ts-ignore
      const result = (await window.ipcRenderer.invoke('select-product-image', {
        productId,
      })) as { success: boolean; canceled?: boolean; filePath?: string; message?: string }

      if (!result.success) {
        if (result.canceled) return
        setError(result.message ?? '鍥剧墖涓婁紶澶辫触')
        return
      }

      if (!result.filePath) {
        setError('鏈幏鍙栧埌鍥剧墖璺緞')
        return
      }

      updateRow('products', productId, 'image_path', result.filePath)
      setStatus('产品图片已更新')
      setError('')
    } catch (error) {
      setError(`鍥剧墖涓婁紶澶辫触锛?{String(error)}`)
    }
  }

  const addRow = (table: EditableTableKey) => {
    const nextRow = (() => {
      switch (table) {
        case 'products':
          return {
            id: nextIdFromRows(ID_PREFIX.products, tables.products),
            name: '',
            name_en: '',
            description_en: '',
            image_path: '',
            refund_rate: 0,
            purchase_vat_rate: 0.13,
            invoice_tax_point: 0.03,
            pol_port_id: tables.ports[0]?.id ?? '',
          } satisfies Product
        case 'packaging_options':
          return {
            id: nextIdFromRows(ID_PREFIX.packaging_options, tables.packaging_options),
            product_id: tables.products[0]?.id ?? '',
            name: '',
            unit_weight_kg: 1,
            units_per_carton: null,
            carton_price_rmb: 0,
            bag_price_rmb: 0,
            inner_pack_type: 'none',
            unit_cbm: null,
            carton_cbm: null,
            default_selected: false,
          } satisfies PackagingOption
        case 'packaging_recommendations':
          return {
            id: nextIdFromRows(ID_PREFIX.packaging_recommendations, tables.packaging_recommendations),
            product_id: tables.products[0]?.id ?? '',
            inner_pack_type: null,
            unit_weight_kg: 1,
            recommended_units_per_carton: 1,
            notes: '',
          } satisfies PackagingRecommendation
        case 'factories':
          return {
            id: nextIdFromRows(ID_PREFIX.factories, tables.factories),
            name: '',
            default_port_id: null,
          } satisfies Factory
        case 'factory_product_costs':
          return {
            id: nextIdFromRows(ID_PREFIX.factory_product_costs, tables.factory_product_costs),
            factory_id: tables.factories[0]?.id ?? '',
            product_id: tables.products[0]?.id ?? '',
            cost_rmb_per_ton: 0,
          } satisfies FactoryProductCost
        case 'ports':
          return {
            id: nextIdFromRows(ID_PREFIX.ports, tables.ports),
            name: '',
            code: '',
            country: null,
          } satisfies Port
        case 'port_charges_rules':
          return {
            id: nextIdFromRows(ID_PREFIX.port_charges_rules, tables.port_charges_rules),
            port_id: null,
            mode: 'FCL',
            container_type: '20GP',
            base_rmb: 0,
            extra_rmb_per_ton: 0,
          } satisfies PortChargesRule
        case 'container_load_rules':
          return {
            id: nextIdFromRows(ID_PREFIX.container_load_rules, tables.container_load_rules),
            product_id: tables.products[0]?.id ?? '',
            container_type: '20GP',
            max_tons: 0,
          } satisfies ContainerLoadRule
        case 'land_freight_rules':
          return {
            id: nextIdFromRows(ID_PREFIX.land_freight_rules, tables.land_freight_rules),
            mode: 'FCL',
            factory_id: null,
            container_type: '20GP',
            min_rmb_per_ton: 0,
            max_rmb_per_ton: 0,
            default_rmb_per_ton: 0,
          } satisfies LandFreightRule
        case 'factory_packaging_overrides':
          return {
            id: nextIdFromRows(ID_PREFIX.factory_packaging_overrides, tables.factory_packaging_overrides),
            factory_id: tables.factories[0]?.id ?? '',
            packaging_option_id: tables.packaging_options[0]?.id ?? '',
            carton_price_rmb_override: null,
            bag_price_rmb_override: null,
          } satisfies FactoryPackagingOverride
        default:
          return null
      }
    })()

    if (!nextRow) return
    setTables((prev) => ({ ...prev, [table]: [...prev[table], nextRow] }) as TableState)
    markTableDirty(table)
  }

  const tableLabel = (key: EditableTableKey) => TABS.find((tab) => tab.key === key)?.label ?? key

  const markTableDirty = (table: EditableTableKey) => {
    setDirtyTables((prev) => (prev.includes(table) ? prev : [...prev, table]))
    setAutoSaveState('idle')
  }

  const validateTable = (table: EditableTableKey): string[] => {
    const errors: string[] = []

    if (table === 'products') {
      tables.products.forEach((row, index) => {
        const rowLabel = `${tableLabel('products')} 第${index + 1} 行`
        if (isBlank(row.id)) errors.push(`${rowLabel}：${labelFor('id')} 不能为空`)
        if (isBlank(row.name)) errors.push(`${rowLabel}：${labelFor('name')} 不能为空`)
        if (!isFiniteNumber(row.refund_rate)) errors.push(`${rowLabel}：${labelFor('refund_rate')} 必须是数字`)
        if (!isFiniteNumber(row.purchase_vat_rate))
          errors.push(`${rowLabel}：${labelFor('purchase_vat_rate')} 必须是数字`)
        if (!isFiniteNumber(row.invoice_tax_point))
          errors.push(`${rowLabel}：${labelFor('invoice_tax_point')} 必须是数字`)
        if (isBlank(row.pol_port_id)) errors.push(`${rowLabel}：${labelFor('pol_port_id')} 不能为空`)
      })
      return errors
    }

    if (table === 'packaging_options') {
      const defaultCount = new Map<string, number>()
      tables.packaging_options.forEach((row, index) => {
        const rowLabel = `${tableLabel('packaging_options')} 第${index + 1} 行`
        if (isBlank(row.id)) errors.push(`${rowLabel}：${labelFor('id')} 不能为空`)
        if (isBlank(row.product_id)) errors.push(`${rowLabel}：${labelFor('product_id')} 不能为空`)
        if (isBlank(row.name)) errors.push(`${rowLabel}：${labelFor('name')} 不能为空`)
        if (!isFiniteNumber(row.unit_weight_kg))
          errors.push(`${rowLabel}：${labelFor('unit_weight_kg')} 必须是数字`)
        if (!isFiniteNumber(row.carton_price_rmb))
          errors.push(`${rowLabel}：${labelFor('carton_price_rmb')} 必须是数字`)
        if (!isFiniteNumber(row.bag_price_rmb))
          errors.push(`${rowLabel}：${labelFor('bag_price_rmb')} 必须是数字`)
        if (isBlank(row.inner_pack_type)) errors.push(`${rowLabel}：${labelFor('inner_pack_type')} 不能为空`)
        if (row.default_selected) {
          defaultCount.set(row.product_id, (defaultCount.get(row.product_id) ?? 0) + 1)
        }
      })
      defaultCount.forEach((count, productId) => {
        if (count > 1) {
          const productName = tables.products.find((item) => item.id === productId)?.name ?? productId
          errors.push(`packaging_options：产品 ${productName} 的默认包装超过 1 个`)
        }
      })
      return errors
    }

    if (table === 'packaging_recommendations') {
      tables.packaging_recommendations.forEach((row, index) => {
        const rowLabel = `${tableLabel('packaging_recommendations')} 第${index + 1} 行`
        if (isBlank(row.id)) errors.push(`${rowLabel}：${labelFor('id')} 不能为空`)
        if (isBlank(row.product_id)) errors.push(`${rowLabel}：${labelFor('product_id')} 不能为空`)
        if (!isFiniteNumber(row.unit_weight_kg))
          errors.push(`${rowLabel}：${labelFor('unit_weight_kg')} 必须是数字`)
        if (!isFiniteNumber(row.recommended_units_per_carton))
          errors.push(`${rowLabel}：${labelFor('recommended_units_per_carton')} 必须是数字`)
      })
      return errors
    }

    if (table === 'factories') {
      tables.factories.forEach((row, index) => {
        const rowLabel = `${tableLabel('factories')} 第${index + 1} 行`
        if (isBlank(row.id)) errors.push(`${rowLabel}：${labelFor('id')} 不能为空`)
        if (isBlank(row.name)) errors.push(`${rowLabel}：${labelFor('name')} 不能为空`)
      })
      return errors
    }

    if (table === 'factory_product_costs') {
      const seen = new Set<string>()
      tables.factory_product_costs.forEach((row, index) => {
        const rowLabel = `${tableLabel('factory_product_costs')} 第${index + 1} 行`
        if (isBlank(row.id)) errors.push(`${rowLabel}：${labelFor('id')} 不能为空`)
        if (isBlank(row.factory_id)) errors.push(`${rowLabel}：${labelFor('factory_id')} 不能为空`)
        if (isBlank(row.product_id)) errors.push(`${rowLabel}：${labelFor('product_id')} 不能为空`)
        if (!isFiniteNumber(row.cost_rmb_per_ton))
          errors.push(`${rowLabel}：${labelFor('cost_rmb_per_ton')} 必须是数字`)
        const key = `${row.factory_id}__${row.product_id}`
        if (seen.has(key)) errors.push(`${rowLabel}：工厂 + 产品组合重复`)
        seen.add(key)
      })
      return errors
    }

    if (table === 'ports') {
      tables.ports.forEach((row, index) => {
        const rowLabel = `${tableLabel('ports')} 第${index + 1} 行`
        if (isBlank(row.id)) errors.push(`${rowLabel}：${labelFor('id')} 不能为空`)
        if (isBlank(row.name)) errors.push(`${rowLabel}：${labelFor('name')} 不能为空`)
        if (isBlank(row.code)) errors.push(`${rowLabel}：港口代码不能为空`)
      })
      return errors
    }

    if (table === 'port_charges_rules') {
      tables.port_charges_rules.forEach((row, index) => {
        const rowLabel = `${tableLabel('port_charges_rules')} 第${index + 1} 行`
        if (isBlank(row.id)) errors.push(`${rowLabel}：${labelFor('id')} 不能为空`)
        if (isBlank(row.mode)) errors.push(`${rowLabel}：${labelFor('mode')} 不能为空`)
        if (!isFiniteNumber(row.base_rmb)) errors.push(`${rowLabel}：${labelFor('base_rmb')} 必须是数字`)
        if (!isFiniteNumber(row.extra_rmb_per_ton))
          errors.push(`${rowLabel}：${labelFor('extra_rmb_per_ton')} 必须是数字`)
      })
      return errors
    }

    if (table === 'container_load_rules') {
      tables.container_load_rules.forEach((row, index) => {
        const rowLabel = `${tableLabel('container_load_rules')} 第${index + 1} 行`
        if (isBlank(row.id)) errors.push(`${rowLabel}：${labelFor('id')} 不能为空`)
        if (isBlank(row.product_id)) errors.push(`${rowLabel}：${labelFor('product_id')} 不能为空`)
        if (isBlank(row.container_type)) errors.push(`${rowLabel}：${labelFor('container_type')} 不能为空`)
        if (!isFiniteNumber(row.max_tons)) errors.push(`${rowLabel}：${labelFor('max_tons')} 必须是数字`)
      })
      return errors
    }

    if (table === 'land_freight_rules') {
      tables.land_freight_rules.forEach((row, index) => {
        const rowLabel = `${tableLabel('land_freight_rules')} 第${index + 1} 行`
        if (isBlank(row.id)) errors.push(`${rowLabel}：${labelFor('id')} 不能为空`)
        if (isBlank(row.mode)) errors.push(`${rowLabel}：${labelFor('mode')} 不能为空`)
        if (isBlank(row.container_type)) errors.push(`${rowLabel}：${labelFor('container_type')} 不能为空`)
        if (!isFiniteNumber(row.min_rmb_per_ton))
          errors.push(`${rowLabel}：${labelFor('min_rmb_per_ton')} 必须是数字`)
        if (!isFiniteNumber(row.max_rmb_per_ton))
          errors.push(`${rowLabel}：${labelFor('max_rmb_per_ton')} 必须是数字`)
        if (!isFiniteNumber(row.default_rmb_per_ton))
          errors.push(`${rowLabel}：${labelFor('default_rmb_per_ton')} 必须是数字`)
      })
      return errors
    }

    if (table === 'factory_packaging_overrides') {
      tables.factory_packaging_overrides.forEach((row, index) => {
        const rowLabel = `${tableLabel('factory_packaging_overrides')} 第${index + 1} 行`
        if (isBlank(row.id)) errors.push(`${rowLabel}：${labelFor('id')} 不能为空`)
        if (isBlank(row.factory_id)) errors.push(`${rowLabel}：${labelFor('factory_id')} 不能为空`)
        if (isBlank(row.packaging_option_id))
          errors.push(`${rowLabel}：${labelFor('packaging_option_id')} 不能为空`)
        if (
          row.carton_price_rmb_override !== null &&
          row.carton_price_rmb_override !== undefined &&
          !isFiniteNumber(row.carton_price_rmb_override)
        ) {
          errors.push(`${rowLabel}：${labelFor('carton_price_rmb_override')} 必须是数字`)
        }
        if (
          row.bag_price_rmb_override !== null &&
          row.bag_price_rmb_override !== undefined &&
          !isFiniteNumber(row.bag_price_rmb_override)
        ) {
          errors.push(`${rowLabel}：${labelFor('bag_price_rmb_override')} 必须是数字`)
        }
      })
      return errors
    }

    return errors
  }
  const applyProductDefaults = (currentTables: TableState) => {
    const existingIds = new Set((data?.products ?? []).map((item) => item.id))
    const newProducts = currentTables.products.filter((item) => !existingIds.has(item.id))
    if (newProducts.length === 0) {
      return { tables: currentTables, touched: [] as EditableTableKey[] }
    }

    const nextPackaging = [...currentTables.packaging_options]
    const nextCosts = [...currentTables.factory_product_costs]
    const nextContainers = [...currentTables.container_load_rules]
    const touched = new Set<EditableTableKey>()

    newProducts.forEach((product) => {
      if (!nextPackaging.some((item) => item.product_id === product.id)) {
        nextPackaging.push({
          id: nextIdFromRows(ID_PREFIX.packaging_options, nextPackaging),
          product_id: product.id,
          name: `${product.name} 默认包装（需维护）`,
          unit_weight_kg: 1,
          units_per_carton: null,
          carton_price_rmb: 0,
          bag_price_rmb: 0,
          inner_pack_type: 'none',
          unit_cbm: null,
          carton_cbm: null,
          default_selected: true,
        })
        touched.add('packaging_options')
      }

      currentTables.factories.forEach((factory) => {
        const exists = nextCosts.some(
          (item) => item.factory_id === factory.id && item.product_id === product.id,
        )
        if (!exists) {
          nextCosts.push({
            id: nextIdFromRows(ID_PREFIX.factory_product_costs, nextCosts),
            factory_id: factory.id,
            product_id: product.id,
            cost_rmb_per_ton: 0,
          })
          touched.add('factory_product_costs')
        }
      })

      const containerTypes: Array<ContainerLoadRule['container_type']> = ['20GP', '40HQ']
      containerTypes.forEach((containerType) => {
        const exists = nextContainers.some(
          (item) => item.product_id === product.id && item.container_type === containerType,
        )
        if (!exists) {
          nextContainers.push({
            id: nextIdFromRows(ID_PREFIX.container_load_rules, nextContainers),
            product_id: product.id,
            container_type: containerType,
            max_tons: 0,
          })
          touched.add('container_load_rules')
        }
      })
    })

    return {
      tables: {
        ...currentTables,
        packaging_options: nextPackaging,
        factory_product_costs: nextCosts,
        container_load_rules: nextContainers,
      },
      touched: [...touched],
    }
  }

  const saveTable = async (
    table: EditableTableKey,
    options: { reload?: boolean; source?: 'manual' | 'auto' } = {},
  ) => {
    const { reload = true, source = 'manual' } = options
    setError('')
    const errors = validateTable(table)
    if (errors.length > 0) {
      setError(errors[0])
      setAutoSaveState('error')
      return
    }

    let tablesToSave = tables
    let extraTables: EditableTableKey[] = []
    if (table === 'products') {
      const result = applyProductDefaults(tables)
      tablesToSave = result.tables
      extraTables = result.touched
      if (extraTables.length > 0) {
        suppressAutoSaveRef.current = true
        setTables(tablesToSave)
      }
    }

    if (source === 'auto') {
      setAutoSaveState('saving')
    } else {
      setStatus(`姝ｅ湪淇濆瓨 ${table}...`)
    }

    const saveOne = async (key: EditableTableKey) => {
      // @ts-ignore
      return (await window.ipcRenderer.invoke('replace-table', {
        table: key,
        records: tablesToSave[key] as unknown as Array<Record<string, unknown>>,
      })) as { success: boolean; message?: string }
    }

    const targets: EditableTableKey[] = [table, ...extraTables]
    for (const target of targets) {
      const result = await saveOne(target)
      if (!result.success) {
        setError(result.message ?? `${target} 淇濆瓨澶辫触`)
        setStatus('')
        setAutoSaveState('error')
        return
      }
    }

    setDirtyTables((prev) => prev.filter((item) => !targets.includes(item)))
    if (source === 'auto') {
      setAutoSaveState('saved')
    } else {
      setStatus(`${table} 已保存`)
    }

    if (!reload) {
      setData((prev) => {
        if (!prev) return prev
        const next = { ...prev } as AppData
        const nextAny = next as unknown as Record<string, unknown>
        targets.forEach((key) => {
          nextAny[key] = tablesToSave[key] as unknown
        })
        return next
      })
    }

    if (reload) {
      await loadData()
    }
  }

  const saveSettings = async (options: { reload?: boolean; source?: 'manual' | 'auto' } = {}) => {
    const { reload = true, source = 'manual' } = options
    const fx = Number(settingsFxRate)
    const margin = Number(settingsMarginPct)
    const quoteDays = Number(settingsQuoteValidDays)
    const rmbDecimals = Number(settingsRmbDecimals)
    const usdDecimals = Number(settingsUsdDecimals)

    if (!Number.isFinite(fx) || fx <= 0) {
      setError('姹囩巼 fx_rate 蹇呴』 > 0')
      setAutoSaveState('error')
      return
    }
    if (!Number.isFinite(margin) || margin < 0 || margin >= 1) {
      setError('毛利率 margin_pct 必须在 [0, 1) 范围内')
      setAutoSaveState('error')
      return
    }
    if (!Number.isFinite(quoteDays) || quoteDays <= 0) {
      setError('鎶ヤ环鏈夋晥鏈熷ぉ鏁板繀椤?> 0')
      setAutoSaveState('error')
      return
    }
    if (!Number.isFinite(rmbDecimals) || rmbDecimals < 0) {
      setError('RMB 小数位数必须为非负整数')
      setAutoSaveState('error')
      return
    }
    if (!Number.isFinite(usdDecimals) || usdDecimals < 0) {
      setError('USD 小数位数必须为非负整数')
      setAutoSaveState('error')
      return
    }

    if (source === 'auto') {
      setAutoSaveState('saving')
    } else {
      setStatus('姝ｅ湪淇濆瓨璁剧疆...')
    }

    // @ts-ignore
    const result = (await window.ipcRenderer.invoke('update-settings', {
      fx_rate: fx,
      margin_pct: margin,
      quote_valid_days: quoteDays,
      money_format: {
        rmb_decimals: rmbDecimals,
        usd_decimals: usdDecimals,
      },
      pricing_formula_mode: settingsPricingFormulaMode,
      rounding_policy: settingsRoundingPolicy,
      terms_template: settingsTermsTemplate,
    })) as { success: boolean; message?: string }

    if (!result.success) {
      setError(result.message ?? '淇濆瓨澶辫触')
      setStatus('')
      setAutoSaveState('error')
      return
    }

    setDirtySettings(false)
    if (source === 'auto') {
      setAutoSaveState('saved')
    } else {
      setStatus('设置已保存')
    }

    if (!reload) {
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          settings: {
            ...prev.settings,
            fx_rate: fx,
            margin_pct: margin,
            quote_valid_days: quoteDays,
            money_format: {
              rmb_decimals: rmbDecimals,
              usd_decimals: usdDecimals,
            },
            pricing_formula_mode: settingsPricingFormulaMode,
            rounding_policy: settingsRoundingPolicy,
            terms_template: settingsTermsTemplate,
          },
        }
      })
    }

    if (reload) {
      await loadData()
    }
  }

  const selectWithEmpty = (options: Array<{ value: string; label: string }>, emptyLabel: string) => [
    { value: '', label: emptyLabel },
    ...options,
  ]

  const columnsByTable = useMemo(() => {
    const productSelect = selectWithEmpty(productOptions, '璇烽€夋嫨浜у搧')
    const factorySelect = selectWithEmpty(factoryOptions, '璇烽€夋嫨宸ュ巶')
    const packagingSelect = selectWithEmpty(packagingOptions, '璇烽€夋嫨鍖呰鏂规')
    const portSelect = selectWithEmpty(portOptions, '璇烽€夋嫨娓彛')
    const innerPackSelect = selectWithEmpty(innerPackOptions, '请选择内包装')

    return {
      products: [
        { key: 'id', label: labelFor('id'), type: 'text', readOnly: true, width: 140 },
        { key: 'name', label: labelFor('name'), type: 'text', width: 200 },
        { key: 'name_en', label: 'Name (EN)', type: 'text', width: 200 },
        { key: 'description_en', label: 'Description (EN)', type: 'text', width: 260 },
        { key: 'image_path', label: 'Image Path', type: 'text', width: 280, readOnly: true },
        { key: 'refund_rate', label: labelFor('refund_rate'), type: 'number' },
        { key: 'purchase_vat_rate', label: labelFor('purchase_vat_rate'), type: 'number' },
        { key: 'invoice_tax_point', label: labelFor('invoice_tax_point'), type: 'number' },
        { key: 'pol_port_id', label: labelFor('pol_port_id'), type: 'select', options: portOptions },
      ] as Array<Column<Product>>,
      packaging_options: [
        { key: 'id', label: labelFor('id'), type: 'text', readOnly: true, width: 140 },
        { key: 'product_id', label: labelFor('product_id'), type: 'select', options: productSelect },
        { key: 'name', label: labelFor('name'), type: 'text', width: 220 },
        { key: 'unit_weight_kg', label: labelFor('unit_weight_kg'), type: 'number', step: '0.01' },
        {
          key: 'units_per_carton',
          label: labelFor('units_per_carton'),
          type: 'number',
          nullable: true,
          step: '1',
        },
        { key: 'carton_price_rmb', label: labelFor('carton_price_rmb'), type: 'number' },
        { key: 'bag_price_rmb', label: labelFor('bag_price_rmb'), type: 'number' },
        {
          key: 'inner_pack_type',
          label: labelFor('inner_pack_type'),
          type: 'select',
          options: innerPackOptions,
        },
        { key: 'default_selected', label: '榛樿', type: 'checkbox' },
      ] as Array<Column<PackagingOption>>,
      packaging_recommendations: [
        { key: 'id', label: labelFor('id'), type: 'text', readOnly: true, width: 140 },
        { key: 'product_id', label: labelFor('product_id'), type: 'select', options: productSelect },
        { key: 'inner_pack_type', label: labelFor('inner_pack_type'), type: 'select', options: innerPackSelect },
        { key: 'unit_weight_kg', label: labelFor('unit_weight_kg'), type: 'number', step: '0.01' },
        {
          key: 'recommended_units_per_carton',
          label: labelFor('recommended_units_per_carton'),
          type: 'number',
          step: '1',
        },
        { key: 'notes', label: labelFor('notes'), type: 'text', width: 200 },
      ] as Array<Column<PackagingRecommendation>>,
      factories: [
        { key: 'id', label: labelFor('id'), type: 'text', readOnly: true, width: 140 },
        { key: 'name', label: labelFor('name'), type: 'text', width: 200 },
        { key: 'default_port_id', label: '榛樿娓彛', type: 'select', options: portSelect },
      ] as Array<Column<Factory>>,
      factory_product_costs: [
        { key: 'id', label: labelFor('id'), type: 'text', readOnly: true, width: 140 },
        { key: 'factory_id', label: labelFor('factory_id'), type: 'select', options: factorySelect },
        { key: 'product_id', label: labelFor('product_id'), type: 'select', options: productSelect },
        { key: 'cost_rmb_per_ton', label: labelFor('cost_rmb_per_ton'), type: 'number' },
      ] as Array<Column<FactoryProductCost>>,
      ports: [
        { key: 'id', label: labelFor('id'), type: 'text', readOnly: true, width: 140 },
        { key: 'name', label: labelFor('name'), type: 'text', width: 200 },
        { key: 'code', label: '娓彛浠ｇ爜', type: 'text', width: 120 },
        { key: 'country', label: '鍥藉/鍦板尯', type: 'text', width: 120 },
      ] as Array<Column<Port>>,
      port_charges_rules: [
        { key: 'id', label: labelFor('id'), type: 'text', readOnly: true, width: 140 },
        { key: 'port_id', label: labelFor('port_id'), type: 'select', options: portSelect },
        {
          key: 'mode',
          label: labelFor('mode'),
          type: 'select',
          options: [
            { value: 'FCL', label: 'FCL' },
            { value: 'LCL', label: 'LCL' },
          ],
        },
        {
          key: 'container_type',
          label: labelFor('container_type'),
          type: 'select',
          options: [
            { value: '', label: '空' },
            { value: '20GP', label: '20GP' },
            { value: '40HQ', label: '40HQ' },
          ],
        },
        { key: 'base_rmb', label: labelFor('base_rmb'), type: 'number' },
        { key: 'extra_rmb_per_ton', label: labelFor('extra_rmb_per_ton'), type: 'number' },
      ] as Array<Column<PortChargesRule>>,
      container_load_rules: [
        { key: 'id', label: labelFor('id'), type: 'text', readOnly: true, width: 140 },
        { key: 'product_id', label: labelFor('product_id'), type: 'select', options: productSelect },
        {
          key: 'container_type',
          label: labelFor('container_type'),
          type: 'select',
          options: [
            { value: '20GP', label: '20GP' },
            { value: '40HQ', label: '40HQ' },
          ],
        },
        { key: 'max_tons', label: labelFor('max_tons'), type: 'number' },
      ] as Array<Column<ContainerLoadRule>>,
      land_freight_rules: [
        { key: 'id', label: labelFor('id'), type: 'text', readOnly: true, width: 140 },
        {
          key: 'mode',
          label: labelFor('mode'),
          type: 'select',
          options: [
            { value: 'FCL', label: 'FCL' },
            { value: 'LCL', label: 'LCL' },
          ],
        },
        { key: 'factory_id', label: labelFor('factory_id'), type: 'select', options: factorySelect },
        {
          key: 'container_type',
          label: labelFor('container_type'),
          type: 'select',
          options: [
            { value: '20GP', label: '20GP' },
            { value: '40HQ', label: '40HQ' },
          ],
        },
        { key: 'min_rmb_per_ton', label: labelFor('min_rmb_per_ton'), type: 'number' },
        { key: 'max_rmb_per_ton', label: labelFor('max_rmb_per_ton'), type: 'number' },
        { key: 'default_rmb_per_ton', label: labelFor('default_rmb_per_ton'), type: 'number' },
      ] as Array<Column<LandFreightRule>>,
      factory_packaging_overrides: [
        { key: 'id', label: labelFor('id'), type: 'text', readOnly: true, width: 140 },
        { key: 'factory_id', label: labelFor('factory_id'), type: 'select', options: factorySelect },
        {
          key: 'packaging_option_id',
          label: labelFor('packaging_option_id'),
          type: 'select',
          options: packagingSelect,
        },
        {
          key: 'carton_price_rmb_override',
          label: labelFor('carton_price_rmb_override'),
          type: 'number',
          nullable: true,
        },
        {
          key: 'bag_price_rmb_override',
          label: labelFor('bag_price_rmb_override'),
          type: 'number',
          nullable: true,
        },
      ] as Array<Column<FactoryPackagingOverride>>,
    }
  }, [factoryOptions, innerPackOptions, packagingOptions, portOptions, productOptions])
  useEffect(() => {
    if (suppressAutoSaveRef.current) {
      suppressAutoSaveRef.current = false
      return
    }
    if (dirtyTables.length === 0 && !dirtySettings) return
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    autoSaveTimerRef.current = window.setTimeout(async () => {
      if (dirtySettings) {
        await saveSettings({ reload: false, source: 'auto' })
      }
      const tablesToSave = [...dirtyTables]
      for (const table of tablesToSave) {
        await saveTable(table, { reload: false, source: 'auto' })
      }
    }, 900)
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [dirtyTables, dirtySettings, saveSettings, saveTable])

  const sectionStyle = {
    padding: 14,
    border: '1px solid #1f2937',
    borderRadius: 12,
    backgroundColor: '#111827',
  } as const

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0b0f1a', color: '#e5e7eb', padding: 20 }}>
      <h1 style={{ marginTop: 0 }}>鏁版嵁缁存姢</h1>

      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => void loadData()}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #334155',
            backgroundColor: '#0f172a',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          鍒锋柊
        </button>
        <span style={{ color: '#93c5fd' }}>{status}</span>
        <span style={{ color: autoSaveColor }}>{autoSaveLabel}</span>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: 8,
            border: '1px solid #7f1d1d',
            backgroundColor: '#2a1111',
            color: '#fecaca',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #1f2937',
              backgroundColor: activeTab === tab.key ? '#1f2937' : '#0f172a',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'settings' && (
        <div style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>璁剧疆</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <div>
              <label>{labelFor('fx_rate')}</label>
              <input
                type="number"
                step="0.01"
                value={settingsFxRate}
                onChange={(e) => {
                  setSettingsFxRate(e.target.value)
                  setDirtySettings(true)
                  setAutoSaveState('idle')
                }}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: 8,
                  border: '1px solid #334155',
                  borderRadius: 6,
                  backgroundColor: '#0f172a',
                  color: '#fff',
                }}
              />
            </div>
            <div>
              <label>{labelFor('margin_pct')}</label>
              <input
                type="number"
                step="0.01"
                value={settingsMarginPct}
                onChange={(e) => {
                  setSettingsMarginPct(e.target.value)
                  setDirtySettings(true)
                  setAutoSaveState('idle')
                }}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: 8,
                  border: '1px solid #334155',
                  borderRadius: 6,
                  backgroundColor: '#0f172a',
                  color: '#fff',
                }}
              />
            </div>
            <div>
              <label>{labelFor('quote_valid_days')}</label>
              <input
                type="number"
                step="1"
                value={settingsQuoteValidDays}
                onChange={(e) => {
                  setSettingsQuoteValidDays(e.target.value)
                  setDirtySettings(true)
                  setAutoSaveState('idle')
                }}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: 8,
                  border: '1px solid #334155',
                  borderRadius: 6,
                  backgroundColor: '#0f172a',
                  color: '#fff',
                }}
              />
            </div>
            <div>
              <label>{labelFor('money_format_rmb_decimals')}</label>
              <input
                type="number"
                step="1"
                value={settingsRmbDecimals}
                onChange={(e) => {
                  setSettingsRmbDecimals(e.target.value)
                  setDirtySettings(true)
                  setAutoSaveState('idle')
                }}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: 8,
                  border: '1px solid #334155',
                  borderRadius: 6,
                  backgroundColor: '#0f172a',
                  color: '#fff',
                }}
              />
            </div>
            <div>
              <label>{labelFor('money_format_usd_decimals')}</label>
              <input
                type="number"
                step="1"
                value={settingsUsdDecimals}
                onChange={(e) => {
                  setSettingsUsdDecimals(e.target.value)
                  setDirtySettings(true)
                  setAutoSaveState('idle')
                }}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: 8,
                  border: '1px solid #334155',
                  borderRadius: 6,
                  backgroundColor: '#0f172a',
                  color: '#fff',
                }}
              />
            </div>
            <div>
              <label>{labelFor('pricing_formula_mode')}</label>
              <select
                value={settingsPricingFormulaMode}
                onChange={(e) => {
                  setSettingsPricingFormulaMode(e.target.value)
                  setDirtySettings(true)
                  setAutoSaveState('idle')
                }}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: 8,
                  border: '1px solid #334155',
                  borderRadius: 6,
                  backgroundColor: '#0f172a',
                  color: '#fff',
                }}
              >
                <option value="divide">cost/(1-margin)</option>
              </select>
            </div>
            <div>
              <label>{labelFor('rounding_policy')}</label>
              <select
                value={settingsRoundingPolicy}
                onChange={(e) => {
                  setSettingsRoundingPolicy(e.target.value)
                  setDirtySettings(true)
                  setAutoSaveState('idle')
                }}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: 8,
                  border: '1px solid #334155',
                  borderRadius: 6,
                  backgroundColor: '#0f172a',
                  color: '#fff',
                }}
              >
                <option value="ceil">鍚戜笂鍙栨暣</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / span 2' }}>
              <label>{labelFor('terms_template')}</label>
              <textarea
                value={settingsTermsTemplate}
                onChange={(e) => {
                  setSettingsTermsTemplate(e.target.value)
                  setDirtySettings(true)
                  setAutoSaveState('idle')
                }}
                rows={3}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: 8,
                  border: '1px solid #334155',
                  borderRadius: 6,
                  backgroundColor: '#0f172a',
                  color: '#fff',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button
                onClick={() => void saveSettings()}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#4ade80',
                  color: '#000',
                  cursor: 'pointer',
                  fontWeight: 700,
                  height: 38,
                }}
              >
                淇濆瓨璁剧疆
              </button>
            </div>
          </div>
        </div>
      )}
      {activeTab !== 'settings' && (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ marginTop: 0 }}>{TABS.find((tab) => tab.key === activeTab)?.label ?? activeTab}</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => addRow(activeTab)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #334155',
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                鏂板
              </button>
              <button
                onClick={() => void saveTable(activeTab)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                淇濆瓨
              </button>
            </div>
          </div>

          {activeTab === 'products' && (
            <div>
              {tables.products.map((row) => (
                <div
                  key={row.id}
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 20,
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div style={{ marginBottom: 12, color: '#e2e8f0', fontWeight: 700 }}>
                    Product: {row.id}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.2fr 1.2fr 0.8fr 0.8fr 0.8fr 1fr auto',
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <input
                      type="text"
                      value={row.id}
                      readOnly
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid #334155',
                        backgroundColor: '#111827',
                        color: '#fff',
                      }}
                    />
                    <input
                      type="text"
                      value={row.name ?? ''}
                      onChange={(e) => updateRow('products', row.id, 'name', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid #334155',
                        backgroundColor: '#0f172a',
                        color: '#fff',
                      }}
                    />
                    <input
                      type="text"
                      value={row.name_en ?? ''}
                      onChange={(e) => updateRow('products', row.id, 'name_en', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid #334155',
                        backgroundColor: '#0f172a',
                        color: '#fff',
                      }}
                    />
                    <input
                      type="number"
                      value={formatNumberInput(row.refund_rate)}
                      onChange={(e) =>
                        updateRow('products', row.id, 'refund_rate', parseNumberInput(e.target.value, false))
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid #334155',
                        backgroundColor: '#0f172a',
                        color: '#fff',
                      }}
                    />
                    <input
                      type="number"
                      value={formatNumberInput(row.purchase_vat_rate)}
                      onChange={(e) =>
                        updateRow(
                          'products',
                          row.id,
                          'purchase_vat_rate',
                          parseNumberInput(e.target.value, false),
                        )
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid #334155',
                        backgroundColor: '#0f172a',
                        color: '#fff',
                      }}
                    />
                    <input
                      type="number"
                      value={formatNumberInput(row.invoice_tax_point)}
                      onChange={(e) =>
                        updateRow(
                          'products',
                          row.id,
                          'invoice_tax_point',
                          parseNumberInput(e.target.value, false),
                        )
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid #334155',
                        backgroundColor: '#0f172a',
                        color: '#fff',
                      }}
                    />
                    <select
                      value={row.pol_port_id ?? ''}
                      onChange={(e) => updateRow('products', row.id, 'pol_port_id', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid #334155',
                        backgroundColor: '#0f172a',
                        color: '#fff',
                      }}
                    >
                      {portOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => deleteRow('products', row.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid #7f1d1d',
                        backgroundColor: '#2a1111',
                        color: '#fecaca',
                        cursor: 'pointer',
                      }}
                    >
                      鍒犻櫎
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#cbd5f5', marginBottom: 6 }}>Description (EN)</div>
                      <textarea
                        value={row.description_en ?? ''}
                        onChange={(e) => updateRow('products', row.id, 'description_en', e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: 80,
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: '1px solid #334155',
                          backgroundColor: '#0f172a',
                          color: '#fff',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        width: 360,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ color: '#cbd5f5', marginBottom: 6 }}>Image Path</div>
                        <input
                          type="text"
                          value={row.image_path ?? ''}
                          readOnly
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1px solid #334155',
                            backgroundColor: '#111827',
                            color: '#fff',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => void handleUploadProductImage(row.id)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px solid #1d4ed8',
                            backgroundColor: '#172554',
                            color: '#bfdbfe',
                            cursor: 'pointer',
                          }}
                        >
                          涓婁紶鍥剧墖
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'packaging_options' && (
            <EditableTable
              columns={columnsByTable.packaging_options}
              rows={tables.packaging_options}
              onChange={(rowId, key, value) =>
                updateRow('packaging_options', rowId, String(key), value)
              }
              onDelete={(rowId) => deleteRow('packaging_options', rowId)}
            />
          )}

          {activeTab === 'packaging_recommendations' && (
            <EditableTable
              columns={columnsByTable.packaging_recommendations}
              rows={tables.packaging_recommendations}
              onChange={(rowId, key, value) =>
                updateRow('packaging_recommendations', rowId, String(key), value)
              }
              onDelete={(rowId) => deleteRow('packaging_recommendations', rowId)}
            />
          )}

          {activeTab === 'factories' && (
            <EditableTable
              columns={columnsByTable.factories}
              rows={tables.factories}
              onChange={(rowId, key, value) => updateRow('factories', rowId, String(key), value)}
              onDelete={(rowId) => deleteRow('factories', rowId)}
            />
          )}

          {activeTab === 'factory_product_costs' && (
            <EditableTable
              columns={columnsByTable.factory_product_costs}
              rows={tables.factory_product_costs}
              onChange={(rowId, key, value) =>
                updateRow('factory_product_costs', rowId, String(key), value)
              }
              onDelete={(rowId) => deleteRow('factory_product_costs', rowId)}
            />
          )}

          {activeTab === 'ports' && (
            <EditableTable
              columns={columnsByTable.ports}
              rows={tables.ports}
              onChange={(rowId, key, value) => updateRow('ports', rowId, String(key), value)}
              onDelete={(rowId) => deleteRow('ports', rowId)}
            />
          )}

          {activeTab === 'port_charges_rules' && (
            <EditableTable
              columns={columnsByTable.port_charges_rules}
              rows={tables.port_charges_rules}
              onChange={(rowId, key, value) =>
                updateRow('port_charges_rules', rowId, String(key), value)
              }
              onDelete={(rowId) => deleteRow('port_charges_rules', rowId)}
            />
          )}

          {activeTab === 'container_load_rules' && (
            <EditableTable
              columns={columnsByTable.container_load_rules}
              rows={tables.container_load_rules}
              onChange={(rowId, key, value) =>
                updateRow('container_load_rules', rowId, String(key), value)
              }
              onDelete={(rowId) => deleteRow('container_load_rules', rowId)}
            />
          )}

          {activeTab === 'land_freight_rules' && (
            <>
              <div style={{ marginBottom: 8, color: '#9ca3af' }}>
                璇存槑锛氬浗鍐呮璐圭敤鎸?RMB/鍚?缁存姢锛屽彲鍦ㄦ姤浠烽〉涓存椂瑕嗙洊鏈姣忓惃杩愯垂銆?              </div>
              <EditableTable
                columns={columnsByTable.land_freight_rules}
                rows={tables.land_freight_rules}
                onChange={(rowId, key, value) =>
                  updateRow('land_freight_rules', rowId, String(key), value)
                }
                onDelete={(rowId) => deleteRow('land_freight_rules', rowId)}
              />
            </>
          )}

          {activeTab === 'factory_packaging_overrides' && (
            <EditableTable
              columns={columnsByTable.factory_packaging_overrides}
              rows={tables.factory_packaging_overrides}
              onChange={(rowId, key, value) =>
                updateRow('factory_packaging_overrides', rowId, String(key), value)
              }
              onDelete={(rowId) => deleteRow('factory_packaging_overrides', rowId)}
            />
          )}
        </div>
      )}

      {!data && <div style={{ marginTop: 12, color: '#9ca3af' }}>鏆傛棤鏁版嵁</div>}
    </div>
  )
}

