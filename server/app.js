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
const PORT = process.env.PORT || 3002;
const TOKEN = process.env.TOKEN || 'MySecret111';
const SAVE_PATH = path.join(__dirname, 'state.json');
const PRESETS_PATH = path.join(__dirname, 'presets.json');
const TOURNAMENTS_PATH = path.join(__dirname, 'tournaments.json');
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

// ====== Турниры ======
let tournaments = [];

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

// ====== Загрузка турниров ======
if (fs.existsSync(TOURNAMENTS_PATH)) {
  try {
    const savedTournaments = JSON.parse(fs.readFileSync(TOURNAMENTS_PATH, 'utf8'));
    tournaments = savedTournaments;
  } catch (e) {
    console.error("Ошибка чтения tournaments.json", e);
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
// app.use('/private', express.static(path.join(__dirname, '../private'))); // Отключено для безопасности

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

app.get('/prematch.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'prematch.html'));
});

app.get('/break.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'break.html'));
});

// ISKRA CUP pages
app.get('/iskracup_prematch.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'iskracup_prematch.html'));
});

app.get('/iskracup_break.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'iskracup_break.html'));
});

app.get('/iskracup_scoreboard.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'iskracup_scoreboard.html'));
});

app.get('/stadium.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'stadium.html'));
});

app.get('/control', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  res.sendFile(path.join(__dirname, '../private', 'control.html'));
});

app.get('/settings', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  res.sendFile(path.join(__dirname, '../private', 'settings.html'));
});

// Защита статических файлов в /private/
app.get('/private/*', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  res.sendFile(path.join(__dirname, '..', req.path));
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
  
  // Функция проверки использования логотипа в активной секции
  function isLogoInUse(logoUrl) {
    if (!logoUrl) return false;
    return (state.team1Logo === logoUrl || state.team2Logo === logoUrl);
  }
  
  // Удаляем логотипы если они есть и не используются в активной секции
  if (presetToDelete) {
    if (presetToDelete.team1Logo && !isLogoInUse(presetToDelete.team1Logo)) {
      const logoPath = path.join(LOGOS_PATH, path.basename(presetToDelete.team1Logo));
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
        console.log('Deleted team1 logo:', logoPath);
      }
    } else if (presetToDelete.team1Logo && isLogoInUse(presetToDelete.team1Logo)) {
      console.log('Protected team1 logo from deletion (in use):', presetToDelete.team1Logo);
    }
    
    if (presetToDelete.team2Logo && !isLogoInUse(presetToDelete.team2Logo)) {
      const logoPath = path.join(LOGOS_PATH, path.basename(presetToDelete.team2Logo));
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
        console.log('Deleted team2 logo:', logoPath);
      }
    } else if (presetToDelete.team2Logo && isLogoInUse(presetToDelete.team2Logo)) {
      console.log('Protected team2 logo from deletion (in use):', presetToDelete.team2Logo);
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
  const logoUrl = `/public/logos/${req.params.filename}`;
  
  // Проверяем, используется ли логотип в активной секции
  const isInUse = (state.team1Logo === logoUrl || state.team2Logo === logoUrl);
  
  if (isInUse) {
    return res.status(403).json({ 
      error: 'Логотип используется в активной секции и не может быть удален',
      protected: true 
    });
  }
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Deleted logo file:', filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Файл не найден' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Ошибка удаления файла' });
  }
});

// Копирование логотипа
app.post('/api/copy-logo', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  
  const { sourceUrl, newFilename } = req.body;
  
  if (!sourceUrl || !newFilename) {
    return res.status(400).json({ error: 'Не указаны sourceUrl и newFilename' });
  }
  
  try {
    // Извлекаем имя файла из URL
    const sourceFilename = sourceUrl.split('/').pop();
    const sourcePath = path.join(LOGOS_PATH, sourceFilename);
    const destPath = path.join(LOGOS_PATH, newFilename);
    
    // Проверяем существование исходного файла
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: 'Исходный файл не найден' });
    }
    
    // Копируем файл
    fs.copyFileSync(sourcePath, destPath);
    
    const newUrl = `/public/logos/${newFilename}`;
    console.log('Copied logo:', sourcePath, '->', destPath);
    
    res.json({ 
      success: true, 
      url: newUrl,
      filename: newFilename 
    });
    
  } catch (error) {
    console.error('Ошибка копирования логотипа:', error);
    res.status(500).json({ error: 'Ошибка копирования файла' });
  }
});

// ====== API для турниров ======
// Получить все турниры
app.get('/api/tournaments', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  res.json(tournaments);
});

// Создать турнир
app.post('/api/tournaments', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  
  const newTournament = {
    id: Date.now().toString(),
    name: req.body.name,
    startDate: req.body.startDate || null,
    endDate: req.body.endDate || null,
    teams: []
  };
  
  tournaments.push(newTournament);
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Tournament created:', newTournament.id);
  res.json(newTournament);
});

// Обновить турнир
app.put('/api/tournaments/:id', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  
  const tournamentId = req.params.id;
  const tournamentIndex = tournaments.findIndex(t => t.id === tournamentId);
  
  if (tournamentIndex === -1) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  tournaments[tournamentIndex] = {
    ...tournaments[tournamentIndex],
    name: req.body.name,
    startDate: req.body.startDate || null,
    endDate: req.body.endDate || null
  };
  
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Tournament updated:', tournamentId);
  res.json(tournaments[tournamentIndex]);
});

// Удалить турнир
app.delete('/api/tournaments/:id', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  
  const tournamentId = req.params.id;
  const tournament = tournaments.find(t => t.id === tournamentId);
  
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  // Удаляем логотипы команд турнира
  if (tournament.teams) {
    tournament.teams.forEach(team => {
      if (team.logo) {
        const logoPath = path.join(LOGOS_PATH, path.basename(team.logo));
        if (fs.existsSync(logoPath)) {
          try {
            fs.unlinkSync(logoPath);
            console.log('Deleted team logo:', logoPath);
          } catch (error) {
            console.error('Error deleting logo:', error);
          }
        }
      }
    });
  }
  
  tournaments = tournaments.filter(t => t.id !== tournamentId);
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Tournament deleted:', tournamentId);
  res.json({ success: true });
});

// ====== API для команд турнира ======
// Добавить команду в турнир
app.post('/api/tournaments/:id/teams', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  
  const tournamentId = req.params.id;
  const tournament = tournaments.find(t => t.id === tournamentId);
  
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  if (!tournament.teams) {
    tournament.teams = [];
  }
  
  const newTeam = {
    id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
    name: req.body.name,
    city: req.body.city || '',
    short: req.body.short || '',
    kitColor: req.body.kitColor || '#2b2b2b',
    logo: req.body.logo || ''
  };
  
  tournament.teams.push(newTeam);
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Team added to tournament:', tournamentId, newTeam.id);
  res.json(newTeam);
});

// Обновить команду в турнире
app.put('/api/tournaments/:id/teams/:teamId', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  
  const tournamentId = req.params.id;
  const teamId = req.params.teamId;
  const tournament = tournaments.find(t => t.id === tournamentId);
  
  if (!tournament || !tournament.teams) {
    return res.status(404).json({ error: 'Tournament or team not found' });
  }
  
  const teamIndex = tournament.teams.findIndex(t => t.id === teamId);
  if (teamIndex === -1) {
    return res.status(404).json({ error: 'Team not found' });
  }
  
  tournament.teams[teamIndex] = {
    ...tournament.teams[teamIndex],
    name: req.body.name,
    city: req.body.city || '',
    short: req.body.short || '',
    kitColor: req.body.kitColor || '#2b2b2b',
    logo: req.body.logo || ''
  };
  
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Team updated:', tournamentId, teamId);
  res.json(tournament.teams[teamIndex]);
});

// Удалить команду из турнира
app.delete('/api/tournaments/:id/teams/:teamId', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  
  const tournamentId = req.params.id;
  const teamId = req.params.teamId;
  const tournament = tournaments.find(t => t.id === tournamentId);
  
  if (!tournament || !tournament.teams) {
    return res.status(404).json({ error: 'Tournament or team not found' });
  }
  
  const team = tournament.teams.find(t => t.id === teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }
  
  // Удаляем логотип команды если есть
  if (team.logo) {
    const logoPath = path.join(LOGOS_PATH, path.basename(team.logo));
    if (fs.existsSync(logoPath)) {
      try {
        fs.unlinkSync(logoPath);
        console.log('Deleted team logo:', logoPath);
      } catch (error) {
        console.error('Error deleting logo:', error);
      }
    }
  }
  
  tournament.teams = tournament.teams.filter(t => t.id !== teamId);
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Team deleted:', tournamentId, teamId);
  res.json({ success: true });
});

// Изменить порядок команд в турнире
app.post('/api/tournaments/:id/teams/reorder', (req, res) => {
  if (req.query.token !== TOKEN) return res.status(403).send('Forbidden');
  
  const tournamentId = req.params.id;
  const tournament = tournaments.find(t => t.id === tournamentId);
  
  if (!tournament || !tournament.teams) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  const { teamIds } = req.body;
  
  if (!Array.isArray(teamIds)) {
    return res.status(400).json({ error: 'teamIds must be an array' });
  }
  
  // Проверяем что все ID команд принадлежат этому турниру
  const tournamentTeamIds = tournament.teams.map(t => t.id);
  const allValid = teamIds.every(id => tournamentTeamIds.includes(id));
  
  if (!allValid || teamIds.length !== tournamentTeamIds.length) {
    return res.status(400).json({ error: 'Invalid team IDs or count mismatch' });
  }
  
  // Переупорядочиваем команды согласно новому порядку
  const reorderedTeams = teamIds.map(id => tournament.teams.find(t => t.id === id));
  tournament.teams = reorderedTeams;
  
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Teams reordered:', tournamentId);
  res.json({ success: true });
});

// ====== WebSocket ======
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Отправляем текущее состояние при подключении
  socket.emit('scoreboardUpdate', state);
  
  // Обработчик запроса текущего состояния
  socket.on('getCurrentState', () => {
    socket.emit('currentState', state);
  });

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
  console.log(`Счет перерыва: http://localhost:${PORT}/htbreak_score.html`);
  console.log(`Заставка: http://localhost:${PORT}/preloader.html`);
  console.log(`Prematch: http://localhost:${PORT}/prematch.html`);
  console.log(`Break: http://localhost:${PORT}/break.html`);
  console.log(`Stadium: http://localhost:${PORT}/stadium.html`);
});