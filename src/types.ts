/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PermanentUpgrades {
  hullPlating: number; // Max HP upgrade
  laserEnergy: number; // Damage multiplier upgrade
  thrusterCore: number; // Fire rate / cooldown reduction Upgrade
  shieldGenerator: number; // Energy Shield Capacity Upgrade
  magneticHarvester: number; // Scrap collection radius Upgrade
  scrapRefiner: number; // Extra scrap earned multiplier
}

export type UpgradeId = keyof PermanentUpgrades;

export interface UpgradeInfo {
  id: UpgradeId;
  name: string;
  description: string;
  costBase: number;
  costMultiplier: number;
  valueBase: number;
  valuePerLevel: number;
  unit: string;
  icon: string;
}

export const UPGRADE_METADATA: Record<UpgradeId, UpgradeInfo> = {
  hullPlating: {
    id: "hullPlating",
    name: "Blindagem de Casco",
    description: "Aumenta a integridade máxima da estrutura da nave.",
    costBase: 150,
    costMultiplier: 1.6,
    valueBase: 100,
    valuePerLevel: 25,
    unit: " HP",
    icon: "ShieldAlert",
  },
  laserEnergy: {
    id: "laserEnergy",
    name: "Canhão de Fótons",
    description: "Aumenta o dano causado por todos os feixes de laser.",
    costBase: 200,
    costMultiplier: 1.7,
    valueBase: 10,
    valuePerLevel: 4,
    unit: " Dano",
    icon: "Zap",
  },
  thrusterCore: {
    id: "thrusterCore",
    name: "Supercombustor de Cadência",
    description: "Reduz o tempo de recarga das armas principais.",
    costBase: 250,
    costMultiplier: 1.8,
    valueBase: 350, // in ms cooldown
    valuePerLevel: -35, // decrease cooldown
    unit: "ms Recarga",
    icon: "Gauge",
  },
  shieldGenerator: {
    id: "shieldGenerator",
    name: "Campo de Força",
    description: "Gera um escudo de energia autorregenerativo.",
    costBase: 300,
    costMultiplier: 1.9,
    valueBase: 0,
    valuePerLevel: 30,
    unit: " Escudo",
    icon: "Shield",
  },
  magneticHarvester: {
    id: "magneticHarvester",
    name: "Atraidor Automático",
    description: "Amplia o raio magnético de atração de sucata espacial (Cripto-Metais).",
    costBase: 100,
    costMultiplier: 1.5,
    valueBase: 60, // in px
    valuePerLevel: 35,
    unit: "px Raio",
    icon: "Magnet",
  },
  scrapRefiner: {
    id: "scrapRefiner",
    name: "Sincronizador Mecânico",
    description: "Permite recuperar mais moedas de sucata de carcaças destruídas.",
    costBase: 120,
    costMultiplier: 1.5,
    valueBase: 1.0,
    valuePerLevel: 0.25,
    unit: "x Multiplicador",
    icon: "Coins",
  },
};

export type EnemyType = "SCOUT" | "SWARM" | "CRUISER" | "BOMBER" | "INTERCEPTOR";

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  color: string;
  points: number;
  fireCooldown: number;
  fireRate: number; // in ticks/seconds
  patternTimer: number;
  scrapMultiplier: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  damage: number;
  isPlayer: boolean;
  color: string;
  isMissile?: boolean;
  targetId?: string; // homing behavior
  angle?: number;
}

export type ParticleType = "EXPLOSION" | "SPARK" | "SHRAPNEL" | "SHIELD_HIT" | "THRUSTER" | "HEAL";

export interface Particle {
  id: string;
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  growth?: number;
}

export interface Collectible {
  id: string;
  type: "SCRAP" | "HEAL" | "WEAPON_POWERUP" | "SHIELD_RESTORE";
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  value: number; // e.g. amount of scrap, amount of heal
}

export interface Boss {
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  phase: number;
  stateTimer: number;
  activePattern: number;
  shieldActive: boolean;
  beamCharge: number; // For supercharge laser attacks
  isFlashing: number; // highlight red on damage
}

export interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
}
