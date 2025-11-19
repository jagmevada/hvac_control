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

    const loadingElem = document.getElementById('loading');
    if (loadingElem) loadingElem.style.display = 'none';
    const loadingMonitor = document.getElementById('loading-monitor');
    if (loadingMonitor) loadingMonitor.style.display = 'none';
    document.getElementById('data-points').textContent = `Data Points: ${data.length}`;
    document.getElementById('last-update').textContent = `Last Update: ${new Date().toLocaleString()}`;
    
    displayData(data);
    if (window.checkAlerts) window.checkAlerts(data);
  } catch (error) {
    console.error("Fetch error:", error);
    showNotification('Failed to fetch sensor data', 'error');
  }
}

// Display sensor data in the UI (with modular card/modal/next event logic)
export function displayData(data) {
  const container = document.getElementById("sensor-container");
  const monitorContainer = document.getElementById("sensor-container-monitor");
  if (container) container.innerHTML = "";
  if (monitorContainer) monitorContainer.innerHTML = "";

  // Group data by sensor and get latest readings
  const latestBySensor = {};
  for (const row of data) {
    if (!latestBySensor[row.sensor_id]) {
      latestBySensor[row.sensor_id] = row;
    }
  }

  // Group ECS devices into two room containers
  const strongIds = ['ecs_1', 'ecs_3'];
  const smallIds = ['ecs_2'];

  const strongAvailable = strongIds.map(id => ({ id, data: latestBySensor[id] })).filter(x => x.data);
  const smallAvailable = smallIds.map(id => ({ id, data: latestBySensor[id] })).filter(x => x.data);

  if (strongAvailable.length === 0 && smallAvailable.length === 0) {
    container.innerHTML = '<div class="loading">No ECS data available yet.</div>';
    return;
  }

  // Build room sections first, then append clones into both containers
  const roomSections = [];
  function buildRoomSection(title, items) {
    if (!items || items.length === 0) return;
    const roomSection = document.createElement('div');
    roomSection.className = 'room-section';
    roomSection.innerHTML = `<h2 class="room-title">${title}</h2>`;
    const cardsGrid = document.createElement('div');
    cardsGrid.className = 'cards-grid';
    items.forEach(s => {
      const card = createSensorCard(s.id, s.data);
      cardsGrid.appendChild(card);
    });
    roomSection.appendChild(cardsGrid);
    roomSections.push(roomSection);
  }

  buildRoomSection('🛡️ Strong Room', strongAvailable);
  buildRoomSection('📦 Small Room', smallAvailable);

  // Append overview sections to main container only
  if (container) {
    roomSections.forEach(rs => container.appendChild(rs.cloneNode(true)));
  }

  // Build monitor-specific layout (do not change overview)
  if (monitorContainer) {
    // Helper to build a partial card showing only selected fields
    function createPartialCard(sensorId, data, options = {}) {
      const { showT1 = false, showRH1 = false, showT2 = false, showRH2 = false, showPM = false, showNC = false, includeControls = false, titleSuffix = '' } = options;
      const card = document.createElement('div');
      card.className = 'card';
      const iconClass = 'ecs-icon';
      const icon = '🌿';
      const deviceType = 'Environment Control System' + (titleSuffix ? ` • ${titleSuffix}` : '');

      let metricsHtml = '';
      if (showT1) {
        metricsHtml += `<div class="metric"><div class="metric-value">${data.t1 ?? '--'}°C</div><div class="metric-label">Temp 1</div></div>`;
      }
      if (showRH1) {
        metricsHtml += `<div class="metric"><div class="metric-value">${data.rh1 ?? '--'}%</div><div class="metric-label">RH 1</div></div>`;
      }
      if (showT2) {
        metricsHtml += `<div class="metric"><div class="metric-value">${data.t2 ?? '--'}°C</div><div class="metric-label">Temp 2</div></div>`;
      }
      if (showRH2) {
        metricsHtml += `<div class="metric"><div class="metric-value">${data.rh2 ?? '--'}%</div><div class="metric-label">RH 2</div></div>`;
      }
      if (showPM) {
        metricsHtml += `
          <div class="metric"><div class="metric-value">${data.pm1 ?? '--'}</div><div class="metric-label">PM1.0</div></div>
          <div class="metric"><div class="metric-value">${data.pm25 ?? '--'}</div><div class="metric-label">PM2.5</div></div>
          <div class="metric"><div class="metric-value">${data.pm10 ?? '--'}</div><div class="metric-label">PM10</div></div>
          <div class="metric"><div class="metric-value">${data.avg_particle_size ?? '--'} μm</div><div class="metric-label">Avg Particle Size</div></div>
        `;
      }
      if (showNC) {
        metricsHtml += `
          <div class="metric"><div class="metric-value">${data.nc0_5 ?? '--'} /L</div><div class="metric-label">NC 0.5</div></div>
          <div class="metric"><div class="metric-value">${data.nc1_0 ?? '--'} /L</div><div class="metric-label">NC 1.0</div></div>
          <div class="metric"><div class="metric-value">${data.nc2_5 ?? '--'} /L</div><div class="metric-label">NC 2.5</div></div>
          <div class="metric"><div class="metric-value">${data.nc10 ?? '--'} /L</div><div class="metric-label">NC 10</div></div>
        `;
      }

      let controlsHtml = '';
      if (includeControls) {
        controlsHtml += `
          <button class="control-btn ${data.relay1 ? 'on' : 'off'}" onclick="sendCommand('${sensorId}', 'relay1', ${!data.relay1})">Air Purifier: ${data.relay1 ? 'ON' : 'OFF'}</button>
          <button class="control-btn ${data.relay2 ? 'on' : 'off'}" onclick="sendCommand('${sensorId}', 'relay2', ${!data.relay2})">Dehumidifier: ${data.relay2 ? 'ON' : 'OFF'}</button>
        `;
      }

      card.innerHTML = `
        <div class="card-title">
          <div class="device-icon ${iconClass}">${icon}</div>
          <div>
            <div>${deviceType}</div>
            <div style="font-size: 0.9rem; font-weight: normal; color: #666;">${sensorId.toUpperCase()}</div>
          </div>
        </div>
        <div class="metrics-grid">${metricsHtml}</div>
        <div class="controls">${controlsHtml}</div>
        <div class="timestamp">Last Updated: ${new Date(data.timestamp).toLocaleString()}</div>
      `;
      return card;
    }

    // Build monitor layout according to user mapping
    // Strong Room: ecs_1 main (t1,rh1 + PM/NC)
    if (strongAvailable.length || smallAvailable.length) {
      // Strong Room Main (ecs_1 main)
      const strongMainSection = document.createElement('div');
      strongMainSection.className = 'room-section';
      strongMainSection.innerHTML = `<h2 class="room-title">🛡️ Strong Room</h2>`;
      const strongGrid = document.createElement('div'); strongGrid.className = 'cards-grid';
      const ecs1 = latestBySensor['ecs_1'];
      if (ecs1) strongGrid.appendChild(createPartialCard('ecs_1', ecs1, { showT1: true, showRH1: true, showPM: true, showNC: true }));
      strongMainSection.appendChild(strongGrid);
      monitorContainer.appendChild(strongMainSection);

      // Strong Room Control Room (ecs_1 t2/rh2 + controls)
      const strongCtrl = document.createElement('div'); strongCtrl.className = 'room-section';
      strongCtrl.innerHTML = `<h2 class="room-title">🛠️ Strong Room — Control Room</h2>`;
      const strongCtrlGrid = document.createElement('div'); strongCtrlGrid.className = 'cards-grid';
      if (ecs1) strongCtrlGrid.appendChild(createPartialCard('ecs_1', ecs1, { showT2: true, showRH2: true, includeControls: true, titleSuffix: 'Control' }));
      strongCtrl.appendChild(strongCtrlGrid);
      monitorContainer.appendChild(strongCtrl);

      // Strong Room Far End (ecs_3 main)
      const ecs3 = latestBySensor['ecs_3'];
      const strongFar = document.createElement('div'); strongFar.className = 'room-section';
      strongFar.innerHTML = `<h2 class="room-title">🛡️ Strong Room — Far End</h2>`;
      const strongFarGrid = document.createElement('div'); strongFarGrid.className = 'cards-grid';
      if (ecs3) strongFarGrid.appendChild(createPartialCard('ecs_3', ecs3, { showT1: true, showRH1: true, showPM: true, showNC: true, titleSuffix: 'Far End' }));
      strongFar.appendChild(strongFarGrid);
      monitorContainer.appendChild(strongFar);

      // Small Room Main (ecs_2 main)
      const smallMain = document.createElement('div'); smallMain.className = 'room-section';
      smallMain.innerHTML = `<h2 class="room-title">📦 Small Room</h2>`;
      const smallGrid = document.createElement('div'); smallGrid.className = 'cards-grid';
      const ecs2 = latestBySensor['ecs_2'];
      if (ecs2) smallGrid.appendChild(createPartialCard('ecs_2', ecs2, { showT1: true, showRH1: true, showPM: true, showNC: true }));
      smallMain.appendChild(smallGrid);
      monitorContainer.appendChild(smallMain);

      // Small Room Control Room (ecs_2 t2/rh2 + controls)
      const smallCtrl = document.createElement('div'); smallCtrl.className = 'room-section';
      smallCtrl.innerHTML = `<h2 class="room-title">🔧 Small Room — Control Room</h2>`;
      const smallCtrlGrid = document.createElement('div'); smallCtrlGrid.className = 'cards-grid';
      if (ecs2) smallCtrlGrid.appendChild(createPartialCard('ecs_2', ecs2, { showT2: true, showRH2: true, includeControls: true, titleSuffix: 'Control' }));
      smallCtrl.appendChild(smallCtrlGrid);
      monitorContainer.appendChild(smallCtrl);

      // Small Room Far End (ecs_3 t2/rh2)
      const smallFar = document.createElement('div'); smallFar.className = 'room-section';
      smallFar.innerHTML = `<h2 class="room-title">📦 Small Room — Far End</h2>`;
      const smallFarGrid = document.createElement('div'); smallFarGrid.className = 'cards-grid';
      if (ecs3) smallFarGrid.appendChild(createPartialCard('ecs_3', ecs3, { showT2: true, showRH2: true, titleSuffix: 'Far End' }));
      smallFar.appendChild(smallFarGrid);
      monitorContainer.appendChild(smallFar);
    }
  }
}

// Create a sensor card element for the dashboard
function createSensorCard(sensorId, d) {
  const isECS = sensorId.startsWith("ecs_");
  const card = document.createElement("div");
  card.className = "card";

  const deviceType = isECS ? "Environment Control System" : sensorId;
  const icon = isECS ? "🌿" : "⚙️";
  const iconClass = isECS ? "ecs-icon" : "";

  // Build metrics: two SHT35 sensors (t1/rh1, t2/rh2) and SPS30 PM fields
  let metricsHtml = `
    <div class="metric">
      <div class="metric-value">${d.t1 ?? '--'}°C</div>
      <div class="metric-label">Temp 1</div>
    </div>
    <div class="metric">
      <div class="metric-value">${d.rh1 ?? '--'}%</div>
      <div class="metric-label">RH 1</div>
    </div>
    <div class="metric">
      <div class="metric-value">${d.t2 ?? '--'}°C</div>
      <div class="metric-label">Temp 2</div>
    </div>
    <div class="metric">
      <div class="metric-value">${d.rh2 ?? '--'}%</div>
      <div class="metric-label">RH 2</div>
    </div>
  `;

  if (isECS) {
    metricsHtml += `
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
        <div class="metric-label">NC 0.5</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.nc1_0 ?? '--'} /L</div>
        <div class="metric-label">NC 1.0</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.nc2_5 ?? '--'} /L</div>
        <div class="metric-label">NC 2.5</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.nc10 ?? '--'} /L</div>
        <div class="metric-label">NC 10</div>
      </div>
    `;
  }

  // Controls: only the three ECS devices are controllable now
  let controlsHtml = '';
  const controllableIDs = ['ecs_1', 'ecs_2', 'ecs_3'];
  if (controllableIDs.includes(sensorId)) {
    controlsHtml += `
      <button class="control-btn ${d.relay1 ? 'on' : 'off'}" 
              onclick="sendCommand('${sensorId}', 'relay1', ${!d.relay1})">
        Air Purifier: ${d.relay1 ? 'ON' : 'OFF'}
      </button>
    `;
    controlsHtml += `
      <button class="control-btn ${d.relay2 ? 'on' : 'off'}" 
              onclick="sendCommand('${sensorId}', 'relay2', ${!d.relay2})">
        Dehumidifier: ${d.relay2 ? 'ON' : 'OFF'}
      </button>
    `;
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

// Modal for schedule (calendar icon)
function showScheduleModal(sensorId, sensorData) {
  // Remove existing modal if any
  const old = document.getElementById('device-detail-modal');
  if (old) old.remove();

  // Modal container
  const modal = document.createElement('div');
  modal.id = 'device-detail-modal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.background = 'rgba(0,0,0,0.45)';
  modal.style.zIndex = '9999';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  // Modal content
  const content = document.createElement('div');
  content.style.background = '#23272f';
  content.style.borderRadius = '18px';
  content.style.padding = '24px 8px 16px 8px';
  content.style.minWidth = '0';
  content.style.width = '95vw';
  content.style.maxWidth = '420px';
  content.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
  content.style.position = 'relative';

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '12px';
  closeBtn.style.right = '18px';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.fontSize = '2rem';
  closeBtn.style.color = '#fff';
  closeBtn.style.cursor = 'pointer';
  closeBtn.onclick = () => modal.remove();
  content.appendChild(closeBtn);

  // Title
  const title = document.createElement('h2');
  title.textContent = `${sensorId.toUpperCase()} Schedules`;
  title.style.marginBottom = '12px';
  title.style.color = '#fff';
  content.appendChild(title);


  // (No global time picker or repeat UI. Edit controls are shown only in per-schedule edit mode below.)

  // List of schedules (mock, with ON/OFF slider, time, days, and edit mode)
  const schedList = document.createElement('div');
  schedList.style.marginTop = '18px';
  // Title will be set in renderSchedules
  schedList.innerHTML = '';
  // Example mock data for two schedules (now mutable)
  let schedules = [];
  let nextId = 1;
  const dayShort = ['S','M','T','W','T','F','S'];

  // Helper: show delete confirmation
  function showDeleteConfirm(idx) {
    const confirmDiv = document.createElement('div');
    confirmDiv.style.position = 'fixed';
    confirmDiv.style.top = '0';
    confirmDiv.style.left = '0';
    confirmDiv.style.width = '100vw';
    confirmDiv.style.height = '100vh';
    confirmDiv.style.background = 'rgba(0,0,0,0.45)';
    confirmDiv.style.zIndex = '10000';
    confirmDiv.style.display = 'flex';
    confirmDiv.style.alignItems = 'center';
    confirmDiv.style.justifyContent = 'center';
    const box = document.createElement('div');
    box.style.background = '#23272f';
    box.style.borderRadius = '16px';
    box.style.padding = '32px 32px 24px 32px';
    box.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
    box.style.textAlign = 'center';
    box.innerHTML = `<div style="color:#fff;font-size:1.2em;margin-bottom:18px;">Delete this schedule?</div>`;
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.className = 'control-btn on';
    delBtn.style.margin = '0 12px';
    delBtn.onclick = () => {
      schedules.splice(idx, 1);
      confirmDiv.remove();
      renderSchedules();
    };
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'control-btn';
    cancelBtn.onclick = () => confirmDiv.remove();
    box.appendChild(delBtn);
    box.appendChild(cancelBtn);
    confirmDiv.appendChild(box);
    document.body.appendChild(confirmDiv);
  }

  // Long-press helper
  function addLongPressDelete(item, idx) {
    let pressTimer = null;
    item.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      pressTimer = setTimeout(() => showDeleteConfirm(idx), 700);
    });
    item.addEventListener('mouseup', () => clearTimeout(pressTimer));
    item.addEventListener('mouseleave', () => clearTimeout(pressTimer));
    // Touch events for mobile
    item.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(() => showDeleteConfirm(idx), 700);
    });
    item.addEventListener('touchend', () => clearTimeout(pressTimer));
    item.addEventListener('touchcancel', () => clearTimeout(pressTimer));
  }

  function renderSchedules() {
    // Remove previous title and items
    schedList.innerHTML = '';
    // Title logic
    const titleDiv = document.createElement('div');
    titleDiv.style.fontWeight = 'bold';
    titleDiv.style.fontSize = '1.08em';
    titleDiv.style.color = '#fff';
    titleDiv.style.marginBottom = '4px';
    if (schedules.length === 0) {
      titleDiv.textContent = 'No schedule';
    } else {
      titleDiv.textContent = 'Schedules';
    }
    schedList.appendChild(titleDiv);
    // Sort schedules by time (AM/PM, hour, minute)
    const ampmOrder = { 'AM': 0, 'PM': 1 };
    const sortedSchedules = schedules.slice().sort((a, b) => {
      // Compare AM/PM first
      if (ampmOrder[a.ampm] !== ampmOrder[b.ampm]) {
        return ampmOrder[a.ampm] - ampmOrder[b.ampm];
      }
      // Then hour (1-12)
      if (a.hour !== b.hour) {
        return a.hour - b.hour;
      }
      // Then minute
      return a.minute - b.minute;
    });
    // Render schedule items
    sortedSchedules.forEach((sched, idx) => {
      const item = document.createElement('div');
      item.className = 'sched-item';
      // Pill style, gray out if disabled
      const isDisabled = sched.enabled === false;
      item.style.background = isDisabled
        ? 'linear-gradient(90deg, #23242a 80%, #23242aEE 100%)'
        : 'linear-gradient(90deg, #353945 80%, #353945EE 100%)';
      item.style.borderRadius = '32px';
      item.style.margin = '12px 0';
      item.style.padding = '16px 20px 14px 20px';
      item.style.boxShadow = isDisabled
        ? '0 2px 8px rgba(0,0,0,0.08)'
        : '0 4px 16px rgba(0,0,0,0.10), 0 1.5px 4px rgba(86,171,47,0.08)';
      item.style.position = 'relative';
      item.style.display = 'flex';
      item.style.flexDirection = 'column';
      item.style.transition = 'box-shadow 0.2s, background 0.2s';
      item.style.opacity = isDisabled ? '0.55' : '1';
      item.style.pointerEvents = isDisabled ? 'auto' : 'auto'; // allow slider
      // Only allow interaction with enableBtn if disabled
      // We'll set pointer-events:none on all children except enableBtn if disabled
      // Add long-press to delete
      addLongPressDelete(item, idx);
      // Title row (time + ON/OFF + enable/disable switch)
      const titleRow = document.createElement('div');
      titleRow.style.display = 'flex';
      titleRow.style.alignItems = 'center';
      titleRow.style.justifyContent = 'space-between';
      // Time + ON/OFF display
      const timeDiv = document.createElement('div');
      const timeStr = `${sched.hour.toString().padStart(2,'0')}:${sched.minute.toString().padStart(2,'0')} ${sched.ampm}`;
      timeDiv.innerHTML = `<span style="font-weight:600;cursor:pointer;">${timeStr}</span> <span style="margin-left:10px;padding:2px 12px;border-radius:12px;font-size:0.95em;font-weight:600;background:${sched.state ? '#56ab2f':'#ff6b6b'};color:#fff;">${sched.state ? 'ON' : 'OFF'}</span>`;
      timeDiv.style.fontSize = '1.25em';
      timeDiv.style.fontWeight = '600';
      timeDiv.style.color = '#fff';
      // Only the time (not ON/OFF) is clickable for edit
      if (!isDisabled) {
        timeDiv.querySelector('span').onclick = (e) => {
          e.stopPropagation();
          showEditScheduleModal(idx);
        };
      } else {
        timeDiv.querySelector('span').style.cursor = 'not-allowed';
      }
      // Enable/disable switch (right side) - use a button for reliability
      const enableBtn = document.createElement('button');
      enableBtn.type = 'button';
      enableBtn.setAttribute('aria-label', sched.enabled !== false ? 'Disable schedule' : 'Enable schedule');
      enableBtn.style.display = 'inline-block';
      enableBtn.style.width = '44px';
      enableBtn.style.height = '24px';
      enableBtn.style.marginLeft = '12px';
      enableBtn.style.position = 'relative';
      enableBtn.style.background = 'none';
      enableBtn.style.border = 'none';
      enableBtn.style.padding = '0';
      enableBtn.style.cursor = 'pointer';
      enableBtn.innerHTML = `
        <span class="slider" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:${sched.enabled !== false ? '#56ab2f' : '#181a20'};border-radius:24px;transition:.4s;width:44px;height:24px;"></span>
        <span class="knob" style="position:absolute;height:20px;width:20px;left:${sched.enabled !== false ? '22px' : '2px'};top:2px;background:#fff;border-radius:50%;transition:.4s;"></span>
      `;
      enableBtn.onclick = (e) => {
        e.stopPropagation();
        sched.enabled = !(sched.enabled !== false);
        renderSchedules();
      };
      // If disabled, make only enableBtn interactive
      if (isDisabled) {
        timeDiv.style.pointerEvents = 'none';
        titleRow.style.pointerEvents = 'none';
        item.style.pointerEvents = 'auto';
        enableBtn.style.pointerEvents = 'auto';
      }
      titleRow.appendChild(timeDiv);
      titleRow.appendChild(enableBtn);
      item.appendChild(titleRow);
      // Days row
      const daysRow = document.createElement('div');
      daysRow.style.marginTop = '8px';
      daysRow.style.display = 'flex';
      daysRow.style.gap = '6px';
      daysRow.style.fontSize = '1em';
      daysRow.style.color = '#fff';
      if (sched.days.length === 7) {
        daysRow.innerHTML = '<span style="color:#56ab2f;font-weight:500;">Everyday</span>';
      } else {
        dayShort.forEach((d, i) => {
          const pill = document.createElement('span');
          pill.textContent = d;
          pill.style.padding = '3px 10px';
          pill.style.borderRadius = '12px';
          pill.style.background = sched.days.includes(i) ? '#56ab2f' : '#353945';
          pill.style.color = '#fff';
          pill.style.fontWeight = sched.days.includes(i) ? '600' : '400';
          daysRow.appendChild(pill);
        });
      }
      // If disabled, gray out days row and make not interactive
      if (isDisabled) {
        daysRow.style.opacity = '0.7';
        daysRow.style.pointerEvents = 'none';
      }
      item.appendChild(daysRow);
      schedList.appendChild(item);
    });
  }
  renderSchedules();
  content.appendChild(schedList);

  // Edit modal for a schedule
  function showEditScheduleModal(idx) {
    const sched = schedules[idx];
    // Remove any existing edit modal
    const oldEdit = document.getElementById('edit-schedule-modal');
    if (oldEdit) oldEdit.remove();
    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'edit-schedule-modal';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.45)';
    overlay.style.zIndex = '10001';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    // Modal content
    const box = document.createElement('div');
    box.style.background = '#23272f';
    box.style.borderRadius = '18px';
    box.style.padding = '24px 8px 16px 8px';
    box.style.minWidth = '0';
    box.style.width = '95vw';
    box.style.maxWidth = '420px';
    box.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
    box.style.position = 'relative';
    // Title
    const title = document.createElement('h2');
    title.textContent = 'Edit Schedule';
    title.style.marginBottom = '12px';
    title.style.color = '#fff';
    box.appendChild(title);
    // Edit controls: group into rows
    const row1 = document.createElement('div');
    row1.style.display = 'flex';
    row1.style.alignItems = 'center';
    row1.style.gap = '12px';
    row1.style.marginBottom = '12px';
    // ON/OFF toggle
    const stateToggle = document.createElement('button');
    stateToggle.type = 'button';
    stateToggle.textContent = sched.state ? 'ON' : 'OFF';
    stateToggle.className = sched.state ? 'control-btn on' : 'control-btn off';
    stateToggle.onclick = (e) => {
      e.preventDefault();
      sched.state = !sched.state;
      stateToggle.textContent = sched.state ? 'ON' : 'OFF';
      stateToggle.className = sched.state ? 'control-btn on' : 'control-btn off';
    };
    // Hour
    const hh = document.createElement('select');
    hh.style.cssText = 'font-size:1.5em;padding:10px 18px;border-radius:16px;border:1.5px solid #444;background:#23272f;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.10);outline:none;appearance:none;';
    for (let i=1; i<=12; ++i) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i.toString().padStart(2,'0');
      if (i === sched.hour) opt.selected = true;
      hh.appendChild(opt);
    }
    // Minute
    const mm = document.createElement('select');
    mm.style.cssText = 'font-size:1.5em;padding:10px 18px;border-radius:16px;border:1.5px solid #444;background:#23272f;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.10);outline:none;appearance:none;';
    [0,5,10,15,20,25,30,35,40,45,50,55].forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m.toString().padStart(2,'0');
      if (m === sched.minute) opt.selected = true;
      mm.appendChild(opt);
    });
    // AM/PM
    const ampmDiv = document.createElement('div');
    ampmDiv.style.display = 'flex';
    ampmDiv.style.flexDirection = 'column';
    ampmDiv.style.gap = '6px';
    ampmDiv.style.marginLeft = '8px';
    const amBtn = document.createElement('button');
    amBtn.type = 'button';
    amBtn.textContent = 'AM';
    amBtn.className = 'ampm-pill';
    amBtn.style.cssText = 'border:none;border-radius:16px;padding:6px 18px;background:'+(sched.ampm==='AM'?'#56ab2f':'#353945')+';color:#fff;font-weight:500;cursor:pointer;transition:background 0.2s;';
    if (sched.ampm === 'AM') amBtn.classList.add('active');
    const pmBtn = document.createElement('button');
    pmBtn.type = 'button';
    pmBtn.textContent = 'PM';
    pmBtn.className = 'ampm-pill';
    pmBtn.style.cssText = 'border:none;border-radius:16px;padding:6px 18px;background:'+(sched.ampm==='PM'?'#56ab2f':'#353945')+';color:#fff;font-weight:500;cursor:pointer;transition:background 0.2s;';
    if (sched.ampm === 'PM') pmBtn.classList.add('active');
    amBtn.onclick = (e) => { e.preventDefault(); sched.ampm = 'AM'; amBtn.classList.add('active'); amBtn.style.background = '#56ab2f'; pmBtn.classList.remove('active'); pmBtn.style.background = '#353945'; };
    pmBtn.onclick = (e) => { e.preventDefault(); sched.ampm = 'PM'; pmBtn.classList.add('active'); pmBtn.style.background = '#56ab2f'; amBtn.classList.remove('active'); amBtn.style.background = '#353945'; };
    ampmDiv.appendChild(amBtn);
    ampmDiv.appendChild(pmBtn);
    row1.appendChild(stateToggle);
    row1.appendChild(hh);
    row1.appendChild(mm);
    row1.appendChild(ampmDiv);

    // Row 2: Days selector
    const row2 = document.createElement('div');
    row2.style.display = 'flex';
    row2.style.gap = '6px';
    row2.style.margin = '12px 0 12px 0';
    dayShort.forEach((d, i) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.textContent = d;
      pill.style.padding = '3px 10px';
      pill.style.borderRadius = '12px';
      pill.style.background = sched.days.includes(i) ? '#56ab2f' : '#353945';
      pill.style.color = '#fff';
      pill.style.fontWeight = sched.days.includes(i) ? '600' : '400';
      pill.onclick = (e) => {
        e.preventDefault();
        if (sched.days.includes(i)) {
          sched.days = sched.days.filter(x => x !== i);
        } else {
          sched.days.push(i);
          sched.days.sort();
        }
        // Update UI immediately
        pill.style.background = sched.days.includes(i) ? '#56ab2f' : '#353945';
        pill.style.fontWeight = sched.days.includes(i) ? '600' : '400';
      };
      row2.appendChild(pill);
    });

    // Row 3: Save/Cancel
    const row3 = document.createElement('div');
    row3.style.display = 'flex';
    row3.style.gap = '12px';
    row3.style.marginTop = '8px';
    // Save/cancel buttons
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save';
    saveBtn.className = 'control-btn on';
    saveBtn.onclick = () => {
      sched.hour = parseInt(hh.value);
      sched.minute = parseInt(mm.value);
      // ampm, state, days already updated
      overlay.remove();
      renderSchedules();
    };
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'control-btn';
    cancelBtn.onclick = () => {
      // If this is a new (unsaved) schedule, remove it
      if (sched.id === -1) {
        schedules.splice(idx, 1);
      }
      overlay.remove();
      renderSchedules();
    };
    row3.appendChild(saveBtn);
    row3.appendChild(cancelBtn);

    // Add all rows to box
    box.appendChild(row1);
    box.appendChild(row2);
    box.appendChild(row3);
    // Close button (top right)
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '12px';
    closeBtn.style.right = '18px';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '2rem';
    closeBtn.style.color = '#fff';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => {
      if (sched.id === -1) {
        schedules.splice(idx, 1);
      }
      overlay.remove();
      renderSchedules();
    };
    box.appendChild(closeBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }


  // Top-right + button beside close (x)
  const addBtn = document.createElement('button');
  addBtn.title = 'Add Schedule';
  addBtn.innerHTML = '<span style="font-size:1.7em;line-height:1;">＋</span>';
  addBtn.style.position = 'absolute';
  addBtn.style.top = '12px';
  addBtn.style.right = '54px';
  addBtn.style.width = '40px';
  addBtn.style.height = '40px';
  addBtn.style.borderRadius = '50%';
  addBtn.style.background = '#56ab2f';
  addBtn.style.color = '#fff';
  addBtn.style.border = 'none';
  addBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
  addBtn.style.zIndex = '1001';
  addBtn.style.cursor = 'pointer';
  addBtn.style.display = 'flex';
  addBtn.style.alignItems = 'center';
  addBtn.style.justifyContent = 'center';
  addBtn.onmouseenter = () => addBtn.style.background = '#6fdc4b';
  addBtn.onmouseleave = () => addBtn.style.background = '#56ab2f';
  addBtn.onclick = () => {
    // Allow adding multiple schedules (editing is now in a separate modal)
    schedules.push({
      id: -1,
      state: true, // ON/OFF action for IoT
      enabled: true, // schedule enabled by default
      hour: 8,
      minute: 0,
      ampm: 'AM',
      days: [1,2,3,4,5,6,0]
    });
    renderSchedules();
    // Immediately open the edit modal for the new schedule
    showEditScheduleModal(schedules.length - 1);
  };
  content.appendChild(addBtn);

  // When modal closes, no need to remove addBtn (it's inside content)
  closeBtn.onclick = () => {
    modal.remove();
  };

  modal.appendChild(content);
  document.body.appendChild(modal);
}

// Modal for timer (clock icon)
function showTimerModal(sensorId, sensorData) {
  // Remove existing modal if any
  const old = document.getElementById('device-detail-modal');
  if (old) old.remove();

  // Modal container
  const modal = document.createElement('div');
  modal.id = 'device-detail-modal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.background = 'rgba(0,0,0,0.45)';
  modal.style.zIndex = '9999';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  // Modal content
  const content = document.createElement('div');
  content.style.background = '#23272f';
  content.style.borderRadius = '18px';
  content.style.padding = '32px 28px 24px 28px';
  content.style.minWidth = '340px';
  content.style.maxWidth = '95vw';
  content.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
  content.style.position = 'relative';

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '12px';
  closeBtn.style.right = '18px';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.fontSize = '2rem';
  closeBtn.style.color = '#fff';
  closeBtn.style.cursor = 'pointer';
  closeBtn.onclick = () => modal.remove();
  content.appendChild(closeBtn);

  // Title
  const title = document.createElement('h2');
  title.textContent = `${sensorId.toUpperCase()} Timers`;
  title.style.marginBottom = '12px';
  title.style.color = '#fff';
  content.appendChild(title);

  // Timer form with Android-style hour/minute pickers
  const timerForm = document.createElement('form');
  timerForm.style.marginBottom = '18px';
  timerForm.style.display = 'flex';
  timerForm.style.flexDirection = 'column';
  timerForm.style.alignItems = 'flex-start';
  timerForm.innerHTML = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:18px;justify-content:center;width:100%;">
      <span style="font-size:1.1em;color:#ccc;">Duration:</span>
      <select id="timer-hh" style="font-size:1.5em;padding:10px 18px;border-radius:16px;border:1.5px solid #444;background:#23272f;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.10);margin:0 4px 0 0;outline:none;appearance:none;">
        ${Array.from({length:12},(_,i)=>`<option value="${i+1}">${(i+1).toString().padStart(2,'0')}</option>`).join('')}
      </select>
      <span style="font-size:1.2em;color:#aaa;">h</span>
      <select id="timer-mm" style="font-size:1.5em;padding:10px 18px;border-radius:16px;border:1.5px solid #444;background:#23272f;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.10);margin:0 4px 0 0;outline:none;appearance:none;">
        ${[0,5,10,15,20,25,30,35,40,45,50,55].map(i=>`<option value="${i}">${i.toString().padStart(2,'0')}</option>`).join('')}
      </select>
      <span style="font-size:1.2em;color:#aaa;">m</span>
      <div id="timer-ampm" style="display:flex;flex-direction:column;gap:6px;margin-left:12px;">
        <button type="button" class="ampm-pill am active" style="border:none;border-radius:16px;padding:6px 18px;background:#56ab2f;color:#fff;font-weight:500;cursor:pointer;transition:background 0.2s;">AM</button>
        <button type="button" class="ampm-pill pm" style="border:none;border-radius:16px;padding:6px 18px;background:#353945;color:#fff;font-weight:500;cursor:pointer;transition:background 0.2s;">PM</button>
      </div>
    </div>
    <button type="submit" class="control-btn on" style="align-self:center;min-width:140px;font-size:1.1em;">Start Timer</button>
  `;
  // AM/PM pill logic
  const timerAmBtn = timerForm.querySelector('.ampm-pill.am');
  const timerPmBtn = timerForm.querySelector('.ampm-pill.pm');
  let timerAmPm = 'AM';
  timerAmBtn.onclick = (e) => {
    e.preventDefault();
    timerAmBtn.classList.add('active');
    timerAmBtn.style.background = '#56ab2f';
    timerPmBtn.classList.remove('active');
    timerPmBtn.style.background = '#353945';
    timerAmPm = 'AM';
  };
  timerPmBtn.onclick = (e) => {
    e.preventDefault();
    timerPmBtn.classList.add('active');
    timerPmBtn.style.background = '#56ab2f';
    timerAmBtn.classList.remove('active');
    timerAmBtn.style.background = '#353945';
    timerAmPm = 'PM';
  };
  content.appendChild(timerForm);

  // List of timers (mock)
  const timerList = document.createElement('div');
  timerList.style.marginTop = '18px';
  timerList.innerHTML = '<b>Current Timers:</b><ul style="margin-top:8px;">'
    + '<li>ON at 21/07/25 08:30 (Timer)</li>'
    + '</ul>';
  content.appendChild(timerList);

  modal.appendChild(content);
  document.body.appendChild(modal);
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
