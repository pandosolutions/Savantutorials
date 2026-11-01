import { z } from 'zod';
export const actionSchema = z.discriminatedUnion('kind', [
  z.object({ id: z.string().regex(/^[a-z0-9-]+$/), kind: z.literal('observe'), narration: z.string().max(240) }).strict(),
  z.object({ id: z.string().regex(/^[a-z0-9-]+$/), kind: z.literal('focus'), selector: z.string(), narration: z.string().max(240) }).strict(),
  z.object({ id: z.string().regex(/^[a-z0-9-]+$/), kind: z.literal('scroll'), pixels: z.number().int().min(-900).max(900), narration: z.string().max(240) }).strict(),
  z.object({ id: z.string().regex(/^[a-z0-9-]+$/), kind: z.literal('navigate'), selector: z.string(), heading: z.string().min(1), narration: z.string().max(240) }).strict(),
]);
export const sceneSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), title: z.string(),
  route: z.string().startsWith('/').refine(s => !s.startsWith('//') && !s.includes('\\')),
  heading: z.string().min(1), actions: z.array(actionSchema).min(1).max(12),
}).strict().superRefine((s, ctx) => {
  if (new Set(s.actions.map(a => a.id)).size !== s.actions.length) ctx.addIssue({ code: 'custom', message: 'Action IDs must be unique' });
});
export type Scene = z.infer<typeof sceneSchema>;
export const planSchema = z.object({ title: z.string(), introduction: z.string(), actionIds: z.array(z.string()).min(1).max(12) }).strict();
export type Plan = z.infer<typeof planSchema>;
export function validatePlan(value: unknown, scene: Scene): Plan {
  const plan = planSchema.parse(value);
  if (new Set(plan.actionIds).size !== plan.actionIds.length || plan.actionIds.some(id => !scene.actions.some(a => a.id === id))) throw new Error('Plan contains duplicate or undeclared actions');
  return plan;
}
export const decisionSchema = z.object({ actionId: z.string(), reason: z.string().max(500) }).strict();
export const reviewSchema = z.object({ passed: z.boolean(), issues: z.array(z.string()).max(20), summary: z.string() }).strict();
