// Global variables
let speedUnit = 'knots';
let distanceTraveled = 0;
let totalFuelConsumption = 0;
let lastPosition = null;
let lastTimestamp = null;
let isSimulationMode = false;
let simulatedSpeed = 0;
let simulationInterval = null;
const SIMULATION_UPDATE_INTERVAL = 1000;
let fuelChart;
let isMeasurementActive = false;
let fuelTankCapacity = 100;
let remainingFuel = 100;
let maxSpeed = 0;
let speedBuffer = [];
const MAX_SPEED_DISTANCE = 0.25;
let stopwatchInterval = null;
let stopwatchTime = 0;
let wakeLock = null;

// Kalman filter variables
let kalmanSpeed = 0;
let kalmanError = 1;
const processNoise = 1e-2;
const measurementNoise = 1e-1;

/**
 * Updates the dashboard with the current speed, distance, fuel consumption, and RPM.
 * @param {number} speed - The current speed in knots.
 * @param {number} distance - The total distance traveled in nautical miles.
 * @param {number} fuel - The current fuel consumption in liters per hour.
 * @param {number} rpm - The current RPM.
 */
function updateDashboard(speed, distance, fuel, rpm) {
    if (!isMeasurementActive) return;
    const speedKnots = speed;
    const distanceNm = distance;

    document.getElementById('speed').textContent = speedKnots.toFixed(1);
    document.getElementById('distance').textContent = distanceNm.toFixed(2);
    document.getElementById('fuel-consumption').textContent = fuel.toFixed(1);
    document.getElementById('interpolated-rpm').textContent = Math.round(rpm);
    document.getElementById('fuel-per-nm').textContent = speedKnots > 0
        ? (fuel / speedKnots).toFixed(1)
        : '0';

    if (fuelChart) {
        fuelChart.options.plugins.marker.speed = speedKnots;
        fuelChart.options.plugins.marker.fuel = fuel;
        fuelChart.options.plugins.marker.rpm = rpm;
        fuelChart.update();
    }

    updateMaxSpeed(speedKnots, distance);
}

/**
 * Updates the maximum speed based on the highest average speed measured over 0.25 nm.
 * @param {number} currentSpeed - The current speed in knots.
 * @param {number} distanceStep - The distance traveled in the current interval.
 */
function updateMaxSpeed(currentSpeed, distanceStep) {
    speedBuffer.push({ speed: currentSpeed, distance: distanceStep });
    let totalDistance = speedBuffer.reduce((acc, val) => acc + val.distance, 0);

    while (totalDistance > MAX_SPEED_DISTANCE) {
        const removed = speedBuffer.shift();
        totalDistance -= removed.distance;
    }

    // Ensure the latest distance is used for max speed calculation
    if (totalDistance > 0) {
        const totalSpeed = speedBuffer.reduce((acc, val) => acc + val.speed * val.distance, 0);
        const averageSpeed = totalSpeed / totalDistance;
        if (averageSpeed > maxSpeed) {
            maxSpeed = Math.floor(averageSpeed);
            document.getElementById('max-speed').textContent = maxSpeed;
        }
    }
}

/**
 * Continuously checks if the average speed over the last 0.25 nm is higher than the maximum speed.
 */
function checkAndUpdateMaxSpeed() {
    const totalDistance = speedBuffer.reduce((acc, val) => acc + val.distance, 0);
    if (totalDistance > 0) {
        const totalSpeed = speedBuffer.reduce((acc, val) => acc + val.speed * val.distance, 0);
        const averageSpeed = totalSpeed / totalDistance;
        if (averageSpeed > maxSpeed) {
            maxSpeed = Math.floor(averageSpeed);
            document.getElementById('max-speed').textContent = maxSpeed;
        }
    }
}

/**
 * Updates the total fuel consumption.
 * @param {number} fuel - The current fuel consumption in liters per hour.
 */
function updateTotalFuelConsumption(fuel) {
    totalFuelConsumption += (fuel / 3600) * (SIMULATION_UPDATE_INTERVAL / 1000);
    remainingFuel = fuelTankCapacity - totalFuelConsumption;
    document.getElementById('total-fuel-consumption').textContent = totalFuelConsumption.toFixed(2);
    document.getElementById('remaining-fuel').textContent = remainingFuel.toFixed(2);
}

// Toggle simulation
document.getElementById('simulation-toggle').addEventListener('change', (event) => {
    isSimulationMode = event.target.checked;
    const controls = document.getElementById('simulation-controls');

    if (isSimulationMode) {
        controls.style.display = 'flex';
        startSimulation();
    } else {
        controls.style.display = 'none';
        stopSimulation();
    }
});

document.getElementById('simulated-speed').addEventListener('input', (event) => {
    simulatedSpeed = parseFloat(event.target.value);
    document.getElementById('simulated-speed-value').textContent = simulatedSpeed.toFixed(1);

    if (isSimulationMode && isMeasurementActive) {
        const interpolatedValues = calculateInterpolatedValues(simulatedSpeed);
        updateDashboard(simulatedSpeed, distanceTraveled, interpolatedValues.fuel, interpolatedValues.rpm);
    }
});

// Disable GPS data when simulation mode is active
navigator.geolocation.watchPosition((position) => {
    if (!isMeasurementActive || isSimulationMode) return;
    let speed = position.coords.speed || 0;
    if (speed === 0 && lastPosition && lastTimestamp) {
        const distance = calculateDistance(lastPosition, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
        });
        const timeElapsed = (position.timestamp - lastTimestamp) / 1000;
        speed = (distance / timeElapsed) * 3600 / 1.852;
    }

    if (!isSimulationMode && lastPosition && lastTimestamp) {
        const timeElapsed = (position.timestamp - lastTimestamp) / 1000;
        const currentSpeed = distanceTraveled / timeElapsed;

        const filteredSpeed = kalmanFilter(currentSpeed);
        const speedChange = Math.abs(speed - filteredSpeed);

        const maxSpeedChange = 10;
        if (speedChange > maxSpeedChange) {
            console.warn(`Unrealistic GPS speed change: ${speedChange} knots`);
            return;
        }
        speed = filteredSpeed;
    }

    if (lastTimestamp) {
        const timeElapsed = (position.timestamp - lastTimestamp) / 3600000;
        const distanceStep = speed * timeElapsed;
        distanceTraveled += distanceStep;
        updateMaxSpeed(speed, distanceStep);
    }

    lastPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
    };
    lastTimestamp = position.timestamp;

    const interpolatedValues = calculateInterpolatedValues(speed);
    updateDashboard(speed, distanceTraveled, interpolatedValues.fuel, interpolatedValues.rpm);

    if (isMeasurementActive) {
        updateTotalFuelConsumption(interpolatedValues.fuel);
    }
}, (error) => {
    if (error.code === error.PERMISSION_DENIED) {
        alert('Please enable location services to use this feature.');
    } else {
        console.error('Error occurred while retrieving location:', error);
    }
}, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: Infinity
});

document.getElementById('reset-data').addEventListener('click', () => {
    distanceTraveled = 0;
    totalFuelConsumption = 0;
    remainingFuel = fuelTankCapacity;
    maxSpeed = 0;
    speedBuffer = [];
    updateDashboard(0, 0, 0, 0);
    document.getElementById('remaining-fuel').textContent = remainingFuel.toFixed(2);
    document.getElementById('max-speed').textContent = maxSpeed.toFixed(2);
    stopSimulation();
    resetStopwatch();
});

document.getElementById('start-pause-measurement').addEventListener('click', (event) => {
    isMeasurementActive = !isMeasurementActive;
    event.target.textContent = isMeasurementActive ? 'Pause' : 'Start';
    console.log(isMeasurementActive ? 'Measurement started' : 'Measurement paused');

    if (isMeasurementActive) {
        startMeasurement();
        startStopwatch();
        startGPSMeasurement(); // Ensure GPS measurement starts
    } else {
        pauseMeasurement();
        pauseStopwatch();
    }
});

document.getElementById('stop-measurement').addEventListener('click', () => {
    isMeasurementActive = false;
    distanceTraveled = 0;
    totalFuelConsumption = 0;
    remainingFuel = fuelTankCapacity;
    updateDashboard(0, 0, 0, 0);
    document.getElementById('start-pause-measurement').textContent = 'Start';
    document.getElementById('remaining-fuel').textContent = remainingFuel.toFixed(2);
    console.log('Measurement stopped');
});

document.getElementById('save-fuel-tank').addEventListener('click', () => {
    fuelTankCapacity = parseFloat(document.getElementById('fuel-tank-capacity').value);
    remainingFuel = fuelTankCapacity - totalFuelConsumption;
    document.getElementById('remaining-fuel').textContent = remainingFuel.toFixed(2);
    console.log(`Fuel tank capacity set to ${fuelTankCapacity} liters`);
});

function startMeasurement() {
    console.log('Measurement started');
    if (isSimulationMode) {
        startSimulation();
    }
}

function pauseMeasurement() {
    console.log('Measurement paused');
    if (isSimulationMode) {
        stopSimulation();
    }
}

/**
 * Starts GPS measurement and updates the dashboard with the current data.
 */
function startGPSMeasurement() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    navigator.geolocation.watchPosition((position) => {
        if (!isMeasurementActive || isSimulationMode) return;

        let speed = position.coords.speed || 0;
        if (speed === 0 && lastPosition && lastTimestamp) {
            const distance = calculateDistance(lastPosition, {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            });
            const timeElapsed = (position.timestamp - lastTimestamp) / 1000;
            speed = (distance / timeElapsed) * 3600 / 1.852;
        }

        if (!isSimulationMode && lastPosition && lastTimestamp) {
            const timeElapsed = (position.timestamp - lastTimestamp) / 1000;
            const currentSpeed = distanceTraveled / timeElapsed;

            const filteredSpeed = kalmanFilter(currentSpeed);
            const speedChange = Math.abs(speed - filteredSpeed);

            const maxSpeedChange = 10;
            if (speedChange > maxSpeedChange) {
                console.warn(`Unrealistic GPS speed change: ${speedChange} knots`);
                return;
            }
            speed = filteredSpeed;
        }

        if (lastTimestamp) {
            const timeElapsed = (position.timestamp - lastTimestamp) / 3600000;
            const distanceStep = speed * timeElapsed;
            distanceTraveled += distanceStep;
            updateMaxSpeed(speed, distanceStep);
        }

        lastPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
        };
        lastTimestamp = position.timestamp;

        const interpolatedValues = calculateInterpolatedValues(speed);
        updateDashboard(speed, distanceTraveled, interpolatedValues.fuel, interpolatedValues.rpm);
        updateTotalFuelConsumption(interpolatedValues.fuel);
    }, (error) => {
        if (error.code === error.PERMISSION_DENIED) {
            alert('Please enable location services to use this feature.');
        } else {
            console.error('Error occurred while retrieving location:', error);
        }
    }, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: Infinity
    });
}

function stopGPSMeasurement() {
    // Logic to stop GPS measurement if needed
}

// Simulation function
function startSimulation() {
    stopSimulation();
    simulationInterval = setInterval(() => {
        if (isSimulationMode && isMeasurementActive) {
            const distanceStep = simulatedSpeed * (SIMULATION_UPDATE_INTERVAL / 3600000);
            distanceTraveled += distanceStep;

            const interpolatedValues = calculateInterpolatedValues(simulatedSpeed);
            updateTotalFuelConsumption(interpolatedValues.fuel);
            updateDashboard(simulatedSpeed, distanceTraveled, interpolatedValues.fuel, interpolatedValues.rpm);
        }
    }, SIMULATION_UPDATE_INTERVAL);
}

function stopSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
    simulatedSpeed = 0;
    updateDashboard(0, distanceTraveled, 0, 0);
}

/**
 * Retrieves calibration data from the input fields.
 * @returns {Object} The calibration data.
 */
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

/**
 * Calculates interpolated values for RPM and fuel consumption based on the current speed.
 * @param {number} speed - The current speed in knots.
 * @returns {Object} The interpolated RPM and fuel consumption.
 */
function calculateInterpolatedValues(speed) {
    if (speed < 0) {
        speed = 0;
    }
    const data = getCalibrationData();

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
        const extraSpeed = speed - data.wot.speed;
        rpm = data.wot.rpm + (extraSpeed * (data.wot.rpm - data.highCruise.rpm) / (data.wot.speed - data.highCruise.speed));
        fuel = data.wot.fuel + (extraSpeed * (data.wot.fuel - data.highCruise.fuel) / (data.wot.speed - data.highCruise.speed));
    }

    return { rpm, fuel };
}

/**
 * Performs linear interpolation between two points.
 * @param {number} x1 - The x-coordinate of the first point.
 * @param {number} x2 - The x-coordinate of the second point.
 * @param {number} y1 - The y-coordinate of the first point.
 * @param {number} y2 - The y-coordinate of the second point.
 * @param {number} x - The x-coordinate of the point to interpolate.
 * @returns {number} The interpolated y-coordinate.
 */
function interpolate(x1, x2, y1, y2, x) {
    return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
}

/**
 * Calculates the distance between two geographical points.
 * @param {Object} pos1 - The first geographical point.
 * @param {Object} pos2 - The second geographical point.
 * @returns {number} The distance between the two points in nautical miles.
 */
function calculateDistance(pos1, pos2) {
    const EARTH_RADIUS_KM = 6371;
    const KM_TO_NM = 1.852;

    const dLat = ((pos2.latitude - pos1.latitude) * Math.PI) / 180;
    const dLon = ((pos2.longitude - pos1.longitude) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((pos1.latitude * Math.PI) / 180) *
        Math.cos((pos2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distanceKm = EARTH_RADIUS_KM * c;
    const distanceNm = distanceKm / KM_TO_NM;

    return distanceNm;
}

/**
 * Generates data for the fuel consumption chart.
 * @returns {Object} The data for the fuel consumption chart.
 */
function generateFuelConsumptionData() {
    const data = getCalibrationData();
    const speedRange = [];
    const fuelConsumption = [];
    const rpmValues = [];

    for (let speed = 0; speed <= data.wot.speed + 10; speed += 1) {
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

                ctx.beginPath();
                ctx.moveTo(xPos, top);
                ctx.lineTo(xPos, bottom);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(left, yPosFuel);
                ctx.lineTo(xPos, yPosFuel);
                ctx.stroke();

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
                        drawOnChartArea: false
                    }
                }
            }
        },
        plugins: [markerPlugin]
    });

    document.querySelectorAll('.calibration-block input').forEach(input => {
        input.addEventListener('input', () => {
            if (!isMeasurementActive) return;
            const { speedRange, fuelConsumption, rpmValues } = generateFuelConsumptionData();
            fuelChart.data.labels = speedRange;
            fuelChart.data.datasets[0].data = fuelConsumption;
            fuelChart.data.datasets[1].data = rpmValues;
            fuelChart.update();
        });
    });

    requestWakeLock();
});

setInterval(() => {
    if (isMeasurementActive) {
        checkAndUpdateMaxSpeed();
    }
}, SIMULATION_UPDATE_INTERVAL);

window.addEventListener('unload', () => {
    releaseWakeLock();
});

/**
 * Request a wake lock to keep the screen on.
 */
async function requestWakeLock() {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
            console.log('Wake lock released, requesting again...');
            requestWakeLock();
        });
        console.log('Wake lock acquired');
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}

/**
 * Release the wake lock.
 */
function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release()
            .then(() => {
                wakeLock = null;
                console.log('Wake lock released');
            });
    }
}

requestWakeLock();

/**
 * Updates the stopwatch display.
 */
function updateStopwatch() {
    const hours = Math.floor(stopwatchTime / 3600);
    const minutes = Math.floor((stopwatchTime % 3600) / 60);
    const seconds = stopwatchTime % 60;

    document.getElementById('stopwatch').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Starts the stopwatch.
 */
function startStopwatch() {
    if (stopwatchInterval) return;
    stopwatchInterval = setInterval(() => {
        stopwatchTime++;
        updateStopwatch();
    }, 1000);
}

/**
 * Pauses the stopwatch.
 */
function pauseStopwatch() {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
}

/**
 * Resets the stopwatch.
 */
function resetStopwatch() {
    pauseStopwatch();
    stopwatchTime = 0;
    updateStopwatch();
}

/**
 * Kalman filter for smoothing speed measurements.
 * @param {number} measuredSpeed - The measured speed.
 * @returns {number} The filtered speed.
 */
function kalmanFilter(measuredSpeed) {
    // Prediction update
    kalmanError += processNoise;

    // Measurement update
    const kalmanGain = kalmanError / (kalmanError + measurementNoise);
    kalmanSpeed += kalmanGain * (measuredSpeed - kalmanSpeed);
    kalmanError *= (1 - kalmanGain);

    console.log(`Measured Speed: ${measuredSpeed}, Kalman Speed: ${kalmanSpeed}`); // Logging

    return kalmanSpeed;
}
// Filter out unrealistic speed changes using Kalman filter
if (lastPosition && lastTimestamp) {
    const timeElapsed = (position.timestamp - lastTimestamp) / 1000; // sekunder
    const currentSpeed = distanceTraveled / timeElapsed;

    const filteredSpeed = kalmanFilter(currentSpeed);
    const speedChange = Math.abs(speed - filteredSpeed);

    const maxSpeedChange = 10; // Max change in knots per second
    if (speedChange > maxSpeedChange) {
        console.warn(`Unrealistic GPS speed change: ${speedChange} knots`);
        return;
    }
}