const express = require('express');
const http = require('http');
const path = require('path');
const socketio = require('socket.io');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// ====== Конфигурация ======
const PORT = process.env.PORT || 3001;
const TOKEN = process.env.TOKEN || 'MySecret111';
const SAVE_PATH = path.join(__dirname, 'state.json');
const PRESETS_PATH = path.join(__dirname, 'presets.json');
const LOGOS_PATH = path.join(__dirname, '..', 'public', 'logos');

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, LOGOS_PATH);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const filename = `${file.fieldname}_${timestamp}${extension}`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены!'));
    }
  }
});

// ====== Состояние табло ======
let state = {
  timerRunning: false,
  timerSeconds: 0,
  timerStartTS: null,
  time: "00:00",
  score1: 0,
  score2: 0,
  team1: "Хозяева",
  team2: "Гости",
  team1Short: "ХОЗ",
  team2Short: "ГОС",
  kit1Color: "#2b2b2b",
  kit2Color: "#2b2b2b",
  team1Name: "",
  team2Name: "",
  team1City: "",
  team2City: "",
  team1Logo: "",
  team2Logo: ""
};

// ====== Предварительные настройки матчей ======
let matchPresets = [];

// ====== Загрузка состояния ======
if (fs.existsSync(SAVE_PATH)) {
  try {
    const savedData = JSON.parse(fs.readFileSync(SAVE_PATH, 'utf8'));
    state = { ...state, ...savedData };
  } catch (e) {
    console.error("Ошибка чтения state.json", e);
  }
}

// ====== Загрузка предустановок ======
if (fs.existsSync(PRESETS_PATH)) {
  try {
    const savedPresets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
    matchPresets = savedPresets;
  } catch (e) {
    console.error("Ошибка чтения presets.json", e);
  }
}

// ====== Таймер — тикает каждую секунду ======
setInterval(() => {
  if (state.timerRunning) {
    const now = Date.now();
    state.timerSeconds = state.timerStartTS
      ? Math.floor((now - state.timerStartTS) / 1000)
      : state.timerSeconds + 1;
    
    const mm = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
    const ss = (state.timerSeconds % 60).toString().padStart(2, '0');
    state.time = `${mm}:${ss}`;
    
    io.emit('scoreboardUpdate', state);
  }
  
  // Сохраняем состояние
  fs.writeFileSync(SAVE_PATH, JSON.stringify(state));
}, 1000);

// ====== Middleware ======
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====== Раздача статики ======
app.use('/public', express.static(path.join(__dirname, '../public')));
app.use('/private', express.static(path.join(__dirname, '../private')));

// ====== Маршруты ======
app.get('/scoreboard_vmix.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'scoreboard_vmix.html'));
});
app.get('/htbreak.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'htbreak.html'));
});
app.get('/htbreak_score.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'htbreak_score.html'));
});
app.get('/preloader.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'preloader.html'));
});

app.get('/control', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  res.sendFile(path.join(__dirname, '../private', 'control.html'));
});

// ====== API для предустановок ======
app.get('/api/presets', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  res.json(matchPresets);
});

app.post('/api/presets', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  
  console.log('Creating new preset:', req.body);
  
  const newPreset = {
    id: Date.now().toString(),
    name: req.body.name,
    team1Name: req.body.team1Name,
    team1City: req.body.team1City,
    team1Short: req.body.team1Short,
    team2Name: req.body.team2Name,
    team2City: req.body.team2City,
    team2Short: req.body.team2Short,
    kit1Color: req.body.kit1Color,
    kit2Color: req.body.kit2Color,
    team1Logo: req.body.team1Logo || '',
    team2Logo: req.body.team2Logo || ''
  };
  
  matchPresets.push(newPreset);
  fs.writeFileSync(PRESETS_PATH, JSON.stringify(matchPresets, null, 2));
  
  console.log('Preset saved successfully:', newPreset.id);
  res.json(newPreset);
});

app.put('/api/presets/:id', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  
  const presetId = req.params.id;
  const presetIndex = matchPresets.findIndex(p => p.id === presetId);
  
  if (presetIndex === -1) {
    return res.status(404).json({ error: 'Preset not found' });
  }
  
  console.log('Updating preset:', presetId, req.body);
  
  // Обновляем предустановку
  matchPresets[presetIndex] = {
    ...matchPresets[presetIndex],
    name: req.body.name,
    team1Name: req.body.team1Name,
    team1City: req.body.team1City,
    team1Short: req.body.team1Short,
    team2Name: req.body.team2Name,
    team2City: req.body.team2City,
    team2Short: req.body.team2Short,
    kit1Color: req.body.kit1Color,
    kit2Color: req.body.kit2Color,
    team1Logo: req.body.team1Logo || '',
    team2Logo: req.body.team2Logo || ''
  };
  
  fs.writeFileSync(PRESETS_PATH, JSON.stringify(matchPresets, null, 2));
  
  console.log('Preset updated successfully:', presetId);
  res.json(matchPresets[presetIndex]);
});

app.delete('/api/presets/:id', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  
  // Находим пресет для удаления логотипов
  const presetToDelete = matchPresets.find(p => p.id === req.params.id);
  
  // Удаляем логотипы если они есть
  if (presetToDelete) {
    if (presetToDelete.team1Logo) {
      const logoPath = path.join(LOGOS_PATH, path.basename(presetToDelete.team1Logo));
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
        console.log('Deleted team1 logo:', logoPath);
      }
    }
    
    if (presetToDelete.team2Logo) {
      const logoPath = path.join(LOGOS_PATH, path.basename(presetToDelete.team2Logo));
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
        console.log('Deleted team2 logo:', logoPath);
      }
    }
  }
  
  matchPresets = matchPresets.filter(p => p.id !== req.params.id);
  fs.writeFileSync(PRESETS_PATH, JSON.stringify(matchPresets, null, 2));
  res.json({ success: true });
});

// ====== API для логотипов ======
// Загрузка логотипа для команды
app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  
  const logoUrl = `/public/logos/${req.file.filename}`;
  res.json({ 
    success: true, 
    filename: req.file.filename,
    url: logoUrl 
  });
});

// Удаление логотипа
app.delete('/api/logo/:filename', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  
  const filePath = path.join(LOGOS_PATH, req.params.filename);
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Файл не найден' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Ошибка удаления файла' });
  }
});

// ====== WebSocket ======
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Отправляем текущее состояние при подключении
  socket.emit('scoreboardUpdate', state);

  // Изменение состояния с панели управления
  socket.on('updateScoreboard', (newState) => {
    // Управление таймером
    if ('timerRunning' in newState) {
      if (newState.timerRunning && !state.timerRunning) {
        state.timerStartTS = Date.now() - (state.timerSeconds * 1000);
        state.timerRunning = true;
      } else if (!newState.timerRunning && state.timerRunning) {
        state.timerSeconds = Math.floor((Date.now() - state.timerStartTS) / 1000);
        state.timerRunning = false;
        state.timerStartTS = null;
      }
    }

    // Прямое изменение секунд
    if (typeof newState.timerSeconds === 'number') {
      state.timerSeconds = newState.timerSeconds;
      if (state.timerRunning) {
        state.timerStartTS = Date.now() - (state.timerSeconds * 1000);
      }
    }

    // Остальные параметры
    const keys = [
      'score1', 'score2', 'team1', 'team2',
      'team1Short', 'team2Short', 'kit1Color', 'kit2Color',
      'team1Name', 'team2Name', 'team1City', 'team2City',
      'team1Logo', 'team2Logo'
    ];
    keys.forEach(k => {
      if (k in newState) state[k] = newState[k];
    });

    // Пересчитываем строку времени
    const mm = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
    const ss = (state.timerSeconds % 60).toString().padStart(2, '0');
    state.time = `${mm}:${ss}`;

    io.emit('scoreboardUpdate', state);
    fs.writeFileSync(SAVE_PATH, JSON.stringify(state));
  });

  // Применение предустановки
  socket.on('applyPreset', (data) => {
    const preset = matchPresets.find(p => p.id === data.presetId);
    
    if (!preset) {
      console.error('Preset not found');
      return;
    }

    // Применяем данные из предустановки
    state.team1Name = preset.team1Name;
    state.team1City = preset.team1City;
    state.team1Short = preset.team1Short;
    state.team2Name = preset.team2Name;
    state.team2City = preset.team2City;
    state.team2Short = preset.team2Short;
    state.kit1Color = preset.kit1Color;
    state.kit2Color = preset.kit2Color;
    
    // Сбрасываем счет и таймер
    state.score1 = 0;
    state.score2 = 0;
    state.timerSeconds = 0;
    state.timerRunning = false;
    state.timerStartTS = null;
    state.time = "00:00";

    io.emit('scoreboardUpdate', state);
    fs.writeFileSync(SAVE_PATH, JSON.stringify(state));
  });

  // Сброс табло
  socket.on('resetScoreboard', () => {
    state = {
      timerRunning: false,
      timerSeconds: 0,
      timerStartTS: null,
      time: "00:00",
      score1: 0,
      score2: 0,
      team1: "Хозяева",
      team2: "Гости",
      team1Short: "ХОЗ",
      team2Short: "ГОС",
      kit1Color: "#2b2b2b",
      kit2Color: "#2b2b2b",
      team1Name: "",
      team2Name: "",
      team1City: "",
      team2City: ""
    };

    io.emit('scoreboardUpdate', state);
    fs.writeFileSync(SAVE_PATH, JSON.stringify(state));
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log(`Панель управления: http://localhost:${PORT}/control?token=${TOKEN}`);
  console.log(`Табло vMix: http://localhost:${PORT}/scoreboard_vmix.html`);
  console.log(`Перерыв: http://localhost:${PORT}/htbreak.html`);
  console.log(`Счет перерыва: http://localhost:${PORT}/htbreak_score.html`);
  console.log(`Заставка: http://localhost:${PORT}/preloader.html`);
});