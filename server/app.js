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
const STADIUM_TOKEN = process.env.STADIUM_TOKEN || 'StadiumSecret222';
const SAVE_PATH = path.join(__dirname, 'state.json');
const PRESETS_PATH = path.join(__dirname, 'presets.json');
const TOURNAMENTS_PATH = path.join(__dirname, 'tournaments.json');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const LOGOS_PATH = path.join(__dirname, '..', 'public', 'logos');

// Загрузка конфигурации (токены)
let config = { token: TOKEN, stadiumToken: STADIUM_TOKEN };
if (fs.existsSync(CONFIG_PATH)) {
  try {
    const savedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config = { ...config, ...savedConfig };
  } catch (error) {
    console.error('Ошибка загрузки конфигурации:', error);
  }
}

// Функция для получения актуального токена управления
function getActualToken() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const savedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return savedConfig.token || TOKEN;
    } catch (error) {
      return TOKEN;
    }
  }
  return TOKEN;
}

// Функция для получения актуального токена stadium
function getActualStadiumToken() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const savedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return savedConfig.stadiumToken || STADIUM_TOKEN;
    } catch (error) {
      return STADIUM_TOKEN;
    }
  }
  return STADIUM_TOKEN;
}

// Используем токены из конфигурации для инициализации
const ACTUAL_TOKEN = config.token || TOKEN;
const ACTUAL_STADIUM_TOKEN = config.stadiumToken || STADIUM_TOKEN;

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, LOGOS_PATH);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const extension = path.extname(file.originalname);
    
    // Если передан tournamentId и teamId, используем их для уникальности
    const tournamentId = req.body.tournamentId || req.query.tournamentId || '';
    const teamId = req.body.teamId || req.query.teamId || '';
    
    let filename;
    if (tournamentId && teamId) {
      // Для редактирования команды: tournamentId_teamId_timestamp_random.ext
      filename = `team_${tournamentId}_${teamId}_${timestamp}_${random}${extension}`;
    } else if (tournamentId) {
      // Для новой команды: tournamentId_timestamp_random.ext
      filename = `team_${tournamentId}_${timestamp}_${random}${extension}`;
    } else {
      // Для основной панели или других случаев: fieldname_timestamp_random.ext
      filename = `${file.fieldname}_${timestamp}_${random}${extension}`;
    }
    
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
// Защита stadium.html в публичной папке
app.use('/public', (req, res, next) => {
  // Если запрос к stadium.html - проверяем токен
  if (req.path === '/stadium.html' || req.path === '/stadium.html/') {
    if (req.query.token !== getActualStadiumToken()) {
      return res.status(403).send('Forbidden');
    }
  }
  next();
});
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

app.get('/stadium.html', (req, res) => {
  if (req.query.token !== getActualStadiumToken()) return res.status(403).send('Forbidden');
  res.sendFile(path.join(__dirname, '../public', 'stadium.html'));
});

app.get('/control', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  res.sendFile(path.join(__dirname, '../private', 'control.html'));
});

app.get('/settings', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  res.sendFile(path.join(__dirname, '../private', 'settings.html'));
});

// Защита статических файлов в /private/
app.get('/private/*', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  res.sendFile(path.join(__dirname, '..', req.path));
});

// ====== API для предустановок ======
app.get('/api/presets', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  res.json(matchPresets);
});

// Функция для копирования логотипа команды в логотип пресета
// Если logoUrl это логотип команды (начинается с /public/logos/team_),
// создается независимая копия с префиксом preset_
function copyTeamLogoToPreset(logoUrl, presetId, teamNum) {
  if (!logoUrl || !logoUrl.trim()) return logoUrl;
  
  // Извлекаем имя файла из URL
  const filename = logoUrl.split('/').pop();
  
  // Проверяем, является ли это логотипом команды (начинается с team_)
  if (!filename || !filename.startsWith('team_')) {
    // Если это не логотип команды (например, уже скопированный preset_ или пусто),
    // возвращаем как есть
    return logoUrl;
  }
  
  try {
    // Создаем новое имя файла для пресета
    const extension = path.extname(filename);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const newFilename = `preset_${presetId}_team${teamNum}_${timestamp}_${random}${extension}`;
    
    // Копируем файл
    const sourcePath = path.join(LOGOS_PATH, filename);
    const destPath = path.join(LOGOS_PATH, newFilename);
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      const newUrl = `/public/logos/${newFilename}`;
      console.log(`Copied team logo to preset logo: ${sourcePath} -> ${destPath}`);
      return newUrl;
    } else {
      console.warn(`Source logo file not found: ${sourcePath}`);
      return logoUrl; // Возвращаем оригинал, если файл не найден
    }
  } catch (error) {
    console.error('Error copying team logo to preset:', error);
    return logoUrl; // Возвращаем оригинал при ошибке
  }
}

app.post('/api/presets', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  console.log('Creating new preset:', req.body);
  
  const presetId = Date.now().toString();
  
  // Копируем логотипы команд в независимые файлы пресета
  const team1LogoUrl = copyTeamLogoToPreset(req.body.team1Logo || '', presetId, 1);
  const team2LogoUrl = copyTeamLogoToPreset(req.body.team2Logo || '', presetId, 2);
  
  const newPreset = {
    id: presetId,
    name: req.body.name,
    tournamentId: req.body.tournamentId || null,
    // Новое поле: дата матча (день), строка в формате YYYY-MM-DD
    matchDate: req.body.matchDate || null,
    team1Id: req.body.team1Id || null,
    team2Id: req.body.team2Id || null,
    team1Name: req.body.team1Name,
    team1City: req.body.team1City,
    team1Short: req.body.team1Short,
    team2Name: req.body.team2Name,
    team2City: req.body.team2City,
    team2Short: req.body.team2Short,
    kit1Color: req.body.kit1Color,
    kit2Color: req.body.kit2Color,
    team1Logo: team1LogoUrl,
    team2Logo: team2LogoUrl
  };
  
  matchPresets.push(newPreset);
  fs.writeFileSync(PRESETS_PATH, JSON.stringify(matchPresets, null, 2));
  
  console.log('Preset saved successfully:', newPreset.id);
  res.json(newPreset);
});

app.put('/api/presets/:id', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const presetId = req.params.id;
  const presetIndex = matchPresets.findIndex(p => p.id === presetId);
  
  if (presetIndex === -1) {
    return res.status(404).json({ error: 'Preset not found' });
  }
  
  console.log('Updating preset:', presetId, req.body);
  
  const oldPreset = matchPresets[presetIndex];
  const newTeam1Logo = req.body.team1Logo || '';
  const newTeam2Logo = req.body.team2Logo || '';
  
  // Если логотип изменился, копируем новый (если это логотип команды)
  let finalTeam1Logo = newTeam1Logo;
  if (newTeam1Logo !== oldPreset.team1Logo && newTeam1Logo) {
    // Удаляем старый логотип пресета (если это был логотип пресета, а не команды)
    if (oldPreset.team1Logo) {
      const oldFilename = oldPreset.team1Logo.split('/').pop();
      if (oldFilename && oldFilename.startsWith('preset_')) {
        const oldLogoPath = path.join(LOGOS_PATH, oldFilename);
        if (fs.existsSync(oldLogoPath)) {
          try {
            fs.unlinkSync(oldLogoPath);
            console.log('Deleted old preset logo:', oldLogoPath);
          } catch (error) {
            console.error('Error deleting old preset logo:', error);
          }
        }
      }
    }
    // Копируем новый логотип команды (если это логотип команды)
    finalTeam1Logo = copyTeamLogoToPreset(newTeam1Logo, presetId, 1);
  } else if (!newTeam1Logo) {
    // Если новый логотип пустой, удаляем старый логотип пресета
    if (oldPreset.team1Logo) {
      const oldFilename = oldPreset.team1Logo.split('/').pop();
      if (oldFilename && oldFilename.startsWith('preset_')) {
        const oldLogoPath = path.join(LOGOS_PATH, oldFilename);
        if (fs.existsSync(oldLogoPath)) {
          try {
            fs.unlinkSync(oldLogoPath);
            console.log('Deleted old preset logo (cleared):', oldLogoPath);
          } catch (error) {
            console.error('Error deleting old preset logo:', error);
          }
        }
      }
    }
  }
  
  let finalTeam2Logo = newTeam2Logo;
  if (newTeam2Logo !== oldPreset.team2Logo && newTeam2Logo) {
    // Удаляем старый логотип пресета (если это был логотип пресета, а не команды)
    if (oldPreset.team2Logo) {
      const oldFilename = oldPreset.team2Logo.split('/').pop();
      if (oldFilename && oldFilename.startsWith('preset_')) {
        const oldLogoPath = path.join(LOGOS_PATH, oldFilename);
        if (fs.existsSync(oldLogoPath)) {
          try {
            fs.unlinkSync(oldLogoPath);
            console.log('Deleted old preset logo:', oldLogoPath);
          } catch (error) {
            console.error('Error deleting old preset logo:', error);
          }
        }
      }
    }
    // Копируем новый логотип команды (если это логотип команды)
    finalTeam2Logo = copyTeamLogoToPreset(newTeam2Logo, presetId, 2);
  } else if (!newTeam2Logo) {
    // Если новый логотип пустой, удаляем старый логотип пресета
    if (oldPreset.team2Logo) {
      const oldFilename = oldPreset.team2Logo.split('/').pop();
      if (oldFilename && oldFilename.startsWith('preset_')) {
        const oldLogoPath = path.join(LOGOS_PATH, oldFilename);
        if (fs.existsSync(oldLogoPath)) {
          try {
            fs.unlinkSync(oldLogoPath);
            console.log('Deleted old preset logo (cleared):', oldLogoPath);
          } catch (error) {
            console.error('Error deleting old preset logo:', error);
          }
        }
      }
    }
  }
  
  // Обновляем предустановку
  matchPresets[presetIndex] = {
    ...matchPresets[presetIndex],
    name: req.body.name,
    matchDate: req.body.matchDate !== undefined ? req.body.matchDate : matchPresets[presetIndex].matchDate || null,
    tournamentId: req.body.tournamentId !== undefined ? req.body.tournamentId : matchPresets[presetIndex].tournamentId,
    team1Id: req.body.team1Id !== undefined ? req.body.team1Id : matchPresets[presetIndex].team1Id,
    team2Id: req.body.team2Id !== undefined ? req.body.team2Id : matchPresets[presetIndex].team2Id,
    team1Name: req.body.team1Name,
    team1City: req.body.team1City,
    team1Short: req.body.team1Short,
    team2Name: req.body.team2Name,
    team2City: req.body.team2City,
    team2Short: req.body.team2Short,
    kit1Color: req.body.kit1Color,
    kit2Color: req.body.kit2Color,
    team1Logo: finalTeam1Logo,
    team2Logo: finalTeam2Logo
  };
  
  fs.writeFileSync(PRESETS_PATH, JSON.stringify(matchPresets, null, 2));
  
  console.log('Preset updated successfully:', presetId);
  res.json(matchPresets[presetIndex]);
});

app.delete('/api/presets/:id', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  // Находим пресет для удаления логотипов
  const presetToDelete = matchPresets.find(p => p.id === req.params.id);
  
  // Функция проверки использования логотипа в активной секции
  function isLogoInUse(logoUrl) {
    if (!logoUrl) return false;
    return (state.team1Logo === logoUrl || state.team2Logo === logoUrl);
  }
  
  // Удаляем только логотипы пресетов (начинающиеся с preset_), НЕ удаляем логотипы команд (team_)
  if (presetToDelete) {
    // Обрабатываем team1Logo
    if (presetToDelete.team1Logo) {
      const filename = presetToDelete.team1Logo.split('/').pop();
      // Удаляем ТОЛЬКО если это логотип пресета (начинается с preset_)
      // Логотипы команд (team_) НИКОГДА не удаляются при удалении пресета
      if (filename && filename.startsWith('preset_')) {
        if (!isLogoInUse(presetToDelete.team1Logo)) {
          const logoPath = path.join(LOGOS_PATH, filename);
          if (fs.existsSync(logoPath)) {
            try {
              fs.unlinkSync(logoPath);
              console.log('Deleted preset team1 logo:', logoPath);
            } catch (error) {
              console.error('Error deleting preset logo:', error);
            }
          }
        } else {
          console.log('Protected preset team1 logo from deletion (in use in scoreboard):', presetToDelete.team1Logo);
        }
      } else {
        console.log('Skipped deletion of team logo (team logo, not preset logo):', presetToDelete.team1Logo);
      }
    }
    
    // Обрабатываем team2Logo
    if (presetToDelete.team2Logo) {
      const filename = presetToDelete.team2Logo.split('/').pop();
      // Удаляем ТОЛЬКО если это логотип пресета (начинается с preset_)
      // Логотипы команд (team_) НИКОГДА не удаляются при удалении пресета
      if (filename && filename.startsWith('preset_')) {
        if (!isLogoInUse(presetToDelete.team2Logo)) {
          const logoPath = path.join(LOGOS_PATH, filename);
          if (fs.existsSync(logoPath)) {
            try {
              fs.unlinkSync(logoPath);
              console.log('Deleted preset team2 logo:', logoPath);
            } catch (error) {
              console.error('Error deleting preset logo:', error);
            }
          }
        } else {
          console.log('Protected preset team2 logo from deletion (in use in scoreboard):', presetToDelete.team2Logo);
        }
      } else {
        console.log('Skipped deletion of team logo (team logo, not preset logo):', presetToDelete.team2Logo);
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
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
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
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
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
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
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
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  res.json(tournaments);
});

// Создать турнир
app.post('/api/tournaments', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
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
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
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
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const tournamentId = req.params.id;
  const tournament = tournaments.find(t => t.id === tournamentId);
  
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  // Удаляем логотипы команд турнира (ТОЛЬКО логотипы команд team_, не пресетов preset_)
  if (tournament.teams) {
    tournament.teams.forEach(team => {
      if (team.logo) {
        const filename = team.logo.split('/').pop();
        // Удаляем ТОЛЬКО если это логотип команды (начинается с team_)
        // Логотипы пресетов (preset_) НИКОГДА не удаляются при удалении турнира
        if (filename && filename.startsWith('team_')) {
          const logoPath = path.join(LOGOS_PATH, filename);
          if (fs.existsSync(logoPath)) {
            try {
              fs.unlinkSync(logoPath);
              console.log('Deleted team logo:', logoPath);
            } catch (error) {
              console.error('Error deleting team logo:', error);
            }
          }
        } else {
          console.log('Skipped deletion (preset logo, not team logo):', team.logo);
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
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
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
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
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
  
  // КРИТИЧНО: Сохраняем существующий логотип команды, если новый не предоставлен или пустой
  // Логотип команды НЕ должен изменяться при сохранении пресетов или применении пресетов
  // Логотип изменяется ТОЛЬКО при редактировании записи команды в турнире (когда передается новый файл)
  const existingLogo = tournament.teams[teamIndex].logo || '';
  // Если logo передан явно и не пустой - используем его (это означает редактирование команды)
  // Если logo пустой или не передан - сохраняем существующий
  const newLogo = (req.body.logo && req.body.logo.trim() !== '') ? req.body.logo : existingLogo;
  
  tournament.teams[teamIndex] = {
    ...tournament.teams[teamIndex],
    name: req.body.name,
    city: req.body.city || '',
    short: req.body.short || '',
    kitColor: req.body.kitColor || '#2b2b2b',
    logo: newLogo // Всегда используем newLogo, который уже содержит существующий если новый пустой
  };
  
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Team updated:', tournamentId, teamId);
  res.json(tournament.teams[teamIndex]);
});

// Удалить команду из турнира
app.delete('/api/tournaments/:id/teams/:teamId', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
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
  
  // Удаляем логотип команды если есть (ТОЛЬКО логотипы команд team_, не пресетов preset_)
  if (team.logo) {
    const filename = team.logo.split('/').pop();
    // Удаляем ТОЛЬКО если это логотип команды (начинается с team_)
    // Логотипы пресетов (preset_) НИКОГДА не удаляются при удалении команды
    if (filename && filename.startsWith('team_')) {
      const logoPath = path.join(LOGOS_PATH, filename);
      if (fs.existsSync(logoPath)) {
        try {
          fs.unlinkSync(logoPath);
          console.log('Deleted team logo:', logoPath);
        } catch (error) {
          console.error('Error deleting team logo:', error);
        }
      }
    } else {
      console.log('Skipped deletion (preset logo, not team logo):', team.logo);
    }
  }
  
  tournament.teams = tournament.teams.filter(t => t.id !== teamId);
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Team deleted:', tournamentId, teamId);
  res.json({ success: true });
});

// Изменить порядок команд в турнире
app.post('/api/tournaments/:id/teams/reorder', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
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
  console.log(`Панель управления: http://localhost:${PORT}/control?token=${getActualToken()}`);
  console.log(`Табло vMix: http://localhost:${PORT}/scoreboard_vmix.html`);
  console.log(`Счет перерыва: http://localhost:${PORT}/htbreak_score.html`);
  console.log(`Заставка: http://localhost:${PORT}/preloader.html`);
  console.log(`Prematch: http://localhost:${PORT}/prematch.html`);
  console.log(`Break: http://localhost:${PORT}/break.html`);
  console.log(`Stadium: http://localhost:${PORT}/stadium.html?token=${getActualStadiumToken()}`);
});

// ====== API для конфигурации (токены) ======
app.get('/api/config', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  res.json({
    token: getActualToken(),
    stadiumToken: getActualStadiumToken()
  });
});

app.put('/api/config', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  // Загружаем текущую конфигурацию
  let currentConfig = { token: TOKEN, stadiumToken: STADIUM_TOKEN };
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      currentConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (error) {
      console.error('Ошибка загрузки конфигурации:', error);
    }
  }
  
  // Обновляем только переданные значения
  if (req.body.token !== undefined) {
    currentConfig.token = req.body.token;
  }
  if (req.body.stadiumToken !== undefined) {
    currentConfig.stadiumToken = req.body.stadiumToken;
  }
  
  // Сохраняем конфигурацию
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(currentConfig, null, 2));
  
  console.log('Config updated:', { token: req.body.token !== undefined ? '***changed***' : 'unchanged', stadiumToken: req.body.stadiumToken !== undefined ? '***changed***' : 'unchanged' });
  res.json({ success: true, token: currentConfig.token, stadiumToken: currentConfig.stadiumToken });
});