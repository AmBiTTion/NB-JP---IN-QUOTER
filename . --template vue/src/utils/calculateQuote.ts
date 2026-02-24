
import type {
  AppData,
  ContainerType,
  Factory,
  LandFreightRule,
  Mode,
  PackagingOption,
  PortChargesRule,
  Product,
  QtyInputType,
} from '@/types/domain'

export interface CalculateQuoteInput {
  data: AppData
  product_id: string
  packaging_option_id: string
  factory_id: string
  mode: Mode
  container_type: ContainerType
  fx_rate: number
  margin_pct: number
  qty_input_type?: QtyInputType
  qty_input_value?: number
  override_unit_weight_kg?: number
  override_units_per_carton?: number | null
  override_bag_price_rmb?: number
  override_carton_price_rmb?: number
  override_inner_pack_type?: string
  land_fee_override_rmb_per_ton?: number
}

export interface QuoteBreakdown {
  raw_rmb_per_bag: number
  bag_mat_rmb_per_bag: number
  carton_rmb_per_bag: number
  land_rmb_per_bag: number
  land_rmb_per_ton_used: number
  land_total_rmb: number
  port_rmb_per_bag: number
  domestic_total_rmb_per_bag: number
  rebate_rmb_per_bag: number
  net_rmb_per_bag: number
}

export interface QuoteSummary {
  mode: Mode
  container_type: ContainerType
  tons: number
  bags: number
  bags_int: number
  cartons_int: number
  bag_price_source: 'default' | 'override' | 'custom'
  carton_price_source: 'default' | 'override' | 'custom'
  sell_usd_per_bag: number
  net_rmb_per_bag: number
  cost_usd_per_bag: number
  gp_rmb_per_bag: number
  gp_rmb_total: number
  fcl_port_total_rmb: number
  lcl_port_total_rmb: number | null
}

export interface CalculateQuoteResult {
  summary: QuoteSummary
  breakdown: QuoteBreakdown
  warnings: string[]
}

const FALLBACK_FCL_PORT: Record<ContainerType, number> = {
  '20GP': 3500,
  '40HQ': 4200,
}

function ensurePositive(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be greater than 0`)
  }
}

function findProduct(data: AppData, productId: string): Product {
  const product = data.products.find((item) => item.id === productId)
  if (!product) throw new Error('Product not found')
  return product
}

function findPackagingOption(data: AppData, packagingOptionId: string): PackagingOption {
  const option = data.packaging_options.find((item) => item.id === packagingOptionId)
  if (!option) throw new Error('Packaging option not found')
  return option
}

function findFactory(data: AppData, factoryId: string): Factory {
  const factory = data.factories.find((item) => item.id === factoryId)
  if (!factory) throw new Error('Factory not found')
  return factory
}

function findCostPerTon(data: AppData, productId: string, factoryId: string): number {
  const cost = data.factory_product_costs.find(
    (item) => item.product_id === productId && item.factory_id === factoryId,
  )
  if (!cost) {
    throw new Error('Missing factory product cost')
  }
  ensurePositive(cost.cost_rmb_per_ton, 'cost_rmb_per_ton')
  return cost.cost_rmb_per_ton
}

function resolveContainerMaxTons(
  data: AppData,
  productId: string,
  containerType: ContainerType,
  warnings: string[],
): number {
  const rule = data.container_load_rules.find(
    (item) => item.product_id === productId && item.container_type === containerType,
  )
  if (!rule) {
    warnings.push(`缺少该产品 ${containerType} 的装柜规则，已按默认值 20 吨计算。`)
    return 20
  }
  if (!Number.isFinite(rule.max_tons) || rule.max_tons <= 0) {
    warnings.push(`该产品 ${containerType} 的最大装柜吨数未维护或无效，已按默认值 20 吨计算。`)
    return 20
  }
  return rule.max_tons
}

function findPortRule(
  rules: PortChargesRule[],
  mode: Mode,
  containerType: ContainerType | null,
  portId: string,
): PortChargesRule | undefined {
  return (
    rules.find(
      (item) =>
        item.mode === mode && item.container_type === containerType && item.port_id === portId,
    ) ??
    rules.find(
      (item) =>
        item.mode === mode &&
        item.container_type === containerType &&
        (item.port_id === null || item.port_id === ''),
    )
  )
}

function resolveFclPortTotalRmb(
  data: AppData,
  portId: string,
  containerType: ContainerType,
  warnings: string[],
): number {
  const rule = findPortRule(data.port_charges_rules, 'FCL', containerType, portId)
  if (!rule) {
    warnings.push(`缺少 ${containerType} 的 FCL 港杂规则，已按默认值 ${FALLBACK_FCL_PORT[containerType]} RMB 计算。`)
    return FALLBACK_FCL_PORT[containerType]
  }
  return rule.base_rmb
}

function resolveLclPortTotalRmb(
  data: AppData,
  portId: string,
  tons: number,
  warnings: string[],
): number {
  const rule = findPortRule(data.port_charges_rules, 'LCL', null, portId)
  if (!rule) {
    warnings.push('ȱ�� LCL ���ӹ������� Admin ά����')
    return 0
  }
  const base = toNonNegative(rule.base_rmb, 0)
  const extraPerTon = toNonNegative(rule.extra_rmb_per_ton, 0)
  const extraTons = Math.max(0, tons - 1)
  const extraFee = Math.ceil(extraTons) * extraPerTon
  return base + extraFee
}

function resolveLandFreightPerTon(
  rules: LandFreightRule[],
  mode: Mode,
  factoryId: string,
  containerType: ContainerType,
  overrideValue: number | undefined,
  warnings: string[],
): number {
  if (overrideValue !== undefined && Number.isFinite(overrideValue) && overrideValue >= 0) {
    return overrideValue
  }

  const rule =
    rules.find(
      (item) =>
        item.mode === mode && item.container_type === containerType && item.factory_id === factoryId,
    ) ??
    rules.find(
      (item) =>
        item.mode === mode &&
        item.container_type === containerType &&
        (item.factory_id === null || item.factory_id === ''),
    )

  if (!rule) {
    warnings.push(`缺少 ${containerType} 的 ${mode} 港杂规则，已按默认值 0 RMB 计算。`)
    return 0
  }

  return rule.default_rmb_per_ton
}

function toNonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function resolvePackagingOverrides(data: AppData, factoryId: string, packagingOptionId: string) {
  const override = data.factory_packaging_overrides?.find(
    (item) => item.factory_id === factoryId && item.packaging_option_id === packagingOptionId,
  )
  return {
    carton_price_rmb_override: override?.carton_price_rmb_override ?? null,
    bag_price_rmb_override: override?.bag_price_rmb_override ?? null,
  }
}
export function calculateQuote(input: CalculateQuoteInput): CalculateQuoteResult {
  const warnings: string[] = []
  const { data } = input

  ensurePositive(input.fx_rate, 'fx_rate')
  if (!Number.isFinite(input.margin_pct) || input.margin_pct < 0 || input.margin_pct >= 1) {
    throw new Error('margin_pct must be in [0, 1)')
  }

  const product = findProduct(data, input.product_id)
  const packagingOption = findPackagingOption(data, input.packaging_option_id)
  const factory = findFactory(data, input.factory_id)

  if (packagingOption.product_id !== product.id) {
    throw new Error('packaging option does not belong to selected product')
  }

  const unitWeightKg = toNonNegative(
    input.override_unit_weight_kg ?? packagingOption.unit_weight_kg,
    packagingOption.unit_weight_kg,
  )
  ensurePositive(unitWeightKg, 'unit_weight_kg')

  const unitsPerCartonRaw =
    input.override_units_per_carton !== undefined
      ? input.override_units_per_carton
      : packagingOption.units_per_carton
  const unitsPerCarton =
    unitsPerCartonRaw === null || unitsPerCartonRaw === 0
      ? null
      : Math.max(1, Math.round(unitsPerCartonRaw))

  const bagsPerTon = 1000 / unitWeightKg
  ensurePositive(bagsPerTon, 'bags_per_ton')

  const maxTons = resolveContainerMaxTons(data, product.id, input.container_type, warnings)
  let mode: Mode = input.mode

  let inputTons: number | null = null
  if (
    input.qty_input_value !== undefined &&
    Number.isFinite(input.qty_input_value) &&
    input.qty_input_value > 0
  ) {
    if (input.qty_input_type === 'bags') {
      inputTons = (input.qty_input_value * unitWeightKg) / 1000
    } else {
      inputTons = input.qty_input_value
    }
  }

  if (mode === 'FCL' && inputTons !== null && inputTons < maxTons) {
    mode = 'LCL'
    warnings.push(
      `您输入的吨数小于该产品默认装柜吨数（${maxTons.toFixed(2)} 吨），系统已自动切换为 LCL 进行计算。`,
    )
  }

  let tons = 0
  let bags = 0

  if (mode === 'FCL') {
    tons = maxTons
    bags = Math.ceil(tons * bagsPerTon)
  } else {
    if (!input.qty_input_type || !input.qty_input_value || input.qty_input_value <= 0) {
      throw new Error('LCL mode requires qty_input_type and qty_input_value')
    }
    if (input.qty_input_type === 'bags') {
      bags = Math.ceil(input.qty_input_value)
      tons = (bags * unitWeightKg) / 1000
    } else {
      tons = input.qty_input_value
      bags = Math.ceil(tons * bagsPerTon)
    }
  }

  ensurePositive(tons, 'tons')
  ensurePositive(bags, 'bags')
  const bagsInt = Math.ceil(bags)

  const costRmbPerTon = findCostPerTon(data, product.id, factory.id)

  const packagingOverride = resolvePackagingOverrides(data, factory.id, packagingOption.id)
  const bagPriceSource: QuoteSummary['bag_price_source'] =
    input.override_bag_price_rmb !== undefined
      ? 'custom'
      : packagingOverride.bag_price_rmb_override !== null &&
          packagingOverride.bag_price_rmb_override !== undefined
        ? 'override'
        : 'default'
  const cartonPriceSource: QuoteSummary['carton_price_source'] =
    input.override_carton_price_rmb !== undefined
      ? 'custom'
      : packagingOverride.carton_price_rmb_override !== null &&
          packagingOverride.carton_price_rmb_override !== undefined
        ? 'override'
        : 'default'

  const effectiveBagPrice =
    input.override_bag_price_rmb ??
    packagingOverride.bag_price_rmb_override ??
    packagingOption.bag_price_rmb
  const effectiveCartonPrice =
    input.override_carton_price_rmb ??
    packagingOverride.carton_price_rmb_override ??
    packagingOption.carton_price_rmb

  const cartonsInt =
    unitsPerCarton && unitsPerCarton > 0 ? Math.ceil(bagsInt / unitsPerCarton) : 0

  const rawRmbPerBag = (costRmbPerTon * (1 + product.invoice_tax_point) * tons) / bagsInt
  const bagMatRmbPerBag = toNonNegative(effectiveBagPrice, 0)
  const cartonRmbPerBag =
    unitsPerCarton && unitsPerCarton > 0 && cartonsInt > 0
      ? (cartonsInt * toNonNegative(effectiveCartonPrice, 0)) / bagsInt
      : 0

  const landFreightPerTon = resolveLandFreightPerTon(
    data.land_freight_rules,
    mode,
    factory.id,
    input.container_type,
    input.land_fee_override_rmb_per_ton,
    warnings,
  )
  const landFreightTotal = landFreightPerTon * tons
  const landRmbPerBag = landFreightTotal / bagsInt

  const fclPortTotalRmb = resolveFclPortTotalRmb(
    data,
    product.pol_port_id,
    input.container_type,
    warnings,
  )
  const lclPortTotalRmb =
    mode === 'LCL' ? resolveLclPortTotalRmb(data, product.pol_port_id, tons, warnings) : null
  const portTotalRmb = mode === 'FCL' ? fclPortTotalRmb : lclPortTotalRmb ?? 0
  const portRmbPerBag = portTotalRmb / bagsInt

  if (mode === 'LCL' && lclPortTotalRmb !== null && lclPortTotalRmb > fclPortTotalRmb) {
    warnings.push(
      `当前 LCL 港杂约为 ${lclPortTotalRmb.toFixed(2)} RMB，已高于同吨数的 FCL 港杂 ${fclPortTotalRmb.toFixed(
          2,
        )} RMB，建议选择 FCL。`,
    )
  }

  const domesticTotalRmbPerBag =
    rawRmbPerBag + bagMatRmbPerBag + cartonRmbPerBag + landRmbPerBag + portRmbPerBag
  const rebateRmbPerBag = rawRmbPerBag * product.refund_rate
  const netRmbPerBag = domesticTotalRmbPerBag - rebateRmbPerBag

  const costUsdPerBag = netRmbPerBag / input.fx_rate
  const sellUsdPerBag = costUsdPerBag / (1 - input.margin_pct)
  const sellRmbPerBag = sellUsdPerBag * input.fx_rate
  const gpRmbPerBag = sellRmbPerBag - netRmbPerBag
  const gpRmbTotal = gpRmbPerBag * bagsInt

  return {
    summary: {
      mode,
      container_type: input.container_type,
      tons,
      bags: bagsInt,
      bags_int: bagsInt,
      cartons_int: cartonsInt,
      bag_price_source: bagPriceSource,
      carton_price_source: cartonPriceSource,
      sell_usd_per_bag: sellUsdPerBag,
      net_rmb_per_bag: netRmbPerBag,
      cost_usd_per_bag: costUsdPerBag,
      gp_rmb_per_bag: gpRmbPerBag,
      gp_rmb_total: gpRmbTotal,
      fcl_port_total_rmb: fclPortTotalRmb,
      lcl_port_total_rmb: lclPortTotalRmb,
    },
    breakdown: {
      raw_rmb_per_bag: rawRmbPerBag,
      bag_mat_rmb_per_bag: bagMatRmbPerBag,
      carton_rmb_per_bag: cartonRmbPerBag,
      land_rmb_per_bag: landRmbPerBag,
      land_rmb_per_ton_used: landFreightPerTon,
      land_total_rmb: landFreightTotal,
      port_rmb_per_bag: portRmbPerBag,
      domestic_total_rmb_per_bag: domesticTotalRmbPerBag,
      rebate_rmb_per_bag: rebateRmbPerBag,
      net_rmb_per_bag: netRmbPerBag,
    },
    warnings,
  }
}

export function formatCurrency(
  amount: number,
  currency: 'CNY' | 'USD' = 'CNY',
  decimals = 4,
): string {
  const symbol = currency === 'USD' ? '$' : '¥'
  return `${symbol}${amount.toFixed(decimals)}`
}
