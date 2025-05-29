import React from "react";
import { Button, Input, Slider, Card } from "@heroui/react";
import { useGame } from "./game-context";
import { Icon } from "@iconify/react";

interface GameSetupProps {
  onGameStart: () => void;
}

export const GameSetup: React.FC<GameSetupProps> = ({ onGameStart }) => {
  const { initGame } = useGame();
  const [playerName, setPlayerName] = React.useState("");
  const [playerCount, setPlayerCount] = React.useState(7);
  const [isStarting, setIsStarting] = React.useState(false);
  const [testMode, setTestMode] = React.useState(false);
  
  const handleStartGame = () => {
    if (!testMode && !playerName.trim()) return;
    
    setIsStarting(true);
    
    // Инициализируем игру
    initGame(playerCount, testMode ? "Тестовый режим" : playerName, testMode);
    
    // Запускаем игру
    setTimeout(() => {
      onGameStart();
    }, 1000);
  };
  
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <Card className="w-full max-w-md p-6 space-y-6 bg-content1 border border-default-200">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold mb-2 text-danger-600">Игра "Мафия"</h2>
          <p className="text-default-500">Укажите ваше имя и количество игроков</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Ваше имя</label>
            <Input
              placeholder="Введите ваше имя"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              startContent={<Icon icon="lucide:user" className="text-default-400" />}
              isRequired={!testMode}
              isDisabled={testMode}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Количество игроков: {playerCount}</label>
            <Slider 
              size="sm"
              step={1} 
              minValue={4} 
              maxValue={10} 
              defaultValue={7}
              value={playerCount}
              onChange={(value) => setPlayerCount(value as number)}
              className="max-w-md"
            />
            <div className="flex justify-between text-xs text-default-400 mt-1">
              <span>4</span>
              <span>10</span>
            </div>
            <div className="text-xs text-default-500 mt-2">
              {playerCount === 10 ? "3 мафии" : `${Math.max(1, Math.floor(playerCount / 4))} мафии`}, 1 шериф, {playerCount - Math.max(1, Math.floor(playerCount / 4)) - 1} мирных жителей
            </div>
          </div>
          
          <div className="flex items-center gap-2 pt-2">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="testMode" 
                checked={testMode} 
                onChange={(e) => setTestMode(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <label htmlFor="testMode" className="text-sm font-medium">
                Тестовый режим (видны все роли)
              </label>
            </div>
          </div>
          
          <div className="pt-4">
            <Button 
              color="danger" 
              onPress={handleStartGame}
              isDisabled={(!playerName.trim() && !testMode) || isStarting}
              isLoading={isStarting}
              fullWidth
              className="bg-gradient-to-r from-danger-600 to-danger-500"
            >
              Начать игру
            </Button>
          </div>
          
          {/* Заглушки для будущего онлайн-режима - перенесены в главное меню */}
          <div className="pt-4 border-t border-default-200">
            <h3 className="text-sm font-medium mb-3 text-danger-600">Онлайн режим</h3>
            <div className="space-y-3">
              <Button 
                color="danger" 
                variant="flat" 
                size="sm" 
                className="w-full"
                isDisabled={true}
                startContent={<Icon icon="lucide:users" />}
              >
                Создать комнату
              </Button>
              <Button 
                color="danger" 
                variant="flat" 
                size="sm" 
                className="w-full"
                isDisabled={true}
                startContent={<Icon icon="lucide:log-in" />}
              >
                Присоединиться к игре
              </Button>
              <p className="text-xs text-default-400 text-center mt-2">
                Онлайн режим будет доступен в будущих обновлениях
              </p>
            </div>
          </div>
        </div>
      </Card>
      
      <div className="mt-8 max-w-md text-center">
        <h3 className="text-lg font-semibold mb-2 text-danger-500">Как играть</h3>
        <p className="text-default-600 mb-4">
          "Мафия" - это социально-психологическая ролевая игра с элементами детектива. 
          Вам будет случайно назначена роль: Мирный житель, Мафия или Шериф.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-content2 rounded-medium border border-default-200">
            <h4 className="font-medium text-danger-500">День (30 сек)</h4>
            <p className="text-sm">Обсуждение и голосование против подозреваемых</p>
          </div>
          <div className="p-3 bg-content2 rounded-medium border border-default-200">
            <h4 className="font-medium text-danger-500">Ночь (15 сек)</h4>
            <p className="text-sm">Мафия выбирает жертву, шериф проверяет игрока</p>
          </div>
          <div className="p-3 bg-content2 rounded-medium border border-default-200">
            <h4 className="font-medium text-danger-500">Цель</h4>
            <p className="text-sm">Мирные: найти мафию. Мафия: устранить мирных</p>
          </div>
        </div>
      </div>
    </div>
  );
};