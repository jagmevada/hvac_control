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
    const sensorId = d.sensor_id || '';
    if (!sensorId.startsWith('ecs_')) return; // only ECS devices in current setup

    // Check temperature thresholds (t1 and t2)
    ['t1', 't2'].forEach(tempParam => {
      const settingKey = `ecs_${tempParam}`;
      if (alertSettings[settingKey]) {
        const setting = alertSettings[settingKey];
        const value = d[tempParam];
        if (value !== undefined && value !== null) {
          if (setting.min !== null && setting.min !== undefined && value < setting.min) {
            alerts.push(`ECS alert in ${d.sensor_id}: ${tempParam} below minimum (${value} < ${setting.min})`);
          }
          if (setting.max !== null && setting.max !== undefined && value > setting.max) {
            alerts.push(`ECS alert in ${d.sensor_id}: ${tempParam} above maximum (${value} > ${setting.max})`);
          }
        }
      }
    });

    // Check humidity channels rh1 and rh2
    ['rh1', 'rh2'].forEach(rhParam => {
      const settingKey = `ecs_${rhParam}`;
      if (alertSettings[settingKey]) {
        const setting = alertSettings[settingKey];
        const value = d[rhParam];
        if (value !== undefined && value !== null && setting.max !== null && setting.max !== undefined && value > setting.max) {
          alerts.push(`ECS alert in ${d.sensor_id}: ${rhParam.toUpperCase()} above maximum (${value}% > ${setting.max}%)`);
        }
      }
    });

    // Check air quality parameters for ECS
    ['pm1', 'pm25', 'pm10', 'avg_particle_size', 'nc0_5', 'nc1_0', 'nc2_5', 'nc10'].forEach(param => {
      const setting = alertSettings[`ecs_${param}`];
      const value = d[param];
      if (setting && setting.max !== null && setting.max !== undefined && value !== undefined && value !== null) {
        const unit = param.startsWith('nc') ? '/L' : (param.startsWith('avg') ? 'μm' : 'μg/m³');
        if (value > setting.max) {
          alerts.push(`ECS alert in ${d.sensor_id}: ${param.toUpperCase()} above maximum (${value} ${unit} > ${setting.max} ${unit})`);
        }
      }
    });
  });

  // Display alerts in both overview and monitor (if present)
  const containers = [];
  const c1 = document.getElementById('alerts-container');
  const c2 = document.getElementById('alerts-container-monitor');
  if (c1) containers.push(c1);
  if (c2) containers.push(c2);

  containers.forEach(container => {
    container.innerHTML = '';
    if (alerts.length > 0) {
      alerts.forEach(alert => {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert-banner';
        alertDiv.textContent = `🚨 ${alert}`;
        container.appendChild(alertDiv);
      });
    }
  });
}
