// GPS og beregninger
let speedUnit = 'km/h'; // Standard
let distanceTraveled = 0; 
let lastPosition = null;

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

const drawer = document.getElementById('drawer');
const drawerHandle = document.getElementById('drawer-handle');

let isDragging = false;
let startY = 0;
let startBottom = 0;

// Åpne/lukke med klikk
drawerHandle.addEventListener('click', () => {
  drawer.classList.toggle('open');
});

// Start dra med mus eller touch
drawerHandle.addEventListener('mousedown', startDrag);
drawerHandle.addEventListener('touchstart', startDrag, { passive: false });

function startDrag(event) {
  isDragging = true;
  startY = event.touches ? event.touches[0].clientY : event.clientY;
  startBottom = parseInt(window.getComputedStyle(drawer).bottom, 10);
  event.preventDefault(); // Hindrer scroll under drag
}

// Dra med mus eller touch
window.addEventListener('mousemove', drag);
window.addEventListener('touchmove', drag, { passive: false });

function drag(event) {
  if (isDragging) {
    const currentY = event.touches ? event.touches[0].clientY : event.clientY;
    const deltaY = startY - currentY;
    const newBottom = Math.max(-300, Math.min(0, startBottom - deltaY));
    drawer.style.bottom = `${newBottom}px`;
  }
}

// Slipp med mus eller touch
window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);

function endDrag() {
  if (isDragging) {
    isDragging = false;
    // Snap til åpen/lukket
    const currentBottom = parseInt(window.getComputedStyle(drawer).bottom, 10);
    if (currentBottom > -150) {
      drawer.classList.add('open');
      drawer.style.bottom = '0px';
    } else {
      drawer.classList.remove('open');
      drawer.style.bottom = '-300px';
    }
  }
}


window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    // Snap til åpen/lukket
    const currentBottom = parseInt(window.getComputedStyle(drawer).bottom, 10);
    if (currentBottom > -150) {
      drawer.classList.add('open');
      drawer.style.bottom = '0px';
    } else {
      drawer.classList.remove('open');
      drawer.style.bottom = '-300px';
    }
  }
});


// Nullstill data
document.getElementById('reset-data').addEventListener('click', () => {
  distanceTraveled = 0;
  updateDashboard(0, 0, 0, 0);
});
