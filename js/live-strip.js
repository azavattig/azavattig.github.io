// "Based in Miami" strip: local time, current temperature, rotating greeting.
(function () {
  const MIAMI = { lat: 25.7617, lon: -80.1918, timeZone: "America/New_York" };
  const GREETINGS = ["Hola", "Ciao", "Hello"];

  const clock = document.getElementById("clock");
  const weather = document.getElementById("weather");
  const greet = document.getElementById("greet");

  const timeFormat = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: MIAMI.timeZone,
  });

  function updateClock() {
    clock.textContent = timeFormat.format(new Date());
  }

  async function loadWeather() {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${MIAMI.lat}&longitude=${MIAMI.lon}` +
      "&current=temperature_2m&temperature_unit=fahrenheit";
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const temp = Math.round(data.current.temperature_2m);
      if (Number.isFinite(temp)) weather.textContent = ` · ${temp}°F`;
    } catch (error) {
      // The strip still works with the time only.
      console.warn("Weather unavailable:", error.message);
    }
  }

  function rotateGreeting() {
    let index = 0;
    setInterval(() => {
      index = (index + 1) % GREETINGS.length;
      greet.style.opacity = "0";
      setTimeout(() => {
        greet.textContent = GREETINGS[index];
        greet.style.opacity = "1";
      }, 300);
    }, 2600);
  }

  updateClock();
  setInterval(updateClock, 15000);
  loadWeather();
  rotateGreeting();
})();
