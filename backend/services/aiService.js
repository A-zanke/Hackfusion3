const axios = require('axios');

class AIService {
    constructor() {
        this.apiKey = process.env.GROK_API_KEY;
        this.baseURL = process.env.GROK_BASE_URL;
        this.model = process.env.GROK_MODEL;
    }

    async generateRecommendations(analyticsData) {
        try {
            const prompt = this.buildPrompt(analyticsData);
            
            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: this.model,
                    messages: [
                        {
                            role: "system",
                            content: "You are an expert pharmaceutical business analyst providing concise, actionable insights for pharmacy management. Generate exactly 4 short, professional recommendations based on the analytics data provided. Each recommendation should be 1-2 sentences maximum and focus on business actions."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    max_tokens: 300,
                    temperature: 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const insights = response.data.choices[0].message.content
                .split('\n')
                .filter(line => line.trim())
                .map(line => line.replace(/^\d+\.?\s*/, '').trim())
                .filter(line => line.length > 10)
                .slice(0, 4);

            return insights.length >= 4 ? insights : [...insights, ...this.getFallbackRecommendations(analyticsData)].slice(0, 4);
        } catch (error) {
            console.error('Error generating AI recommendations:', error.message);
            return this.getFallbackRecommendations(analyticsData);
        }
    }

    buildPrompt(analyticsData) {
        const { season, demandSpikes, lowStockMedicines, repeatCustomers, summary } = analyticsData;
        
        let prompt = `PharmaAI Analytics - ${season} Season\n\n`;
        prompt += `Business Summary (Last 30 Days):\n`;
        prompt += `- Total Orders: ${summary.totalOrders30Days}\n`;
        prompt += `- Total Revenue: ₹${summary.totalRevenue30Days.toLocaleString('en-IN')}\n`;
        prompt += `- Demand Spikes: ${summary.spikeCount} medicines\n`;
        prompt += `- Low Stock Items: ${summary.lowStockCount} medicines\n`;
        prompt += `- Repeat Customers: ${summary.repeatCustomerCount}\n\n`;

        if (demandSpikes.length > 0) {
            prompt += `Top Demand Spikes (30%+ increase):\n`;
            demandSpikes.slice(0, 3).forEach(spike => {
                prompt += `- ${spike.name}: +${spike.demand_change_percent}%\n`;
            });
            prompt += '\n';
        }

        if (lowStockMedicines.length > 0) {
            prompt += `Critical Low Stock Items:\n`;
            lowStockMedicines.slice(0, 3).forEach(med => {
                prompt += `- ${med.name}: ${med.total_tablets} tablets remaining\n`;
            });
            prompt += '\n';
        }

        if (repeatCustomers.length > 0) {
            prompt += `Top Repeat Customers:\n`;
            repeatCustomers.slice(0, 3).forEach(customer => {
                prompt += `- ${customer.customer_name}: ${customer.total_orders} orders, ₹${customer.total_spent.toLocaleString('en-IN')}\n`;
            });
            prompt += '\n';
        }

        prompt += `Generate exactly 4 concise, actionable business recommendations for the pharmacy manager based on this data.`;

        return prompt;
    }

    getFallbackRecommendations(analyticsData) {
        const { summary, demandSpikes, lowStockMedicines } = analyticsData;
        
        const recommendations = [];

        if (demandSpikes.length > 0) {
            recommendations.push(`Increase stock for ${demandSpikes[0].name} showing ${demandSpikes[0].demand_change_percent}% demand surge`);
        } else {
            recommendations.push("Monitor medicine demand trends to identify emerging opportunities");
        }

        if (lowStockMedicines.length > 0) {
            recommendations.push(`Restock critical items - ${lowStockMedicines.length} medicines running low on inventory`);
        } else {
            recommendations.push("Current inventory levels are adequate - maintain optimal stock ranges");
        }

        if (summary.repeatCustomerCount > 0) {
            recommendations.push("Launch loyalty program for repeat customers to increase retention");
        } else {
            recommendations.push("Focus on customer service to build repeat business relationships");
        }

        recommendations.push(`${season} season inventory planning - adjust stock levels for seasonal demand patterns`);

        return recommendations;
    }
}

module.exports = new AIService();
