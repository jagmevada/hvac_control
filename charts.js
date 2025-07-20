// charts.js
// Functions for chart rendering and data processing

let chart = null;

// Fetch chart data from Supabase and update the chart
export async function fetchChartData(room, metric, period) {
  try {
    // Choose table based on time period
    let table = 'sensor_data';
    if (period === '24h') table = 'avg_10min';
    else if (period === '7d') table = 'avg_1hr';
    else if (period === '30d') table = 'avg_4hr';
    else if (period === '1y') table = 'avg_1day';

    // Calculate start timestamp
    let hours = 1;
    if (period === '24h') hours = 24;
    else if (period === '7d') hours = 168;
    else if (period === '30d') hours = 720;
    else if (period === '1y') hours = 8760;

    const since = new Date(Date.now() - hours * 3600000).toISOString();

    // Query Supabase
    const { data, error } = await window.supabase
      .from(table)
      .select('*')
      .gte('timestamp', since)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    // Filter by room
    const filteredData = room === 'all'
      ? data
      : data.filter(d => d.sensor_id.includes(`_${room}`));

    const chartData = processChartData(filteredData, metric, period);
    updateChartDisplay(chartData, metric, period);
    // Show last update time for chart
    let chartUpdateElem = document.getElementById('chart-last-update');
    if (!chartUpdateElem) {
      chartUpdateElem = document.createElement('div');
      chartUpdateElem.id = 'chart-last-update';
      chartUpdateElem.style.textAlign = 'center';
      chartUpdateElem.style.color = '#888';
      chartUpdateElem.style.fontSize = '0.95rem';
      const chartContainer = document.querySelector('#analytics-tab .chart-container');
      if (chartContainer) chartContainer.appendChild(chartUpdateElem);
    }
    chartUpdateElem.textContent = `Last Chart Update: ${new Date().toLocaleString()}`;
  } catch (error) {
    console.error("Chart data fetch error:", error);
  }
}

// Process chart data for Chart.js
export function processChartData(data, metric, period) {
  const processed = {};
  const isAggregated = period !== '1h';

  data.forEach(row => {
    const ts = new Date(row.timestamp);
    let time;

    if (period === '1h' || period === '24h') {
      time = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (period === '7d' || period === '30d') {
      const date = ts.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
      const clock = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      time = `${date} ${clock}`;
    } else if (period === '1y') {
      time = ts.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    } else {
      time = ts.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    }

    if (!processed[time]) processed[time] = {};

    const sensor = row.sensor_id;
    if (!processed[time][sensor]) processed[time][sensor] = {};

    if (isAggregated) {
      processed[time][sensor] = {
        t1: row.t1,
        t1_min: row.t1_min,
        t1_max: row.t1_max,
        t2: row.t2,
        t2_min: row.t2_min,
        t2_max: row.t2_max,
        rh: row.rh,
        rh_min: row.rh_min,
        rh_max: row.rh_max,
        pm1: row.pm1,
        pm1_min: row.pm1_min,
        pm1_max: row.pm1_max,
        pm25: row.pm25,
        pm25_min: row.pm25_min,
        pm25_max: row.pm25_max,
        pm10: row.pm10,
        pm10_min: row.pm10_min,
        pm10_max: row.pm10_max,
        avg_particle_size: row.avg_particle_size,
        nc0_5: row.nc0_5,
        nc1_0: row.nc1_0,
        nc2_5: row.nc2_5,
        nc10: row.nc10
      };
    } else {
      processed[time][sensor] = {
        t1: row.t1,
        t2: row.t2,
        rh: row.rh,
        pm1: row.pm1,
        pm25: row.pm25,
        pm10: row.pm10,
        avg_particle_size: row.avg_particle_size,
        nc0_5: row.nc0_5,
        nc1_0: row.nc1_0,
        nc2_5: row.nc2_5,
        nc10: row.nc10
      };
    }
  });

  return processed;
}

// Update the Chart.js chart with new data
export function updateChartDisplay(data, metric, period) {
  const ctx = document.getElementById('dataChart').getContext('2d');
  if (chart) chart.destroy();

  const room = document.getElementById('chart-room').value;
  const labels = Object.keys(data);
  const datasets = [];
  const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
  let colorIndex = 0;

  const sensors = new Set();
  Object.values(data).forEach(timeData => {
    Object.keys(timeData).forEach(sensor => {
      if (room === 'all' || sensor.includes(`_${room}`)) {
        sensors.add(sensor);
      }
    });
  });

  const useMinMax = period !== '1h';

  const plottedPM = new Set();
  const plottedNC = new Set();
  const plottedAVG = new Set();

  sensors.forEach(sensor => {
    const labelSuffix = sensor.toUpperCase().endsWith('_R1') ? '_R1' : '_R2';
    const color = colors[colorIndex % colors.length];

    // Common dataset options for all lines: very small point markers
    const commonOptions = { fill: false, tension: 0.3, pointRadius: 2 };

    if (metric === 'ac_temp' && (sensor.startsWith('ac1_') || sensor.startsWith('ac2_'))) {
      const acId = sensor.split('_')[0].toUpperCase(); // "AC1" or "AC2"
      const t1 = labels.map(time => data[time][sensor]?.t1 ?? null);
      const t2 = labels.map(time => data[time][sensor]?.t2 ?? null);
      // Vent temperature (left axis)
      datasets.push({ label: `${acId} Vent${labelSuffix}`, data: t1, borderColor: color, backgroundColor: color + '20', yAxisID: 'y', ...commonOptions });
      // Motor temperature (right axis)
      datasets.push({ label: `${acId} Motor${labelSuffix}`, data: t2, borderColor: colors[(colorIndex + 1) % colors.length], backgroundColor: colors[(colorIndex + 1) % colors.length] + '20', yAxisID: 'y1', ...commonOptions });
      colorIndex++;
      return;
    }

    if (metric === 'room_temp_rh' && sensor.startsWith('ecs_')) {
      const t1 = labels.map(time => data[time][sensor]?.t1 ?? null);
      const t2 = labels.map(time => data[time][sensor]?.t2 ?? null);
      const rh = labels.map(time => data[time][sensor]?.rh ?? null);
      // Temperature lines (left y-axis)
      datasets.push({ label: `Room Temp 1${labelSuffix}`, data: t1, borderColor: color, backgroundColor: color + '20', yAxisID: 'y', ...commonOptions });
      datasets.push({ label: `Room Temp 2${labelSuffix}`, data: t2, borderColor: colors[(colorIndex + 1) % colors.length], backgroundColor: colors[(colorIndex + 1) % colors.length] + '20', yAxisID: 'y', ...commonOptions });
      // Humidity line (right y-axis)
      datasets.push({ label: `Humidity${labelSuffix}`, data: rh, borderColor: colors[(colorIndex + 2) % colors.length], backgroundColor: colors[(colorIndex + 2) % colors.length] + '20', yAxisID: 'y1', ...commonOptions });
      colorIndex++;
      return;
    }

    if (metric === 'pm' && sensor.startsWith('ecs_') && !plottedPM.has(sensor)) {
      ['pm1', 'pm25', 'pm10'].forEach((key, i) => {
        const colorX = colors[(colorIndex + i) % colors.length];
        datasets.push({ label: `${key.toUpperCase()}${labelSuffix}`, data: labels.map(t => data[t][sensor]?.[key] ?? null), borderColor: colorX, backgroundColor: colorX + '20', ...commonOptions });
      });
      plottedPM.add(sensor);
      colorIndex++;
      return;
    }

    if (metric === 'nc' && sensor.startsWith('ecs_') && !plottedNC.has(sensor)) {
      ['nc0_5', 'nc1_0', 'nc2_5', 'nc10'].forEach((key, i) => {
        const colorX = colors[(colorIndex + i) % colors.length];
        datasets.push({ label: `${key.toUpperCase()}${labelSuffix}`, data: labels.map(t => data[t][sensor]?.[key] ?? null), borderColor: colorX, backgroundColor: colorX + '20', ...commonOptions });
      });
      plottedNC.add(sensor);
      colorIndex++;
      return;
    }

    if (metric === 'avg_particle_size' && sensor.startsWith('ecs_') && !plottedAVG.has(sensor)) {
      const avg = labels.map(t => data[t][sensor]?.avg_particle_size ?? null);
      datasets.push({ label: `Avg Particle Size${labelSuffix}`, data: avg, borderColor: color, backgroundColor: color + '20', ...commonOptions });
      plottedAVG.add(sensor);
      colorIndex++;
      return;
    }
  });

  // Helper to prettify period
  function prettyPeriod(p) {
    switch (p) {
      case '1h': return 'Last 1 Hour';
      case '24h': return 'Last 24 Hours';
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      case '1y': return 'Last 1 Year';
      default: return p;
    }
  }

  // Helper to prettify metric
  function prettyMetric(m, room) {
    switch (m) {
      case 'ac_temp':
        if (room === 'r1') return 'Room 1 AC Vent & Motor Temp (°C)';
        if (room === 'r2') return 'Room 2 AC Vent & Motor Temp (°C)';
        return 'AC Vent & Motor Temp (°C)';
      case 'room_temp_rh':
        if (room === 'r1') return 'Room 1 Temperature & Humidity (°C, %)';
        if (room === 'r2') return 'Room 2 Temperature & Humidity (°C, %)';
        return 'Room Temperature & Humidity (°C, %)';
      case 'pm':
        return 'Particulate Matter (PM1.0/2.5/10) (μg/m³)';
      case 'nc':
        return 'Particle Count (NC0.5/1.0/2.5/10) (/L)';
      case 'avg_particle_size':
        return 'Average Particle Size (μm)';
      default:
        return m;
    }
  }

  const chartTitle = `${prettyMetric(metric, room)} — ${prettyPeriod(period)}`;

  // Chart.js options with dual y-axes for temperature & humidity
  let chartOptions = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: chartTitle,
        color: '#fff',
        font: {
          size: 18,
          weight: 'bold',
          family: 'Montserrat, Inter, Segoe UI, Arial, sans-serif'
        }
      },
      legend: {
        display: true,
        position: 'right'
      }
    },
    scales: {
      y: {
        beginAtZero: metric.includes('pm') || metric === 'nc',
        title: {
          display: true,
          text: getUnitForMetric(metric),
          color: '#fff'
        },
        ticks: {
          color: '#fff'
        },
        grid: {
          color: 'rgba(255,255,255,0.12)'
        }
      },
      x: {
        title: {
          display: false,
          color: '#fff'
        },
        ticks: {
          color: '#fff'
        },
        grid: {
          color: 'rgba(255,255,255,0.12)'
        }
      }
    }
  };

  // If temperature & humidity, set dual y-axes
  if (metric === 'room_temp_rh') {
    chartOptions.scales = {
      y: {
        type: 'linear',
        position: 'left',
        min: 20,
        max: 40,
        title: {
          display: true,
          text: 'Temperature (°C)',
          color: '#fff'
        },
        ticks: {
          color: '#fff',
          stepSize: 2
        },
        grid: {
          color: 'rgba(255,255,255,0.12)'
        }
      },
      y1: {
        type: 'linear',
        position: 'right',
        min: 20,
        max: 80,
        title: {
          display: true,
          text: 'Humidity (RH%)',
          color: '#fff'
        },
        ticks: {
          color: '#fff',
          stepSize: 10
        },
        grid: {
          drawOnChartArea: false
        }
      },
      x: {
        title: {
          display: false,
          color: '#fff'
        },
        ticks: {
          color: '#fff'
        },
        grid: {
          color: 'rgba(255,255,255,0.12)'
        }
      }
    };
  }

  // For AC vent and motor temperature, set dual y-axes with custom ranges
  if (metric === 'ac_temp') {
    chartOptions.scales = {
      y: {
        type: 'linear',
        position: 'left',
        min: 0,
        max: 40,
        title: {
          display: true,
          text: 'Vent Temperature (°C)',
          color: '#fff'
        },
        ticks: {
          color: '#fff',
          stepSize: 5
        },
        grid: {
          color: 'rgba(255,255,255,0.12)'
        }
      },
      y1: {
        type: 'linear',
        position: 'right',
        min: 20,
        max: 100,
        title: {
          display: true,
          text: 'Motor Temperature (°C)',
          color: '#fff'
        },
        ticks: {
          color: '#fff',
          stepSize: 10
        },
        grid: {
          drawOnChartArea: false
        }
      },
      x: {
        title: {
          display: false,
          color: '#fff'
        },
        ticks: {
          color: '#fff'
        },
        grid: {
          color: 'rgba(255,255,255,0.12)'
        }
      }
    };
  }

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets
    },
    options: chartOptions
  });
}

// Get unit label for a metric
export function getUnitForMetric(metric) {
  switch (metric) {
    case 'temperature': return 'Temperature (°C)';
    case 'humidity': return 'Humidity (%)';
    case 'pm25': return 'PM2.5 (μg/m³)';
    case 'pm10': return 'PM10 (μg/m³)';
    default: return '';
  }
}

// Update chart based on UI controls (to be called from UI)
export function updateChart() {
  const room = document.getElementById('chart-room').value;
  const metric = document.getElementById('chart-metric').value;
  const period = document.getElementById('chart-period').value;
  if (window.saveAnalyticsSettings) window.saveAnalyticsSettings();
  fetchChartData(room, metric, period);
}

// Make updateChart globally accessible for inline event handlers
window.updateChart = updateChart;
