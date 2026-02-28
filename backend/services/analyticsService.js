const db = require('../db');

class AnalyticsService {
    // Get current season from system date
    getCurrentSeason() {
        const month = new Date().getMonth() + 1; // 1-12
        
        if (month >= 3 && month <= 5) return 'Spring';
        if (month >= 6 && month <= 8) return 'Summer';
        if (month >= 9 && month <= 11) return 'Fall';
        return 'Winter';
    }

    // Get demand comparison between last 7 vs 30 days
    async getDemandComparison() {
        try {
            const query = `
                WITH 
                last_7_days AS (
                    SELECT 
                        m.name,
                        SUM(oi.quantity) as quantity_7_days,
                        COUNT(DISTINCT o.id) as orders_7_days
                    FROM medicines m
                    JOIN order_items oi ON m.id = oi.medicine_id
                    JOIN orders o ON oi.order_id = o.id
                    WHERE o.created_at >= NOW() - INTERVAL '7 days'
                    AND o.is_deleted = FALSE
                    AND m.is_deleted = FALSE
                    GROUP BY m.name
                ),
                last_30_days AS (
                    SELECT 
                        m.name,
                        SUM(oi.quantity) as quantity_30_days,
                        COUNT(DISTINCT o.id) as orders_30_days
                    FROM medicines m
                    JOIN order_items oi ON m.id = oi.medicine_id
                    JOIN orders o ON oi.order_id = o.id
                    WHERE o.created_at >= NOW() - INTERVAL '30 days'
                    AND o.is_deleted = FALSE
                    AND m.is_deleted = FALSE
                    GROUP BY m.name
                )
                SELECT 
                    COALESCE(l7.name, l30.name) as medicine_name,
                    COALESCE(l7.quantity_7_days, 0) as quantity_7_days,
                    COALESCE(l30.quantity_30_days, 0) as quantity_30_days,
                    COALESCE(l7.orders_7_days, 0) as orders_7_days,
                    COALESCE(l30.orders_30_days, 0) as orders_30_days,
                    CASE 
                        WHEN l30.quantity_30_days > 0 THEN 
                            ROUND(((COALESCE(l7.quantity_7_days, 0) * 4.3) - l30.quantity_30_days) / l30.quantity_30_days * 100, 2)
                        ELSE 0 
                    END as demand_change_percent
                FROM last_7_days l7
                FULL OUTER JOIN last_30_days l30 ON l7.name = l30.name
                WHERE COALESCE(l30.quantity_30_days, 0) > 0
                ORDER BY demand_change_percent DESC
                LIMIT 20
            `;
            
            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error getting demand comparison:', error);
            throw error;
        }
    }

    // Get medicines with 30%+ demand spikes
    async getDemandSpikes() {
        try {
            const query = `
                WITH 
                last_7_days AS (
                    SELECT 
                        m.id,
                        m.name,
                        SUM(oi.quantity) as quantity_7_days
                    FROM medicines m
                    JOIN order_items oi ON m.id = oi.medicine_id
                    JOIN orders o ON oi.order_id = o.id
                    WHERE o.created_at >= NOW() - INTERVAL '7 days'
                    AND o.is_deleted = FALSE
                    AND m.is_deleted = FALSE
                    GROUP BY m.id, m.name
                ),
                last_30_days AS (
                    SELECT 
                        m.id,
                        SUM(oi.quantity) as quantity_30_days
                    FROM medicines m
                    JOIN order_items oi ON m.id = oi.medicine_id
                    JOIN orders o ON oi.order_id = o.id
                    WHERE o.created_at >= NOW() - INTERVAL '30 days'
                    AND o.is_deleted = FALSE
                    AND m.is_deleted = FALSE
                    GROUP BY m.id
                )
                SELECT 
                    l7.id,
                    l7.name,
                    l7.quantity_7_days,
                    COALESCE(l30.quantity_30_days, 0) as quantity_30_days,
                    CASE 
                        WHEN l30.quantity_30_days > 0 THEN 
                            ROUND(((l7.quantity_7_days * 4.3) - l30.quantity_30_days) / l30.quantity_30_days * 100, 2)
                        ELSE 0 
                    END as demand_change_percent
                FROM last_7_days l7
                LEFT JOIN last_30_days l30 ON l7.id = l30.id
                WHERE l30.quantity_30_days > 0
                AND ((l7.quantity_7_days * 4.3) - l30.quantity_30_days) / l30.quantity_30_days >= 0.3
                ORDER BY demand_change_percent DESC
            `;
            
            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error getting demand spikes:', error);
            throw error;
        }
    }

    // Get low stock medicines
    async getLowStockMedicines() {
        try {
            const query = `
                SELECT 
                    id,
                    name,
                    brand,
                    category,
                    stock_packets,
                    tablets_per_packet,
                    (stock_packets * tablets_per_packet) as total_tablets,
                    price_per_packet,
                    expiry_date
                FROM medicines 
                WHERE is_deleted = FALSE 
                AND (stock_packets * tablets_per_packet) <= 50
                ORDER BY total_tablets ASC
                LIMIT 15
            `;
            
            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error getting low stock medicines:', error);
            throw error;
        }
    }

    // Get repeat customers
    async getRepeatCustomers() {
        try {
            const query = `
                SELECT 
                    COALESCE(o.customer_name, 'Unknown') as customer_name,
                    COALESCE(o.mobile, 'No Mobile') as mobile,
                    COUNT(DISTINCT o.id) as total_orders,
                    SUM(o.total_price) as total_spent,
                    MAX(o.created_at) as last_order_date,
                    MIN(o.created_at) as first_order_date
                FROM orders o
                WHERE o.is_deleted = FALSE
                GROUP BY o.customer_name, o.mobile
                HAVING COUNT(DISTINCT o.id) > 1
                ORDER BY total_orders DESC, total_spent DESC
                LIMIT 20
            `;
            
            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error getting repeat customers:', error);
            throw error;
        }
    }

    // Get overall analytics summary
    async getAnalyticsSummary() {
        try {
            const [demandComparison, demandSpikes, lowStock, repeatCustomers] = await Promise.all([
                this.getDemandComparison(),
                this.getDemandSpikes(),
                this.getLowStockMedicines(),
                this.getRepeatCustomers()
            ]);

            const totalOrdersQuery = `
                SELECT COUNT(DISTINCT id) as total_orders
                FROM orders 
                WHERE created_at >= NOW() - INTERVAL '30 days'
                AND is_deleted = FALSE
            `;
            
            const totalRevenueQuery = `
                SELECT COALESCE(SUM(total_price), 0) as total_revenue
                FROM orders 
                WHERE created_at >= NOW() - INTERVAL '30 days'
                AND is_deleted = FALSE
            `;

            const [totalOrdersResult, totalRevenueResult] = await Promise.all([
                db.query(totalOrdersQuery),
                db.query(totalRevenueQuery)
            ]);

            return {
                season: this.getCurrentSeason(),
                demandComparison: demandComparison.slice(0, 10), // Top 10
                demandSpikes,
                lowStockMedicines: lowStock,
                repeatCustomers: repeatCustomers.slice(0, 10), // Top 10
                summary: {
                    totalOrders30Days: parseInt(totalOrdersResult.rows[0].total_orders),
                    totalRevenue30Days: parseFloat(totalRevenueResult.rows[0].total_revenue),
                    spikeCount: demandSpikes.length,
                    lowStockCount: lowStock.length,
                    repeatCustomerCount: repeatCustomers.length
                }
            };
        } catch (error) {
            console.error('Error getting analytics summary:', error);
            throw error;
        }
    }
}

module.exports = new AnalyticsService();
