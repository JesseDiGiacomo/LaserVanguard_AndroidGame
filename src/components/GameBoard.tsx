/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { 
  PermanentUpgrades, 
  UPGRADE_METADATA, 
  Enemy, 
  Bullet, 
  Particle, 
  Collectible, 
  Boss, 
  Star, 
  EnemyType 
} from "../types";
import { SoundSynth } from "../lib/audio";
import { 
  Trophy, 
  Heart, 
  Shield as ShieldIcon, 
  Coins, 
  ShieldAlert, 
  Zap, 
  Flame, 
  VolumeX, 
  Volume2, 
  Tv 
} from "lucide-react";

interface GameBoardProps {
  upgrades: PermanentUpgrades;
  onGameEnd: (score: number, scrapEarned: number, victory: boolean) => void;
  isMuted: boolean;
  crtEnabled: boolean;
  onToggleCrt: () => void;
  onStatsUpdate?: (stats: any) => void;
}

export function GameBoard({ 
  upgrades, 
  onGameEnd, 
  isMuted,
  crtEnabled,
  onToggleCrt,
  onStatsUpdate
}: GameBoardProps) {
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Core Game State Refs to prevent react re-render delays inside 60fps loop
  const gameStateRef = useRef({
    score: 0,
    scrapCollected: 0,
    stage: 1,
    maxStages: 3,
    progress: 0, // 0 to 1000 (1000 = boss spawn)
    isGameOver: false,
    isVictory: false,
    paused: false,
    threatIndex: 0.7, // Dynamic difficulty factor starts lower (EASY)
    screenShake: 0,
    warningTimer: 0,
    
    // Player ship stats (Adjusted by upgrades)
    player: {
      x: 300,
      y: 750,
      width: 42,
      height: 42,
      hp: 100,
      maxHp: 100,
      shield: 50,
      maxShield: 50,
      shieldRegenCooldown: 0,
      weaponPowerLevel: 1, // temporary weapon level within the run
      fireTimer: 0,
      hitFlash: 0,
      speed: 5.5,
    },
    
    // Groups
    enemies: [] as Enemy[],
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    collectibles: [] as Collectible[],
    stars: [] as Star[],
    boss: null as Boss | null,
    
    // Controls
    keys: {} as Record<string, boolean>,
    touching: false,
    touchX: 0,
    touchY: 0,
    
    // Timers
    enemySpawnTimer: 0,
    bossDefeatTimer: 0,
    runTimer: 0,
    timeSinceLastBoss: 4800 // Tracks frames since a boss was active/spawned to ensure reasonable gameplay intervals
  });

  // React state mirroring for UI layer (updated periodically or on game end)
  const [score, setScore] = useState(0);
  const [scrapCollected, setScrapCollected] = useState(0);
  const [stage, setStage] = useState(1);
  const [progress, setProgress] = useState(0);
  const [hp, setHp] = useState(100);
  const [maxHp, setMaxHp] = useState(100);
  const [shield, setShield] = useState(50);
  const [maxShield, setMaxShield] = useState(50);
  const [threatIndex, setThreatIndex] = useState(0.7);
  const [bossActive, setBossActive] = useState(false);
  const [bossHp, setBossHp] = useState(0);
  const [bossMaxHp, setBossMaxHp] = useState(100);
  const [bossName, setBossName] = useState("");
  const [warningActive, setWarningActive] = useState(false);
  const [weaponLevel, setWeaponLevel] = useState(1);
  const [paused, setPaused] = useState(false);

  // Sync to parent component via a stable ref to avoid any useEffect closures triggers
  const onStatsUpdateRef = useRef(onStatsUpdate);
  useEffect(() => {
    onStatsUpdateRef.current = onStatsUpdate;
  }, [onStatsUpdate]);

  useEffect(() => {
    if (onStatsUpdateRef.current) {
      onStatsUpdateRef.current({
        score,
        scrapCollected,
        stage,
        progress,
        hp,
        maxHp,
        shield,
        maxShield,
        threatIndex,
        weaponLevel,
        bossActive,
        bossHp,
        bossMaxHp,
        bossName
      });
    }
  }, [
    score,
    scrapCollected,
    stage,
    progress,
    hp,
    maxHp,
    shield,
    maxShield,
    threatIndex,
    weaponLevel,
    bossActive,
    bossHp,
    bossMaxHp,
    bossName
  ]);

  // Initialize Canvas resolution matching coordinates (600x900 relative viewport)
  const logicalWidth = 600;
  const logicalHeight = 900;

  // Active Sound configurations
  useEffect(() => {
    SoundSynth.startMusic();
    SoundSynth.bossActive = false;
    SoundSynth.threatFactor = 1.0;
    
    return () => {
      SoundSynth.stopMusic();
    };
  }, []);

  // Sync mute state to audio synth
  useEffect(() => {
    if (isMuted && !SoundSynth.getMuted()) {
      SoundSynth.toggleMute();
    } else if (!isMuted && SoundSynth.getMuted()) {
      SoundSynth.toggleMute();
    }
  }, [isMuted]);

  // Game Loop and controls handle
  useEffect(() => {
    const state = gameStateRef.current;
    
    // Calculate player ship parameters based on permanent upgrades
    const basePlating = UPGRADE_METADATA.hullPlating.valueBase;
    const extraPlating = upgrades.hullPlating * UPGRADE_METADATA.hullPlating.valuePerLevel;
    state.player.maxHp = basePlating + extraPlating;
    state.player.hp = state.player.maxHp;

    const baseShieldLevel = UPGRADE_METADATA.shieldGenerator.valueBase;
    const extraShield = upgrades.shieldGenerator * UPGRADE_METADATA.shieldGenerator.valuePerLevel;
    state.player.maxShield = baseShieldLevel + extraShield;
    state.player.shield = state.player.maxShield;

    state.player.weaponPowerLevel = 1; // start with single gun barrel
    state.score = 0;
    state.scrapCollected = 0;
    state.stage = 1;
    state.progress = 0;
    state.isGameOver = false;
    state.isVictory = false;
    state.paused = false;
    state.threatIndex = 0.7;
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    state.collectibles = [];
    state.boss = null;
    state.enemySpawnTimer = 40;
    state.bossDefeatTimer = 0;
    state.runTimer = 0;
    state.timeSinceLastBoss = 4800; // Reset boss interval cooldown on restart
    state.player.x = logicalWidth / 2;
    state.player.y = logicalHeight - 120;

    // React state initial synchronization
    setScore(0);
    setScrapCollected(0);
    setStage(1);
    setProgress(0);
    setHp(state.player.hp);
    setMaxHp(state.player.maxHp);
    setShield(state.player.shield);
    setMaxShield(state.player.maxShield);
    setThreatIndex(0.7);
    setBossActive(false);
    setWarningActive(false);
    setWeaponLevel(1);
    setPaused(false);

    // Populate initial background stars (Parallax)
    state.stars = [];
    for (let i = 0; i < 90; i++) {
      state.stars.push({
        x: Math.random() * logicalWidth,
        y: Math.random() * logicalHeight,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 1.5 + 0.5, // background speed
        alpha: Math.random() * 0.7 + 0.3
      });
    }

    // Keyboard controls
    const handleKeyDown = (e: KeyboardEvent) => {
      state.keys[e.key.toLowerCase()] = true;
      if (e.key === "Escape" || e.key === "p") {
        togglePause();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      state.keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Drag, Touch, & Mouse handling for responsive dynamic positioning
    const canvas = canvasRef.current;
    
    const getTouchCoords = (clientX: number, clientY: number) => {
      if (!canvas) return { x: 300, y: 750 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = logicalWidth / rect.width;
      const scaleY = logicalHeight / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      state.touching = true;
      const touch = e.touches[0];
      const coords = getTouchCoords(touch.clientX, touch.clientY);
      state.touchX = coords.x;
      state.touchY = coords.y;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!state.touching) return;
      const touch = e.touches[0];
      const coords = getTouchCoords(touch.clientX, touch.clientY);
      
      // Move ship directly with beautiful smoothing
      const targetX = coords.x;
      const targetY = coords.y - 45; // Offset finger so vessel is visible!
      state.player.x = Math.max(state.player.width / 2, Math.min(logicalWidth - state.player.width / 2, targetX));
      state.player.y = Math.max(state.player.height / 2, Math.min(logicalHeight - state.player.height / 2, targetY));
    };

    const handleTouchEnd = () => {
      state.touching = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      state.touching = true;
      const coords = getTouchCoords(e.clientX, e.clientY);
      state.touchX = coords.x;
      state.touchY = coords.y;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!state.touching) return;
      const coords = getTouchCoords(e.clientX, e.clientY);
      const targetX = coords.x;
      const targetY = coords.y - 12; // slight offset for mouse
      state.player.x = Math.max(state.player.width / 2, Math.min(logicalWidth - state.player.width / 2, targetX));
      state.player.y = Math.max(state.player.height / 2, Math.min(logicalHeight - state.player.height / 2, targetY));
    };

    const handleMouseUp = () => {
      state.touching = false;
    };

    if (canvas) {
      canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
      canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
      canvas.addEventListener("touchend", handleTouchEnd);
      canvas.addEventListener("mousedown", handleMouseDown);
      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("mouseup", handleMouseUp);
    }

    // High performance animation frame logic loop
    let animationFrameId: number;

    const gameLoop = () => {
      updatePhysics();
      checkCollisions();
      drawGame();
      
      if (!state.isGameOver && !state.isVictory) {
        animationFrameId = requestAnimationFrame(gameLoop);
      }
    };

    // Kickstart the cycle
    gameLoop();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (canvas) {
        canvas.removeEventListener("touchstart", handleTouchStart);
        canvas.removeEventListener("touchmove", handleTouchMove);
        canvas.removeEventListener("touchend", handleTouchEnd);
        canvas.removeEventListener("mousedown", handleMouseDown);
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("mouseup", handleMouseUp);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [upgrades, stage]);

  // Pause toggle
  const togglePause = () => {
    const state = gameStateRef.current;
    if (state.isGameOver || state.isVictory) return;
    
    state.paused = !state.paused;
    setPaused(state.paused);
    if (state.paused) {
      SoundSynth.stopMusic();
    } else {
      SoundSynth.startMusic();
    }
  };

  // Trigger screen shake
  const addScreenShake = (amount: number) => {
    gameStateRef.current.screenShake = Math.min(25, gameStateRef.current.screenShake + amount);
  };

  // Generate Enemy Projectile Splatters
  const createExplosionParticles = (x: number, y: number, color: string, count = 12, intensity: "SMALL" | "MEDIUM" | "LARGE" = "SMALL") => {
    const state = gameStateRef.current;
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (intensity === "LARGE" ? 8 : intensity === "MEDIUM" ? 5 : 3.5) + 1.2;
      const size = Math.random() * (intensity === "LARGE" ? 6 : 3.5) + 1.5;
      
      state.particles.push({
        id: Math.random().toString(),
        type: intensity === "LARGE" ? "SHRAPNEL" : "EXPLOSION",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        color,
        alpha: 1,
        decay: Math.random() * 0.02 + 0.012
      });
    }

    // High velocity sparks
    for (let i = 0; i < Math.floor(count / 2); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 11 + 3;
      state.particles.push({
        id: Math.random().toString(),
        type: "SPARK",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 1.5 + 1.0,
        color: "#f59e0b", // spark color (gold/orange)
        alpha: 0.9,
        decay: Math.random() * 0.04 + 0.03
      });
    }
  };

  // Trigger shield impact sparks
  const createShieldHitParticles = (x: number, y: number, count = 7) => {
    const state = gameStateRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI - Math.PI; // spraying upwards
      const speed = Math.random() * 4 + 2;
      state.particles.push({
        id: Math.random().toString(),
        type: "SHIELD_HIT",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: Math.random() * 2 + 2,
        color: "#22d3ee", // neon cyan shielding
        alpha: 0.9,
        decay: 0.035
      });
    }
  };

  // Procedural Enemy Builder
  const spawnEnemy = (type: EnemyType, x: number, y: number, vxMultiplier = 1, vyMultiplier = 1) => {
    const state = gameStateRef.current;
    let width = 32;
    let height = 32;
    let maxHp = 10;
    let color = "#ef4444"; // red
    let points = 100;
    let fireRate = 0.5; // low frequency fires
    let vx = 0;
    let vy = 1.2;

    const scale = state.threatIndex; // health and performance scaling

    switch (type) {
      case "SCOUT":
        width = 32;
        height = 32;
        maxHp = Math.round(15 * Math.sqrt(scale));
        color = "#10b981"; // neon green scout
        points = 120;
        fireRate = 0.65;
        vx = (Math.random() * 2 - 1) * 1.5 * vxMultiplier;
        vy = (Math.random() * 0.8 + 1.0) * vyMultiplier;
        break;
      case "SWARM":
        width = 24;
        height = 24;
        maxHp = Math.round(8 * scale);
        color = "#f43f5e"; // rose/pink swarmers
        points = 80;
        fireRate = 0.3; // low fires
        vx = 0; // handled via sine waves
        vy = 2.2 * vyMultiplier;
        break;
      case "CRUISER":
        width = 48;
        height = 42;
        maxHp = Math.round(60 * scale);
        color = "#f59e0b"; // gold amber cruiser
        points = 350;
        fireRate = 1.2;
        vx = (Math.random() * 0.8 - 0.4) * vxMultiplier;
        vy = 0.6 * vyMultiplier;
        break;
      case "BOMBER":
        width = 44;
        height = 44;
        maxHp = Math.round(45 * scale);
        color = "#a855f7"; // purple bombers
        points = 250;
        fireRate = 0.8;
         vx = 0;
        vy = 0.8 * vyMultiplier;
        break;
      case "INTERCEPTOR":
        width = 28;
        height = 28;
        maxHp = Math.round(14 * scale);
        color = "#06b6d4"; // Cyan speeder
        points = 150;
        fireRate = 0.5;
        vx = vxMultiplier * 3.0; // sweeping diagonally fast
        vy = 1.6 * vyMultiplier;
        break;
    }

    state.enemies.push({
      id: Math.random().toString(),
      type,
      x,
      y: y - height,
      vx,
      vy,
      width,
      height,
      hp: maxHp,
      maxHp,
      color,
      points,
      fireCooldown: Math.random() * 120 + 30, // staggered initial firing
      fireRate,
      patternTimer: 0,
      scrapMultiplier: 1.0
    });
  };

  // Launch procedural wave patterns
  const triggerProceduralWave = () => {
    const state = gameStateRef.current;
    if (state.boss) return; // do not spawn standard waves if boss is fighting!
    
    // Select dynamic patterns depending on stage and luck
    const randPattern = Math.random();
    const threatFactor = state.threatIndex;

    // Scale wave sizes or types based on stage difficulty
    if (state.stage === 1) {
      if (randPattern < 0.35) {
        // Sinusoidal cluster sweep
        const startX = Math.random() * (logicalWidth - 150) + 75;
        for (let i = 0; i < 4; i++) {
          spawnEnemy("SWARM", startX, -i * 35, 1, 1);
        }
      } else if (randPattern < 0.7) {
        // Three diagonal scouts
        const flip = Math.random() > 0.5 ? 1 : -1;
        spawnEnemy("SCOUT", 100, -20, flip, 1);
        spawnEnemy("SCOUT", 300, -50, 0, 1.1);
        spawnEnemy("SCOUT", 500, -80, -flip, 1);
      } else {
        // Single Heavy tank plus scout escort
        spawnEnemy("CRUISER", logicalWidth / 2, -30, 0, 0.9);
        spawnEnemy("SCOUT", logicalWidth / 2 - 80, -60, -0.6, 1.1);
        spawnEnemy("SCOUT", logicalWidth / 2 + 80, -60, 0.6, 1.1);
      }
    } else if (state.stage === 2) {
      // Stage 2: Introducing diagonal interceptor sweeps and heavy bombers!
      if (randPattern < 0.3) {
        // Cross sweeping interceptor fleet
        spawnEnemy("INTERCEPTOR", 10, -10, 1.0, 1.1);
        spawnEnemy("INTERCEPTOR", logicalWidth - 50, -40, -1.0, 1.1);
        spawnEnemy("INTERCEPTOR", 80, -80, 0.8, 1.1);
        spawnEnemy("INTERCEPTOR", logicalWidth - 120, -110, -0.8, 1.1);
      } else if (randPattern < 0.65) {
        // Dual Bombers with shielding guards
        spawnEnemy("BOMBER", 200, -40, 0, 1);
        spawnEnemy("BOMBER", 400, -80, 0, 1);
        spawnEnemy("SWARM", 300, -110, 1, 1.5);
      } else {
        // Double cruisers flanked
        spawnEnemy("CRUISER", 150, -30, 0.4, 0.95);
        spawnEnemy("CRUISER", 450, -60, -0.4, 0.95);
        spawnEnemy("SCOUT", 300, -100, 0, 1.3);
      }
    } else {
      // Stage 3: Extreme tactical arrays
      if (randPattern < 0.35) {
        // Mega snake wave
        const startX = Math.random() * (logicalWidth - 200) + 100;
        for (let i = 0; i < 7; i++) {
          spawnEnemy("SWARM", startX, -i * 35, 1, 1);
        }
        spawnEnemy("CRUISER", 100, -80, 0.8, 1.0);
        spawnEnemy("CRUISER", 500, -80, -0.8, 1.0);
      } else if (randPattern < 0.7) {
        // Bomber siege fleet
        spawnEnemy("BOMBER", 150, -30, 0.3, 0.95);
        spawnEnemy("BOMBER", 450, -30, -0.3, 0.95);
        spawnEnemy("INTERCEPTOR", 50, -80, 1.2, 1.2);
        spawnEnemy("INTERCEPTOR", logicalWidth - 80, -120, -1.2, 1.2);
      } else {
        // Cruiser and high velocity scout cascade
        spawnEnemy("CRUISER", logicalWidth / 2, -40, 0, 1);
        spawnEnemy("SCOUT", 100, -100, 1.2, 1.5);
        spawnEnemy("SCOUT", 500, -100, -1.2, 1.5);
        spawnEnemy("SWARM", 300, -120, 0, 2);
      }
    }
  };

  // Launch Boss Inbound sequence
  const initBossFight = () => {
    const state = gameStateRef.current;
    state.warningTimer = 180; // approx 3 seconds warning alert
    setWarningActive(true);
    SoundSynth.bossActive = true;
    SoundSynth.playBossSiren();

    if (Capacitor.isNativePlatform()) {
      Haptics.vibrate({ duration: 400 }).catch(() => {});
    }

    // Destroy all remaining minor enemies so that boss screen is absolutely pristine
    state.enemies.forEach(e => {
      createExplosionParticles(e.x, e.y, e.color, 10, "SMALL");
    });
    state.enemies = [];
    state.bullets = []; // Clear enemy bullet fields to prevent cheap hit
  };

  // Create the boss
  const spawnBossInstance = () => {
    const state = gameStateRef.current;
    
    let name = "Nêmesis Orbital [CÉLULA-1]";
    let maxHp = 700;
    let width = 120;
    let height = 80;

    const difficultyScale = state.threatIndex;

    if (state.stage === 2) {
      name = "Sombra do Vazio [NÚCLEO-S]";
      maxHp = 1100;
      width = 110;
      height = 70;
    } else if (state.stage === 3) {
      name = "Destruidor de Sistemas [NÚCLEO-Ω]";
      maxHp = 1800;
      width = 160;
      height = 100;
    }

    // Scale health with threat difficulty index!
    maxHp = Math.round(maxHp * Math.sqrt(difficultyScale + 0.1));

    state.boss = {
      name,
      x: logicalWidth / 2,
      y: -height - 20, // drop down beautifully
      targetX: logicalWidth / 2,
      targetY: 150,
      vx: 0,
      vy: 1.5,
      width,
      height,
      hp: maxHp,
      maxHp,
      phase: 1,
      stateTimer: 0,
      activePattern: 0,
      shieldActive: state.stage === 3, // Boss 3 starts with active revolving energy shield!
      beamCharge: 0,
      isFlashing: 0
    };

    setBossMaxHp(maxHp);
    setBossHp(maxHp);
    setBossName(name);
    setBossActive(true);
  };

  // Core physics updates (stars, positioning, bullet sweeps, particle decays, item pulls)
  const updatePhysics = () => {
    const state = gameStateRef.current;
    if (state.paused) return;

    state.runTimer++;

    // Increment progression level scroll slowly
    if (state.progress < 1000 && !state.boss && state.warningTimer === 0) {
      // Dynamic difficulty influence: speed up scrolling slightly as player does well
      state.progress += 1 + (state.threatIndex - 1.0) * 0.15;
      
      // Gradually adjust state.progress to react state mirroring (throttled slightly or divided by 10)
      setProgress(Math.floor(state.progress / 10));

      if (state.progress >= 1000) {
        initBossFight();
      }
    }

    // Handle incoming warning sirening before boss
    if (state.warningTimer > 0) {
      state.warningTimer--;
      if (state.warningTimer === 0) {
        setWarningActive(false);
        spawnBossInstance();
      }
    }

    // Tick timeSinceLastBoss counter
    if (state.boss || state.warningTimer > 0) {
      state.timeSinceLastBoss = 0;
    } else {
      state.timeSinceLastBoss++;
    }

    // Space environmental threat adjustments (dynamic difficulty index)
    // Slowly tick threat index upwards based on survival, or cap/adjust
    if (state.runTimer % 180 === 0 && !state.isGameOver && !state.isVictory) {
      // Increase threat slowly ONLY if user is stable/healthy (above 35% HP)
      const healthRatio = state.player.hp / state.player.maxHp;
      if (healthRatio > 0.35) {
        state.threatIndex = Math.min(2.5, state.threatIndex + 0.04);
        setThreatIndex(state.threatIndex);
        SoundSynth.threatFactor = state.threatIndex;
      }
    }

    // Dynamic recovery automatic safety net: if near to lose, lock threat index to easier scaling!
    const loopHealthRatio = state.player.hp / state.player.maxHp;
    if (loopHealthRatio <= 0.35 && !state.isGameOver && !state.isVictory) {
      if (state.threatIndex > 0.65) {
        state.threatIndex = 0.65;
        setThreatIndex(state.threatIndex);
        SoundSynth.threatFactor = state.threatIndex;
      }

      // Health-based dynamic boss event with cooldown protection:
      // "Toda vez que a vida está baixa vem um boss para dar chance de derrotar o boss e recuperar o escudo. Precisamos garantir um bom intervalo de jogo entre os boss."
      if (!state.boss && state.warningTimer === 0 && state.timeSinceLastBoss >= 5400) {
        initBossFight();
      }
    }

    // Stars background parallax scroll
    state.stars.forEach(star => {
      // Background speed is scaled slightly by stage and scrolling
      const currentScrollRatio = state.boss ? 0.35 : 1.0;
      star.y += star.speed * currentScrollRatio;
      if (star.y > logicalHeight) {
        star.y = -5;
        star.x = Math.random() * logicalWidth;
      }
    });

    // Clean screen shake
    if (state.screenShake > 0) {
      state.screenShake *= 0.90; // rapid decay
      if (state.screenShake < 0.1) state.screenShake = 0;
    }

    // Weapon power level state tracker
    setWeaponLevel(state.player.weaponPowerLevel);

    // Shield Regen loop
    if (state.player.shieldMax > 0 || state.player.maxShield > 0) {
      if (state.player.shieldRegenCooldown > 0) {
        state.player.shieldRegenCooldown--;
      } else if (state.player.shield < state.player.maxShield) {
        // Shield recharges gradually
        const shieldRegenSpeed = 0.08 + (upgrades.shieldGenerator * 0.02);
        state.player.shield = Math.min(state.player.maxShield, state.player.shield + shieldRegenSpeed);
        setShield(Math.floor(state.player.shield));
      }
    }

    // Decaying Hit flashes on player
    if (state.player.hitFlash > 0) {
      state.player.hitFlash -= 1;
    }

    // -------------------------------------------------------------
    // CONTROLS INGESTION (KEYBOARD HANDLERS FOR WASD OR ARROW KEYS)
    // -------------------------------------------------------------
    if (!state.touching) {
      let dx = 0;
      let dy = 0;
      if (state.keys["arrowleft"] || state.keys["a"]) dx = -1;
      if (state.keys["arrowright"] || state.keys["d"]) dx = 1;
      if (state.keys["arrowup"] || state.keys["w"]) dy = -1;
      if (state.keys["arrowdown"] || state.keys["s"]) dy = 1;

      // Normalize diagonal speed
      if (dx !== 0 && dy !== 0) {
        const factor = 0.7071;
        dx *= factor;
        dy *= factor;
      }

      state.player.x += dx * state.player.speed;
      state.player.y += dy * state.player.speed;

      // Restrict boundaries
      state.player.x = Math.max(state.player.width / 2, Math.min(logicalWidth - state.player.width / 2, state.player.x));
      state.player.y = Math.max(state.player.height / 2, Math.min(logicalHeight - state.player.height / 2, state.player.y));
    }

    // Thruster exhaust particles drifting from bottom of player's vessel
    if (state.runTimer % 3 === 0) {
      state.particles.push({
        id: Math.random().toString(),
        type: "THRUSTER",
        x: state.player.x,
        y: state.player.y + state.player.height / 2 - 3,
        vx: (Math.random() * 2 - 1) * 0.5,
        vy: Math.random() * 2.5 + 4, // rapid drift downwards
        size: Math.random() * 2.5 + 2.0,
        color: state.player.weaponPowerLevel >= 4 ? "#22d3ee" : "#f97316", // cyan thruster on hyper, orange normal
        alpha: 0.8,
        decay: 0.04
      });
    }

    // -------------------------------------------------------------
    // PLAYER WEAPONS AUTO-FIRING SYSTEM
    // -------------------------------------------------------------
    if (state.player.fireTimer > 0) {
      state.player.fireTimer--;
    } else {
      // Calculate shooting interval based on ThrusterCore level permanent upgrades
      const baseCooldownTicks = 32; // base ticks between shots (~500ms)
      // Reducing ticks by 3 for each permanent thrusterCore level upgrades
      const weaponCooldownTicks = Math.max(13, baseCooldownTicks - (upgrades.thrusterCore * 3.2));
      state.player.fireTimer = weaponCooldownTicks;

      // Weapon damage base mapping
      const baseDamage = UPGRADE_METADATA.laserEnergy.valueBase + (upgrades.laserEnergy * UPGRADE_METADATA.laserEnergy.valuePerLevel);

      // Sound play
      if (state.player.weaponPowerLevel >= 3) {
        SoundSynth.playHeavyLaserSound();
      } else {
        SoundSynth.playLaserSound(true);
      }

      // Shoot bullet spreads depending on active Temporary Weapon Power Level
      if (state.player.weaponPowerLevel === 1) {
        // Single central laser bullet
        state.bullets.push({
          id: Math.random().toString(),
          x: state.player.x,
          y: state.player.y - 15,
          vx: 0,
          vy: -11,
          width: 4,
          height: 16,
          damage: baseDamage,
          isPlayer: true,
          color: "#22c55e" // green player bullets
        });
      } else if (state.player.weaponPowerLevel === 2) {
        // Dual laser barrels flanking
        state.bullets.push({
          id: Math.random().toString(),
          x: state.player.x - 12,
          y: state.player.y - 10,
          vx: 0,
          vy: -11,
          width: 4,
          height: 16,
          damage: baseDamage * 0.85, // slight split damage balance
          isPlayer: true,
          color: "#22c55e"
        });
        state.bullets.push({
          id: Math.random().toString(),
          x: state.player.x + 12,
          y: state.player.y - 10,
          vx: 0,
          vy: -11,
          width: 4,
          height: 16,
          damage: baseDamage * 0.85,
          isPlayer: true,
          color: "#22c55e"
        });
      } else if (state.player.weaponPowerLevel === 3) {
        // Triple spray: center plus diagonal sides
        state.bullets.push({
          id: Math.random().toString(),
          x: state.player.x,
          y: state.player.y - 15,
          vx: 0,
          vy: -12,
          width: 5,
          height: 18,
          damage: baseDamage,
          isPlayer: true,
          color: "#38bdf8" // cyan lasers on power 3
        });
        state.bullets.push({
          id: Math.random().toString(),
          x: state.player.x - 14,
          y: state.player.y - 5,
          vx: -2.2,
          vy: -11,
          width: 4,
          height: 14,
          damage: baseDamage * 0.7,
          isPlayer: true,
          color: "#38bdf8"
        });
        state.bullets.push({
          id: Math.random().toString(),
          x: state.player.x + 14,
          y: state.player.y - 5,
          vx: 2.2,
          vy: -11,
          width: 4,
          height: 14,
          damage: baseDamage * 0.7,
          isPlayer: true,
          color: "#38bdf8"
        });
      } else {
        // POWER LEVEL 4: Mega plasma streams plus dual side flanking
        state.bullets.push({
          id: Math.random().toString(),
          x: state.player.x - 4,
          y: state.player.y - 18,
          vx: -0.5,
          vy: -13,
          width: 5,
          height: 20,
          damage: baseDamage * 0.9,
          isPlayer: true,
          color: "#a855f7" // purple hyper light beams
        });
        state.bullets.push({
          id: Math.random().toString(),
          x: state.player.x + 4,
          y: state.player.y - 18,
          vx: 0.5,
          vy: -13,
          width: 5,
          height: 20,
          damage: baseDamage * 0.9,
          isPlayer: true,
          color: "#a855f7"
        });
        state.bullets.push({
          id: Math.random().toString(),
          x: state.player.x - 18,
          y: state.player.y - 3,
          vx: -4.5,
          vy: -10,
          width: 4,
          height: 14,
          damage: baseDamage * 0.6,
          isPlayer: true,
          color: "#06b6d4"
        });
        state.bullets.push({
          id: Math.random().toString(),
          x: state.player.x + 18,
          y: state.player.y - 3,
          vx: 4.5,
          vy: -10,
          width: 4,
          height: 14,
          damage: baseDamage * 0.6,
          isPlayer: true,
          color: "#06b6d4"
        });
      }
    }

    // -------------------------------------------------------------
    // ENEMY SPAWNER CYCLE (Procedural interval generation)
    // -------------------------------------------------------------
    if (state.enemySpawnTimer > 0) {
      // Dynamic difficulty influence: reduce spawn times as threat level spikes!
      const baseSpawnIntervalCount = 140 - (state.stage * 15);
      const scaledSpawnInterval = Math.max(30, Math.round(baseSpawnIntervalCount / state.threatIndex));
      
      state.enemySpawnTimer--;
      if (state.enemySpawnTimer <= 0 && !state.boss && state.warningTimer === 0) {
        triggerProceduralWave();
        state.enemySpawnTimer = scaledSpawnInterval;
      }
    }

    // -------------------------------------------------------------
    // ENEMY PROCEDURAL MOTION & AUTOMATED FLIGHT & FIRING
    // -------------------------------------------------------------
    state.enemies.forEach(enemy => {
      // Basic movement vector
      if (enemy.type === "SWARM") {
        // Fly in a beautiful sinusoidal wave formation
        enemy.patternTimer += 0.055;
        enemy.x += Math.cos(enemy.patternTimer) * 3.5;
        enemy.y += enemy.vy;
      } else if (enemy.type === "INTERCEPTOR") {
        // Fast diagonal flight
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;
      } else if (enemy.type === "SCOUT") {
        // Wavering scouts drifting left and right
        enemy.patternTimer += 0.02;
        enemy.x += Math.sin(enemy.patternTimer) * 1.5;
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;
      } else {
        // Standard vertical drift for heavy craft
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;
      }

      // Flanking drift limits
      if (enemy.x < enemy.width / 2 || enemy.x > logicalWidth - enemy.width / 2) {
        enemy.vx = -enemy.vx; // bounce screen borders
      }

      // Jet sparks for heavy vessels too!
      if (state.runTimer % 8 === 0) {
        state.particles.push({
          id: Math.random().toString(),
          type: "THRUSTER",
          x: enemy.x,
          y: enemy.y - enemy.height / 2,
          vx: (Math.random() * 2 - 1) * 0.3,
          vy: -Math.random() * 2 - 1.5, // engine plume shoots upward
          size: Math.random() * 2 + 1,
          color: enemy.color,
          alpha: 0.6,
          decay: 0.07
        });
      }

      // Automated Weapon targeting & cooldown triggers
      if (enemy.fireCooldown > 0) {
        // Cooldown reduced faster at higher dynamic difficulty scaling
        enemy.fireCooldown -= 1 * state.threatIndex;
      } else {
        // Shoot! Cooldown interval tracks threat speed
        enemy.fireCooldown = 90 / enemy.fireRate; // restore cooldown
        
        let laserSpeed = 4.2 + (state.stage * 0.6);
        // Scaled by difficulty too!
        laserSpeed *= (1.0 + (state.threatIndex - 1.0) * 0.15);

        SoundSynth.playLaserSound(false);

        if (enemy.type === "CRUISER") {
          // Double targeting forward lasers
          state.bullets.push({
            id: Math.random().toString(),
            x: enemy.x - 10,
            y: enemy.y + 10,
            vx: 0,
            vy: laserSpeed,
            width: 4,
            height: 12,
            damage: 15,
            isPlayer: false,
            color: "#f59e0b"
          });
          state.bullets.push({
            id: Math.random().toString(),
            x: enemy.x + 10,
            y: enemy.y + 10,
            vx: 0,
            vy: laserSpeed,
            width: 4,
            height: 12,
            damage: 15,
            isPlayer: false,
            color: "#f59e0b"
          });
        } else if (enemy.type === "BOMBER") {
          // Purple burst ball
          state.bullets.push({
            id: Math.random().toString(),
            x: enemy.x,
            y: enemy.y + 15,
            vx: 0,
            vy: laserSpeed * 0.75, // bomber bullets are heavy but travel slower
            width: 8,
            height: 8,
            damage: 25,
            isPlayer: false,
            color: "#a855f7",
            isMissile: false // custom splits on hit
          });
        } else {
          // Simple single forward red laser target shot
          state.bullets.push({
            id: Math.random().toString(),
            x: enemy.x,
            y: enemy.y + enemy.height / 2,
            vx: 0,
            vy: laserSpeed,
            width: 4,
            height: 12,
            damage: 10,
            isPlayer: false,
            color: "#ef4444"
          });
        }
      }
    });

    // Remove enemies drifted past screen bounds (no score)
    const originalCount = state.enemies.length;
    state.enemies = state.enemies.filter(enemy => enemy.y < logicalHeight + 50);
    if (state.enemies.length < originalCount) {
      // Small index reduction since enemies slipped screen (slight challenge drop)
      state.threatIndex = Math.max(0.55, state.threatIndex - 0.02);
    }

    // -------------------------------------------------------------
    // BOSS FIGHT PATTERNS & ATTACKS STATE MACHINE
    // -------------------------------------------------------------
    if (state.boss) {
      const boss = state.boss;
      boss.stateTimer++;

      if (boss.isFlashing > 0) boss.isFlashing--;

      // Move toward initial entry point or general hover slots
      const dx = boss.targetX - boss.x;
      const dy = boss.targetY - boss.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist > 5) {
        boss.x += (dx / dist) * boss.vy;
        boss.y += (dy / dist) * boss.vy;
      } else {
        // Change flight targets randomly every 120-200 ticks
        if (boss.stateTimer % 180 === 0 && boss.hp > 0) {
          boss.targetX = Math.random() * (logicalWidth - 240) + 120;
          boss.targetY = Math.random() * 100 + 100;
          
          // Speed up slightly if injured
          const hpRatio = boss.hp / boss.maxHp;
          boss.vy = hpRatio < 0.4 ? 2.5 : 1.5;

          // Toggle patterns
          boss.activePattern = boss.activePattern === 0 ? 1 : 0;
        }
      }

      // Decaying shield indicator
      if (boss.shieldActive && state.runTimer % 150 === 0 && state.stage === 3 && boss.hp > 0) {
        // toggle shell barrier for protection
        addScreenShake(2);
      }

      // Shoot patterns based on Boss type
      if (boss.hp > 0 && dist <= 20) {
        const stageNum = state.stage;
        const cooldownDivider = state.threatIndex; // higher threat = much faster bullet bursts!

        if (stageNum === 1) {
          // -------------------------------------------------
          // STAGE 1 BOSS: ORBITAL NEMESIS
          // -------------------------------------------------
          if (boss.activePattern === 0) {
            // Pattern A: Spiral Ring Stream
            const spiralInterval = Math.max(12, Math.floor(25 / cooldownDivider));
            if (boss.stateTimer % spiralInterval === 0) {
              SoundSynth.playLaserSound(false);
              const bulletAngle = (boss.stateTimer * 0.06) % (Math.PI * 2);
              const numProjectiles = 8;
              
              for (let i = 0; i < numProjectiles; i++) {
                const angle = bulletAngle + (i * ((Math.PI * 2) / numProjectiles));
                const bSpeed = 5.2;
                state.bullets.push({
                  id: Math.random().toString(),
                  x: boss.x,
                  y: boss.y + 15,
                  vx: Math.cos(angle) * bSpeed,
                  vy: Math.sin(angle) * bSpeed,
                  width: 5,
                  height: 5,
                  damage: 10,
                  isPlayer: false,
                  color: "#ef4444" // red core
                });
              }
            }
          } else {
            // Pattern B: Target spreads
            const spreadInterval = Math.max(30, Math.floor(55 / cooldownDivider));
            if (boss.stateTimer % spreadInterval === 0) {
              SoundSynth.playLaserSound(false);
              
              // Angle targeting player
              const pAngle = Math.atan2(state.player.y - boss.y, state.player.x - boss.x);
              const shots = 5;
              const bSpeed = 6.2;

              for (let i = 0; i < shots; i++) {
                const spreadAngle = pAngle + (i - 2) * 0.15;
                state.bullets.push({
                  id: Math.random().toString(),
                  x: boss.x + (i - 2) * 12,
                  y: boss.y + 20,
                  vx: Math.cos(spreadAngle) * bSpeed,
                  vy: Math.sin(spreadAngle) * bSpeed,
                  width: 4,
                  height: 12,
                  damage: 12,
                  isPlayer: false,
                  color: "#f59e0b"
                });
              }
            }
          }
        } else if (stageNum === 2) {
          // -------------------------------------------------
          // STAGE 2 BOSS: VOID SHADOW
          // -------------------------------------------------
          if (boss.activePattern === 0) {
            // Cloaking/Teleportation pattern (dramatic retro mechanic!)
            if (boss.stateTimer % 120 === 0) {
              // Fade out / particle burst
              createExplosionParticles(boss.x, boss.y, "#06b6d4", 15, "MEDIUM");
              SoundSynth.playHitSound(true);
              
              // Re-warp to random horizontal coordinate instantly
              boss.x = Math.random() * (logicalWidth - 200) + 100;
              boss.y = -40; // drop from sky
              boss.targetY = Math.random() * 80 + 100;
              
              // Flare immediate ring burst
              SoundSynth.playLaserSound(false);
              const prCount = 18;
              for (let i = 0; i < prCount; i++) {
                const angle = (i * Math.PI * 2) / prCount;
                state.bullets.push({
                  id: Math.random().toString(),
                  x: boss.x,
                  y: boss.targetY,
                  vx: Math.cos(angle) * 6.0,
                  vy: Math.sin(angle) * 6.0,
                  width: 5,
                  height: 5,
                  damage: 10,
                  isPlayer: false,
                  color: "#06b6d4" // cool cyan
                });
              }
            }
          } else {
            // Rapid high velocity targeting lasers
            const shootInterval = Math.max(10, Math.floor(18 / cooldownDivider));
            if (boss.stateTimer % shootInterval === 0) {
              SoundSynth.playLaserSound(false);
              const angleOffset = Math.sin(boss.stateTimer * 0.15) * 0.25;
              state.bullets.push({
                id: Math.random().toString(),
                x: boss.x - 20,
                y: boss.y + 10,
                vx: angleOffset * 4.5,
                vy: 7.5,
                width: 5,
                height: 16,
                damage: 8,
                isPlayer: false,
                color: "#10b981" // green streams
              });
              state.bullets.push({
                id: Math.random().toString(),
                x: boss.x + 20,
                y: boss.y + 10,
                vx: -angleOffset * 4.5,
                vy: 7.5,
                width: 5,
                height: 16,
                damage: 8,
                isPlayer: false,
                color: "#10b981"
              });
            }
          }
        } else if (stageNum === 3) {
          // -------------------------------------------------
          // STAGE 3 BOSS: SYSTEM DESTROYER (HEAVY FORT)
          // -------------------------------------------------
          if (boss.activePattern === 0) {
            // Pattern A: Launch slow Homing plasma rockets that target player on double flanks!
            const rocketInterval = Math.max(45, Math.floor(85 / cooldownDivider));
            if (boss.stateTimer % rocketInterval === 0) {
              SoundSynth.playHeavyLaserSound();
              // Port Missile
              state.bullets.push({
                id: Math.random().toString(),
                x: boss.x - 30,
                y: boss.y + 25,
                vx: (state.player.x - (boss.x - 30)) * 0.018, // lead velocity
                vy: 2.8, 
                width: 13,
                height: 13,
                damage: 30, // deals extreme damage!
                isPlayer: false,
                color: "#ff007f", // hot neon magenta rocket core
                isMissile: true,
                angle: Math.PI / 2
              });
              // Starboard Missile
              state.bullets.push({
                id: Math.random().toString(),
                x: boss.x + 30,
                y: boss.y + 25,
                vx: (state.player.x - (boss.x + 30)) * 0.018, // lead velocity
                vy: 2.8,
                width: 13,
                height: 13,
                damage: 30, // deals extreme damage!
                isPlayer: false,
                color: "#ff007f", // hot neon magenta rocket core
                isMissile: true,
                angle: Math.PI / 2
              });
            }
          } else {
            // Pattern B: Charged System Wipe Sweep!
            // Boss charges, rendering flashing visual sweep lines, then unleashes down laser!
            if (boss.beamCharge === 0 && boss.stateTimer % 180 === 0) {
              boss.beamCharge = 1; // start charging
              SoundSynth.playBossSiren();
            }

            if (boss.beamCharge > 0) {
              boss.beamCharge++;
              if (boss.beamCharge > 60) {
                // Charge complete! Shoot sweeping death laser center
                boss.beamCharge = 0; // reset
                addScreenShake(18);
                SoundSynth.playExplosionSound("MEDIUM");

                // Spawn a grid cluster of heavy horizontal expanding lasers (11 streams of heavy laser fire!)
                const projectileStreams = 11;
                for (let i = 0; i < projectileStreams; i++) {
                  const xOffset = (i - 5) * 30;
                  state.bullets.push({
                    id: Math.random().toString(),
                    x: boss.x + xOffset,
                    y: boss.y + 35,
                    vx: xOffset * 0.055,
                    vy: 8.5,
                    width: 8,
                    height: 24,
                    damage: 22,
                    isPlayer: false,
                    color: "#f43f5e"
                  });
                }
              }
            }
          }
        }
      }

      // Sync mirroring state
      setBossHp(Math.max(0, boss.hp));

      // Handle boss defeat dramatic slow explosion cascading!
      if (boss.hp <= 0) {
        state.bossDefeatTimer++;
        addScreenShake(3);

        if (state.bossDefeatTimer % 10 === 0) {
          // Play programmatic rumbles
          SoundSynth.playExplosionSound(state.bossDefeatTimer > 100 ? "BOSS" : "LARGE");
          // Multi-color combustions on coordinates of boss hull
          const randX = boss.x + (Math.random() * boss.width - boss.width / 2);
          const randY = boss.y + (Math.random() * boss.height - boss.height / 2);
          createExplosionParticles(randX, randY, Math.random() > 0.5 ? "#ff9f1c" : boss.activePattern === 0 ? "#f43f5e" : "#06b6d4", 16, "LARGE");
        }

        if (state.bossDefeatTimer > 130) {
          // Boss finally eliminated! Drop massive upgrade crates!
          for (let k = 0; k < 18; k++) {
            state.collectibles.push({
              id: Math.random().toString(),
              type: "SCRAP",
              x: boss.x + (Math.random() * 80 - 40),
              y: boss.y + (Math.random() * 60 - 30),
              vx: Math.random() * 5 - 2.5,
              vy: -Math.random() * 4 - 1,
              width: 15,
              height: 15,
              value: 120 + Math.floor(Math.random() * 50)
            });
          }

          // Force drops a hyper weapon upgrade core and full healing
          state.collectibles.push({
            id: Math.random().toString(),
            type: "WEAPON_POWERUP",
            x: boss.x,
            y: boss.y,
            vx: 0,
            vy: -2,
            width: 18,
            height: 18,
            value: 1
          });

          state.collectibles.push({
            id: Math.random().toString(),
            type: "HEAL",
            x: boss.x - 30,
            y: boss.y,
            vx: -1.0,
            vy: -1.5,
            width: 18,
            height: 18,
            value: 50 // Boost healing amount to help players fully recover!
          });

          state.collectibles.push({
            id: Math.random().toString(),
            type: "SHIELD_RESTORE",
            x: boss.x + 30,
            y: boss.y,
            vx: 1.0,
            vy: -1.5,
            width: 18,
            height: 18,
            value: 50 // Recharges shields so user can brace next waves
          });

          // Stage advance logic!
          const nextStage = state.stage + 1;
          state.boss = null;
          setBossActive(false);
          SoundSynth.bossActive = false;

          if (nextStage > state.maxStages) {
            // Whole game completed successfully!
            state.isVictory = true;
            SoundSynth.stopMusic();
            SoundSynth.playVictorySound();
            
            // Call end game with final metrics
            onGameEnd(state.score, state.scrapCollected, true);
          } else {
            // Advance Stage! Play short stage victory sound
            SoundSynth.playVictorySound();
            state.stage = nextStage;
            setStage(nextStage);
            state.progress = 0; // reset progression loop
            setProgress(0);
            state.threatIndex = Math.min(3.0, state.threatIndex + 0.15); // difficulty step up
            setThreatIndex(state.threatIndex);
          }
          state.bossDefeatTimer = 0;
        }
      }
    }

    // -------------------------------------------------------------
    // PROJECTILES MOVEMENT & BOUNDARY LIFECYCLES
    // -------------------------------------------------------------
    state.bullets.forEach(bullet => {
      if (bullet.isMissile && !bullet.isPlayer) {
        // Homing behavior: adjust trajectories toward player coordinates!
        const dx = state.player.x - bullet.x;
        const dy = state.player.y - bullet.y;
        const dAngle = Math.atan2(dy, dx);
        
        // slowly rotate velocity vectors
        bullet.vx = bullet.vx * 0.94 + Math.cos(dAngle) * 0.28;
        bullet.vy = bullet.vy * 0.94 + Math.sin(dAngle) * 0.28;
        bullet.angle = Math.atan2(bullet.vy, bullet.vx);
      }

      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
    });

    // Filter off-screen projectiles
    state.bullets = state.bullets.filter(b => b.y > -40 && b.y < logicalHeight + 40 && b.x > -40 && b.x < logicalWidth + 40);

    // -------------------------------------------------------------
    // COLLECTIBLES ATTRACTOR & MAGNET PHYSICS
    // -------------------------------------------------------------
    state.collectibles.forEach(item => {
      // Magnetic Harvest radius calculation (based on permanent upgrades level)
      // Base radius = 60, adding 35px for each permanent magneticHarvester level upgrades
      const magnetRadius = UPGRADE_METADATA.magneticHarvester.valueBase + (upgrades.magneticHarvester * UPGRADE_METADATA.magneticHarvester.valuePerLevel);

      const dx = state.player.x - item.x;
      const dy = state.player.y - item.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < magnetRadius) {
        // Pull smoothly with high acceleration inside gravity field
        const pullSpeed = 6.5;
        item.vx = (dx / dist) * pullSpeed;
        item.vy = (dy / dist) * pullSpeed;
      } else {
        // Standard gentle drift downwards
        item.vx *= 0.96;
        item.vy = 1.6;
      }

      item.x += item.vx;
      item.y += item.vy;
    });

    // Remove missed items falling below bounds
    state.collectibles = state.collectibles.filter(item => item.y < logicalHeight + 35);

    // -------------------------------------------------------------
    // PARTICLES MOVEMENT & LIFECYCLE FADING
    // -------------------------------------------------------------
    state.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.growth) {
        p.size += p.growth;
      }
    });

    state.particles = state.particles.filter(p => p.alpha > 0.01);
  };

  // Check Collision envelopes (rect bounds overlap)
  const checkCollisions = () => {
    const state = gameStateRef.current;
    if (state.paused || state.isGameOver || state.isVictory) return;

    // A. Player bullets hitting minor Enemies
    state.bullets.forEach(bullet => {
      if (!bullet.isPlayer) return;

      // Hit enemy hulls
      state.enemies.forEach(enemy => {
        if (enemy.hp <= 0) return;

        // Check rect match
        if (
          bullet.x + bullet.width > enemy.x - enemy.width / 2 &&
          bullet.x - bullet.width < enemy.x + enemy.width / 2 &&
          bullet.y + bullet.height > enemy.y - enemy.height / 2 &&
          bullet.y - bullet.height < enemy.y + enemy.height / 2
        ) {
          // Confirmed hit ! Deal damage
          enemy.hp -= bullet.damage;
          
          // sparks splatter
          createExplosionParticles(bullet.x, bullet.y, enemy.color, 4, "SMALL");
          SoundSynth.playHitSound(false);

          // Delete bullet (by sending it far off-screen)
          bullet.y = -1000;

          // Enemy eliminated check
          if (enemy.hp <= 0) {
            enemy.hp = 0;
            state.score += enemy.points;
            setScore(state.score);

            // Large explosion and sound synth rumble
            SoundSynth.playExplosionSound("MEDIUM");
            createExplosionParticles(enemy.x, enemy.y, enemy.color, 12, "MEDIUM");

            // Minor progressive adjustment to Threat Index if not in critical state
            if (state.player.hp / state.player.maxHp > 0.35) {
              state.threatIndex = Math.min(2.5, state.threatIndex + 0.008);
              setThreatIndex(state.threatIndex);
            }

            // Procedural collectible drops: Every single enemy defeat is highly rewarding!
            // 1. Guaranteed Scrap Drop + Scrap Refiner Multiplier
            const refinerMult = UPGRADE_METADATA.scrapRefiner.valueBase + (upgrades.scrapRefiner * UPGRADE_METADATA.scrapRefiner.valuePerLevel);
            let scrapValue = Math.floor(Math.random() * 25) + 15; // 15 to 40 base scrap per kill!
            scrapValue = Math.round(scrapValue * refinerMult);

            state.collectibles.push({
              id: Math.random().toString(),
              type: "SCRAP",
              x: enemy.x,
              y: enemy.y,
              vx: Math.random() * 4 - 2,
              vy: -1.8,
              width: 11,
              height: 11,
              value: scrapValue
            });

            // 2. Extra powerup drops based on survival status:
            const hpRatio = state.player.hp / state.player.maxHp;
            const shieldRatio = state.player.shield / state.player.maxShield;
            const isCritical = hpRatio <= 0.35 || state.player.hp < 30;

            let dropType: "HEAL" | "WEAPON_POWERUP" | "SHIELD_RESTORE" | null = null;

            if (isCritical) {
              // Guaranteed extra recovery drop under critical state!
              if (shieldRatio <= 0.20) {
                // Low shield -> prioritize shield recovery
                const r = Math.random();
                if (r < 0.70) dropType = "SHIELD_RESTORE";
                else if (r < 0.92) dropType = "HEAL";
                else dropType = "WEAPON_POWERUP";
              } else if (hpRatio <= 0.25) {
                // Low health -> prioritize energy recovery (HEAL)
                const r = Math.random();
                if (r < 0.70) dropType = "HEAL";
                else if (r < 0.92) dropType = "SHIELD_RESTORE";
                else dropType = "WEAPON_POWERUP";
              } else {
                // General emergency distribution (equal heals/shields support)
                const r = Math.random();
                if (r < 0.45) dropType = "HEAL";
                else if (r < 0.90) dropType = "SHIELD_RESTORE";
                else dropType = "WEAPON_POWERUP";
              }
            } else {
              // High chance (60%) of extra recovery/powerup drops in normal gameplay
              const luckyChance = Math.random();
              if (luckyChance < 0.60) {
                const rType = Math.random();
                if (rType < 0.35) {
                  dropType = "SHIELD_RESTORE";
                } else if (rType < 0.70) {
                  dropType = "HEAL";
                } else {
                  dropType = "WEAPON_POWERUP";
                }
              }
            }

            if (dropType) {
              let itemValue = 35; // boost recovery values for faster comeback
              if (dropType === "WEAPON_POWERUP") {
                itemValue = 1;
              }

              state.collectibles.push({
                id: Math.random().toString(),
                type: dropType,
                x: enemy.x + (Math.random() * 24 - 12),
                y: enemy.y - 10,
                vx: Math.random() * 2 - 1.0,
                vy: -2.2,
                width: 12,
                height: 12,
                value: itemValue
              });
            }
          }
        }
      });

      // Hit active Boss
      if (state.boss && state.boss.hp > 0) {
        const boss = state.boss;
        
        // Rect overlap on boss coordinate boundaries
        if (
          bullet.x + bullet.width > boss.x - boss.width / 2 &&
          bullet.x - bullet.width < boss.x + boss.width / 2 &&
          bullet.y + bullet.height > boss.y - boss.height / 2 &&
          bullet.y - bullet.height < boss.y + boss.height / 2
        ) {
          bullet.y = -1000; // eliminate bullet
          
          if (boss.shieldActive) {
            // Shield absorbs shot! Play neon metallic sparks
            SoundSynth.playHitSound(true);
            createShieldHitParticles(bullet.x, bullet.y, 5);
            addScreenShake(0.5);
            
            // Slowly wear down boss shielding
            if (state.stage === 3 && Math.random() > 0.9) {
              boss.shieldActive = false; // break shield briefly
              addScreenShake(3);
              SoundSynth.playExplosionSound("SMALL");
            }
          } else {
            // Bullet cuts into boss armor plating!
            boss.hp -= bullet.damage;
            boss.isFlashing = 4; // micro highlight frame
            SoundSynth.playHitSound(false);
            createExplosionParticles(bullet.x, bullet.y, Math.random() > 0.5 ? "#f1c40f" : "#e74c3c", 4, "SMALL");
            addScreenShake(0.7);
          }
        }
      }
    });

    // B. Enemy bullets hitting player hull/shielding
    state.bullets.forEach(bullet => {
      if (bullet.isPlayer) return;

      if (
        bullet.x + bullet.width > state.player.x - state.player.width / 2 &&
        bullet.x - bullet.width < state.player.x + state.player.width / 2 &&
        bullet.y + bullet.height > state.player.y - state.player.height / 2 &&
        bullet.y - bullet.height < state.player.y + state.player.height / 2
      ) {
        // Bullet hit player!
        bullet.y = 10000; // delete bullet
        damagePlayer(bullet.damage);
      }
    });

    // C. Physical ship-to-ship hull crashes (Extreme damage collision!)
    state.enemies.forEach(enemy => {
      if (enemy.hp <= 0) return;

      if (
        enemy.x + enemy.width / 1.5 > state.player.x - state.player.width / 1.5 &&
        enemy.x - enemy.width / 1.5 < state.player.x + state.player.width / 1.5 &&
        enemy.y + enemy.height / 1.5 > state.player.y - state.player.height / 1.5 &&
        enemy.y - enemy.height / 1.5 < state.player.y + state.player.height / 1.5
      ) {
        // CRASH BLAST! Deal extreme damage to player and eliminate minor enemy!
        createExplosionParticles(enemy.x, enemy.y, enemy.color, 15, "MEDIUM");
        SoundSynth.playExplosionSound("LARGE");
        enemy.hp = 0; // eliminate enemy instantly

        addScreenShake(12);
        damagePlayer(35); // heavy crash hit
      }
    });

    // D. Boss physical contact collision
    if (state.boss && state.boss.hp > 0) {
      const boss = state.boss;
      if (
        boss.x + boss.width / 2 > state.player.x - state.player.width / 1.8 &&
        boss.x - boss.width / 2 < state.player.x + state.player.width / 1.8 &&
        boss.y + boss.height / 2 > state.player.y - state.player.height / 1.8 &&
        boss.y - boss.height / 2 < state.player.y + state.player.height / 1.8
      ) {
        damagePlayer(2.0); // incremental warning hit while touching boss skin
        addScreenShake(1.5);
      }
    }

    // E. Player collecting floating drop-items
    state.collectibles.forEach(item => {
      if (
        item.x + item.width > state.player.x - state.player.width / 2 &&
        item.x - item.width < state.player.x + state.player.width / 2 &&
        item.y + item.height > state.player.y - state.player.height / 2 &&
        item.y - item.height < state.player.y + state.player.height / 2
      ) {
        // Collect! Delete from field
        item.y = 10000;

        if (item.type === "SCRAP") {
          // Play metallic chime
          SoundSynth.playScrapCollectSound();
          state.scrapCollected += item.value;
          state.score += item.value * 20; // score bonus
          setScrapCollected(state.scrapCollected);
          setScore(state.score);

          // Float scrap chime particle
          state.particles.push({
            id: Math.random().toString(),
            type: "HEAL",
            x: item.x,
            y: item.y - 10,
            vx: 0,
            vy: -1.2,
            size: 3,
            color: "#10b981", // fluorescent green money drift
            alpha: 1.0,
            decay: 0.045
          });
        } 
        else if (item.type === "HEAL") {
          SoundSynth.playPowerUpSound();
          state.player.hp = Math.min(state.player.maxHp, state.player.hp + item.value);
          setHp(Math.floor(state.player.hp));

          // Generate green cross sparkles
          state.particles.push({
            id: Math.random().toString(),
            type: "HEAL",
            x: state.player.x,
            y: state.player.y,
            vx: 0,
            vy: -1.5,
            size: 4,
            color: "#f43f5e",
            alpha: 1.0,
            decay: 0.035
          });
        } 
        else if (item.type === "SHIELD_RESTORE") {
          SoundSynth.playPowerUpSound();
          state.player.shield = Math.min(state.player.maxShield, state.player.shield + item.value);
          setShield(Math.floor(state.player.shield));

          // Cyan sparkles
          state.particles.push({
            id: Math.random().toString(),
            type: "HEAL",
            x: state.player.x,
            y: state.player.y,
            vx: 0,
            vy: -1.5,
            size: 4,
            color: "#22d3ee",
            alpha: 1.0,
            decay: 0.035
          });
        } 
        else if (item.type === "WEAPON_POWERUP") {
          SoundSynth.playPowerUpSound();
          // Boost temporary gun configuration within this run, max 4 barrels!
          state.player.weaponPowerLevel = Math.min(4, state.player.weaponPowerLevel + 1);
          setWeaponLevel(state.player.weaponPowerLevel);

          // Golden glow spikes
          for (let s = 0; s < 12; s++) {
            const angle = (s * Math.PI * 2) / 12;
            state.particles.push({
              id: Math.random().toString(),
              type: "SPARK",
              x: state.player.x,
              y: state.player.y,
              vx: Math.cos(angle) * 4.5,
              vy: Math.sin(angle) * 4.5,
              size: 5,
              color: "#eab308", // gold burst
              alpha: 1.0,
              decay: 0.035
            });
          }
        }
      }
    });
  };

  // Inflict damage to Player Ship (drains energy shields first, splits to hull structural integrity)
  const damagePlayer = (dmg: number) => {
    const state = gameStateRef.current;
    if (state.paused || state.isGameOver || state.isVictory) return;

    state.player.hitFlash = 6; // flash hull silver white
    state.player.shieldRegenCooldown = 150; // pause active shield recharge for 2.5 seconds on damage hit

    addScreenShake(dmg * 0.45);

    if (Capacitor.isNativePlatform()) {
      Haptics.impact({
        style: state.player.shield > 0 ? ImpactStyle.Light : ImpactStyle.Heavy,
      }).catch(() => {});
    }

    if (state.player.shield > 0) {
      // shield is active! play electronic shield hit sound and visual cyan sparks
      SoundSynth.playHitSound(true);
      createShieldHitParticles(state.player.x, state.player.y - 10, 8);

      state.player.shield -= dmg;
      if (state.player.shield < 0) {
        const structuralLeak = Math.abs(state.player.shield);
        state.player.shield = 0;
        state.player.hp -= structuralLeak; // bleed over to hull integrity
      }
    } else {
      // Hull metal armor takes direct critical heat! Play deep hit chiptune and combust small spark cluster
      SoundSynth.playHitSound(false);
      createExplosionParticles(state.player.x, state.player.y - 5, "#f43f5e", 5, "SMALL");
      state.player.hp -= dmg;
    }

    // Mirroring values to react indicators
    setShield(Math.floor(state.player.shield));
    setHp(Math.floor(Math.max(0, state.player.hp)));

    // Adjust threat factor down slightly to help players struggling with direct hits!
    state.threatIndex = Math.max(0.55, state.threatIndex - 0.08);
    setThreatIndex(state.threatIndex);

    // Structural Annihilation (Defeat state check)
    if (state.player.hp <= 0) {
      state.player.hp = 0;
      state.isGameOver = true;
      SoundSynth.stopMusic();
      SoundSynth.playDefeatSound();

      // Trigger gigantic terminal chain combustion particles around vessel coords!
      createExplosionParticles(state.player.x, state.player.y, "#ff7000", 30, "LARGE");
      addScreenShake(20);

      // Complete run with callbacks!
      setTimeout(() => {
        onGameEnd(state.score, state.scrapCollected, false);
      }, 1500);
    }
  };

  // Perform pure HTML5 Canvas drawing (called at 60fps)
  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = gameStateRef.current;

    ctx.save();

    // Clean background fill
    ctx.fillStyle = "#020617"; // deep high-contrast night sky
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    // Apply intense retro CRT screen shake translations
    if (state.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * state.screenShake;
      const shakeY = (Math.random() - 0.5) * state.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Draw Parallax Stars background
    state.stars.forEach(star => {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });

    // 2. Draw Collectibles
    state.collectibles.forEach(item => {
      ctx.save();
      ctx.translate(item.x, item.y);
      
      const rSize = item.width / 2;

      if (item.type === "SCRAP") {
        // Spin coin rotating glowing polygon
        const glowCycle = (state.runTimer * 0.08) % (Math.PI * 2);
        ctx.strokeStyle = "#10b981";
        ctx.fillStyle = "#34d399";
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const angle = (s * Math.PI) / 3 + glowCycle;
          const sx = Math.cos(angle) * rSize;
          const sy = Math.sin(angle) * rSize * 0.8; // flatter isometric circle
          if (s === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // mini metallic central dot
        ctx.fillStyle = "#064e3b";
        ctx.beginPath();
        ctx.arc(0, 0, rSize * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } 
      else if (item.type === "HEAL") {
        // Red medical cross box element
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(-rSize, -rSize, item.width, item.height);
        
        // white cross bar
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-rSize + 2, -1.5, item.width - 4, 3);
        ctx.fillRect(-1.5, -rSize + 2, 3, item.height - 4);
      } 
      else if (item.type === "SHIELD_RESTORE") {
        // Neon cyan dynamic energy crystal shape
        ctx.fillStyle = "#06b6d4";
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.moveTo(0, -rSize);
        ctx.lineTo(rSize, 0);
        ctx.lineTo(0, rSize);
        ctx.lineTo(-rSize, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } 
      else if (item.type === "WEAPON_POWERUP") {
        // Glowing gold nuclear lightning token elements
        ctx.fillStyle = "#d97706";
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2.0;

        ctx.beginPath();
        ctx.arc(0, 0, rSize, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(-1, -rSize + 3);
        ctx.lineTo(3, -1);
        ctx.lineTo(0, 0);
        ctx.lineTo(2, rSize - 4);
        ctx.lineTo(-3, 1);
        ctx.lineTo(-1, 0);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    });

    // 3. Draw All Projectiles
    state.bullets.forEach(b => {
      ctx.save();
      ctx.translate(b.x, b.y);

      if (b.isMissile) {
        // Draw rotating heavy homing missiles
        ctx.rotate(b.angle || 0);
        
        // Thruster smoke tail
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(-b.width - 3, -2, 4, 4);

        // Rocket body
        ctx.fillStyle = "#d97706";
        ctx.beginPath();
        ctx.moveTo(-b.width, -b.height/2);
        ctx.lineTo(b.width/2, -b.height/2);
        ctx.lineTo(b.width, 0);
        ctx.lineTo(b.width/2, b.height/2);
        ctx.lineTo(-b.width, b.height/2);
        ctx.closePath();
        ctx.fill();

        // Nuclear warning tip
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(b.width/2, 0, 3, 0, Math.PI*2);
        ctx.fill();
      } else {
        // Direct vertical arcade laser streaks
        ctx.fillStyle = b.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = b.color; // neon arcade bloom glow
        
        ctx.beginPath();
        ctx.roundRect(-b.width/2, -b.height/2, b.width, b.height, 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 4. Draw Minor Procedural Enemies
    state.enemies.forEach(enemy => {
      if (enemy.hp <= 0) return;

      ctx.save();
      ctx.translate(enemy.x, enemy.y);

      const w = enemy.width;
      const h = enemy.height;
      const halfW = w / 2;
      const halfH = h / 2;

      // Draw distinctive pixel design vectors
      ctx.fillStyle = enemy.color;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;

      if (enemy.type === "SWARM") {
        // Curved wing starfighter
        ctx.beginPath();
        ctx.moveTo(0, halfH);
        ctx.lineTo(halfW, -halfH);
        ctx.lineTo(halfW * 0.3, -halfH * 0.2);
        ctx.lineTo(0, -halfH * 0.6);
        ctx.lineTo(-halfW * 0.3, -halfH * 0.2);
        ctx.lineTo(-halfW, -halfH);
        ctx.closePath();
        ctx.fill();
      } 
      else if (enemy.type === "SCOUT") {
        // Triangular fast stealth ship
        ctx.beginPath();
        ctx.moveTo(0, halfH);
        ctx.lineTo(halfW, -halfH * 0.8);
        ctx.lineTo(0, -halfH * 0.2);
        ctx.lineTo(-halfW, -halfH * 0.8);
        ctx.closePath();
        ctx.fill();

        // Engine glow core
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-2, -halfH, 4, 3);
      } 
      else if (enemy.type === "CRUISER") {
        // Heavy multi-winged blockade tank
        ctx.beginPath();
        ctx.moveTo(0, halfH);
        ctx.lineTo(halfW * 0.5, halfH * 0.6);
        ctx.lineTo(halfW, -halfH * 0.2);
        ctx.lineTo(halfW * 0.8, -halfH);
        ctx.lineTo(-halfW * 0.8, -halfH);
        ctx.lineTo(-halfW, -halfH * 0.2);
        ctx.lineTo(-halfW * 0.5, halfH * 0.6);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Internal reactor engine
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(-8, -halfH + 3, 16, 4);
      } 
      else if (enemy.type === "BOMBER") {
        // Bulky octagonal purple bombardment vessel
        ctx.beginPath();
        ctx.moveTo(0, halfH);
        ctx.lineTo(halfW, halfH * 0.3);
        ctx.lineTo(halfW, -halfH * 0.5);
        ctx.lineTo(halfW * 0.4, -halfH);
        ctx.lineTo(-halfW * 0.4, -halfH);
        ctx.lineTo(-halfW, -halfH * 0.5);
        ctx.lineTo(-halfW, halfH * 0.3);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#00ffff"; // cyan lines accent Bomber
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } 
      else if (enemy.type === "INTERCEPTOR") {
        // Sharp forward-swept arrow wings
        ctx.beginPath();
        ctx.moveTo(0, halfH * 0.8);
        ctx.lineTo(halfW, -halfH * 0.9);
        ctx.lineTo(halfW * 0.2, halfH * 0.1);
        ctx.lineTo(0, -halfH * 0.5);
        ctx.lineTo(-halfW * 0.2, halfH * 0.1);
        ctx.lineTo(-halfW, -halfH * 0.9);
        ctx.closePath();
        ctx.fill();
      }

      // Draw Damage health mini-status bars under injured foes
      if (enemy.hp < enemy.maxHp) {
        const barWidth = 26;
        const barHeight = 3;
        const rx = -barWidth / 2;
        const ry = halfH + 8;
        
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(rx, ry, barWidth, barHeight);

        ctx.fillStyle = "#ef4444";
        const healthPct = enemy.hp / enemy.maxHp;
        ctx.fillRect(rx, ry, barWidth * healthPct, barHeight);
      }

      ctx.restore();
    });

    // 5. Draw Massive Boss Cores
    if (state.boss) {
      const boss = state.boss;
      
      ctx.save();
      ctx.translate(boss.x, boss.y);

      // Flash color on damage hits
      if (boss.isFlashing > 0) {
        ctx.fillStyle = "#ffffff"; // pure bright flash
      } else {
        ctx.fillStyle = state.stage === 1 
          ? "#ef4444" // Nemesis structural plating is ruby red
          : state.stage === 2 
          ? "#0f172a" // Void shadow is deep stealth obsidian
          : "#334155"; // System destroyer is metallic armor slate
      }

      const w = boss.width;
      const h = boss.height;

      // Draw custom procedural layouts for bosses
      ctx.beginPath();
      ctx.moveTo(0, h/2);
      ctx.lineTo(w/2, h/4);
      ctx.lineTo(w/2, -h/2);
      ctx.lineTo(w/3, -h/2);
      ctx.lineTo(w/6, -h/3);
      ctx.lineTo(-w/6, -h/3);
      ctx.lineTo(-w/3, -h/2);
      ctx.lineTo(-w/2, -h/2);
      ctx.lineTo(-w/2, h/4);
      ctx.closePath();
      ctx.fill();

      // Border contour outline
      ctx.strokeStyle = state.stage === 1 ? "#ef4444" : state.stage === 2 ? "#10b981" : "#a855f7";
      ctx.lineWidth = boss.isFlashing > 0 ? 3 : 2;
      ctx.stroke();

      // Core cockpit reactor glowing vector
      ctx.fillStyle = boss.isFlashing > 0 
        ? "#ff0000" 
        : state.stage === 1 
        ? "#f59e0b" // Orange glow
        : state.stage === 2 
        ? "#06b6d4" // Ice cyan
        : "#f43f5e"; // hot magenta reactor
      
      ctx.beginPath();
      ctx.arc(0, h/9, 14, 0, Math.PI*2);
      ctx.fill();

      // Giant sweeping thruster jets under the boss core!
      if (boss.hp > 0 && state.runTimer % 6 === 0) {
        state.particles.push({
          id: Math.random().toString(),
          type: "THRUSTER",
          x: boss.x - w/3,
          y: boss.y - h/2,
          vx: 0,
          vy: -3.5,
          size: Math.random() * 5 + 4,
          color: "#fbbf24",
          alpha: 0.8,
          decay: 0.05
        });
        state.particles.push({
          id: Math.random().toString(),
          type: "THRUSTER",
          x: boss.x + w/3,
          y: boss.y - h/2,
          vx: 0,
          vy: -3.5,
          size: Math.random() * 5 + 4,
          color: "#fbbf24",
          alpha: 0.8,
          decay: 0.05
        });
      }

      // Draw revolving active energetic shields on Boss 3
      if (boss.shieldActive && boss.hp > 0) {
        ctx.strokeStyle = "rgba(34, 211, 238, 0.7)";
        ctx.lineWidth = 3;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#22d3ee"; // glowing turquoise barrier

        const shieldRot = state.runTimer * 0.035;

        // Revolving outer arc sectors
        ctx.beginPath();
        ctx.arc(0, 0, w/1.2, shieldRot, shieldRot + Math.PI*0.75);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, w/1.2, shieldRot + Math.PI, shieldRot + Math.PI*1.75);
        ctx.stroke();

        ctx.shadowBlur = 0; // stop shadow bleed immediately
      }

      // Render sweeping warning target grids during charged wipes mapping to Boss 3
      if (boss.beamCharge > 0) {
        const progressNormalized = boss.beamCharge / 60;
        ctx.fillStyle = `rgba(244, 63, 94, ${0.1 + progressNormalized * 0.35})`;
        ctx.fillRect(-w/2, h/2, w, logicalHeight); // fill screen quadrant with threat grid

        // Draw warning targeting lines
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-w/2, h/2);
        ctx.lineTo(-w/2, logicalHeight);
        ctx.moveTo(w/2, h/2);
        ctx.lineTo(w/2, logicalHeight);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 6. Draw Player Ship (Vanguard Class)
    if (state.player.hp > 0) {
      ctx.save();
      ctx.translate(state.player.x, state.player.y);

      const pW = state.player.width;
      const pH = state.player.height;

      // Pulse body colors on hit frames
      if (state.player.hitFlash > 0) {
        ctx.fillStyle = "#ffffff";
      } else {
        // High contrast beautiful neon slate player ship
        ctx.fillStyle = "#1e293b";
      }

      // Main central sharp hull
      ctx.beginPath();
      ctx.moveTo(0, -pH/2);
      ctx.lineTo(pW/2, pH/3);
      ctx.lineTo(pW/4, pH/2);
      ctx.lineTo(0, pH/4);
      ctx.lineTo(-pW/4, pH/2);
      ctx.lineTo(-pW/2, pH/3);
      ctx.closePath();
      ctx.fill();

      // Wing borders and chrome green core decals
      ctx.strokeStyle = "#22c55e"; // Vanguard core color
      ctx.lineWidth = state.player.hitFlash > 0 ? 3.0 : 1.5;
      ctx.stroke();

      // Glowing Cockpit green orb
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(0, -pH/12, 5, 0, Math.PI*2);
      ctx.fill();

      // Thruster flanking wings decals
      ctx.fillStyle = "#475569";
      ctx.fillRect(-pW/2.5, pH/4, 4, 6);
      ctx.fillRect(pW/2.5 - 4, pH/4, 4, 6);

      // Force Field energy shroud overlay
      if (state.player.shield > 0) {
        ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
        ctx.fillStyle = "rgba(34, 211, 238, 0.05)";
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#38bdf8";

        const pulseRange = 4 + Math.sin(state.runTimer * 0.1) * 2;

        ctx.beginPath();
        ctx.arc(0, 0, pW + pulseRange, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0; // reset shading layer immediately
      }

      ctx.restore();
    }

    // 7. Render Spark / Combustion / Healing particles
    state.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.type === "SHIELD_HIT") {
        // glowing arcs
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI, true);
        ctx.fill();
      } 
      else if (p.type === "HEAL") {
        // glowing healing cross shape
        ctx.fillRect(p.x - p.size, p.y - p.size/3, p.size * 2, p.size/1.5);
        ctx.fillRect(p.x - p.size/3, p.y - p.size, p.size/1.5, p.size * 2);
      } 
      else {
        // default organic smoke dots
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    ctx.restore(); // restore global Translate matrices
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-100 font-sans">
      
      {/* Absolute Game Canvas Container */}
      <div 
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          width={logicalWidth}
          height={logicalHeight}
          className="w-full h-full cursor-crosshair"
          id="shmup-canvas"
        />

        {/* ======================================================= */}
        {/* GRAPHICS OVERLAY HUD LAYER (Renders directly above canvas) */}
        {/* ======================================================= */}
        
        {/* Top Header Panel (Score, Stage, Coins) */}
        <div className="absolute top-0 inset-x-0 px-6 py-3 flex items-center justify-between pointer-events-none select-none z-10 font-mono text-xs text-slate-100 bg-gradient-to-b from-black/80 to-transparent">
          
          {/* Active Score */}
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Trophy className="w-3 h-3 text-yellow-500" />
              Pontuação
            </span>
            <span className="font-bold text-base text-yellow-400">{score.toLocaleString()}</span>
          </div>

          {/* Current Stage Indicator */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Fase</span>
            <span className="font-black text-sm text-emerald-400 uppercase tracking-widest">{stage} de 3</span>
          </div>

          {/* Local Accumulated Coins / Scrap */}
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Coins className="w-3 h-3 text-emerald-400" />
              Moedas
            </span>
            <span className="font-bold text-base text-emerald-400">+{scrapCollected.toLocaleString()}</span>
          </div>
        </div>

        {/* Bottom Panel (Player Hull/Shield Bars & Threat level indicator) */}
        <div className="absolute bottom-0 inset-x-0 px-6 py-3 flex flex-col gap-2 pointer-events-none select-none z-10 bg-gradient-to-t from-black/80 to-transparent">
          
          {/* Stage progression indicator */}
          {!bossActive && (
            <div className="w-full flex items-center gap-2 mb-1">
              <span className="text-[9px] text-slate-400 font-mono uppercase shrink-0">Progresso</span>
              <div className="h-1.5 flex-grow bg-slate-900 border border-slate-800 rounded-sm overflow-hidden flex">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-400 font-mono shrink-0">{progress}%</span>
            </div>
          )}

          {/* Threat index CHAOS level gauges */}
          <div className="flex items-center justify-between text-[10px] font-mono border-b border-slate-850 pb-1 mb-1">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
              <span className="text-slate-400 uppercase tracking-wide">Threat Índice:</span>
              <span className={`font-bold uppercase ${
                threatIndex > 2.0 
                  ? "text-rose-500 drop-shadow-[0_0_4px_rgba(244,63,94,0.4)]" 
                  : (hp / maxHp <= 0.35)
                  ? "text-yellow-400 animate-pulse font-extrabold"
                  : threatIndex > 1.5 
                  ? "text-orange-400" 
                  : "text-emerald-400"
              }`}>
                {threatIndex.toFixed(2)}x {hp / maxHp <= 0.35 ? "RECUPERAÇÃO" : threatIndex > 2.2 ? "CAOS" : threatIndex > 1.6 ? "SARGENTO" : "RECRUTA"}
              </span>
            </div>

            {/* Temporary weapon levels indicator */}
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="text-slate-400 uppercase text-[9px] tracking-wider">Mód: Lvl {weaponLevel}</span>
            </div>
          </div>

          {/* Health & Shield Bar Gauges */}
          <div className="grid grid-cols-2 gap-3">
            {/* HP element bar */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[9px] font-mono font-bold text-rose-400">
                <span className="flex items-center gap-1"><Heart className="w-3 h-3 fill-rose-500 text-rose-500" />Casco</span>
                <span>{hp} / {maxHp}</span>
              </div>
              <div className="h-3.5 bg-slate-900 border border-slate-800 rounded-md overflow-hidden p-0.5">
                <div 
                  className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-sm transition-all duration-300"
                  style={{ width: `${(hp / maxHp) * 100}%` }}
                />
              </div>
            </div>

            {/* Shield element bar */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[9px] font-mono font-bold text-cyan-400">
                <span className="flex items-center gap-1"><ShieldIcon className="w-3 h-3 text-cyan-400" />Escudo</span>
                <span>{shield} / {maxShield}</span>
              </div>
              <div className="h-3.5 bg-slate-900 border border-slate-800 rounded-md overflow-hidden p-0.5">
                <div 
                  className="h-full bg-[#06b6d4] shadow-[0_0_8px_rgba(34,211,238,0.5)] rounded-sm transition-all duration-300"
                  style={{ width: `${maxShield > 0 ? (shield / maxShield) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Warning Alert: Boss detected banner */}
        {warningActive && (
          <div className="absolute top-1/3 inset-x-0 flex flex-col items-center justify-center bg-red-950/80 border-y-2 border-red-500 py-6 pointer-events-none select-none z-20 animate-pulse">
            <ShieldAlert className="w-12 h-12 text-red-500 mb-2 animate-[spin_2s_infinite]" />
            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-red-500 font-mono tracking-widest text-center uppercase">
              ALERTA: AMEAÇA ENORME DETECTADA!
            </span>
            <span className="text-[11px] font-bold text-red-400 font-mono tracking-widest text-center uppercase mt-1">
              PROXIMIDADE CRÍTICA DO CHEFE DE FASE
            </span>
          </div>
        )}

        {/* Active Boss Health bar (only visible if Boss is spawned) */}
        {bossActive && !warningActive && (
          <div className="absolute top-12 inset-x-0 px-6 py-2 flex flex-col items-center pointer-events-none select-none z-10 bg-black/50 backdrop-blur-xs border-b border-rose-950/55 rounded-b-xl">
            <span className="text-[10px] font-bold font-mono text-rose-400 uppercase tracking-widest mb-1 animate-pulse">
              ⚠️ {bossName} ⚠️
            </span>
            <div className="w-full h-3 bg-slate-950 border border-rose-800/50 rounded-full p-0.5 relative">
              <div 
                className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-red-600 rounded-full transition-all duration-150"
                style={{ width: `${(bossHp / bossMaxHp) * 100}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] font-black leading-none text-white drop-shadow-[1px_1px_rgba(0,0,0,0.8)]">
                {bossHp} / {bossMaxHp} HP
              </span>
            </div>
          </div>
        )}

        {/* HUD Quick Pause Button / Overlay indicator */}
        <button
          onClick={togglePause}
          className="absolute top-3 left-1/2 transform -translate-x-1/2 z-20 px-3 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 border-slate-700 text-[10px] text-slate-300 rounded font-mono uppercase tracking-widest transition-colors cursor-pointer"
        >
          {paused ? "Iniciar ▶" : "Pausar ‖"}
        </button>

        {/* Game Paused Overlay screen */}
        {paused && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center z-15 select-none z-20">
            <h2 className="text-2xl font-black text-[#22c55e] font-mono tracking-widest uppercase mb-2 animate-pulse">
              Jogo Pausado
            </h2>
            <p className="text-slate-400 text-xs text-center font-mono max-w-xs mb-6 px-4">
              Configurações em suspensão temporária.
            </p>
            <button
              onClick={togglePause}
              className="px-6 py-2 bg-[#22c55e] text-slate-950 font-bold uppercase rounded-lg text-xs tracking-wider transition-all hover:bg-emerald-400 shadow-[0_0_15px_rgba(34,197,94,0.3)] active:scale-95"
            >
              Retornar à Batalha
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
