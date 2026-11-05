/**
 * pnpm db:recompute — recalcula totais de pedidos/itens e custo de produtos a partir
 * do JSON original (`raw`) já salvo, sem chamar a API do PedidoOK.
 * Use depois de mudar as fórmulas em src/lib/metrics/orders.ts ou nos mappers.
 */
import { eq } from "drizzle-orm";
import { orderItems, orders, products } from "../src/lib/db/schema";
import { mapPedido, mapProduto } from "../src/lib/pedidook/mappers";
import type { Pedido, Produto } from "../src/lib/pedidook/schemas";
import { scriptDb } from "./_db.ts";

const { db, pool } = scriptDb();
let changedOrders = 0;
let changedProducts = 0;

const all = await db.select({ id: orders.id, raw: orders.raw, net: orders.netAmount, cost: orders.costAmount }).from(orders);
for (const o of all) {
  if (!o.raw) continue;
  const { order, items } = mapPedido(o.raw as Pedido);
  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ grossAmount: order.grossAmount, discountAmount: order.discountAmount, netAmount: order.netAmount, costAmount: order.costAmount })
      .where(eq(orders.id, o.id));
    const existing = await tx.select({ id: orderItems.id, pid: orderItems.productPedidookId }).from(orderItems).where(eq(orderItems.orderId, o.id));
    for (const it of items) {
      const row = existing.find((e) => e.pid === it.productPedidookId);
      if (row) await tx.update(orderItems).set({ totalAmount: it.totalAmount, grossMargin: it.grossMargin }).where(eq(orderItems.id, row.id));
    }
  });
  if (o.net !== order.netAmount || o.cost !== order.costAmount) changedOrders++;
}

const prods = await db.select({ id: products.id, raw: products.raw, cost: products.purchaseCost }).from(products);
for (const p of prods) {
  if (!p.raw) continue;
  const { purchaseCost } = mapProduto(p.raw as Produto);
  if (purchaseCost !== p.cost) {
    await db.update(products).set({ purchaseCost }).where(eq(products.id, p.id));
    changedProducts++;
  }
}

console.log(`Pedidos: ${all.length} recalculados, ${changedOrders} com valor alterado.`);
console.log(`Produtos: ${changedProducts} com custo alterado.`);
await pool.end();
