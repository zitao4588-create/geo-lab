import { z } from 'zod';

export const diagnosisInputSchema = z.object({
  businessName: z.string().trim().min(1, '请填写产品/门店名称').max(80),
  description: z.string().trim().min(1, '请填写一句话介绍').max(500),
  links: z.string().trim().max(2000).optional().default(''),
  industry: z.string().trim().min(1, '请填写所在行业').max(80),
  city: z.string().trim().min(1, '请填写所在城市').max(80),
  targetCustomers: z.string().trim().min(1, '请填写目标客户').max(240),
  competitors: z.string().trim().max(300).optional().default(''),
  contact: z.string().trim().max(120).optional().default(''),
  samplePrompts: z.array(z.string().trim().min(3).max(240)).max(30).optional()
});
