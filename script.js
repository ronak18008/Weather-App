// ---------- CONFIG ----------
const apiKey = "d0729bf7a6251df9481d09ffe009f9dc"; // <-- REPLACE WITH YOUR API KEY
// ----------------------------

const elements = {
  cityInput: document.getElementById("cityInput"),
  searchBtn: document.getElementById("searchBtn"),
  geoBtn: document.getElementById("geoBtn"),
  message: document.getElementById("message"),
  today: document.getElementById("today"),
  forecast: document.getElementById("forecast"),
  forecastCards: document.getElementById("forecastCards"),
  themeToggle: document.getElementById("themeToggle")
};

const STORAGE_KEY = "weather_last_city";
const THEME_KEY = "weather_theme";

// Utility: show message
function showMessage(text, isError = false) {
  elements.message.textContent = text;
  elements.message.style.color = isError ? "crimson" : "";
}

// Utility: clear
function clearResults() {
  elements.today.classList.add("hidden");
  elements.forecast.classList.add("hidden");
  elements.forecastCards.innerHTML = "";
}

// Set theme from storage
function applyTheme() {
  const theme = localStorage.getItem(THEME_KEY) || "light";
  document.documentElement.setAttribute("data-theme", theme);
  elements.themeToggle.checked = theme === "dark";
}
applyTheme();
elements.themeToggle.addEventListener("change", () => {
  const newT = elements.themeToggle.checked ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", newT);
  localStorage.setItem(THEME_KEY, newT);
});

// Build weather UI for today
function renderToday(data) {
  elements.today.innerHTML = `
    <div class="icon">
      <img alt="${data.weather[0].description}" src="https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png">
    </div>
    <div class="info">
      <div class="small">${data.name}, ${data.sys.country}</div>
      <div class="temp">${Math.round(data.main.temp)}°C</div>
      <div class="small">${data.weather[0].description} • Feels ${Math.round(data.main.feels_like)}°C</div>
      <div class="small">Humidity: ${data.main.humidity}% • Wind: ${Math.round(data.wind.speed)} m/s</div>
    </div>
  `;
  elements.today.classList.remove("hidden");
}

// Convert 3-hr forecast into daily summary (simple)
function groupForecastToDays(list) {
  // list items every 3 hours; we'll pick the midday item if available, else first of the day
  const days = {};
  list.forEach(item => {
    const d = new Date(item.dt * 1000);
    const dayKey = d.toISOString().slice(0,10);
    if (!days[dayKey]) days[dayKey] = [];
    days[dayKey].push(item);
  });
  // produce array of day summaries (max 5)
  const result = Object.keys(days).slice(0,5).map(dayKey => {
    const arr = days[dayKey];
    // choose item closest to 12:00
    let best = arr.reduce((acc, cur) => {
      const targetHour = 12;
      const curDiff = Math.abs(new Date(cur.dt*1000).getHours() - targetHour);
      const accDiff = Math.abs(new Date(acc.dt*1000).getHours() - targetHour);
      return curDiff < accDiff ? cur : acc;
    }, arr[0]);
    // also compute min/max for the day
    const temps = arr.map(i => i.main.temp);
    return {
      date: dayKey,
      temp_min: Math.min(...temps),
      temp_max: Math.max(...temps),
      icon: best.weather[0].icon,
      desc: best.weather[0].description
    };
  });
  return result;
}

// Render forecast cards
function renderForecast(dailyArr) {
  elements.forecastCards.innerHTML = "";
  dailyArr.forEach(day => {
    const date = new Date(day.date);
    const weekday = date.toLocaleDateString(undefined, {weekday:"short", month:"short", day:"numeric"});
    const el = document.createElement("div");
    el.className = "fcard";
    el.innerHTML = `
      <div class="small">${weekday}</div>
      <img src="https://openweathermap.org/img/wn/${day.icon}@2x.png" alt="${day.desc}">
      <div class="small">${Math.round(day.temp_max)}° / ${Math.round(day.temp_min)}°</div>
      <div class="small">${day.desc}</div>
    `;
    elements.forecastCards.appendChild(el);
  });
  elements.forecast.classList.remove("hidden");
}

// Fetch current weather by city or coords
async function fetchCurrentByCity(city) {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
  return fetchJson(url);
}
async function fetchCurrentByCoords(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
  return fetchJson(url);
}
async function fetchForecastByCity(city) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
  return fetchJson(url);
}
async function fetchForecastByCoords(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
  return fetchJson(url);
}

// Generic fetch with improved error handling
async function fetchJson(url) {
  showMessage("Loading...");
  clearResults();
  try {
    const res = await fetch(url);
    const text = await res.text(); // read text first for better debug
    let data;
    try { data = JSON.parse(text); } catch(e) { data = null; }
    if (!res.ok) {
      // show API-provided message if available
      const msg = (data && (data.message || data.error)) ? (data.message || data.error) : `HTTP ${res.status}`;
      showMessage(`API Error: ${msg}`, true);
      console.error("Fetch failed:", res.status, res.statusText, data || text);
      throw new Error(`API Error: ${msg}`);
    }
    return data;
  } catch (err) {
    showMessage(`Network / Fetch error: ${err.message}. Open console for details.`, true);
    console.error("Fetch exception:", err);
    throw err;
  }
}

// Main flow: search by city
async function searchCity(city) {
  if (!apiKey || apiKey === "") {
    showMessage("You must put your OpenWeatherMap API key into script.js (const apiKey).", true);
    return;
  }
  try {
    showMessage("Searching...");
    const [current, forecast] = await Promise.all([
      fetchCurrentByCity(city),
      fetchForecastByCity(city)
    ]);
    renderToday(current);
    const daily = groupForecastToDays(forecast.list);
    renderForecast(daily);
    showMessage("");
    localStorage.setItem(STORAGE_KEY, city);
  } catch (err) {
    // fetchJson already showed message
  }
}

// Search by coordinates (geolocation)
async function searchCoordsAndRender(lat, lon) {
  if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
    showMessage("You must put your OpenWeatherMap API key into script.js (const apiKey).", true);
    return;
  }
  try {
    showMessage("Loading for your location...");
    const [current, forecast] = await Promise.all([
      fetchCurrentByCoords(lat, lon),
      fetchForecastByCoords(lat, lon)
    ]);
    renderToday(current);
    const daily = groupForecastToDays(forecast.list);
    renderForecast(daily);
    showMessage("");
    localStorage.setItem(STORAGE_KEY, current.name);
  } catch (err) {
    // handled in fetchJson
  }
}

// Event listeners
elements.searchBtn.addEventListener("click", () => {
  const city = elements.cityInput.value.trim();
  if (!city) { showMessage("Please enter a city name.", true); return; }
  searchCity(city);
});

elements.cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") elements.searchBtn.click();
});

elements.geoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showMessage("Geolocation is not supported in this browser.", true);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const {latitude, longitude} = pos.coords;
      searchCoordsAndRender(latitude, longitude);
    },
    err => {
      showMessage("Location permission blocked or unavailable.", true);
      console.error("Geolocation error:", err);
    }
  );
});

// On load: try last city
window.addEventListener("load", () => {
  // restore last searched city
  const lastCity = localStorage.getItem(STORAGE_KEY);
  if (lastCity) {
    elements.cityInput.value = lastCity;
    // auto-search only if user provided an apiKey
    if (apiKey && apiKey !== "") {
      searchCity(lastCity);
    } else {
      showMessage("Replace apiKey in script.js and refresh to auto-load last city.");
    }
  } else {
    showMessage("Enter a city or use 'Use my location'.");
  }
});
