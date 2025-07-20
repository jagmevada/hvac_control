// app.js
// Main entry point for dashboard logic
// - Imports and initializes modules
// - Handles app startup and global event listeners

import { fetchAlertSettings, checkAlerts } from './alerts.js';
import { fetchSensorData, displayData } from './sensors.js';
import { updateChart, fetchChartData, processChartData, updateChartDisplay } from './charts.js';

// Wait for window.supabase to be available before initializing app
function initializeApp() {
  if (!window.supabase) {
    setTimeout(initializeApp, 50);
    return;
  }
  fetchAlertSettings();
  fetchSensorData();
  setInterval(fetchSensorData, 30000); // Update every 30 seconds
  // Initialize chart
  setTimeout(() => {
    updateChart();
  }, 2000);
}

// Start initialization after DOM and modules are loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
