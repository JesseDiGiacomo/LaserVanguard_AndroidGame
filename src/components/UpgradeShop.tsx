/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  UPGRADE_METADATA, 
  PermanentUpgrades, 
  UpgradeId, 
  UpgradeInfo 
} from "../types";
import { 
  Zap, 
  ShieldAlert, 
  Gauge, 
  Shield, 
  Magnet, 
  Coins, 
  ArrowLeft, 
  RotateCcw 
} from "lucide-react";
import { SoundSynth } from "../lib/audio";

interface UpgradeShopProps {
  upgrades: PermanentUpgrades;
  scrap: number;
  onPurchaseUpgrade: (id: UpgradeId) => void;
  onResetUpgrades: () => void;
  onClose: () => void;
}

export function UpgradeShop({ 
  upgrades, 
  scrap, 
  onPurchaseUpgrade, 
  onResetUpgrades, 
  onClose 
}: UpgradeShopProps) {

  const getIcon = (iconName: string) => {
    const props = { className: "w-6 h-6 text-emerald-400" };
    switch (iconName) {
      case "ShieldAlert": return <ShieldAlert {...props} />;
      case "Zap": return <Zap {...props} />;
      case "Gauge": return <Gauge {...props} />;
      case "Shield": return <Shield {...props} />;
      case "Magnet": return <Magnet {...props} />;
      case "Coins": return <Coins {...props} />;
      default: return <Coins {...props} />;
    }
  };

  const getUpgradeCost = (info: UpgradeInfo, currentLevel: number): number => {
    if (currentLevel >= 5) return 0; // Max level
    return Math.round(info.costBase * Math.pow(info.costMultiplier, currentLevel));
  };

  const getUpgradeValue = (info: UpgradeInfo, currentLevel: number): string => {
    if (info.id === "thrusterCore") {
      const ms = info.valueBase + (currentLevel * info.valuePerLevel);
      return `${ms}${info.unit}`;
    }
    if (info.id === "scrapRefiner") {
      const mult = info.valueBase + (currentLevel * info.valuePerLevel);
      return `${mult.toFixed(2)}${info.unit}`;
    }
    const val = info.valueBase + (currentLevel * info.valuePerLevel);
    return `${val}${info.unit}`;
  };

  const handlePurchase = (id: UpgradeId, cost: number) => {
    if (scrap >= cost && upgrades[id] < 5) {
      onPurchaseUpgrade(id);
      SoundSynth.playPowerUpSound();
    } else {
      SoundSynth.playHitSound(false); // sad buzz sound on failure
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-zinc-950/20 p-6 overflow-y-auto font-mono select-none text-zinc-300">
      {/* Top Header */}
      <div className="flex flex-col gap-3 items-center justify-between border-b border-zinc-800 pb-4 mb-6">
        <button
          onClick={() => {
            SoundSynth.playScrapCollectSound();
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-zinc-900 duration-150 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg transition-all text-xs uppercase"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Sair da Oficina</span>
        </button>

        <div className="text-center">
          <h1 className="text-sm font-black tracking-widest text-[#22c55e] uppercase select-none animate-pulse">
            Terminal de Engenharia
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase mt-0.5">Ajustes Permanentes de Mecatrônica</p>
        </div>

        <div className="md:hidden flex items-center gap-2 px-3 py-1 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs">
          <Coins className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="font-bold">{scrap.toLocaleString()}</span>
        </div>
      </div>

      <p className="text-[10px] text-zinc-400 mb-6 text-center max-w-sm mx-auto">
        Utilize a sucata coletada em combate para fundir novos módulos. As atualizações persistem através de loops temporais.
      </p>

      {/* Grid of Upgrades */}
      <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto w-full flex-grow">
        {(Object.keys(UPGRADE_METADATA) as UpgradeId[]).map((id) => {
          const info = UPGRADE_METADATA[id];
          const level = upgrades[id];
          const cost = getUpgradeCost(info, level);
          const isMax = level >= 5;
          const canAfford = scrap >= cost && !isMax;

          return (
            <div 
              key={id}
              className={`flex flex-col bg-zinc-900/60 border ${
                isMax ? "border-emerald-500/20 bg-emerald-950/5" : "border-zinc-800"
              } hover:border-emerald-500/30 transition-all rounded-lg p-4 relative overflow-hidden group`}
            >
              {/* Highlight background glow on group hover */}
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              {/* Icon & Title */}
              <div className="flex items-start gap-3 mb-2">
                <div className="p-2 bg-zinc-950 rounded-lg border border-zinc-850 shrink-0">
                  {getIcon(info.icon)}
                </div>
                <div className="flex-grow text-left">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors uppercase text-xs tracking-wide">
                      {info.name}
                    </h3>
                    <span className="font-mono text-[9px] font-semibold px-1.5 py-0.2 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">
                      LVL {level}/5
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1 line-clamp-1">
                    {info.description}
                  </p>
                </div>
              </div>

              {/* Progress bars (5 steps) */}
              <div className="flex items-center gap-1 my-2">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div 
                    key={step}
                    className={`h-1.5 flex-grow rounded-sm transition-all duration-300 ${
                      step <= level 
                        ? "bg-gradient-to-r from-[#22c55e] to-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.3)]" 
                        : "bg-zinc-950"
                    }`}
                  />
                ))}
              </div>

              {/* Data comparison (Current vs Next Level) */}
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono py-1.5 px-2.5 bg-zinc-950/80 rounded border border-zinc-850 my-2 text-left">
                <div>
                  <span className="text-zinc-500 block uppercase tracking-wider text-[8px]">Atual</span>
                  <span className="text-zinc-300 font-bold">{getUpgradeValue(info, level)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block uppercase tracking-wider text-[8px]">Próximo</span>
                  <span className="text-emerald-400 font-bold">
                    {isMax ? "PRONTO" : getUpgradeValue(info, level + 1)}
                  </span>
                </div>
              </div>

              {/* Buy Button */}
              <div className="mt-2 pt-1">
                {isMax ? (
                  <div className="w-full text-center py-2 bg-emerald-950/20 text-emerald-400 border border-emerald-500/25 font-bold text-[10px] rounded uppercase tracking-wider">
                    Concluído ✔
                  </div>
                ) : (
                  <button
                    disabled={!canAfford}
                    onClick={() => handlePurchase(id, cost)}
                    className={`w-full py-2 px-3 font-bold rounded uppercase tracking-wider flex items-center justify-between text-[10px] transition-all duration-150 border ${
                      canAfford 
                        ? "bg-emerald-500/10 hover:bg-emerald-500 text-zinc-950 hover:text-zinc-950 border-emerald-500 shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] cursor-pointer" 
                        : "bg-zinc-950 text-zinc-500 border-zinc-900 cursor-not-allowed"
                    }`}
                  >
                    <span>Aprimorar</span>
                    <span className="font-mono flex items-center gap-1">
                      <Coins className="w-3 h-3 shrink-0" />
                      {cost.toLocaleString()}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reset Hangar option */}
      <div className="text-center mt-6 pb-2">
        <button
          onClick={() => {
            if (confirm("Deseja realmente reiniciar todas as melhorias e recuperar sua sucata?")) {
              onResetUpgrades();
              SoundSynth.playExplosionSound("MEDIUM");
            }
          }}
          className="inline-flex items-center gap-1.5 text-[10px] text-red-400 hover:text-red-300 transition-colors uppercase border border-red-500/20 py-1.5 px-3 rounded bg-red-950/10 hover:bg-red-950/30"
        >
          <RotateCcw className="w-3 h-3" />
          Resetar Módulos
        </button>
      </div>
    </div>
  );
}
