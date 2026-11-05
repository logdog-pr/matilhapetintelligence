import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "./support/db";

describe("segurança do banco (Supabase)", () => {
  it("todas as tabelas do schema public têm RLS ligado (API pública do Supabase bloqueada)", async () => {
    const { db, close } = await createTestDb();
    const res = await db.execute<{ relname: string; relrowsecurity: boolean }>(sql`
      select c.relname, c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'`);
    const rows = (Array.isArray(res) ? res : (res as unknown as { rows: { relname: string; relrowsecurity: boolean }[] }).rows);
    expect(rows.length).toBeGreaterThanOrEqual(23);
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
    await close();
  });
});
