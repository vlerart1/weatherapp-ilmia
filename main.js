const API = {
  forecast: 'https://api.open-meteo.com/v1/forecast',
  geocoding: 'https://geocoding-api.open-meteo.com/v1/search',
  airQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality'
};

const DEFAULT_LOCATION = { name: 'New York', country: 'United States', latitude: 40.7128, longitude: -74.006 };
const WEATHER_CACHE_TTL = 10 * 60 * 1000;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const el = {
  app: $('#app'), status: $('#status-message'), loading: $('#loading-panel'), content: $('#weather-content'),
  form: $('#search-form'), search: $('#location-search'), suggestions: $('#location-suggestions'),
  locationButton: $('#use-location'), favoriteCurrent: $('#favorite-current'), heroFavorite: $('#hero-favorite'),
  locationName: $('#location-name'), headingLocation: $('#heading-location'), localDate: $('#local-date'),
  temperature: $('#current-temperature'), icon: $('#current-icon'), description: $('#condition-description'),
  feelsLike: $('#feels-like'), highLow: $('#high-low'), metrics: $('#weather-metrics'),
  hourlyPreview: $('#hourly-preview'), hourlyExpanded: $('#hourly-expanded'), dailyPreview: $('#daily-preview'),
  dailyExtended: $('#daily-extended'), dayDetail: $('#day-detail'), updated: $('#updated-time'),
  sunrise: $('#sunrise-time'), sunset: $('#sunset-time'), daylight: $('#daylight-duration'),
  sunProgress: $('#sun-progress'), sunPosition: $('#sun-position'), chart: $('#weather-chart'),
  forecastChart: $('#forecast-chart'), pageTitle: $('#page-title'), sidebar: $('#sidebar')
};

const state = {
  location: readStored('weatherline.location', DEFAULT_LOCATION),
  weather: null,
  airQuality: null,
  favorites: readStored('weatherline.favorites', []),
  recent: readStored('weatherline.recent', []),
  settings: { temperature: 'celsius', wind: 'kmh', pressure: 'hpa', distance: 'km', theme: 'system', ...readStored('weatherline.settings', {}) },
  chartMetric: 'temperature',
  selectedForCompare: readStored('weatherline.compare', []),
  currentView: 'home',
  selectedDay: -1,
  map: null,
  weatherRequestId: 0,
  searchRequestId: 0
};

const weatherDescriptions = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle', 56: 'Freezing drizzle', 57: 'Dense freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Rain showers', 81: 'Rain showers',
  82: 'Heavy showers', 85: 'Snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm',
  96: 'Thunderstorm with hail', 99: 'Severe thunderstorm'
};
const glyphs = { clear: '☀', cloudy: '☁', fog: '〰', rain: '☂', snow: '❄', storm: '⚡', night: '☾' };
const forecastCache = new Map();
const geocodingCache = new Map();
let searchTimer;
let searchController;
let weatherController;
let airController;

function readStored(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function persist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}

function locationKey(place) {
  return `${Number(place.latitude).toFixed(3)},${Number(place.longitude).toFixed(3)}`;
}

function sameLocation(first, second) {
  return Boolean(first && second && locationKey(first) === locationKey(second));
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) {
    const error = new Error(data?.reason || `Service returned ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function forecastUrl(place) {
  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,visibility,uv_index',
    hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,visibility,wind_speed_10m,pressure_msl',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,sunrise,sunset,uv_index_max',
    forecast_days: '14', timezone: 'auto', temperature_unit: 'celsius', wind_speed_unit: 'kmh'
  });
  return `${API.forecast}?${params}`;
}

async function getForecast(place, signal, useCache = true) {
  const key = locationKey(place);
  const memory = forecastCache.get(key);
  if (useCache && memory && Date.now() - memory.savedAt < WEATHER_CACHE_TTL) return memory.data;
  const saved = readStored(`weatherline.forecast.${key}`, null);
  if (useCache && saved && Date.now() - saved.savedAt < WEATHER_CACHE_TTL) {
    forecastCache.set(key, saved);
    return saved.data;
  }
  const data = await fetchJson(forecastUrl(place), signal);
  const entry = { data, savedAt: Date.now() };
  forecastCache.set(key, entry);
  persist(`weatherline.forecast.${key}`, entry);
  return data;
}

async function loadWeather(place, options = {}) {
  if (!Number.isFinite(Number(place.latitude)) || !Number.isFinite(Number(place.longitude))) return;
  const requestId = ++state.weatherRequestId;
  weatherController?.abort();
  airController?.abort();
  weatherController = new AbortController();
  const signal = weatherController.signal;
  const cached = readStored(`weatherline.forecast.${locationKey(place)}`, null);
  setLoading(true);
  clearStatus();
  el.locationButton.disabled = true;
  try {
    const weather = await getForecast(place, signal, !options.force);
    if (requestId !== state.weatherRequestId) return;
    state.location = place;
    state.weather = weather;
    state.airQuality = null;
    persist('weatherline.location', place);
    addRecent(place);
    renderWeather();
    el.content.hidden = false;
    el.loading.hidden = true;
    loadAirQuality(place, requestId);
    refreshMapIfVisible();
    if (options.openDetails) navigateTo('detail');
  } catch (error) {
    if (error.name === 'AbortError' || requestId !== state.weatherRequestId) return;
    if (!state.weather && cached?.data?.current) {
      state.location = place;
      state.weather = cached.data;
      renderWeather();
      el.content.hidden = false;
      el.loading.hidden = true;
      showStatus(`Showing saved weather from ${formatAge(cached.savedAt)}. Refresh when you're back online.`);
    } else {
      showStatus(weatherErrorMessage(error), true);
      if (!state.weather) el.loading.hidden = true;
    }
  } finally {
    if (requestId === state.weatherRequestId) {
      setLoading(false);
      el.locationButton.disabled = false;
      weatherController = null;
    }
  }
}

async function loadAirQuality(place, requestId) {
  airController = new AbortController();
  const params = new URLSearchParams({
    latitude: place.latitude, longitude: place.longitude,
    hourly: 'us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,carbon_monoxide',
    forecast_hours: '24', timezone: 'auto'
  });
  try {
    const data = await fetchJson(`${API.airQuality}?${params}`, airController.signal);
    if (requestId !== state.weatherRequestId) return;
    state.airQuality = data;
    renderAirQuality();
  } catch (error) {
    if (error.name !== 'AbortError' && requestId === state.weatherRequestId) renderAirUnavailable();
  }
}

function setLoading(loading) {
  el.app.setAttribute('aria-busy', String(loading));
  if (loading && !state.weather) { el.loading.hidden = false; el.content.hidden = true; }
  if (!loading && state.weather) el.content.hidden = false;
}

function showStatus(message, isError = false) {
  el.status.textContent = message;
  el.status.classList.toggle('is-error', isError);
}

function clearStatus() {
  el.status.textContent = '';
  el.status.classList.remove('is-error');
}

function weatherErrorMessage(error) {
  if (!navigator.onLine) return 'You appear to be offline. Check your connection and try again.';
  if (error.status === 429) return 'The weather service is busy. Wait a moment and try again.';
  if (error.status >= 500) return 'The weather service is temporarily unavailable. Try again shortly.';
  return 'Weather could not be loaded. Check your connection and try again.';
}

function formatAge(timestamp) {
  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
  return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} hr ago`;
}

function addRecent(place) {
  state.recent = [place, ...state.recent.filter((item) => !sameLocation(item, place))].slice(0, 6);
  persist('weatherline.recent', state.recent);
  renderLocations();
}

function handleSearchInput() {
  clearTimeout(searchTimer);
  const query = el.search.value.trim();
  if (query.length < 2) { searchController?.abort(); closeSuggestions(); return; }
  searchTimer = setTimeout(() => searchLocations(query), 300);
}

async function searchLocations(query) {
  const key = query.toLocaleLowerCase();
  if (geocodingCache.has(key)) { showSuggestions(geocodingCache.get(key)); return; }
  searchController?.abort();
  searchController = new AbortController();
  const controller = searchController;
  const requestId = ++state.searchRequestId;
  const params = new URLSearchParams({ name: query, count: '7', language: 'en', format: 'json' });
  try {
    const data = await fetchJson(`${API.geocoding}?${params}`, controller.signal);
    if (requestId !== state.searchRequestId) return;
    const places = (data.results || []).map((result) => ({
      name: result.name, country: result.country, admin1: result.admin1,
      latitude: result.latitude, longitude: result.longitude
    }));
    geocodingCache.set(key, places);
    showSuggestions(places);
  } catch (error) {
    if (error.name !== 'AbortError' && requestId === state.searchRequestId) showSuggestions([], 'Location search is unavailable. Check your connection and try again.');
  }
}

function showSuggestions(places, emptyMessage = 'No matching places. Try adding a region or country.') {
  el.suggestions.replaceChildren();
  if (!places.length) {
    const empty = document.createElement('li');
    empty.className = 'suggestion-empty'; empty.textContent = emptyMessage;
    el.suggestions.append(empty);
  } else {
    places.forEach((place, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button'; button.id = `location-option-${index}`;
      button.className = 'suggestion-option'; button.setAttribute('role', 'option'); button.setAttribute('aria-selected', 'false');
      const name = document.createElement('span'); name.textContent = place.name;
      const detail = document.createElement('small'); detail.textContent = [place.admin1, place.country].filter(Boolean).join(', ');
      button.append(name, detail);
      button.addEventListener('click', () => selectLocation(place));
      item.append(button); el.suggestions.append(item);
    });
  }
  el.suggestions.hidden = false;
  el.search.setAttribute('aria-expanded', 'true');
}

function closeSuggestions() {
  el.suggestions.hidden = true;
  el.search.setAttribute('aria-expanded', 'false');
  el.search.removeAttribute('aria-activedescendant');
}

function selectLocation(place) {
  closeSuggestions(); el.search.value = ''; loadWeather(place);
}

el.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = el.search.value.trim();
  if (!query) { showStatus('Enter a city, region, or country to search.', true); el.search.focus(); }
  else if (query.length < 2) showStatus('Enter at least two characters to search.', true);
  else { showStatus('Searching places…'); await searchLocations(query); }
});
el.search.addEventListener('input', handleSearchInput);
el.search.addEventListener('keydown', (event) => {
  const options = $$('[role="option"]:not(.suggestion-empty)', el.suggestions);
  const active = options.findIndex((option) => option.getAttribute('aria-selected') === 'true');
  if (event.key === 'Escape') closeSuggestions();
  if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && options.length) {
    event.preventDefault();
    const next = (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options.forEach((option, index) => option.setAttribute('aria-selected', String(index === next)));
    el.search.setAttribute('aria-activedescendant', options[next].id);
  }
  if (event.key === 'Enter' && active >= 0 && !el.suggestions.hidden) { event.preventDefault(); options[active].click(); }
});
document.addEventListener('click', (event) => { if (!event.target.closest('.search-area')) closeSuggestions(); });

function useCurrentLocation() {
  if (!navigator.geolocation) { showStatus('Location access is not available in this browser. Search for a place instead.', true); return; }
  el.locationButton.disabled = true; showStatus('Finding your location…');
  navigator.geolocation.getCurrentPosition((position) => {
    loadWeather({ name: 'Current location', country: '', latitude: position.coords.latitude, longitude: position.coords.longitude });
  }, (error) => {
    const message = error.code === error.PERMISSION_DENIED ? 'Location permission was denied. Search for a place instead.'
      : error.code === error.TIMEOUT ? 'Your location could not be found in time. Try again or search for a place.'
        : 'Your location is unavailable. Search for a place instead.';
    showStatus(message, true); el.locationButton.disabled = false;
  }, { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 });
}
el.locationButton.addEventListener('click', useCurrentLocation);

function weatherCategory(code) {
  if ([0, 1].includes(code)) return 'clear';
  if ([2, 3].includes(code)) return 'cloudy';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return 'cloudy';
}

function conditionGlyph(code, isDay = true) {
  const category = weatherCategory(code);
  return !isDay && ['clear', 'cloudy'].includes(category) ? glyphs.night : glyphs[category];
}

function formatTemperature(value) {
  if (!Number.isFinite(value)) return '--°';
  const converted = state.settings.temperature === 'fahrenheit' ? value * 9 / 5 + 32 : value;
  return `${Math.round(converted)}°`;
}

function formatWind(value) {
  if (!Number.isFinite(value)) return '--';
  const factors = { kmh: 1, mph: 0.621371, ms: 1 / 3.6 };
  const units = { kmh: 'km/h', mph: 'mph', ms: 'm/s' };
  return `${Math.round(value * factors[state.settings.wind])} ${units[state.settings.wind]}`;
}

function formatPressure(value) {
  if (!Number.isFinite(value)) return '--';
  return state.settings.pressure === 'inhg' ? `${(value * 0.02953).toFixed(2)} inHg` : `${Math.round(value)} hPa`;
}

function formatVisibility(meters) {
  if (!Number.isFinite(meters)) return '--';
  return state.settings.distance === 'mi' ? `${(meters / 1609.344).toFixed(1)} mi` : `${(meters / 1000).toFixed(1)} km`;
}

function formatTime(value) {
  const match = typeof value === 'string' && value.match(/T(\d{2}):(\d{2})/);
  if (!match) return '--';
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function formatDate(value, timezone) {
  const dateText = typeof value === 'string' ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: timezone || 'UTC' }).format(new Date(`${dateText}T12:00:00Z`));
}

function formatWeekday(value, index) {
  if (index === 0) return 'Today';
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}

function valueOrDash(value, decimals = 0) { return Number.isFinite(value) ? value.toFixed(decimals) : '--'; }
function windCompass(degrees) { return Number.isFinite(degrees) ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8] : ''; }

function renderWeather() {
  if (!state.weather) return;
  const weather = state.weather;
  const current = weather.current || {};
  const daily = weather.daily || {};
  const place = [state.location.name, state.location.admin1, state.location.country].filter(Boolean);
  const placeText = [...new Set(place)].join(', ') || 'Your location';
  $('#heading-location').textContent = placeText;
  el.locationName.textContent = state.location.name || 'Your location';
  $('#location-context').textContent = `${state.location.country || 'LOCAL'} · CURRENT CONDITIONS`;
  $('#footer-place').textContent = `Forecast for ${placeText}`;
  el.localDate.textContent = formatDate(current.time, weather.timezone);
  el.description.textContent = weatherDescriptions[current.weather_code] || 'Conditions unavailable';
  el.temperature.textContent = formatTemperature(current.temperature_2m);
  el.icon.textContent = conditionGlyph(current.weather_code, current.is_day !== 0);
  el.feelsLike.textContent = `Feels like ${formatTemperature(current.apparent_temperature)}`;
  el.highLow.innerHTML = `H ${formatTemperature(daily.temperature_2m_max?.[0])} <i></i> L ${formatTemperature(daily.temperature_2m_min?.[0])}`;
  $('#weather-hero').dataset.sky = weatherCategory(current.weather_code);
  $('#weather-hero').dataset.day = current.is_day === 0 ? 'night' : 'day';
  el.updated.textContent = `Updated ${formatTime(current.time)}`;
  renderSun(weather);
  renderMetrics(weather, el.metrics);
  renderAirQuality();
  renderHourly(weather, el.hourlyPreview, 8);
  renderHourly(weather, el.hourlyExpanded, 24);
  renderDaily(weather, el.dailyPreview, 7);
  renderDaily(weather, el.dailyExtended, 14);
  renderDaily(weather, $('#detail-daily'), 14);
  renderChart(el.chart, $('#chart-tooltip'), 800, 220);
  renderChart(el.forecastChart, $('#forecast-tooltip'), 1000, 270);
  renderDetailPage();
  updateFavoriteButtons();
}

function renderMetrics(weather, target) {
  const current = weather.current || {};
  const hourly = weather.hourly || {};
  const index = Math.max(0, (hourly.time || []).findIndex((time) => time >= (current.time || '')));
  const humidity = current.relative_humidity_2m;
  const temp = current.temperature_2m;
  const dewPoint = Number.isFinite(temp) && Number.isFinite(humidity)
    ? (243.04 * (Math.log(humidity / 100) + 17.625 * temp / (243.04 + temp))) / (17.625 - Math.log(humidity / 100) - 17.625 * temp / (243.04 + temp))
    : null;
  const values = [
    ['Humidity', `${valueOrDash(humidity)}%`, 'Relative humidity', '◌'],
    ['Wind', `${formatWind(current.wind_speed_10m)} ${windCompass(current.wind_direction_10m)}`, 'Speed · direction', '↗'],
    ['Pressure', formatPressure(current.pressure_msl), 'Sea-level pressure', '⌁'],
    ['Visibility', formatVisibility(current.visibility ?? hourly.visibility?.[index]), 'Viewing distance', '◎'],
    ['UV index', valueOrDash(current.uv_index ?? weather.daily?.uv_index_max?.[0], 1), 'Peak for today', '☼'],
    ['Dew point', formatTemperature(dewPoint), 'Comfort indicator', '°'],
    ['Sunrise', formatTime(weather.daily?.sunrise?.[0]), 'Local time', '↗'],
    ['Sunset', formatTime(weather.daily?.sunset?.[0]), 'Local time', '↘']
  ];
  target.replaceChildren(...values.map(([label, value, detail, symbol]) => {
    const item = document.createElement('article'); item.className = 'metric-item';
    const top = document.createElement('div'); top.className = 'metric-top';
    const title = document.createElement('h3'); title.textContent = label;
    const icon = document.createElement('span'); icon.setAttribute('aria-hidden', 'true'); icon.textContent = symbol;
    top.append(title, icon);
    const reading = document.createElement('p'); reading.className = 'metric-value'; reading.textContent = value;
    const caption = document.createElement('p'); caption.className = 'metric-caption'; caption.textContent = detail;
    item.append(top, reading, caption); return item;
  }));
}

function renderSun(weather) {
  const sunrise = weather.daily?.sunrise?.[0];
  const sunset = weather.daily?.sunset?.[0];
  el.sunrise.textContent = formatTime(sunrise);
  el.sunset.textContent = formatTime(sunset);
  const start = localMinute(sunrise); const end = localMinute(sunset); const now = localMinute(weather.current?.time);
  const duration = end - start;
  if (duration <= 0) { el.daylight.textContent = '--'; return; }
  el.daylight.textContent = `${Math.floor(duration / 60)}h ${duration % 60}m`;
  const progress = Math.max(0, Math.min(1, (now - start) / duration));
  const x = 18 + 264 * progress;
  const y = 104 - 79 * Math.sin(Math.PI * progress);
  el.sunProgress.setAttribute('d', `M18 104 Q${(18 + x) / 2} ${Math.min(104, y - 18)} ${x} ${y}`);
  el.sunPosition.setAttribute('cx', x.toFixed(1)); el.sunPosition.setAttribute('cy', y.toFixed(1));
  $('#sun-visualization').setAttribute('aria-label', `Sunrise ${formatTime(sunrise)}, sunset ${formatTime(sunset)}, ${el.daylight.textContent} of daylight`);
}

function localMinute(value) {
  const match = typeof value === 'string' && value.match(/T(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

function renderHourly(weather, container, limit) {
  if (!container) return;
  const hourly = weather.hourly || {}; const times = hourly.time || [];
  if (!times.length) { container.innerHTML = '<p class="forecast-empty">Hourly details are not available for this location.</p>'; return; }
  const now = weather.current?.time || '';
  let start = times.findIndex((time) => time >= now); if (start < 0) start = 0;
  container.replaceChildren(...times.slice(start, start + limit).map((time, offset) => {
    const index = start + offset; const code = hourly.weather_code?.[index];
    const item = document.createElement('article'); item.className = 'hour-item';
    const timeLabel = document.createElement('span'); timeLabel.className = 'hour-time'; timeLabel.textContent = offset === 0 ? 'Now' : formatTime(time);
    const icon = document.createElement('span'); icon.className = 'forecast-glyph'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = conditionGlyph(code);
    const label = document.createElement('span'); label.className = 'sr-only'; label.textContent = weatherDescriptions[code] || 'Conditions unavailable';
    const temperature = document.createElement('strong'); temperature.className = 'hour-temperature'; temperature.textContent = formatTemperature(hourly.temperature_2m?.[index]);
    const rain = document.createElement('span'); rain.className = 'hour-precipitation';
    const chance = hourly.precipitation_probability?.[index]; rain.textContent = Number.isFinite(chance) && chance > 0 ? `${Math.round(chance)}% rain` : ' ';
    const wind = document.createElement('span'); wind.className = 'hour-wind'; wind.textContent = Number.isFinite(hourly.wind_speed_10m?.[index]) ? formatWind(hourly.wind_speed_10m[index]) : ' ';
    item.append(timeLabel, icon, label, temperature, rain, wind); return item;
  }));
}

function renderDaily(weather, container, limit) {
  if (!container) return;
  const daily = weather.daily || {}; const dates = (daily.time || []).slice(0, limit);
  if (!dates.length) { container.innerHTML = '<p class="forecast-empty">Daily forecast is not available for this location.</p>'; return; }
  container.replaceChildren(...dates.map((date, index) => {
    const code = daily.weather_code?.[index];
    const row = document.createElement('button'); row.type = 'button'; row.className = 'day-row';
    row.setAttribute('aria-expanded', String(state.selectedDay === index && !el.dayDetail.hidden));
    row.addEventListener('click', () => showDayDetail(weather, index));
    const day = document.createElement('span'); day.className = 'day-name'; day.textContent = formatWeekday(date, index);
    const icon = document.createElement('span'); icon.className = 'forecast-glyph'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = conditionGlyph(code);
    const desc = document.createElement('span'); desc.className = 'day-description'; desc.textContent = weatherDescriptions[code] || 'Conditions unavailable';
    const chance = document.createElement('span'); chance.className = 'day-rain';
    const probability = daily.precipitation_probability_max?.[index]; chance.textContent = Number.isFinite(probability) && probability > 0 ? `${Math.round(probability)}%` : '—';
    const wind = document.createElement('span'); wind.className = 'day-wind'; wind.textContent = formatWind(daily.wind_speed_10m_max?.[index]);
    const low = document.createElement('span'); low.className = 'day-low'; low.textContent = formatTemperature(daily.temperature_2m_min?.[index]);
    const high = document.createElement('strong'); high.className = 'day-high'; high.textContent = formatTemperature(daily.temperature_2m_max?.[index]);
    row.append(day, icon, desc, chance, wind, low, high); return row;
  }));
}

function showDayDetail(weather, index) {
  const daily = weather.daily || {}; if (!daily.time?.[index]) return;
  state.selectedDay = index;
  const title = document.createElement('strong');
  title.textContent = `${formatWeekday(daily.time[index], index)} · ${weatherDescriptions[daily.weather_code?.[index]] || 'Conditions unavailable'}`;
  const detail = document.createElement('span');
  const chance = daily.precipitation_probability_max?.[index];
  detail.textContent = `High ${formatTemperature(daily.temperature_2m_max?.[index])} · Low ${formatTemperature(daily.temperature_2m_min?.[index])} · Rain ${Number.isFinite(chance) ? `${chance}%` : 'not available'} · Wind ${formatWind(daily.wind_speed_10m_max?.[index])} · UV ${valueOrDash(daily.uv_index_max?.[index], 1)}`;
  el.dayDetail.replaceChildren(title, detail); el.dayDetail.hidden = false;
  renderDaily(weather, el.dailyExtended, 14); renderDaily(weather, $('#detail-daily'), 14);
}

function renderAirQuality() {
  if (!state.airQuality) return renderAirUnavailable();
  const hourly = state.airQuality.hourly || {};
  let index = (hourly.time || []).findIndex((time) => time >= (state.weather?.current?.time || ''));
  if (index < 0) index = 0;
  const aqi = hourly.us_aqi?.[index]; if (!Number.isFinite(aqi)) return renderAirUnavailable();
  const assessment = aqi <= 50 ? ['Good', 'Air quality is satisfactory. Enjoy your usual outdoor activities.']
    : aqi <= 100 ? ['Moderate', 'Sensitive groups may wish to limit prolonged outdoor exertion.']
      : aqi <= 150 ? ['Unhealthy for sensitive groups', 'Sensitive groups should reduce prolonged outdoor exertion.']
        : aqi <= 200 ? ['Unhealthy', 'Consider reducing prolonged outdoor activity.']
          : aqi <= 300 ? ['Very unhealthy', 'Limit outdoor activity, especially for sensitive groups.']
            : ['Hazardous', 'Avoid prolonged outdoor exertion and follow local health guidance.'];
  $('#air-value').textContent = Math.round(aqi); $('#air-category').textContent = assessment[0]; $('#air-advice').textContent = assessment[1];
  $('#aqi-marker').style.left = `${Math.min(100, Math.max(0, aqi / 300 * 100))}%`;
  $('#air-dot').style.background = aqi <= 50 ? '#4e9b73' : aqi <= 100 ? '#b2a63f' : aqi <= 150 ? '#d18b43' : '#c65349';
  const pollutants = [['PM2.5', hourly.pm2_5?.[index]], ['PM10', hourly.pm10?.[index]], ['O₃', hourly.ozone?.[index]], ['NO₂', hourly.nitrogen_dioxide?.[index]], ['CO', hourly.carbon_monoxide?.[index]]];
  $('#pollutant-list').replaceChildren(...pollutants.map(([name, value]) => {
    const item = document.createElement('span'); item.textContent = `${name} ${valueOrDash(value, 1)} μg/m³`; return item;
  }));
}

function renderAirUnavailable() {
  $('#air-value').textContent = '--'; $('#air-category').textContent = 'Unavailable';
  $('#air-advice').textContent = 'Air quality data is temporarily unavailable for this place.';
  $('#aqi-marker').style.left = '0%'; $('#pollutant-list').replaceChildren();
}

function chartSeries(metric) {
  const hourly = state.weather?.hourly || {}; const times = hourly.time || [];
  let start = times.findIndex((time) => time >= (state.weather?.current?.time || '')); if (start < 0) start = 0;
  const keys = { temperature: 'temperature_2m', precipitation: 'precipitation_probability', wind: 'wind_speed_10m', humidity: 'relative_humidity_2m', pressure: 'pressure_msl' };
  const titles = { temperature: 'Temperature', precipitation: 'Precipitation chance', wind: 'Wind speed', humidity: 'Humidity', pressure: 'Pressure' };
  const units = { temperature: state.settings.temperature === 'fahrenheit' ? '°F' : '°C', precipitation: '%', wind: state.settings.wind === 'mph' ? 'mph' : state.settings.wind === 'ms' ? 'm/s' : 'km/h', humidity: '%', pressure: state.settings.pressure === 'inhg' ? 'inHg' : 'hPa' };
  return { labels: times.slice(start, start + 24).map(formatTime), raw: (hourly[keys[metric]] || []).slice(start, start + 24), unit: units[metric], title: titles[metric], metric };
}

function chartValue(value, metric) {
  if (!Number.isFinite(value)) return null;
  if (metric === 'temperature' && state.settings.temperature === 'fahrenheit') return value * 9 / 5 + 32;
  if (metric === 'wind') return value * (state.settings.wind === 'mph' ? 0.621371 : state.settings.wind === 'ms' ? 1 / 3.6 : 1);
  if (metric === 'pressure' && state.settings.pressure === 'inhg') return value * 0.02953;
  return value;
}

function renderChart(svg, tooltip, width, height) {
  if (!svg || !state.weather) return;
  const series = chartSeries(state.chartMetric); const values = series.raw.map((value) => chartValue(value, series.metric));
  const valid = values.filter(Number.isFinite); svg.replaceChildren(); svg.setAttribute('aria-label', `${series.title} over the next 24 hours`);
  if (!valid.length) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', width / 2); text.setAttribute('y', height / 2); text.setAttribute('text-anchor', 'middle'); text.setAttribute('class', 'chart-empty-label'); text.textContent = 'This forecast detail is unavailable'; svg.append(text); return;
  }
  const pad = { top: 20, right: 24, bottom: 38, left: 38 };
  let min = Math.min(...valid); let max = Math.max(...valid); if (min === max) { min -= 1; max += 1; }
  const span = max - min; min -= span * .16; max += span * .18;
  const plotWidth = width - pad.left - pad.right; const plotHeight = height - pad.top - pad.bottom;
  const points = values.map((value, index) => ({
    x: pad.left + (values.length <= 1 ? 0 : index / (values.length - 1) * plotWidth),
    y: pad.top + plotHeight - ((value - min) / (max - min) * plotHeight), value, index
  })).filter((point) => Number.isFinite(point.value));
  for (let row = 0; row < 4; row += 1) {
    const y = pad.top + row / 3 * plotHeight; const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', pad.left); line.setAttribute('x2', width - pad.right); line.setAttribute('y1', y); line.setAttribute('y2', y); line.setAttribute('class', 'chart-gridline'); svg.append(line);
  }
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  area.setAttribute('d', `${path} L ${points.at(-1).x} ${height - pad.bottom} L ${points[0].x} ${height - pad.bottom} Z`); area.setAttribute('class', 'chart-area');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path'); line.setAttribute('d', path); line.setAttribute('class', 'chart-line'); svg.append(area, line);
  points.forEach((point) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', point.x); circle.setAttribute('cy', point.y); circle.setAttribute('r', width > 900 ? 4 : 3.5);
    circle.setAttribute('class', 'chart-point'); circle.setAttribute('tabindex', '0'); circle.setAttribute('role', 'img');
    const detail = `${series.labels[point.index]}: ${point.value.toFixed(1)} ${series.unit}`; circle.setAttribute('aria-label', detail);
    circle.addEventListener('pointerenter', (event) => showChartTooltip(tooltip, detail, event, point, svg));
    circle.addEventListener('pointermove', (event) => showChartTooltip(tooltip, detail, event, point, svg));
    circle.addEventListener('pointerleave', () => { tooltip.hidden = true; });
    circle.addEventListener('focus', () => showChartTooltip(tooltip, detail, null, point, svg));
    circle.addEventListener('blur', () => { tooltip.hidden = true; }); svg.append(circle);
  });
  [...new Set([0, Math.floor((series.labels.length - 1) / 3), Math.floor((series.labels.length - 1) * 2 / 3), series.labels.length - 1])].forEach((index) => {
    if (!series.labels[index]) return;
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', pad.left + index / Math.max(1, series.labels.length - 1) * plotWidth); label.setAttribute('y', height - 9);
    label.setAttribute('text-anchor', 'middle'); label.setAttribute('class', 'chart-axis-label'); label.textContent = series.labels[index]; svg.append(label);
  });
}

function showChartTooltip(tooltip, text, event, point, svg) {
  tooltip.textContent = text; tooltip.hidden = false;
  const wrap = svg.parentElement; const bounds = wrap.getBoundingClientRect();
  if (event) {
    const rect = event.currentTarget.getBoundingClientRect();
    tooltip.style.left = `${Math.min(bounds.width - tooltip.offsetWidth - 8, Math.max(8, rect.left - bounds.left + rect.width / 2))}px`;
    tooltip.style.top = `${Math.max(5, rect.top - bounds.top - 36)}px`;
  } else {
    tooltip.style.left = `${Math.min(bounds.width - tooltip.offsetWidth - 8, Math.max(8, point.x / Number(svg.viewBox.baseVal.width) * bounds.width))}px`;
    tooltip.style.top = `${Math.max(5, point.y / Number(svg.viewBox.baseVal.height) * bounds.height - 36)}px`;
  }
}

function updateCharts() {
  const labels = { temperature: 'Temperature', precipitation: 'Precipitation chance', wind: 'Wind speed', humidity: 'Humidity', pressure: 'Pressure' };
  $$('[data-chart]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.chart === state.chartMetric)));
  $('#chart-unit').textContent = labels[state.chartMetric]; $('#forecast-chart-unit').textContent = labels[state.chartMetric];
  renderChart(el.chart, $('#chart-tooltip'), 800, 220); renderChart(el.forecastChart, $('#forecast-tooltip'), 1000, 270);
}

document.addEventListener('click', (event) => {
  const chartButton = event.target.closest('[data-chart]');
  if (chartButton) { state.chartMetric = chartButton.dataset.chart; updateCharts(); }
  const navLink = event.target.closest('[data-page]');
  if (navLink) { event.preventDefault(); navigateTo(navLink.dataset.page); }
  const navButton = event.target.closest('[data-navigate]');
  if (navButton) navigateTo(navButton.dataset.navigate);
});

function navigateTo(page, updateHash = true) {
  const pages = ['home', 'forecast', 'map', 'locations', 'compare', 'alerts', 'settings', 'detail'];
  state.currentView = pages.includes(page) ? page : 'home';
  if (updateHash && location.hash.slice(1) !== state.currentView) history.pushState(null, '', `#${state.currentView}`);
  $$('.page-view').forEach((view) => { view.hidden = view.dataset.view !== state.currentView; });
  const labels = { home: 'Overview', forecast: 'Forecast', map: 'Weather map', locations: 'Locations', compare: 'Compare', alerts: 'Alerts', settings: 'Settings', detail: 'Weather details' };
  el.pageTitle.textContent = labels[state.currentView];
  $$('[data-page]').forEach((link) => {
    const active = link.dataset.page === state.currentView || (state.currentView === 'detail' && link.dataset.page === 'home');
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  el.sidebar.classList.remove('is-open'); $('#mobile-menu').setAttribute('aria-expanded', 'false');
  if (state.currentView === 'locations') renderLocations();
  if (state.currentView === 'compare') renderCompare();
  if (state.currentView === 'map') requestAnimationFrame(renderMap);
  if (state.currentView === 'settings') renderSettings();
  if (state.currentView === 'detail') renderDetailPage();
}
window.addEventListener('hashchange', () => navigateTo(location.hash.slice(1), false));
window.addEventListener('popstate', () => navigateTo(location.hash.slice(1), false));

function updateFavoriteButtons() {
  const saved = state.favorites.some((place) => sameLocation(place, state.location));
  el.favoriteCurrent.textContent = saved ? '★' : '☆';
  el.favoriteCurrent.setAttribute('aria-label', saved ? 'Remove current location from favorites' : 'Save current location');
  el.heroFavorite.textContent = saved ? '★' : '☆'; el.heroFavorite.setAttribute('aria-pressed', String(saved));
  el.heroFavorite.setAttribute('aria-label', saved ? 'Remove location from favorites' : 'Add location to favorites');
}

function toggleFavorite(place) {
  const exists = state.favorites.some((item) => sameLocation(item, place));
  state.favorites = exists ? state.favorites.filter((item) => !sameLocation(item, place)) : [...state.favorites, { ...place, customName: place.customName || '' }];
  persist('weatherline.favorites', state.favorites); updateFavoriteButtons(); renderLocations(); renderCompare(); refreshMapIfVisible();
}
el.favoriteCurrent.addEventListener('click', () => toggleFavorite(state.location));
el.heroFavorite.addEventListener('click', () => toggleFavorite(state.location));

function renderLocations() {
  renderLocationList($('#favorite-list'), state.favorites, true);
  renderLocationList($('#recent-list'), state.recent, false);
  $('#favorite-count').textContent = `${state.favorites.length} saved`;
}

function renderLocationList(container, places, favorites) {
  if (!container) return;
  if (!places.length) {
    const empty = document.createElement('div'); empty.className = 'location-empty';
    empty.textContent = favorites ? 'No favorites yet. Search for a place, then save it with the star.' : 'Places you view will appear here.';
    container.replaceChildren(empty); return;
  }
  container.replaceChildren(...places.map((place, index) => {
    const row = document.createElement('article'); row.className = `location-row${sameLocation(place, state.location) ? ' is-current' : ''}`;
    const select = document.createElement('button'); select.type = 'button'; select.className = 'location-select';
    const marker = document.createElement('span'); marker.className = 'location-marker'; marker.setAttribute('aria-hidden', 'true'); marker.textContent = '⌖';
    const copy = document.createElement('span'); copy.className = 'location-copy';
    const name = document.createElement('strong'); name.textContent = place.customName || place.name;
    const details = document.createElement('small'); details.textContent = [place.admin1, place.country].filter(Boolean).join(', ') || `${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}`;
    copy.append(name, details); select.append(marker, copy); select.addEventListener('click', () => loadWeather(place, { openDetails: true }));
    const controls = document.createElement('div'); controls.className = 'location-controls';
    if (favorites) {
      const rename = makeIconButton('Rename location', '✎', () => {
        const value = prompt('Name this saved place', place.customName || place.name);
        if (value?.trim()) { state.favorites[index].customName = value.trim().slice(0, 36); persist('weatherline.favorites', state.favorites); renderLocations(); renderCompare(); }
      });
      const up = makeIconButton('Move location up', '↑', () => moveFavorite(index, -1));
      const down = makeIconButton('Move location down', '↓', () => moveFavorite(index, 1));
      up.disabled = index === 0; down.disabled = index === places.length - 1;
      controls.append(rename, up, down, makeIconButton('Remove favorite', '×', () => toggleFavorite(place)));
    } else controls.append(makeIconButton('Save to favorites', '☆', () => toggleFavorite(place)));
    row.append(select, controls); return row;
  }));
}

function makeIconButton(label, symbol, action) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'small-icon-button';
  button.setAttribute('aria-label', label); button.title = label; button.textContent = symbol; button.addEventListener('click', action); return button;
}

function moveFavorite(index, offset) {
  const target = index + offset; if (target < 0 || target >= state.favorites.length) return;
  [state.favorites[index], state.favorites[target]] = [state.favorites[target], state.favorites[index]];
  persist('weatherline.favorites', state.favorites); renderLocations(); refreshMapIfVisible();
}

$('#clear-recent').addEventListener('click', () => { state.recent = []; persist('weatherline.recent', []); renderLocations(); });

function renderCompare() {
  const selection = $('#compare-selection'); if (!selection) return;
  selection.replaceChildren();
  if (!state.favorites.length) { selection.textContent = 'Save at least two favorite places to compare them.'; $('#comparison-grid').replaceChildren(); return; }
  state.selectedForCompare = state.selectedForCompare.filter((key) => state.favorites.some((place) => locationKey(place) === key));
  state.favorites.forEach((place) => {
    const label = document.createElement('label'); label.className = 'compare-choice';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = locationKey(place); checkbox.checked = state.selectedForCompare.includes(checkbox.value);
    checkbox.disabled = !checkbox.checked && state.selectedForCompare.length >= 4;
    checkbox.addEventListener('change', () => {
      state.selectedForCompare = checkbox.checked ? [...state.selectedForCompare, checkbox.value] : state.selectedForCompare.filter((key) => key !== checkbox.value);
      persist('weatherline.compare', state.selectedForCompare); renderCompare();
    });
    const name = document.createElement('span'); name.textContent = place.customName || place.name; label.append(checkbox, name); selection.append(label);
  });
  const places = state.favorites.filter((place) => state.selectedForCompare.includes(locationKey(place)));
  const grid = $('#comparison-grid');
  if (places.length < 2) { grid.textContent = 'Select at least two places to see a comparison.'; return; }
  grid.replaceChildren();
  places.forEach(async (place) => {
    const card = document.createElement('article'); card.className = 'compare-card'; card.textContent = 'Loading forecast…'; grid.append(card);
    try {
      const weather = await getForecast(place); const current = weather.current || {}; const daily = weather.daily || {};
      card.replaceChildren();
      const heading = document.createElement('h2'); heading.textContent = place.customName || place.name;
      const condition = document.createElement('p'); condition.className = 'compare-condition'; condition.textContent = weatherDescriptions[current.weather_code] || 'Conditions unavailable';
      const temperature = document.createElement('strong'); temperature.className = 'compare-temperature'; temperature.textContent = formatTemperature(current.temperature_2m);
      const range = document.createElement('p'); range.textContent = `High ${formatTemperature(daily.temperature_2m_max?.[0])} · Low ${formatTemperature(daily.temperature_2m_min?.[0])}`;
      const metrics = document.createElement('div'); metrics.className = 'compare-metrics';
      [['Humidity', `${valueOrDash(current.relative_humidity_2m)}%`], ['Wind', formatWind(current.wind_speed_10m)], ['UV', valueOrDash(daily.uv_index_max?.[0], 1)], ['Rain', `${valueOrDash(daily.precipitation_probability_max?.[0])}%`]].forEach(([key, value]) => {
        const item = document.createElement('span'); const label = document.createElement('small'); label.textContent = key; const result = document.createElement('strong'); result.textContent = value; item.append(label, result); metrics.append(item);
      });
      card.append(heading, condition, temperature, range, metrics);
    } catch { card.textContent = `Forecast unavailable for ${place.name}.`; }
  });
}

function renderMap() {
  const mapElement = $('#weather-map'); if (!mapElement || state.currentView !== 'map') return;
  if (!window.L) { mapElement.innerHTML = '<p class="map-unavailable">The map library could not be loaded. Check your connection and reload this page.</p>'; return; }
  if (!state.map) {
    state.map = L.map(mapElement, { scrollWheelZoom: false, zoomControl: true }).setView([state.location.latitude, state.location.longitude], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(state.map);
  }
  requestAnimationFrame(() => state.map?.invalidateSize());
  state.map.eachLayer((layer) => { if (layer instanceof L.Marker) state.map.removeLayer(layer); });
  const places = [state.location, ...state.favorites.filter((place) => !sameLocation(place, state.location))]; const bounds = [];
  places.forEach((place) => {
    const point = [place.latitude, place.longitude]; bounds.push(point);
    L.marker(point).addTo(state.map).bindPopup(`<strong>${escapeHtml(place.customName || place.name)}</strong><br>${escapeHtml(place.country || 'Saved place')}`).on('click', () => {
      if (!sameLocation(place, state.location)) loadWeather(place);
    });
  });
  if (bounds.length > 1) state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 }); else state.map.setView(bounds[0], 7);
  $('#map-location-count').textContent = `${places.length} ${places.length === 1 ? 'place' : 'places'} shown`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function refreshMapIfVisible() { if (state.currentView === 'map') requestAnimationFrame(renderMap); }

function renderSettings() {
  $('#theme-setting').value = state.settings.theme; $('#temperature-setting').value = state.settings.temperature;
  $('#wind-setting').value = state.settings.wind; $('#pressure-setting').value = state.settings.pressure; $('#distance-setting').value = state.settings.distance;
  $('#motion-setting').textContent = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'Reduced motion is on' : 'System motion preference';
}

function applyTheme() {
  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('meta[name="theme-color"]').content = dark ? '#17211f' : '#f4f6f3';
}

['theme', 'temperature', 'wind', 'pressure', 'distance'].forEach((setting) => {
  $(`#${setting}-setting`).addEventListener('change', (event) => {
    state.settings[setting] = event.target.value; persist('weatherline.settings', state.settings);
    applyTheme(); renderSettings(); if (state.weather) renderWeather();
    $('#settings-saved').textContent = 'Settings saved on this device.';
  });
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (state.settings.theme === 'system') applyTheme(); });

function renderDetailPage() {
  if (!state.weather) return;
  $('#detail-title').textContent = state.location.customName || state.location.name || 'Your location';
  const summary = $('#detail-summary'); summary.replaceChildren();
  const current = document.createElement('article'); current.className = 'detail-current';
  const date = document.createElement('p'); date.className = 'eyebrow'; date.textContent = formatDate(state.weather.current?.time, state.weather.timezone);
  const temperature = document.createElement('strong'); temperature.textContent = formatTemperature(state.weather.current?.temperature_2m);
  const condition = document.createElement('span'); condition.textContent = weatherDescriptions[state.weather.current?.weather_code] || 'Conditions unavailable';
  current.append(date, temperature, condition); summary.append(current);
  const sun = $('#sun-detail'); sun.replaceChildren();
  const title = document.createElement('h2'); title.textContent = 'Daylight';
  const text = document.createElement('p'); text.textContent = `Sunrise ${formatTime(state.weather.daily?.sunrise?.[0])} · ${el.daylight.textContent} daylight · Sunset ${formatTime(state.weather.daily?.sunset?.[0])}`;
  sun.append(title, text); renderMetrics(state.weather, $('#detail-metrics'));
}

$('#unit-toggle').addEventListener('click', () => {
  state.settings.temperature = state.settings.temperature === 'celsius' ? 'fahrenheit' : 'celsius';
  persist('weatherline.settings', state.settings); renderWeather();
});

$('#mobile-menu').addEventListener('click', (event) => {
  const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
  event.currentTarget.setAttribute('aria-expanded', String(!expanded)); el.sidebar.classList.toggle('is-open', !expanded);
});

window.addEventListener('online', () => { if (state.weather) loadWeather(state.location, { force: true }); });

applyTheme(); renderSettings(); renderLocations(); navigateTo(location.hash.slice(1) || 'home', false); loadWeather(state.location);
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}