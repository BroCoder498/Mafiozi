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
  mafiaMessages: Message[];
  phase: GamePhase;
  day: number;
  selectedPlayer: number | null;
  checkedPlayers: Record<number, Role>;
  votes: Record<number, number>;
  mafiaVotes: Record<number, number>;
  winner: "mafia" | "civilians" | null;
  timer: number | null;
  mafiaCount: number;
  testMode: boolean;
  eliminatedPlayer: Player | null;
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
    mafiaMessages: [],
    phase: "setup",
    day: 1,
    selectedPlayer: null,
    checkedPlayers: {},
    votes: {},
    mafiaVotes: {},
    winner: null,
    timer: null,
    mafiaCount: 0,
    testMode: false,
    eliminatedPlayer: null
  });

  // Таймер для фаз
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (state?.timer !== null && state?.timer !== undefined) {
      interval = setInterval(() => {
        setState(prevState => {
          if (!prevState || prevState.timer === null) {
            if (interval) clearInterval(interval);
            return prevState;
          }

          if (prevState.timer <= 1) {
            if (interval) clearInterval(interval);

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
              setTimeout(() => processVotes(), 500);
              return {
                ...prevState,
                timer: null
              };
            } else if (prevState.phase === "last-word") {
              setTimeout(() => startNight(), 500);
              return {
                ...prevState,
                timer: null
              };
            } else if (prevState.phase === "mafia-chat") {
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
              setTimeout(() => mafiaAction(), 500);
              return {
                ...prevState,
                timer: null
              };
            } else if (prevState.phase === "sheriff-turn") {
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
  }, [state?.phase, state?.timer]);

  // Инициализация игры
  const initGame = (playerCount: number, playerName: string, testMode: boolean = false) => {
    const players: Player[] = [];

    if (!testMode) {
      players.push({
        id: 1,
        name: playerName,
        role: "civilian",
        isAlive: true,
        isBot: false,
        avatar: ""
      });
    } else {
      players.push({
        id: 1,
        name: "Вы (Тест)",
        role: "civilian",
        isAlive: true,
        isBot: true,
        avatar: ""
      });
    }

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
        role: "civilian",
        isAlive: true,
        isBot: true,
        avatar: ""
      });
    }

    const mafiaCount = playerCount === 10 ? 3 : Math.max(1, Math.floor(playerCount / 4));
    assignRoles(players, mafiaCount);

    setState({
      players,
      messages: [{
        id: 1,
        playerId: 0,
        text: "Игра началась! Наступил день 1. У вас 30 секунд на обсуждение.",
        timestamp: Date.now(),
        isSystem: true
      }],
      mafiaMessages: [],
      phase: "day",
      day: 1,
      selectedPlayer: null,
      checkedPlayers: {},
      votes: {},
      mafiaVotes: {},
      winner: null,
      timer: 30,
      mafiaCount,
      testMode,
      eliminatedPlayer: null
    });

    setTimeout(() => {
      botsTalk();

      setTimeout(() => {
        if (state?.phase === "day") {
          setState(prev => ({
            ...prev,
            phase: "voting",
            timer: 10,
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

          setTimeout(() => {
            botsVote();
          }, 1500);
        }
      }, 20000);
    }, 1500);
  };

  // Назначение ролей
  const assignRoles = (players: Player[], mafiaCount: number) => {
    const playersCopy = [...players];

    for (let i = playersCopy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playersCopy[i], playersCopy[j]] = [playersCopy[j], playersCopy[i]];
    }

    for (let i = 0; i < playersCopy.length; i++) {
      if (i < mafiaCount) {
        playersCopy[i].role = "mafia";
      } else if (i === mafiaCount) {
        playersCopy[i].role = "sheriff";
      } else {
        playersCopy[i].role = "civilian";
      }
    }

    for (let i = playersCopy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playersCopy[i], playersCopy[j]] = [playersCopy[j], playersCopy[i]];
    }

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

      setTimeout(() => {
        mafiaBotsTalk();
      }, 1500);
    } else {
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, newMessage]
      }));

      const triggers = analyzeBotTriggers(text);

      setTimeout(() => {
        botsTalk(triggers);
      }, 1500);
    }
  };

  // Анализ триггеров для ботов
  const analyzeBotTriggers = (message: string): string[] => {
    const triggers: string[] = [];
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("мафия") ||
        lowerMessage.includes("подозрева") ||
        lowerMessage.includes("убий") ||
        lowerMessage.includes("голосу")) {
      triggers.push("accusation");
    }

    if (lowerMessage.includes("невинов") ||
        lowerMessage.includes("не я") ||
        lowerMessage.includes("я не") ||
        lowerMessage.includes("докажу")) {
      triggers.push("defense");
    }

    if (lowerMessage.includes("проверил") ||
        lowerMessage.includes("шериф") ||
        lowerMessage.includes("роль")) {
      triggers.push("sheriff");
    }

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

    const player = state.players.find(p => !p.isBot);
    if (!player || !player.isAlive) return;

    if (isMafiaVote && player.role !== "mafia") return;

    setState(prev => {
      const newVotes = isMafiaVote
        ? { ...prev.mafiaVotes, [player.id]: targetId }
        : { ...prev.votes, [player.id]: targetId };

      const livingPlayers = isMafiaVote
        ? prev.players.filter(p => p.isAlive && p.role === "mafia")
        : prev.players.filter(p => p.isAlive);

      const votedPlayers = Object.keys(isMafiaVote ? newVotes : prev.votes).length;

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
          votes: isMafiaVote ? prev.votes : newVotes,
          timer: null
        };
      } else {
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

  // Боты голосуют
  const botsVote = () => {
    setState(prev => {
      if (!prev || prev.phase !== "voting") return prev;

      const newVotes = { ...prev.votes };
      const livingBots = prev.players.filter(p => p.isBot && p.isAlive);
      const livingPlayers = prev.players.filter(p => p.isAlive);

      for (const bot of livingBots) {
        if (newVotes[bot.id]) continue;

        let targetId;

        if (bot.role === "mafia") {
          const sheriffSuspects = livingPlayers.filter(p =>
            p.isAlive &&
            p.role !== "mafia" &&
            p.id !== bot.id &&
            prev.messages.some(m =>
              m.playerId === p.id &&
              (m.text.includes("подозрительно") ||
               m.text.includes("проверил") ||
               m.text.includes("думаю, что"))
            )
          );

          if (sheriffSuspects.length > 0) {
            targetId = sheriffSuspects[Math.floor(Math.random() * sheriffSuspects.length)].id;
          } else {
            const targets = livingPlayers.filter(p => p.isAlive && p.role !== "mafia" && p.id !== bot.id);
            if (targets.length > 0) {
              targetId = targets[Math.floor(Math.random() * targets.length)].id;
            }
          }
        } else if (bot.role === "sheriff") {
          const checkedMafia = Object.entries(prev.checkedPlayers)
            .filter(([id, role]) => role === "mafia" && livingPlayers.some(p => p.id === parseInt(id) && p.isAlive))
            .map(([id]) => parseInt(id));

          if (checkedMafia.length > 0) {
            targetId = checkedMafia[0];
          } else {
            const suspiciousPlayers = livingPlayers.filter(p =>
              p.isAlive &&
              p.id !== bot.id &&
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
              const targets = livingPlayers.filter(p => p.isAlive && p.id !== bot.id);
              if (targets.length > 0) {
                targetId = targets[Math.floor(Math.random() * targets.length)].id;
              }
            }
          }
        } else {
          const messageCountByPlayer = new Map<number, number>();
          prev.messages.forEach(m => {
            if (!m.isSystem) {
              messageCountByPlayer.set(m.playerId, (messageCountByPlayer.get(m.playerId) || 0) + 1);
            }
          });

          const suspiciousPlayers = livingPlayers.filter(p =>
            p.isAlive &&
            p.id !== bot.id &&
            ((messageCountByPlayer.get(p.id) || 0) < 2 ||
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
            const targets = livingPlayers.filter(p => p.isAlive && p.id !== bot.id);
            if (targets.length > 0) {
              targetId = targets[Math.floor(Math.random() * targets.length)].id;
            }
          }
        }

        if (targetId) {
          newVotes[bot.id] = targetId;
          prev.messages.push({
            id: prev.messages.length + 1,
            playerId: bot.id,
            text: `Я голосую против ${prev.players.find(p => p.id === targetId)?.name}!`,
            timestamp: Date.now()
          });
        }
      }

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

  // Голосование ботов-мафии
  const mafiaBotsVote = () => {
    setState(prev => {
      if (!prev || prev.phase !== "mafia-turn") return prev;

      const newVotes = { ...prev.mafiaVotes };
      const livingMafiaBots = prev.players.filter(p => p.isBot && p.isAlive && p.role === "mafia");
      const potentialTargets = prev.players.filter(p => p.isAlive && p.role !== "mafia");

      for (const bot of livingMafiaBots) {
        if (newVotes[bot.id]) continue;

        if (potentialTargets.length > 0) {
          const sheriffSuspects = potentialTargets.filter(p =>
            prev.messages.some(m =>
              m.playerId === p.id &&
              (m.text.includes("подозрительно") ||
               m.text.includes("проверил") ||
               m.text.includes("думаю, что"))
            )
          );

          const messageCountByPlayer = new Map<number, number>();
          prev.messages.forEach(m => {
            if (!m.isSystem) {
              messageCountByPlayer.set(m.playerId, (messageCountByPlayer.get(m.playerId) || 0) + 1);
            }
          });

          const activeTargets = potentialTargets.filter(p => (messageCountByPlayer.get(p.id) || 0) > 2);

          let target;
          if (sheriffSuspects.length > 0) {
            target = sheriffSuspects[Math.floor(Math.random() * sheriffSuspects.length)];
          } else if (activeTargets.length > 0) {
            target = activeTargets[Math.floor(Math.random() * activeTargets.length)];
          } else {
            target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
          }

          newVotes[bot.id] = target.id;

          prev.mafiaMessages.push({
            id: prev.mafiaMessages.length + 1,
            playerId: bot.id,
            text: `Я голосую за убийство ${target.name}.`,
            timestamp: Date.now()
          });
        }
      }

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
      const voteCounts: Record<number, number> = {};
      Object.values(prev.mafiaVotes).forEach(targetId => {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
      });

      let maxVotes = 0;
      let targetId: number | null = null;

      Object.entries(voteCounts).forEach(([id, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          targetId = parseInt(id);
        }
      });

      if (targetId === null) {
        return {
          ...prev,
          phase: "sheriff-turn",
          timer: 15,
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

      const target = prev.players.find(p => p.id === targetId);

      return {
        ...prev,
        phase: "sheriff-turn",
        timer: 15,
        selectedPlayer: targetId,
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

  // Обработка голосов
  const processVotes = () => {
    setState(prev => {
      if (!prev) return prev;

      const realPlayer = prev.players.find(p => !p.isBot);
      if (realPlayer && !realPlayer.isAlive && !prev.testMode) {
        const winner = realPlayer.role === "mafia" ? "civilians" : "mafia";
        return {
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: prev.messages.length + 1,
              playerId: 0,
              text: `Игрок ${realPlayer.name} был исключен. Его роль: ${getRoleName(realPlayer.role)}.`,
              timestamp: Date.now(),
              isSystem: true
            },
            {
              id: prev.messages.length + 2,
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

      const voteCounts: Record<number, number> = {};
      Object.values(prev.votes).forEach(targetId => {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
      });

      let maxVotes = 0;
      let eliminatedId: number | null = null;

      Object.entries(voteCounts).forEach(([id, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          eliminatedId = parseInt(id);
        }
      });

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

        newMessages.push({
          id: newMessages.length + 1,
          playerId: eliminatedPlayer.id,
          text: eliminatedPlayer.role === "mafia"
            ? "Вы меня раскрыли... Но это ещё не конец!"
            : lastWords[Math.floor(Math.random() * lastWords.length)],
          timestamp: Date.now()
        });
      }

      const newPlayers = prev.players.map(p => {
        if (p.id === eliminatedId) {
          return { ...p, isAlive: false };
        }
        return p;
      });

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

      return {
        ...prev,
        players: newPlayers,
        messages: newMessages,
        phase: "last-word",
        votes: {},
        timer: 15,
        eliminatedPlayer: eliminatedPlayer
      };
    });

    setTimeout(() => {
      startNight();
    }, 5000);
  };

  // Начало ночи
  const startNight = () => {
    setState(prev => {
      if (!prev) return prev;

      const realPlayer = prev.players.find(p => !p.isBot);
      if (realPlayer && !realPlayer.isAlive && !prev.testMode) {
        const winner = realPlayer.role === "mafia" ? "civilians" : "mafia";
        return {
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: prev.messages.length + 1,
              playerId: 0,
              text: `Игрок ${realPlayer.name} был исключен. Его роль: ${getRoleName(realPlayer.role)}.`,
              timestamp: Date.now(),
              isSystem: true
            },
            {
              id: prev.messages.length + 2,
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

      return {
        ...prev,
        messages: newMessages,
        phase: "night",
        votes: {},
        timer: null,
        eliminatedPlayer: null
      };
    });

    setTimeout(() => {
      nightPhase();
    }, 2000);
  };

  // Ночная фаза
  const nightPhase = () => {
    setState(prev => {
      const livingMafia = prev.players.filter(p => p.isAlive && p.role === "mafia");

      if (livingMafia.length === 0) {
        return {
          ...prev,
          phase: "sheriff-turn",
          timer: 15,
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

      return {
        ...prev,
        phase: "mafia-chat",
        timer: 20,
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

    setTimeout(() => {
      mafiaBotsTalk();

      setTimeout(() => {
        startMafiaVoting();
      }, 10000);
    }, 1500);
  };

  // Начало голосования мафии
  const startMafiaVoting = () => {
    setState(prev => {
      if (prev.phase !== "mafia-chat") return prev;

      return {
        ...prev,
        phase: "mafia-turn",
        timer: 15,
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

    setTimeout(() => {
      mafiaBotsVote();

      setTimeout(() => {
        processMafiaVotes();
      }, 5000);
    }, 1500);
  };

  // Боты-мафия общаются
  const mafiaBotsTalk = () => {
    setState(prev => {
      if (!prev || prev.phase !== "mafia-chat") return prev;

      const livingMafiaBots = prev.players.filter(p => p.isBot && p.isAlive && p.role === "mafia");
      if (livingMafiaBots.length === 0) return prev;

      const bot = livingMafiaBots[Math.floor(Math.random() * livingMafiaBots.length)];
      const botPersonality = bot.id % 4;

      const mafiaMessages = [
        [
          "Я предлагаю убить самого активного игрока.",
          "Давайте устраним того, кто больше всех говорит.",
          "Нужно убрать того, кто может быть шерифом.",
          "Предлагаю убить того, кто слишком подозрителен.",
          "Нам нужно избавиться от самого опасного игрока."
        ],
        [
          "Я думаю, нам стоит убить того, кто меньше всего подозревается.",
          "Давайте выберем жертву, которая не вызывает подозрений.",
          "Предлагаю действовать хитро и убить неочевидную цель.",
          "Нам нужно быть стратегичными в выборе жертвы.",
          "Я предлагаю убить того, кто может объединить мирных жителей."
        ],
        [
          "Анализируя сообщения, я думаю, что шериф - это...",
          "Судя по голосованию, нам стоит убить...",
          "Если логически рассуждать, то лучшая цель - это...",
          "По моим наблюдениям, самый опасный для нас игрок - это...",
          "Статистически, нам выгоднее всего убить..."
        ],
        [
          "Давайте будем осторожны и не убивать слишком очевидные цели.",
          "Я предлагаю действовать незаметно и не привлекать внимание.",
          "Нам нужно быть хитрыми в выборе жертвы.",
          "Предлагаю не торопиться с выбором цели.",
          "Давайте тщательно обдумаем, кого убить."
        ]
      ];

      const text = mafiaMessages[botPersonality][Math.floor(Math.random() * mafiaMessages[botPersonality].length)];

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

        if (Math.random() > 0.5) {
          const targetText = targetMessages[Math.floor(Math.random() * targetMessages.length)];
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

    const randomDelay = 2000 + Math.floor(Math.random() * 2000);
    setTimeout(() => {
      if (state?.phase === "mafia-chat") {
        mafiaBotsTalk();
      }
    }, randomDelay);
  };

  // Действие мафии
  const mafiaAction = () => {
    setState(prev => {
      const livingMafia = prev.players.filter(p => p.isAlive && p.role === "mafia");

      if (livingMafia.length === 0) {
        return {
          ...prev,
          phase: "sheriff-turn",
          timer: 15,
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

      const targets = prev.players.filter(p => p.isAlive && p.role !== "mafia");

      if (targets.length === 0) {
        return {
          ...prev,
          phase: "sheriff-turn",
          timer: 15,
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

      let targetId = prev.selectedPlayer;

      if (!targetId || !targets.some(p => p.id === targetId)) {
        const sheriffSuspects = targets.filter(p =>
          prev.messages.some(m =>
            m.playerId === p.id &&
            (m.text.includes("подозрительно") ||
             m.text.includes("проверил") ||
             m.text.includes("думаю, что"))
          )
        );

        const messageCountByPlayer = new Map<number, number>();
        prev.messages.forEach(m => {
          if (!m.isSystem) {
            messageCountByPlayer.set(m.playerId, (messageCountByPlayer.get(m.playerId) || 0) + 1);
          }
        });

        const activeTargets = targets.filter(p => (messageCountByPlayer.get(p.id) || 0) > 2);

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

      return {
        ...prev,
        phase: "sheriff-turn",
        timer: 15,
        selectedPlayer: targetId,
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

    setTimeout(() => {
      sheriffAction();
    }, 1500);
  };

  // Действие шерифа
  const sheriffAction = () => {
    setState(prev => {
      const sheriff = prev.players.find(p => p.isAlive && p.role === "sheriff");

      if (!sheriff) {
        return {
          ...prev,
          phase: "results",
          timer: null
        };
      }

      if (sheriff.isBot) {
        const suspiciousPlayers = prev.players.filter(p =>
          p.isAlive &&
          p.id !== sheriff.id &&
          !prev.checkedPlayers[p.id] &&
          (prev.messages.filter(m => m.playerId === p.id).length < 2 ||
           prev.messages.some(m =>
             m.playerId === p.id &&
             (m.text.includes("Я не мафия") ||
              m.text.includes("Не я") ||
              m.text.includes("Точно не я"))
           ))
        );

        const uncheckedPlayers = prev.players.filter(p =>
          p.isAlive &&
          p.id !== sheriff.id &&
          !prev.checkedPlayers[p.id]
        );

        let target;
        if (suspiciousPlayers.length > 0) {
          target = suspiciousPlayers[Math.floor(Math.random() * suspiciousPlayers.length)];
        } else if (uncheckedPlayers.length > 0) {
          target = uncheckedPlayers[Math.floor(Math.random() * uncheckedPlayers.length)];
        } else {
          const targets = prev.players.filter(p => p.isAlive && p.id !== sheriff.id);
          if (targets.length > 0) {
            target = targets[Math.floor(Math.random() * targets.length)];
          }
        }

        if (target) {
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
        const target = prev.players.find(p => p.id === prev.selectedPlayer);

        if (target) {
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

      return {
        ...prev,
        phase: "results",
        timer: null
      };
    });

    setTimeout(() => {
      showResults();
    }, 1000);
  };

  // Показ результатов ночи
  const showResults = () => {
    setState(prev => {
      const realPlayer = prev.players.find(p => !p.isBot);
      if (realPlayer && !realPlayer.isAlive && !prev.testMode) {
        const winner = realPlayer.role === "mafia" ? "civilians" : "mafia";
        return {
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: prev.messages.length + 1,
              playerId: 0,
              text: `Игрок ${realPlayer.name} был исключен. Его роль: ${getRoleName(realPlayer.role)}.`,
              timestamp: Date.now(),
              isSystem: true
            },
            {
              id: prev.messages.length + 2,
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

      const targetId = prev.selectedPlayer;
      let killedPlayer = null;

      const newPlayers = [...prev.players];

      if (targetId) {
        const targetIndex = newPlayers.findIndex(p => p.id === targetId);
        if (targetIndex !== -1 && newPlayers[targetIndex].isAlive) {
          newPlayers[targetIndex] = {
            ...newPlayers[targetIndex],
            isAlive: false
          };
          killedPlayer = newPlayers[targetIndex];
        }
      }

      const sheriff = prev.players.find(p => p.role === "sheriff" && p.isAlive);

      const newMessages = [...prev.messages];

      newMessages.push({
        id: newMessages.length + 1,
        playerId: 0,
        text: "Наступило утро.",
        timestamp: Date.now(),
        isSystem: true
      });

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
        timer: 30,
        selectedPlayer: null
      };
    });

    setTimeout(() => {
      botsTalk();

      setTimeout(() => {
        if (state?.phase === "day") {
          setState(prev => ({
            ...prev,
            phase: "voting",
            timer: 10,
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

          setTimeout(() => {
            botsVote();
          }, 1500);
        }
      }, 20000);
    }, 1500);
  };

  // Боты общаются
  const botsTalk = (triggers: string[] = []) => {
    setState(prev => {
      if (!prev || !prev.players || prev.phase !== "day" || prev.winner) return prev;

      const livingBots = prev.players.filter(p => p.isBot && p.isAlive);
      if (livingBots.length === 0) return prev;

      let bot;
      if (triggers.length > 0) {
        const relevantBots = livingBots.filter(b => {
          if (triggers.includes("sheriff") && b.role === "sheriff") return true;
          if (triggers.includes("accusation") && b.role === "mafia") return true;
          if (triggers.includes("defense")) return true;
          return false;
        });
        bot = relevantBots.length > 0
          ? relevantBots[Math.floor(Math.random() * relevantBots.length)]
          : livingBots[Math.floor(Math.random() * livingBots.length)];
      } else {
        bot = livingBots[Math.floor(Math.random() * livingBots.length)];
      }

      const botPersonality = bot.id % 4;
      const messageType = triggers.includes("accusation")
        ? "accusation"
        : triggers.includes("defense")
        ? "defense"
        : triggers.includes("sheriff") && bot.role === "sheriff"
        ? "sheriff"
        : triggers.includes("strategy")
        ? "strategy"
        : "default";

      const text = getBotMessage(bot.role, botPersonality, messageType, prev);

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

    const randomDelay = 2000 + Math.floor(Math.random() * 3000);
    setTimeout(() => {
      if (state?.phase === "day" && !state?.winner) {
        botsTalk();
      }
    }, randomDelay);
  };

  // Получение сообщения бота
  const getBotMessage = (role: Role, personality: number, messageType: string, state: GameState): string => {
    const botPhrases: Record<string, Record<string, string[][]>> = {
      "mafia": {
        "default": [
          [
            "Я предлагаю убить самого активного игрока.",
            "Давайте устраним того, кто больше всех говорит.",
            "Нужно убрать того, кто может быть шерифом.",
            "Предлагаю убить того, кто слишком подозрителен.",
            "Нам нужно избавиться от самого опасного игрока."
          ],
          [
            "Я не мафия, я мирный житель!",
            "Почему вы меня обвиняете?",
            "Я могу доказать, что я мирный житель.",
            "Не обвиняйте меня, лучше посмотрите на других.",
            "Я понимаю вас, но вы ошибаетесь.",
            "Я клянусь, что я не мафия! Поверьте мне!"
          ],
          [
            "Давайте логически подумаем, кто мог бы быть мафия.",
            "Если проанализировать поведение всех, то подозрительны...",
            "Мне кажется, мы упускаем важные детали в обсуждении.",
            "Если рассуждать логически, то мафия должна вести себя определенным образом.",
            "Анализируя голосования предыдущих дней, можно сделать интересные выводы.",
            "Статистически, вероятность того, что мафия среди молчунов, довольно высока.",
            "Давайте построим модель поведения каждого и найдем несоответствия."
          ],
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
          [
            "Давайте не будем зацикливаться на оправданиях.",
            "Вместо оправданий, давайте обсудим стратегию.",
            "Я думаю, что нам стоит меньше оправдываться и больше действовать.",
            "Эти оправдания только на руку мафии.",
            "Может, поговорим о чем-то более конструктивном?",
            "Я предлагаю сменить тему и обсудить подозрительных игроков.",
            "Оправдания ничего не доказывают, нам нужны факты.",
            "Давайте перестанем ходить по кругу с этими оправданиями."
          ]
        ],
        "strategy": [
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
          [
            "Я так и знал! Я чувствовал, что он мафия!",
            "Боже мой, неужели мы нашли мафия?",
            "Я в шоке! Но это многое объясняет!",
            "Я всегда чувствовал, что с ним что-то не так!",
            "Как страшно осознавать, что мафия была рядом с нами!",
            "Я так волнуюсь! Неужели мы наконец-то нашли мафия?",
            "Я просто не могу поверить! Это он?",
            "Мое сердце подсказывало мне, что он не тот, за кого себя выдает!"
          ],
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
          [
            "Я так и знал! Я чувствовал, что он мафия!",
            "Боже мой, неужели мы нашли мафия?",
            "Я в шоке! Но это многое объясняет!",
            "Я всегда чувствовал, что с ним что-то не так!",
            "Как страшно осознавать, что мафия была рядом с нами!",
            "Я так волнуюсь! Неужели мы наконец-то нашли мафия?",
            "Я просто не могу поверить! Это он?",
            "Мое сердце подсказывало мне, что он не тот, за кого себя выдает!"
          ],
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

    const phrases = botPhrases[role]?.[messageType]?.[personality] || botPhrases[role]?.["default"]?.[personality];

    if (!phrases || phrases.length === 0) {
      return "Я думаю, нам нужно быть внимательнее.";
    }

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
