/**
 * IMPORTANT:
 * 本文件必须使用 UTF-8（无 BOM）保存。
 * 请勿让自动工具“重写整文件”，只允许增量修改键值。
 */
import type { InnerPackType } from '@/types/domain'

export const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  name: '名称',
  product_id: '产品',
  factory_id: '工厂',
  packaging_option_id: '包装方案',
  refund_rate: '出口退税率',
  purchase_vat_rate: '采购增值税率',
  invoice_tax_point: '开票加点',
  pol_port_id: '起运港',

  unit_weight_kg: '每袋重量（kg）',
  units_per_carton: '每箱袋数',
  carton_price_rmb: '每箱纸箱成本（RMB）',
  bag_price_rmb: '每袋包装成本（RMB）',
  inner_pack_type: '内包装类型',

  cost_rmb_per_ton: '工厂吨成本（RMB/吨）',
  max_tons: '最大装柜吨数',

  port_id: '港口',
  mode: '运输模式',
  container_type: '柜型',

  base_rmb: '基础费用（RMB）',
  extra_rmb_per_ton: '超吨费用（RMB/吨）',

  min_rmb: '最小费用（RMB）',
  max_rmb: '最大费用（RMB）',
  default_rmb: '默认费用（RMB）',

  min_rmb_per_ton: '最小单吨费用（RMB/吨）',
  max_rmb_per_ton: '最大单吨费用（RMB/吨）',
  default_rmb_per_ton: '默认单吨费用（RMB/吨）',

  fx_rate: '汇率',
  margin_pct: '毛利率',
  quote_valid_days: '报价有效期（天）',
  pricing_formula_mode: '定价公式模式',
  rounding_policy: '取整规则',
  terms_template: '条款模板',
  money_format_rmb_decimals: 'RMB 小数位',
  money_format_usd_decimals: 'USD 小数位',

  recommended_units_per_carton: '推荐每箱袋数',
  notes: '备注',

  carton_price_rmb_override: '纸箱价覆盖（RMB/箱）',
  bag_price_rmb_override: '包装价覆盖（RMB/袋）',
  unit_weight_kg_override: '每袋重量覆盖（kg）',
}

export const INNER_PACK_LABELS: Record<InnerPackType, string> = {
  none: '无',
  carton: '纸箱',
  woven_bag: '编织袋',
  small_box: '小盒彩盒',
  big_box: '大盒彩盒',
}

export function labelFor(key: string, fallback?: string): string {
  return FIELD_LABELS[key] ?? fallback ?? key
}
