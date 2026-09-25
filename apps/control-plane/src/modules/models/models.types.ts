import type { models } from "../../db/schema.js";

export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;