import { useEffect, useMemo, useState } from 'react'
import { Button, Card, NumberInput, Select } from '@mantine/core'
import Admin from '@/components/Admin'
import { calculateQuote, formatCurrency, type CalculateQuoteResult } from '@/utils/calculateQuote'
import { INNER_PACK_LABELS } from '@/utils/fieldLabels'
import { nextIdFromRows } from '@/utils/id'
import { t } from '@/i18n'
import { useUiTheme } from '@/ui/ThemeProvider'
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

const APP_VERSION = '2.5.9'

function parseNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

function toInputString(value: string | number | '' | null | undefined): string {
  if (value === '' || value === null || value === undefined) return ''
  if (!Number.isFinite(value)) return ''
  return String(value)
}

function toMantineNumber(value: string): number | '' {
  if (value.trim() === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? n : ''
}

function sourceLabel(source: 'default' | 'override' | 'custom'): string {
  if (source === 'override') return t('quote.result.sourceOverride')
  if (source === 'custom') return t('quote.result.sourceCustom')
  return t('quote.result.sourceDefault')
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
      setLoadError(t('common.loadFailedRetry'))
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
  const selectedProduct: Product | null = useMemo(
    () => products.find((item) => item.id === selectedProductId) ?? null,
    [products, selectedProductId],
  )

  const packagingOptions: PackagingOption[] = useMemo(() => {
    if (!data || !selectedProductId) return []
    return data.packaging_options.filter((item) => item.product_id === selectedProductId)
  }, [data, selectedProductId])

  const selectedPackaging: PackagingOption | null = useMemo(
    () => packagingOptions.find((item) => item.id === selectedPackagingId) ?? null,
    [packagingOptions, selectedPackagingId],
  )

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
      const exists = packagingOptions.some((item) => item.id === selectedProduct.default_packaging_option_id)
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
    if (defaultPackagingId) setSelectedPackagingId(defaultPackagingId)
    if (factories.length > 0) {
      const withCost = factories.find((factory) => costByFactoryId.has(factory.id))
      setSelectedFactoryId(withCost?.id ?? factories[0].id)
    }
    setQuoteResult(null)
    setShowCustomPackaging(false)
    setValidationError('')
    setExportMessage('')
    setFclTonsHint('')
    setFclBagsHint('')
    setLclInputValue('')
    setLandFreightOverridePerTon('')
  }, [selectedProductId, defaultPackagingId, factories, costByFactoryId])

  useEffect(() => {
    if (!selectedPackaging) return
    setCustomUnitWeightKg(String(selectedPackaging.unit_weight_kg))
    setCustomUnitsPerCarton(selectedPackaging.units_per_carton === null ? '' : String(selectedPackaging.units_per_carton))
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
    if (!effectiveUnitWeight || !Number.isFinite(effectiveUnitWeight) || effectiveUnitWeight <= 0 || tons === null) {
      setFclBagsHint('')
      return
    }
    setFclBagsHint(String((tons * 1000) / effectiveUnitWeight))
  }

  const handleFclBagsChange = (value: string) => {
    setFclLastEdited('bags')
    setFclBagsHint(value)
    const bags = parseNumber(value)
    if (!effectiveUnitWeight || !Number.isFinite(effectiveUnitWeight) || effectiveUnitWeight <= 0 || bags === null) {
      setFclTonsHint('')
      return
    }
    setFclTonsHint(String((bags * effectiveUnitWeight) / 1000))
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
    return lclInputType === 'tons' ? input : input / bagsPerTon
  }, [bagsPerTon, lclInputType, lclInputValue])

  const lclBagsValue = useMemo(() => {
    if (!bagsPerTon) return null
    const input = parseNumber(lclInputValue)
    if (input === null) return null
    return lclInputType === 'bags' ? input : input * bagsPerTon
  }, [bagsPerTon, lclInputType, lclInputValue])

  const handleLclInputTypeChange = (nextType: QtyInputType) => {
    if (nextType === lclInputType) return
    if (nextType === 'tons') {
      if (lclTonsValue !== null) {
        setLclInputValue(String(lclTonsValue))
      }
      setLclInputType('tons')
      return
    }
    if (lclBagsValue !== null) {
      setLclInputValue(String(lclBagsValue))
    }
    setLclInputType('bags')
  }

  const packagingRecommendations = data?.packaging_recommendations ?? []
  const matchedRecommendation = useMemo(() => {
    if (!selectedProductId) return null
    const weight = parseNumber(customUnitWeightKg)
    if (!weight) return null
    const packType = showCustomPackaging ? customInnerPackType : selectedPackaging?.inner_pack_type ?? null
    const epsilon = 0.0001
    return (
      packagingRecommendations.find((item) => {
        if (item.product_id !== selectedProductId) return false
        if (item.inner_pack_type && packType && item.inner_pack_type !== packType) return false
        return Math.abs(item.unit_weight_kg - weight) < epsilon
      }) ?? null
    )
  }, [selectedProductId, customUnitWeightKg, customInnerPackType, showCustomPackaging, selectedPackaging, packagingRecommendations])

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
      return
    }
    setRecommendedUnitsPerCarton(null)
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
  const rmbDecimals = Number(data?.settings.money_format?.rmb_decimals ?? 4)
  const usdDecimals = Number(data?.settings.money_format?.usd_decimals ?? 4)
  const formatRmb = (value: number, decimals = rmbDecimals) => formatCurrency(value, 'CNY', decimals)
  const formatUsd = (value: number, decimals = usdDecimals) => formatCurrency(value, 'USD', decimals)

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
    if (!data) return t('quote.dataNotReady')
    if (!selectedProduct) return t('quote.productRequired')
    if (!selectedPackaging) return t('quote.packagingRequired')
    if (!selectedFactoryId) return t('quote.factoryRequired')
    if (selectedFactoryCost === undefined || selectedFactoryCost === null || selectedFactoryCost <= 0) {
      return t('quote.factoryCostRequired')
    }
    const fx = parseNumber(fxRate)
    if (!fx || fx <= 0) return t('quote.fxMustPositive')
    const margin = parseNumber(marginPct)
    if (margin === null || margin < 0 || margin >= 1) return t('quote.marginRange')
    if (mode === 'LCL') {
      const input = parseNumber(lclInputValue)
      if (!input || input <= 0) return t('quote.lclQtyRequired')
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
    mode,
    lclInputValue,
  ])

  const handleSaveDerivedPackaging = async () => {
    if (!data || !selectedProduct || !selectedPackaging) return
    const weight = parseNumber(customUnitWeightKg)
    if (!weight || weight <= 0) {
      setValidationError(t('quote.customWeightRequired'))
      return
    }

    const unitsRaw = customUnitsPerCarton.trim()
    const unitsValue = unitsRaw === '' ? null : Number(unitsRaw)
    if (unitsValue !== null) {
      if (!Number.isFinite(unitsValue) || unitsValue < 0 || !Number.isInteger(unitsValue)) {
        setValidationError(t('quote.customUnitsInvalid'))
        return
      }
    }

    const bagPrice =
      customBagPrice.trim() === '' ? selectedPackaging.bag_price_rmb : Number(customBagPrice)
    const cartonPrice =
      customCartonPrice.trim() === '' ? selectedPackaging.carton_price_rmb : Number(customCartonPrice)
    if (
      !Number.isFinite(bagPrice) ||
      bagPrice < 0 ||
      !Number.isFinite(cartonPrice) ||
      cartonPrice < 0
    ) {
      setValidationError(t('quote.customPackCostInvalid'))
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
        setValidationError(result.message ?? t('common.saveFailed'))
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
        override_unit_weight_kg: showCustomPackaging ? parseNumber(customUnitWeightKg) ?? undefined : undefined,
        override_units_per_carton:
          showCustomPackaging && customUnitsPerCarton.trim() !== ''
            ? Number(customUnitsPerCarton)
            : undefined,
        override_bag_price_rmb:
          showCustomPackaging && customBagPrice.trim() !== '' ? Number(customBagPrice) : undefined,
        override_carton_price_rmb:
          showCustomPackaging && customCartonPrice.trim() !== ''
            ? Number(customCartonPrice)
            : undefined,
        override_inner_pack_type: showCustomPackaging ? customInnerPackType : undefined,
        land_fee_override_rmb_per_ton:
          landFreightOverridePerTon.trim() === '' ? undefined : Number(landFreightOverridePerTon),
      })

      setQuoteResult(result)
      setValidationError('')
      setExportMessage('')
    } catch (error) {
      setValidationError(`计算失败：${String(error)}`)
    }
  }

  const polPortName = selectedProduct
    ? portsById.get(selectedProduct.pol_port_id)?.name ?? selectedProduct.pol_port_id
    : '-'

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
    const effectivePackType = showCustomPackaging
      ? customInnerPackType
      : selectedPackaging.inner_pack_type
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
      )) as {
        success: boolean
        canceled?: boolean
        message?: string
        filePath?: string
      }

      if (!result.success) {
        if (result.canceled) {
          setExportMessage(t('common.exportCanceled'))
          return
        }
        setExportMessage(result.message ?? t('common.exportFailed'))
        return
      }
      setExportMessage(`已导出：${result.filePath ?? ''}`)
    } catch (error) {
      setExportMessage(`导出失败：${String(error)}`)
    }
  }

  if (loading) return <div style={{ color: '#e5e7eb', padding: 24 }}>{t('common.loading')}</div>
  if (loadError) {
    return (
      <div style={{ color: '#e5e7eb', padding: 24 }}>
        <p>{loadError}</p>
        <Button onClick={() => void loadData()}>{t('common.retry')}</Button>
      </div>
    )
  }

  const kpiCards = [
    {
      title: t('quote.result.kpiSell'),
      value: quoteResult ? formatUsd(quoteResult.summary.sell_usd_per_bag) : formatUsd(0),
      unit: t('quote.unit.usdPerBag'),
    },
    {
      title: t('quote.result.kpiCostUsd'),
      value: quoteResult ? formatUsd(quoteResult.summary.cost_usd_per_bag) : formatUsd(0),
      unit: t('quote.unit.usdPerBag'),
    },
    {
      title: t('quote.result.kpiGpPerBag'),
      value: quoteResult ? formatRmb(quoteResult.summary.gp_rmb_per_bag) : formatRmb(0),
      unit: t('quote.unit.rmbPerBag'),
    },
    {
      title: t('quote.result.kpiGpTotal'),
      value: quoteResult ? formatRmb(quoteResult.summary.gp_rmb_total, 2) : formatRmb(0, 2),
      unit: 'RMB',
    },
  ]

  return (
    <div className="quote-page" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>{t('app.title')}</h1>
        <Button className="btn-outline-neon" variant="outline" size="sm" onClick={() => void loadData()}>
          {t('app.refresh')}
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.45fr', gap: 20 }}>
        <div className="panel glass-card">
          <div style={{ marginBottom: 8, fontSize: 13, color: '#9ca3af' }}>{t('quote.sectionProduct')}</div>
          <Select className="ui-select" value={selectedProductId || null} onChange={(value) => setSelectedProductId(value ?? '')} data={productSelectData} placeholder={t('quote.selectProduct')} searchable={false} />

          {selectedProduct && (
            <Card className="subpanel" style={{ marginTop: 12, padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: '#94a3b8' }}>POL</div><div style={{ fontSize: 16, fontWeight: 700 }}>{polPortName}</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: '#94a3b8' }}>{t('quote.productInfo.rebate')}</div><div style={{ fontSize: 16, fontWeight: 700 }}>{(selectedProduct.refund_rate * 100).toFixed(2)}%</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: '#94a3b8' }}>{t('quote.productInfo.purchaseVat')}</div><div style={{ fontSize: 16, fontWeight: 700 }}>{(selectedProduct.purchase_vat_rate * 100).toFixed(2)}%</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: '#94a3b8' }}>{t('quote.productInfo.invoiceTax')}</div><div style={{ fontSize: 16, fontWeight: 700 }}>{(selectedProduct.invoice_tax_point * 100).toFixed(2)}%</div></div>
              </div>
            </Card>
          )}

          <div style={{ marginTop: 12, marginBottom: 8, fontSize: 13, color: '#9ca3af' }}>{t('quote.sectionFactory')}</div>
          <Select className="ui-select" value={selectedFactoryId || null} onChange={(value) => setSelectedFactoryId(value ?? '')} data={factorySelectData} placeholder={t('quote.selectFactory')} searchable={false} />
          {selectedFactoryId && (selectedFactoryCost === undefined || selectedFactoryCost === null || selectedFactoryCost <= 0) && (
            <div style={{ color: '#f87171', marginTop: 6 }}>{t('quote.maintainFactoryCost')}</div>
          )}
          {selectedFactoryId && selectedFactoryCost !== undefined && selectedFactoryCost !== null && selectedFactoryCost > 0 && (
            <div style={{ color: '#93c5fd', marginTop: 6 }}>{t('quote.costPerTon')}{formatRmb(selectedFactoryCost, 2)}</div>
          )}

          <div style={{ marginTop: 12, marginBottom: 8, fontSize: 13, color: '#9ca3af' }}>{t('quote.sectionPackingQty')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Select className="ui-select" value={selectedPackagingId || null} onChange={(value) => setSelectedPackagingId(value ?? '')} data={packagingSelectData} placeholder={t('quote.selectPackaging')} searchable={false} />
            </div>
            <Button className="btn-outline-neon" variant="outline" size="xs" onClick={() => setShowCustomPackaging((prev) => !prev)} disabled={!selectedPackagingId}>{t('quote.customPack')}</Button>
          </div>

          {selectedPackaging && showCustomPackaging && (
            <div className="subpanel glass-card" style={{ marginTop: 10, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 13 }}>{t('quote.customPackTitle')}</strong>
                <Button className="btn-outline-neon" variant="outline" size="xs" onClick={() => setShowCustomPackaging(false)}>{t('quote.collapse')}</Button>
              </div>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <div><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{t('quote.customFields.unitWeightKg')}</div><NumberInput className="ui-input" value={toMantineNumber(customUnitWeightKg)} onChange={(value) => { setCustomUnitWeightKg(toInputString(value)); setUnitsPerCartonTouched(false) }} hideControls /></div>
                <div><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{t('quote.customFields.unitsPerCarton')}</div><NumberInput className="ui-input" value={toMantineNumber(customUnitsPerCarton)} onChange={(value) => { setCustomUnitsPerCarton(toInputString(value)); setUnitsPerCartonTouched(true) }} hideControls placeholder={t('quote.customFields.unitsPerCartonHint')} /></div>
                <div><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{t('quote.customFields.bagPriceRmb')}</div><NumberInput className="ui-input" value={toMantineNumber(customBagPrice)} onChange={(value) => setCustomBagPrice(toInputString(value))} hideControls /></div>
                <div><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{t('quote.customFields.cartonPriceRmb')}</div><NumberInput className="ui-input" value={toMantineNumber(customCartonPrice)} onChange={(value) => setCustomCartonPrice(toInputString(value))} hideControls /></div>
                <div><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{t('quote.customFields.innerPackType')}</div><Select className="ui-select" value={customInnerPackType} onChange={(value) => setCustomInnerPackType((value as InnerPackType | null) ?? 'carton')} data={Object.entries(INNER_PACK_LABELS).map(([value, label]) => ({ value, label }))} searchable={false} /></div>
              </div>
              {recommendedUnitsPerCarton !== null && (
                <div style={{ marginTop: 8, color: '#93c5fd' }}>{t('quote.recommendation')}{recommendedUnitsPerCarton} {t('quote.unit.bagsPerCarton')}</div>
              )}
              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button className="btn-primary" onClick={handleSaveDerivedPackaging}>{t('quote.saveAsPack')}</Button>
                <Button className="btn-outline-neon" variant="outline" onClick={() => setShowCustomPackaging(false)}>{t('quote.cancel')}</Button>
                <span style={{ color: '#9ca3af' }}>{t('quote.saveAsPackHint')}</span>
              </div>
            </div>
          )}

          {mode === 'FCL' && (
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{t('quote.fclHint')}</div><NumberInput className="ui-input" value={toMantineNumber(fclTonsHint)} onChange={(value) => handleFclTonsChange(toInputString(value))} hideControls /></div>
              <div><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{t('quote.bags')}</div><NumberInput className="ui-input" value={toMantineNumber(fclBagsHint)} onChange={(value) => handleFclBagsChange(toInputString(value))} hideControls /></div>
            </div>
          )}

          {mode === 'LCL' && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="radio" checked={lclInputType === 'tons'} onChange={() => handleLclInputTypeChange('tons')} />{t('quote.inputTons')}</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="radio" checked={lclInputType === 'bags'} onChange={() => handleLclInputTypeChange('bags')} />{t('quote.inputBags')}</label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{lclInputType === 'tons' ? t('quote.tons') : t('quote.bags')}</div><NumberInput className="ui-input" value={toMantineNumber(lclInputValue)} onChange={(value) => setLclInputValue(toInputString(value))} hideControls /></div>
                <div><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{lclInputType === 'tons' ? t('quote.convertedBags') : t('quote.convertedTons')}</div><NumberInput className="ui-input" value={toMantineNumber(lclInputType === 'tons' ? toInputString(lclBagsValue) : toInputString(lclTonsValue))} readOnly hideControls /></div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 12, marginBottom: 8, fontSize: 13, color: '#9ca3af' }}>{t('quote.sectionTransport')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{t('quote.mode')}</div><Select className="ui-select" value={mode} onChange={(value) => setMode((value as Mode | null) ?? 'FCL')} data={[{ value: 'FCL', label: 'FCL' }, { value: 'LCL', label: 'LCL' }]} searchable={false} /></div>
            <div><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{t('quote.container')}</div><Select className="ui-select" value={containerType} onChange={(value) => setContainerType((value as ContainerType | null) ?? '20GP')} data={[{ value: '20GP', label: '20GP' }, { value: '40HQ', label: '40HQ' }]} searchable={false} /></div>
            <div><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{t('quote.fxRate')}</div><NumberInput className="ui-input" value={toMantineNumber(fxRate)} onChange={(value) => setFxRate(toInputString(value))} hideControls /></div>
            <div><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{t('quote.margin')}</div><NumberInput className="ui-input" value={toMantineNumber(marginPct)} onChange={(value) => setMarginPct(toInputString(value))} hideControls /></div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{t('quote.landFreight')}</div>
            <NumberInput className="ui-input" value={toMantineNumber(landFreightOverridePerTon)} onChange={(value) => setLandFreightOverridePerTon(toInputString(value))} hideControls placeholder={defaultLandFreightPerTon !== null ? `${t('quote.defaultValue')} ${defaultLandFreightPerTon}` : t('quote.unconfiguredDefaultZero')} />
          </div>

          <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Button className="btn-primary" onClick={handleCalculate} disabled={Boolean(disableReason)}>{t('quote.calc')}</Button>
            <Button className="btn-primary" onClick={handleExportExternalQuotation} disabled={!quoteResult}>{t('quote.exportExcel')}</Button>
            {disableReason && <span style={{ color: '#fca5a5', alignSelf: 'center' }}>{t('quote.disabledReason')}：{disableReason}</span>}
          </div>
          {validationError && <div style={{ marginTop: 10, color: '#f87171' }}>{validationError}</div>}
          {exportMessage && <div style={{ marginTop: 10, color: '#93c5fd' }}>{exportMessage}</div>}
        </div>

        <div className="panel glass-card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>{t('quote.sectionResult')}</h2>
          <div className="kpi-row" style={{ marginTop: 8 }}>
            {kpiCards.map((card) => (
              <div key={card.title} className="kpi-card">
                <div className="kpi-title">{card.title}</div>
                <div className="kpi-value">{card.value}</div>
                <div className="kpi-unit">{card.unit}</div>
              </div>
            ))}
          </div>

          <div className="subpanel glass-card" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('quote.result.summary')}</div>
            {quoteResult ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>{t('quote.result.mode')}{quoteResult.summary.mode}</div>
                <div>{t('quote.result.container')}{quoteResult.summary.container_type}</div>
                <div>{t('quote.result.tons')}{quoteResult.summary.tons.toFixed(4)}</div>
                <div>{t('quote.result.bags')}{quoteResult.summary.bags_int}</div>
                <div>{t('quote.result.cartons')}{quoteResult.summary.cartons_int}</div>
                <div>{t('quote.result.netCost')}{formatRmb(quoteResult.summary.net_rmb_per_bag)} / {t('quote.unit.bag')}</div>
                <div>{t('quote.result.bagSource')}{sourceLabel(quoteResult.summary.bag_price_source)}</div>
                <div>{t('quote.result.cartonSource')}{sourceLabel(quoteResult.summary.carton_price_source)}</div>
              </div>
            ) : (
              <div style={{ color: '#9ca3af' }}>{t('quote.result.fillHint')}</div>
            )}
          </div>

          <div className="subpanel glass-card" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('quote.result.breakdown')}</div>
            {quoteResult ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td>{t('quote.result.raw')}</td><td style={{ textAlign: 'right' }}>{formatRmb(quoteResult.breakdown.raw_rmb_per_bag)}</td></tr>
                  <tr><td>{t('quote.result.bagMat')}</td><td style={{ textAlign: 'right' }}>{formatRmb(quoteResult.breakdown.bag_mat_rmb_per_bag)}</td></tr>
                  <tr><td>{t('quote.result.carton')}</td><td style={{ textAlign: 'right' }}>{formatRmb(quoteResult.breakdown.carton_rmb_per_bag)}</td></tr>
                  <tr><td>{t('quote.result.landPerBag')}</td><td style={{ textAlign: 'right' }}>{formatRmb(quoteResult.breakdown.land_rmb_per_bag)}</td></tr>
                  <tr><td>{t('quote.result.landPerTon')}</td><td style={{ textAlign: 'right' }}>{formatRmb(quoteResult.breakdown.land_rmb_per_ton_used, 2)}</td></tr>
                  <tr><td>{t('quote.result.landTotal')}</td><td style={{ textAlign: 'right' }}>{formatRmb(quoteResult.breakdown.land_total_rmb, 2)}</td></tr>
                  <tr><td>{t('quote.result.port')}</td><td style={{ textAlign: 'right' }}>{formatRmb(quoteResult.breakdown.port_rmb_per_bag)}</td></tr>
                  <tr><td>{t('quote.result.domestic')}</td><td style={{ textAlign: 'right' }}>{formatRmb(quoteResult.breakdown.domestic_total_rmb_per_bag)}</td></tr>
                  <tr><td>{t('quote.result.rebate')}</td><td style={{ textAlign: 'right' }}>-{formatRmb(quoteResult.breakdown.rebate_rmb_per_bag)}</td></tr>
                  <tr><td>{t('quote.result.net')}</td><td style={{ textAlign: 'right' }}>{formatRmb(quoteResult.breakdown.net_rmb_per_bag)}</td></tr>
                </tbody>
              </table>
            ) : (
              <div style={{ color: '#9ca3af' }}>{t('common.noResult')}</div>
            )}
          </div>

          {quoteResult && quoteResult.warnings.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: '1px solid #78350f', backgroundColor: 'rgba(120,53,15,.26)', color: '#fde68a' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('quote.result.warnings')}</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {quoteResult.warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`} style={{ marginBottom: 4 }}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: 10, textAlign: 'right', fontSize: 12, color: '#94a3b8' }}>{t('app.versionPrefix')}{APP_VERSION}</div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { uiThemeKey } = useUiTheme()
  const [activeTab, setActiveTab] = useState<'quote' | 'admin'>('quote')
  const uiThemeClass =
    uiThemeKey === 'neon' ? 'theme-creative' : uiThemeKey === 'minimal' ? 'theme-minimal' : 'theme-classic'

  return (
    <div className={`app-root ${uiThemeClass}`} style={{ minHeight: '100vh', color: '#e5e7eb', padding: 20 }}>
      <div className="nav-glass" style={{ display: 'flex', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
        <button className={`tab-btn ${activeTab === 'quote' ? 'active' : ''}`} onClick={() => setActiveTab('quote')} style={{ flex: 1, padding: '12px 14px', border: 'none', cursor: 'pointer' }}>{t('app.quoteTab')}</button>
        <button className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => setActiveTab('admin')} style={{ flex: 1, padding: '12px 14px', border: 'none', cursor: 'pointer' }}>{t('app.adminTab')}</button>
      </div>
      <div style={{ display: activeTab === 'quote' ? 'block' : 'none' }}><Quoter /></div>
      <div style={{ display: activeTab === 'admin' ? 'block' : 'none' }}><Admin /></div>
    </div>
  )
}
