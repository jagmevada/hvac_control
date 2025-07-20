// alerts.js
// Alert settings and alert checking logic
// - fetchAlertSettings: Loads alert thresholds from backend
// - checkAlerts: Checks sensor data for alert conditions

// Holds the current alert settings
export let alertSettings = {};

// Fetch alert settings from Supabase and update the UI
export async function fetchAlertSettings() {
  const list = document.getElementById("alert-settings-list");
  // Supabase client must be available globally
  if (!window.supabase) {
    console.error("Supabase client not found on window");
    return;
  }
  const { data, error } = await window.supabase.from("alert_settings").select("*");

  if (error) {
    console.error(error);
    if (list) {
      list.innerHTML = `<li style="color:red;">❌ Error: ${error.message}</li>`;
    }
    return;
  }

  // Clear and update the UI list if it exists
  if (list) {
    list.innerHTML = "";
    data.forEach(setting => {
      const item = document.createElement("li");
      item.textContent = `${setting.sensor_type} - ${setting.parameter}: Min ${setting.min_threshold}, Max ${setting.max_threshold}`;
      list.appendChild(item);
    });
  }

  // Convert fetched settings to a more usable format
  alertSettings = {};
  data.forEach(setting => {
    const key = `${setting.sensor_type}_${setting.parameter}`;
    alertSettings[key] = {
      min: setting.min_threshold,
      max: setting.max_threshold
    };
  });
}

// Check sensor data for alerts using alertSettings
export function checkAlerts(data) {
  const alerts = [];
  const latest = {};
  // Get latest data for each sensor
  data.forEach(row => {
    if (!latest[row.sensor_id]) {
      latest[row.sensor_id] = row;
    }
  });

  // Check for alerts using the fetched settings
  Object.values(latest).forEach(d => {
    const sensorType = d.sensor_id.startsWith('ac') ? 'ac' : 'ecs';
    // Check temperature thresholds (t1 and t2)
    ['t1', 't2'].forEach(tempParam => {
      const settingKey = `${sensorType}_${tempParam}`;
      if (alertSettings[settingKey]) {
        const setting = alertSettings[settingKey];
        const value = d[tempParam];
        if (value !== undefined) {
          if (setting.min !== null && value < setting.min) {
            alerts.push(`${sensorType.toUpperCase()} alert in ${d.sensor_id}: ${tempParam} below minimum (${value} < ${setting.min})`);
          }
          if (setting.max !== null && value > setting.max) {
            alerts.push(`${sensorType.toUpperCase()} alert in ${d.sensor_id}: ${tempParam} above maximum (${value} > ${setting.max})`);
          }
        }
      }
    });
    // Check humidity for ECS only
    if (sensorType === 'ecs' && d.rh !== undefined) {
      const setting = alertSettings['ecs_rh'];
      if (setting && setting.max !== null && d.rh > setting.max) {
        alerts.push(`ECS alert in ${d.sensor_id}: Humidity above maximum (${d.rh}% > ${setting.max}%)`);
      }
    }
    // Check air quality parameters for ECS only
    if (sensorType === 'ecs') {
      ['pm1', 'pm25', 'pm10', 'nc'].forEach(param => {
        const setting = alertSettings[`ecs_${param}`];
        if (setting && setting.max !== null && d[param] !== undefined && d[param] > setting.max) {
          const unit = param === 'nc' ? 'particles/m³' : 'μg/m³';
          alerts.push(`ECS alert in ${d.sensor_id}: ${param.toUpperCase()} above maximum (${d[param]} ${unit} > ${setting.max} ${unit})`);
        }
      });
    }
  });

  // Display alerts
  const alertsContainer = document.getElementById('alerts-container');
  if (alertsContainer) {
    alertsContainer.innerHTML = '';
    if (alerts.length > 0) {
      alerts.forEach(alert => {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert-banner';
        alertDiv.textContent = `🚨 ${alert}`;
        alertsContainer.appendChild(alertDiv);
      });
    }
  }
}
