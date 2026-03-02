export type Mode = 'FCL' | 'LCL'
export type ContainerType = '20GP' | '40HQ'
export type QtyInputType = 'bags' | 'tons'
export type InnerPackType = 'none' | 'carton' | 'woven_bag' | 'small_box' | 'big_box'
export interface UserProfile {
  id: string
  name: string
  companyName?: string
  address?: string
  postCode?: string
  tel?: string
  whatsapp?: string
  wechat?: string
  email?: string
  export_from_name?: string
}

export interface Settings {
  fx_rate: number
  margin_pct: number
  quote_valid_days: number
  ui_theme?: 'classic' | 'neon' | 'minimal' | 'paper'
  money_format: {
    rmb_decimals: number
    usd_decimals: number
  }
  pricing_formula_mode: string
  rounding_policy: string
  terms_template: string
  user_profiles?: UserProfile[]
  active_user_profile_id?: string
}

export interface Product {
  id: string
  name: string
  name_en?: string
  description_en?: string
  image_path?: string
  refund_rate: number
  purchase_vat_rate: number
  invoice_tax_point: number
  pol_port_id: string
  default_packaging_option_id?: string
}

export interface PackagingOption {
  id: string
  product_id: string
  name: string
  unit_weight_kg: number
  units_per_carton: number | null
  carton_price_rmb: number
  bag_price_rmb: number
  inner_pack_type: InnerPackType
  unit_cbm: number | null
  carton_cbm: number | null
  default_selected?: boolean
}

export interface PackagingRecommendation {
  id: string
  product_id: string
  inner_pack_type?: InnerPackType | null
  unit_weight_kg: number
  recommended_units_per_carton: number
  notes?: string | null
}

export interface Factory {
  id: string
  name: string
  default_port_id: string | null
}

export interface FactoryProductCost {
  id: string
  factory_id: string
  product_id: string
  cost_rmb_per_ton: number
  cost_unit?: 'ton' | 'bag' | 'piece' | 'carton'
}

export interface Port {
  id: string
  name: string
  code: string
  country?: string | null
}

export interface PortChargesRule {
  id: string
  port_id: string | null
  mode: Mode
  container_type: ContainerType | null
  base_rmb: number
  extra_rmb_per_ton: number
}

export interface ContainerLoadRule {
  id: string
  product_id: string
  container_type: ContainerType
  max_tons: number
}

export interface LandFreightRule {
  id: string
  mode: Mode
  factory_id: string | null
  container_type: ContainerType
  min_rmb_per_ton: number
  max_rmb_per_ton: number
  default_rmb_per_ton: number
}

export interface FactoryPackagingOverride {
  id: string
  factory_id: string
  packaging_option_id: string
  carton_price_rmb_override?: number | null
  bag_price_rmb_override?: number | null
}

export interface CalculationHistory {
  id: string
  timestamp: string
  payload: unknown
}

export interface AppData {
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

export type EditableTableKey =
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
