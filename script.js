let speedUnit = 'km/h'; // Standard
let distanceTraveled = 0;
let lastPosition = null;
let isSimulationMode = false;
let simulatedSpeed = 0;
let simulationInterval = null; // Intervallet for simuleringsoppdatering
const SIMULATION_UPDATE_INTERVAL = 1000; // Oppdater hver 1 sekund

function updateDashboard(speed, distance, fuel, rpm) {
    const speedKnots = speed / 1.852; // Konverter hastighet til knop
    const distanceNm = distance / 1.852; // Konverter distanse til nautiske mil

    document.getElementById('speed').textContent = speedKnots.toFixed(1);
    document.getElementById('distance').textContent = distanceNm.toFixed(2);
    document.getElementById('fuel-consumption').textContent = fuel.toFixed(2);
    document.getElementById('interpolated-rpm').textContent = rpm.toFixed(2);
    document.getElementById('fuel-per-nm').textContent = speedKnots > 0
        ? (fuel / speedKnots).toFixed(2) // Beregn forbruk basert på hastighet
        : '0';
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
        const distanceStep = (simulatedSpeed * 1.852) / 3600; // Beregn ny distanse umiddelbart
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
            const interpolatedValues = calculateInterpolatedValues(simulatedSpeed * 1.852); // Konverter knop til km/h

            // Oppdater dashboard med de nye verdiene
            updateDashboard(simulatedSpeed * 1.852, distanceTraveled * 1.852, interpolatedValues.fuel, interpolatedValues.rpm); // Konverter tilbake til km/h for kalkulasjoner
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
        speed: parseFloat(document.getElementById('idle-speed').value),
        fuel: parseFloat(document.getElementById('idle-fuel').value),
      },
      lowCruise: {
        rpm: parseFloat(document.getElementById('low-rpm').value),
        speed: parseFloat(document.getElementById('low-speed').value),
        fuel: parseFloat(document.getElementById('low-fuel').value),
      },
      highCruise: {
        rpm: parseFloat(document.getElementById('high-rpm').value),
        speed: parseFloat(document.getElementById('high-speed').value),
        fuel: parseFloat(document.getElementById('high-fuel').value),
      },
      wot: {
        rpm: parseFloat(document.getElementById('wot-rpm').value),
        speed: parseFloat(document.getElementById('wot-speed').value),
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
    } else {
      rpm = interpolate(data.highCruise.speed, data.wot.speed, data.highCruise.rpm, data.wot.rpm, speed);
      fuel = interpolate(data.highCruise.speed, data.wot.speed, data.highCruise.fuel, data.wot.fuel, speed);
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
      Math.cos((pos2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Generate data for fuel consumption chart
function generateFuelConsumptionData() {
    const data = getCalibrationData();
    const speedRange = [];
    const fuelConsumption = [];

    for (let speed = 0; speed <= data.wot.speed; speed += 1) {
        const interpolatedValues = calculateInterpolatedValues(speed);
        speedRange.push(speed);
        fuelConsumption.push(interpolatedValues.fuel);
    }

    return { speedRange, fuelConsumption };
}

document.addEventListener('DOMContentLoaded', (event) => {
    const ctx = document.getElementById('fuelChart').getContext('2d');
    const { speedRange, fuelConsumption } = generateFuelConsumptionData();

    const fuelChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: speedRange,
            datasets: [{
                label: 'Fuel Consumption (l/h)',
                data: fuelConsumption,
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                fill: false
            }]
        },
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Speed (km/h)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Fuel Consumption (l/h)'
                    }
                }
            }
        }
    });

    // Update chart when calibration data changes
    document.querySelectorAll('.calibration-block input').forEach(input => {
        input.addEventListener('input', () => {
            const { speedRange, fuelConsumption } = generateFuelConsumptionData();
            fuelChart.data.labels = speedRange;
            fuelChart.data.datasets[0].data = fuelConsumption;
            fuelChart.update();
        });
    });
});








