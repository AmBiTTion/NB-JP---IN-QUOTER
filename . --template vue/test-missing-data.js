import { calculateQuotation, formatCurrency } from './src/utils/calculator.js';

// 测试产品 - 包含缺失数据，但包含 shipping_fees
const testProduct = {
  name: 'Test Product with Missing Data',
  price_per_ton: null,
  density: null,
  vat_rate: null,
  refund_rate: undefined,
  custom_pkg_moq: undefined,
  custom_pkg_price: null,
  units_per_box: undefined,
  box_unit_price: null,
  plate_fee: null,
  shipping_fees: { 'Port A': 500 },  // 添加港口运费
  origin: 'Test Origin'
};

try {
  const result = calculateQuotation(testProduct, false, 1000, 100, 0, 'Port A', 7.2, 1.1);
  console.log('✓ 计算成功！');
  console.log('产品名:', result.productName);
  console.log('单位采购价:', formatCurrency(result.unitPurchasePrice));
  console.log('美金报价:', formatCurrency(result.usdQuote, 'USD'));
  console.log('总美金报价:', formatCurrency(result.totalUsdQuote, 'USD'));
  console.log('\n所有字段都使用了默认值，产品仍能正常计算！');
} catch (error) {
  console.error('✗ 计算失败:', error.message);
}
