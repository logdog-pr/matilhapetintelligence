/** Rótulos das ferramentas da IA para exibição (seguro para o cliente). */
export const TOOL_LABELS: Record<string, string> = {
  get_sales_summary: "Resumo de vendas",
  get_sales_evolution: "Evolução mensal",
  get_seller_performance: "Desempenho dos vendedores",
  get_sales_goals: "Metas",
  get_customers_to_contact: "Clientes a contatar",
  get_customer_purchase_history: "Histórico do cliente",
  get_product_performance: "Produtos mais vendidos",
  get_stock_recommendations: "Recomendações de estoque",
  get_promotion_opportunities: "Oportunidades de promoção",
};

export const EXAMPLE_QUESTIONS: { text: string; managerOnly?: boolean }[] = [
  { text: "Qual foi nosso faturamento este mês comparado ao mês passado?" },
  { text: "Qual vendedor está mais distante da meta?", managerOnly: true },
  { text: "Quais clientes eu preciso contatar esta semana?" },
  { text: "Qual foi a evolução das vendas nos últimos 12 meses?" },
  { text: "Quais produtos mais venderam nos últimos 30 dias?" },
  { text: "Como podemos aumentar o ticket médio?" },
];
