import React from "react";

// Типы ролей
export type Role = "civilian" | "mafia" | "sheriff";

// Типы фаз игры
export type GamePhase = "setup" | "day" | "voting" | "last-word" | "night" | "mafia-turn" | "mafia-chat" | "sheriff-turn" | "results" | "game-over";

// Интерфейс игрока
export interface Player {
  id: number;
  name: string;
  role: Role;
  isAlive: boolean;
  isBot: boolean;
  avatar: string;
}

// Интерфейс сообщения
export interface Message {
  id: number;
  playerId: number;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

// Интерфейс состояния игры
interface GameState {
  players: Player[];
  messages: Message[];
  mafiaMessages: Message[]; // Добавляем сообщения для чата мафии
  phase: GamePhase;
  day: number;
  selectedPlayer: number | null;
  checkedPlayers: Record<number, Role>;
  votes: Record<number, number>;
  mafiaVotes: Record<number, number>; // Добавляем голоса мафии
  winner: "mafia" | "civilians" | null;
  timer: number | null;
  mafiaCount: number;
  testMode: boolean; // Добавляем режим тестирования
  eliminatedPlayer: Player | null; // Добавляем игрока для последнего слова
}

// Интерфейс контекста игры
interface GameContextType {
  state: GameState;
  initGame: (playerCount: number, playerName: string, testMode: boolean) => void;
  selectPlayer: (playerId: number) => void;
  sendMessage: (text: string, isMafiaChat: boolean) => void;
  vote: (targetId: number, isMafiaVote: boolean) => void;
  nextPhase: () => void;
}

// Создание контекста
const GameContext = React.createContext<GameContextType | undefined>(undefined);

// Генерация случайных имен для ботов
const botNames = [
  "Алексей", "Мария", "Иван", "Елена", "Дмитрий", 
  "Анна", "Сергей", "Ольга", "Андрей", "Наталья",
  "Михаил", "Екатерина", "Владимир", "Татьяна", "Артём"
];

// Провайдер контекста
export const GameProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [state, setState] = React.useState<GameState>({
    players: [],
    messages: [],
    mafiaMessages: [], // Инициализируем массив сообщений мафии
    phase: "setup",
    day: 1,
    selectedPlayer: null,
    checkedPlayers: {},
    votes: {},
    mafiaVotes: {}, // Инициализируем голоса мафии
    winner: null,
    timer: null,
    mafiaCount: 0,
    testMode: false,
    eliminatedPlayer: null // Инициализируем игрока для последнего слова
  });
  
  // Таймер для фаз - исправление бага с таймером
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (state?.timer !== null && state?.timer !== undefined) {
      interval = setInterval(() => {
        setState(prevState => {
          if (!prevState || prevState.timer === null) return prevState;
          
          if (prevState.timer <= 1) {
            clearInterval(interval!);
            
            // Автоматический переход к следующей фазе
            if (prevState.phase === "day") {
              return {
                ...prevState,
                phase: "voting",
                timer: 10,
                messages: [
                  ...prevState.messages,
                  {
                    id: prevState.messages.length + 1,
                    playerId: 0,
                    text: "Время обсуждения истекло. Начинается голосование.",
                    timestamp: Date.now(),
                    isSystem: true
                  }
                ]
              };
            } else if (prevState.phase === "voting") {
              // Автоматически запускаем подсчет голосов
              setTimeout(() => processVotes(), 500);
              return {
                ...prevState,
                timer: null
              };
            } else if (prevState.phase === "last-word") {
              // Автоматически переходим к ночи после последнего слова
              setTimeout(() => startNight(), 500);
              return {
                ...prevState,
                timer: null
              };
            } else if (prevState.phase === "mafia-chat") {
              // Автоматически переходим к голосованию мафии
              setTimeout(() => startMafiaVoting(), 500);
              return {
                ...prevState,
                phase: "mafia-turn",
                timer: 15,
                mafiaMessages: [
                  ...prevState.mafiaMessages,
                  {
                    id: prevState.mafiaMessages.length + 1,
                    playerId: 0,
                    text: "Время обсуждения истекло. Мафия, выберите жертву.",
                    timestamp: Date.now(),
                    isSystem: true
                  }
                ]
              };
            } else if (prevState.phase === "mafia-turn") {
              // Автоматически выбираем жертву
              setTimeout(() => mafiaAction(), 500);
              return {
                ...prevState,
                timer: null
              };
            } else if (prevState.phase === "sheriff-turn") {
              // Автоматически проверяем игрока
              setTimeout(() => sheriffAction(), 500);
              return {
                ...prevState,
                timer: null
              };
            }
            
            return {
              ...prevState,
              timer: null
            };
          }
          
          return {
            ...prevState,
            timer: prevState.timer - 1
          };
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state?.phase, state?.timer]); // Add dependencies to avoid race conditions during initialization
  
  // Инициализация игры - убираем аватарку у игрока
  const initGame = (playerCount: number, playerName: string, testMode: boolean = false) => {
    // Создаем массив игроков
    const players: Player[] = [];
    
    // Добавляем реального игрока, если не тестовый режим
    if (!testMode) {
      players.push({
        id: 1,
        name: playerName,
        role: "civilian", // Роль будет назначена позже
        isAlive: true,
        isBot: false,
        avatar: "" // Убираем аватарку у игрока
      });
    } else {
      // В тестовом режиме добавляем бота вместо игрока
      players.push({
        id: 1,
        name: "Вы (Тест)",
        role: "civilian", // Роль будет назначена позже
        isAlive: true,
        isBot: true,
        avatar: "" // Убираем аватарку у бота
      });
    }
    
    // Добавляем ботов
    const usedNames = new Set<string>();
    for (let i = 2; i <= playerCount; i++) {
      let name;
      do {
        name = botNames[Math.floor(Math.random() * botNames.length)];
      } while (usedNames.has(name));
      usedNames.add(name);
      
      players.push({
        id: i,
        name,
        role: "civilian", // Роль будет назначена позже
        isAlive: true,
        isBot: true,
        avatar: "" // Убираем аватарки у ботов
      });
    }
    
    // Назначаем роли
    const mafiaCount = playerCount === 10 ? 3 : Math.max(1, Math.floor(playerCount / 4));
    assignRoles(players, mafiaCount);
    
    // Обновляем состояние
    setState({
      players,
      messages: [{
        id: 1,
        playerId: 0, // 0 для системных сообщений
        text: "Игра началась! Наступил день 1. У вас 30 секунд на обсуждение.",
        timestamp: Date.now(),
        isSystem: true
      }],
      mafiaMessages: [], // Инициализируем массив сообщений мафии
      phase: "day",
      day: 1,
      selectedPlayer: null,
      checkedPlayers: {},
      votes: {},
      mafiaVotes: {},
      winner: null,
      timer: 30, // 30 секунд на обсуждение
      mafiaCount,
      testMode,
      eliminatedPlayer: null
    });
    
    // Запускаем бота через небольшую задержку
    setTimeout(() => {
      botsTalk();
      
      // Автоматически переходим к голосованию через определенное время
      setTimeout(() => {
        if (state?.phase === "day") {
          setState(prev => ({
            ...prev,
            phase: "voting",
            timer: 10, // 10 секунд на голосование
            messages: [
              ...prev.messages,
              {
                id: prev.messages.length + 1,
                playerId: 0,
                text: "Начинается голосование. У вас 10 секунд, чтобы выбрать, кого вы считаете мафия.",
                timestamp: Date.now(),
                isSystem: true
              }
            ]
          }));
          
          // Запускаем голосование ботов
          setTimeout(() => {
            botsVote();
          }, 1500);
        }
      }, 20000); // 20 секунд на дневное обсуждение
    }, 1500);
  };
  
  // Назначение ролей
  const assignRoles = (players: Player[], mafiaCount: number) => {
    const playersCopy = [...players];
    
    // Перемешиваем массив
    for (let i = playersCopy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playersCopy[i], playersCopy[j]] = [playersCopy[j], playersCopy[i]];
    }
    
    // Назначаем роли
    for (let i = 0; i < playersCopy.length; i++) {
      if (i < mafiaCount) {
        playersCopy[i].role = "mafia";
      } else if (i === mafiaCount) {
        playersCopy[i].role = "sheriff";
      } else {
        playersCopy[i].role = "civilian";
      }
    }
    
    // Перемешиваем снова, чтобы роли не были сгруппированы
    for (let i = playersCopy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playersCopy[i], playersCopy[j]] = [playersCopy[j], playersCopy[i]];
    }
    
    // Возвращаем игроков на их места
    for (let i = 0; i < players.length; i++) {
      const originalIndex = players.findIndex(p => p.id === playersCopy[i].id);
      players[originalIndex].role = playersCopy[i].role;
    }
  };
  
  // Выбор игрока
  const selectPlayer = (playerId: number) => {
    setState(prev => ({
      ...prev,
      selectedPlayer: playerId
    }));
  };
  
  // Отправка сообщения
  const sendMessage = (text: string, isMafiaChat: boolean = false) => {
    // Находим реального игрока
    const player = state.players.find(p => !p.isBot);
    
    if (!player || !text.trim() || !player.isAlive) return;
    
    const newMessage: Message = {
      id: isMafiaChat ? state.mafiaMessages.length + 1 : state.messages.length + 1,
      playerId: player.id,
      text,
      timestamp: Date.now()
    };
    
    if (isMafiaChat) {
      setState(prev => ({
        ...prev,
        mafiaMessages: [...prev.mafiaMessages, newMessage]
      }));
      
      // Боты-мафия реагируют на сообщение игрока
      setTimeout(() => {
        mafiaBotsTalk();
      }, 1500);
    } else {
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, newMessage]
      }));
      
      // Анализируем сообщение и определяем триггеры для ботов
      const triggers = analyzeBotTriggers(text);
      
      // Боты реагируют на сообщение игрока
      setTimeout(() => {
        botsTalk(triggers);
      }, 1500);
    }
  };
  
  // Анализ триггеров для ботов
  const analyzeBotTriggers = (message: string): string[] => {
    const triggers: string[] = [];
    const lowerMessage = message.toLowerCase();
    
    // Триггеры для обвинений
    if (lowerMessage.includes("мафия") || 
        lowerMessage.includes("подозрева") || 
        lowerMessage.includes("убий") || 
        lowerMessage.includes("голосу")) {
      triggers.push("accusation");
    }
    
    // Триггеры для защиты
    if (lowerMessage.includes("невинов") || 
        lowerMessage.includes("не я") || 
        lowerMessage.includes("я не") || 
        lowerMessage.includes("докажу")) {
      triggers.push("defense");
    }
    
    // Триггеры для шерифа
    if (lowerMessage.includes("проверил") || 
        lowerMessage.includes("шериф") || 
        lowerMessage.includes("роль")) {
      triggers.push("sheriff");
    }
    
    // Триггеры для стратегии
    if (lowerMessage.includes("давайте") || 
        lowerMessage.includes("предлага") || 
        lowerMessage.includes("думаю") || 
        lowerMessage.includes("план")) {
      triggers.push("strategy");
    }
    
    return triggers;
  };
  
  // Голосование
  const vote = (targetId: number, isMafiaVote: boolean = false) => {
    if ((isMafiaVote && state.phase !== "mafia-turn") || (!isMafiaVote && state.phase !== "voting")) return;
    
    // Находим реального игрока
    const player = state.players.find(p => !p.isBot);
    if (!player || !player.isAlive) return;
    
    // Проверяем, что игрок - мафия, если это голосование мафии
    if (isMafiaVote && player.role !== "mafia") return;
    
    // Обновляем голоса
    setState(prev => {
      const newVotes = isMafiaVote 
        ? { ...prev.mafiaVotes, [player.id]: targetId }
        : { ...prev.votes, [player.id]: targetId };
      
      // Проверяем, проголосовали ли все живые игроки
      const livingPlayers = isMafiaVote
        ? prev.players.filter(p => p.isAlive && p.role === "mafia")
        : prev.players.filter(p => p.isAlive);
      
      const votedPlayers = Object.keys(isMafiaVote ? newVotes : prev.votes).length;
      
      // Если все проголосовали, переходим к следующей фазе
      if (votedPlayers >= livingPlayers.length) {
        setTimeout(() => {
          if (isMafiaVote) {
            processMafiaVotes();
          } else {
            processVotes();
          }
        }, 1000);
        
        return {
          ...prev,
          mafiaVotes: isMafiaVote ? newVotes : prev.mafiaVotes,
          votes: isMafiaVote ? newVotes : prev.votes,
          timer: null
        };
      } else {
        // Иначе боты голосуют
        setTimeout(() => {
          if (isMafiaVote) {
            mafiaBotsVote();
          } else {
            botsVote();
          }
        }, 1500);
        
        return {
          ...prev,
          mafiaVotes: isMafiaVote ? newVotes : prev.mafiaVotes,
          votes: isMafiaVote ? prev.votes : newVotes
        };
      }
    });
  };
  
  // Боты голосуют - исправление бага с голосованием ботов
  const botsVote = () => {
    setState(prev => {
      if (!prev || prev.phase !== "voting") return prev || {...state};
      
      const newVotes = { ...prev.votes };
      const livingBots = prev.players.filter(p => p.isBot && p.isAlive);
      const livingPlayers = prev.players.filter(p => p.isAlive);
      
      for (const bot of livingBots) {
        if (newVotes[bot.id]) continue; // Бот уже проголосовал
        
        let targetId;
        
        if (bot.role === "mafia") {
          // Мафия голосует против случайного живого не-мафии
          // Более умная стратегия: голосовать против шерифа, если он известен
          const sheriffSuspects = livingPlayers.filter(p => 
            p.isAlive && 
            p.role !== "mafia" && 
            p.id !== bot.id &&
            // Анализируем сообщения, чтобы найти подозрительных шерифов
            prev.messages.some(m => 
              m.playerId === p.id && 
              (m.text.includes("подозрительно") || 
               m.text.includes("проверил") || 
               m.text.includes("думаю, что"))
            )
          );
          
          if (sheriffSuspects.length > 0) {
            // Голосуем против подозрительного шерифа
            targetId = sheriffSuspects[Math.floor(Math.random() * sheriffSuspects.length)].id;
          } else {
            // Иначе голосуем против случайного не-мафии
            const targets = livingPlayers.filter(p => 
              p.isAlive && 
              p.role !== "mafia" && 
              p.id !== bot.id
            );
            if (targets.length > 0) {
              targetId = targets[Math.floor(Math.random() * targets.length)].id;
            }
          }
        } else if (bot.role === "sheriff") {
          // Шериф голосует против проверенной мафии или подозрительных
          const checkedMafia = Object.entries(prev.checkedPlayers)
            .filter(([id, role]) => role === "mafia" && livingPlayers.some(p => p.id === parseInt(id) && p.isAlive))
            .map(([id]) => parseInt(id));
          
          if (checkedMafia.length > 0) {
            // Голосуем против проверенной мафии
            targetId = checkedMafia[0];
          } else {
            // Голосуем против подозрительных (тех, кто мало говорит или агрессивен)
            const suspiciousPlayers = livingPlayers.filter(p => 
              p.isAlive && 
              p.id !== bot.id &&
              // Анализируем сообщения, чтобы найти подозрительных
              (prev.messages.filter(m => m.playerId === p.id).length < 2 ||
               prev.messages.some(m => 
                 m.playerId === p.id && 
                 (m.text.includes("Я не мафия") || 
                  m.text.includes("Я мирный") || 
                  m.text.includes("Не я") || 
                  m.text.includes("Точно не я"))
               ))
            );
            
            if (suspiciousPlayers.length > 0) {
              targetId = suspiciousPlayers[Math.floor(Math.random() * suspiciousPlayers.length)].id;
            } else {
              // Если нет подозрительных, голосуем случайно
              const targets = livingPlayers.filter(p => p.isAlive && p.id !== bot.id);
              if (targets.length > 0) {
                targetId = targets[Math.floor(Math.random() * targets.length)].id;
              }
            }
          }
        } else {
          // Мирные жители голосуют против подозрительных
          // Анализируем сообщения и поведение
          const messageCountByPlayer = new Map<number, number>();
          
          // Подсчитываем количество сообщений от каждого игрока
          prev.messages.forEach(m => {
            if (!m.isSystem) {
              messageCountByPlayer.set(m.playerId, (messageCountByPlayer.get(m.playerId) || 0) + 1);
            }
          });
          
          // Находим подозрительных игроков (те, кто мало говорит или слишком много оправдывается)
          const suspiciousPlayers = livingPlayers.filter(p => 
            p.isAlive && 
            p.id !== bot.id &&
            ((messageCountByPlayer.get(p.id) || 0) < 2 || // Мало говорит
             prev.messages.some(m => 
               m.playerId === p.id && 
               (m.text.includes("Я не мафия") || 
                m.text.includes("Я мирный") || 
                m.text.includes("Не я") || 
                m.text.includes("Точно не я"))
             ))
          );
          
          if (suspiciousPlayers.length > 0) {
            targetId = suspiciousPlayers[Math.floor(Math.random() * suspiciousPlayers.length)].id;
          } else {
            // Если нет подозрительных, голосуем случайно
            const targets = livingPlayers.filter(p => p.isAlive && p.id !== bot.id);
            if (targets.length > 0) {
              targetId = targets[Math.floor(Math.random() * targets.length)].id;
            }
          }
        }
        
        if (targetId) {
          newVotes[bot.id] = targetId;
          
          // Добавляем сообщение о голосовании
          const targetName = prev.players.find(p => p.id === targetId)?.name;
          prev.messages.push({
            id: prev.messages.length + 1,
            playerId: bot.id,
            text: `Я голосую против ${targetName}!`,
            timestamp: Date.now()
          });
        }
      }
      
      // Проверяем, проголосовали ли все
      const livingPlayersCount = livingPlayers.length;
      const votedPlayersCount = Object.keys(newVotes).length;
      
      if (votedPlayersCount >= livingPlayersCount) {
        setTimeout(() => {
          processVotes();
        }, 1000);
        return {
          ...prev,
          votes: newVotes,
          timer: null
        };
      }
      
      return {
        ...prev,
        votes: newVotes
      };
    });
  };
  
  // Голосование ботов-мафии - исправление бага с голосованием мафии
  const mafiaBotsVote = () => {
    setState(prev => {
      if (!prev || prev.phase !== "mafia-turn") return prev || {...state};
      
      const newVotes = { ...prev.mafiaVotes };
      const livingMafiaBots = prev.players.filter(p => p.isBot && p.isAlive && p.role === "mafia");
      const potentialTargets = prev.players.filter(p => p.isAlive && p.role !== "mafia");
      
      for (const bot of livingMafiaBots) {
        if (newVotes[bot.id]) continue; // Бот уже проголосовал
        
        // Выбираем цель для мафии
        if (potentialTargets.length > 0) {
          // Приоритет: шериф (если известен) > активные игроки > случайные
          
          // Ищем подозрительных шерифов по сообщениям
          const sheriffSuspects = potentialTargets.filter(p => 
            prev.messages.some(m => 
              m.playerId === p.id && 
              (m.text.includes("подозрительно") || 
               m.text.includes("проверил") || 
               m.text.includes("думаю, что"))
            )
          );
          
          // Ищем активных игроков
          const messageCountByPlayer = new Map<number, number>();
          prev.messages.forEach(m => {
            if (!m.isSystem) {
              messageCountByPlayer.set(m.playerId, (messageCountByPlayer.get(m.playerId) || 0) + 1);
            }
          });
          
          const activeTargets = potentialTargets.filter(p => (messageCountByPlayer.get(p.id) || 0) > 2);
          
          // Выбираем цель по приоритету
          let target;
          if (sheriffSuspects.length > 0) {
            target = sheriffSuspects[Math.floor(Math.random() * sheriffSuspects.length)];
          } else if (activeTargets.length > 0) {
            target = activeTargets[Math.floor(Math.random() * activeTargets.length)];
          } else {
            target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
          }
          
          newVotes[bot.id] = target.id;
          
          // Добавляем сообщение о голосовании
          prev.mafiaMessages.push({
            id: prev.mafiaMessages.length + 1,
            playerId: bot.id,
            text: `Я голосую за убийство ${target.name}.`,
            timestamp: Date.now()
          });
        }
      }
      
      // Проверяем, проголосовали ли все
      const livingMafia = prev.players.filter(p => p.isAlive && p.role === "mafia");
      const votedMafia = Object.keys(newVotes).length;
      
      if (votedMafia >= livingMafia.length) {
        setTimeout(() => {
          processMafiaVotes();
        }, 1000);
        
        return {
          ...prev,
          mafiaVotes: newVotes,
          timer: null
        };
      }
      
      return {
        ...prev,
        mafiaVotes: newVotes
      };
    });
  };
  
  // Обработка голосов мафии
  const processMafiaVotes = () => {
    setState(prev => {
      // Подсчитываем голоса
      const voteCounts: Record<number, number> = {};
      Object.values(prev.mafiaVotes).forEach(targetId => {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
      });
      
      // Находим игрока с наибольшим количеством голосов
      let maxVotes = 0;
      let targetId: number | null = null;
      
      Object.entries(voteCounts).forEach(([id, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          targetId = parseInt(id);
        }
      });
      
      if (targetId === null) {
        // Если никто не выбран, переходим к ходу шерифа
        return {
          ...prev,
          phase: "sheriff-turn",
          timer: 15, // 15 секунд на ход шерифа
          messages: [
            ...prev.messages,
            {
              id: prev.messages.length + 1,
              playerId: 0,
              text: "Ход шерифа. Выберите игрока для проверки.",
              timestamp: Date.now(),
              isSystem: true
            }
          ]
        };
      }
      
      // Запоминаем цель, но не убиваем её сразу
      const target = prev.players.find(p => p.id === targetId);
      
      // Переходим к ходу шерифа
      return {
        ...prev,
        phase: "sheriff-turn",
        timer: 15, // 15 секунд на ход шерифа
        selectedPlayer: targetId, // Запоминаем цель мафии
        messages: [
          ...prev.messages,
          {
            id: prev.messages.length + 1,
            playerId: 0,
            text: "Ход шерифа. Выберите игрока для проверки.",
            timestamp: Date.now(),
            isSystem: true
          }
        ]
      };
    });
  };
  
  // Обработка голосов - исправление бага с игроками, остающимися живыми после голосования
  const processVotes = () => {
    setState(prev => {
      if (!prev) return prev;
      
      // Подсчитываем голоса
      const voteCounts: Record<number, number> = {};
      Object.values(prev.votes).forEach(targetId => {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
      });
      
      // Находим игрока с наибольшим количеством голосов
      let maxVotes = 0;
      let eliminatedId: number | null = null;
      
      Object.entries(voteCounts).forEach(([id, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          eliminatedId = parseInt(id);
        }
      });
      
      // Если никто не голосовал или равное количество голосов, никто не исключается
      if (eliminatedId === null || maxVotes <= 1) {
        return {
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: prev.messages.length + 1,
              playerId: 0,
              text: "Никто не был исключен в результате голосования.",
              timestamp: Date.now(),
              isSystem: true
            },
            {
              id: prev.messages.length + 2,
              playerId: 0,
              text: "Наступила ночь. Город засыпает...",
              timestamp: Date.now(),
              isSystem: true
            }
          ],
          phase: "night",
          votes: {},
          timer: null,
          eliminatedPlayer: null
        };
      }
      
      const eliminatedPlayer = prev.players.find(p => p.id === eliminatedId);
      if (!eliminatedPlayer) return prev;
      
      // Добавляем системное сообщение
      const newMessages = [
        ...prev.messages,
        {
          id: prev.messages.length + 1,
          playerId: 0,
          text: `Игрок ${eliminatedPlayer.name} был выбран для исключения.`,
          timestamp: Date.now(),
          isSystem: true
        }
      ];
      
      // Если исключенный игрок - бот, добавляем его "последнее слово"
      if (eliminatedPlayer.isBot) {
        const lastWords = [
          "Вы совершаете ошибку! Я не мафия!",
          "Я был верен городу до конца...",
          "Вы пожалеете об этом решении!",
          "Запомните мои слова - я невиновен!",
          "Настоящая мафия всё ещё среди вас!",
          "Это несправедливо! Я не заслуживаю этого!",
          "Прощайте, друзья... Надеюсь, вы найдёте настоящую мафия.",
          "Вы только что убили мирного жителя. Хорошая работа, мафия!"
        ];
        
        // Добавляем последнее слово бота
        newMessages.push({
          id: newMessages.length + 1,
          playerId: eliminatedPlayer.id,
          text: eliminatedPlayer.role === "mafia" 
            ? "Вы меня раскрыли... Но это ещё не конец!" 
            : lastWords[Math.floor(Math.random() * lastWords.length)],
          timestamp: Date.now()
        });
      }
      
      // Немедленно помечаем игрока как мертвого
      const newPlayers = prev.players.map(p => {
        if (p.id === eliminatedId) {
          return { ...p, isAlive: false };
        }
        return p;
      });
      
      // Проверяем условия окончания игры
      const winner = checkWinCondition(newPlayers);
      
      if (winner) {
        return {
          ...prev,
          players: newPlayers,
          messages: [
            ...newMessages,
            {
              id: newMessages.length + 1,
              playerId: 0,
              text: winner === "mafia" 
                ? "Мафия победила! Они устранили всех мирных жителей." 
                : "Мирные жители победили! Вся мафия устранена.",
              timestamp: Date.now(),
              isSystem: true
            }
          ],
          phase: "game-over",
          votes: {},
          winner,
          timer: null,
          selectedPlayer: null,
          eliminatedPlayer: eliminatedPlayer
        };
      }
      
      // Переходим к фазе последнего слова
      return {
        ...prev,
        players: newPlayers, // Обновляем игроков с мертвым исключенным
        messages: newMessages,
        phase: "last-word",
        votes: {},
        timer: 15, // 15 секунд на последнее слово
        eliminatedPlayer: eliminatedPlayer
      };
    });
    
    // Запускаем ночную фазу через небольшую задержку
    setTimeout(() => {
      startNight();
    }, 5000); // 5 секунд на последнее слово или автоматический переход
  };
  
  // Начало ночи - исправление бага с исключенным игроком
  const startNight = () => {
    setState(prev => {
      // Проверка на null
      if (!prev) return prev;
      
      // Добавляем сообщение о роли исключенного игрока, если он есть
      let newMessages = [...prev.messages];
      
      if (prev.eliminatedPlayer && prev.phase === "last-word") {
        newMessages.push({
          id: newMessages.length + 1,
          playerId: 0,
          text: `Игрок ${prev.eliminatedPlayer.name} был исключен из игры. Его роль: ${getRoleName(prev.eliminatedPlayer.role)}.`,
          timestamp: Date.now(),
          isSystem: true
        });
      }
      
      newMessages.push({
        id: newMessages.length + 1,
        playerId: 0,
        text: "Наступила ночь. Город засыпает...",
        timestamp: Date.now(),
        isSystem: true
      });
      
      // Проверяем условия окончания игры
      const winner = checkWinCondition(prev.players);
      
      if (winner) {
        return {
          ...prev,
          messages: [
            ...newMessages,
            {
              id: newMessages.length + 1,
              playerId: 0,
              text: winner === "mafia" 
                ? "Мафия победила! Они устранили всех мирных жителей." 
                : "Мирные жители победили! Вся мафия устранена.",
              timestamp: Date.now(),
              isSystem: true
            }
          ],
          phase: "game-over",
          votes: {},
          winner,
          timer: null,
          selectedPlayer: null,
          eliminatedPlayer: null
        };
      }
      
      // Переходим к ночной фазе
      return {
        ...prev,
        messages: newMessages,
        phase: "night",
        votes: {},
        timer: null,
        eliminatedPlayer: null
      };
    });
    
    // Запускаем ночную фазу через небольшую задержку
    setTimeout(() => {
      nightPhase();
    }, 2000);
  };
  
  // Ночная фаза - исправление автоматического перехода к следующей фазе
  const nightPhase = () => {
    setState(prev => {
      // Проверяем, есть ли живая мафия
      const livingMafia = prev.players.filter(p => p.isAlive && p.role === "mafia");
      
      if (livingMafia.length === 0) {
        // Нет живой мафии, переходим к ходу шерифа
        return {
          ...prev,
          phase: "sheriff-turn",
          timer: 15, // 15 секунд на ход шерифа
          messages: [
            ...prev.messages,
            {
              id: prev.messages.length + 1,
              playerId: 0,
              text: "Ход шерифа. Выберите игрока для проверки.",
              timestamp: Date.now(),
              isSystem: true
            }
          ]
        };
      }
      
      // Есть живая мафия, переходим к чату мафии
      return {
        ...prev,
        phase: "mafia-chat",
        timer: 20, // 20 секунд на обсуждение мафии
        mafiaMessages: [
          {
            id: 1,
            playerId: 0,
            text: "Мафия просыпается. Обсудите, кого вы хотите убить.",
            timestamp: Date.now(),
            isSystem: true
          }
        ]
      };
    });
    
    // Запускаем чат мафии через небольшую задержку
    setTimeout(() => {
      mafiaBotsTalk();
      
      // Автоматически переходим к голосованию мафии через определенное время
      setTimeout(() => {
        startMafiaVoting();
      }, 10000); // 10 секунд на чат мафии
    }, 1500);
  };
  
  // Начало голосования мафии - исправление автоматического голосования
  const startMafiaVoting = () => {
    setState(prev => {
      // Проверяем, что все еще фаза чата мафии
      if (prev.phase !== "mafia-chat") return prev;
      
      return {
        ...prev,
        phase: "mafia-turn",
        timer: 15, // 15 секунд на голосование мафии
        mafiaMessages: [
          ...prev.mafiaMessages,
          {
            id: prev.mafiaMessages.length + 1,
            playerId: 0,
            text: "Мафия, выберите жертву.",
            timestamp: Date.now(),
            isSystem: true
          }
        ]
      };
    });
    
    // Запускаем голосование ботов-мафии через небольшую задержку
    setTimeout(() => {
      mafiaBotsVote();
      
      // Автоматически обрабатываем голоса мафии через определенное время
      setTimeout(() => {
        processMafiaVotes();
      }, 5000); // 5 секунд на голосование мафии
    }, 1500);
  };
  
  // Боты-мафия общаются - исправление бага с чатом мафии
  const mafiaBotsTalk = () => {
    setState(prev => {
      // Add null check for prev
      if (!prev || prev.phase !== "mafia-chat") return prev || {...state};
      
      const livingMafiaBots = prev.players.filter(p => p.isBot && p.isAlive && p.role === "mafia");
      if (livingMafiaBots.length === 0) return prev;
      
      // Выбираем случайного бота-мафию для сообщения
      const bot = livingMafiaBots[Math.floor(Math.random() * livingMafiaBots.length)];
      
      // Определяем "личность" бота на основе его ID
      const botPersonality = bot.id % 4; // 0-3 разных типа личности
      
      // Генерируем сообщение для чата мафии
      const mafiaMessages = [
        // Агрессивный тип (0)
        [
          "Я предлагаю убить самого активного игрока.",
          "Давайте устраним того, кто больше всех говорит.",
          "Нужно убрать того, кто может быть шерифом.",
          "Предлагаю убить того, кто слишком подозрителен.",
          "Нам нужно избавиться от самого опасного игрока."
        ],
        // Стратегический тип (1)
        [
          "Я думаю, нам стоит убить того, кто меньше всего подозревается.",
          "Давайте выберем жертву, которая не вызывает подозрений.",
          "Предлагаю действовать хитро и убить неочевидную цель.",
          "Нам нужно быть стратегичными в выборе жертвы.",
          "Я предлагаю убить того, кто может объединить мирных жителей."
        ],
        // Аналитический тип (2)
        [
          "Анализируя сообщения, я думаю, что шериф - это...",
          "Судя по голосованию, нам стоит убить...",
          "Если логически рассуждать, то лучшая цель - это...",
          "По моим наблюдениям, самый опасный для нас игрок - это...",
          "Статистически, нам выгоднее всего убить..."
        ],
        // Осторожный тип (3)
        [
          "Давайте будем осторожны и не убивать слишком очевидные цели.",
          "Я предлагаю действовать незаметно и не привлекать внимание.",
          "Нам нужно быть хитрыми в выборе жертвы.",
          "Предлагаю не торопиться с выбором цели.",
          "Давайте тщательно обдумаем, кого убить."
        ]
      ];
      
      // Выбираем случайное сообщение из соответствующего набора
      const text = mafiaMessages[botPersonality][Math.floor(Math.random() * mafiaMessages[botPersonality].length)];
      
      // Добавляем потенциальную цель к сообщению
      const potentialTargets = prev.players.filter(p => p.isAlive && p.role !== "mafia");
      if (potentialTargets.length > 0) {
        const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
        const targetMessages = [
          `Я думаю, нам стоит убить ${target.name}.`,
          `${target.name} кажется подозрительным, давайте его уберем.`,
          `Предлагаю голосовать за ${target.name}.`,
          `${target.name} может быть шерифом, его нужно устранить.`,
          `Я бы выбрал ${target.name} в качестве цели.`
        ];
        
        // С вероятностью 50% добавляем конкретное имя цели
        if (Math.random() > 0.5) {
          const targetText = targetMessages[Math.floor(Math.random() * targetMessages.length)];
          
          // Добавляем сообщение
          const newMessage: Message = {
            id: prev.mafiaMessages.length + 1,
            playerId: bot.id,
            text: targetText,
            timestamp: Date.now()
          };
          
          return {
            ...prev,
            mafiaMessages: [...prev.mafiaMessages, newMessage]
          };
        }
      }
      
      // Добавляем сообщение
      const newMessage: Message = {
        id: prev.mafiaMessages.length + 1,
        playerId: bot.id,
        text,
        timestamp: Date.now()
      };
      
      return {
        ...prev,
        mafiaMessages: [...prev.mafiaMessages, newMessage]
      };
    });
    
    // Планируем следующее сообщение от бота-мафии
    const randomDelay = 2000 + Math.floor(Math.random() * 2000);
    setTimeout(() => {
      // Проверяем, что все еще фаза чата мафии
      if (state?.phase === "mafia-chat") {
        mafiaBotsTalk();
      }
    }, randomDelay);
  };
  
  // Действие мафии - исправление бага с выбором жертвы
  const mafiaAction = () => {
    setState(prev => {
      // Находим живых членов мафии
      const livingMafia = prev.players.filter(p => p.isAlive && p.role === "mafia");
      
      if (livingMafia.length === 0) {
        // Нет живых мафий, переходим к ходу шерифа
        return {
          ...prev,
          phase: "sheriff-turn",
          timer: 15, // 15 секунд на ход шерифа
          messages: [
            ...prev.messages,
            {
              id: prev.messages.length + 1,
              playerId: 0,
              text: "Ход шерифа. Выберите игрока для проверки.",
              timestamp: Date.now(),
              isSystem: true
            }
          ]
        };
      }
      
      // Находим потенциальные цели
      const targets = prev.players.filter(p => p.isAlive && p.role !== "mafia");
      
      if (targets.length === 0) {
        // Нет целей, переходим к ходу шерифа
        return {
          ...prev,
          phase: "sheriff-turn",
          timer: 15, // 15 секунд на ход шерифа
          messages: [
            ...prev.messages,
            {
              id: prev.messages.length + 1,
              playerId: 0,
              text: "Ход шерифа. Выберите игрока для проверки.",
              timestamp: Date.now(),
              isSystem: true
            }
          ]
        };
      }
      
      // Используем сохраненную цель или выбираем новую
      let targetId = prev.selectedPlayer;
      
      // Если нет сохраненной цели или она недействительна, выбираем новую
      if (!targetId || !targets.some(p => p.id === targetId)) {
        // Выбираем наиболее подозрительную цель
        // Приоритет: шериф > активные игроки > случайные
        
        // Ищем подозрительных шерифов по сообщениям
        const sheriffSuspects = targets.filter(p => 
          prev.messages.some(m => 
            m.playerId === p.id && 
            (m.text.includes("подозрительно") || 
             m.text.includes("проверил") || 
             m.text.includes("думаю, что"))
          )
        );
        
        // Ищем активных игроков
        const messageCountByPlayer = new Map<number, number>();
        prev.messages.forEach(m => {
          if (!m.isSystem) {
            messageCountByPlayer.set(m.playerId, (messageCountByPlayer.get(m.playerId) || 0) + 1);
          }
        });
        
        const activeTargets = targets.filter(p => (messageCountByPlayer.get(p.id) || 0) > 2);
        
        // Выбираем цель по приоритету
        let target;
        if (sheriffSuspects.length > 0) {
          target = sheriffSuspects[Math.floor(Math.random() * sheriffSuspects.length)];
        } else if (activeTargets.length > 0) {
          target = activeTargets[Math.floor(Math.random() * activeTargets.length)];
        } else {
          target = targets[Math.floor(Math.random() * targets.length)];
        }
        
        targetId = target.id;
      }
      
      // Переходим к ходу шерифа (жертва будет "убита" только утром)
      return {
        ...prev,
        phase: "sheriff-turn",
        timer: 15, // 15 секунд на ход шерифа
        selectedPlayer: targetId, // Сохраняем цель мафии
        messages: [
          ...prev.messages,
          {
            id: prev.messages.length + 1,
            playerId: 0,
            text: "Ход шерифа. Выберите игрока для проверки.",
            timestamp: Date.now(),
            isSystem: true
          }
        ]
      };
    });
    
    // Запускаем ход шерифа через небольшую задержку
    setTimeout(() => {
      sheriffAction();
    }, 1500);
  };
  
  // Действие шерифа
  const sheriffAction = () => {
    setState(prev => {
      // Находим шерифа
      const sheriff = prev.players.find(p => p.isAlive && p.role === "sheriff");
      
      if (!sheriff) {
        // Нет живого шерифа, переходим к результатам
        return {
          ...prev,
          phase: "results",
          timer: null
        };
      }
      
      // Если шериф - бот, выбираем игрока для проверки
      if (sheriff.isBot) {
        // Более умная стратегия выбора цели для проверки
        // Приоритет: подозрительные > не проверенные > случайные
        
        // Находим подозрительных игроков
        const suspiciousPlayers = prev.players.filter(p => 
          p.isAlive && 
          p.id !== sheriff.id &&
          !prev.checkedPlayers[p.id] &&
          // Анализируем сообщения, чтобы найти подозрительных
          (prev.messages.filter(m => m.playerId === p.id).length < 2 ||
           prev.messages.some(m => 
             m.playerId === p.id && 
             (m.text.includes("Я не мафия") || 
              m.text.includes("Не я") || 
              m.text.includes("Точно не я"))
           ))
        );
        
        // Находим непроверенных игроков
        const uncheckedPlayers = prev.players.filter(p => 
          p.isAlive && 
          p.id !== sheriff.id &&
          !prev.checkedPlayers[p.id]
        );
        
        // Выбираем цель по приоритету
        let target;
        if (suspiciousPlayers.length > 0) {
          target = suspiciousPlayers[Math.floor(Math.random() * suspiciousPlayers.length)];
        } else if (uncheckedPlayers.length > 0) {
          target = uncheckedPlayers[Math.floor(Math.random() * uncheckedPlayers.length)];
        } else {
          // Если все проверены, выбираем случайного
          const targets = prev.players.filter(p => p.isAlive && p.id !== sheriff.id);
          if (targets.length > 0) {
            target = targets[Math.floor(Math.random() * targets.length)];
          }
        }
        
        if (target) {
          // Обновляем проверенных игроков
          const newCheckedPlayers = {
            ...prev.checkedPlayers,
            [target.id]: target.role
          };
          
          return {
            ...prev,
            checkedPlayers: newCheckedPlayers,
            phase: "results",
            timer: null
          };
        }
      } else if (prev.selectedPlayer) {
        // Если шериф - реальный игрок и выбрал цель
        const target = prev.players.find(p => p.id === prev.selectedPlayer);
        
        if (target) {
          // Обновляем проверенных игроков
          const newCheckedPlayers = {
            ...prev.checkedPlayers,
            [target.id]: target.role
          };
          
          return {
            ...prev,
            checkedPlayers: newCheckedPlayers,
            phase: "results",
            selectedPlayer: null,
            timer: null
          };
        }
      }
      
      // По умолчанию переходим к результатам
      return {
        ...prev,
        phase: "results",
        timer: null
      };
    });
    
    // Переходим к результатам
    setTimeout(() => {
      showResults();
    }, 1000);
  };
  
  // Показ результатов ночи - добавление автоматического перехода к дневной фазе
  const showResults = () => {
    setState(prev => {
      // Находим цель мафии
      const targetId = prev.selectedPlayer;
      let killedPlayer = null;
      
      // Обновляем состояние игроков
      const newPlayers = [...prev.players];
      
      if (targetId) {
        const targetIndex = newPlayers.findIndex(p => p.id === targetId);
        if (targetIndex !== -1 && newPlayers[targetIndex].isAlive) {
          // "Убиваем" цель мафии
          newPlayers[targetIndex] = {
            ...newPlayers[targetIndex],
            isAlive: false
          };
          killedPlayer = newPlayers[targetIndex];
        }
      }
      
      // Находим шерифа
      const sheriff = prev.players.find(p => p.role === "sheriff" && p.isAlive);
      
      // Формируем сообщения
      const newMessages = [...prev.messages];
      
      newMessages.push({
        id: newMessages.length + 1,
        playerId: 0,
        text: "Наступило утро.",
        timestamp: Date.now(),
        isSystem: true
      });
      
      // Добавляем сообщение о убитом игроке
      if (killedPlayer) {
        newMessages.push({
          id: newMessages.length + 1,
          playerId: 0,
          text: `${killedPlayer.name} был убит ночью. Его роль: ${getRoleName(killedPlayer.role)}.`,
          timestamp: Date.now(),
          isSystem: true
        });
      } else {
        newMessages.push({
          id: newMessages.length + 1,
          playerId: 0,
          text: "Этой ночью никто не погиб.",
          timestamp: Date.now(),
          isSystem: true
        });
      }
      
      // Если шериф - реальный игрок, добавляем сообщение о результате проверки
      const sheriffCheckedId = Object.keys(prev.checkedPlayers).find(id => 
        !Object.keys(prev.checkedPlayers).includes(id) && 
        parseInt(id) === prev.selectedPlayer
      );
      
      if (sheriff && !sheriff.isBot && sheriffCheckedId) {
        const checkedPlayer = prev.players.find(p => p.id === parseInt(sheriffCheckedId));
        if (checkedPlayer) {
          const roleText = checkedPlayer.role === "mafia" ? "мафия" : "не мафия";
          newMessages.push({
            id: newMessages.length + 1,
            playerId: 0,
            text: `Шериф, вы проверили ${checkedPlayer.name}. Результат: ${roleText}.`,
            timestamp: Date.now(),
            isSystem: true
          });
        }
      }
      
      // Проверяем условия окончания игры
      const winner = checkWinCondition(newPlayers);
      
      if (winner) {
        newMessages.push({
          id: newMessages.length + 1,
          playerId: 0,
          text: winner === "mafia" 
            ? "Мафия победила! Они устранили всех мирных жителей." 
            : "Мирные жители победили! Вся мафия устранена.",
          timestamp: Date.now(),
          isSystem: true
        });
        
        return {
          ...prev,
          players: newPlayers,
          messages: newMessages,
          phase: "game-over",
          day: prev.day + 1,
          winner,
          timer: null,
          selectedPlayer: null
        };
      }
      
      // Переходим к следующему дню
      newMessages.push({
        id: newMessages.length + 1,
        playerId: 0,
        text: `День ${prev.day + 1}. У вас 30 секунд на обсуждение.`,
        timestamp: Date.now(),
        isSystem: true
      });
      
      return {
        ...prev,
        players: newPlayers,
        messages: newMessages,
        phase: "day",
        day: prev.day + 1,
        timer: 30, // 30 секунд на обсуждение
        selectedPlayer: null
      };
    });
    
    // Запускаем бота через небольшую задержку
    setTimeout(() => {
      botsTalk();
      
      // Автоматически переходим к голосованию через определенное время
      setTimeout(() => {
        if (state?.phase === "day") {
          setState(prev => ({
            ...prev,
            phase: "voting",
            timer: 10, // 10 секунд на голосование
            messages: [
              ...prev.messages,
              {
                id: prev.messages.length + 1,
                playerId: 0,
                text: "Начинается голосование. У вас 10 секунд, чтобы выбрать, кого вы считаете мафия.",
                timestamp: Date.now(),
                isSystem: true
              }
            ]
          }));
          
          // Запускаем голосование ботов
          setTimeout(() => {
            botsVote();
          }, 1500);
        }
      }, 20000); // 20 секунд на дневное обсуждение
    }, 1500);
  };
  
  // Боты общаются с улучшенным ИИ - исправление инициативы ботов
  const botsTalk = (triggers: string[] = []) => {
    setState(prev => {
      // Add null check for prev
      if (!prev || !prev.players) return prev || {...state};
      
      // Проверяем, что сейчас день и игра не закончилась
      if (prev.phase !== "day" || prev.winner) return prev;
      
      const livingBots = prev.players.filter(p => p.isBot && p.isAlive);
      if (livingBots.length === 0) return prev;
      
      // Выбираем бота для сообщения - предпочитаем тех, кто реагирует на триггеры
      let bot;
      if (triggers.length > 0) {
        // Находим ботов, которые могут отреагировать на триггеры
        const relevantBots = livingBots.filter(b => {
          if (triggers.includes("sheriff") && b.role === "sheriff") return true;
          if (triggers.includes("accusation") && b.role === "mafia") return true;
          if (triggers.includes("defense")) return true;
          return false;
        });
        
        if (relevantBots.length > 0) {
          bot = relevantBots[Math.floor(Math.random() * relevantBots.length)];
        } else {
          bot = livingBots[Math.floor(Math.random() * livingBots.length)];
        }
      } else {
        bot = livingBots[Math.floor(Math.random() * livingBots.length)];
      }
      
      // Определяем "личность" бота на основе его ID
      const botPersonality = bot.id % 4; // 0-3 разных типа личности
      const messageType = triggers.includes("accusation") ? "accusation" : triggers.includes("defense") ? "defense" : triggers.includes("sheriff") && bot.role === "sheriff" ? "sheriff" : triggers.includes("strategy") ? "strategy" : "default";
      
      // Генерируем сообщение в зависимости от роли, личности и триггеров
      let text = getBotMessage(bot.role, botPersonality, messageType, prev);
      
      // Добавляем сообщение
      const newMessage: Message = {
        id: prev.messages.length + 1,
        playerId: bot.id,
        text,
        timestamp: Date.now()
      };
      
      return {
        ...prev,
        messages: [...prev.messages, newMessage]
      };
    });
    
    // Планируем следующее сообщение от бота
    const randomDelay = 2000 + Math.floor(Math.random() * 3000);
    setTimeout(() => {
      // Проверяем, что все еще день и игра не закончилась
      if (state?.phase === "day" && !state?.winner) {
        botsTalk();
      }
    }, randomDelay);
  };
  
  // Получение сообщения бота в зависимости от роли, личности и триггеров
  const getBotMessage = (role: Role, personality: number, messageType: string, state: GameState): string => {
    // Большая база фраз для ботов
    const botPhrases: Record<string, Record<string, string[][]>> = {
      "mafia": {
        "default": [
          // Агрессивный тип (0)
          [
            "Я предлагаю убить самого активного игрока.",
            "Давайте устраним того, кто больше всех говорит.",
            "Нужно убрать того, кто может быть шерифом.",
            "Предлагаю убить того, кто слишком подозрителен.",
            "Нам нужно избавиться от самого опасного игрока."
          ],
          // Защищающийся тип (1)
          [
            "Я не мафия, я мирный житель!",
            "Почему вы меня обвиняете?",
            "Я могу доказать, что я мирный житель.",
            "Не обвиняйте меня, лучше посмотрите на других.",
            "Я понимаю вас, но вы ошибаетесь.",
            "Я клянусь, что я не мафия! Поверьте мне!"
          ],
          // Аналитический тип (2)
          [
            "Давайте логически подумаем, кто мог бы быть мафия.",
            "Если проанализировать поведение всех, то подозрительны...",
            "Мне кажется, мы упускаем важные детали в обсуждении.",
            "Если рассуждать логически, то мафия должна вести себя определенным образом.",
            "Анализируя голосования предыдущих дней, можно сделать интересные выводы.",
            "Статистически, вероятность того, что мафия среди молчунов, довольно высока.",
            "Давайте построим модель поведения каждого и найдем несоответствия."
          ],
          // Отвлекающий тип (3)
          [
            "Давайте не будем спешить с выводами на основе этих обвинений.",
            "У кого есть какие-то доказательства? Я не видел ничего подозрительного.",
            "Я мирный житель, могу поклясться!",
            "Мне кажется, мы зря тратим время на пустые споры.",
            "А что если мафия специально пытается нас запутать?",
            "Мы тратим драгоценное время на пустые споры.",
            "Может, сменим тему и поговорим о чем-то более конструктивном?",
            "Я думаю, что нам стоит успокоиться и мыслить рационально."
          ]
        ],
        "accusation": [
          // Агрессивный тип (0)
          [
            "Это абсурдные обвинения! Вы сами выглядите подозрительно.",
            "Вы пытаетесь отвести подозрения от себя, обвиняя других!",
            "Ваши аргументы совершенно не убедительны.",
            "Я категорически не согласен с вашими обвинениями.",
            "Вы сами ведете себя как мафия, пытаясь всех запутать!",
            "Это просто смешно! У вас нет никаких доказательств.",
            "Вы просто бросаетесь обвинениями без всяких оснований.",
            "Я бы на вашем месте был осторожнее с такими заявлениями."
          ],
          // Защищающийся тип (1)
          [
            "Я не мафия, клянусь! Почему вы меня обвиняете?",
            "Пожалуйста, поверьте мне, я на стороне города!",
            "Я понимаю вас, но вы ошибаетесь.",
            "Я действительно мирный житель, не голосуйте против меня!",
            "Я могу объяснить любые свои действия, просто спросите.",
            "Вы совершаете ошибку, обвиняя меня.",
            "Если вы проголосуете против меня, город потеряет мирного жителя.",
            "Я клянусь, что я не мафия! Поверьте мне!"
          ],
          // Аналитический тип (2)
          [
            "Ваши обвинения нелогичны. Давайте проанализируем факты.",
            "Если бы я был мафией, я бы действовал иначе.",
            "Статистически, ваши обвинения имеют мало оснований.",
            "Давайте рассмотрим все возможные сценарии прежде чем делать выводы.",
            "Я могу логически опровергнуть каждое ваше обвинение.",
            "Ваша теория интересна, но в ней есть существенные пробелы.",
            "Если проанализировать мое поведение объективно, вы увидите, что я не мафия.",
            "Ваши выводы основаны на ложных предпосылках."
          ],
          // Отвлекающий тип (3)
          [
            "А вы не думали, что настоящая мафия сейчас молчит?",
            "Давайте не будем отвлекаться на беспочвенные обвинения.",
            "Я думаю, что нам стоит обратить внимание на других игроков.",
            "Вместо того чтобы обвинять меня, давайте подумаем стратегически.",
            "Эти обвинения только на руку настоящей мафии.",
            "Мы тратим драгоценное время на пустые споры.",
            "Может быть, стоит послушать и других игроков?",
            "Я предлагаю сменить тему и обсудить что-то более конструктивное."
          ]
        ],
        "defense": [
          // Агрессивный тип (0)
          [
            "Вот именно так настоящая мафия и оправдывается!",
            "Чем больше ты оправдываешься, тем подозрительнее выглядишь.",
            "Типичная защита для мафии - говорить, что ты не мафия.",
            "Твои оправдания звучат неубедительно.",
            "Настоящий мирный житель не стал бы так активно защищаться.",
            "Твои оправдания выглядят слишком подготовленными.",
            "Ты слишком нервничаешь для невиновного.",
            "Чем больше ты говоришь, тем больше выдаешь себя."
          ],
          // Защищающийся тип (1)
          [
            "Я тоже не мафия! Мы все тут пытаемся выжить.",
            "Я понимаю тебя, меня тоже обвиняли безосновательно.",
            "Давайте не будем нападать друг на друга без доказательств.",
            "Я тоже могу поклясться в своей невиновности.",
            "Мы все в одной лодке, кроме мафии конечно.",
            "Я верю, что ты мирный, но нам нужны доказательства.",
            "Оправдываться - это нормально, я бы тоже защищался.",
            "Давайте будем справедливы друг к другу."
          ],
          // Аналитический тип (2)
          [
            "Интересно, что ты так активно защищаешься. Статистически это подозрительно.",
            "Твои аргументы логичны, но недостаточны для полного оправдания.",
            "Давай проанализируем твоё поведение с первого дня.",
            "Если ты невиновен, то твои действия должны быть последовательны.",
            "Я заметил некоторые противоречия в твоих высказываниях.",
            "Твоя защита имеет смысл, но есть некоторые нестыковки.",
            "Если применить логику, то твои оправдания не всегда убедительны.",
            "Я бы хотел услышать более конкретные аргументы в твою защиту."
          ],
          // Отвлекающий тип (3)
          [
            "Давайте не будем зацикливаться на оправданиях.",
            "Вместо оправданий, давайте обсудить стратегию.",
            "Я думаю, что нам стоит меньше оправдываться и больше действовать.",
            "Эти оправдания только на руку мафии.",
            "Может, поговорим о чем-то более конструктивном?",
            "Я предлагаю сменить тему и обсудить подозрительных игроков.",
            "Оправдания ничего не доказывают, нам нужны факты.",
            "Давайте перестанем ходить по кругу с этими оправданиями."
          ]
        ],
        "strategy": [
          // Агрессивный тип (0)
          [
            "Я предлагаю проголосовать против самых тихих игроков.",
            "Давайте сосредоточимся на тех, кто мало говорит.",
            "Я считаю, что нужно обратить внимание на тех, кто меняет свое мнение.",
            "Моя стратегия - выявлять противоречия в словах игроков.",
            "Я предлагаю следить за тем, кто как голосует.",
            "Давайте обратим внимание на тех, кто пытается манипулировать обсуждением.",
            "Я считаю подозрительными тех, кто слишком активно обвиняет других.",
            "Моя стратегия - наблюдать за реакциями на обвинения."
          ],
          // Защищающийся тип (1)
          [
            "Я предлагаю логически исключать наименее вероятных кандидатов.",
            "Давайте построим матрицу подозрений для каждого игрока.",
            "Я считаю, что нужно анализировать паттерны голосования.",
            "Моя стратегия основана на вероятностном анализе.",
            "Я предлагаю методично проверять каждого игрока.",
            "Давайте использовать дедуктивный метод для поиска мафии.",
            "Я считаю, что нужно строить логические цепочки событий.",
            "Моя стратегия - исключение невозможного."
          ],
          // Аналитический тип (2)
          [
            "Предлагаю проанализировать голосования предыдущих дней.",
            "Если мы построим матрицу подозрений, то сможем найти мафию.",
            "Статистически, мафия часто голосует против разных людей.",
            "Давайте логически исключим тех, кто точно не мафия.",
            "Я предлагаю стратегию исключения наименее вероятных кандидатов.",
            "Если мы проанализируем паттерны поведения, то найдем мафию.",
            "Моя стратегия основана на вероятностном анализе.",
            "Давайте построим дерево решений для оптимального голосования."
          ],
          // Отвлекающий тип (3)
          [
            "Может быть, нам стоит сосредоточиться на другом аспекте игры?",
            "Я думаю, что стратегия - это хорошо, но интуиция тоже важна.",
            "Давайте не будем слишком зацикливаться на одной стратегии.",
            "Иногда лучшая стратегия - это отсутствие стратегии.",
            "Я предлагаю действовать непредсказуемо, чтобы запутать мафию.",
            "Может быть, нам стоит просто довериться своим чувствам?",
            "Стратегии хороши, но они не всегда работают в такой игре.",
            "Я предпочитаю адаптивный подход, а не жесткую стратегию."
          ]
        ]
      },
      "sheriff": {
        "default": [
          // Прямой тип (0)
          [
            "Я внимательно наблюдаю за всеми игроками.",
            "Мне кажется, некоторые ведут себя подозрительно.",
            "Я обращаю внимание на то, кто как голосует.",
            "Давайте внимательно следить за поведением друг друга.",
            "Я заметил некоторые странности в поведении отдельных игроков.",
            "Нам нужно быть внимательнее к тому, кто что говорит.",
            "Я стараюсь анализировать каждое слово и действие.",
            "Мне кажется, что ключ к победе - в наблюдательности."
          ],
          // Осторожный тип (1)
          [
            "Я пока не уверен, кто может быть мафия.",
            "Нужно больше информации, чтобы делать выводы.",
            "Давайте не будем спешить с обвинениями.",
            "Я предпочитаю сначала собрать больше данных.",
            "Мне нужно еще немного времени для анализа.",
            "Я стараюсь быть объективным в своих наблюдениях.",
            "Пока рано делать окончательные выводы.",
            "Я предпочитаю действовать наверняка."
          ],
          // Аналитический тип (2)
          [
            "Если проанализировать поведение всех игроков, можно найти несоответствия.",
            "Я пытаюсь выстроить логическую цепочку событий.",
            "Статистически, мафия часто проявляет определенные поведенческие паттерны.",
            "Я собираю информацию для комплексного анализа.",
            "Логика подсказывает мне, что мы должны обратить внимание на...",
            "Если исключить невозможное, то останется правда, какой бы невероятной она ни была.",
            "Я строю вероятностную модель для каждого игрока.",
            "Мой анализ основан на объективных наблюдениях."
          ],
          // Загадочный тип (3)
          [
            "У меня есть некоторые соображения, но я пока не готов ими поделиться.",
            "Я наблюдаю за всеми вами и делаю выводы.",
            "Иногда молчание говорит больше, чем слова.",
            "Я знаю больше, чем могу сказать сейчас.",
            "Доверьтесь мне, у меня есть план.",
            "Я вижу картину, которая пока не доступна остальным.",
            "Всему свое время, скоро все станет ясно.",
            "Я предпочитаю держать свои мысли при себе до поры до времени."
          ]
        ],
        "sheriff": [
          // Прямой тип (0) - с намеками на роль шерифа
          [
            "Как человек, который внимательно следит за всеми, могу сказать...",
            "Если бы я мог проверять людей, я бы начал с самых подозрительных.",
            "Я думаю, что роль шерифа очень важна в этой игре.",
            "Шериф должен быть очень осторожен со своими заявлениями.",
            "Если бы я был шерифом, я бы уже знал, кто мафия.",
            "Проверки - это ключ к победе мирных жителей.",
            "Шериф должен тщательно выбирать, кого проверять каждую ночь.",
            "Я считаю, что информация о ролях - самое ценное в этой игре."
          ],
          // Осторожный тип (1) - с намеками на роль шерифа
          [
            "Я бы не стал сразу раскрывать информацию о ролях, даже если бы знал.",
            "Шериф должен быть очень осторожен, чтобы не выдать себя мафии.",
            "Даже если кто-то знает роли других, лучше быть осторожным с этой информацией.",
            "Я думаю, что проверки должны проводиться стратегически.",
            "Если у кого-то есть информация о ролях, лучше делиться ею осторожно.",
            "Я бы советовал шерифу не раскрываться слишком рано.",
            "Информация о ролях очень ценна, но и опасна.",
            "Я предпочитаю осторожный подход к раскрытию информации."
          ],
          // Аналитический тип (2) - с намеками на роль шерифа
          [
            "Статистически, шериф имеет большие шансы найти мафию за несколько ночей.",
            "Если проанализировать оптимальную стратегию проверок, то...",
            "Логически рассуждая, шериф должен проверять наиболее подозрительных игроков.",
            "Вероятность того, что шериф найдет всю мафию, зависит от многих факторов.",
            "Я провел анализ и считаю, что шериф должен действовать определенным образом.",
            "Математически, шансы шерифа найти мафию растут с каждой ночью.",
            "Если применить теорию вероятностей к проверкам шерифа...",
            "Аналитически подходя к роли шерифа, можно разработать оптимальную стратегию."
          ],
          // Загадочный тип (3) - с намеками на роль шерифа
          [
            "Я знаю больше, чем кажется на первый взгляд.",
            "Я наблюдаю за всеми вами и делаю выводы.",
            "Иногда молчание говорит больше, чем слова.",
            "Я знаю больше, чем могу сказать сейчас.",
            "Доверьтесь мне, у меня есть план.",
            "Я вижу картину, которая пока не доступна остальным.",
            "Всему свое время, скоро все станет ясно.",
            "Я предпочитаю держать свои мысли при себе до поры до времени."
          ]
        ]
      },
      "civilian": {
        "default": [
          // Подозрительный тип (0)
          [
            "Кто-то из нас точно мафия, нужно быть внимательнее.",
            "Я заметил странное поведение некоторых игроков.",
            "Кто молчит, тот и мафия!",
            "Давайте внимательнее следить за тем, кто как себя ведет.",
            "Мне кажется подозрительным поведение некоторых игроков.",
            "Я не доверяю тем, кто слишком много оправдывается.",
            "Нужно обращать внимание на то, кто как голосует.",
            "Я подозреваю тех, кто пытается отвлечь внимание от себя."
          ],
          // Логический тип (1)
          [
            "Давайте подумаем логически, кто мог бы быть мафия?",
            "Если проанализировать все сообщения, можно найти подсказки.",
            "Я мирный житель, и хочу помочь найти мафия с помощью логики.",
            "Давайте исключать по очереди тех, кто точно не мафия.",
            "Логически рассуждая, мафия должна вести себя определенным образом.",
            "Если мы проанализируем голосования, то сможем найти закономерности.",
            "Я предлагаю методично исключать подозреваемых.",
            "Давайте построим логическую цепочку событий."
          ],
          // Эмоциональный тип (2)
          [
            "Я так и знал! Я чувствовал, что он мафия!",
            "Боже мой, неужели мы нашли мафия?!", // Missing comma here
            "Я в шоке! Но это многое объясняет!", // Missing comma here
            "Я всегда чувствовал, что с ним что-то не так!", // Missing comma here
            "Как страшно осознавать, что мафия была рядом с нами!", // Missing comma here
            "Я так волнуюсь! Неужели мы наконец-то нашли мафия?", // Missing comma here
            "Я просто не могу поверить! Это он?!", // Missing comma here
            "Мое сердце подсказывало мне, что он не тот, за кого себя выдает!"
          ],
          // Спокойный тип (3)
          [
            "Давайте сохранять спокойствие и методично искать мафия.",
            "У кого есть какие-то подозрения? Я готов выслушать все версии.",
            "Я мирный житель, и хочу спокойно обсудить все варианты.",
            "Не стоит паниковать, давайте рассуждать здраво.",
            "Я предлагаю всем успокоиться и обсудить ситуацию.",
            "Паника только на руку мафия, давайте будем рациональны.",
            "Я уверен, что вместе мы сможем найти правильное решение.",
            "Давайте спокойно взвесим все за и против."
          ]
        ],
        "accusation": [
          // Подозрительный тип (0)
          [
            "Я согласен, этот игрок действительно подозрителен!",
            "Да, я тоже заметил странности в его поведении.",
            "Точно! Он постоянно пытается отвести от себя подозрения.",
            "Я поддерживаю эти обвинения, давайте проголосуем против него.",
            "Мне тоже кажется, что он что-то скрывает.",
            "Я давно подозревал этого игрока!",
            "Его поведение выдает его с головой.",
            "Я готов голосовать против этого подозрительного типа."
          ],
          // Логический тип (1)
          [
            "Давайте проанализируем эти обвинения логически.",
            "Есть ли у нас достаточно доказательств для таких обвинений?",
            "Я хочу услышать аргументы обеих сторон, прежде чем делать выводы.",
            "Если рассуждать логически, то эти обвинения имеют смысл.",
            "Давайте рассмотрим все факты, прежде чем обвинять кого-то.",
            "Я хочу понять, на чем основаны эти обвинения.",
            "Логика подсказывает мне, что в этих обвинениях что-то есть.",
            "Давайте методично проверим все аргументы."
          ],
          // Эмоциональный тип (2)
          [
            "Я так и знал! Я чувствовал, что он мафия!",
            "Боже мой, неужели мы нашли мафия?!", // Missing comma here
            "Я в шоке! Но это многое объясняет!", // Missing comma here
            "Я всегда чувствовал, что с ним что-то не так!", // Missing comma here
            "Как страшно осознавать, что мафия была рядом с нами!", // Missing comma here
            "Я так волнуюсь! Неужели мы наконец-то нашли мафия?", // Missing comma here
            "Я просто не могу поверить! Это он?!", // Missing comma here
            "Мое сердце подсказывало мне, что он не тот, за кого себя выдает!"
          ],
          // Спокойный тип (3)
          [
            "Давайте не будем спешить с выводами на основе этих обвинений.",
            "Я предлагаю спокойно обсудить эти обвинения.",
            "Давайте выслушаем обвиняемого, прежде чем принимать решение.",
            "Я считаю, что нам нужно больше доказательств.",
            "Давайте будем объективны и справедливы в наших обвинениях.",
            "Я предпочитаю не делать поспешных выводов.",
            "Давайте спокойно взвесим все за и против этих обвинений.",
            "Я призываю всех к спокойствию и объективности в оценке этих обвинений."
          ]
        ],
        "defense": [
          // Подозрительный тип (0)
          [
            "Твои оправдания звучат неубедительно.",
            "Чем больше ты оправдываешься, тем подозрительнее выглядишь.",
            "Я не верю твоим оправданиям.",
            "Твоя защита только усиливает мои подозрения.",
            "Настоящему мирному жителю не нужно так активно защищаться.",
            "Твои оправдания звучат как типичная речь мафии.",
            "Я не доверяю людям, которые так много оправдываются.",
            "Твоя защита выглядит слишком подготовленной."
          ],
          // Логический тип (1)
          [
            "Твои аргументы имеют смысл, но есть некоторые нестыковки.",
            "Давай логически проанализируем твои оправдания.",
            "Я хочу услышать более конкретные доказательства твоей невиновности.",
            "Если ты действительно мирный, то твои действия должны быть последовательны.",
            "Я пытаюсь объективно оценить твои аргументы.",
            "Твоя защита логична, но недостаточно убедительна.",
            "Я хочу понять, как твои объяснения согласуются с фактами.",
            "Давай разберем твои аргументы по пунктам."
          ],
          // Эмоциональный тип (2)
          [
            "Я хочу верить тебе, но мне так страшно ошибиться!",
            "Боже, как сложно понять, кто говорит правду!",
            "Я так переживаю, что мы можем казнить невиновного!",
            "Мое сердце говорит мне верить тебе, но разум сомневается!",
            "Я в таком смятении! Не знаю, кому верить!",
            "Как же тяжело принимать такие решения!",
            "Я боюсь сделать неправильный выбор!",
            "Мне тревожно от всех этих оправданий и обвинений!"
          ],
          // Спокойный тип (3)
          [
            "Я выслушал твои оправдания и готов их обдумать.",
            "Давайте все успокоимся и объективно оценим ситуацию.",
            "Я считаю, что каждый заслуживает шанса защитить себя.",
            "Давайте не будем спешить с выводами после этих оправданий.",
            "Я предлагаю всем спокойно обдумать услышанное.",
            "Я ценю твою честность и открытость в защите.",
            "Давайте будем справедливы и выслушаем все стороны.",
            "Я призываю к спокойствию и объективности в оценке этих оправданий."
          ]
        ],
        "strategy": [
          // Подозрительный тип (0)
          [
            "Я предлагаю голосовать против самых подозрительных игроков.",
            "Давайте сосредоточимся на тех, кто мало говорит.",
            "Я считаю, что нужно обратить внимание на тех, кто меняет свое мнение.",
            "Моя стратегия - выявлять противоречия в словах игроков.",
            "Я предлагаю следить за тем, кто как голосует.",
            "Давайте обратим внимание на тех, кто пытается манипулировать обсуждением.",
            "Я считаю подозрительными тех, кто слишком активно обвиняет других.",
            "Моя стратегия - наблюдать за реакциями на обвинения."
          ],
          // Логический тип (1)
          [
            "Я предлагаю логически исключать наименее вероятных кандидатов.",
            "Давайте построим матрицу подозрений для каждого игрока.",
            "Я считаю, что нужно анализировать паттерны голосования.",
            "Моя стратегия основана на вероятностном анализе.",
            "Я предлагаю методично проверять каждого игрока.",
            "Давайте использовать дедуктивный метод для поиска мафии.",
            "Я считаю, что нужно строить логические цепочки событий.",
            "Моя стратегия - исключение невозможного."
          ],
          // Эмоциональный тип (2)
          [
            "Я чувствую, что нам нужно действовать быстро!",
            "Мое сердце подсказывает мне, что мафия среди нас!",
            "Я так боюсь, что мы не успеем найти мафия!",
            "Давайте объединимся против общего врага!",
            "Я верю, что вместе мы сможем победить мафия!",
            "Мне страшно, но мы должны быть решительными!",
            "Я чувствую, что мы на правильном пути!",
            "Давайте доверимся нашей интуиции!"
          ],
          // Спокойный тип (3)
          [
            "Я предлагаю действовать осмотрительно и не спешить.",
            "Давайте спокойно обсудим все возможные стратегии.",
            "Я считаю, что паника только на руку мафия.",
            "Моя стратегия - сохранять спокойствие и рациональность.",
            "Я предлагаю взвешенный подход к принятию решений.",
            "Давайте не будем поддаваться эмоциям при выборе стратегии.",
            "Я считаю, что спокойствие - наше главное оружие.",
            "Моя стратегия - тщательно обдумывать каждый шаг."
          ]
        ]
      }
    };
    
    // Получаем фразы для конкретной роли и типа личности
    const phrases = botPhrases[role]?.[messageType]?.[personality] || botPhrases[role]?.["default"]?.[personality];
    
    if (!phrases || phrases.length === 0) {
      // Если нет подходящих фраз, используем дефолтные
      return "Я думаю, нам нужно быть внимательнее.";
    }
    
    // Если роль - шериф, и у него есть проверенные мафии, то можем намекнуть на это
    if (role === "sheriff" && messageType === "default") {
      const checkedMafia = Object.entries(state.checkedPlayers)
        .filter(([id, role]) => role === "mafia" && state.players.some(p => p.id === parseInt(id) && p.isAlive));
      
      if (checkedMafia.length > 0) {
        const mafia = state.players.find(p => p.id === parseInt(checkedMafia[0][0]));
        if (mafia) {
          const sheriffHints = [
            `Я внимательно наблюдаю за ${mafia.name}, и мне не нравится то, что я вижу.`,
            `Есть что-то подозрительное в поведении ${mafia.name}.`,
            `Я бы посоветовал присмотреться к ${mafia.name} внимательнее.`,
            `Мне кажется, ${mafia.name} что-то скрывает от нас.`
          ];
          return sheriffHints[Math.floor(Math.random() * sheriffHints.length)];
        }
      }
    }
    
    // Если роль - мафия, и есть подозрения на шерифа, то можем попытаться его дискредитировать
    if (role === "mafia" && messageType === "default") {
      const sheriffSuspects = state.players.filter(p => 
        p.isAlive && 
        p.role !== "mafia" && 
        state.messages.some(m => 
          m.playerId === p.id && 
          (m.text.includes("подозрительно") || 
           m.text.includes("проверил") || 
           m.text.includes("думаю, что"))
        )
      );
      
      if (sheriffSuspects.length > 0) {
        const suspect = sheriffSuspects[Math.floor(Math.random() * sheriffSuspects.length)];
        const antiSheriffPhrases = [
          `Мне кажется, ${suspect.name} слишком уверенно делает заявления. Может, это мафия пытается запутать нас?`,
          `Я не доверяю словам ${suspect.name}, они звучат подозрительно.`,
          `${suspect.name} пытается манипулировать нами, не слушайте его!`,
          `Я думаю, что ${suspect.name} может быть мафией, которая притворяется шерифом.`
        ];
        return antiSheriffPhrases[Math.floor(Math.random() * antiSheriffPhrases.length)];
      }
    }
    
    // Возвращаем случайную фразу из подходящего набора
    return phrases[Math.floor(Math.random() * phrases.length)];
  };
  
  // Переход к следующей фазе
  const nextPhase = () => {
    setState(prev => {
      if (prev.phase === "day") {
        // Переходим к голосованию
        return {
          ...prev,
          phase: "voting",
          timer: 10, // 10 секунд на голосование
          messages: [
            ...prev.messages,
            {
              id: prev.messages.length + 1,
              playerId: 0,
              text: "Начинается голосование. У вас 10 секунд, чтобы выбрать, кого вы считаете мафия.",
              timestamp: Date.now(),
              isSystem: true
            }
          ]
        };
      } else if (prev.phase === "last-word") {
        // Переходим к ночи после последнего слова
        return startNight();
      } else if (prev.phase === "mafia-chat") {
        // Переходим к голосованию мафии
        return {
          ...prev,
          phase: "mafia-turn",
          timer: 15, // 15 секунд на голосование мафии
          mafiaMessages: [
            ...prev.mafiaMessages,
            {
              id: prev.mafiaMessages.length + 1,
              playerId: 0,
              text: "Мафия, выберите жертву.",
              timestamp: Date.now(),
              isSystem: true
            }
          ]
        };
      } else if (prev.phase === "sheriff-turn") {
        // Если шериф - реальный игрок, но не выбрал цель, переходим к результатам
        const sheriff = prev.players.find(p => p.isAlive && p.role === "sheriff");
        
        if (sheriff && !sheriff.isBot && !prev.selectedPlayer) {
          return {
            ...prev,
            phase: "results",
            timer: null
          };
        }
      }
      
      return prev;
    });
    
    // Если перешли к голосованию, запускаем голосование ботов
    if (state.phase === "voting") {
      setTimeout(() => {
        botsVote();
      }, 1500);
    } else if (state.phase === "mafia-turn") {
      setTimeout(() => {
        mafiaBotsVote();
      }, 1500);
    } else if (state.phase === "results") {
      setTimeout(() => {
        showResults();
      }, 1500);
    }
  };
  
  // Проверка условий победы - исправленная версия
  const checkWinCondition = (players: Player[]): "mafia" | "civilians" | null => {
    const livingPlayers = players.filter(p => p.isAlive);
    const livingMafia = livingPlayers.filter(p => p.role === "mafia");
    const livingCivilians = livingPlayers.filter(p => p.role !== "mafia");
    
    // Проверяем, жив ли игрок (не в тестовом режиме)
    const realPlayer = players.find(p => !p.isBot);
    if (realPlayer && !realPlayer.isAlive && !state.testMode) {
      return realPlayer.role === "mafia" ? "civilians" : "mafia";
    }
    
    // Мафия побеждает, если их количество равно или больше количества мирных
    if (livingMafia.length >= livingCivilians.length) {
      return "mafia";
    }
    
    // Мирные побеждают, если вся мафия мертва
    if (livingMafia.length === 0) {
      return "civilians";
    }
    
    // Игра продолжается
    return null;
  };
  
  // Получение названия роли
  const getRoleName = (role: Role): string => {
    switch (role) {
      case "civilian": return "Мирный житель";
      case "mafia": return "Мафия";
      case "sheriff": return "Шериф";
      default: return "Неизвестно";
    }
  };
  
  return (
    <GameContext.Provider value={{ 
      state, 
      initGame, 
      selectPlayer, 
      sendMessage, 
      vote, 
      nextPhase 
    }}>
      {children}
    </GameContext.Provider>
  );
};

// Хук для использования контекста
export const useGame = () => {
  const context = React.useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};