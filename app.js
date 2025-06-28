import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
import * as tf from 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.21.0/dist/tf.min.js';

// Initialize Supabase client
const supabase = createClient('https://lckdbffkyrcdxolijmjz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxja2RiZmZreXJjZHhvbGlqbWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMzUzNTMsImV4cCI6MjA2NjYxMTM1M30.rxM7QS29y6HN5uTrn6XxCjsTnFqFKqS0nLkXdeDWtSk');

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const moistureElement = document.getElementById('moistureValue');
  const mq135Element = document.getElementById('mq135Value');
  const mq9Element = document.getElementById('mq9Value');
  const mq8Element = document.getElementById('mq8Value');
  const historyTable = document.getElementById('dataHistoryBody');
  const pumpHistoryTable = document.getElementById('pumpHistoryBody');
  const downloadButton = document.getElementById('download-report');
  const recommendationElement = document.getElementById('recommendationText');
  const predictionElement = document.getElementById('predictionText');
  const predictionListItems = document.getElementById('predictionListItems');
  const togglePumpButton = document.getElementById('togglePump');
  const pumpStateElement = document.getElementById('pumpState');
  const moistureThresholdInput = document.getElementById('moistureThreshold');
  const pumpDurationInput = document.getElementById('pumpDuration');
  const signOutButton = document.getElementById('signOutButton');
  const pageLoading = document.getElementById('page-loading');
  const weatherInfoElement = document.getElementById('weatherInfo');
  const aiPumpToggle = document.getElementById('aiPumpToggle');
  const aiPumpDecisionElement = document.getElementById('aiPumpDecision');
  const combinedChartCanvas = document.getElementById('combinedChart');
  const predictionChartCanvas = document.getElementById('predictionChart');
  const latencyChartCanvas = document.getElementById('latencyChart');
  const chatContainer = document.getElementById('chat-container');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendMessageButton = document.getElementById('send-message');
  const chatToggle = document.getElementById('chat-toggle');
  const voiceInputButton = document.getElementById('voice-input');

  let latestData = null;
  let combinedChart = null;
  let predictionChart = null;
  let latencyChart = null;
  let historyDataGlobal = [];
  window.latencyData = [];
  let lastCommand = null;

  try {
    // Initialize TensorFlow.js
    await tf.setBackend('webgl').catch(async () => {
      console.warn('WebGL unavailable, falling back to CPU');
      await tf.setBackend('cpu');
    });
    console.log('TensorFlow.js backend:', tf.getBackend());
    const testTensor = tf.tensor([1, 2, 3]);
    console.log('Test tensor:', testTensor.arraySync());
    testTensor.dispose();

    // Navigation
    const navLinks = document.querySelectorAll('.sidebar nav ul li a');
    const sections = document.querySelectorAll('.content-section');

    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        sections.forEach(section => {
          section.classList.remove('active');
          if (section.id === targetId) section.classList.add('active');
        });
        navLinks.forEach(nav => nav.classList.remove('active'));
        link.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      link.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          link.click();
        }
      });
    });

    // Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    if (!themeToggle) throw new Error('Theme toggle element not found');
    if (localStorage.getItem('theme') === 'dark') {
      body.classList.add('dark');
      themeToggle.innerHTML = '<i class="fas fa-sun"></i> <span>Basculer le Thème</span>';
    } else {
      body.classList.add('light');
      themeToggle.innerHTML = '<i class="fas fa-moon"></i> <span>Basculer le Thème</span>';
    }

    themeToggle.addEventListener('click', () => {
      body.classList.toggle('dark');
      body.classList.toggle('light');
      if (body.classList.contains('dark')) {
        localStorage.setItem('theme', 'dark');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i> <span>Basculer le Thème</span>';
      } else {
        localStorage.setItem('theme', 'light');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i> <span>Basculer le Thème</span>';
      }
      updateChartThemes();
    });

    let lastPumpActivation = localStorage.getItem('lastPumpActivation') ? parseInt(localStorage.getItem('lastPumpActivation')) : 0;
    const COOLDOWN_PERIOD = 5 * 60 * 1000;
    let pumpState = false;
    let aiPumpControlEnabled = false;
    let historyDataForExport = [];

    let userLocation = { lat: null, lon: null, city: null };
    let cachedWeather = null;
    let lastWeatherFetchTime = 0;
    const WEATHER_CACHE_DURATION = 5 * 60 * 1000;

    async function fetchWeatherData() {
      const now = Date.now();
      if (cachedWeather && (now - lastWeatherFetchTime) < WEATHER_CACHE_DURATION) {
        return cachedWeather;
      }

      const apiKey = '532ad6416b51f59a07bcf7d907cb095c';
      try {
        let url;
        if (userLocation.lat && userLocation.lon) {
          url = `https://api.openweathermap.org/data/2.5/weather?lat=${userLocation.lat}&lon=${userLocation.lon}&appid=${apiKey}&units=metric`;
        } else if (userLocation.city) {
          url = `https://api.openweathermap.org/data/2.5/weather?q=${userLocation.city}&appid=${apiKey}&units=metric`;
        } else {
          url = `https://api.openweathermap.org/data/2.5/weather?lat=48.8566&lon=2.3522&appid=${apiKey}&units=metric`;
        }

        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error(`Weather API error: ${response.status} - ${response.statusText}`);
        const data = await response.json();
        cachedWeather = {
          temperature: data.main.temp,
          humidity: data.main.humidity,
          rainfall: data.rain?.['1h'] ?? 0,
          location: data.name
        };
        lastWeatherFetchTime = now;

        if (weatherInfoElement) {
          weatherInfoElement.innerHTML = `
            <p><strong>Ville:</strong> ${cachedWeather.location}</p>
            <p><strong>Température:</strong> ${cachedWeather.temperature}°C</p>
            <p><strong>Humidité:</strong> ${cachedWeather.humidity}%</p>
            <p><strong>Pluie (1h):</strong> ${cachedWeather.rainfall} mm</p>
          `;
        }
        return cachedWeather;
      } catch (error) {
        console.error('Weather fetch failed:', error.message);
        if (weatherInfoElement) weatherInfoElement.innerHTML = `<p>Erreur météo: ${error.message}</p>`;
        cachedWeather = { temperature: 25, humidity: 60, rainfall: 0, location: 'Inconnu' };
        lastWeatherFetchTime = now;
        return cachedWeather;
      }
    }

    async function getUserLocation() {
      return new Promise((resolve) => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              userLocation.lat = position.coords.latitude;
              userLocation.lon = position.coords.longitude;
              resolve();
            },
            (error) => {
              console.warn('Geolocation denied:', error.message);
              resolve();
            }
          );
        } else {
          console.warn('Geolocation not supported');
          resolve();
        }
      });
    }

    const cityInput = document.getElementById('cityInput');
    const setCityButton = document.getElementById('setCity');
    if (setCityButton && cityInput) {
      setCityButton.addEventListener('click', async () => {
        const city = cityInput.value.trim();
        if (city) {
          userLocation.city = city;
          userLocation.lat = null;
          userLocation.lon = null;
          localStorage.setItem('userCity', city);
          await fetchWeatherData();
          await loadSensorData();
        } else alert('Entrez une ville valide.');
      });
    }

    const savedCity = localStorage.getItem('userCity');
    if (savedCity) {
      userLocation.city = savedCity;
      if (cityInput) cityInput.value = savedCity;
    } else await getUserLocation();

    // Particle Animation
    const particleToggle = document.getElementById('particle-toggle');
    let particlesEnabled = particleToggle ? particleToggle.checked : true;

    const canvas = document.createElement('canvas');
    canvas.id = 'particles';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '-1';
    document.body.appendChild(canvas);
    const ctxParticles = canvas.getContext('2d');

    const particles = [];
    const colors = ['#ff6f61', '#ff99cc', '#d4a5ff', '#ffd700', '#ffcc80', '#e91e63'];

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles.length = 0;
      if (particlesEnabled) {
        for (let i = 0; i < 100; i++) {
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 2 + 1,
            baseRadius: Math.random() * 2 + 1,
            speedX: Math.random() * 0.8 - 0.4,
            speedY: Math.random() * 0.8 - 0.4,
            color: colors[Math.floor(Math.random() * colors.length)],
            lastX: 0,
            lastY: 0,
            pulsePhase: Math.random() * Math.PI * 2
          });
        }
      }
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function animateParticles() {
      if (!particlesEnabled) {
        ctxParticles.clearRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(animateParticles);
        return;
      }

      ctxParticles.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctxParticles.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, index) => {
        p.lastX = p.x;
        p.lastY = p.y;
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
        if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;
        p.pulsePhase += 0.05;
        p.radius = p.baseRadius + Math.sin(p.pulsePhase) * 0.5;

        ctxParticles.beginPath();
        ctxParticles.moveTo(p.lastX, p.lastY);
        ctxParticles.lineTo(p.x, p.y);
        ctxParticles.strokeStyle = `${p.color}33`;
        ctxParticles.lineWidth = 1;
        ctxParticles.stroke();

        ctxParticles.beginPath();
        ctxParticles.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctxParticles.fillStyle = p.color;
        ctxParticles.shadowBlur = 10;
        ctxParticles.shadowColor = p.color;
        ctxParticles.fill();
        ctxParticles.shadowBlur = 0;

        for (let j = index + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const distance = Math.sqrt((p.x - p2.x) ** 2 + (p.y - p2.y) ** 2);
          if (distance < 100) {
            ctxParticles.beginPath();
            ctxParticles.moveTo(p.x, p.y);
            ctxParticles.lineTo(p2.x, p2.y);
            ctxParticles.strokeStyle = `rgba(255, 255, 255, ${1 - distance / 100})`;
            ctxParticles.lineWidth = 0.5;
            ctxParticles.stroke();
          }
        }
      });

      requestAnimationFrame(animateParticles);
    }
    animateParticles();

    if (particleToggle) {
      particleToggle.addEventListener('change', () => {
        particlesEnabled = particleToggle.checked;
        resizeCanvas();
      });
    }

    // Statistical Calculations
    let stats = { means: { moisture: 0, mq135: 0, mq9: 0, mq8: 0 }, stds: { moisture: 0, mq135: 0, mq9: 0, mq8: 0 } };
    function calculateStats(historyData) {
      const values = historyData.map(d => ({
        moisture: parseFloat(d.soil_humidity) ?? 0,
        mq135: parseFloat(d.mq135) ?? 0,
        mq9: parseFloat(d.mq9) ?? 0,
        mq8: parseFloat(d.mq8) ?? 0
      }));
      const n = values.length;
      if (n > 0) {
        stats.means.moisture = values.reduce((sum, v) => sum + v.moisture, 0) / n || 0;
        stats.means.mq135 = values.reduce((sum, v) => sum + v.mq135, 0) / n || 0;
        stats.means.mq9 = values.reduce((sum, v) => sum + v.mq9, 0) / n || 0;
        stats.means.mq8 = values.reduce((sum, v) => sum + v.mq8, 0) / n || 0;

        stats.stds.moisture = n > 1 ? Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v.moisture - stats.means.moisture, 2), 0) / (n - 1)) : 0;
        stats.stds.mq135 = n > 1 ? Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v.mq135 - stats.means.mq135, 2), 0) / (n - 1)) : 0;
        stats.stds.mq9 = n > 1 ? Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v.mq9 - stats.means.mq9, 2), 0) / (n - 1)) : 0;
        stats.stds.mq8 = n > 1 ? Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v.mq8 - stats.means.mq8, 2), 0) / (n - 1)) : 0;
      }
    }

    // Alerts
    const alertQueue = [];
    let isAlertShowing = false;

    function showNextAlert() {
      if (alertQueue.length > 0 && !isAlertShowing) {
        isAlertShowing = true;
        const alertData = alertQueue.shift();
        const alertContainer = document.createElement('div');
        alertContainer.className = 'alert-container';
        alertContainer.innerHTML = `<div class="alert">${alertData.message}</div>`;
        document.body.appendChild(alertContainer);
        setTimeout(() => {
          alertContainer.remove();
          isAlertShowing = false;
          showNextAlert();
        }, 5000);
      }
    }

    function checkAlerts(data) {
      if (data.soil_humidity !== undefined && data.soil_humidity < 20) {
        alertQueue.push({ message: 'Alerte: Humidité trop basse (< 20%)!' });
      }
      if (data.mq135 !== undefined && data.mq135 > 1000) {
        alertQueue.push({ message: 'Alerte: Qualité air dégradée (MQ-135 > 1000)!' });
      }

      if (stats.stds.moisture > 0) {
        const zMoisture = Math.abs(data.soil_humidity - stats.means.moisture) / stats.stds.moisture;
        if (zMoisture > 3) alertQueue.push({ message: `Anomalie: Humidité (Z-score: ${zMoisture.toFixed(2)})` });
      }
      if (stats.stds.mq135 > 0) {
        const zMq135 = Math.abs(data.mq135 - stats.means.mq135) / stats.stds.mq135;
        if (zMq135 > 3) alertQueue.push({ message: `Anomalie: MQ-135 (Z-score: ${zMq135.toFixed(2)})` });
      }

      showNextAlert();
    }

    // Pump Control (simulated via Supabase for now)
    async function controlPump(state, duration = 10000, source = 'Manual') {
      try {
        const now = Date.now();
        if (state && (now - lastPumpActivation) < COOLDOWN_PERIOD) {
          const remainingTime = Math.ceil((COOLDOWN_PERIOD - (now - lastPumpActivation)) / 1000);
          alertQueue.push({ message: `Refroidissement pompe. Attendez ${remainingTime}s.` });
          showNextAlert();
          return;
        }

        // Simulate pump state change (replace with actual ESP32 API call if implemented)
        await supabase.from('pump').upsert({ state: state, timestamp: new Date().toISOString() });
        console.log(`Pump ${state ? 'ON' : 'OFF'} by ${source}`);

        if (state) {
          lastPumpActivation = now;
          localStorage.setItem('lastPumpActivation', lastPumpActivation.toString());
          alertQueue.push({ message: `Pompe activée par ${source} pour ${duration / 1000}s.` });
        } else alertQueue.push({ message: `Pompe désactivée par ${source}.` });
        showNextAlert();

        const { error } = await supabase.from('pump_history').insert({
          state: state,
          timestamp: new Date().toISOString(),
          duration: state ? duration : null,
          source: source
        });
        if (error) throw error;

        if (state) {
          setTimeout(async () => {
            try {
              await supabase.from('pump').upsert({ state: false, timestamp: new Date().toISOString() });
              console.log('Pump OFF after duration');
              const { error: offError } = await supabase.from('pump_history').insert({
                state: false,
                timestamp: new Date().toISOString(),
                duration: null,
                source: source
              });
              if (offError) throw offError;
              alertQueue.push({ message: `Pompe désactivée après ${duration / 1000}s.` });
              showNextAlert();
            } catch (error) {
              console.error('Pump off error:', error.message);
              alertQueue.push({ message: `Erreur désactivation: ${error.message}` });
              showNextAlert();
            }
          }, duration);
        }
      } catch (error) {
        console.error('Pump control error:', error.message);
        alertQueue.push({ message: `Erreur contrôle: ${error.message}` });
        showNextAlert();
      }
    }

    // Subscribe to pump state
    supabase
      .channel('pump-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pump' }, (payload) => {
        pumpState = payload.new.state;
        if (pumpStateElement) {
          pumpStateElement.textContent = pumpState ? 'Activée' : 'Désactivée';
          if (togglePumpButton) togglePumpButton.textContent = pumpState ? 'Désactiver' : 'Activer';
        }
      })
      .subscribe();

    if (togglePumpButton) {
      togglePumpButton.addEventListener('click', async () => {
        await controlPump(!pumpState, (parseInt(pumpDurationInput?.value) || 10) * 1000, 'Manual');
      });
    }

    if (aiPumpToggle) {
      aiPumpToggle.addEventListener('change', () => {
        aiPumpControlEnabled = aiPumpToggle.checked;
        if (aiPumpDecisionElement) aiPumpDecisionElement.innerHTML = `<p>IA: ${aiPumpControlEnabled ? 'Actif' : 'Inactif'}</p>`;
        if (!aiPumpControlEnabled && pumpState) controlPump(false, 0, 'Manual');
      });
    }

    async function aiControlPump(predictedMoisture, recommendation, weather) {
      if (!aiPumpControlEnabled) return;

      const moistureThreshold = parseFloat(moistureThresholdInput?.value) || 20;
      const duration = (parseInt(pumpDurationInput?.value) || 10) * 1000;
      let decisionMessage = '';

      if (predictedMoisture < moistureThreshold && recommendation.includes('Irrigate') && weather.rainfall < 2 && !pumpState) {
        await controlPump(true, duration, 'AI');
        decisionMessage = `IA: Irrigation (Humidité ${predictedMoisture.toFixed(1)}% < ${moistureThreshold}%).`;
      } else if (pumpState && predictedMoisture >= moistureThreshold) {
        await controlPump(false, 0, 'AI');
        decisionMessage = `IA: Désactivation (Humidité ${predictedMoisture.toFixed(1)}% ≥ ${moistureThreshold}%).`;
      } else if (weather.rainfall >= 2 && pumpState) {
        await controlPump(false, 0, 'AI');
        decisionMessage = `IA: Désactivation (Pluie ${weather.rainfall}mm à ${weather.location}).`;
      } else decisionMessage = `IA: Pas d'action (Humidité ${predictedMoisture.toFixed(1)}%, Pluie ${weather.rainfall}mm).`;

      if (aiPumpDecisionElement) aiPumpDecisionElement.innerHTML = `<p>IA: Actif</p><p>${decisionMessage}</p>`;
    }

    // Data Fetching with Latency Measurement
    async function fetchHistoryData() {
      const startTime = Date.now();
      const { data, error } = await supabase.from('sensor_data').select('*').order('id', { ascending: false }).limit(50);
      const endTime = Date.now();
      const latency = endTime - startTime;
      console.log(`Latency: ${latency}ms`);
      if (!window.latencyData) window.latencyData = [];
      window.latencyData.push(latency);
      if (window.latencyData.length > 50) window.latencyData.shift();

      if (error) {
        console.error('Fetch error:', error.message);
        return [];
      }

      const validEntries = data.map(entry => ({
        soil_humidity: parseFloat(entry.soil_humidity) || 0,
        mq135: parseFloat(entry.mq135) || 0,
        mq9: parseFloat(entry.mq9) || 0,
        mq8: parseFloat(entry.mq8) || 0,
        timestamp: entry.timestamp
      })).filter(entry => !isNaN(entry.soil_humidity) && !isNaN(entry.mq135) && !isNaN(entry.mq9) && !isNaN(entry.mq8) && entry.timestamp);

      latestData = validEntries[0] || null;
      return validEntries;
    }

    function updateSensorCards(data) {
      if (moistureElement && data) moistureElement.textContent = `${data.soil_humidity.toFixed(1)}%`;
      if (mq135Element && data) mq135Element.textContent = data.mq135.toFixed(0);
      if (mq9Element && data) mq9Element.textContent = data.mq9.toFixed(0);
      if (mq8Element && data) mq8Element.textContent = data.mq8.toFixed(0);
    }

    function loadHistoryData(historyData) {
      if (!historyTable) return;
      historyTable.innerHTML = '';
      historyDataForExport = [];
      if (historyData && historyData.length > 0) {
        historyData.forEach(data => {
          if (data && data.timestamp) {
            const row = historyTable.insertRow();
            row.insertCell(0).textContent = new Date(data.timestamp).toLocaleString() || 'N/A';
            row.insertCell(1).textContent = data.soil_humidity ?? 'N/A';
            row.insertCell(2).textContent = data.mq135 ?? 'N/A';
            row.insertCell(3).textContent = data.mq9 ?? 'N/A';
            row.insertCell(4).textContent = data.mq8 ?? 'N/A';
            historyDataForExport.push({ timestamp: data.timestamp, soil_humidity: data.soil_humidity, mq135: data.mq135, mq9: data.mq9, mq8: data.mq8 });
          }
        });
      } else historyTable.innerHTML = '<tr><td colspan="5">Aucune donnée</td></tr>';
    }

    function loadPumpHistory() {
      if (!pumpHistoryTable) return;
      supabase
        .channel('pump-history-changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pump_history' }, (payload) => {
          pumpHistoryTable.innerHTML = '';
          supabase.from('pump_history').select('*').order('id', { ascending: false }).then(({ data, error }) => {
            if (error) {
              console.error('Pump history error:', error.message);
              pumpHistoryTable.innerHTML = '<tr><td colspan="4">Erreur</td></tr>';
            } else if (data) {
              data.forEach(entry => {
                const row = pumpHistoryTable.insertRow();
                row.insertCell(0).textContent = entry.timestamp || 'N/A';
                row.insertCell(1).textContent = entry.state ? 'Activée' : 'Désactivée';
                row.insertCell(2).textContent = entry.duration || 'N/A';
                row.insertCell(3).textContent = entry.source || 'Manual';
              });
            } else pumpHistoryTable.innerHTML = '<tr><td colspan="4">Aucune donnée</td></tr>';
          });
        })
        .subscribe();
    }

    if (downloadButton) {
      downloadButton.addEventListener('click', () => {
        if (!historyDataForExport.length) return alert('Aucune donnée à télécharger.');
        const headers = ['Date', 'Humidité (%)', 'MQ-135', 'MQ-9', 'MQ-8'];
        const csvContent = [headers.join(','), ...historyDataForExport.map(row => [row.timestamp, row.soil_humidity, row.mq135, row.mq9, row.mq8].join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `soilsense_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }

    // Chart Theme Colors
    function getChartColors() {
      const isDark = body.classList.contains('dark');
      return {
        moistureColor: '#2E7D32',
        mq135Color: '#FBC02D',
        mq9Color: '#EF5350',
        mq8Color: '#42A5F5',
        latencyColor: '#FF5722',
        backgroundColor: isDark ? '#37474F' : '#FFFFFF',
        textColor: isDark ? '#CFD8DC' : '#37474F',
        gridColor: isDark ? 'rgba(207, 216, 220, 0.2)' : 'rgba(55, 71, 79, 0.2)'
      };
    }

    function createCombinedChart(historyData) {
      if (!combinedChartCanvas) return;
      const ctx = combinedChartCanvas.getContext('2d');
      if (!ctx) {
        console.error('Combined chart context error');
        return;
      }

      if (combinedChart) combinedChart.destroy();

      const { moistureColor, mq135Color, mq9Color, mq8Color, backgroundColor, textColor, gridColor } = getChartColors();

      const labels = historyData.length ? historyData.map(data => new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : [];
      combinedChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            { label: 'Humidité (%)', data: historyData.map(data => data.soil_humidity), borderColor: moistureColor, backgroundColor: 'rgba(46, 125, 50, 0.2)', fill: true, tension: 0.4, yAxisID: 'y1' },
            { label: 'MQ-135', data: historyData.map(data => data.mq135), borderColor: mq135Color, backgroundColor: 'rgba(251, 192, 45, 0.2)', fill: true, tension: 0.4, yAxisID: 'y2' },
            { label: 'MQ-9', data: historyData.map(data => data.mq9), borderColor: mq9Color, backgroundColor: 'rgba(239, 83, 80, 0.2)', fill: true, tension: 0.4, yAxisID: 'y2' },
            { label: 'MQ-8', data: historyData.map(data => data.mq8), borderColor: mq8Color, backgroundColor: 'rgba(66, 165, 245, 0.2)', fill: true, tension: 0.4, yAxisID: 'y2' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: textColor } }, tooltip: { mode: 'index', intersect: false } },
          scales: {
            x: { title: { display: true, text: 'Temps', color: textColor }, ticks: { color: textColor, maxTicksLimit: 10 }, grid: { color: gridColor } },
            y1: { type: 'linear', position: 'left', title: { display: true, text: 'Humidité (%)', color: textColor }, ticks: { color: textColor, beginAtZero: true, max: 100 }, grid: { color: gridColor } },
            y2: { type: 'linear', position: 'right', title: { display: true, text: 'Valeurs MQ', color: textColor }, ticks: { color: textColor, beginAtZero: true }, grid: { drawOnChartArea: false, color: gridColor } }
          }
        }
      });
    }

    function createPredictionChart(predictions) {
      if (!predictionChartCanvas) return;
      const ctx = predictionChartCanvas.getContext('2d');
      if (!ctx) {
        console.error('Prediction chart context error');
        return;
      }

      if (predictionChart) predictionChart.destroy();

      const { moistureColor, backgroundColor, textColor, gridColor } = getChartColors();

      const now = new Date();
      const labels = Array.from({ length: predictions.length }, (_, i) => {
        const time = new Date(now.getTime() + (i + 1) * 60 * 60 * 1000);
        return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      });

      predictionChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{ label: 'Humidité Prédite (%)', data: predictions, borderColor: moistureColor, backgroundColor: 'rgba(46, 125, 50, 0.2)', fill: true, tension: 0.4 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: textColor } }, tooltip: { mode: 'index', intersect: false } },
          scales: {
            x: { title: { display: true, text: 'Heure', color: textColor }, ticks: { color: textColor, maxTicksLimit: 12 }, grid: { color: gridColor } },
            y: { title: { display: true, text: 'Humidité (%)', color: textColor }, ticks: { color: textColor, beginAtZero: true, max: 100 }, grid: { color: gridColor } }
          }
        }
      });
    }

    function createLatencyChart(latencyData) {
      if (!latencyChartCanvas) return;
      const ctx = latencyChartCanvas.getContext('2d');
      if (!ctx) {
        console.error('Latency chart context error');
        return;
      }

      if (latencyChart) latencyChart.destroy();

      const { latencyColor, backgroundColor, textColor, gridColor } = getChartColors();

      latencyChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: latencyData.map((_, i) => `Sample ${i + 1}`),
          datasets: [{ label: 'Latency (ms)', data: latencyData, borderColor: latencyColor, backgroundColor: 'rgba(255, 87, 34, 0.2)', fill: true, tension: 0.4 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: textColor } }, tooltip: { mode: 'index', intersect: false } },
          scales: {
            x: { title: { display: true, text: 'Sample', color: textColor }, ticks: { color: textColor, maxTicksLimit: 10 }, grid: { color: gridColor } },
            y: { title: { display: true, text: 'Latency (ms)', color: textColor }, ticks: { color: textColor, beginAtZero: true }, grid: { color: gridColor } }
          }
        }
      });
    }

    function updateChartThemes() {
      const historyData = historyDataGlobal;
      if (combinedChart && historyData) createCombinedChart(historyData);
      if (predictionChart && historyDataGlobal.predictions) createPredictionChart(historyDataGlobal.predictions);
      if (latencyChart && window.latencyData) createLatencyChart(window.latencyData);
    }

    async function trainPredictionModel(historyData) {
      try {
        console.log(`Training with ${historyData.length} entries`);
        if (predictionElement) {
          predictionElement.textContent = 'Entraînement...';
          predictionElement.parentElement.classList.add('loading');
        }

        const model = tf.sequential();
        model.add(tf.layers.lstm({ units: 8, inputShape: [10, 4], returnSequences: false }));
        model.add(tf.layers.dense({ units: 4, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 1, activation: 'linear' }));
        model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

        if (historyData.length < 11) {
          console.warn('Insufficient data for prediction');
          if (predictionElement) {
            predictionElement.textContent = `Données insuffisantes (${historyData.length}/11).`;
            predictionElement.parentElement.classList.remove('loading');
          }
          return null;
        }

        const xs = [], ys = [];
        for (let i = 0; i < historyData.length - 10; i++) {
          const sequence = historyData.slice(i, i + 10).map(x => [x.soil_humidity / 100, x.mq135 / 4095, x.mq9 / 4095, x.mq8 / 4095]);
          if (sequence.some(s => s.some(v => isNaN(v) || v === undefined))) continue;
          xs.push(sequence);
          ys.push([historyData[i + 10].soil_humidity / 100]);
        }

        if (xs.length === 0) {
          console.warn('No valid sequences');
          if (predictionElement) {
            predictionElement.textContent = 'Aucune séquence valide.';
            predictionElement.parentElement.classList.remove('loading');
          }
          return null;
        }

        const xTensor = tf.tensor3d(xs);
        const yTensor = tf.tensor2d(ys);
        await model.fit(xTensor, yTensor, { epochs: 10, batchSize: 16, validationSplit: 0.2 });
        xTensor.dispose();
        yTensor.dispose();

        return model;
      } catch (error) {
        console.error('Prediction training error:', error.message);
        if (predictionElement) {
          predictionElement.textContent = `Erreur: ${error.message}`;
          predictionElement.parentElement.classList.remove('loading');
        }
        return null;
      }
    }

    async function predictMoisture(model, historyData, hours = 24) {
      if (!model) {
        console.warn('No prediction model');
        if (predictionElement) {
          predictionElement.textContent = 'Modèle non entraîné.';
          predictionElement.parentElement.classList.remove('loading');
        }
        return [];
      }

      try {
        const sequenceLength = 10;
        const latestSequence = historyData.slice(-sequenceLength).map(entry => [entry.soil_humidity / 100, entry.mq135 / 4095, entry.mq9 / 4095, entry.mq8 / 4095]);

        if (latestSequence.length < sequenceLength) {
          console.warn('Insufficient sequence data');
          if (predictionElement) {
            predictionElement.textContent = `Données insuffisantes (${latestSequence.length}/10).`;
            predictionElement.parentElement.classList.remove('loading');
          }
          return [];
        }

        const predictions = [];
        let currentSequence = [...latestSequence];

        for (let h = 0; h < hours; h++) {
          const input = currentSequence.map(x => x.slice());
          const inputTensor = tf.tensor3d([input], [1, sequenceLength, 4]);
          const prediction = model.predict(inputTensor);
          let predictedMoisture = (await prediction.data())[0] * 100;
          predictedMoisture = Math.max(0, Math.min(100, predictedMoisture));
          predictions.push(predictedMoisture);

          const newEntry = [predictedMoisture / 100, currentSequence[currentSequence.length - 1][1], currentSequence[currentSequence.length - 1][2], currentSequence[currentSequence.length - 1][3]];
          currentSequence = [...currentSequence.slice(1), newEntry];
          inputTensor.dispose();
          prediction.dispose();
        }

        historyDataGlobal.predictions = predictions;
        createPredictionChart(predictions);
        return predictions;
      } catch (error) {
        console.error('Prediction error:', error.message);
        if (predictionElement) {
          predictionElement.textContent = `Erreur prédiction: ${error.message}`;
          predictionElement.parentElement.classList.remove('loading');
        }
        return [];
      }
    }

    async function displayPredictions(predictions, hours = 24) {
      if (!predictions || !predictions.length) {
        if (predictionElement) {
          predictionElement.textContent = 'Aucune prédiction.';
          predictionElement.parentElement.classList.remove('loading');
        }
        if (predictionListItems) predictionListItems.innerHTML = '';
        return 0;
      }

      const avgMoisture = predictions.reduce((sum, val) => sum + val, 0) / predictions.length;
      const now = new Date();
      const listItems = predictions.map((pred, i) => {
        const time = new Date(now.getTime() + (i + 1) * 60 * 60 * 1000);
        return `<li>${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${pred.toFixed(1)}%</li>`;
      }).join('');

      if (predictionElement) {
        predictionElement.textContent = `Moyenne 24h: ${avgMoisture.toFixed(1)}%`;
        predictionElement.parentElement.classList.remove('loading');
      }
      if (predictionListItems) predictionListItems.innerHTML = listItems;
      return avgMoisture;
    }

    async function trainRecommendationModel(historyData) {
      try {
        console.log(`Training recommendation with ${historyData.length} entries`);
        if (recommendationElement) {
          recommendationElement.textContent = 'Entraînement...';
          recommendationElement.parentElement.classList.add('loading');
        }

        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 8, inputShape: [4], activation: 'relu' }));
        model.add(tf.layers.dense({ units: 4, activation: 'softmax' }));
        model.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy' });

        if (historyData.length < 5) {
          console.warn('Insufficient data for recommendation');
          if (recommendationElement) {
            recommendationElement.textContent = `Données insuffisantes (${historyData.length}/5).`;
            recommendationElement.parentElement.classList.remove('loading');
          }
          return null;
        }

        const xs = historyData.map(d => [d.soil_humidity / 100, d.mq135 / 4095, d.mq9 / 4095, d.mq8 / 4095]).filter(x => !x.some(v => isNaN(v) || v === undefined));
        const ys = historyData.map(d => {
          const weather = { temperature: 25, humidity: 60, rainfall: 0 }; // Simplified for now
          const action = getRecommendedAction(d, weather);
          const actions = ['Irrigate', 'Ventilate', 'Normal', 'Monitor'];
          const actionIndex = actions.indexOf(action);
          return [actionIndex === 0 ? 1 : 0, actionIndex === 1 ? 1 : 0, actionIndex === 2 ? 1 : 0, actionIndex === 3 ? 1 : 0];
        }).slice(-xs.length);

        if (xs.length === 0) {
          console.warn('No valid data');
          if (recommendationElement) {
            recommendationElement.textContent = 'Aucune donnée valide.';
            recommendationElement.parentElement.classList.remove('loading');
          }
          return null;
        }

        const xTensor = tf.tensor2d(xs);
        const yTensor = tf.tensor2d(ys);
        await model.fit(xTensor, yTensor, { epochs: 10 });
        xTensor.dispose();
        yTensor.dispose();

        return model;
      } catch (error) {
        console.error('Recommendation training error:', error.message);
        if (recommendationElement) {
          recommendationElement.textContent = `Erreur: ${error.message}`;
          recommendationElement.parentElement.classList.remove('loading');
        }
        return null;
      }
    }

    function getRecommendedAction(sensorData, weather) {
      if (sensorData.soil_humidity < 20 && weather.rainfall === 0) return 'Irrigate';
      if (sensorData.mq135 > 1000 || sensorData.mq9 > 500) return 'Ventilate';
      if (sensorData.soil_humidity >= 20 && sensorData.soil_humidity <= 80 && weather.rainfall === 0 && sensorData.mq135 <= 1000 && sensorData.mq9 <= 500) return 'Normal';
      return 'Monitor';
    }

    async function predictRecommendation(model, data, predictedMoisture) {
      const weather = await fetchWeatherData();
      let recommendationText = 'Erreur: Données manquantes.';

      if (data) {
        if (!model) {
          const moistureThreshold = parseFloat(moistureThresholdInput?.value) || 20;
          if (data.soil_humidity < moistureThreshold && predictedMoisture < moistureThreshold && weather.rainfall < 2) {
            const pumpDuration = parseInt(pumpDurationInput?.value) || 10;
            recommendationText = `Irrigation: ${pumpDuration}s (Actuel: ${data.soil_humidity.toFixed(1)}%, Prédit: ${predictedMoisture.toFixed(1)}%).`;
          } else if (data.mq135 > 2000) {
            recommendationText = `Ventilation: MQ-135 ${data.mq135.toFixed(0)} (Qualité air préoccupante).`;
          } else recommendationText = `Surveillance: Humidité ${data.soil_humidity.toFixed(1)}%, Air ${data.mq135.toFixed(0)}.`;
        } else {
          try {
            const inputData = [data.soil_humidity / 100, data.mq135 / 4095, data.mq9 / 4095, data.mq8 / 4095];
            if (inputData.some(f => isNaN(f) || f === undefined)) throw new Error('Invalid input');
            const input = tf.tensor2d([inputData]);
            const prediction = model.predict(input);
            const predictionData = prediction.dataSync();
            const actions = ['Irrigate', 'Ventilate', 'Normal', 'Monitor'];
            const actionIndex = tf.argMax(predictionData).dataSync()[0];
            const action = actions[actionIndex];
            const confidence = (Math.max(...predictionData) * 100).toFixed(2);

            recommendationText = `${action} (Confiance: ${confidence}%)`;
            if (action === 'Irrigate' && data.soil_humidity < 20 && weather.rainfall === 0) recommendationText += `: ${((20 - data.soil_humidity) * 0.5).toFixed(1)}L/m²`;
            else if (action === 'Irrigate' && weather.rainfall > 0) recommendationText = `Pas d'irrigation (${weather.rainfall}mm à ${weather.location}).`;
            else if (action === 'Ventilate' && (data.mq135 > 1000 || data.mq9 > 500)) recommendationText += `: Vérifiez pollution à ${weather.location}`;
            else if (action === 'Normal') recommendationText += `: Normal à ${weather.location}`;
            else if (action === 'Monitor') recommendationText += `: Surveillez à ${weather.location}`;

            input.dispose();
            prediction.dispose();
          } catch (error) {
            console.error('Recommendation error:', error.message);
            recommendationText = `Erreur prédiction: ${error.message}`;
          }
        }
      }

      if (recommendationElement) {
        recommendationElement.textContent = recommendationText;
        recommendationElement.parentElement.classList.remove('loading');
      }
      return recommendationText;
    }

    async function updatePredictionsAndRecommendations(predictionModel, recommendationModel, historyData, hours) {
      const predictions = await predictMoisture(predictionModel, historyData, hours);
      const avgMoisture = await displayPredictions(predictions, hours);
      let recommendationText = '';
      if (latestData) recommendationText = await predictRecommendation(recommendationModel, latestData, avgMoisture);
      else if (recommendationElement) recommendationElement.textContent = 'Aucune donnée récente.';
      const weather = await fetchWeatherData();
      await aiControlPump(avgMoisture, recommendationText, weather);
    }

    async function signOutUser() {
      // Simulate sign-out (no auth in Supabase free tier for this example)
      console.log('Signed out');
      window.location.href = 'login.html';
    }

    if (signOutButton) signOutButton.addEventListener('click', signOutUser);

    async function loadSensorData() {
      const historyData = await fetchHistoryData();
      historyDataGlobal = historyData;
      if (historyData.length === 0) {
        if (predictionElement) predictionElement.textContent = 'Aucune donnée.';
        if (recommendationElement) recommendationElement.textContent = 'Aucune donnée.';
        return;
      }

      updateSensorCards(latestData);
      loadHistoryData(historyData);
      loadPumpHistory();
      calculateStats(historyData);
      checkAlerts(latestData);
      createCombinedChart(historyData);
      if (window.latencyData.length > 0) createLatencyChart(window.latencyData);

      const predictionModel = await trainPredictionModel(historyData);
      const recommendationModel = await trainRecommendationModel(historyData);
      const hours = 24;
      await updatePredictionsAndRecommendations(predictionModel, recommendationModel, historyData, hours);

      setInterval(async () => {
        const newHistoryData = await fetchHistoryData();
        if (newHistoryData.length === 0) return;
        historyDataGlobal = newHistoryData;
        updateSensorCards(latestData);
        loadHistoryData(newHistoryData);
        calculateStats(newHistoryData);
        checkAlerts(latestData);
        createCombinedChart(newHistoryData);
        if (window.latencyData.length > 0) createLatencyChart(window.latencyData);
        await updatePredictionsAndRecommendations(predictionModel, recommendationModel, newHistoryData, hours);
      }, 60000);
    }

    // Chatbot Functions
    function addMessage(message, isUser = false) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `chat-message ${isUser ? 'user-message' : 'bot-message'}`;
      messageDiv.textContent = message;
      chatMessages.appendChild(messageDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function processVoiceInput() {
      if (!('webkitSpeechRecognition' in window)) {
        addMessage('Erreur: Reconnaissance vocale non supportée.');
        return;
      }

      const recognition = new webkitSpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const speechResult = event.results[0][0].transcript.trim().toLowerCase();
        addMessage(speechResult, true);
        processMessage(speechResult);
      };

      recognition.onerror = (event) => {
        console.error('Voice error:', event.error);
        addMessage(`Erreur vocale: ${event.error}`);
      };

      recognition.start();
    }

    function updateSuggestions(input) {
      const commands = ['humidité', 'qualité air', 'météo', 'activer pompe', 'désactiver pompe', 'historique', 'prévisions', 'répéter'];
      const suggestions = commands.filter(cmd => cmd.startsWith(input.toLowerCase()));
      chatInput.setAttribute('placeholder', suggestions.length ? `Suggestions: ${suggestions.join(', ')}` : 'Tapez une commande...');
    }

    async function processMessage(message) {
      lastCommand = message;
      addMessage(message, true);

      let response = "Je suis SoilSense. Essayez: 'humidité', 'qualité air', 'météo', 'activer pompe', 'désactiver pompe', 'historique', 'prévisions' ou 'répéter'.";
      const weather = await fetchWeatherData().catch(() => ({ temperature: 'N/A', humidity: 'N/A', rainfall: 'N/A', location: 'Inconnu' }));

      if (latestData) {
        if (message.includes('humidité')) {
          response = `Humidité: ${latestData.soil_humidity.toFixed(1)}%, Moyenne: ${stats.means.moisture.toFixed(1)}%.`;
        } else if (message.includes('qualité air')) {
          response = `Air: MQ-135 ${latestData.mq135.toFixed(0)}, MQ-9 ${latestData.mq9.toFixed(0)}.`;
        } else if (message.includes('météo')) {
          response = `Météo à ${weather.location}: ${weather.temperature}°C, Humidité: ${weather.humidity}%, Pluie: ${weather.rainfall} mm.`;
        } else if (message.includes('activer pompe')) {
          if (!pumpState) {
            await controlPump(true, (parseInt(pumpDurationInput?.value) || 10) * 1000, 'Chat');
            response = `Pompe activée pour ${parseInt(pumpDurationInput?.value) || 10} s.`;
          } else response = 'Pompe déjà activée.';
        } else if (message.includes('désactiver pompe')) {
          if (pumpState) {
            await controlPump(false, 0, 'Chat');
            response = 'Pompe désactivée.';
          } else response = 'Pompe déjà désactivée.';
        } else if (message.includes('historique')) {
          const lastEntry = historyDataGlobal[historyDataGlobal.length - 1];
          response = lastEntry ? `Dernier: Humidité ${lastEntry.soil_humidity}%, MQ-135 ${lastEntry.mq135} à ${new Date(lastEntry.timestamp).toLocaleString()}.` : 'Aucun historique.';
        } else if (message.includes('prévisions')) {
          response = historyDataGlobal.predictions ? `Prévisions 24h: ${historyDataGlobal.predictions.reduce((a, b) => a + b, 0) / 24 || 'N/A'}%.` : 'Prévisions indisponibles.';
        } else if (message.includes('répéter')) {
          response = lastCommand ? `Dernière: ${lastCommand}. Répétition: ${await processMessage(lastCommand)}` : 'Aucune commande précédente.';
        }
      } else response = "Aucune donnée récente. Vérifiez la connexion.";

      setTimeout(() => addMessage(response), 500);
    }

    if (chatToggle) {
      chatToggle.addEventListener('click', () => {
        chatContainer.style.display = chatContainer.style.display === 'none' ? 'block' : 'none';
        chatToggle.textContent = chatContainer.style.display === 'none' ? 'Ouvrir Chat' : 'Fermer Chat';
      });
    }

    if (sendMessageButton && chatInput) {
      sendMessageButton.addEventListener('click', () => {
        const message = chatInput.value.trim();
        if (message) {
          processMessage(message);
          chatInput.value = '';
          updateSuggestions('');
        }
      });

      chatInput.addEventListener('input', () => updateSuggestions(chatInput.value));
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim()) sendMessageButton.click();
      });
    }

    if (voiceInputButton) voiceInputButton.addEventListener('click', processVoiceInput);

    // Simulate user authentication (replace with actual auth if needed)
    console.log('User signed in');
    await loadSensorData();

    if (pageLoading) pageLoading.style.display = 'none';
  } catch (error) {
    console.error('Init error:', error.message);
    if (predictionElement) predictionElement.textContent = `Init erreur: ${error.message}`;
    if (recommendationElement) recommendationElement.textContent = 'Init erreur';
    if (pageLoading) pageLoading.style.display = 'none';
  }
});