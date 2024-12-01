const speedDisplay = document.getElementById('speedDisplay');
const startButton = document.getElementById('startButton');

startButton.addEventListener('click', startGPS);

function startGPS() {
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                console.log("Position received:", position); // Log hele posisjonsobjektet

                let speed = position.coords.speed;

                // Hvis hastighet ikke er tilgjengelig, sett til 0
                if (speed === null || speed === undefined) {
                    speed = 0;
                } else {
                    // Konverter m/s til km/t
                    speed = speed * 3.6;
                }

                // Oppdater visning av hastighet
                speedDisplay.textContent = `Hastighet: ${speed.toFixed(2)} km/t`;
            },
            (error) => {
                let errorMessage = "Feil ved henting av hastighet";

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Tilgang til GPS er avvist.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "GPS-posisjon ikke tilgjengelig.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "GPS-forespørselen tok for lang tid.";
                        break;
                }

                console.error(errorMessage);
                speedDisplay.textContent = errorMessage;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        speedDisplay.textContent = "Geolokasjon støttes ikke av enheten.";
    }
}
