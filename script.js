let speedUnit = 'knots'; // Standard
let distanceTraveled = 0;
let lastPosition = null;
let lastTimestamp = null;
let isSimulationMode = false;
let simulatedSpeed = 0;
let simulationInterval = null; // Intervallet for simuleringsoppdatering
const SIMULATION_UPDATE_INTERVAL = 1000; // Oppdater hver 1 sekund
let fuelChart; // Definer globalt

function updateDashboard(speed, distance, fuel, rpm) {
    const speedKnots = speed; // Hastighet er allerede i knop
    const distanceNm = distance; // Distanse er allerede i nautiske mil

    document.getElementById('speed').textContent = speedKnots.toFixed(1);
    document.getElementById('distance').textContent = distanceNm.toFixed(2);
    document.getElementById('fuel-consumption').textContent = fuel.toFixed(2);
    document.getElementById('interpolated-rpm').textContent = rpm.toFixed(2);
    document.getElementById('fuel-per-nm').textContent = speedKnots > 0
        ? (fuel / speedKnots).toFixed(2) // Beregn forbruk basert på hastighet
        : '0';

    // Oppdater grafen med markør
    if (fuelChart) {
        fuelChart.options.plugins.marker.speed = speedKnots;
        fuelChart.options.plugins.marker.fuel = fuel;
        fuelChart.options.plugins.marker.rpm = rpm;
        fuelChart.update();
    }
}

// Toggle simulering
document.getElementById('simulation-toggle').addEventListener('change', (event) => {
    isSimulationMode = event.target.checked;

    // Hent kontroll-div
    const controls = document.getElementById('simulation-controls');

    // Vis eller skjul kontrollen basert på simuleringsmodus
    if (isSimulationMode) {
        controls.style.display = 'flex'; // Bruk "flex" for bedre layout
        startSimulation();
    } else {
        controls.style.display = 'none';
        stopSimulation();
    }
});

document.getElementById('simulated-speed').addEventListener('input', (event) => {
    simulatedSpeed = parseFloat(event.target.value);
    document.getElementById('simulated-speed-value').textContent = simulatedSpeed.toFixed(1);

    // Oppdater distanse og drivstoff umiddelbart
    if (isSimulationMode) {
        const distanceStep = simulatedSpeed / 3600; // Beregn ny distanse umiddelbart (nm per sekund)
        distanceTraveled += distanceStep;

        const interpolatedValues = calculateInterpolatedValues(simulatedSpeed);
        updateDashboard(simulatedSpeed, distanceTraveled, interpolatedValues.fuel, interpolatedValues.rpm);
    }
});

document.getElementById('reset-data').addEventListener('click', () => {
    distanceTraveled = 0;
    updateDashboard(0, 0, 0, 0);
    stopSimulation();
});

// Simuleringsfunksjon
function startSimulation() {
    stopSimulation(); // Stopp eventuell eksisterende simulering
    simulationInterval = setInterval(() => {
        if (isSimulationMode) {
            // Beregn distanse basert på simulert hastighet
            const distanceStep = simulatedSpeed / 3600; // nm per sekund
            distanceTraveled += distanceStep;

            // Beregn interpolerte verdier
            const interpolatedValues = calculateInterpolatedValues(simulatedSpeed);

            // Oppdater dashboard med de nye verdiene
            updateDashboard(simulatedSpeed, distanceTraveled, interpolatedValues.fuel, interpolatedValues.rpm);
        }
    }, SIMULATION_UPDATE_INTERVAL);
}

function stopSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
    simulatedSpeed = 0; // Nullstill simulert hastighet
    updateDashboard(0, distanceTraveled, 0, 0); // Oppdater dashbordet til 0 for hastighet og forbruk
}

// Oppdater kalibreringsdata fra tabellen
function getCalibrationData() {
    return {
      idle: {
        rpm: parseFloat(document.getElementById('idle-rpm').value),
        speed: parseFloat(document.getElementById('idle-speed').value), // Hastighet i knop
        fuel: parseFloat(document.getElementById('idle-fuel').value),
      },
      lowCruise: {
        rpm: parseFloat(document.getElementById('low-rpm').value),
        speed: parseFloat(document.getElementById('low-speed').value), // Hastighet i knop
        fuel: parseFloat(document.getElementById('low-fuel').value),
      },
      highCruise: {
        rpm: parseFloat(document.getElementById('high-rpm').value),
        speed: parseFloat(document.getElementById('high-speed').value), // Hastighet i knop
        fuel: parseFloat(document.getElementById('high-fuel').value),
      },
      wot: {
        rpm: parseFloat(document.getElementById('wot-rpm').value),
        speed: parseFloat(document.getElementById('wot-speed').value), // Hastighet i knop
        fuel: parseFloat(document.getElementById('wot-fuel').value),
      },
    };
}

function calculateInterpolatedValues(speed) {
    const data = getCalibrationData();
  
    // Enkel interpolering mellom punktene
    let rpm, fuel;
  
    if (speed <= data.idle.speed) {
      rpm = data.idle.rpm;
      fuel = data.idle.fuel;
    } else if (speed <= data.lowCruise.speed) {
      rpm = interpolate(data.idle.speed, data.lowCruise.speed, data.idle.rpm, data.lowCruise.rpm, speed);
      fuel = interpolate(data.idle.speed, data.lowCruise.speed, data.idle.fuel, data.lowCruise.fuel, speed);
    } else if (speed <= data.highCruise.speed) {
      rpm = interpolate(data.lowCruise.speed, data.highCruise.speed, data.lowCruise.rpm, data.highCruise.rpm, speed);
      fuel = interpolate(data.lowCruise.speed, data.highCruise.speed, data.lowCruise.fuel, data.highCruise.fuel, speed);
    } else if (speed <= data.wot.speed) {
      rpm = interpolate(data.highCruise.speed, data.wot.speed, data.highCruise.rpm, data.wot.rpm, speed);
      fuel = interpolate(data.highCruise.speed, data.wot.speed, data.highCruise.fuel, data.wot.fuel, speed);
    } else {
      rpm = data.wot.rpm;
      fuel = data.wot.fuel;
    }
  
    return { rpm, fuel };
}
  
// Funksjon for lineær interpolering
function interpolate(x1, x2, y1, y2, x) {
    return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
}

navigator.geolocation.watchPosition((position) => {
    if (isSimulationMode) return; // Ignorer GPS-data i simuleringsmodus

    let speed = position.coords.speed || 0;
    if (speed === 0 && lastPosition && lastTimestamp) {
        const distance = calculateDistance(lastPosition, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
        });
        const timeElapsed = (position.timestamp - lastTimestamp) / 1000; // sekunder
        speed = (distance / timeElapsed) * 3600 / 1.852; // konverter til knop
    }

    if (lastPosition) {
        const distance = calculateDistance(lastPosition, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
        });
        distanceTraveled += distance;
    }

    lastPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
    };
    lastTimestamp = position.timestamp;

    const interpolatedValues = calculateInterpolatedValues(speed);
    updateDashboard(speed, distanceTraveled, interpolatedValues.fuel, interpolatedValues.rpm);
});

function calculateDistance(pos1, pos2) {
  const R = 6371; // Radius of Earth in km
  const dLat = ((pos2.latitude - pos1.latitude) * Math.PI) / 180;
  const dLon = ((pos2.longitude - pos1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((pos1.latitude * Math.PI) / 180) *
      Math.cos((pos2.latitude * (Math.PI) / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c / 1.852; // Konverter km til nautiske mil
}

// Generate data for fuel consumption chart
function generateFuelConsumptionData() {
    const data = getCalibrationData();
    const speedRange = [];
    const fuelConsumption = [];
    const rpmValues = [];

    for (let speed = 0; speed <= data.wot.speed; speed += 1) {
        const interpolatedValues = calculateInterpolatedValues(speed);
        speedRange.push(speed);
        fuelConsumption.push(interpolatedValues.fuel);
        rpmValues.push(interpolatedValues.rpm);
    }

    return { speedRange, fuelConsumption, rpmValues };
}

document.addEventListener('DOMContentLoaded', (event) => {
    const ctx = document.getElementById('fuelChart').getContext('2d');
    const { speedRange, fuelConsumption, rpmValues } = generateFuelConsumptionData();

    const markerPlugin = {
        id: 'marker',
        beforeDraw: (chart) => {
            const { ctx, chartArea: { left, right, top, bottom }, scales: { x, y1, y2 } } = chart;
            const speed = chart.options.plugins.marker.speed;
            const fuel = chart.options.plugins.marker.fuel;
            const rpm = chart.options.plugins.marker.rpm;

            if (speed !== undefined && fuel !== undefined && rpm !== undefined) {
                const xPos = x.getPixelForValue(speed);
                const yPosFuel = y1.getPixelForValue(fuel);
                const yPosRpm = y2.getPixelForValue(rpm);

                ctx.save();
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 1;

                // Draw vertical line at speed
                ctx.beginPath();
                ctx.moveTo(xPos, top);
                ctx.lineTo(xPos, bottom);
                ctx.stroke();

                // Draw horizontal line for fuel
                ctx.beginPath();
                ctx.moveTo(left, yPosFuel);
                ctx.lineTo(xPos, yPosFuel);
                ctx.stroke();

                // Draw horizontal line for rpm
                ctx.beginPath();
                ctx.moveTo(left, yPosRpm);
                ctx.lineTo(xPos, yPosRpm);
                ctx.stroke();

                ctx.restore();
            }
        }
    };

    fuelChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: speedRange,
            datasets: [
                {
                    label: 'Fuel Consumption (l/h)',
                    data: fuelConsumption,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    fill: false,
                    yAxisID: 'y1'
                },
                {
                    label: 'RPM',
                    data: rpmValues,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    fill: false,
                    yAxisID: 'y2'
                }
            ]
        },
        options: {
            plugins: {
                marker: {
                    speed: undefined,
                    fuel: undefined,
                    rpm: undefined
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Speed (knots)'
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Fuel Consumption (l/h)'
                    }
                },
                y2: {
                    type: 'linear',
                    position: 'right',
                    title: {
                        display: true,
                        text: 'RPM'
                    },
                    grid: {
                        drawOnChartArea: false // only want the grid lines for one axis to show up
                    }
                }
            }
        },
        plugins: [markerPlugin]
    });

    // Update chart when calibration data changes
    document.querySelectorAll('.calibration-block input').forEach(input => {
        input.addEventListener('input', () => {
            const { speedRange, fuelConsumption, rpmValues } = generateFuelConsumptionData();
            fuelChart.data.labels = speedRange;
            fuelChart.data.datasets[0].data = fuelConsumption;
            fuelChart.data.datasets[1].data = rpmValues;
            fuelChart.update();
        });
    });
});