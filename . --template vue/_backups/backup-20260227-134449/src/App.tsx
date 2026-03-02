
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Button, Card, NumberInput, Select } from '@mantine/core'
import Admin from '@/components/Admin'
import { calculateQuote, formatCurrency, type CalculateQuoteResult } from '@/utils/calculateQuote'
import { INNER_PACK_LABELS, labelFor } from '@/utils/fieldLabels'
import { nextIdFromRows } from '@/utils/id'
import type {
  AppData,
  ContainerType,
  Factory,
  InnerPackType,
  Mode,
  PackagingOption,
  Port,
  Product,
  QtyInputType,
} from '@/types/domain'

const APP_VERSION = '2.5.8'

function parseNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

function sourceLabel(source: 'default' | 'override' | 'custom'): string {
  if (source === 'override') return '使用覆盖（含0覆盖）'
  if (source === 'custom') return '使用自定义'
  return '使用默认'
}

function Quoter() {
  const [data, setData] = useState<AppData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedPackagingId, setSelectedPackagingId] = useState('')
  const [selectedFactoryId, setSelectedFactoryId] = useState('')

  const [mode, setMode] = useState<Mode>('FCL')
  const [containerType, setContainerType] = useState<ContainerType>('20GP')

  const [fclTonsHint, setFclTonsHint] = useState('')
  const [fclBagsHint, setFclBagsHint] = useState('')
  const [fclLastEdited, setFclLastEdited] = useState<'tons' | 'bags' | null>(null)
  const [lclInputType, setLclInputType] = useState<QtyInputType>('tons')
  const [lclInputValue, setLclInputValue] = useState('')

  const [showCustomPackaging, setShowCustomPackaging] = useState(false)
  const [customUnitWeightKg, setCustomUnitWeightKg] = useState('')
  const [customUnitsPerCarton, setCustomUnitsPerCarton] = useState('')
  const [customBagPrice, setCustomBagPrice] = useState('')
  const [customCartonPrice, setCustomCartonPrice] = useState('')
  const [customInnerPackType, setCustomInnerPackType] = useState<InnerPackType>('carton')
  const [unitsPerCartonTouched, setUnitsPerCartonTouched] = useState(false)
  const [recommendedUnitsPerCarton, setRecommendedUnitsPerCarton] = useState<number | null>(null)

  const [fxRate, setFxRate] = useState('6.9')
  const [marginPct, setMarginPct] = useState('0.05')
  const [landFreightOverridePerTon, setLandFreightOverridePerTon] = useState('')

  const [validationError, setValidationError] = useState('')
  const [exportMessage, setExportMessage] = useState('')
  const [quoteResult, setQuoteResult] = useState<CalculateQuoteResult | null>(null)

  const loadData = async () => {
    setLoading(true)
    setLoadError('')
    try {
      // @ts-ignore
      const appData = (await window.ipcRenderer.invoke('get-app-data')) as AppData
      setData(appData)
      setFxRate(String(appData.settings.fx_rate ?? 6.9))
      setMarginPct(String(appData.settings.margin_pct ?? 0.05))
    } catch (error) {
      console.error(error)
      setLoadError('数据加载失败，请重试。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])
  const portsById = useMemo(() => {
    const map = new Map<string, Port>()
    ;(data?.ports ?? []).forEach((port) => map.set(port.id, port))
    return map
  }, [data])

  const products = data?.products ?? []
  const selectedProduct: Product | null = useMemo(() => {
    return products.find((item) => item.id === selectedProductId) ?? null
  }, [products, selectedProductId])

  const packagingOptions: PackagingOption[] = useMemo(() => {
    if (!data || !selectedProductId) return []
    return data.packaging_options.filter((item) => item.product_id === selectedProductId)
  }, [data, selectedProductId])

  const selectedPackaging: PackagingOption | null = useMemo(() => {
    return packagingOptions.find((item) => item.id === selectedPackagingId) ?? null
  }, [packagingOptions, selectedPackagingId])

  const factories: Factory[] = data?.factories ?? []
  const costByFactoryId = useMemo(() => {
    const map = new Map<string, number>()
    if (!data || !selectedProductId) return map
    data.factory_product_costs
      .filter((item) => item.product_id === selectedProductId)
      .forEach((item) => map.set(item.factory_id, item.cost_rmb_per_ton))
    return map
  }, [data, selectedProductId])

  const selectedFactoryCost = selectedFactoryId ? costByFactoryId.get(selectedFactoryId) : undefined

  const defaultPackagingId = useMemo(() => {
    if (!selectedProduct || packagingOptions.length === 0) return ''
    if (selectedProduct.default_packaging_option_id) {
      const exists = packagingOptions.some(
        (item) => item.id === selectedProduct.default_packaging_option_id,
      )
      if (exists) return selectedProduct.default_packaging_option_id
    }
    const flagged = packagingOptions.find((item) => item.default_selected)
    return flagged?.id ?? packagingOptions[0].id
  }, [selectedProduct, packagingOptions])

  useEffect(() => {
    if (!selectedProductId) {
      setSelectedPackagingId('')
      setSelectedFactoryId('')
      return
    }
    if (defaultPackagingId) {
      setSelectedPackagingId(defaultPackagingId)
    }
    if (factories.length > 0) {
      const factoryWithCost = factories.find((factory) => costByFactoryId.has(factory.id))
      setSelectedFactoryId(factoryWithCost?.id ?? factories[0].id)
    }
    setQuoteResult(null)
    setShowCustomPackaging(false)
    setLandFreightOverridePerTon('')
  }, [selectedProductId, defaultPackagingId, factories, costByFactoryId])

  useEffect(() => {
    if (!selectedPackaging) return
    setCustomUnitWeightKg(String(selectedPackaging.unit_weight_kg))
    setCustomUnitsPerCarton(
      selectedPackaging.units_per_carton === null ? '' : String(selectedPackaging.units_per_carton),
    )
    setCustomBagPrice(String(selectedPackaging.bag_price_rmb))
    setCustomCartonPrice(String(selectedPackaging.carton_price_rmb))
    setCustomInnerPackType(selectedPackaging.inner_pack_type)
    setUnitsPerCartonTouched(false)
    setRecommendedUnitsPerCarton(null)
  }, [selectedPackagingId, selectedPackaging])

  const effectiveUnitWeight = useMemo(() => {
    if (!selectedPackaging) return null
    if (!showCustomPackaging) return selectedPackaging.unit_weight_kg
    const custom = parseNumber(customUnitWeightKg)
    return custom ?? selectedPackaging.unit_weight_kg
  }, [selectedPackaging, showCustomPackaging, customUnitWeightKg])

  const handleFclTonsChange = (value: string) => {
    setFclLastEdited('tons')
    setFclTonsHint(value)
    const tons = parseNumber(value)
    if (
      !effectiveUnitWeight ||
      !Number.isFinite(effectiveUnitWeight) ||
      effectiveUnitWeight <= 0 ||
      tons === null
    ) {
      setFclBagsHint('')
      return
    }
    const bags = (tons * 1000) / effectiveUnitWeight
    setFclBagsHint(String(bags))
  }

  const handleFclBagsChange = (value: string) => {
    setFclLastEdited('bags')
    setFclBagsHint(value)
    const bags = parseNumber(value)
    if (
      !effectiveUnitWeight ||
      !Number.isFinite(effectiveUnitWeight) ||
      effectiveUnitWeight <= 0 ||
      bags === null
    ) {
      setFclTonsHint('')
      return
    }
    const tons = (bags * effectiveUnitWeight) / 1000
    setFclTonsHint(String(tons))
  }

  useEffect(() => {
    if (!effectiveUnitWeight || !Number.isFinite(effectiveUnitWeight) || effectiveUnitWeight <= 0) return
    if (fclLastEdited === 'tons') {
      const tons = parseNumber(fclTonsHint)
      if (tons === null) return
      setFclBagsHint(String((tons * 1000) / effectiveUnitWeight))
      return
    }
    if (fclLastEdited === 'bags') {
      const bags = parseNumber(fclBagsHint)
      if (bags === null) return
      setFclTonsHint(String((bags * effectiveUnitWeight) / 1000))
    }
  }, [effectiveUnitWeight, fclLastEdited, fclTonsHint, fclBagsHint])

  const bagsPerTon = effectiveUnitWeight ? 1000 / effectiveUnitWeight : null

  const lclTonsValue = useMemo(() => {
    if (!bagsPerTon) return null
    const input = parseNumber(lclInputValue)
    if (input === null) return null
    if (lclInputType === 'tons') return input
    return input / bagsPerTon
  }, [bagsPerTon, lclInputType, lclInputValue])

  const lclBagsValue = useMemo(() => {
    if (!bagsPerTon) return null
    const input = parseNumber(lclInputValue)
    if (input === null) return null
    if (lclInputType === 'bags') return input
    return input * bagsPerTon
  }, [bagsPerTon, lclInputType, lclInputValue])

  const packagingRecommendations = data?.packaging_recommendations ?? []
  const matchedRecommendation = useMemo(() => {
    if (!selectedProductId) return null
    const weight = parseNumber(customUnitWeightKg)
    if (!weight) return null
    const packType = showCustomPackaging
      ? customInnerPackType
      : selectedPackaging?.inner_pack_type ?? null
    const epsilon = 0.0001
    return (
      packagingRecommendations.find((item) => {
        if (item.product_id !== selectedProductId) return false
        if (item.inner_pack_type && packType && item.inner_pack_type !== packType) return false
        return Math.abs(item.unit_weight_kg - weight) < epsilon
      }) ?? null
    )
  }, [
    selectedProductId,
    customUnitWeightKg,
    customInnerPackType,
    showCustomPackaging,
    selectedPackaging,
    packagingRecommendations,
  ])

  useEffect(() => {
    if (!showCustomPackaging) {
      setRecommendedUnitsPerCarton(null)
      return
    }
    if (matchedRecommendation) {
      setRecommendedUnitsPerCarton(matchedRecommendation.recommended_units_per_carton)
      if (!unitsPerCartonTouched) {
        setCustomUnitsPerCarton(String(matchedRecommendation.recommended_units_per_carton))
      }
    } else {
      setRecommendedUnitsPerCarton(null)
    }
  }, [showCustomPackaging, matchedRecommendation, unitsPerCartonTouched])
  const landFreightRule = useMemo(() => {
    if (!data || !selectedFactoryId) return null
    return (
      data.land_freight_rules.find(
        (item) =>
          item.mode === mode &&
          item.container_type === containerType &&
          item.factory_id === selectedFactoryId,
      ) ??
      data.land_freight_rules.find(
        (item) =>
          item.mode === mode &&
          item.container_type === containerType &&
          (item.factory_id === null || item.factory_id === ''),
      ) ??
      null
    )
  }, [data, selectedFactoryId, mode, containerType])

  const defaultLandFreightPerTon = landFreightRule?.default_rmb_per_ton ?? null

  const rmbDecimals = useMemo(() => {
    const value = Number(data?.settings.money_format?.rmb_decimals ?? 4)
    return Number.isFinite(value) && value >= 0 ? value : 4
  }, [data])

  const usdDecimals = useMemo(() => {
    const value = Number(data?.settings.money_format?.usd_decimals ?? 4)
    return Number.isFinite(value) && value >= 0 ? value : 4
  }, [data])

  const formatRmb = (value: number, decimals = rmbDecimals) => formatCurrency(value, 'CNY', decimals)
  const formatUsd = (value: number, decimals = usdDecimals) => formatCurrency(value, 'USD', decimals)
  const toMantineNumber = (value: string): number | '' => {
    if (value.trim() === '') return ''
    const n = Number(value)
    return Number.isFinite(n) ? n : ''
  }

  const productSelectData = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.name} | ${portsById.get(product.pol_port_id)?.name ?? product.pol_port_id}`,
      })),
    [products, portsById],
  )

  const packagingSelectData = useMemo(
    () =>
      packagingOptions.map((item) => {
        const cartonText =
          item.units_per_carton && item.units_per_carton > 0 ? `每箱${item.units_per_carton}袋` : '不装箱'
        return {
          value: item.id,
          label: `${item.name} | ${item.unit_weight_kg}kg | ${cartonText} | ${INNER_PACK_LABELS[item.inner_pack_type]}`,
        }
      }),
    [packagingOptions],
  )

  const factorySelectData = useMemo(
    () => factories.map((factory) => ({ value: factory.id, label: factory.name })),
    [factories],
  )

  const disableReason = useMemo(() => {
    if (!data) return '数据未加载完成'
    if (!selectedProduct) return '请选择产品'
    if (!selectedPackaging) return '请选择包装方案'
    if (!selectedFactoryId) return '请选择工厂'
    if (selectedFactoryCost === undefined || selectedFactoryCost === null || selectedFactoryCost <= 0) {
      return '请维护工厂吨成本'
    }
    const fx = parseNumber(fxRate)
    if (!fx || fx <= 0) return '汇率必须大于 0'
    const margin = parseNumber(marginPct)
    if (margin === null || margin < 0 || margin >= 1) return '毛利率必须在 0~1 之间'

    const fclHint = parseNumber(fclTonsHint)
    if (fclTonsHint.trim() !== '' && (!fclHint || fclHint <= 0)) {
      return '整柜吨数（可选）必须大于 0'
    }

    const landOverride = landFreightOverridePerTon.trim()
    if (landOverride !== '') {
      const parsed = parseNumber(landOverride)
      if (parsed === null || parsed < 0) return '每吨国内运费必须是非负数'
    }

    if (showCustomPackaging) {
      const weight = parseNumber(customUnitWeightKg)
      if (!weight || weight <= 0) return '自定义袋重必须大于 0'
      const units = customUnitsPerCarton.trim()
      if (units !== '') {
        const parsed = parseNumber(units)
        if (parsed === null || parsed < 0) return '自定义箱规必须是非负数（0=不装箱）'
        if (!Number.isInteger(parsed)) return '自定义箱规必须为整数'
      }
      const bagCost = customBagPrice.trim()
      if (bagCost !== '') {
        const parsed = parseNumber(bagCost)
        if (parsed === null || parsed < 0) return '每袋包装成本必须是非负数'
      }
      const cartonCost = customCartonPrice.trim()
      if (cartonCost !== '') {
        const parsed = parseNumber(cartonCost)
        if (parsed === null || parsed < 0) return '每箱纸箱成本必须是非负数'
      }
    }

    if (mode === 'LCL') {
      const input = parseNumber(lclInputValue)
      if (!input || input <= 0) return 'LCL 模式需要输入吨数或袋数'
    }

    return ''
  }, [
    data,
    selectedProduct,
    selectedPackaging,
    selectedFactoryId,
    selectedFactoryCost,
    fxRate,
    marginPct,
    fclTonsHint,
    landFreightOverridePerTon,
    showCustomPackaging,
    customUnitWeightKg,
    customUnitsPerCarton,
    customBagPrice,
    customCartonPrice,
    mode,
    lclInputValue,
  ])

  const handleSaveDerivedPackaging = async () => {
    if (!data || !selectedProduct || !selectedPackaging) return
    const weight = parseNumber(customUnitWeightKg)
    if (!weight || weight <= 0) {
      setValidationError('每袋重量必须大于 0')
      return
    }

    const unitsRaw = customUnitsPerCarton.trim()
    const unitsValue = unitsRaw === '' ? null : Number(unitsRaw)
    if (unitsValue !== null) {
      if (!Number.isFinite(unitsValue) || unitsValue < 0) {
        setValidationError('每箱袋数必须是非负数')
        return
      }
      if (!Number.isInteger(unitsValue)) {
        setValidationError('每箱袋数必须为整数')
        return
      }
    }

    const bagPrice =
      customBagPrice.trim() === '' ? selectedPackaging.bag_price_rmb : Number(customBagPrice)
    const cartonPrice =
      customCartonPrice.trim() === ''
        ? selectedPackaging.carton_price_rmb
        : Number(customCartonPrice)

    if (!Number.isFinite(bagPrice) || bagPrice < 0) {
      setValidationError('每袋包装成本必须是非负数')
      return
    }
    if (!Number.isFinite(cartonPrice) || cartonPrice < 0) {
      setValidationError('每箱纸箱成本必须是非负数')
      return
    }

    const unitsText = unitsValue && unitsValue > 0 ? `${unitsValue}袋/箱` : '不装箱'
    const newOption: PackagingOption = {
      id: nextIdFromRows('pack', data.packaging_options),
      product_id: selectedProduct.id,
      name: `袋装${weight}kg（${unitsText}）`,
      unit_weight_kg: weight,
      units_per_carton: unitsValue && unitsValue > 0 ? unitsValue : null,
      carton_price_rmb: cartonPrice,
      bag_price_rmb: bagPrice,
      inner_pack_type: customInnerPackType,
      unit_cbm: null,
      carton_cbm: null,
      default_selected: false,
    }

    const nextOptions = [...data.packaging_options, newOption]
    try {
      // @ts-ignore
      const result = (await window.ipcRenderer.invoke('replace-table', {
        table: 'packaging_options',
        records: nextOptions,
      })) as { success: boolean; message?: string }

      if (!result.success) {
        setValidationError(result.message ?? '保存失败')
        return
      }

      setData({ ...data, packaging_options: nextOptions })
      setSelectedPackagingId(newOption.id)
      setShowCustomPackaging(false)
      setValidationError('')
    } catch (error) {
      setValidationError(`保存失败：${String(error)}`)
    }
  }
  const handleCalculate = async () => {
    if (disableReason) {
      setValidationError(disableReason)
      return
    }
    if (!data || !selectedProduct || !selectedPackaging) return

    try {
      const fx = Number(fxRate)
      const margin = Number(marginPct)
      const customWeight = showCustomPackaging
        ? parseNumber(customUnitWeightKg) ?? undefined
        : undefined
      const customUnits = showCustomPackaging
        ? customUnitsPerCarton.trim() === ''
          ? undefined
          : Number(customUnitsPerCarton)
        : undefined
      const customBag = showCustomPackaging
        ? customBagPrice.trim() === ''
          ? undefined
          : Number(customBagPrice)
        : undefined
      const customCarton = showCustomPackaging
        ? customCartonPrice.trim() === ''
          ? undefined
          : Number(customCartonPrice)
        : undefined
      const customInnerPack = showCustomPackaging ? customInnerPackType : undefined
      const landOverride =
        landFreightOverridePerTon.trim() === '' ? undefined : Number(landFreightOverridePerTon)

      const fclTons = parseNumber(fclTonsHint)
      const lclQty = parseNumber(lclInputValue)

      const result = calculateQuote({
        data,
        product_id: selectedProduct.id,
        packaging_option_id: selectedPackaging.id,
        factory_id: selectedFactoryId,
        mode,
        container_type: containerType,
        fx_rate: fx,
        margin_pct: margin,
        qty_input_type: mode === 'LCL' ? lclInputType : fclTons ? 'tons' : undefined,
        qty_input_value: mode === 'LCL' ? lclQty ?? undefined : fclTons ?? undefined,
        override_unit_weight_kg: customWeight,
        override_units_per_carton: customUnits,
        override_bag_price_rmb: customBag,
        override_carton_price_rmb: customCarton,
        override_inner_pack_type: customInnerPack,
        land_fee_override_rmb_per_ton: landOverride,
      })

      setQuoteResult(result)
      setValidationError('')
      setExportMessage('')

      // @ts-ignore
      await window.ipcRenderer.invoke('save-calculation', {
        input: {
          product_id: selectedProduct.id,
          packaging_option_id: selectedPackaging.id,
          factory_id: selectedFactoryId,
          mode,
          container_type: containerType,
          qty_input_type: mode === 'LCL' ? lclInputType : fclTons ? 'tons' : null,
          qty_input_value: mode === 'LCL' ? lclQty ?? null : fclTons ?? null,
          fx_rate: fx,
          margin_pct: margin,
          land_fee_override_rmb_per_ton: landOverride ?? null,
        },
        result,
      })
    } catch (error) {
      setValidationError(`计算失败：${String(error)}`)
    }
  }

  const handleExportExternalQuotation = async () => {
    if (!data || !selectedProduct || !selectedPackaging || !quoteResult) return

    const effectiveUnitsPerCarton = showCustomPackaging
      ? customUnitsPerCarton.trim() === ''
        ? selectedPackaging.units_per_carton
        : Number(customUnitsPerCarton)
      : selectedPackaging.units_per_carton
    const effectiveWeight = showCustomPackaging
      ? parseNumber(customUnitWeightKg) ?? selectedPackaging.unit_weight_kg
      : selectedPackaging.unit_weight_kg
    const effectivePackType = showCustomPackaging ? customInnerPackType : selectedPackaging.inner_pack_type
    const cartonText =
      effectiveUnitsPerCarton && effectiveUnitsPerCarton > 0
        ? `每箱${effectiveUnitsPerCarton}袋`
        : '不装箱'
    const packagingText = `${selectedPackaging.name} | ${effectiveWeight}kg | ${cartonText} | ${INNER_PACK_LABELS[effectivePackType]}`

    const payload = {
      quoteResult,
      input: {
        productName: selectedProduct.name,
        name_en: selectedProduct.name_en,
        productNameEn: selectedProduct.name_en,
        description_en: selectedProduct.description_en,
        descriptionEn: selectedProduct.description_en,
        description: `${selectedProduct.name} ${packagingText}`,
        packagingText,
        quantityBagsInt: quoteResult.summary.bags_int,
        containerType,
        polPortName,
        mode: quoteResult.summary.mode,
        tons: quoteResult.summary.tons,
        unitWeightKg: effectiveWeight,
        unitsPerCarton: effectiveUnitsPerCarton ?? null,
        image_path: selectedProduct.image_path,
      },
      settings: {
        quote_valid_days: data.settings.quote_valid_days,
        terms_template: data.settings.terms_template,
      },
          meta: {
            appVersion: APP_VERSION,
            exportedAtISO: new Date().toISOString(),
          },
    }

    try {
      // @ts-ignore
      const result = (await window.ipcRenderer.invoke(
        'export-external-quotation-xlsx',
        payload,
      )) as { success: boolean; canceled?: boolean; message?: string; filePath?: string }

      if (!result.success) {
        if (result.canceled) {
          setExportMessage('已取消导出。')
          return
        }
        setExportMessage(result.message ?? '导出失败。')
        return
      }

      setExportMessage(`已导出：${result.filePath ?? ''}`)
    } catch (error) {
      setExportMessage(`导出失败：${String(error)}`)
    }
  }

  if (loading) {
    return <div style={{ color: '#e5e7eb', padding: 24 }}>加载中...</div>
  }

  if (loadError) {
    return (
      <div style={{ color: '#e5e7eb', padding: 24 }}>
        <p>{loadError}</p>
        <button onClick={() => void loadData()}>重试</button>
      </div>
    )
  }

  const polPortName = selectedProduct
    ? portsById.get(selectedProduct.pol_port_id)?.name ?? selectedProduct.pol_port_id
    : '-'

  const pageStyle: CSSProperties = {
    padding: 24,
    backgroundColor: '#0b0f1a',
    color: '#e5e7eb',
    minHeight: '100vh',
  }
  const panelStyle: CSSProperties = {
    padding: 16,
    border: '1px solid #1f2937',
    borderRadius: 12,
    backgroundColor: '#111827',
  }
  const labelStyle: CSSProperties = { display: 'block', marginBottom: 6, color: '#cbd5f5' }
  const inputSmall: CSSProperties = {
    width: 140,
    padding: '8px 10px',
    backgroundColor: '#0f172a',
    color: '#fff',
    border: '1px solid #334155',
    borderRadius: 8,
  }

  return (
    <div style={pageStyle} className="quote-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>FOB报价系统</h1>
        <button
          className="btn-outline-neon"
          onClick={() => void loadData()}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #334155',
            backgroundColor: '#0f172a',
            color: '#e5e7eb',
          }}
        >
          刷新数据
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.4fr', gap: 20 }}>
        <div style={panelStyle} className="glass-card panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>输入区</h2>
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={labelStyle}>产品</label>
            <Select
              className="ui-select"
              value={selectedProductId || null}
              onChange={(value) => setSelectedProductId(value ?? '')}
              data={productSelectData}
              placeholder="请选择产品"
              radius="lg"
            />
          </div>

          {selectedProduct && (
            <Card
              className="subpanel"
              style={{
                marginTop: 12,
                padding: 12,
                border: '1px solid #1f2937',
                borderRadius: 10,
                backgroundColor: '#0b1220',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>POL</div>
                  <div style={{ fontSize: 16, color: '#f8fafc', fontWeight: 700 }}>{polPortName}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>退税率</div>
                  <div style={{ fontSize: 16, color: '#f8fafc', fontWeight: 700 }}>
                    {(selectedProduct.refund_rate * 100).toFixed(2)}%
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>采购 VAT</div>
                  <div style={{ fontSize: 16, color: '#f8fafc', fontWeight: 700 }}>
                    {(selectedProduct.purchase_vat_rate * 100).toFixed(2)}%
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>税点</div>
                  <div style={{ fontSize: 16, color: '#f8fafc', fontWeight: 700 }}>
                    {(selectedProduct.invoice_tax_point * 100).toFixed(2)}%
                  </div>
                </div>
              </div>
            </Card>
          )}

          <div style={{ marginTop: 14, display: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={labelStyle}>包装方案</label>
              <button
                className="btn-outline-neon"
                onClick={() => setShowCustomPackaging((prev) => !prev)}
                disabled={!selectedPackagingId}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid #334155',
                  backgroundColor: selectedPackagingId ? '#0f172a' : '#111827',
                  color: selectedPackagingId ? '#e5e7eb' : '#6b7280',
                }}
              >
                自定义包装...
              </button>
            </div>
            <Select
              className="ui-select"
              value={selectedPackagingId || null}
              onChange={(value) => setSelectedPackagingId(value ?? '')}
              data={packagingSelectData}
              placeholder="请选择包装方案"
              radius="lg"
            />
          </div>

          <div style={{ marginTop: 14, display: 'none' }}>
            <label style={labelStyle}>工厂</label>
            <Select
              className="ui-select"
              value={selectedFactoryId || null}
              onChange={(value) => setSelectedFactoryId(value ?? '')}
              data={factorySelectData}
              placeholder="请选择工厂"
              radius="lg"
            />
            {selectedFactoryId && (selectedFactoryCost === undefined || selectedFactoryCost === null || selectedFactoryCost <= 0) && (
              <div style={{ color: '#f87171', marginTop: 6 }}>请维护工厂吨成本。</div>
            )}
            {selectedFactoryId && selectedFactoryCost !== undefined && selectedFactoryCost !== null && selectedFactoryCost > 0 && (
              <div style={{ color: '#93c5fd', marginTop: 6 }}>吨成本：￥{selectedFactoryCost}</div>
            )}
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={labelStyle}>工厂</label>
            <Select
              className="ui-select"
              value={selectedFactoryId || null}
              onChange={(value) => setSelectedFactoryId(value ?? '')}
              data={factorySelectData}
              placeholder="请选择工厂"
              radius="lg"
            />
            {selectedFactoryId && (selectedFactoryCost === undefined || selectedFactoryCost === null || selectedFactoryCost <= 0) && (
              <div style={{ color: '#f87171', marginTop: 6 }}>请维护工厂吨成本。</div>
            )}
            {selectedFactoryId && selectedFactoryCost !== undefined && selectedFactoryCost !== null && selectedFactoryCost > 0 && (
              <div style={{ color: '#93c5fd', marginTop: 6 }}>吨成本：¥{selectedFactoryCost}</div>
            )}
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={labelStyle}>包装方案</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Select
                  className="ui-select"
                  value={selectedPackagingId || null}
                  onChange={(value) => setSelectedPackagingId(value ?? '')}
                  data={packagingSelectData}
                  placeholder="请选择包装方案"
                  radius="lg"
                />
              </div>
              <button
                className="btn-outline-neon"
                onClick={() => setShowCustomPackaging((prev) => !prev)}
                disabled={!selectedPackagingId}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid #334155',
                  backgroundColor: selectedPackagingId ? '#0f172a' : '#111827',
                  color: selectedPackagingId ? '#e5e7eb' : '#6b7280',
                  fontSize: 12,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                自定义
              </button>
            </div>
          </div>

          {selectedPackaging && showCustomPackaging && (
            <div
              className="glass-card subpanel"
              style={{
                marginTop: 10,
                padding: 10,
                border: '1px solid #1f2937',
                borderRadius: 10,
                backgroundColor: '#0b1220',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 13 }}>自定义包装（临时派生）</strong>
                <button
                  className="btn-outline-neon"
                  onClick={() => setShowCustomPackaging(false)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1px solid #334155',
                    backgroundColor: '#0f172a',
                    color: '#e5e7eb',
                    fontSize: 12,
                  }}
                >
                  收起
                </button>
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 10,
                }}
              >
                <div>
                  <label style={{ fontSize: 12, color: '#9ca3af' }}>{labelFor('unit_weight_kg')}</label>
                  <input
                    type="number"
                    value={customUnitWeightKg}
                    onChange={(e) => {
                      setCustomUnitWeightKg(e.target.value)
                      setUnitsPerCartonTouched(false)
                    }}
                    style={inputSmall}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#9ca3af' }}>{labelFor('units_per_carton')}</label>
                  <input
                    type="number"
                    value={customUnitsPerCarton}
                    onChange={(e) => {
                      setCustomUnitsPerCarton(e.target.value)
                      setUnitsPerCartonTouched(true)
                    }}
                    placeholder="0 ???=???"
                    style={inputSmall}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#9ca3af' }}>{labelFor('bag_price_rmb')}</label>
                  <input
                    type="number"
                    value={customBagPrice}
                    onChange={(e) => setCustomBagPrice(e.target.value)}
                    style={inputSmall}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#9ca3af' }}>{labelFor('carton_price_rmb')}</label>
                  <input
                    type="number"
                    value={customCartonPrice}
                    onChange={(e) => setCustomCartonPrice(e.target.value)}
                    style={inputSmall}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#9ca3af' }}>{labelFor('inner_pack_type')}</label>
                  <Select
                    className="ui-select"
                    value={customInnerPackType}
                    onChange={(value) => setCustomInnerPackType((value as InnerPackType | null) ?? 'carton')}
                    data={Object.entries(INNER_PACK_LABELS).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    radius="lg"
                    w={180}
                  />
                </div>
              </div>

              {recommendedUnitsPerCarton !== null && (
                <div style={{ marginTop: 8, color: '#93c5fd' }}>
                  推荐箱规：{recommendedUnitsPerCarton} 袋/箱
                </div>
              )}

              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn-primary"
                  onClick={handleSaveDerivedPackaging}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: '#22c55e',
                    color: '#0f172a',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  保存为新包装方案
                </button>
                <button
                  className="btn-outline-neon"
                  onClick={() => setShowCustomPackaging(false)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    backgroundColor: '#0f172a',
                    color: '#e5e7eb',
                  }}
                >
                  取消
                </button>
                <span style={{ color: '#9ca3af' }}>仅本次报价生效，不会自动写回。</span>
              </div>
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>数量</div>

          {mode === 'FCL' && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div>
                  <label style={labelStyle}>袋数</label>
                  <NumberInput
                    className="ui-input"
                    value={toMantineNumber(fclBagsHint)}
                    onChange={(value) => handleFclBagsChange(String(value ?? ''))}
                    hideControls
                    radius="lg"
                    w={140}
                  />
                </div>
                <div>
                  <label style={labelStyle}>吨数（可选，仅用于自动切换判定）</label>
                  <NumberInput
                    className="ui-input"
                    value={toMantineNumber(fclTonsHint)}
                    onChange={(value) => handleFclTonsChange(String(value ?? ''))}
                    hideControls
                    radius="lg"
                    w={140}
                  />
                </div>
              </div>
            </div>
          )}

          {mode === 'LCL' && (
            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>LCL 数量输入</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="radio"
                    checked={lclInputType === 'tons'}
                    onChange={() => setLclInputType('tons')}
                  />
                  吨数
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="radio"
                    checked={lclInputType === 'bags'}
                    onChange={() => setLclInputType('bags')}
                  />
                  袋数
                </label>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <NumberInput
                  className="ui-input"
                  value={toMantineNumber(lclInputValue)}
                  onChange={(value) => setLclInputValue(String(value ?? ''))}
                  hideControls
                  radius="lg"
                  w={140}
                />
                <div style={{ color: '#9ca3af' }}>
                  {lclInputType === 'tons'
                    ? `约 ${lclBagsValue !== null ? lclBagsValue.toFixed(2) : '-'} 袋`
                    : `约 ${lclTonsValue !== null ? lclTonsValue.toFixed(4) : '-'} 吨`}
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>运输模式</label>
                <Select
                  className="ui-select"
                  value={mode}
                  onChange={(value) => setMode((value as Mode | null) ?? 'FCL')}
                  data={[
                    { value: 'FCL', label: 'FCL' },
                    { value: 'LCL', label: 'LCL' },
                  ]}
                  radius="lg"
                  w={140}
                />
              </div>
              <div>
                <label style={labelStyle}>柜型</label>
                <Select
                  className="ui-select"
                  value={containerType}
                  onChange={(value) => setContainerType((value as ContainerType | null) ?? '20GP')}
                  data={[
                    { value: '20GP', label: '20GP' },
                    { value: '40HQ', label: '40HQ' },
                  ]}
                  radius="lg"
                  w={160}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', fontWeight: 600, display: 'none' }}>数量</div>

          {mode === 'FCL' && (
            <div style={{ marginTop: 14, display: 'none' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div>
                  <label style={labelStyle}>袋数</label>
                  <NumberInput
                    className="ui-input"
                    value={toMantineNumber(fclBagsHint)}
                    onChange={(value) => handleFclBagsChange(String(value ?? ''))}
                    hideControls
                    radius="lg"
                    w={140}
                  />
                </div>
                <div>
                  <label style={labelStyle}>吨数（可选，仅用于自动切换判定）</label>
                  <NumberInput
                    className="ui-input"
                    value={toMantineNumber(fclTonsHint)}
                    onChange={(value) => handleFclTonsChange(String(value ?? ''))}
                    hideControls
                    radius="lg"
                    w={140}
                  />
                </div>
              </div>
            </div>
          )}

          {mode === 'LCL' && (
            <div style={{ marginTop: 14, display: 'none' }}>
              <label style={labelStyle}>LCL 数量输入</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="radio"
                    checked={lclInputType === 'tons'}
                    onChange={() => setLclInputType('tons')}
                  />
                  吨数
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="radio"
                    checked={lclInputType === 'bags'}
                    onChange={() => setLclInputType('bags')}
                  />
                  袋数
                </label>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <NumberInput
                  className="ui-input"
                  value={toMantineNumber(lclInputValue)}
                  onChange={(value) => setLclInputValue(String(value ?? ''))}
                  hideControls
                  radius="lg"
                  w={140}
                />
                <div style={{ color: '#9ca3af' }}>
                  {lclInputType === 'tons'
                    ? `约 ${lclBagsValue !== null ? lclBagsValue.toFixed(2) : '-'} 袋`
                    : `约 ${lclTonsValue !== null ? lclTonsValue.toFixed(4) : '-'} 吨`}
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>汇率</label>
                <NumberInput
                  className="ui-input"
                  value={toMantineNumber(fxRate)}
                  onChange={(value) => setFxRate(String(value ?? ''))}
                  decimalScale={4}
                  hideControls
                  radius="lg"
                  w={140}
                />
              </div>
              <div>
                <label style={labelStyle}>毛利率</label>
                <NumberInput
                  className="ui-input"
                  value={toMantineNumber(marginPct)}
                  onChange={(value) => setMarginPct(String(value ?? ''))}
                  decimalScale={4}
                  hideControls
                  radius="lg"
                  w={140}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>每吨国内运费到港（RMB/吨）</label>
            <NumberInput
              className="ui-input"
              value={toMantineNumber(landFreightOverridePerTon)}
              onChange={(value) => setLandFreightOverridePerTon(String(value ?? ''))}
              placeholder={defaultLandFreightPerTon !== null ? `默认 ${defaultLandFreightPerTon}` : ''}
              hideControls
              radius="lg"
              w={140}
            />
            <div style={{ marginTop: 6, color: defaultLandFreightPerTon === null ? '#fbbf24' : '#9ca3af' }}>
              {defaultLandFreightPerTon === null
                ? '未配置默认值，请在 Admin 维护国内段费用。'
                : `默认值：￥${defaultLandFreightPerTon}/吨`}
            </div>
          </div>

          {false && selectedPackaging && showCustomPackaging && (
            <div
              className="glass-card"
              style={{
                marginTop: 14,
                marginBottom: 10,
                maxWidth: 560,
                padding: 10,
                border: '1px solid #1f2937',
                borderRadius: 10,
                backgroundColor: '#0b1220',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>自定义包装（临时派生）</strong>
                <button
                  className="btn-outline-neon"
                  onClick={() => setShowCustomPackaging(false)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1px solid #334155',
                    backgroundColor: '#0f172a',
                    color: '#e5e7eb',
                  }}
                >
                  收起
                </button>
              </div>

              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#9ca3af' }}>{labelFor('unit_weight_kg')}</label>
                  <input
                    type="number"
                    value={customUnitWeightKg}
                    onChange={(e) => {
                      setCustomUnitWeightKg(e.target.value)
                      setUnitsPerCartonTouched(false)
                    }}
                    style={inputSmall}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#9ca3af' }}>{labelFor('units_per_carton')}</label>
                  <input
                    type="number"
                    value={customUnitsPerCarton}
                    onChange={(e) => {
                      setCustomUnitsPerCarton(e.target.value)
                      setUnitsPerCartonTouched(true)
                    }}
                    placeholder="0 或留空=不装箱"
                    style={inputSmall}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#9ca3af' }}>{labelFor('bag_price_rmb')}</label>
                  <input
                    type="number"
                    value={customBagPrice}
                    onChange={(e) => setCustomBagPrice(e.target.value)}
                    style={inputSmall}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#9ca3af' }}>{labelFor('carton_price_rmb')}</label>
                  <input
                    type="number"
                    value={customCartonPrice}
                    onChange={(e) => setCustomCartonPrice(e.target.value)}
                    style={inputSmall}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#9ca3af' }}>{labelFor('inner_pack_type')}</label>
                  <Select
                    className="ui-select"
                    value={customInnerPackType}
                    onChange={(value) => setCustomInnerPackType((value as InnerPackType | null) ?? 'carton')}
                    data={Object.entries(INNER_PACK_LABELS).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    radius="lg"
                    w={180}
                  />
                </div>
              </div>

              {recommendedUnitsPerCarton !== null && (
                <div style={{ marginTop: 8, color: '#93c5fd' }}>
                  推荐箱规：{recommendedUnitsPerCarton} 袋/箱
                </div>
              )}

              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn-primary"
                  onClick={handleSaveDerivedPackaging}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: '#22c55e',
                    color: '#0f172a',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  保存为新包装方案
                </button>
                <span style={{ color: '#9ca3af' }}>仅本次报价生效，不会自动写回。</span>
              </div>
            </div>
          )}

          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Button
              className="btn-primary"
              onClick={handleCalculate}
              disabled={Boolean(disableReason)}
              variant="gradient"
              gradient={{ from: 'blue', to: 'violet', deg: 120 }}
              radius="lg"
            >
              计算报价
            </Button>
            <Button
              className="btn-primary"
              onClick={() => void handleExportExternalQuotation()}
              disabled={!quoteResult}
              variant="outline"
              radius="lg"
            >
              导出外部报价单（Excel）
            </Button>
            {disableReason && <div style={{ color: '#f87171' }}>{disableReason}</div>}
            {exportMessage && <div style={{ color: '#93c5fd' }}>{exportMessage}</div>}
          </div>

          {validationError && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 8,
                border: '1px solid #7f1d1d',
                backgroundColor: '#2a1111',
                color: '#fecaca',
              }}
            >
              {validationError}
            </div>
          )}
        </div>
        <div style={panelStyle} className="glass-card panel">
          <h2 style={{ margin: 0, fontSize: 18 }}>结果区</h2>

          {!quoteResult && (
            <div style={{ color: '#9ca3af', marginTop: 12 }}>填写参数后点击“计算报价”。</div>
          )}

          {quoteResult && (
            <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
              <div className="kpi-row">
                <div className="kpi-card">
                  <div className="kpi-title">销售单价</div>
                  <div className="kpi-value">{formatUsd(quoteResult.summary.sell_usd_per_bag)}</div>
                  <div className="kpi-unit">USD/袋</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-title">净成本</div>
                  <div className="kpi-value">{formatRmb(quoteResult.summary.net_rmb_per_bag)}</div>
                  <div className="kpi-unit">RMB/袋</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-title">毛利/袋</div>
                  <div className="kpi-value">{formatRmb(quoteResult.summary.gp_rmb_per_bag)}</div>
                  <div className="kpi-unit">RMB/袋</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-title">毛利合计</div>
                  <div className="kpi-value">{formatRmb(quoteResult.summary.gp_rmb_total, rmbDecimals)}</div>
                  <div className="kpi-unit">RMB</div>
                </div>
              </div>

              <div
                className="glass-card-strong subpanel"
                style={{
                  padding: 12,
                  border: '1px solid #1f2937',
                  borderRadius: 10,
                  backgroundColor: '#0f172a',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>汇总</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>销售单价（USD/袋）：{formatUsd(quoteResult.summary.sell_usd_per_bag)}</div>
                  <div>净成本（RMB/袋）：{formatRmb(quoteResult.summary.net_rmb_per_bag)}</div>
                  <div>成本折算（USD/袋）：{formatUsd(quoteResult.summary.cost_usd_per_bag)}</div>
                  <div>毛利（RMB/袋）：{formatRmb(quoteResult.summary.gp_rmb_per_bag)}</div>
                  <div>毛利合计（RMB）：{formatRmb(quoteResult.summary.gp_rmb_total, rmbDecimals)}</div>
                  <div>实际袋数（整数）：{quoteResult.summary.bags_int}</div>
                  <div>
                    实际箱数（整数）：
                    {quoteResult.summary.cartons_int > 0 ? quoteResult.summary.cartons_int : '不装箱'}
                  </div>
                  <div>袋材成本来源：{sourceLabel(quoteResult.summary.bag_price_source)}</div>
                  <div>纸箱成本来源：{sourceLabel(quoteResult.summary.carton_price_source)}</div>
                </div>
              </div>

              <div
                className="glass-card subpanel"
                style={{
                  padding: 12,
                  border: '1px solid #1f2937',
                  borderRadius: 10,
                  backgroundColor: '#0b1220',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>费用明细</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#9ca3af' }}>
                      <th style={{ padding: '6px 4px' }}>项目</th>
                      <th style={{ padding: '6px 4px' }}>金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '6px 4px' }}>原料（RMB/袋）</td>
                      <td style={{ padding: '6px 4px' }}>
                        {formatRmb(quoteResult.breakdown.raw_rmb_per_bag)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 4px' }}>袋材（RMB/袋）</td>
                      <td style={{ padding: '6px 4px' }}>
                        {formatRmb(quoteResult.breakdown.bag_mat_rmb_per_bag)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 4px' }}>箱材（RMB/袋）</td>
                      <td style={{ padding: '6px 4px' }}>
                        {formatRmb(quoteResult.breakdown.carton_rmb_per_bag)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 4px' }}>国内段（RMB/袋）</td>
                      <td style={{ padding: '6px 4px' }}>
                        {formatRmb(quoteResult.breakdown.land_rmb_per_bag)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 4px' }}>本次每吨国内运费（RMB/吨）</td>
                      <td style={{ padding: '6px 4px' }}>
                        {formatRmb(quoteResult.breakdown.land_rmb_per_ton_used)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 4px' }}>国内段总费用（RMB）</td>
                      <td style={{ padding: '6px 4px' }}>
                        {formatRmb(quoteResult.breakdown.land_total_rmb)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 4px' }}>港杂（RMB/袋）</td>
                      <td style={{ padding: '6px 4px' }}>
                        {formatRmb(quoteResult.breakdown.port_rmb_per_bag)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 4px' }}>国内总成本（RMB/袋）</td>
                      <td style={{ padding: '6px 4px' }}>
                        {formatRmb(quoteResult.breakdown.domestic_total_rmb_per_bag)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 4px' }}>退税金额（RMB/袋）</td>
                      <td style={{ padding: '6px 4px' }}>
                        -{formatRmb(quoteResult.breakdown.rebate_rmb_per_bag)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 4px' }}>净成本（RMB/袋）</td>
                      <td style={{ padding: '6px 4px' }}>
                        {formatRmb(quoteResult.breakdown.net_rmb_per_bag)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {quoteResult.warnings.length > 0 && (
                <div
                  className="glass-card subpanel"
                  style={{
                    padding: 12,
                    border: '1px solid #b45309',
                    borderRadius: 10,
                    backgroundColor: '#2a1f0a',
                    color: '#fde68a',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>提示</div>
                  {quoteResult.warnings.map((warning, index) => (
                    <div key={index} style={{ marginBottom: 4 }}>
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, color: '#9ca3af', fontSize: 12 }}>
                版本：v{APP_VERSION}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
function App() {
  const [activeTab, setActiveTab] = useState<'quoter' | 'admin'>('quoter')
  const [uiTheme, setUiTheme] = useState<'classic' | 'neon' | 'minimal'>('classic')

  useEffect(() => {
    const toTheme = (value: unknown): 'classic' | 'neon' | 'minimal' => {
      if (value === 'neon' || value === 'minimal' || value === 'classic') return value
      if (value === 'creative') return 'neon'
      return 'classic'
    }

    const loadTheme = async () => {
      try {
        // @ts-ignore
        const appData = (await window.ipcRenderer.invoke('get-app-data')) as AppData
        setUiTheme(toTheme(appData?.settings?.ui_theme))
      } catch {
        setUiTheme('classic')
      }
    }

    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ uiTheme?: unknown }>
      setUiTheme(toTheme(customEvent.detail?.uiTheme))
    }

    void loadTheme()
    window.addEventListener('ui-theme-change', handleThemeChange as EventListener)
    return () => window.removeEventListener('ui-theme-change', handleThemeChange as EventListener)
  }, [])

  const uiThemeClass = uiTheme === 'neon' ? 'theme-creative' : uiTheme === 'minimal' ? 'theme-minimal' : 'theme-classic'

  return (
    <div className={`app-root ${uiThemeClass}`} style={{ minHeight: '100vh', backgroundColor: '#0b0f1a', color: '#e5e7eb' }}>
      <div style={{ maxWidth: 1600, margin: '0 auto', padding: 20 }}>
        <div className="nav-glass" style={{ display: 'flex', marginBottom: 16, gap: 10, padding: 8, borderRadius: 16 }}>
          <button
            className={`tab-btn ${activeTab === 'quoter' ? 'active' : ''}`}
            onClick={() => setActiveTab('quoter')}
            style={{
              flex: 1,
              padding: 12,
              backgroundColor: activeTab === 'quoter' ? '#1f2937' : '#0f172a',
              color: '#fff',
              border: '1px solid #1f2937',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            报价
          </button>
          <button
            className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
            style={{
              flex: 1,
              padding: 12,
              backgroundColor: activeTab === 'admin' ? '#1f2937' : '#0f172a',
              color: '#fff',
              border: '1px solid #1f2937',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            管理
          </button>
        </div>

        <div style={{ display: activeTab === 'quoter' ? 'block' : 'none' }}>
          <Quoter />
        </div>
        <div style={{ display: activeTab === 'admin' ? 'block' : 'none' }}>
          <Admin />
        </div>
      </div>
    </div>
  )
}

export default App
