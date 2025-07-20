// sensors.js
// Functions for fetching and displaying sensor data, and sending commands

// Fetch sensor data from Supabase and update the UI
export async function fetchSensorData() {
  try {
    const { data, error } = await window.supabase
      .from('sensor_data')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(200);

    if (error) throw error;

    document.getElementById('loading').style.display = 'none';
    document.getElementById('data-points').textContent = `Data Points: ${data.length}`;
    document.getElementById('last-update').textContent = `Last Update: ${new Date().toLocaleString()}`;
    
    displayData(data);
    if (window.checkAlerts) window.checkAlerts(data);
  } catch (error) {
    console.error("Fetch error:", error);
    showNotification('Failed to fetch sensor data', 'error');
  }
}

// Display sensor data in the UI
export function displayData(data) {
  const container = document.getElementById("sensor-container");
  container.innerHTML = "";

  // Group data by sensor and get latest readings
  const latestBySensor = {};
  for (const row of data) {
    if (!latestBySensor[row.sensor_id]) {
      latestBySensor[row.sensor_id] = row;
    }
  }

  // Group by rooms and sort sensors by their IDs
  const rooms = { r1: {}, r2: {} };
  Object.entries(latestBySensor).forEach(([sensorId, data]) => {
    const room = sensorId.includes('_r1') ? 'r1' : 'r2';
    rooms[room][sensorId] = data;
  });

  // Display each room
  Object.entries(rooms).forEach(([roomId, sensors]) => {
    if (Object.keys(sensors).length === 0) return;

    const roomSection = document.createElement('div');
    roomSection.className = 'room-section';
    roomSection.innerHTML = `<h2 class="room-title">🏠 Clean Room ${roomId.toUpperCase()}</h2>`;
    
    const cardsGrid = document.createElement('div');
    cardsGrid.className = 'cards-grid';

    // Create cards in sorted order
    Object.keys(sensors).sort().forEach(sensorId => {
      const card = createSensorCard(sensorId, sensors[sensorId]);
      cardsGrid.appendChild(card);
    });

    roomSection.appendChild(cardsGrid);
    container.appendChild(roomSection);
  });
}

// Create a sensor card element for the dashboard
function createSensorCard(sensorId, d) {
  const isECS = sensorId.startsWith("ecs_");
  const isAC1 = sensorId.startsWith("ac1_");
  const isAC2 = sensorId.startsWith("ac2_");
  
  const card = document.createElement("div");
  card.className = "card";

  let deviceType = isECS ? "Environment Control System" : 
                  isAC1 ? "Air Conditioner 1" : "Air Conditioner 2";
  let icon = isECS ? "🌿" : "❄️";
  let iconClass = isECS ? "ecs-icon" : "ac-icon";

  let metricsHtml = '';
  
  // Temperature readings with renamed labels
  metricsHtml += `
    <div class="metric">
      <div class="metric-value">${d.t1 ?? '--'}°C</div>
      <div class="metric-label">${isECS ? 'Ambient 1' : 'Cool Vent'}</div>
    </div>
    <div class="metric">
      <div class="metric-value">${d.t2 ?? '--'}°C</div>
      <div class="metric-label">${isECS ? 'Ambient 2' : 'Motor Heat'}</div>
    </div>
  `;

  // Additional metrics for ECS
  if (isECS) {
    metricsHtml += `
      <div class="metric">
        <div class="metric-value">${d.rh ?? '--'}%</div>
        <div class="metric-label">Humidity</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.pm1 ?? '--'}</div>
        <div class="metric-label">PM1.0</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.pm25 ?? '--'}</div>
        <div class="metric-label">PM2.5</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.pm10 ?? '--'}</div>
        <div class="metric-label">PM10</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.avg_particle_size ?? '--'} μm</div>
        <div class="metric-label">Avg Particle Size</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.nc0_5 ?? '--'} /L</div>
        <div class="metric-label">Particles (0.5-1.0 μm)</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.nc1_0 ?? '--'} /L</div>
        <div class="metric-label">Particles (1.0-2.5 μm)</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.nc2_5 ?? '--'} /L</div>
        <div class="metric-label">Particles (2.5-10 μm)</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.nc10 ?? '--'} /L</div>
        <div class="metric-label">Particles (>10 μm)</div>
      </div>
    `;
  }

  // Control buttons
  let controlsHtml = '';
  const controllableIDs = [
    "ac1_r1", "ac2_r1", "ecs_r1",
    "ac1_r2", "ac2_r2", "ecs_r2"
  ];

  if (controllableIDs.includes(sensorId)) {
    controlsHtml += `
      <button class="control-btn ${d.relay1 ? 'on' : 'off'}" 
              onclick="sendCommand('${sensorId}', 'relay1', ${!d.relay1})">
        ${isECS ? 'Air Purifier' : 'AC Unit'}: ${d.relay1 ? 'ON' : 'OFF'}
      </button>
    `;
    
    if (isECS) {
      controlsHtml += `
        <button class="control-btn ${d.relay2 ? 'on' : 'off'}" 
                onclick="sendCommand('${sensorId}', 'relay2', ${!d.relay2})">
          Dehumidifier: ${d.relay2 ? 'ON' : 'OFF'}
        </button>
      `;
    }
  }

  card.innerHTML = `
    <div class="card-title">
      <div class="device-icon ${iconClass}">${icon}</div>
      <div>
        <div>${deviceType}</div>
        <div style="font-size: 0.9rem; font-weight: normal; color: #666;">
          ${sensorId.toUpperCase()}
        </div>
      </div>
    </div>
    <div class="metrics-grid">
      ${metricsHtml}
    </div>
    <div class="controls">
      ${controlsHtml}
    </div>
    <div class="timestamp">
      Last Updated: ${new Date(d.timestamp).toLocaleString()}
    </div>
  `;
  return card;
}

// Show notification banner
export function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.className = `alert-banner ${type}`;
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.zIndex = '1000';
  notification.style.minWidth = '300px';
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Send command to Supabase (for control buttons)
export async function sendCommand(sensor_id, target, state) {
  try {
    const { error } = await window.supabase.from("commands").insert([
      {
        sensor_id: sensor_id,
        target: target,
        state: state,
        issued_at: new Date().toISOString()
      }
    ]);

    if (error) throw error;
    
    showNotification(`✅ Command sent: ${sensor_id} → ${target} = ${state ? 'ON' : 'OFF'}`, 'success');
    setTimeout(fetchSensorData, 1000);
  } catch (error) {
    showNotification(`❌ Failed to send command: ${error.message}`, 'error');
  }
}

// Make sendCommand and showNotification globally accessible for inline event handlers
window.sendCommand = sendCommand;
window.showNotification = showNotification;
