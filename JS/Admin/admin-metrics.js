// ============================================================
// admin-metrics.js
// Handles metrics tracking and trend calculation
// ============================================================

import { getLS, setLS } from '../Core/Storage.js';
import { KEY_METRICS_HISTORY } from '../Core/Constants.js';
import { getSellers, getUsers, getOrders } from './admin-helpers.js';
import { fetchProducts } from './admin-data-products.js';

/**
 * Captures current metrics snapshot
 */
export async function captureMetricsSnapshot() {
    const products = await fetchProducts();
    const sellers = getSellers();
    const users = getUsers();
    const orders = getOrders();
    
    const customerCount = users.filter(u => (u.role || '').toLowerCase() === 'customer').length;
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.subtotal) || Number(o.total) || Number(o.totalPrice) || 0), 0);
    
    const snapshot = {
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        sellers: sellers.length,
        customers: customerCount,
        products: products.filter(p => p.isActive !== false).length,
        revenue: totalRevenue,
        orders: orders.length
    };
    
    return snapshot;
}

/**
 * Saves metrics snapshot to history
 */
export async function saveMetricsSnapshot() {
    const snapshot = await captureMetricsSnapshot();
    const history = getLS(KEY_METRICS_HISTORY) || [];
    
    // Check if we already have a snapshot for today
    const today = snapshot.date;
    const existingIndex = history.findIndex(h => h.date === today);
    
    if (existingIndex !== -1) {
        // Update today's snapshot
        history[existingIndex] = snapshot;
    } else {
        // Add new snapshot
        history.push(snapshot);
    }
    
    // Keep only last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const filtered = history.filter(h => new Date(h.date) >= ninetyDaysAgo);
    
    setLS(KEY_METRICS_HISTORY, filtered);
    return snapshot;
}


/**
 * Calculates trend for a specific metric
 * @param {string} metric - 'sellers', 'customers', 'products', 'revenue', 'orders'
 * @param {number} currentValue - Current value of the metric
 * @param {number} daysBack - Number of days to compare (default: 7)
 * @returns {object} Trend data with direction, percentage, and text
 */
export function calculateTrend(metric, currentValue, daysBack = 7) {
    const history = getLS(KEY_METRICS_HISTORY) || [];
    
    if (history.length === 0) {
        return null; // No historical data yet
    }
    
    // Get snapshot from daysBack ago
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysBack);
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    // Find closest snapshot to target date
    let closestSnapshot = null;
    let minDiff = Infinity;
    
    for (const snapshot of history) {
        const snapshotDate = new Date(snapshot.date);
        const diff = Math.abs(snapshotDate - targetDate);
        if (diff < minDiff) {
            minDiff = diff;
            closestSnapshot = snapshot;
        }
    }
    
    if (!closestSnapshot || !closestSnapshot[metric]) {
        return null; // No data for this metric
    }
    
    const previousValue = closestSnapshot[metric];
    
    // Calculate change
    const change = currentValue - previousValue;
    const percentChange = previousValue === 0 
        ? (currentValue > 0 ? 100 : 0) 
        : ((change / previousValue) * 100);
    
    // Determine direction
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    const icon = direction === 'up' ? '↗' : direction === 'down' ? '↘' : '→';
    
    // Generate text
    let text = '';
    if (Math.abs(change) === 0) {
        text = 'No change';
    } else if (metric === 'revenue') {
        text = `${change > 0 ? '+' : ''}$${Math.abs(change).toFixed(2)} this week`;
    } else {
        text = `${change > 0 ? '+' : ''}${Math.abs(change)} this week`;
    }
    
    return {
        direction,
        icon,
        percentage: Math.abs(percentChange).toFixed(1),
        text,
        change,
        previousValue,
        currentValue
    };
}

/**
 * Gets all trends for dashboard KPI cards
 */
export async function getAllTrends() {
    const products = await fetchProducts();
    const sellers = getSellers();
    const users = getUsers();
    const orders = getOrders();
    
    const customerCount = users.filter(u => (u.role || '').toLowerCase() === 'customer').length;
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.subtotal) || Number(o.total) || Number(o.totalPrice) || 0), 0);
    const activeProducts = products.filter(p => p.isActive !== false).length;
    
    return {
        sellers: calculateTrend('sellers', sellers.length),
        customers: calculateTrend('customers', customerCount),
        products: calculateTrend('products', activeProducts),
        revenue: calculateTrend('revenue', totalRevenue)
    };
}

/**
 * Initialize metrics tracking - call this when admin panel loads
 */
export async function initMetricsTracking() {
    // Save snapshot on page load
    await saveMetricsSnapshot();
    
    // Set up daily snapshot (check every hour if we need to save)
    setInterval(async () => {
        const history = getLS(KEY_METRICS_HISTORY) || [];
        const today = new Date().toISOString().split('T')[0];
        const hasToday = history.some(h => h.date === today);
        
        if (!hasToday) {
            await saveMetricsSnapshot();
            console.log('[METRICS] Daily snapshot saved');
        }
    }, 60 * 60 * 1000); // Check every hour
}
