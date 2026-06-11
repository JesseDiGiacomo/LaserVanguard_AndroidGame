/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar } from "@capacitor/status-bar";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { App as CapApp } from "@capacitor/app";
import { PermanentUpgrades, UpgradeId } from "./types";
import { MainMenu } from "./components/MainMenu";
import { UpgradeShop } from "./components/UpgradeShop";
import { GameBoard } from "./components/GameBoard";
import { ArcadeCRT } from "./components/ArcadeCRT";
import { SoundSynth } from "./lib/audio";
import { 
  ShieldAlert, 
  Trophy, 
  Coins, 
  Cpu,
  Home, 
  Sparkle
} from "lucide-react";

const DEFAULT_UPGRADES: PermanentUpgrades = {
  hullPlating: 0,
  laserEnergy: 0,
  thrusterCore: 0,
  shieldGenerator: 0,
  magneticHarvester: 0,
  scrapRefiner: 0,
};

export default function App() {
  const [screen, setScreen] = useState<"MENU" | "GAME" | "GAME_OVER" | "VICTORY">("MENU");
  const [upgrades, setUpgrades] = useState<PermanentUpgrades>(DEFAULT_UPGRADES);
  const [scrap, setScrap] = useState<number>(0);
  const [highestScore, setHighestScore] = useState<number>(0);
  
  // Attempt metrics
  const [currentRunScore, setCurrentRunScore] = useState<number>(0);
  const [currentRunScrapCollected, setCurrentRunScrapCollected] = useState<number>(0);
  
  // Interactive settings
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [crtEnabled, setCrtEnabled] = useState<boolean>(true);

  // Android Immersive Mode, Screen Lock & Hardware Back Button Support
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Lock to portrait orientation for retro-arcade optimal experience
    ScreenOrientation.lock({ orientation: "portrait" })
      .catch((err) => console.log("Orientation locking not supported on this platform:", err));

    // Hide status bar for immersive distraction-free fullscreen gaming
    StatusBar.hide()
      .catch((err) => console.log("StatusBar hiding not supported on this platform:", err));

    // Handle android hardware back button press events
    const backButtonListener = CapApp.addListener("backButton", () => {
      setScreen((prev) => {
        if (prev === "GAME") {
          // Exit flight session and return safely to hangar lobby
          return "MENU";
        } else if (prev === "GAME_OVER" || prev === "VICTORY" || (prev as string) === "SHOP") {
          return "MENU";
        } else {
          // If already on the MAIN lobby, minimize the application
          CapApp.minimizeApp();
          return prev;
        }
      });
    });

    return () => {
      backButtonListener.then((listener) => listener.remove());
    };
  }, []);

  // Live stats telemetry from GameBoard
  const [liveStats, setLiveStats] = useState({
    score: 0,
    scrapCollected: 0,
    stage: 1,
    progress: 0,
    hp: 100,
    maxHp: 100,
    shield: 50,
    maxShield: 50,
    threatIndex: 0.7,
    weaponLevel: 1,
    bossActive: false,
    bossHp: 0,
    bossMaxHp: 100,
    bossName: ""
  });

  // Optimized callback to update stats with shallow comparison to avoid unnecessary renders/loops
  const handleStatsUpdate = useCallback((stats: any) => {
    setLiveStats((prev) => {
      const hasChanged = 
        prev.score !== stats.score ||
        prev.scrapCollected !== stats.scrapCollected ||
        prev.stage !== stats.stage ||
        prev.progress !== stats.progress ||
        prev.hp !== stats.hp ||
        prev.maxHp !== stats.maxHp ||
        prev.shield !== stats.shield ||
        prev.maxShield !== stats.maxShield ||
        prev.threatIndex !== stats.threatIndex ||
        prev.weaponLevel !== stats.weaponLevel ||
        prev.bossActive !== stats.bossActive ||
        prev.bossHp !== stats.bossHp ||
        prev.bossMaxHp !== stats.bossMaxHp ||
        prev.bossName !== stats.bossName;
      
      return hasChanged ? stats : prev;
    });
  }, []);

  // 1. Initial State Loading from LocalStorage
  useEffect(() => {
    try {
      const savedUpgrades = localStorage.getItem("shmup_upgrade_system");
      if (savedUpgrades) setUpgrades(JSON.parse(savedUpgrades));

      const savedScrap = localStorage.getItem("shmup_scrap_val");
      if (savedScrap) setScrap(Number(savedScrap));

      const savedHighscore = localStorage.getItem("shmup_highscore_val");
      if (savedHighscore) setHighestScore(Number(savedHighscore));

      const savedMute = localStorage.getItem("shmup_muted_val");
      if (savedMute) setIsMuted(savedMute === "true");

      const savedCrt = localStorage.getItem("shmup_crt_val");
      if (savedCrt) setCrtEnabled(savedCrt === "true");
    } catch (e) {
      console.error("Falha ao recuperar dados do localStorage", e);
    }
  }, []);

  // 2. Navigation handlers and Audio state syncing
  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    localStorage.setItem("shmup_muted_val", String(nextMute));
  };

  const handleToggleCrt = () => {
    const nextCrt = !crtEnabled;
    setCrtEnabled(nextCrt);
    localStorage.setItem("shmup_crt_val", String(nextCrt));
  };

  // 3. Purchase upgrades mechanics
  const handlePurchaseUpgrade = (id: UpgradeId) => {
    const currentCost = getUpgradeCost(id, upgrades[id]);
    if (scrap >= currentCost && upgrades[id] < 5) {
      const updatedUpgrades = {
        ...upgrades,
        [id]: upgrades[id] + 1
      };
      const remainingScrap = scrap - currentCost;
      
      setUpgrades(updatedUpgrades);
      setScrap(remainingScrap);
      
      localStorage.setItem("shmup_upgrade_system", JSON.stringify(updatedUpgrades));
      localStorage.setItem("shmup_scrap_val", String(remainingScrap));
    }
  };

  // Helper calculating cost formula
  const getUpgradeCost = (id: UpgradeId, currentLevel: number): number => {
    if (currentLevel >= 5) return 0;
    const baseCosts: Record<UpgradeId, number> = {
      hullPlating: 150,
      laserEnergy: 200,
      thrusterCore: 250,
      shieldGenerator: 300,
      magneticHarvester: 100,
      scrapRefiner: 120
    };
    const costMultipliers: Record<UpgradeId, number> = {
      hullPlating: 1.6,
      laserEnergy: 1.7,
      thrusterCore: 1.8,
      shieldGenerator: 1.9,
      magneticHarvester: 1.5,
      scrapRefiner: 1.5
    };
    return Math.round(baseCosts[id] * Math.pow(costMultipliers[id], currentLevel));
  };

  // Re-adjust components / reset mechanics
  const handleResetUpgrades = () => {
    // Return spent scraps back to user so they don't lose value!
    let scrapRefund = 0;
    (Object.keys(upgrades) as UpgradeId[]).map(id => {
      const level = upgrades[id];
      for (let lvl = 0; lvl < level; lvl++) {
        scrapRefund += getUpgradeCost(id, lvl);
      }
    });

    const totalCalculatedScrap = scrap + scrapRefund;
    setUpgrades(DEFAULT_UPGRADES);
    setScrap(totalCalculatedScrap);

    localStorage.setItem("shmup_upgrade_system", JSON.stringify(DEFAULT_UPGRADES));
    localStorage.setItem("shmup_scrap_val", String(totalCalculatedScrap));
  };

  // 4. Ending campaign run calculations
  const handleGameEnd = (finalScore: number, finalScrapEarned: number, success: boolean) => {
    const stateVal = success ? "VICTORY" : "GAME_OVER";
    
    // Double collected scrap + score conversion bonus (5% of score) + victory/defeat bonus!
    const doubledEarned = finalScrapEarned * 2;
    const scoreBonus = Math.floor(finalScore * 0.05);
    const missionStatusBonus = success ? 1000 : 300;
    const totalRewardingScrap = doubledEarned + scoreBonus + missionStatusBonus;
    
    // Add scrap permanently
    const totalAccumulatedScrap = scrap + totalRewardingScrap;
    setScrap(totalAccumulatedScrap);
    localStorage.setItem("shmup_scrap_val", String(totalAccumulatedScrap));

    // Save highest scores
    if (finalScore > highestScore) {
      setHighestScore(finalScore);
      localStorage.setItem("shmup_highscore_val", String(finalScore));
    }

    setCurrentRunScore(finalScore);
    setCurrentRunScrapCollected(totalRewardingScrap);
    
    // De-activate boss overlay
    setLiveStats(prev => ({
      ...prev,
      bossActive: false
    }));

    setScreen(stateVal);
  };

  return (
    <div id="game-root" className="fixed inset-0 bg-black overflow-hidden font-mono text-zinc-300 select-none">
      <div id="active-bezel-screen-viewport" className="w-full h-full relative overflow-hidden bg-black flex flex-col">
        
        {/* Embedded Active BOSS HUD (Warning Banner) from Immersive UI */}
        {screen === "GAME" && liveStats.bossActive && (
          <div className="absolute top-12 left-0 right-0 px-6 z-20 animate-pulse">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-red-500 tracking-wider">⚠️ ALERTA CONTATO: COMANDANTE {liveStats.bossName || "IMPERIAL"} ⚠️</span>
              <span className="text-[10px] text-white">BLINDAGEM: {Math.round((liveStats.bossHp / liveStats.bossMaxHp) * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-red-950 border border-red-500/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-orange-400 transition-all duration-150"
                style={{ width: `${Math.round((liveStats.bossHp / liveStats.bossMaxHp) * 100)}%` }}
              ></div>
            </div>
          </div>
        )}

        <ArcadeCRT enabled={crtEnabled}>

          {/* Screen 1: Start Menu Hangar */}
          {screen === "MENU" && (
            <MainMenu
              upgrades={upgrades}
              scrap={scrap}
              highestScore={highestScore}
              onStartGame={() => {
                SoundSynth.playPowerUpSound();
                setLiveStats({
                  score: 0,
                  scrapCollected: 0,
                  stage: 1,
                  progress: 0,
                  hp: 100,
                  maxHp: 100,
                  shield: 50,
                  maxShield: 50,
                  threatIndex: 0.7,
                  weaponLevel: 1,
                  bossActive: false,
                  bossHp: 0,
                  bossMaxHp: 100,
                  bossName: ""
                });
                setScreen("GAME");
              }}
              onOpenShop={() => setScreen("SHOP" as any)}
              isMuted={isMuted}
              onToggleMute={handleToggleMute}
              crtEnabled={crtEnabled}
              onToggleCrt={handleToggleCrt}
            />
          )}

          {/* Screen 2: Upgrade shop hangar terminal */}
          {/* @ts-ignore */}
          {screen === "SHOP" && (
            <UpgradeShop
              upgrades={upgrades}
              scrap={scrap}
              onPurchaseUpgrade={handlePurchaseUpgrade}
              onResetUpgrades={handleResetUpgrades}
              onClose={() => setScreen("MENU")}
            />
          )}

          {/* Screen 3: Running Shmup Level Canvas */}
          {screen === "GAME" && (
            <GameBoard
              upgrades={upgrades}
              onGameEnd={handleGameEnd}
              isMuted={isMuted}
              crtEnabled={crtEnabled}
              onToggleCrt={handleToggleCrt}
              onStatsUpdate={handleStatsUpdate}
            />
          )}

          {/* Screen 4: Defeat - Ship exploded summary */}
          {screen === "GAME_OVER" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-8 py-6 bg-slate-950 font-sans text-center text-slate-100 z-30 select-none overflow-y-auto">
              <div className="p-3 rounded-full bg-red-950/40 border-2 border-red-500/30 text-red-500 mb-2 animate-bounce">
                <ShieldAlert className="w-10 h-10" />
              </div>

              <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-red-500 font-bold mb-1">
                Nave Destruída - Estrutura Aniquilada
              </span>
              <h1 className="text-2xl md:text-3xl font-black font-mono uppercase tracking-tighter text-slate-100 italic">
                Fim de Missão
              </h1>

              {/* Score block */}
              <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-3 my-4 font-mono text-center">
                <div className="grid grid-cols-2 gap-4 divide-x divide-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Pontuação</span>
                    <span className="text-xl font-bold text-yellow-400">{currentRunScore.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Sucata Coletada</span>
                    <span className="text-xl font-bold text-emerald-400 flex items-center justify-center gap-1">
                      <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
                      +{currentRunScrapCollected.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* High score beat call */}
                {currentRunScore >= highestScore && currentRunScore > 0 && (
                  <div className="mt-3 text-yellow-400 text-xs font-semibold uppercase tracking-widest border-t border-slate-800 pt-2 animate-pulse flex items-center justify-center gap-1.5">
                    <Trophy className="w-4 h-4" />
                    <span>Novo Recorde Estabelecido! 🏆</span>
                  </div>
                )}
              </div>

              {/* Action button triggers */}
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                  onClick={() => {
                    SoundSynth.resume();
                    SoundSynth.playPowerUpSound();
                    setScreen("GAME");
                  }}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold uppercase text-xs tracking-wider rounded-lg shadow-lg hover:shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  <span>Decolar Novamente</span>
                </button>

                <button
                  onClick={() => {
                    SoundSynth.playScrapCollectSound();
                    setScreen("SHOP" as any);
                  }}
                  className="w-full py-3 bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-slate-200 hover:text-white font-bold uppercase text-xs tracking-wider rounded-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <span>Ir Para Oficina (Upgrades)</span>
                  </span>
                </button>

                <button
                  onClick={() => {
                    SoundSynth.playScrapCollectSound();
                    setScreen("MENU");
                  }}
                  className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-500 hover:text-slate-300 font-semibold uppercase text-[10px] tracking-wider rounded-lg transition-all cursor-pointer"
                >
                  <span>Hangar Lobby Principal</span>
                </button>
              </div>
            </div>
          )}

          {/* Screen 5: Game Completion / Victory Fanfare */}
          {screen === "VICTORY" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-8 py-6 bg-gradient-to-b from-[#0a1f10] to-[#010905] font-sans text-center text-slate-100 z-30 select-none overflow-y-auto">
              <div className="p-3 rounded-full bg-emerald-950/50 border-2 border-[#22c55e] text-[#22c55e] mb-2 animate-[ping_2s_infinite]">
                <Trophy className="w-10 h-10" />
              </div>

              <span className="text-[10px] font-mono uppercase tracking-[0.5em] text-[#22c55e] font-black mb-1 animate-pulse">
                Universo Pacificado - Vitória Suprema
              </span>
              <h1 className="text-2xl md:text-3xl font-black font-mono uppercase tracking-tighter text-white italic">
                Campanha Concluída!
              </h1>

              <p className="text-[#a7f3d0] text-xs max-w-sm mt-1 line-clamp-3">
                Incrível! Você derrotou os Generais da Frota e libertou os quadrantes estelares da tirania mercenária. Seu nome ecoará para sempre como o maior piloto de Vanguarda!
              </p>

              {/* Score panel */}
              <div className="w-full max-w-sm bg-slate-900/80 border border-emerald-500/20 rounded-xl p-3 my-4 font-mono text-center">
                <div className="grid grid-cols-2 gap-4 divide-x divide-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Pontuação Registrada</span>
                    <span className="text-xl font-bold text-yellow-300 flex items-center justify-center gap-1">
                      <Sparkle className="w-4 h-4 text-yellow-400 animate-pulse" />
                      {currentRunScore.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Bônus de Sucata</span>
                    <span className="text-xl font-bold text-[#22c55e] flex items-center justify-center gap-1">
                      <Coins className="w-4 h-4 text-[#22c55e]" />
                      +{currentRunScrapCollected.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation actions */}
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                  onClick={() => {
                    SoundSynth.resume();
                    SoundSynth.playPowerUpSound();
                    setScreen("GAME");
                  }}
                  className="w-full py-3 bg-gradient-to-r from-[#22c55e] to-[#10b981] text-slate-950 font-extrabold uppercase text-xs tracking-wider rounded-lg shadow-lg shadow-emerald-500/20 hover:scale-102 transition-all cursor-pointer"
                >
                  <span>Jogar Nova Campanha</span>
                </button>

                <button
                  onClick={() => {
                    SoundSynth.playScrapCollectSound();
                    setScreen("SHOP" as any);
                  }}
                  className="w-full py-3 bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-slate-200 hover:text-white font-bold uppercase text-xs tracking-wider rounded-lg transition-all cursor-pointer"
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <span>Melhorar Nave (Oficina)</span>
                  </span>
                </button>

                <button
                  onClick={() => {
                    SoundSynth.playScrapCollectSound();
                    setScreen("MENU");
                  }}
                  className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-500 hover:text-slate-300 font-semibold uppercase text-[10px] tracking-wider rounded-lg transition-all cursor-pointer"
                >
                  <span className="flex items-center justify-center gap-1">
                    <Home className="w-3.5 h-3.5" />
                    <span>Voltar ao Hangar</span>
                  </span>
                </button>
              </div>
            </div>
          )}

        </ArcadeCRT>
      </div>

      <style>{`
        @keyframes flicker {
          0% { opacity: 0.99; }
          50% { opacity: 0.92; }
          100% { opacity: 0.99; }
        }
      `}</style>
    </div>
  );
}
