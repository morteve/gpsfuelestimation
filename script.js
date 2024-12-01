// GPS og beregninger
let speedUnit = 'km/h'; // Standard
let distanceTraveled = 0; 
let lastPosition = null;

// Kalibreringsdata
const calibrationData = {
  idle: { rpm: 0, speed: 0, fuel: 0 },
  lowCruise: { rpm: 0, speed: 0, fuel: 0 },
  highCruise: { rpm: 0, speed: 0, fuel: 0 },
  wot: { rpm: 0, speed: 0, fuel: 0 },
};

function updateDashboard(speed, distance, fuel, rpm) {
  document.getElementById('speed').textContent = speed.toFixed(1);
  document.getElementById('distance').textContent = distance.toFixed(2);
  document.getElementById('fuel-consumption').textContent = fuel.toFixed(2);
  document.getElementById('interpolated-rpm').textContent = rpm.toFixed(2);
  document.getElementById('fuel-per-nm').textContent = (fuel / (distance / 1.852)).toFixed(2);
}

function calculateInterpolatedValues(speed) {
  // Enkel kvadratisk interpolasjon
  const { idle, lowCruise, highCruise, wot } = calibrationData;
  const rpm = Math.pow(speed, 2); // Placeholder-funksjon
  const fuel = Math.pow(speed, 2) * 0.1; // Placeholder-funksjon
  return { rpm, fuel };
}

// Håndtering av GPS-data
navigator.geolocation.watchPosition((position) => {
  const { latitude, longitude, speed } = position.coords;
  if (lastPosition) {
    const distance = calculateDistance(lastPosition, { latitude, longitude });
    distanceTraveled += distance;
  }
  lastPosition = { latitude, longitude };
  const interpolatedValues = calculateInterpolatedValues(speed || 0);
  updateDashboard(speed || 0, distanceTraveled, interpolatedValues.fuel, interpolatedValues.rpm);
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
  return R * c; // Distance in km
}

// Drawer toggle
document.getElementById('drawer-toggle').addEventListener('click', () => {
  document.getElementById('drawer').classList.toggle('open');
});

// Nullstill data
document.getElementById('reset-data').addEventListener('click', () => {
  distanceTraveled = 0;
  updateDashboard(0, 0, 0, 0);
});
