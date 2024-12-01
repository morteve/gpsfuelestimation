let speedUnit = 'km/h'; // Standard
let distanceTraveled = 0;
let lastPosition = null;
let isSimulationMode = false;
let simulatedSpeed = 0;
let simulationInterval = null; // Intervallet for simuleringsoppdatering
const SIMULATION_UPDATE_INTERVAL = 1000; // Oppdater hver 1 sekund

// Kalibreringsdata
const calibrationData = {
  idle: { rpm: 850, speed: 0, fuel: 0.8 },
  lowCruise: { rpm: 3000, speed: 21, fuel: 10 },
  highCruise: { rpm: 4500, speed: 30, fuel: 17 },
  wot: { rpm: 5850, speed: 39, fuel: 22.5 },
};

function updateDashboard(speed, distance, fuel, rpm) {
  document.getElementById('speed').textContent = speed.toFixed(1);
  document.getElementById('distance').textContent = distance.toFixed(2);
  document.getElementById('fuel-consumption').textContent = fuel.toFixed(2);
  document.getElementById('interpolated-rpm').textContent = rpm.toFixed(2);
  document.getElementById('fuel-per-nm').textContent = (fuel / (distance / 1.852)).toFixed(2);
}

//toggle simulering
document.getElementById('simulation-toggle').addEventListener('change', (event) => {
    isSimulationMode = event.target.checked;
    document.getElementById('simulation-controls').style.display = isSimulationMode ? 'block' : 'none';

    if (isSimulationMode) {
        startSimulation();
    } else {
        stopSimulation();
    }
});


document.getElementById('simulated-speed').addEventListener('input', (event) => {
    simulatedSpeed = parseFloat(event.target.value);
    document.getElementById('simulated-speed-value').textContent = simulatedSpeed.toFixed(1);
});

document.getElementById('reset-data').addEventListener('click', () => {
    distanceTraveled = 0;
    updateDashboard(0, 0, 0, 0);
    stopSimulation();
});



// Simuleringsfunksjon

function startSimulation() {
    if (simulationInterval) return; // Unngå flere intervaller
    simulationInterval = setInterval(() => {
        if (isSimulationMode) {
            // Beregn tilbakelagt distanse basert på hastighet
            const distanceStep = (simulatedSpeed * 1.852) / 3600; // km på én sekund
            distanceTraveled += distanceStep;

            const interpolatedValues = calculateInterpolatedValues(simulatedSpeed);
            updateDashboard(simulatedSpeed, distanceTraveled, interpolatedValues.fuel, interpolatedValues.rpm);
        }
    }, SIMULATION_UPDATE_INTERVAL);
}

function stopSimulation() {
    clearInterval(simulationInterval);
    simulationInterval = null;
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
    let speed = isSimulationMode ? simulatedSpeed : (position.coords.speed || 0);

    if (!isSimulationMode && lastPosition) {
        const distance = calculateDistance(lastPosition, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
        });
        distanceTraveled += distance;
    }

    lastPosition = isSimulationMode ? lastPosition : {
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

document.getElementById('reset-data').addEventListener('click', () => {
  distanceTraveled = 0;
  updateDashboard(0, 0, 0, 0);
});






