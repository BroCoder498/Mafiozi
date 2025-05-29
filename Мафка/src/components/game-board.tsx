import React from "react";
import { 
  Button, 
  Card, 
  Avatar, 
  Badge, 
  Input, 
  Divider,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Spinner
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useGame, GamePhase } from "./game-context";

export const GameBoard: React.FC = () => {
  const { state, selectPlayer, sendMessage, vote, nextPhase } = useGame();
  const [message, setMessage] = React.useState("");
  const [mafiaMessage, setMafiaMessage] = React.useState("");
  const chatRef = React.useRef<HTMLDivElement>(null);
  const mafiaChatRef = React.useRef<HTMLDivElement>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  
  // Прокрутка чата вниз при новых сообщениях
  React.useEffect(() => {
    if (chatRef.current && state?.messages) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [state?.messages]);
  
  // Прокрутка чата мафии вниз при новых сообщениях
  React.useEffect(() => {
    if (mafiaChatRef.current && state?.mafiaMessages) {
      mafiaChatRef.current.scrollTop = mafiaChatRef.current.scrollHeight;
    }
  }, [state?.mafiaMessages]);
  
  // Проверка, что state существует перед рендерингом
  if (!state || !state.messages || !state.players) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" color="danger" />
      </div>
    );
  }
  
  // Получение информации о текущей фазе
  const getPhaseInfo = (): { title: string; description: string } => {
    switch (state.phase) {
      case "day":
        return {
          title: `День ${state.day}`,
          description: state.timer !== null ? `Обсудите, кто может быть мафией. Осталось: ${state.timer} сек.` : "Обсудите, кто может быть мафией."
        };
      case "voting":
        return {
          title: "Голосование",
          description: state.timer !== null ? `Выберите, кого вы считаете мафией. Осталось: ${state.timer} сек.` : "Выберите, кого вы считаете мафией."
        };
      case "last-word":
        return {
          title: "Последнее слово",
          description: state.timer !== null 
            ? `${state.eliminatedPlayer?.name} может сказать последнее слово. Осталось: ${state.timer} сек.` 
            : `${state.eliminatedPlayer?.name} может сказать последнее слово.`
        };
      case "night":
        return {
          title: "Ночь",
          description: "Город засыпает..."
        };
      case "mafia-chat":
        return {
          title: "Чат мафии",
          description: state.timer !== null ? `Мафия обсуждает, кого убить. Осталось: ${state.timer} сек.` : "Мафия обсуждает, кого убить."
        };
      case "mafia-turn":
        return {
          title: "Ход мафии",
          description: state.timer !== null ? `Мафия выбирает жертву. Осталось: ${state.timer} сек.` : "Мафия выбирает жертву."
        };
      case "sheriff-turn":
        return {
          title: "Ход шерифа",
          description: state.timer !== null ? `Шериф проверяет одного игрока. Осталось: ${state.timer} сек.` : "Шериф проверяет одного игрока."
        };
      case "results":
        return {
          title: "Результаты ночи",
          description: "Узнайте, что произошло ночью."
        };
      case "game-over":
        return {
          title: "Игра окончена",
          description: state.winner === "mafia" 
            ? "Мафия победила!" 
            : "Мирные жители победили!"
        };
      default:
        return {
          title: "Мафия",
          description: "Социально-психологическая ролевая игра"
        };
    }
  };
  
  // Получение информации о роли игрока
  const getPlayerRole = () => {
    const player = state.players.find(p => !p.isBot);
    if (!player) return null;
    
    return {
      role: player.role,
      name: getRoleName(player.role),
      description: getRoleDescription(player.role),
      icon: getRoleIcon(player.role)
    };
  };
  
  // Получение названия роли
  const getRoleName = (role: string): string => {
    switch (role) {
      case "civilian": return "Мирный житель";
      case "mafia": return "Мафия";
      case "sheriff": return "Шериф";
      default: return "Неизвестно";
    }
  };
  
  // Получение описания роли
  const getRoleDescription = (role: string): string => {
    switch (role) {
      case "civilian": 
        return "Ваша задача - вычислить и устранить мафию путем голосования.";
      case "mafia": 
        return "Ваша задача - устранить всех мирных жителей, оставаясь незамеченным.";
      case "sheriff": 
        return "Каждую ночь вы можете проверить одного игрока и узнать его роль.";
      default: 
        return "";
    }
  };
  
  // Получение иконки роли
  const getRoleIcon = (role: string): string => {
    switch (role) {
      case "civilian": return "lucide:users";
      case "mafia": return "lucide:skull";
      case "sheriff": return "lucide:shield";
      default: return "lucide:help-circle";
    }
  };
  
  // Получение цвета роли
  const getRoleColor = (role: string): string => {
    switch (role) {
      case "civilian": return "primary";
      case "mafia": return "danger";
      case "sheriff": return "warning";
      default: return "default";
    }
  };
  
  // Обработка отправки сообщения
  const handleSendMessage = (isMafiaChat: boolean = false) => {
    if (isMafiaChat) {
      if (!mafiaMessage.trim()) return;
      sendMessage(mafiaMessage, true);
      setMafiaMessage("");
    } else {
      if (!message.trim()) return;
      sendMessage(message);
      setMessage("");
    }
  };
  
  // Обработка нажатия Enter
  const handleKeyPress = (e: React.KeyboardEvent, isMafiaChat: boolean = false) => {
    if (e.key === "Enter") {
      handleSendMessage(isMafiaChat);
    }
  };
  
  // Получение информации о фазе
  const phaseInfo = getPhaseInfo();
  
  // Получение информации о роли игрока
  const playerRole = getPlayerRole();
  
  // Проверка, может ли игрок голосовать
  const canVote = state.phase === "voting" && state.players.find(p => !p.isBot)?.isAlive;
  
  // Проверка, может ли игрок голосовать как мафия
  const canMafiaVote = state.phase === "mafia-turn" && 
                      state.players.find(p => !p.isBot)?.role === "mafia" && 
                      state.players.find(p => !p.isBot)?.isAlive;
  
  // Проверка, может ли игрок проверять (если он шериф)
  const canCheck = state.phase === "sheriff-turn" && 
                  state.players.find(p => !p.isBot)?.role === "sheriff" && 
                  state.players.find(p => !p.isBot)?.isAlive;
  
  // Проверка, может ли игрок отправлять сообщения
  const canChat = state.phase === "day" && state.players.find(p => !p.isBot)?.isAlive;
  
  // Проверка, может ли игрок отправлять сообщения в чат мафии
  const canMafiaChat = state.phase === "mafia-chat" && 
                      state.players.find(p => !p.isBot)?.role === "mafia" && 
                      state.players.find(p => !p.isBot)?.isAlive;
  
  // Проверка, может ли игрок сказать последнее слово
  const canLastWord = state.phase === "last-word" && 
                     state.eliminatedPlayer && 
                     !state.eliminatedPlayer.isBot;
  
  // Получение ID игрока
  const playerId = state.players.find(p => !p.isBot)?.id;
  
  // Получение проголосовавших игроков
  const votedPlayers = Object.keys(state.votes).map(Number);
  
  // Получение проголосовавших игроков-мафии
  const mafiaVotedPlayers = Object.keys(state.mafiaVotes).map(Number);
  
  // Получение игрока, за которого проголосовал текущий игрок
  const votedFor = playerId ? state.votes[playerId] : null;
  
  // Получение игрока, за которого проголосовал текущий игрок-мафия
  const mafiaVotedFor = playerId ? state.mafiaVotes[playerId] : null;
  
  // Функция для получения класса роли для тестового режима
  const getRoleClass = (role: string): string => {
    switch (role) {
      case "civilian": return "bg-primary-100 text-primary-600";
      case "mafia": return "bg-danger-100 text-danger-600";
      case "sheriff": return "bg-warning-100 text-warning-600";
      default: return "bg-default-100 text-default-600";
    }
  };
  
  // Проверка, является ли игрок мафией
  const isMafia = playerRole?.role === "mafia";
  
  // Проверка, является ли текущая фаза связанной с мафией
  const isMafiaPhase = state.phase === "mafia-chat" || state.phase === "mafia-turn";
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Левая колонка - информация об игре */}
      <div className="md:col-span-1 space-y-4">
        {/* Информация о фазе */}
        <Card className="p-4 border border-default-200 bg-content1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-danger-600">{phaseInfo.title}</h3>
            <Badge 
              color={state.phase === "game-over" 
                ? (state.winner === "mafia" ? "danger" : "success") 
                : "primary"
              }
            >
              {state.phase === "game-over" 
                ? (state.winner === "mafia" ? "Победа мафии" : "Победа мирных") 
                : "В процессе"
              }
            </Badge>
          </div>
          <p className="text-default-600">{phaseInfo.description}</p>
          
          {/* Индикатор таймера */}
          {state.timer !== null && (
            <div className="mt-3">
              <div className="w-full bg-default-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    state.timer < 5 ? "bg-danger" : "bg-danger-500"
                  }`}
                  style={{ 
                    width: `${state.phase === "day" 
                      ? (state.timer / 30) * 100 
                      : state.phase === "voting" 
                        ? (state.timer / 10) * 100 
                        : state.phase === "last-word"
                          ? (state.timer / 15) * 100
                          : state.phase === "mafia-chat"
                            ? (state.timer / 20) * 100
                            : (state.timer / 15) * 100
                    }%` 
                  }}
                ></div>
              </div>
            </div>
          )}
          
          {/* Кнопка действия в зависимости от фазы */}
          {state.phase === "day" && (
            <Button 
              color="danger" 
              variant="flat" 
              size="sm" 
              className="mt-3"
              onPress={nextPhase}
              isDisabled={!state.players.find(p => !p.isBot)?.isAlive}
            >
              Перейти к голосованию
            </Button>
          )}
          
          {state.phase === "last-word" && (
            <Button 
              color="danger" 
              variant="flat" 
              size="sm" 
              className="mt-3"
              onPress={nextPhase}
            >
              Перейти к ночи
            </Button>
          )}
          
          {state.phase === "mafia-chat" && isMafia && (
            <Button 
              color="danger" 
              variant="flat" 
              size="sm" 
              className="mt-3"
              onPress={nextPhase}
            >
              Перейти к голосованию
            </Button>
          )}
          
          {state.phase === "sheriff-turn" && canCheck && (
            <div className="mt-3">
              {state.selectedPlayer ? (
                <Button 
                  color="danger" 
                  variant="flat" 
                  size="sm"
                  onPress={nextPhase}
                >
                  Проверить игрока
                </Button>
              ) : (
                <p className="text-sm text-warning-500">Выберите игрока для проверки</p>
              )}
            </div>
          )}
          
          {state.phase === "game-over" && (
            <Button 
              color="danger" 
              variant="flat" 
              size="sm" 
              className="mt-3"
              onPress={() => window.location.reload()}
            >
              Начать новую игру
            </Button>
          )}
        </Card>
        
        {/* Статистика игры - показываем только в тестовом режиме */}
        {state.testMode && (
          <Card className="p-4 border border-default-200 bg-content1">
            <h3 className="font-semibold mb-3 text-danger-600">Статистика игры</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>День:</span>
                <span className="font-medium">{state.day}</span>
              </div>
              <div className="flex justify-between">
                <span>Живых игроков:</span>
                <span className="font-medium">{state.players.filter(p => p.isAlive).length}</span>
              </div>
              <div className="flex justify-between">
                <span>Мафии осталось:</span>
                <span className="font-medium">
                  {state.phase === "game-over" || playerRole?.role === "mafia" || state.testMode
                    ? state.players.filter(p => p.isAlive && p.role === "mafia").length
                    : "?"
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span>Мирных осталось:</span>
                <span className="font-medium">
                  {state.phase === "game-over" || playerRole?.role === "mafia" || state.testMode
                    ? state.players.filter(p => p.isAlive && p.role !== "mafia").length
                    : state.players.filter(p => p.isAlive).length - 
                      (playerRole?.role === "mafia" ? 0 : "?")
                  }
                </span>
              </div>
            </div>
          </Card>
        )}
        
        {/* Информация о роли игрока */}
        {playerRole && (
          <Card className="p-4 border border-default-200 bg-content1">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-full bg-${getRoleColor(playerRole.role)}-100`}>
                <Icon 
                  icon={playerRole.icon} 
                  className={`text-${getRoleColor(playerRole.role)}-500 h-5 w-5`} 
                />
              </div>
              <div>
                <h3 className="font-semibold text-danger-600">Ваша роль</h3>
                <p className={`text-${getRoleColor(playerRole.role)}-500 font-medium`}>
                  {playerRole.name}
                </p>
              </div>
            </div>
            <p className="text-sm text-default-600">{playerRole.description}</p>
            
            <Button 
              size="sm" 
              variant="light" 
              className="mt-3 text-danger-500"
              onPress={onOpen}
              startContent={<Icon icon="lucide:info" />}
            >
              Подробнее о ролях
            </Button>
          </Card>
        )}
        
        {/* Информация о проверенных игроках (для шерифа) */}
        {(playerRole?.role === "sheriff" || state.testMode) && Object.keys(state.checkedPlayers).length > 0 && (
          <Card className="p-4 border border-default-200 bg-content1">
            <h3 className="font-semibold mb-3 text-danger-600">Результаты проверок</h3>
            <div className="space-y-2">
              {Object.entries(state.checkedPlayers).map(([id, role]) => {
                const player = state.players.find(p => p.id === parseInt(id));
                if (!player) return null;
                
                return (
                  <div key={id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar src={player.avatar} size="sm" />
                      <span>{player.name}</span>
                    </div>
                    <Badge color={role === "mafia" ? "danger" : "success"}>
                      {role === "mafia" ? "Мафия" : "Не мафия"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
      
      {/* Центральная колонка - чат */}
      <div className="md:col-span-1">
        {isMafiaPhase && isMafia ? (
          // Чат мафии
          <Card className="h-[600px] flex flex-col border border-default-200 bg-black">
            <div className="p-3 border-b border-danger-800">
              <h3 className="font-semibold text-danger">Чат мафии</h3>
            </div>
            
            <div className="flex-grow overflow-y-auto p-3 bg-black" ref={mafiaChatRef}>
              <div className="space-y-3">
                {state.mafiaMessages.map((msg) => {
                  const sender = msg.isSystem 
                    ? { name: "Система", avatar: "" } 
                    : state.players.find(p => p.id === msg.playerId);
                  
                  if (!sender) return null;
                  
                  return (
                    <div key={msg.id} className={`flex ${msg.isSystem ? "justify-center" : "gap-2"}`}>
                      {msg.isSystem ? (
                        <div className="bg-danger-900 rounded-lg py-1 px-3 max-w-[90%] border border-danger-800">
                          <p className="text-sm text-danger-200">{msg.text}</p>
                        </div>
                      ) : (
                        <>
                          <Avatar src={sender.avatar} size="sm" />
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-sm text-danger-300">{sender.name}</span>
                              <span className="text-xs text-danger-500">
                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                            <p className="text-sm text-danger-200">{msg.text}</p>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-3 border-t border-danger-800">
              <div className="flex gap-2">
                <Input
                  placeholder={canMafiaChat ? "Обсудите, кого убить..." : "Чат недоступен"}
                  value={mafiaMessage}
                  onChange={(e) => setMafiaMessage(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, true)}
                  isDisabled={!canMafiaChat}
                  className="bg-black text-danger-200 border-danger-800"
                />
                <Button
                  isIconOnly
                  color="danger"
                  onPress={() => handleSendMessage(true)}
                  isDisabled={!canMafiaChat || !mafiaMessage.trim()}
                >
                  <Icon icon="lucide:send" />
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          // Обычный чат
          <Card className="h-[600px] flex flex-col border border-default-200 bg-content1">
            <div className="p-3 border-b border-default-200">
              <h3 className="font-semibold text-danger-600">Чат города</h3>
            </div>
            
            <div className="flex-grow overflow-y-auto p-3" ref={chatRef}>
              <div className="space-y-3">
                {state.messages.map((msg) => {
                  const sender = msg.isSystem 
                    ? { name: "Система", avatar: "" } 
                    : state.players.find(p => p.id === msg.playerId);
                  
                  if (!sender) return null;
                  
                  return (
                    <div key={msg.id} className={`flex ${msg.isSystem ? "justify-center" : "gap-2"}`}>
                      {msg.isSystem ? (
                        <div className="bg-content2 rounded-lg py-1 px-3 max-w-[90%] border border-default-200">
                          <p className="text-sm text-default-600">{msg.text}</p>
                        </div>
                      ) : (
                        <>
                          <Avatar src={sender.avatar} size="sm" />
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-sm">{sender.name}</span>
                              <span className="text-xs text-default-400">
                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                            <p className="text-sm">{msg.text}</p>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-3 border-t border-default-200">
              <div className="flex gap-2">
                <Input
                  placeholder={
                    canChat 
                      ? "Введите сообщение..." 
                      : canLastWord 
                        ? "Скажите ваше последнее слово..." 
                        : "Чат недоступен"
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  isDisabled={!canChat && !canLastWord}
                />
                <Button
                  isIconOnly
                  color="danger"
                  onPress={() => handleSendMessage()}
                  isDisabled={(!canChat && !canLastWord) || !message.trim()}
                >
                  <Icon icon="lucide:send" />
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
      
      {/* Правая колонка - игроки */}
      <div className="md:col-span-1">
        <Card className="p-4 border border-default-200 bg-content1">
          <h3 className="font-semibold mb-3 text-danger-600">Игроки</h3>
          <div className="space-y-3">
            {state.players.map((player) => {
              const isCurrentPlayer = !player.isBot;
              const isAlive = player.isAlive;
              const hasVoted = votedPlayers.includes(player.id);
              const hasMafiaVoted = mafiaVotedPlayers.includes(player.id);
              const isSelected = state.selectedPlayer === player.id;
              const isEliminatedPlayer = state.eliminatedPlayer?.id === player.id;
              
              return (
                <div 
                  key={player.id} 
                  className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                    isSelected ? "bg-danger-100" : isEliminatedPlayer ? "bg-warning-100" : "hover:bg-content2"
                  } ${!isAlive ? "opacity-60" : ""} border border-default-100`}
                >
                  <div className="flex items-center gap-3">
                    {player.avatar ? (
                      <Avatar 
                        src={player.avatar} 
                        className={!isAlive ? "grayscale" : ""}
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-default-200 ${!isAlive ? "grayscale" : ""}`}>
                        <Icon icon="lucide:user" className="text-default-500" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{player.name}</span>
                        {isCurrentPlayer && (
                          <Badge color="danger" size="sm">Вы</Badge>
                        )}
                        {/* Показываем роль в тестовом режиме */}
                        {state.testMode && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleClass(player.role)}`}>
                            {getRoleName(player.role)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-default-400">
                        {!isAlive && <span className="text-danger">Мёртв</span>}
                        {hasVoted && state.phase === "voting" && (
                          <span>Проголосовал</span>
                        )}
                        {hasMafiaVoted && state.phase === "mafia-turn" && isMafia && (
                          <span>Проголосовал</span>
                        )}
                        {isEliminatedPlayer && (
                          <span className="text-warning-500">Последнее слово</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    {/* Кнопки действий в зависимости от фазы */}
                    {canVote && isAlive && player.id !== playerId && (
                      <Tooltip content="Голосовать против">
                        <Button
                          isIconOnly
                          size="sm"
                          color={votedFor === player.id ? "danger" : "default"}
                          variant={votedFor === player.id ? "solid" : "light"}
                          onPress={() => vote(player.id)}
                        >
                          <Icon icon="lucide:thumbs-down" />
                        </Button>
                      </Tooltip>
                    )}
                    
                    {canMafiaVote && isAlive && player.role !== "mafia" && (
                      <Tooltip content="Выбрать жертву">
                        <Button
                          isIconOnly
                          size="sm"
                          color={mafiaVotedFor === player.id ? "danger" : "default"}
                          variant={mafiaVotedFor === player.id ? "solid" : "light"}
                          onPress={() => vote(player.id, true)}
                        >
                          <Icon icon="lucide:target" />
                        </Button>
                      </Tooltip>
                    )}
                    
                    {canCheck && isAlive && player.id !== playerId && (
                      <Tooltip content="Проверить роль">
                        <Button
                          isIconOnly
                          size="sm"
                          color={isSelected ? "danger" : "default"}
                          variant={isSelected ? "solid" : "light"}
                          onPress={() => selectPlayer(player.id)}
                        >
                          <Icon icon="lucide:search" />
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      
      {/* Модальное окно с информацией о ролях */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="text-danger-600">Роли в игре</ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-primary-100">
                      <Icon icon="lucide:users" className="text-primary-500 h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-primary-500">Мирный житель</h4>
                      <p className="text-sm text-default-600">
                        Обычный житель города. Днём участвует в обсуждении и голосовании.
                        Цель - вычислить и устранить всех членов мафии.
                      </p>
                    </div>
                  </div>
                  
                  <Divider />
                  
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-danger-100">
                      <Icon icon="lucide:skull" className="text-danger-500 h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-danger-500">Мафия</h4>
                      <p className="text-sm text-default-600">
                        Член преступной группировки. Знает других членов мафии.
                        Каждую ночь мафия выбирает одну жертву. Цель - устранить всех мирных жителей.
                      </p>
                    </div>
                  </div>
                  
                  <Divider />
                  
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-warning-100">
                      <Icon icon="lucide:shield" className="text-warning-500 h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-warning-500">Шериф</h4>
                      <p className="text-sm text-default-600">
                        Представитель закона. Каждую ночь может проверить одного игрока и узнать его роль.
                        Цель - помочь мирным жителям вычислить мафию.
                      </p>
                    </div>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" onPress={onClose}>
                  Понятно
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};