/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { PermanentUpgrades, UPGRADE_METADATA } from "../types";
import { 
  Play, 
  Gamepad2, 
  Volume2, 
  VolumeX, 
  Tv, 
  Cpu, 
  Heart, 
  Zap, 
  Shield, 
  Coins,
  Gauge
} from "lucide-react";
import { SoundSynth } from "../lib/audio";

interface MainMenuProps {
  upgrades: PermanentUpgrades;
  scrap: number;
  highestScore: number;
  onStartGame: () => void;
  onOpenShop: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  crtEnabled: boolean;
  onToggleCrt: () => void;
}

export function MainMenu({
  upgrades,
  scrap,
  highestScore,
  onStartGame,
  onOpenShop,
  isMuted,
  onToggleMute,
  crtEnabled,
  onToggleCrt
}: MainMenuProps) {

  // Calculate ship parameters for preview
  const maxHp = UPGRADE_METADATA.hullPlating.valueBase + (upgrades.hullPlating * UPGRADE_METADATA.hullPlating.valuePerLevel);
  const damage = UPGRADE_METADATA.laserEnergy.valueBase + (upgrades.laserEnergy * UPGRADE_METADATA.laserEnergy.valuePerLevel);
  const cooldown = UPGRADE_METADATA.thrusterCore.valueBase + (upgrades.thrusterCore * UPGRADE_METADATA.thrusterCore.valuePerLevel);
  const shield = UPGRADE_METADATA.shieldGenerator.valueBase + (upgrades.shieldGenerator * UPGRADE_METADATA.shieldGenerator.valuePerLevel);

  const testAudio = () => {
    SoundSynth.resume();
    SoundSynth.playLaserSound(true);
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-between bg-zinc-950/20 p-6 font-mono select-none overflow-y-auto text-zinc-300">
      
      {/* Decorative starry parallax sky backing */}
      <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
        <div id="stars-fast" className="absolute w-[2px] h-[2px] bg-white rounded-full translate-y-16 animate-pulse" style={{left: "15%", top: "22%"}} />
        <div className="absolute w-[3px] h-[3px] bg-[#22c55e] rounded-full animate-ping" style={{left: "80%", top: "45%", animationDuration: "3s"}} />
        <div className="absolute w-[2px] h-[2px] bg-cyan-400 rounded-full" style={{left: "70%", top: "15%"}} />
        <div className="absolute w-[1.5px] h-[1.5px] bg-slate-100 rounded-full" style={{left: "25%", top: "78%"}} />
        <div className="absolute w-[3px] h-[3px] bg-emerald-500 rounded-full opacity-60" style={{left: "40%", top: "60%"}} />
      </div>

      <div className="w-full max-w-4xl flex justify-end items-center z-10">
        {/* Pinned Scrap HUD for compact views */}
        <div className="md:hidden flex items-center gap-2 px-3 py-1.5 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs">
          <Coins className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="font-bold">{scrap.toLocaleString()}</span>
        </div>
      </div>

      {/* Hero Logo Screen */}
      <div className="flex flex-col items-center justify-center my-4 text-center z-10">
        <div className="relative mb-3">
          {/* Neon shadow backgrounds */}
          <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg blur opacity-20 animate-pulse"></div>
          
          <div className="relative px-6 py-4 bg-zinc-950/90 border border-zinc-800 rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.1)] flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-[0.4em] text-emerald-500 font-bold mb-1 animate-pulse">
              VECTORS CHIPTUNE ODYSSEY
            </span>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-zinc-100 to-zinc-400 italic">
              Laser Vanguard
            </h1>
            <h2 className="text-[10px] sm:text-xs font-semibold text-[#22c55e] tracking-widest uppercase mt-1">
              Batalha Espacial Retro
            </h2>
          </div>
        </div>
        
        {/* Record stat */}
        {highestScore > 0 && (
          <div className="font-mono text-[9px] text-yellow-400/80 uppercase tracking-widest bg-yellow-950/20 border border-yellow-500/20 px-3 py-1 rounded-full">
            🏆 Recorde Pessoal: <span className="font-bold">{highestScore.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Ship Attributes Panel + Button Area */}
      <div className="w-full max-w-md flex flex-col items-center z-10 gap-3">
        
        {/* Ship Configuration Preview */}
        <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 right-0 p-2 text-[9px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-1">
            <Cpu className="w-3 h-3 text-emerald-500" />
            V-Vanguard Alpha
          </div>

          <h3 className="text-[10px] uppercase text-zinc-400 font-bold mb-3 tracking-wider border-b border-zinc-800 pb-1.5 text-left">
            Configuração da Nave
          </h3>

          <div className="grid grid-cols-2 gap-2 text-left">
            {/* Health */}
            <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-900 flex items-center gap-2">
              <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <div className="overflow-hidden">
                <span className="block text-[8px] text-zinc-500 uppercase tracking-wider">Integridade</span>
                <span className="font-mono text-[10px] font-bold text-zinc-200">{maxHp} HP</span>
              </div>
            </div>

            {/* Bullets */}
            <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-900 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <div className="overflow-hidden">
                <span className="block text-[8px] text-zinc-500 uppercase tracking-wider">Laser</span>
                <span className="font-mono text-[10px] font-bold text-zinc-200">{damage} Dano</span>
              </div>
            </div>

            {/* Shields */}
            <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-900 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <div className="overflow-hidden">
                <span className="block text-[8px] text-zinc-500 uppercase tracking-wider">Escudo</span>
                <span className="font-mono text-[10px] font-bold text-zinc-200">{shield > 0 ? `${shield} SP` : "INATIVO"}</span>
              </div>
            </div>

            {/* Firing cooling */}
            <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-900 flex items-center gap-2">
              <Gauge className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="overflow-hidden">
                <span className="block text-[8px] text-zinc-500 uppercase tracking-wider">Cadência</span>
                <span className="font-mono text-[10px] font-bold text-zinc-200">{cooldown}ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full px-2 max-w-lg mb-6">
          {/* Start Campaign Run */}
          <button
            onClick={() => {
              SoundSynth.resume();
              onStartGame();
            }}
            className="relative overflow-hidden group cursor-pointer bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 font-black uppercase text-sm py-4 px-6 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,197,94,0.25)] hover:shadow-[0_0_30px_rgba(34,197,94,0.4)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 duration-150"
          >
            {/* Beam flare across button */}
            <span className="absolute inset-y-0 left-0 w-8 bg-white/20 transform skew-x-30 -translate-x-12 group-hover:animate-[wave_1.5s_infinite] pointer-events-none" />
            <Play className="w-5 h-5 fill-slate-950" />
            <span>Decolar Missão</span>
          </button>

          {/* Hangar Upgrades shop */}
          <button
            onClick={() => {
              SoundSynth.playScrapCollectSound();
              onOpenShop();
            }}
            className="cursor-pointer bg-slate-900 border border-slate-700 hover:border-emerald-500/60 duration-150 text-slate-200 hover:text-white font-bold uppercase text-sm py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_4px_10px_rgba(0,0,0,0.5)] transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Cpu className="w-5 h-5 text-emerald-400 group-hover:animate-spin" />
            <span>Oficina Terminais</span>
          </button>
        </div>
      </div>

      {/* Guide controls footer with minimal clean presentation */}
      <div className="w-full max-w-lg z-10 text-center text-slate-500 font-mono text-[11px] border-t border-slate-900/80 pt-4 bg-slate-950/60 p-3 rounded-lg">
        <div className="flex items-center justify-center gap-2 mb-1.5 text-slate-400 uppercase tracking-widest text-[10px]">
          <Gamepad2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Controles de Pilotagem</span>
        </div>
        <p className="line-clamp-2">
          Teclado: Mover com <span className="text-emerald-400">WASD / Setas</span>. Armas Automáticas.
        </p>
        <p className="mt-1">
          Touch de Celular ou Mouse: <span className="text-emerald-400">Arraste a nave</span> diretamente para se mover e desviar.
        </p>
      </div>

      <style>{`
        @keyframes wave {
          0% { transform: skewX(-30deg) translateX(-40px); }
          100% { transform: skewX(-30deg) translateX(300px); }
        }
      `}</style>
    </div>
  );
}
