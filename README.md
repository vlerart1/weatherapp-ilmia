# Weatherline - Premium Weather Application

A modern, production-quality weather application with a beautiful glassmorphism design, accurate forecasts, and intuitive interface.

## Features

- **Beautiful Design**: Premium glassmorphism UI with dynamic weather backgrounds
- **Real-time Weather**: Current conditions with feels-like temperature
- **Hourly Forecast**: 24-hour detailed forecast with temperature graph
- **Daily Forecast**: 14-day extended forecast with temperature ranges
- **Weather Insights**: Natural-language insights about weather conditions
- **Weather Alerts**: Mock alert system with severity levels (heat, freeze, wind, rain, storm, snow, UV)
- **In-App Notifications**: Toast notifications for important updates
- **Interactive Weather Map**: Mapbox integration with multiple layers (radar, rain, temperature, wind, clouds)
- **Location Search**: Search for cities, regions, and countries
- **Favorites**: Save and manage your favorite locations
- **Recent Locations**: Quick access to recently viewed places
- **Multiple Units**: Support for Celsius/Fahrenheit, km/h/mph, hPa/inHg
- **Responsive Design**: Optimized for mobile, tablet, and desktop
- **Dark/Light Theme**: System, light, or dark mode
- **PWA Support**: Web app manifest for mobile installation
- **Accessibility**: WCAG-compliant with keyboard navigation and screen reader support

## Getting Started

### Prerequisites

You need API keys for full functionality:
- **WeatherAPI**: For real weather data (free tier available)
- **Mapbox**: For interactive weather map (free tier: 50,000 loads/month)

**Demo Mode**: The app includes demo modes that work without API keys using mock data. This is perfect for testing the UI and features.

### Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/weatherapp-ilmia.git
cd weatherapp-ilmia
```

2. (Optional) Add your WeatherAPI key for real weather data:
   Open `js/app.js` and replace `YOUR_WEATHERAPI_KEY` on line 6 with your actual API key:
```javascript
const WEATHER_API_KEY = 'your_actual_api_key_here';
```

3. (Optional) Disable weather demo mode:
   In `js/app.js`, change line 10:
```javascript
const DEMO_MODE = false; // Set to false to use real API
```

4. (Optional) Add your Mapbox API key for the interactive map:
   Open `js/app.js` and replace `YOUR_MAPBOX_API_KEY` on line 13 with your actual API key:
```javascript
const MAPBOX_API_KEY = 'your_actual_mapbox_key_here';
```

5. (Optional) Disable map demo mode:
   In `js/app.js`, change line 15:
```javascript
const MAPBOX_DEMO_MODE = false; // Set to false to use real map
```

6. Open `index.html` in your web browser:
```bash
# Simply open index.html in your browser
# Or use a local server:
python -m http.server 8000
# Then visit http://localhost:8000
```

## Usage

### Searching for a Location

1. Type a city, region, or country name in the search bar
2. Select a location from the suggestions
3. The weather will load automatically

### Using Current Location

Click the location button (📍) in the header to use your device's GPS location.

### Weather Alerts

The app generates mock weather alerts based on current conditions:
- **Heat Advisory**: When temperature exceeds 35°C
- **Freeze Warning**: When temperature drops below 0°C
- **High Wind Advisory**: When wind speed exceeds 50 km/h
- **Heavy Rain Warning**: When rain chance exceeds 70%
- **Severe Thunderstorm Warning**: When thunderstorm conditions detected
- **Winter Storm Warning**: When snow conditions detected
- **UV Warning**: When UV index exceeds 8

Alerts can be enabled/disabled in Settings. View all alerts on the Alerts page.

### Interactive Weather Map

The Map page provides an interactive weather visualization:
- **Layers**: Toggle between Radar, Rain, Temperature, Wind, and Clouds
- **Markers**: View your current location and saved favorites
- **Navigation**: Use zoom controls or pinch-to-zoom on mobile
- **Locate Button**: Center map on your current location

Note: Requires Mapbox API key. Demo mode shows placeholder.

### In-App Notifications

The app displays toast notifications for:
- Weather updates
- New weather alerts
- Errors and warnings
- Settings changes

Configure notification duration in Settings (3s, 5s, 10s, 30s, or Never).

### Saving Favorites

1. Search for and view a location
2. Navigate to the Locations page
3. The location will be automatically added to your recent list
4. To add to favorites (feature to be added with star button)

### Settings

Navigate to the Settings page to customize:
- Temperature unit (Celsius/Fahrenheit)
- Wind speed unit (km/h, mph, m/s)
- Pressure unit (hPa, inHg)
- Distance unit (km, mi)
- Time format (12-hour/24-hour)
- Theme (System/Light/Dark)
- Animations (On/Off)
- Notification duration
- Weather alerts (On/Off)

## Project Structure

```
weatherapp-ilmia/
├── index.html          # Main HTML structure
├── manifest.json       # Web app manifest for PWA
├── css/
│   └── styles.css      # All styling with design system
├── js/
│   └── app.js          # Main application logic
├── assets/
│   ├── favicon.svg     # Favicon
│   ├── icon-192.svg    # App icon (192x192)
│   └── icon-512.svg    # App icon (512x512)
└── README.md           # This file
```

## Technologies Used

- **HTML5**: Semantic markup
- **CSS3**: Modern CSS with custom properties, glassmorphism, and responsive design
- **Vanilla JavaScript**: No frameworks, pure JS for maximum performance
- **WeatherAPI**: Weather data provider (free tier available)
- **Mapbox GL JS**: Interactive map library (free tier: 50,000 loads/month)
- **OpenWeatherMap**: Weather tile layers for map (free tier available)

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Features Planned

- [ ] Replace mock alerts with real WeatherAPI alerts (requires paid tier)
- [ ] Add OpenWeatherMap API key for live weather map tiles
- [ ] Push notifications with service worker
- [ ] Full PWA with offline support and service worker
- [ ] Weather widget for home screen
- [ ] More detailed metrics (dew point, moon phase, etc.)
- [ ] Alert history and logging
- [ ] Multi-language support

## Performance

The application includes:
- Local storage caching for weather data (10-minute TTL)
- Skeleton loading states
- Optimized animations with reduced-motion support
- Efficient DOM updates
- Debounced search input

## Accessibility

- WCAG AA compliant color contrast
- Keyboard navigation support
- Screen reader friendly labels
- Focus indicators
- Reduced motion support
- Semantic HTML structure

## License

This project is open source and available under the MIT License.

## Credits

- Weather data provided by [WeatherAPI](https://www.weatherapi.com/)
- Map tiles from [OpenWeatherMap](https://openweathermap.org/)
- Map by [Mapbox](https://www.mapbox.com/)
- Icons using Unicode characters
- Font: Inter (Google Fonts)

## Support

For issues, questions, or contributions, please open an issue on GitHub.

## Troubleshooting

### Weather not loading
- Check if `DEMO_MODE` is set to `true` in `js/app.js`
- If using real API, verify your WeatherAPI key is correct
- Check browser console for error messages
- Ensure you have an internet connection

### Map not loading
- Check if `MAPBOX_DEMO_MODE` is set to `true` in `js/app.js`
- If using real map, verify your Mapbox API key is correct
- Mapbox free tier has a limit of 50,000 loads/month
- Check browser console for error messages

### Alerts not showing
- Check if "Weather Alerts" is enabled in Settings
- Alerts are generated based on weather conditions
- Try changing location to see different conditions
- Mock alerts may not trigger in mild weather

### Mobile installation not working
- Ensure you're using HTTPS or localhost
- Check that `manifest.json` is accessible
- iOS: Use "Add to Home Screen" from Safari share menu
- Android: Use "Add to Home Screen" from Chrome menu

---

Made with ❤️ for a better weather experience
