import type { BusinessType, DiagnosisInput } from '../shared/types.js';

const localServiceTerms = /门店|餐厅|酒店|诊所|工作室|本地服务|到店|商家/u;
const softwareTerms = /小程序|软件|应用|App|平台|SaaS|网站|数字工具|管理工具/u;
const physicalTerms = /剃须刀|商品|产品|设备|电器|刀头|马达|防水|续航|家电|食品|服装|家具|硬件/u;

export function inferBusinessType(input: DiagnosisInput): BusinessType {
  if (input.confirmedBusinessType) return input.confirmedBusinessType;
  const combined = `${input.businessName} ${input.description} ${input.industry}`;
  if (localServiceTerms.test(combined)) return 'local_service';
  if (softwareTerms.test(combined)) return 'software_or_miniprogram';
  if (physicalTerms.test(combined)) return 'physical_product';
  return 'generic_or_unknown';
}

export function normalizeCompactText(value: string) {
  return value.toLowerCase().replace(/\s+/gu, '');
}

export function normalizeIdentity(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\p{Script=Han}]+/gu, '');
}
