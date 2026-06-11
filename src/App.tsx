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
  RotateCcw, 
  Cpu, 
  Home, 
  Sparkle,
  Tv,
  Volume2,
  VolumeX,
  Zap,
  Shield
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
        prev.threatIndex !== stats.脅威_not_translated_but_threatIndex || // Wait, let's keep exact keys
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
    let ultimateHighScore = highestScore;
    if (finalScore > highestScore) {
      ultimateHighScore = finalScore;
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

  // Pre-calculate side telemetry details
  const totalLevels = (upgrades.hullPlating || 0) + 
                      (upgrades.laserEnergy || 0) + 
                      (upgrades.thrusterCore || 0) + 
                      (upgrades.shieldGenerator || 0) + 
                      (upgrades.magneticHarvester || 0) + 
                      (upgrades.scrapRefiner || 0);
  const hangarLevel = Math.floor(totalLevels / 3) + 1;
  const hangarPercent = Math.min(100, Math.round(((totalLevels % 3) / 3) * 100));

  const formatMK = (lvl: number) => {
    if (lvl <= 0) return "LOCKED";
    const roman = ["I", "II", "III", "IV", "V"];
    return `MK ${roman[lvl - 1]}`;
  };

  const currentThreat = screen === "GAME" ? liveStats.threatIndex : (highestScore > 10000 ? 2.5 : highestScore > 3000 ? 1.7 : 1.0);
  const barProgress = Math.min(5, Math.ceil(currentThreat * 1.6));

  const getDiffLabel = (threat: number) => {
    if (threat >= 2.4) return "Grau: VANGUARD";
    if (threat >= 1.8) return "Grau: ELITE";
    if (threat >= 1.3) return "Grau: COMBATENTE";
    return "Grau: PADRÃO";
  };

  const activeScore = screen === "GAME" ? liveStats.score : currentRunScore > 0 ? currentRunScore : highestScore;

  return (
    <div id="retro-gamepad-bezel-layout" className="w-full h-screen bg-[#050505] flex items-center justify-center p-0 md:p-4 overflow-hidden relative font-mono text-zinc-300 select-none">
      
      {/* CRT Scanline Overlay applied globally */}
      <div 
        className="absolute inset-0 pointer-events-none z-50 opacity-[0.03]" 
        style={{
          background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))",
          backgroundSize: "100% 4px, 3px 100%"
        }}
      />

      {/* Main Bezel Cockpit Container */}
      <div className="w-full max-w-[1120px] h-full max-h-[860px] bg-[#050505] flex overflow-hidden text-zinc-300 border border-zinc-900 rounded-2xl relative shadow-2xl z-10">
        
        {/* Left Sidebar: Hangar, Permanent Upgrades & Meta Progress */}
        <aside className="hidden md:flex w-64 border-r border-zinc-800 bg-zinc-950 p-6 flex-col gap-6 shrink-0 z-25 text-left">
          <div className="space-y-1.5">
            <h2 className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Hangar Nível 0{hangarLevel}</h2>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${hangarPercent}%` }}></div>
            </div>
          </div>

          <section className="flex-1 flex flex-col gap-4">
            <div className="p-3 bg-zinc-900/40 border border-zinc-800/80 rounded-lg">
              <p className="text-[10px] text-cyan-400 mb-2.5 uppercase font-semibold tracking-wider">Aeronáutica</p>
              <div className="space-y-3 font-mono">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Placas de Casco</span>
                  <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-white italic font-bold">
                    {formatMK(upgrades.hullPlating)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Canhão Fóton</span>
                  <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-white italic font-bold">
                    {formatMK(upgrades.laserEnergy)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Escudo Plasma</span>
                  <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-white italic font-bold">
                    {formatMK(upgrades.shieldGenerator)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Força Núcleo</span>
                  <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-white italic font-bold">
                    {formatMK(upgrades.thrusterCore)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-zinc-900/40 border border-zinc-800/80 rounded-lg">
              <p className="text-[10px] text-pink-500 mb-2 uppercase font-semibold tracking-wider">Fator de Ameaça</p>
              <div className="flex items-end gap-1.5 h-8">
                {[1, 2, 3, 4, 5].map((idx) => {
                  const isActive = idx <= barProgress;
                  return (
                    <div 
                      key={idx} 
                      className={`w-2.5 rounded-t-sm transition-all duration-300 ${
                        isActive ? "bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]" : "bg-zinc-800"
                      }`}
                      style={{ height: `${idx * 20}%` }}
                    />
                  );
                })}
              </div>
              <p className="text-[10px] mt-2 opacity-60 italic uppercase font-semibold tracking-wider">
                {getDiffLabel(currentThreat)}
              </p>
            </div>
          </section>

          <div className="mt-auto pt-4 border-t border-zinc-900">
            <div className="text-2xl font-bold text-white mb-0.5">
              <span className="text-emerald-500 text-lg mr-1">$</span>
              {scrap.toLocaleString()}
            </div>
            <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Sucata em Cofre</p>
          </div>
        </aside>

        {/* Central screen workspace: simulated vertical aspect main portal */}
        <main className="flex-1 bg-black relative flex justify-center shadow-[inset_0_0_100px_rgba(0,0,0,1)] font-mono">
          {/* Simulated Starfield background inside monitor bezel */}
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "140px 140px" }} />

          {/* Core Vertical Playbox Bezel */}
          <div className="w-full max-w-[500px] h-full border-x border-zinc-800 relative bg-gradient-to-b from-[#0a0a1a] to-black flex flex-col justify-between overflow-hidden shadow-inner">
            
            {/* Embedded Active BOSS HUD (Warning Banner) from Immersive UI */}
            {screen === "GAME" && liveStats.bossActive && (
              <div className="absolute top-12 left-0 right-0 px-6 z-20 animate-pulse">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-red-500 tracking-wider">⚠️ ALERTA CONTATO: COMANDANTE {liveStats.bossName || "IMPERIAL"} ⚠️</span>
                  <span className="text-[10px] text-white">BLINDAGEM: {Math.round((liveStats.bossHp / liveStats.bossMaxHp) * 100)}%</span>
                </div>
                <div className="h-2 w-full bg-red-950 border border-red-500/30 rounded-full overflow-hidden shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                  <div 
                    className="h-full bg-gradient-to-r from-red-600 to-orange-400 transition-all duration-150" 
                    style={{ width: `${Math.round((liveStats.bossHp / liveStats.bossMaxHp) * 100)}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Dynamic visual screen layer overlay */}
            <div id="active-bezel-screen-viewport" className="w-full flex-grow relative overflow-hidden bg-black flex flex-col">
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
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-950 font-sans text-center text-slate-100 z-30 select-none overflow-y-auto">
                    <div className="p-4 rounded-full bg-red-950/40 border-2 border-red-500/30 text-red-500 mb-4 animate-bounce">
                      <ShieldAlert className="w-12 h-12" />
                    </div>

                    <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-red-500 font-bold mb-1">
                      Nave Destruída - Estrutura Aniquilada
                    </span>
                    <h1 className="text-3xl md:text-4xl font-black font-mono uppercase tracking-tighter text-slate-100 italic">
                      Fim de Missão
                    </h1>

                    {/* Score block */}
                    <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-4 my-6 font-mono text-center">
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
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#0a1f10] to-[#010905] font-sans text-center text-slate-100 z-30 select-none overflow-y-auto">
                    <div className="p-4 rounded-full bg-emerald-950/50 border-2 border-[#22c55e] text-[#22c55e] mb-4 animate-[ping_2s_infinite]">
                      <Trophy className="w-12 h-12" />
                    </div>

                    <span className="text-[10px] font-mono uppercase tracking-[0.5em] text-[#22c55e] font-black mb-1 animate-pulse">
                      Universo Pacificado - Vitória Suprema
                    </span>
                    <h1 className="text-3xl md:text-4xl font-black font-mono uppercase tracking-tighter text-white italic">
                      Campanha Concluída!
                    </h1>

                    <p className="text-[#a7f3d0] text-xs max-w-sm mt-2 line-clamp-3">
                      Incrível! Você derrotou os Generais da Frota e libertou os quadrantes estelares da tirania mercenária. Seu nome ecoará para sempre como o maior piloto de Vanguarda!
                    </p>

                    {/* Score panel */}
                    <div className="w-full max-w-sm bg-slate-900/80 border border-emerald-500/20 rounded-xl p-4 my-6 font-mono text-center">
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

          </div>
        </main>

        {/* Right Sidebar: Ship Equipment, Loadout & Ticking Run Telemetry */}
        <aside className="hidden md:flex w-64 border-l border-zinc-800 bg-zinc-950 p-6 flex-col gap-8 shrink-0 z-25 text-left">
          <section>
            <h3 className="text-[10px] text-zinc-500 uppercase tracking-widest mb-4 font-bold">Equipamentos</h3>
            <div className="space-y-4 font-mono">
              <div className="p-3 bg-cyan-950/20 border-l-2 border-cyan-500 rounded-r">
                <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Canhão Radial</p>
                <p className="text-xs text-white font-bold italic">
                  {upgrades.laserEnergy === 0 ? "Fóton Standard" : upgrades.laserEnergy <= 2 ? "Multi Plasma MK I" : upgrades.laserEnergy <= 4 ? "Canhão Ionizado" : "Singularidade Alfa"}
                </p>
                <p className="text-[8px] text-zinc-500 mt-1 uppercase tracking-widest">Nível 0{upgrades.laserEnergy} / Auto-Disparo</p>
              </div>

              <div className="p-3 bg-zinc-900/60 border-l-2 border-zinc-700 rounded-r opacity-90">
                <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Unidade Vetorial</p>
                <p className="text-xs text-zinc-300 italic">{upgrades.thrusterCore === 0 ? "Impulsores Iniciais" : `Propulsor de Vácuo x${upgrades.thrusterCore}`}</p>
                <p className="text-[8px] text-zinc-500 mt-1 uppercase tracking-widest">Aceleração: +{upgrades.thrusterCore * 15}%</p>
              </div>

              <div className="p-3 bg-purple-950/20 border-l-2 border-purple-500 rounded-r">
                <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Campo Defletor</p>
                <p className="text-xs text-white font-bold italic">
                  {upgrades.shieldGenerator === 0 ? "Núcleo Desativado" : `Defletor Magnético MK ${upgrades.shieldGenerator}`}
                </p>
                <p className="text-[8px] text-zinc-500 mt-1 uppercase tracking-widest">{upgrades.shieldGenerator === 0 ? "REQUER ENERGIA" : "ESTÁVEL / ABSORÇÃO ATIVA"}</p>
              </div>
            </div>
          </section>

          <section className="mt-auto bg-zinc-900/30 p-4 rounded-lg border border-zinc-800">
            <h3 className="text-[10px] text-zinc-500 uppercase mb-3 font-bold">Mapeamento</h3>
            <div className="grid grid-cols-2 gap-y-3 font-mono text-left">
              <div>
                <p className="text-[8px] text-zinc-500 uppercase">Fase</p>
                <p className="text-xs text-white font-bold">{screen === "GAME" ? `Sector ${liveStats.stage}` : "No Hangar"}</p>
              </div>
              <div>
                <p className="text-[8px] text-zinc-500 uppercase">Aeronave</p>
                <p className="text-xs text-white font-bold">#XJ-992</p>
              </div>
              <div>
                <p className="text-[8px] text-zinc-500 uppercase">Multiplicador</p>
                <p className="text-xs text-yellow-400 font-bold">x{screen === "GAME" ? liveStats.threatIndex.toFixed(1) : "1.0"}</p>
              </div>
              <div>
                <p className="text-[8px] text-zinc-500 uppercase">Pontos</p>
                <p className="text-xs text-white font-bold truncate text-ellipsis">{activeScore.toLocaleString()}</p>
              </div>
            </div>
          </section>
        </aside>

      </div>

      {/* Static Footer Legend from Immersive UI Template */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black border border-zinc-800 px-4 py-1 rounded-full z-20 shadow-lg hidden sm:block">
        <p className="text-[9px] text-zinc-500 tracking-[0.3em] font-mono font-bold uppercase">
          PROJETO: NEON-STRIKE | V1.0.4 - PILOTO: SOL-6
        </p>
      </div>

      <style>{`
        #active-bezel-screen-viewport {
          box-shadow: inset 0 0 40px rgba(0,0,0,1);
        }
        @keyframes flicker {
          0% { opacity: 0.99; }
          50% { opacity: 0.92; }
          100% { opacity: 0.99; }
        }
      `}</style>
    </div>
  );
}
