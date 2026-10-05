// ============================================
// PREMIUM WEATHER APP - MAIN APPLICATION
// ============================================

// API Configuration
const WEATHER_API_KEY = 'YOUR_WEATHERAPI_KEY'; // User needs to replace this
const WEATHER_API_BASE = 'https://api.weatherapi.com/v1';

// Demo mode - set to true to use mock data without API key
const DEMO_MODE = true;

// Mapbox Configuration
const MAPBOX_API_KEY = 'YOUR_MAPBOX_API_KEY'; // User needs to replace this
const MAPBOX_STYLE = 'mapbox://styles/mapbox/dark-v11';
const MAPBOX_DEMO_MODE = true; // Set to false when using real API key

// Default location
const DEFAULT_LOCATION = {
  name: 'New York',
  country: 'United States',
  lat: 40.7128,
  lon: -74.006
};

// Cache TTL (10 minutes)
const CACHE_TTL = 10 * 60 * 1000;

// Application State
const state = {
  currentLocation: null,
  weatherData: null,
  forecastData: null,
  favorites: [],
  recent: [],
  settings: {
    temperature: 'celsius',
    wind: 'kmh',
    pressure: 'hpa',
    distance: 'km',
    timeFormat: '12',
    theme: 'system',
    animations: true,
    notificationDuration: 5000,
    enableAlerts: true
  },
  currentPage: 'home',
  loading: false,
  chartMetric: 'temperature',
  mapLayer: 'radar',
  notifications: [],
  alerts: [],
  map: null,
  mapInitialized: false
};

// DOM Elements
const elements = {
  weatherBackground: document.getElementById('weather-background'),
  headerLocation: document.getElementById('header-location'),
  locationBtn: document.getElementById('location-btn'),
  menuToggle: document.getElementById('menu-toggle'),
  sidebar: document.getElementById('sidebar'),
  searchForm: document.getElementById('search-form'),
  searchInput: document.getElementById('search-input'),
  searchSuggestions: document.getElementById('search-suggestions'),
  statusMessage: document.getElementById('status-message'),
  loadingState: document.getElementById('loading-state'),
  weatherContent: document.getElementById('weather-content'),
  notificationContainer: document.getElementById('notification-container'),
  alertsList: document.getElementById('alerts-list'),
  // Hero elements
  heroDate: document.getElementById('hero-date'),
  heroLocation: document.getElementById('hero-location'),
  heroSummary: document.getElementById('hero-summary'),
  heroTemp: document.getElementById('hero-temp'),
  heroIcon: document.getElementById('hero-icon'),
  heroCondition: document.getElementById('hero-condition'),
  heroFeels: document.getElementById('hero-feels'),
  rangeHigh: document.getElementById('range-high'),
  rangeLow: document.getElementById('range-low'),
  // Sun elements
  sunProgress: document.getElementById('sun-progress'),
  sunPosition: document.getElementById('sun-position'),
  sunriseTime: document.getElementById('sunrise-time'),
  sunsetTime: document.getElementById('sunset-time'),
  daylightDuration: document.getElementById('daylight-duration'),
  // Metrics
  metricsGrid: document.getElementById('metrics-grid'),
  // Hourly
  hourlyPreview: document.getElementById('hourly-preview'),
  hourlyExtended: document.getElementById('hourly-extended'),
  // Daily
  dailyPreview: document.getElementById('daily-preview'),
  dailyExtended: document.getElementById('daily-extended'),
  // Insights
  insightsList: document.getElementById('insights-list'),
  // Chart
  forecastChart: document.getElementById('forecast-chart'),
  chartTooltip: document.getElementById('chart-tooltip'),
  // Locations
  favoritesList: document.getElementById('favorites-list'),
  recentList: document.getElementById('recent-list'),
  clearRecent: document.getElementById('clear-recent'),
  // Settings
  settingTemperature: document.getElementById('setting-temperature'),
  settingWind: document.getElementById('setting-wind'),
  settingPressure: document.getElementById('setting-pressure'),
  settingDistance: document.getElementById('setting-distance'),
  settingTime: document.getElementById('setting-time'),
  settingTheme: document.getElementById('setting-theme'),
  settingAnimations: document.getElementById('setting-animations'),
  settingNotificationDuration: document.getElementById('setting-notification-duration'),
  settingAlerts: document.getElementById('setting-alerts')
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return document.querySelectorAll(selector);
}

function localStorageGet(key, defaultValue) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function localStorageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('LocalStorage error:', e);
  }
}

function locationKey(location) {
  return `${location.lat.toFixed(4)},${location.lon.toFixed(4)}`;
}

function isSameLocation(loc1, loc2) {
  if (!loc1 || !loc2) return false;
  return locationKey(loc1) === locationKey(loc2);
}

// ============================================
// FORMATTING FUNCTIONS
// ============================================

function formatTemperature(celsius) {
  if (celsius === null || celsius === undefined) return '--°';
  const value = state.settings.temperature === 'fahrenheit' 
    ? (celsius * 9/5) + 32 
    : celsius;
  return `${Math.round(value)}°`;
}

function formatWind(kmh) {
  if (kmh === null || kmh === undefined) return '--';
  const conversions = {
    kmh: 1,
    mph: 0.621371,
    ms: 0.277778
  };
  const units = { kmh: 'km/h', mph: 'mph', ms: 'm/s' };
  const value = kmh * conversions[state.settings.wind];
  return `${Math.round(value)} ${units[state.settings.wind]}`;
}

function formatPressure(hpa) {
  if (hpa === null || hpa === undefined) return '--';
  if (state.settings.pressure === 'inhg') {
    return `${(hpa * 0.02953).toFixed(2)} inHg`;
  }
  return `${Math.round(hpa)} hPa`;
}

function formatDistance(km) {
  if (km === null || km === undefined) return '--';
  if (state.settings.distance === 'mi') {
    return `${(km * 0.621371).toFixed(1)} mi`;
  }
  return `${km.toFixed(1)} km`;
}

function formatTime(timeString) {
  if (!timeString) return '--:--';
  const date = new Date(timeString);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  if (state.settings.timeFormat === '24') {
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}

function formatDayName(dateString, index) {
  if (index === 0) return 'Today';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function windDirection(degrees) {
  if (degrees === null || degrees === undefined) return '';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(degrees / 45) % 8];
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

function showNotification(message, type = 'info', duration = null) {
  const id = Date.now();
  const notificationDuration = duration !== null ? duration : state.settings.notificationDuration;
  const notification = { id, message, type, timestamp: Date.now() };
  
  // Check for duplicates (same message within last minute)
  const recentDuplicate = state.notifications.find(
    n => n.message === message && Date.now() - n.timestamp < 60000
  );
  if (recentDuplicate) return;
  
  state.notifications.push(notification);
  renderNotifications();
  
  // Auto-dismiss after duration
  if (notificationDuration > 0) {
    setTimeout(() => dismissNotification(id), notificationDuration);
  }
}

function dismissNotification(id) {
  const index = state.notifications.findIndex(n => n.id === id);
  if (index >= 0) {
    state.notifications.splice(index, 1);
    renderNotifications();
  }
}

function renderNotifications() {
  elements.notificationContainer.innerHTML = '';
  
  if (state.notifications.length === 0) {
    elements.notificationContainer.style.display = 'none';
    return;
  }
  
  elements.notificationContainer.style.display = 'flex';
  
  const icons = {
    alert: '⚠',
    info: 'ℹ',
    success: '✓',
    error: '✕'
  };
  
  state.notifications.forEach(notification => {
    const notifEl = document.createElement('div');
    notifEl.className = `notification ${notification.type}`;
    notifEl.dataset.id = notification.id;
    
    notifEl.innerHTML = `
      <span class="notification-icon">${icons[notification.type] || icons.info}</span>
      <div class="notification-content">
        <p class="notification-message">${notification.message}</p>
      </div>
      <button class="notification-close" aria-label="Dismiss notification">✕</button>
    `;
    
    const closeBtn = notifEl.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => dismissNotification(notification.id));
    
    elements.notificationContainer.appendChild(notifEl);
  });
}

// ============================================
// MOCK ALERT GENERATOR
// ============================================

function generateMockAlerts(weatherData) {
  const alerts = [];
  const current = weatherData.current;
  const forecastDay = weatherData.forecast.forecastday[0];
  
  // High temperature alert
  if (current.temp_c > 35) {
    alerts.push({
      id: `heat-${Date.now()}`,
      title: 'Heat Advisory',
      description: 'Dangerously hot conditions expected. Stay hydrated and avoid prolonged outdoor activities.',
      severity: 'warning',
      area: state.currentLocation.name,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      source: 'Mock Weather Service'
    });
  }
  
  // Low temperature alert
  if (current.temp_c < 0) {
    alerts.push({
      id: `freeze-${Date.now()}`,
      title: 'Freeze Warning',
      description: 'Sub-freezing temperatures expected. Protect pipes, plants, and pets.',
      severity: 'advisory',
      area: state.currentLocation.name,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      source: 'Mock Weather Service'
    });
  }
  
  // High wind alert
  if (current.wind_kph > 50) {
    alerts.push({
      id: `wind-${Date.now()}`,
      title: 'High Wind Advisory',
      description: 'Strong winds may cause damage. Secure loose outdoor objects.',
      severity: 'advisory',
      area: state.currentLocation.name,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      source: 'Mock Weather Service'
    });
  }
  
  // Heavy rain alert
  if (forecastDay.day.daily_chance_of_rain > 70) {
    alerts.push({
      id: `rain-${Date.now()}`,
      title: 'Heavy Rain Warning',
      description: 'Heavy rainfall expected. Be prepared for possible flooding.',
      severity: 'warning',
      area: state.currentLocation.name,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      source: 'Mock Weather Service'
    });
  }
  
  // Thunderstorm alert
  if (current.condition.text.toLowerCase().includes('thunder') || current.condition.text.toLowerCase().includes('storm')) {
    alerts.push({
      id: `storm-${Date.now()}`,
      title: 'Severe Thunderstorm Warning',
      description: 'Severe thunderstorms expected with possible hail and strong winds. Seek shelter.',
      severity: 'emergency',
      area: state.currentLocation.name,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      source: 'Mock Weather Service'
    });
  }
  
  // Snow alert
  if (current.condition.text.toLowerCase().includes('snow')) {
    alerts.push({
      id: `snow-${Date.now()}`,
      title: 'Winter Storm Warning',
      description: 'Heavy snow expected. Avoid travel if possible.',
      severity: 'warning',
      area: state.currentLocation.name,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      source: 'Mock Weather Service'
    });
  }
  
  // UV alert
  if (current.uv > 8) {
    alerts.push({
      id: `uv-${Date.now()}`,
      title: 'UV Warning',
      description: 'Very high UV levels expected. Use sun protection and limit exposure.',
      severity: 'advisory',
      area: state.currentLocation.name,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      source: 'Mock Weather Service'
    });
  }
  
  // General informational alert about conditions
  if (alerts.length === 0 && current.temp_c > 30) {
    alerts.push({
      id: `info-${Date.now()}`,
      title: 'Warm Weather Notice',
      description: 'Warm temperatures expected. Stay cool and hydrated.',
      severity: 'informational',
      area: state.currentLocation.name,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      source: 'Mock Weather Service'
    });
  }
  
  return alerts.slice(0, 5); // Limit to 5 alerts
}

function renderAlerts() {
  if (state.alerts.length === 0) {
    elements.alertsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✓</div>
        <h2>No Active Alerts</h2>
        <p>There are no weather alerts for your current location.</p>
      </div>
    `;
    return;
  }
  
  const severityIcons = {
    informational: 'ℹ',
    advisory: '⚠',
    warning: '⚡',
    emergency: '🚨'
  };
  
  elements.alertsList.innerHTML = state.alerts.map(alert => {
    const startTime = new Date(alert.startTime);
    const endTime = new Date(alert.endTime);
    
    return `
      <div class="alert-card severity-${alert.severity}">
        <div class="alert-icon">${severityIcons[alert.severity] || '⚠'}</div>
        <div class="alert-content">
          <div class="alert-header">
            <span class="alert-severity ${alert.severity}">${alert.severity}</span>
            <h3 class="alert-title">${alert.title}</h3>
          </div>
          <p class="alert-description">${alert.description}</p>
          <div class="alert-meta">
            <div class="alert-meta-item">
              <span>📍</span>
              <span>${alert.area}</span>
            </div>
            <div class="alert-meta-item">
              <span>🕐</span>
              <span>${formatTime(alert.startTime)} - ${formatTime(alert.endTime)}</span>
            </div>
          </div>
          <div class="alert-source">Source: ${alert.source}</div>
        </div>
      </div>
    `;
  }).join('');
}

function updateAlertBadge() {
  const severeAlerts = state.alerts.filter(a => a.severity === 'warning' || a.severity === 'emergency');
  const alertsNavItems = $$('.nav-item[data-page="alerts"], .mobile-nav-item[data-page="alerts"]');
  
  alertsNavItems.forEach(item => {
    // Remove existing badge
    const existingBadge = item.querySelector('.alert-badge');
    if (existingBadge) existingBadge.remove();
    
    // Add badge if there are severe alerts
    if (severeAlerts.length > 0) {
      const badge = document.createElement('span');
      badge.className = 'alert-badge';
      badge.textContent = severeAlerts.length;
      item.appendChild(badge);
    }
  });
}

// ============================================
// MOCK DATA FOR DEMO MODE
// ============================================

function getMockWeather(location) {
  const now = new Date();
  
  // Generate 14 days of mock data
  const forecastDays = [];
  for (let dayIndex = 0; dayIndex < 14; dayIndex++) {
    const dayDate = new Date(now.getTime() + dayIndex * 24 * 60 * 60 * 1000);
    const baseTemp = 22 + Math.sin(dayIndex / 7 * Math.PI * 2) * 5;
    
    // Generate 24 hours for this day
    const hours = [];
    for (let hourIndex = 0; hourIndex < 24; hourIndex++) {
      const hourTime = new Date(dayDate.getTime() + hourIndex * 60 * 60 * 1000);
      const hourOfDay = hourTime.getHours();
      const hourTemp = baseTemp + Math.sin(hourOfDay / 24 * Math.PI * 2) * 5;
      
      hours.push({
        time: hourTime.toISOString(),
        temp_c: hourTemp + Math.random() * 3,
        condition: {
          text: hourOfDay > 6 && hourOfDay < 18 ? 'Sunny' : 'Clear'
        },
        is_day: hourOfDay > 6 && hourOfDay < 18 ? 1 : 0,
        chance_of_rain: Math.random() > 0.7 ? Math.floor(Math.random() * 50) : 0,
        wind_kph: 10 + Math.random() * 15,
        wind_degree: Math.random() * 360,
        humidity: 50 + Math.random() * 30
      });
    }
    
    forecastDays.push({
      date: dayDate.toISOString().split('T')[0],
      day: {
        maxtemp_c: baseTemp + 5,
        mintemp_c: baseTemp - 5,
        avgtemp_c: baseTemp,
        condition: {
          text: ['Sunny', 'Partly cloudy', 'Cloudy', 'Light rain'][Math.floor(Math.random() * 4)]
        },
        daily_chance_of_rain: Math.random() > 0.6 ? Math.floor(Math.random() * 60) : 0,
        maxwind_kph: 15 + Math.random() * 20
      },
      astro: {
        sunrise: '06:30 AM',
        sunset: '07:45 PM'
      },
      hour: hours
    });
  }
  
  const currentHour = now.getHours();
  const isDay = currentHour > 6 && currentHour < 18;
  
  return {
    location: {
      name: location.name,
      country: location.country,
      lat: location.lat,
      lon: location.lon
    },
    current: {
      temp_c: 22,
      feelslike_c: 24,
      condition: {
        text: isDay ? 'Sunny' : 'Clear'
      },
      is_day: isDay ? 1 : 0,
      humidity: 55,
      wind_kph: 12,
      wind_degree: 180,
      pressure_mb: 1015,
      vis_km: 10,
      uv: isDay ? 6 : 0,
      dewpoint_c: 12,
      last_updated: now.toISOString(),
      air_quality: {
        'us-epa-index': 42
      }
    },
    forecast: {
      forecastday: forecastDays
    }
  };
}

function getMockSearchResults(query) {
  const cities = [
    { name: 'New York', country: 'United States', lat: 40.7128, lon: -74.006 },
    { name: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278 },
    { name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
    { name: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
    { name: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093 },
    { name: 'Berlin', country: 'Germany', lat: 52.5200, lon: 13.4050 },
    { name: 'Toronto', country: 'Canada', lat: 43.6532, lon: -79.3832 },
    { name: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198 }
  ];
  
  return cities.filter(city => 
    city.name.toLowerCase().includes(query.toLowerCase()) ||
    city.country.toLowerCase().includes(query.toLowerCase())
  );
}

// ============================================
// WEATHER API FUNCTIONS
// ============================================

async function fetchWeatherAPI(endpoint, params) {
  if (DEMO_MODE) {
    // Return mock data for demo
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    return getMockWeather({ name: 'Demo City', country: 'Demo Country', lat: 0, lon: 0 });
  }
  
  const url = new URL(`${WEATHER_API_BASE}${endpoint}`);
  url.searchParams.append('key', WEATHER_API_KEY);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Weather API error:', error);
    throw error;
  }
}

async function getCurrentWeather(location) {
  if (DEMO_MODE) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return getMockWeather(location);
  }
  const params = {
    q: `${location.lat},${location.lon}`,
    aqi: 'yes'
  };
  return fetchWeatherAPI('/current.json', params);
}

async function getForecast(location, days = 14) {
  if (DEMO_MODE) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return getMockWeather(location);
  }
  const params = {
    q: `${location.lat},${location.lon}`,
    days: days,
    aqi: 'yes',
    alerts: 'yes'
  };
  return fetchWeatherAPI('/forecast.json', params);
}

async function searchLocations(query) {
  if (DEMO_MODE) {
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
    return getMockSearchResults(query);
  }
  const params = { q: query };
  return fetchWeatherAPI('/search.json', params);
}

// ============================================
// CACHE FUNCTIONS
// ============================================

function getCachedData(key) {
  const cached = localStorageGet(`cache_${key}`, null);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    localStorage.removeItem(`cache_${key}`);
    return null;
  }
  
  return cached.data;
}

function setCachedData(key, data) {
  localStorageSet(`cache_${key}`, {
    data,
    timestamp: Date.now()
  });
}

// ============================================
// STATE MANAGEMENT
// ============================================

function loadState() {
  state.favorites = localStorageGet('weatherline_favorites', []);
  state.recent = localStorageGet('weatherline_recent', []);
  state.settings = { ...state.settings, ...localStorageGet('weatherline_settings', state.settings) };
  state.currentLocation = localStorageGet('weatherline_location', DEFAULT_LOCATION);
}

function saveState() {
  localStorageSet('weatherline_favorites', state.favorites);
  localStorageSet('weatherline_recent', state.recent);
  localStorageSet('weatherline_settings', state.settings);
  localStorageSet('weatherline_location', state.currentLocation);
}

function addToRecent(location) {
  state.recent = state.recent.filter(loc => !isSameLocation(loc, location));
  state.recent.unshift(location);
  state.recent = state.recent.slice(0, 10);
  saveState();
}

function toggleFavorite(location) {
  const index = state.favorites.findIndex(loc => isSameLocation(loc, location));
  if (index >= 0) {
    state.favorites.splice(index, 1);
  } else {
    state.favorites.push({ ...location, savedAt: Date.now() });
  }
  saveState();
  renderLocations();
}

// ============================================
// WEATHER CATEGORY MAPPING
// ============================================

function getWeatherCategory(condition) {
  const conditionLower = condition.toLowerCase();
  
  if (conditionLower.includes('sunny') || conditionLower.includes('clear')) {
    return 'sunny';
  }
  if (conditionLower.includes('cloud') || conditionLower.includes('overcast')) {
    return 'cloudy';
  }
  if (conditionLower.includes('rain') || conditionLower.includes('drizzle') || conditionLower.includes('shower')) {
    return 'rain';
  }
  if (conditionLower.includes('storm') || conditionLower.includes('thunder')) {
    return 'storm';
  }
  if (conditionLower.includes('snow') || conditionLower.includes('blizzard') || conditionLower.includes('sleet')) {
    return 'snow';
  }
  if (conditionLower.includes('fog') || conditionLower.includes('mist') || conditionLower.includes('haze')) {
    return 'fog';
  }
  
  return 'sunny';
}

function getWeatherIcon(condition, isDay = true) {
  const category = getWeatherCategory(condition);
  const icons = {
    sunny: isDay ? '☀' : '☾',
    cloudy: '☁',
    rain: '☂',
    storm: '⚡',
    snow: '❄',
    fog: '〰'
  };
  return icons[category] || '☀';
}

// ============================================
// WEATHER INSIGHTS GENERATION
// ============================================

function generateInsights(weather, forecast) {
  const insights = [];
  const current = weather.current;
  const forecastDay = forecast.forecast.forecastday[0];
  const hourData = forecastDay.hour;

  // Temperature insight
  if (current.temp_c) {
    const avgTemp = forecastDay.day.avgtemp_c;
    if (current.temp_c > avgTemp + 5) {
      insights.push({
        icon: '🌡',
        text: `It's warmer than usual today. Current temperature is ${Math.round(current.temp_c - avgTemp)}° above the daily average.`
      });
    } else if (current.temp_c < avgTemp - 5) {
      insights.push({
        icon: '❄',
        text: `It's cooler than usual today. Current temperature is ${Math.round(avgTemp - current.temp_c)}° below the daily average.`
      });
    }
  }

  // Rain insight
  const rainHours = hourData.filter(h => h.chance_of_rain > 50);
  if (rainHours.length > 0) {
    const firstRain = rainHours[0];
    const rainTime = new Date(firstRain.time);
    insights.push({
      icon: '☂',
      text: `Rain is most likely around ${formatTime(firstRain.time)}. There's a ${firstRain.chance_of_rain}% chance of precipitation.`
    });
  }

  // UV insight
  if (current.uv) {
    if (current.uv > 7) {
      insights.push({
        icon: '☼',
        text: `UV index is very high (${current.uv}). Consider sun protection if you're going outside.`
      });
    } else if (current.uv > 3) {
      insights.push({
        icon: '☼',
        text: `UV index is moderate (${current.uv}). Sun protection recommended for extended outdoor activities.`
      });
    }
  }

  // Wind insight
  if (current.wind_kph > 30) {
    insights.push({
      icon: '💨',
      text: `Strong winds expected today at ${formatWind(current.wind_kph)}. Secure loose outdoor items.`
    });
  }

  // Humidity insight
  if (current.humidity > 80) {
    insights.push({
      icon: '💧',
      text: `High humidity (${current.humidity}%). It may feel warmer than the actual temperature.`
    });
  } else if (current.humidity < 30) {
    insights.push({
      icon: '💧',
      text: `Low humidity (${current.humidity}%). Stay hydrated and consider using a moisturizer.`
    });
  }

  // Air quality insight
  if (current.air_quality) {
    const aqi = current.air_quality['us-epa-index'];
    if (aqi > 100) {
      insights.push({
        icon: '🌫',
        text: `Air quality is unhealthy (AQI: ${aqi}). Limit outdoor activities if possible.`
      });
    }
  }

  return insights.slice(0, 4); // Limit to 4 insights
}

// ============================================
// UI RENDERING FUNCTIONS
// ============================================

function showStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.add('visible');
  elements.statusMessage.classList.toggle('error', isError);
  
  // Also show as notification for important messages
  if (isError) {
    showNotification(message, 'error', 8000);
  }
  
  setTimeout(() => {
    elements.statusMessage.classList.remove('visible');
  }, 5000);
}

function setLoading(loading) {
  state.loading = loading;
  elements.loadingState.hidden = !loading;
  elements.weatherContent.hidden = loading;
}

function updateWeatherBackground(condition, isDay) {
  const category = getWeatherCategory(condition);
  const isNight = !isDay;
  
  let weatherType = category;
  if (isNight && (category === 'sunny' || category === 'cloudy')) {
    weatherType = 'night';
  }
  
  elements.weatherBackground.dataset.weather = weatherType;
}

function renderHero(weather, location) {
  const current = weather.current;
  const forecastDay = weather.forecast.forecastday[0];
  
  elements.heroDate.textContent = formatDate(current.last_updated);
  elements.heroLocation.textContent = location.name;
  elements.heroTemp.textContent = formatTemperature(current.temp_c);
  elements.heroIcon.textContent = getWeatherIcon(current.condition.text, current.is_day === 1);
  elements.heroCondition.textContent = current.condition.text;
  elements.heroFeels.textContent = `Feels like ${formatTemperature(current.feelslike_c)}`;
  elements.rangeHigh.textContent = `H ${formatTemperature(forecastDay.day.maxtemp_c)}`;
  elements.rangeLow.textContent = `L ${formatTemperature(forecastDay.day.mintemp_c)}`;
  
  // Natural language summary
  const summary = `${current.condition.text.toLowerCase()}. ${formatTemperature(current.temp_c)} with a high of ${formatTemperature(forecastDay.day.maxtemp_c)} today.`;
  elements.heroSummary.textContent = summary;
  
  // Update header location
  elements.headerLocation.textContent = location.name;
  
  // Update background
  updateWeatherBackground(current.condition.text, current.is_day === 1);
}

function renderSun(weather) {
  const forecastDay = weather.forecast.forecastday[0];
  const astro = forecastDay.astro;
  
  elements.sunriseTime.textContent = astro.sunrise;
  elements.sunsetTime.textContent = astro.sunset;
  
  // Calculate daylight duration
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Parse sunrise/sunset times
  const sunriseParts = astro.sunrise.match(/(\d+):(\d+)\s*(AM|PM)/i);
  const sunsetParts = astro.sunset.match(/(\d+):(\d+)\s*(AM|PM)/i);
  
  let sunriseHour, sunriseMin, sunsetHour, sunsetMin;
  
  if (sunriseParts) {
    sunriseHour = parseInt(sunriseParts[1]);
    sunriseMin = parseInt(sunriseParts[2]);
    if (sunriseParts[3].toUpperCase() === 'PM' && sunriseHour !== 12) sunriseHour += 12;
    if (sunriseParts[3].toUpperCase() === 'AM' && sunriseHour === 12) sunriseHour = 0;
  }
  
  if (sunsetParts) {
    sunsetHour = parseInt(sunsetParts[1]);
    sunsetMin = parseInt(sunsetParts[2]);
    if (sunsetParts[3].toUpperCase() === 'PM' && sunsetHour !== 12) sunsetHour += 12;
    if (sunsetParts[3].toUpperCase() === 'AM' && sunsetHour === 12) sunsetHour = 0;
  }
  
  const sunrise = new Date(today);
  sunrise.setHours(sunriseHour || 6, sunriseMin || 30, 0, 0);
  
  const sunset = new Date(today);
  sunset.setHours(sunsetHour || 19, sunsetMin || 45, 0, 0);
  
  const daylightMs = sunset - sunrise;
  const hours = Math.floor(daylightMs / (1000 * 60 * 60));
  const minutes = Math.floor((daylightMs % (1000 * 60 * 60)) / (1000 * 60));
  elements.daylightDuration.textContent = `${hours}h ${minutes}m`;
  
  // Calculate sun position (simplified)
  const progress = Math.max(0, Math.min(1, (now - sunrise) / daylightMs));
  const x = 20 + 260 * progress;
  const y = 90 - 70 * Math.sin(Math.PI * progress);
  
  elements.sunPosition.setAttribute('cx', x);
  elements.sunPosition.setAttribute('cy', y);
  elements.sunProgress.setAttribute('d', `M20 90 Q${(20 + x) / 2} ${Math.min(90, y - 10)} ${x} ${y}`);
}

function renderMetrics(weather) {
  const current = weather.current;
  const forecastDay = weather.forecast.forecastday[0];
  
  const metrics = [
    { icon: '💧', label: 'Humidity', value: `${current.humidity}%`, detail: 'Relative humidity' },
    { icon: '💨', label: 'Wind', value: `${formatWind(current.wind_kph)} ${windDirection(current.wind_degree)}`, detail: 'Speed & direction' },
    { icon: '⌁', label: 'Pressure', value: formatPressure(current.pressure_mb), detail: 'Sea level' },
    { icon: '◎', label: 'Visibility', value: formatDistance(current.vis_km), detail: 'Viewing distance' },
    { icon: '☼', label: 'UV Index', value: current.uv?.toFixed(1) || '--', detail: 'Peak today' },
    { icon: '🌡', label: 'Dew Point', value: formatTemperature(current.dewpoint_c), detail: 'Comfort level' }
  ];
  
  elements.metricsGrid.innerHTML = metrics.map(metric => `
    <div class="metric-card">
      <div class="metric-icon">${metric.icon}</div>
      <div class="metric-value">${metric.value}</div>
      <div class="metric-label">${metric.label}</div>
    </div>
  `).join('');
}

function renderHourly(weather, container, limit = 8) {
  const forecastDay = weather.forecast.forecastday[0];
  const hours = forecastDay.hour;
  const currentHour = new Date().getHours();
  
  const startIndex = hours.findIndex(h => new Date(h.time).getHours() === currentHour);
  const relevantHours = startIndex >= 0 ? hours.slice(startIndex, startIndex + limit) : hours.slice(0, limit);
  
  container.innerHTML = relevantHours.map((hour, index) => `
    <div class="hourly-card ${index === 0 ? 'current' : ''}">
      <div class="hourly-time">${index === 0 ? 'Now' : formatTime(hour.time)}</div>
      <div class="hourly-icon">${getWeatherIcon(hour.condition.text, hour.is_day === 1)}</div>
      <div class="hourly-temp">${formatTemperature(hour.temp_c)}</div>
      <div class="hourly-rain">${hour.chance_of_rain > 0 ? `${hour.chance_of_rain}%` : ''}</div>
    </div>
  `).join('');
  
  // Store hourly data for chart
  container.dataset.hours = JSON.stringify(relevantHours);
}

function renderDaily(weather, container, limit = 7) {
  const days = weather.forecast.forecastday.slice(0, limit);
  
  container.innerHTML = days.map((day, index) => `
    <div class="daily-card">
      <div class="daily-day">${formatDayName(day.date, index)}</div>
      <div class="daily-icon">${getWeatherIcon(day.day.condition.text, true)}</div>
      <div class="daily-condition">${day.day.condition.text}</div>
      <div class="daily-temp">
        <span class="daily-high">${formatTemperature(day.day.maxtemp_c)}</span>
        <span class="daily-low">${formatTemperature(day.day.mintemp_c)}</span>
      </div>
      <div class="daily-rain">${day.day.daily_chance_of_rain > 0 ? `${day.day.daily_chance_of_rain}%` : ''}</div>
    </div>
  `).join('');
}

function renderInsights(weather) {
  const insights = generateInsights(weather, weather);
  
  if (insights.length === 0) {
    elements.insightsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💡</div>
        <h2>No insights available</h2>
        <p>Weather insights will appear here when data is available.</p>
      </div>
    `;
    return;
  }
  
  elements.insightsList.innerHTML = insights.map(insight => `
    <div class="insight-card">
      <div class="insight-icon">${insight.icon}</div>
      <div class="insight-text">${insight.text}</div>
    </div>
  `).join('');
}

function renderLocations() {
  // Render favorites
  if (state.favorites.length === 0) {
    elements.favoritesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⭐</div>
        <h2>No favorites yet</h2>
        <p>Search for a location and save it to your favorites.</p>
      </div>
    `;
  } else {
    elements.favoritesList.innerHTML = state.favorites.map(loc => `
      <div class="location-card ${isSameLocation(loc, state.currentLocation) ? 'current' : ''}" data-lat="${loc.lat}" data-lon="${loc.lon}">
        <div class="location-icon">⌖</div>
        <div class="location-info">
          <div class="location-name">${loc.name}</div>
          <div class="location-detail">${loc.country || ''}</div>
        </div>
        <div class="location-temp">--°</div>
      </div>
    `).join('');
  }
  
  // Render recent
  if (state.recent.length === 0) {
    elements.recentList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🕐</div>
        <h2>No recent locations</h2>
        <p>Locations you search for will appear here.</p>
      </div>
    `;
  } else {
    elements.recentList.innerHTML = state.recent.map(loc => `
      <div class="location-card ${isSameLocation(loc, state.currentLocation) ? 'current' : ''}" data-lat="${loc.lat}" data-lon="${loc.lon}">
        <div class="location-icon">⌖</div>
        <div class="location-info">
          <div class="location-name">${loc.name}</div>
          <div class="location-detail">${loc.country || ''}</div>
        </div>
        <div class="location-temp">--°</div>
      </div>
    `).join('');
  }
}

function renderChart(weather) {
  const forecastDay = weather.forecast.forecastday[0];
  const hours = forecastDay.hour;
  
  // Get data based on selected metric
  let dataKey, dataLabel;
  switch (state.chartMetric) {
    case 'temperature':
      dataKey = 'temp_c';
      dataLabel = 'Temperature';
      break;
    case 'precipitation':
      dataKey = 'chance_of_rain';
      dataLabel = 'Rain Chance (%)';
      break;
    case 'wind':
      dataKey = 'wind_kph';
      dataLabel = 'Wind Speed';
      break;
    case 'humidity':
      dataKey = 'humidity';
      dataLabel = 'Humidity (%)';
      break;
    default:
      dataKey = 'temp_c';
      dataLabel = 'Temperature';
  }
  
  const values = hours.map(h => h[dataKey]);
  const times = hours.map(h => formatTime(h.time));
  
  // Simple SVG chart rendering
  const width = 800;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;
  
  const points = values.map((value, index) => {
    const x = padding.left + (index / (values.length - 1)) * (width - padding.left - padding.right);
    const y = padding.top + (height - padding.top - padding.bottom) * (1 - (value - minValue) / valueRange);
    return `${x},${y}`;
  }).join(' ');
  
  const circles = values.map((value, index) => {
    const x = padding.left + (index / (values.length - 1)) * (width - padding.left - padding.right);
    const y = padding.top + (height - padding.top - padding.bottom) * (1 - (value - minValue) / valueRange);
    return `<circle cx="${x}" cy="${y}" r="4" class="chart-point" data-value="${value.toFixed(1)}" data-time="${times[index]}"/>`;
  }).join('');
  
  elements.forecastChart.innerHTML = `
    <polyline points="${points}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
    ${circles}
  `;
  
  // Add hover events
  elements.forecastChart.querySelectorAll('.chart-point').forEach(circle => {
    circle.addEventListener('mouseenter', (e) => {
      const value = e.target.dataset.value;
      const time = e.target.dataset.time;
      elements.chartTooltip.textContent = `${time}: ${value}`;
      elements.chartTooltip.hidden = false;
      elements.chartTooltip.style.left = `${e.target.cx.baseVal.value}px`;
      elements.chartTooltip.style.top = `${e.target.cy.baseVal.value - 30}px`;
    });
    circle.addEventListener('mouseleave', () => {
      elements.chartTooltip.hidden = true;
    });
  });
}

function renderSettings() {
  elements.settingTemperature.value = state.settings.temperature;
  elements.settingWind.value = state.settings.wind;
  elements.settingPressure.value = state.settings.pressure;
  elements.settingDistance.value = state.settings.distance;
  elements.settingTime.value = state.settings.timeFormat;
  elements.settingTheme.value = state.settings.theme;
  elements.settingAnimations.checked = state.settings.animations;
  elements.settingNotificationDuration.value = state.settings.notificationDuration;
  elements.settingAlerts.checked = state.settings.enableAlerts;
}

// ============================================
// NAVIGATION
// ============================================

function navigateTo(page) {
  state.currentPage = page;
  
  // Update nav items
  $$('.nav-item, .mobile-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  
  // Update pages
  $$('.page').forEach(p => {
    p.classList.toggle('active', p.dataset.page === page);
  });
  
  // Update URL hash
  if (page !== 'home') {
    history.pushState(null, '', `#${page}`);
  } else {
    history.pushState(null, ' ', ' ');
  }
  
  // Page-specific actions
  if (page === 'locations') {
    renderLocations();
  } else if (page === 'settings') {
    renderSettings();
  } else if (page === 'forecast') {
    renderChart(state.weatherData);
  } else if (page === 'alerts') {
    renderAlerts();
  } else if (page === 'map') {
    if (!state.mapInitialized) {
      initMap();
    } else if (state.map) {
      state.map.resize();
    }
  }
}

// ============================================
// WEATHER LOADING
// ============================================

async function loadWeather(location) {
  if (state.loading) return;
  
  setLoading(true);
  showStatus('Loading weather data...');
  
  try {
    // Check cache first
    const cacheKey = locationKey(location);
    const cached = getCachedData(cacheKey);
    
    if (cached) {
      state.weatherData = cached;
      state.currentLocation = location;
      renderWeather();
      addToRecent(location);
      setLoading(false);
      showStatus('Loaded from cache');
      return;
    }
    
    // Fetch from API
    const data = await getForecast(location, 14);
    
    state.weatherData = data;
    state.currentLocation = location;
    
    // Cache the data
    setCachedData(cacheKey, data);
    
    // Generate alerts if enabled
    if (state.settings.enableAlerts) {
      state.alerts = generateMockAlerts(data);
      if (state.alerts.length > 0) {
        showNotification(`${state.alerts.length} weather alert(s) available`, 'alert', 8000);
      }
    } else {
      state.alerts = [];
    }
    
    renderWeather();
    addToRecent(location);
    saveState();
    updateAlertBadge();
    
    setLoading(false);
    showStatus('Weather updated');
    showNotification('Weather data updated successfully', 'success', 3000);
    
  } catch (error) {
    console.error('Error loading weather:', error);
    setLoading(false);
    showStatus('Failed to load weather data. Please try again.', true);
  }
}

function renderWeather() {
  if (!state.weatherData) return;
  
  elements.weatherContent.classList.add('visible');
  
  renderHero(state.weatherData, state.currentLocation);
  renderSun(state.weatherData);
  renderMetrics(state.weatherData);
  renderHourly(state.weatherData, elements.hourlyPreview, 8);
  renderHourly(state.weatherData, elements.hourlyExtended, 24);
  renderDaily(state.weatherData, elements.dailyPreview, 7);
  renderDaily(state.weatherData, elements.dailyExtended, 14);
  renderInsights(state.weatherData);
}

// ============================================
// GEOLOCATION
// ============================================

function useCurrentLocation() {
  if (!navigator.geolocation) {
    showStatus('Geolocation is not supported by your browser', true);
    return;
  }
  
  showStatus('Getting your location...');
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const location = {
        name: 'Current Location',
        country: '',
        lat: position.coords.latitude,
        lon: position.coords.longitude
      };
      
      // Reverse geocode to get city name
      try {
        const searchResult = await searchLocations(`${location.lat},${location.lon}`);
        if (searchResult && searchResult[0]) {
          location.name = searchResult[0].name;
          location.country = searchResult[0].country;
        }
      } catch (e) {
        console.error('Reverse geocode failed:', e);
      }
      
      loadWeather(location);
    },
    (error) => {
      console.error('Geolocation error:', error);
      showStatus('Could not get your location. Please search manually.', true);
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
  );
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

let searchTimeout;

async function handleSearch(query) {
  clearTimeout(searchTimeout);
  
  if (query.length < 2) {
    elements.searchSuggestions.hidden = true;
    return;
  }
  
  searchTimeout = setTimeout(async () => {
    try {
      const results = await searchLocations(query);
      
      if (results && results.length > 0) {
        elements.searchSuggestions.innerHTML = results.map(result => `
          <div class="suggestion-item" data-lat="${result.lat}" data-lon="${result.lon}" data-name="${result.name}" data-country="${result.country}">
            <div class="suggestion-name">${result.name}</div>
            <div class="suggestion-detail">${result.region || ''} ${result.country || ''}</div>
          </div>
        `).join('');
        elements.searchSuggestions.hidden = false;
      } else {
        elements.searchSuggestions.innerHTML = `
          <div class="suggestion-item">
            <div class="suggestion-name">No results found</div>
            <div class="suggestion-detail">Try a different search term</div>
          </div>
        `;
        elements.searchSuggestions.hidden = false;
      }
    } catch (error) {
      console.error('Search error:', error);
      elements.searchSuggestions.hidden = true;
    }
  }, 300);
}

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
  // Search
  elements.searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  
  elements.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = elements.searchInput.value.trim();
    if (query.length >= 2) {
      handleSearch(query);
    }
  });
  
  // Search suggestions
  elements.searchSuggestions.addEventListener('click', (e) => {
    const item = e.target.closest('.suggestion-item');
    if (item) {
      const location = {
        name: item.dataset.name,
        country: item.dataset.country,
        lat: parseFloat(item.dataset.lat),
        lon: parseFloat(item.dataset.lon)
      };
      elements.searchInput.value = '';
      elements.searchSuggestions.hidden = true;
      loadWeather(location);
    }
  });
  
  // Close suggestions on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      elements.searchSuggestions.hidden = true;
    }
  });
  
  // Location button
  elements.locationBtn.addEventListener('click', useCurrentLocation);
  
  // Navigation
  $$('.nav-item, .mobile-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });
  
  $$('.view-all-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.navigate);
    });
  });
  
  // Mobile menu toggle
  elements.menuToggle.addEventListener('click', () => {
    elements.sidebar.classList.toggle('open');
  });
  
  // Location cards
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.location-card');
    if (card) {
      const location = {
        name: card.querySelector('.location-name').textContent,
        country: card.querySelector('.location-detail').textContent,
        lat: parseFloat(card.dataset.lat),
        lon: parseFloat(card.dataset.lon)
      };
      loadWeather(location);
    }
  });
  
  // Clear recent
  elements.clearRecent.addEventListener('click', () => {
    state.recent = [];
    saveState();
    renderLocations();
  });
  
  // Chart tabs
  $$('.chart-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.chart-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.chartMetric = tab.dataset.chart;
      renderChart(state.weatherData);
    });
  });
  
  // Map layer buttons
  $$('.map-layer').forEach(button => {
    button.addEventListener('click', () => {
      $$('.map-layer').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      state.mapLayer = button.dataset.layer;
      addWeatherLayer(state.mapLayer);
    });
  });
  
  // Settings changes
  elements.settingTemperature.addEventListener('change', (e) => {
    state.settings.temperature = e.target.value;
    saveState();
    renderWeather();
  });
  
  elements.settingWind.addEventListener('change', (e) => {
    state.settings.wind = e.target.value;
    saveState();
    renderWeather();
  });
  
  elements.settingPressure.addEventListener('change', (e) => {
    state.settings.pressure = e.target.value;
    saveState();
    renderWeather();
  });
  
  elements.settingDistance.addEventListener('change', (e) => {
    state.settings.distance = e.target.value;
    saveState();
    renderWeather();
  });
  
  elements.settingTime.addEventListener('change', (e) => {
    state.settings.timeFormat = e.target.value;
    saveState();
    renderWeather();
  });
  
  elements.settingTheme.addEventListener('change', (e) => {
    state.settings.theme = e.target.value;
    saveState();
    applyTheme();
  });
  
  elements.settingAnimations.addEventListener('change', (e) => {
    state.settings.animations = e.target.checked;
    saveState();
    document.body.classList.toggle('no-animations', !e.target.checked);
  });
  
  elements.settingNotificationDuration.addEventListener('change', (e) => {
    state.settings.notificationDuration = parseInt(e.target.value);
    saveState();
  });
  
  elements.settingAlerts.addEventListener('change', (e) => {
    state.settings.enableAlerts = e.target.checked;
    saveState();
    if (state.weatherData && e.target.checked) {
      state.alerts = generateMockAlerts(state.weatherData);
      updateAlertBadge();
      showNotification('Alerts enabled', 'info', 3000);
    } else {
      state.alerts = [];
      updateAlertBadge();
      showNotification('Alerts disabled', 'info', 3000);
    }
  });
  
  // Hash change
  window.addEventListener('hashchange', () => {
    const page = location.hash.slice(1) || 'home';
    navigateTo(page);
  });
}

// ============================================
// MAP SYSTEM
// ============================================

function initMap() {
  if (state.mapInitialized) return;
  
  if (MAPBOX_DEMO_MODE || !MAPBOX_API_KEY || MAPBOX_API_KEY === 'YOUR_MAPBOX_API_KEY') {
    initDemoMap();
    return;
  }
  
  try {
    mapboxgl.accessToken = MAPBOX_API_KEY;
    
    state.map = new mapboxgl.Map({
      container: 'weather-map',
      style: MAPBOX_STYLE,
      center: [state.currentLocation.lon, state.currentLocation.lat],
      zoom: 8,
      attributionControl: false
    });
    
    // Add navigation controls
    state.map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Add attribution
    state.map.addControl(new mapboxgl.AttributionControl({
      compact: true
    }), 'bottom-right');
    
    state.map.on('load', () => {
      state.mapInitialized = true;
      addWeatherLayer(state.mapLayer);
      addLocationMarkers();
    });
    
    // Locate button handler
    document.getElementById('map-locate').addEventListener('click', () => {
      if (state.map && state.currentLocation) {
        state.map.flyTo({
          center: [state.currentLocation.lon, state.currentLocation.lat],
          zoom: 10
        });
      }
    });
    
  } catch (error) {
    console.error('Map initialization error:', error);
    initDemoMap();
  }
}

function initDemoMap() {
  const mapContainer = document.getElementById('weather-map');
  mapContainer.innerHTML = `
    <div class="demo-map-placeholder">
      <div class="demo-map-content">
        <div class="demo-map-icon">◎</div>
        <h3>Interactive Map Requires Mapbox API Key</h3>
        <p>Add your Mapbox API key in js/app.js to enable the interactive weather map.</p>
        <p>Current demo mode shows static visualization.</p>
        <div class="demo-map-locations">
          <strong>Saved Locations:</strong>
          <ul id="demo-map-locations-list"></ul>
        </div>
      </div>
    </div>
  `;
  
  // Show saved locations
  const locationsList = document.getElementById('demo-map-locations-list');
  if (locationsList && state.favorites.length > 0) {
    locationsList.innerHTML = state.favorites.map(loc => 
      `<li>${loc.name}, ${loc.country || ''}</li>`
    ).join('');
  } else if (locationsList) {
    locationsList.innerHTML = '<li>No saved locations yet</li>';
  }
  
  state.mapInitialized = true;
}

function addWeatherLayer(layerType) {
  if (!state.map || MAPBOX_DEMO_MODE) return;
  
  // Remove existing weather layer if any
  if (state.map.getLayer('weather-layer')) {
    state.map.removeLayer('weather-layer');
  }
  if (state.map.getSource('weather-source')) {
    state.map.removeSource('weather-source');
  }
  
  // Using OpenWeatherMap free tiles for demo
  const tileUrls = {
    radar: 'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=YOUR_OPENWEATHER_KEY',
    rain: 'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=YOUR_OPENWEATHER_KEY',
    temp: 'https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=YOUR_OPENWEATHER_KEY',
    wind: 'https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=YOUR_OPENWEATHER_KEY',
    clouds: 'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=YOUR_OPENWEATHER_KEY'
  };
  
  // For demo, we'll use a simple placeholder
  state.map.addSource('weather-source', {
    type: 'raster',
    tiles: [tileUrls[layerType] || tileUrls.radar],
    tileSize: 256
  });
  
  state.map.addLayer({
    id: 'weather-layer',
    type: 'raster',
    source: 'weather-source',
    minzoom: 0,
    maxzoom: 22,
    paint: {
      'raster-opacity': 0.7
    }
  });
  
  updateMapLegend(layerType);
}

function addLocationMarkers() {
  if (!state.map || MAPBOX_DEMO_MODE) return;
  
  // Add current location marker
  if (state.currentLocation) {
    const currentMarker = new mapboxgl.Marker({ color: '#667eea' })
      .setLngLat([state.currentLocation.lon, state.currentLocation.lat])
      .setPopup(new mapboxgl.Popup({ offset: 25 })
        .setHTML(`<strong>${state.currentLocation.name}</strong><br>Current Location`))
      .addTo(state.map);
  }
  
  // Add favorite markers
  state.favorites.forEach(location => {
    const marker = new mapboxgl.Marker({ color: '#764ba2' })
      .setLngLat([location.lon, location.lat])
      .setPopup(new mapboxgl.Popup({ offset: 25 })
        .setHTML(`<strong>${location.name}</strong><br>${location.country || ''}`))
      .addTo(state.map);
  });
}

function updateMapLegend(layerType) {
  const legend = document.getElementById('map-legend');
  if (!legend) return;
  
  const legends = {
    radar: '<span class="legend-item"><span class="legend-color" style="background: linear-gradient(to right, transparent, green, yellow, red)"></span> Precipitation Intensity</span>',
    rain: '<span class="legend-item"><span class="legend-color" style="background: linear-gradient(to right, transparent, blue, purple)"></span> Rain Amount</span>',
    temp: '<span class="legend-item"><span class="legend-color" style="background: linear-gradient(to right, blue, green, yellow, orange, red)"></span> Temperature (°C)</span>',
    wind: '<span class="legend-item"><span class="legend-color" style="background: linear-gradient(to right, transparent, green, yellow, orange)"></span> Wind Speed</span>',
    clouds: '<span class="legend-item"><span class="legend-color" style="background: linear-gradient(to right, transparent, gray, white)"></span> Cloud Coverage</span>'
  };
  
  legend.innerHTML = legends[layerType] || legends.radar;
}

// ============================================
// THEME
// ============================================

function applyTheme() {
  const theme = state.settings.theme;
  
  if (theme === 'system') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  } else if (theme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
}

// ============================================
// INITIALIZATION
// ============================================

function init() {
  loadState();
  initEventListeners();
  applyTheme();
  
  // Show demo mode notification
  if (DEMO_MODE) {
    showStatus('Running in demo mode with mock data. Add your WeatherAPI key for real data.', false);
  }
  
  // Load initial weather
  loadWeather(state.currentLocation);
  
  // Handle initial hash
  const initialPage = location.hash.slice(1) || 'home';
  navigateTo(initialPage);
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
