import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { TQL } from './content-store';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCwIcon,
  BrainCircuitIcon,
  RotateCcwIcon, 
  PlayIcon, 
  PauseIcon, 
  TargetIcon,
  TrophyIcon,
  CircleIcon,
  ZapIcon,
  CircleHelpIcon,
  XIcon,
  InfoIcon,
  PlusIcon,
  MinusIcon,
  WavesIcon,
  SparklesIcon,
  ZapOffIcon,
  SunIcon,
  Grid2x2Icon,
  AwardIcon,
  StarIcon,
  FlameIcon,
  BoltIcon,
  EyeIcon,
  CrosshairIcon,
  ShieldIcon,
  ClockIcon,
  ZapOffIcon as FreezeIcon,
  RadioIcon,
  ActivityIcon,
  CameraIcon,
  Rotate3dIcon,
  MaximizeIcon,
  MinimizeIcon,
  SwitchCameraIcon,
  Move3dIcon
} from 'lucide-react';

const PoolTable = ({ content, updateContent }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, down: false });
  const audioDataRef = useRef(new Array(64).fill(0));
  const timeRef = useRef(0);
  const particlesRef = useRef([]);
  const rippleRef = useRef([]);
  const shotInProgressRef = useRef(false);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startAngleX: 0, startAngleY: 0 });
  const steeringRef = useRef({ left: false, right: false });
  const gameLoopRef = useRef(null); // Stable reference for the game loop
  const chaosBagRef = useRef([]); // Bag for chaos mode randomization (legacy)
  const lastChaosEffectRef = useRef(null); // Track last effect to prevent repeats
  const chaosIndexRef = useRef(0); // Sequential index for chaos mode cycling
  const bankingRef = useRef(0); // Camera roll angle for FPS mode
  
  // POV Camera Smoothing System - TRUE FIRST-PERSON IN-BALL CAMERA
  const povCameraRef = useRef({
    // Position tracking - locked to ball center
    currentX: 0,
    currentY: 0,
    targetX: 0,
    targetY: 0,
    velocityX: 0,
    velocityY: 0,
    // Predictive look-ahead - minimal for first-person
    lookAheadX: 0,
    lookAheadY: 0,
    lookAheadSmoothed: 0,
    // Camera height (distance from scene) - AT ball level for first-person
    currentHeight: 25,
    targetHeight: 25,
    heightVelocity: 0,
    baseHeight: 25,
    // Field of view (zoom) - Wider for immersive first-person
    currentFOV: 0.5,
    targetFOV: 0.5,
    fovVelocity: 0,
    baseFOV: 0.5,
    // Yaw (horizontal rotation) - Follows ball direction
    currentYaw: 0,
    targetYaw: 0,
    yawVelocity: 0,
    lastYaw: 0,
    // Pitch (vertical tilt) - Nearly horizontal for first-person view
    currentPitch: -5,
    targetPitch: -5,
    pitchVelocity: 0,
    basePitch: -5,
    // Banking (roll) - For steering feel
    currentBank: 0,
    targetBank: 0,
    bankVelocity: 0,
    maxBank: 18,
    // Smoothed speed for all transitions
    smoothedSpeed: 0,
    speedHistory: [],
    // Visual effects
    trailParticles: [],
    lastBallPos: { x: 0, y: 0 },
    // Camera lag - minimal for first-person (camera AT ball)
    lagX: 0,
    lagY: 0,
    // Initialization state
    initialized: false,
    frameCount: 0,
    // Transition easing
    transitionPhase: 0
  });
  
  const gameStateRef = useRef({
    balls: [],
    cue: { x: 0, y: 0, angle: 0, power: 0, aiming: false },
    pockets: [],
    gameStarted: false,
    currentPlayer: 1,
    pocketedBalls: [],
    gameOver: false,
    winner: null
  });

  const [gameState, setGameState] = useState({
    score: { player1: 0, player2: 0 },
    currentPlayer: 1,
    gameStarted: false,
    gameOver: false,
    winner: null,
    lastPocketed: null,
    shotInProgress: false
  });

  const [aimingData, setAimingData] = useState({
    isAiming: false,
    power: 0,
    angle: 0,
    cueBall: null
  });

  const [showHelp, setShowHelp] = useState(false);
  const [tableDimensions, setTableDimensions] = useState({ width: 0, height: 0 });
  const [powerMultiplier, setPowerMultiplier] = useState(1.5);
  const [visualizerMode, setVisualizerMode] = useState(0);
  const [showVisualizerMenu, setShowVisualizerMenu] = useState(false);
  const [combo, setCombo] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const [spinControl, setSpinControl] = useState({ x: 0, y: 0 }); // -1 to 1 for each axis
  const [showStats, setShowStats] = useState(false);
  const [impactParticles, setImpactParticles] = useState([]);
  const [ballTrails, setBallTrails] = useState({});
  const [totalShots, setTotalShots] = useState(0);
  const [fouls, setFouls] = useState(0);
  const [practiceMode, setPracticeMode] = useState(false);
  const [aimAssist, setAimAssist] = useState(false);
  const [showTooltips, setShowTooltips] = useState(true);
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shotHistory, setShotHistory] = useState([]);
  const [showShotHistory, setShowShotHistory] = useState(false);
  const [achievements, setAchievements] = useState(content?.achievements || []);
  const [showAchievementPopup, setShowAchievementPopup] = useState(null);
  const [showAchievements, setShowAchievements] = useState(false);
  const [maxComboThisGame, setMaxComboThisGame] = useState(0);
  const [totalPocketedThisGame, setTotalPocketedThisGame] = useState(0);
  const [showGhostBall, setShowGhostBall] = useState(false);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [enhancedEffects, setEnhancedEffects] = useState(true);
  const [chaosMode, setChaosMode] = useState(true); // Default to Chaos Mode ON
  const [povModeEnabled, setPovModeEnabled] = useState(false); // Persistent POV/Chase Cam mode
  const [fpsMode, setFpsMode] = useState(false); // New FPS/Steering mode
  const [screenShake, setScreenShake] = useState({ active: false, intensity: 0, duration: 0 });
  const [flashEffect, setFlashEffect] = useState({ active: false, color: 'white', opacity: 0 });
  const [ghostBalls, setGhostBalls] = useState([]);

  // AI Coach System
  const [showCoach, setShowCoach] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState(null);

  const coachMutation = useMutation({
    mutationFn: async () => {
      throw new Error('The AI coach is not connected in this standalone version.');
    },
    onSuccess: (data) => {
      setCoachAdvice(data);
    }
  });
  
  // 3D Camera Mode System
  const [is3DMode, setIs3DMode] = useState(false);
  const [cameraAngle, setCameraAngle] = useState({ x: -45, y: 0 }); // Negative X for correct orientation (looking down at table)
  const [cameraZoom, setCameraZoom] = useState(1);
  const [showCameraControls, setShowCameraControls] = useState(false);
  const [cameraPreset, setCameraPreset] = useState('default');
  const [autoRotate, setAutoRotate] = useState(false);
  
  // Smooth 3D Transition System
  const [transitioning3D, setTransitioning3D] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [targetCameraAngle, setTargetCameraAngle] = useState({ x: -45, y: 0 }); // Negative for correct view
  const [targetCameraZoom, setTargetCameraZoom] = useState(1);
  const [renderQuality, setRenderQuality] = useState(1); // 0-1 for transition effects
  const transitionStartTimeRef = useRef(0);
  const previousModeRef = useRef(false);
  
  // 3D Lighting System - ENHANCED with more cinematic lighting
  const [lightPosition, setLightPosition] = useState({ x: -0.5, y: -0.8, z: 1.2 }); // More dramatic angle
  const [secondaryLight, setSecondaryLight] = useState({ x: 0.8, y: 0.3, z: 0.5 }); // Subtle rim light
  const render3DRef = useRef({
    tableDepth: 0, // Set to 0 so the felt is the reference plane
    cushionHeight: 16, // Adjusted for realistic height relative to balls
    ballElevation: 12, // Exactly BALL_RADIUS so balls sit on the table
    reflectionOpacity: 0.35,
    shadowSoftness: 0.9,
    fov: 800,
    ambientLight: 0.3,
    fresnelPower: 2.5,
    atmosphericDensity: 0.0006,
    cameraDistance: 1500, // Increased distance to zoom out and reduce distortion
    floorDepth: 90, // Distance from table surface to floor
    roomSize: 2000 // Size of the environment
  });
  
  // Special Abilities & Bullet Time System
  const [activeAbility, setActiveAbility] = useState(null);
  const [bulletTimeActive, setBulletTimeActive] = useState(false);
  const [timeScale, setTimeScale] = useState(1);
  const [abilityEnergy, setAbilityEnergy] = useState(100);
  const [abilityCooldowns, setAbilityCooldowns] = useState({});
  const [unlockedAbilities, setUnlockedAbilities] = useState(['meteor', 'lightning', 'quantum', 'blackhole', 'timefreeze', 'shockwave', 'ricochet', 'magnetize', 'earthquake', 'vortex', 'laser', 'phantom']); // All abilities unlocked
  const abilityEffectsRef = useRef([]); // Active ability visual effects (Ref for performance)
  const [abilityEffects, setAbilityEffects] = useState([]); // Kept for backward compatibility/UI if needed, but unused for physics
  const [showAbilityMenu, setShowAbilityMenu] = useState(false);
  const [showPowerMenu, setShowPowerMenu] = useState(false);

  // Dynamic table dimensions based on viewport
  const ASPECT_RATIO = 2;
  const BALL_RADIUS = 12;
  const POCKET_RADIUS = 20;
  const CUSHION_RATIO = 0.04;

  // Physics constants with adjustable power
  const FRICTION = 0.992; // Reduced friction for more realistic, longer rolls
  const BOUNCE_DAMPING = 0.8;
  const MIN_VELOCITY = 0.05; // Lower threshold for smoother stops
  const MAX_POWER = 15;

  // Ball colors - more vibrant and futuristic
  const BALL_COLORS = [
    '#FFFFFF', // Cue ball
    '#FFD700', '#00BFFF', '#FF1493', '#9370DB', '#FF6347', '#00FA9A', '#DC143C', '#1A1A1A',
    '#FFD700', '#00BFFF', '#FF1493', '#9370DB', '#FF6347', '#00FA9A', '#DC143C'
  ];

  const VISUALIZER_MODES = [
    { id: 0, name: 'Plasma Waves', icon: WavesIcon, color: 'from-purple-500 to-pink-500' },
    { id: 1, name: 'Quantum Grid', icon: Grid2x2Icon, color: 'from-cyan-500 to-blue-500' },
    { id: 2, name: 'Energy Particles', icon: SparklesIcon, color: 'from-yellow-500 to-orange-500' },
    { id: 3, name: 'Ripple Fields', icon: ZapOffIcon, color: 'from-green-500 to-emerald-500' },
    { id: 4, name: 'Nebula Swirl', icon: SunIcon, color: 'from-indigo-500 to-purple-500' }
  ];

  // Special Abilities System - EXPANDED with epic abilities
  const SPECIAL_ABILITIES = [
    {
      id: 'meteor',
      name: 'Meteor Strike',
      description: 'Ball leaves a burning trail and explodes on impact',
      icon: FlameIcon,
      color: 'orange',
      energyCost: 30,
      cooldown: 5000,
      unlockRequirement: 'default',
      effect: 'explosive_impact'
    },
    {
      id: 'lightning',
      name: 'Lightning Chain',
      description: 'Creates electrical arcs between nearby balls',
      icon: BoltIcon,
      color: 'yellow',
      energyCost: 40,
      cooldown: 8000,
      unlockRequirement: 'combo_3',
      effect: 'chain_lightning'
    },
    {
      id: 'quantum',
      name: 'Quantum Split',
      description: 'Ball creates ghost projectiles on impact',
      icon: RadioIcon,
      color: 'purple',
      energyCost: 50,
      cooldown: 10000,
      unlockRequirement: 'combo_5',
      effect: 'split_shot'
    },
    {
      id: 'blackhole',
      name: 'Black Hole',
      description: 'Creates gravity well pulling nearby balls',
      icon: CircleIcon,
      color: 'indigo',
      energyCost: 45,
      cooldown: 12000,
      unlockRequirement: 'score_10',
      effect: 'gravity_well'
    },
    {
      id: 'timefreeze',
      name: 'Time Freeze',
      description: 'Temporarily freezes all other balls',
      icon: ClockIcon,
      color: 'cyan',
      energyCost: 60,
      cooldown: 15000,
      unlockRequirement: 'score_15',
      effect: 'freeze_time'
    },
    {
      id: 'shockwave',
      name: 'Shockwave Blast',
      description: 'Releases expanding ring that blasts all balls outward',
      icon: ActivityIcon,
      color: 'pink',
      energyCost: 35,
      cooldown: 6000,
      unlockRequirement: 'default',
      effect: 'shockwave'
    },
    {
      id: 'ricochet',
      name: 'Ricochet Master',
      description: 'Ball bounces off cushions with 2x force and glowing trail',
      icon: Rotate3dIcon,
      color: 'green',
      energyCost: 25,
      cooldown: 4000,
      unlockRequirement: 'default',
      effect: 'ricochet_boost'
    },
    {
      id: 'magnetize',
      name: 'Magnetize',
      description: 'Ball attracts nearby balls toward its path',
      icon: TargetIcon,
      color: 'red',
      energyCost: 40,
      cooldown: 8000,
      unlockRequirement: 'combo_3',
      effect: 'magnetic_pull'
    },
    {
      id: 'earthquake',
      name: 'Earthquake',
      description: 'Shakes all balls randomly on impact - total chaos!',
      icon: WavesIcon,
      color: 'amber',
      energyCost: 45,
      cooldown: 10000,
      unlockRequirement: 'combo_5',
      effect: 'earthquake'
    },
    {
      id: 'vortex',
      name: 'Spiral Vortex',
      description: 'Creates spinning vortex that curves ball paths',
      icon: RefreshCwIcon,
      color: 'teal',
      energyCost: 50,
      cooldown: 12000,
      unlockRequirement: 'score_10',
      effect: 'vortex_spin'
    },
    {
      id: 'laser',
      name: 'Laser Trail',
      description: 'Ball leaves permanent damaging beam that pushes balls',
      icon: ZapIcon,
      color: 'lime',
      energyCost: 55,
      cooldown: 14000,
      unlockRequirement: 'score_15',
      effect: 'laser_trail'
    },
    {
      id: 'phantom',
      name: 'Phantom Phase',
      description: 'Ball phases through first ball it hits, then impacts second',
      icon: EyeIcon,
      color: 'slate',
      energyCost: 35,
      cooldown: 7000,
      unlockRequirement: 'default',
      effect: 'phantom_phase'
    }
  ];

  // Achievement Definitions
  const ACHIEVEMENTS = [
    { 
      id: 'first_blood', 
      name: 'First Blood', 
      description: 'Pocket your first ball',
      icon: CircleIcon,
      color: 'cyan',
      criteria: (stats) => stats.totalPocketed >= 1
    },
    { 
      id: 'combo_master', 
      name: 'Combo Master', 
      description: 'Achieve a 3x combo',
      icon: FlameIcon,
      color: 'orange',
      criteria: (stats) => stats.maxCombo >= 3
    },
    { 
      id: 'perfectionist', 
      name: 'Perfectionist', 
      description: 'Win without any fouls',
      icon: StarIcon,
      color: 'yellow',
      criteria: (stats) => stats.wonGame && stats.gameFouls === 0
    },
    { 
      id: 'sharpshooter', 
      name: 'Sharpshooter', 
      description: 'Achieve 80% accuracy',
      icon: CrosshairIcon,
      color: 'purple',
      criteria: (stats) => stats.totalShots > 5 && (stats.totalPocketed / stats.totalShots) >= 0.8
    },
    { 
      id: 'speed_demon', 
      name: 'Speed Demon', 
      description: 'Win in under 10 shots',
      icon: BoltIcon,
      color: 'cyan',
      criteria: (stats) => stats.wonGame && stats.totalShots <= 10
    },
    { 
      id: 'unstoppable', 
      name: 'Unstoppable', 
      description: 'Achieve a 5x combo',
      icon: FlameIcon,
      color: 'red',
      criteria: (stats) => stats.maxCombo >= 5
    },
    { 
      id: 'veteran', 
      name: 'Veteran', 
      description: 'Play 10 games',
      icon: ShieldIcon,
      color: 'blue',
      criteria: (stats) => stats.gamesPlayed >= 10
    },
    { 
      id: 'legendary', 
      name: 'Legendary', 
      description: 'Score 15 or more points in one game',
      icon: TrophyIcon,
      color: 'amber',
      criteria: (stats) => stats.currentScore >= 15
    }
  ];

  // Audio visualizer simulation - Optimized with RAF
  useEffect(() => {
    let animationFrameId;
    
    const updateAudioData = () => {
      timeRef.current += 0.05;
      for (let i = 0; i < audioDataRef.current.length; i++) {
        const baseValue = Math.sin(timeRef.current + i * 0.3) * 0.5 + 0.5;
        const noise = Math.random() * 0.3;
        audioDataRef.current[i] = baseValue * 0.7 + noise * 0.3;
      }
      animationFrameId = requestAnimationFrame(updateAudioData);
    };
    
    updateAudioData();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Initialize particles for Energy Particles visualizer
  useEffect(() => {
    if (tableDimensions.width > 0) {
      particlesRef.current = Array.from({ length: 100 }, () => ({
        x: Math.random() * tableDimensions.width,
        y: Math.random() * tableDimensions.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1,
        hue: Math.random() * 360,
        life: Math.random()
      }));
    }
  }, [tableDimensions]);

  const updateDimensions = useCallback(() => {
    // A stable playing field preserves physics and saved games across screen sizes.
    setTableDimensions(previous => previous.width === 1200 ? previous : { width: 1200, height: 600 });
  }, []);

  const calculateGhostBall = useCallback(() => {
    if (!aimingData.isAiming || !aimingData.cueBall) return null;
    
    const cueBall = aimingData.cueBall;
    const balls = gameStateRef.current.balls.filter(b => !b.pocketed && b.type !== 'cue');
    
    // Find the closest ball in the aiming direction
    let closestBall = null;
    let minDistance = Infinity;
    
    balls.forEach(ball => {
      const dx = ball.x - cueBall.x;
      const dy = ball.y - cueBall.y;
      const angle = Math.atan2(dy, dx);
      const angleDiff = Math.abs(angle - aimingData.angle);
      
      if (angleDiff < Math.PI / 6) { // Within 30 degree cone
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < minDistance) {
          minDistance = distance;
          closestBall = ball;
        }
      }
    });
    
    if (!closestBall) return null;
    
    // Calculate ghost ball position (where cue ball center needs to be to hit the target)
    const dx = closestBall.x - cueBall.x;
    const dy = closestBall.y - cueBall.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const contactDistance = BALL_RADIUS * 2;
    const ratio = (distance - contactDistance) / distance;
    
    return {
      x: cueBall.x + dx * ratio,
      y: cueBall.y + dy * ratio,
      targetBall: closestBall
    };
  }, [aimingData]);

  const predictTrajectory = useCallback(() => {
    if (!aimingData.isAiming || !aimingData.cueBall) return [];
    
    const points = [];
    let x = aimingData.cueBall.x;
    let y = aimingData.cueBall.y;
    let vx = Math.cos(aimingData.angle) * aimingData.power;
    let vy = Math.sin(aimingData.angle) * aimingData.power;
    
    const TABLE_WIDTH = tableDimensions.width;
    const TABLE_HEIGHT = tableDimensions.height;
    const CUSHION_WIDTH = TABLE_WIDTH * CUSHION_RATIO;
    
    // Simulate up to 100 steps or 3 bounces
    let bounces = 0;
    for (let i = 0; i < 100 && bounces < 3; i++) {
      x += vx;
      y += vy;
      vx *= FRICTION;
      vy *= FRICTION;
      
      // Check wall collisions
      const minX = CUSHION_WIDTH + BALL_RADIUS;
      const maxX = TABLE_WIDTH - CUSHION_WIDTH - BALL_RADIUS;
      const minY = CUSHION_WIDTH + BALL_RADIUS;
      const maxY = TABLE_HEIGHT - CUSHION_WIDTH - BALL_RADIUS;
      
      if (x < minX || x > maxX) {
        vx *= -BOUNCE_DAMPING;
        x = x < minX ? minX : maxX;
        bounces++;
        points.push({ x, y, isBounce: true });
      }
      
      if (y < minY || y > maxY) {
        vy *= -BOUNCE_DAMPING;
        y = y < minY ? minY : maxY;
        bounces++;
        points.push({ x, y, isBounce: true });
      }
      
      if (i % 3 === 0) {
        points.push({ x, y, isBounce: false });
      }
      
      if (Math.abs(vx) < MIN_VELOCITY && Math.abs(vy) < MIN_VELOCITY) break;
    }
    
    return points;
  }, [aimingData, tableDimensions]);

  const unlockAchievement = useCallback((achievementId) => {
    if (achievements.includes(achievementId)) return;
    
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return;
    
    const newAchievements = [...achievements, achievementId];
    setAchievements(newAchievements);
    updateContent(TQL.set('achievements', newAchievements));
    
    setShowAchievementPopup(achievement);
    setTimeout(() => setShowAchievementPopup(null), 4000);
  }, [achievements]);

  const checkAchievements = useCallback((stats) => {
    ACHIEVEMENTS.forEach(achievement => {
      if (!achievements.includes(achievement.id) && achievement.criteria(stats)) {
        unlockAchievement(achievement.id);
      }
    });
  }, [achievements, unlockAchievement]);

  const triggerScreenShake = useCallback((intensity = 5, duration = 300) => {
    setScreenShake({ active: true, intensity, duration });
    setTimeout(() => {
      setScreenShake({ active: false, intensity: 0, duration: 0 });
    }, duration);
  }, []);

  const triggerFlash = useCallback((color = 'rgb(255, 255, 255)', opacity = 0.5, duration = 200) => {
    // Construct proper rgba() from rgb() by replacing 'rgb' with 'rgba' and adding opacity before closing paren
    const rgbaColor = color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
    setFlashEffect({ active: true, color: rgbaColor, opacity });
    setTimeout(() => {
      setFlashEffect({ active: false, color: 'rgba(255, 255, 255, 0)', opacity: 0 });
    }, duration);
  }, []);

  const updateStatistics = useCallback((winner, shots, comboMax, foulsCount) => {
    const currentStats = content?.statistics || {
      highScore: 0,
      gamesPlayed: 0,
      totalShots: 0,
      bestCombo: 0,
      totalFouls: 0
    };

    const winnerScore = gameState.score[`player${winner}`];
    const isNewHighScore = winnerScore > currentStats.highScore;

    updateContent(TQL.batch([
      TQL.set('statistics.gamesPlayed', currentStats.gamesPlayed + 1),
      TQL.set('statistics.totalShots', currentStats.totalShots + shots),
      TQL.set('statistics.bestCombo', Math.max(currentStats.bestCombo, comboMax)),
      TQL.set('statistics.totalFouls', currentStats.totalFouls + foulsCount),
      ...(isNewHighScore ? [TQL.set('statistics.highScore', winnerScore)] : []),
      TQL.set('statistics.lastGameDate', new Date().toISOString())
    ]));

    // Check for achievements on game end
    checkAchievements({
      wonGame: true,
      currentScore: winnerScore,
      totalShots: shots,
      totalPocketed: totalPocketedThisGame,
      maxCombo: comboMax,
      gameFouls: foulsCount,
      gamesPlayed: currentStats.gamesPlayed + 1
    });
  }, [content, gameState.score, checkAchievements, totalPocketedThisGame]);

  // Special Abilities Functions
  const checkAbilityUnlocks = useCallback(() => {
    const currentScore = gameState.score[`player${gameStateRef.current.currentPlayer}`];
    
    SPECIAL_ABILITIES.forEach(ability => {
      if (!unlockedAbilities.includes(ability.id)) {
        let shouldUnlock = false;
        
        if (ability.unlockRequirement === 'default') {
          shouldUnlock = true;
        } else if (ability.unlockRequirement === 'combo_3' && combo >= 3) {
          shouldUnlock = true;
        } else if (ability.unlockRequirement === 'combo_5' && combo >= 5) {
          shouldUnlock = true;
        } else if (ability.unlockRequirement === 'score_10' && currentScore >= 10) {
          shouldUnlock = true;
        } else if (ability.unlockRequirement === 'score_15' && currentScore >= 15) {
          shouldUnlock = true;
        }
        
        if (shouldUnlock) {
          setUnlockedAbilities(prev => [...prev, ability.id]);
          // Show unlock notification
          setShowAchievementPopup({
            name: `Ability Unlocked: ${ability.name}`,
            description: ability.description,
            icon: ability.icon,
            color: ability.color
          });
          setTimeout(() => setShowAchievementPopup(null), 4000);
        }
      }
    });
  }, [combo, gameState.score, unlockedAbilities]);

  const activateBulletTime = useCallback(() => {
    setBulletTimeActive(true);
    setTimeScale(0.3);
    
    setTimeout(() => {
      setBulletTimeActive(false);
      setTimeScale(1);
    }, 2000);
  }, []);

  const applySpecialAbility = useCallback((cueBall, ability, options = {}) => {
    if (!ability) return;
    
    const { free = false, skipBulletTime = false } = options;
    const abilityDef = SPECIAL_ABILITIES.find(a => a.id === ability);
    if (!abilityDef) return;
    
    // Apply visual effect marker to cue ball
    cueBall.activeAbility = abilityDef.effect;
    cueBall.abilityColor = abilityDef.color;
    
    // Create initial effect particles
    const effectParticles = [];
    
    switch (abilityDef.effect) {
      case 'explosive_impact':
        // Meteor trail particles - ENHANCED with more particles and variety
        for (let i = 0; i < 100; i++) {
          const angle = (Math.PI * 2 * i) / 100;
          const speed = 2 + Math.random() * 4;
          effectParticles.push({
            type: 'meteor_trail',
            x: cueBall.x,
            y: cueBall.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            size: 2 + Math.random() * 6,
            hue: 15 + Math.random() * 45
          });
        }
        // Add fire ring
        for (let i = 0; i < 30; i++) {
          effectParticles.push({
            type: 'fire_ring',
            x: cueBall.x,
            y: cueBall.y,
            vx: 0,
            vy: 0,
            life: 1,
            size: 20 + i * 2,
            hue: 30,
            delay: i * 0.02
          });
        }
        triggerFlash('rgb(255, 150, 50)', 0.4, 300);
        break;
        
      case 'chain_lightning':
        // Lightning effect marker with initial burst
        cueBall.lightningActive = true;
        cueBall.lightningCharge = 1;
        for (let i = 0; i < 80; i++) {
          const angle = (Math.PI * 2 * i) / 80;
          effectParticles.push({
            type: 'lightning',
            x: cueBall.x + Math.cos(angle) * 20,
            y: cueBall.y + Math.sin(angle) * 20,
            vx: Math.cos(angle) * 5,
            vy: Math.sin(angle) * 5,
            life: 1,
            size: 3,
            hue: 60
          });
        }
        triggerFlash('rgb(255, 255, 100)', 0.3, 200);
        break;
        
      case 'split_shot':
        // Quantum split marker with portal effect
        cueBall.quantumSplit = true;
        cueBall.quantumCharge = 1;
        for (let ring = 0; ring < 5; ring++) {
          for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20;
            effectParticles.push({
              type: 'quantum',
              x: cueBall.x + Math.cos(angle) * ring * 8,
              y: cueBall.y + Math.sin(angle) * ring * 8,
              vx: Math.cos(angle) * (1 + ring * 0.5),
              vy: Math.sin(angle) * (1 + ring * 0.5),
              life: 1,
              size: 4 + ring,
              hue: 280
            });
          }
        }
        triggerFlash('rgb(200, 100, 255)', 0.3, 200);
        break;
        
      case 'gravity_well':
        // Black hole marker with gravitational distortion
        cueBall.blackHole = { radius: 150, strength: 1.2 };
        for (let ring = 0; ring < 10; ring++) {
          for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 * i) / 30 + ring * 0.2;
            const radius = 20 + ring * 12;
            effectParticles.push({
              type: 'gravity',
              x: cueBall.x + Math.cos(angle) * radius,
              y: cueBall.y + Math.sin(angle) * radius,
              vx: -Math.cos(angle) * 2,
              vy: -Math.sin(angle) * 2,
              life: 1,
              size: 2,
              hue: 270,
              orbit: true,
              orbitAngle: angle,
              orbitRadius: radius
            });
          }
        }
        triggerFlash('rgb(100, 50, 200)', 0.4, 300);
        break;
        
      case 'freeze_time':
        // Freeze all other balls with dramatic ice effect
        gameStateRef.current.balls.forEach(ball => {
          if (ball.id !== cueBall.id && !ball.pocketed) {
            ball.frozenVx = ball.vx;
            ball.frozenVy = ball.vy;
            ball.vx = 0;
            ball.vy = 0;
            ball.frozen = true;
            
            // Create ice crystals around frozen ball
            for (let i = 0; i < 30; i++) {
              const angle = (Math.PI * 2 * i) / 30;
              effectParticles.push({
                type: 'ice',
                x: ball.x + Math.cos(angle) * (BALL_RADIUS + 5),
                y: ball.y + Math.sin(angle) * (BALL_RADIUS + 5),
                vx: Math.cos(angle) * 0.5,
                vy: Math.sin(angle) * 0.5,
                life: 1,
                size: 2 + Math.random() * 3,
                hue: 200,
                targetX: ball.x,
                targetY: ball.y
              });
            }
            
            setTimeout(() => {
              if (ball.frozen) {
                ball.vx = ball.frozenVx || 0;
                ball.vy = ball.frozenVy || 0;
                ball.frozen = false;
                
                // Shatter effect when unfreezing
                const shatterParticles = [];
                for (let i = 0; i < 20; i++) {
                  const angle = (Math.PI * 2 * i) / 20;
                  shatterParticles.push({
                    type: 'ice_shatter',
                    x: ball.x,
                    y: ball.y,
                    vx: Math.cos(angle) * 3,
                    vy: Math.sin(angle) * 3,
                    life: 1,
                    size: 2,
                    hue: 200
                  });
                }
                setAbilityEffects(prev => [...prev, ...shatterParticles]);
              }
            }, 3000);
          }
        });
        triggerFlash('rgb(100, 200, 255)', 0.3, 400);
        break;
        
      case 'shockwave':
        // Shockwave blast - expanding ring effect
        cueBall.shockwaveActive = true;
        for (let ring = 0; ring < 8; ring++) {
          for (let i = 0; i < 36; i++) {
            const angle = (Math.PI * 2 * i) / 36;
            effectParticles.push({
              type: 'shockwave_ring',
              x: cueBall.x,
              y: cueBall.y,
              vx: Math.cos(angle) * (3 + ring),
              vy: Math.sin(angle) * (3 + ring),
              life: 1,
              size: 4 + ring,
              hue: 330,
              delay: ring * 0.03
            });
          }
        }
        triggerFlash('rgb(255, 100, 200)', 0.4, 250);
        triggerScreenShake(6, 300);
        break;
        
      case 'ricochet_boost':
        // Ricochet master - glowing trail and bounce boost
        cueBall.ricochetBoost = true;
        cueBall.ricochetBounces = 0;
        for (let i = 0; i < 60; i++) {
          const angle = (Math.PI * 2 * i) / 60;
          effectParticles.push({
            type: 'ricochet',
            x: cueBall.x + Math.cos(angle) * 15,
            y: cueBall.y + Math.sin(angle) * 15,
            vx: Math.cos(angle) * 2,
            vy: Math.sin(angle) * 2,
            life: 1,
            size: 3,
            hue: 120
          });
        }
        triggerFlash('rgb(100, 255, 150)', 0.3, 200);
        break;
        
      case 'magnetic_pull':
        // Magnetize - attract nearby balls
        cueBall.magneticPull = { radius: 120, strength: 0.8 };
        for (let ring = 0; ring < 6; ring++) {
          for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20 - ring * 0.2;
            const radius = 30 + ring * 15;
            effectParticles.push({
              type: 'magnetic',
              x: cueBall.x + Math.cos(angle) * radius,
              y: cueBall.y + Math.sin(angle) * radius,
              vx: -Math.cos(angle) * 1.5,
              vy: -Math.sin(angle) * 1.5,
              life: 1,
              size: 2,
              hue: 0,
              orbit: true
            });
          }
        }
        triggerFlash('rgb(255, 80, 80)', 0.3, 200);
        break;
        
      case 'earthquake':
        // Earthquake - shake all balls on impact
        cueBall.earthquakeActive = true;
        for (let i = 0; i < 80; i++) {
          effectParticles.push({
            type: 'earthquake',
            x: cueBall.x + (Math.random() - 0.5) * 100,
            y: cueBall.y + (Math.random() - 0.5) * 100,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 1,
            size: 3 + Math.random() * 4,
            hue: 35
          });
        }
        triggerFlash('rgb(200, 150, 50)', 0.4, 300);
        break;
        
      case 'vortex_spin':
        // Vortex - creates spinning effect
        cueBall.vortexActive = { radius: 100, angle: 0, strength: 1.5 };
        for (let spiral = 0; spiral < 3; spiral++) {
          for (let i = 0; i < 40; i++) {
            const t = i / 40;
            const angle = spiral * (Math.PI * 2 / 3) + t * Math.PI * 4;
            const radius = t * 80;
            effectParticles.push({
              type: 'vortex',
              x: cueBall.x + Math.cos(angle) * radius,
              y: cueBall.y + Math.sin(angle) * radius,
              vx: Math.cos(angle + Math.PI/2) * 2,
              vy: Math.sin(angle + Math.PI/2) * 2,
              life: 1,
              size: 2 + t * 3,
              hue: 175
            });
          }
        }
        triggerFlash('rgb(50, 200, 200)', 0.3, 250);
        break;
        
      case 'laser_trail':
        // Laser trail - leaves beam behind
        cueBall.laserTrail = true;
        cueBall.laserPoints = [];
        for (let i = 0; i < 50; i++) {
          const angle = (Math.PI * 2 * i) / 50;
          effectParticles.push({
            type: 'laser',
            x: cueBall.x + Math.cos(angle) * 10,
            y: cueBall.y + Math.sin(angle) * 10,
            vx: Math.cos(angle) * 4,
            vy: Math.sin(angle) * 4,
            life: 1,
            size: 2,
            hue: 90
          });
        }
        triggerFlash('rgb(150, 255, 50)', 0.4, 200);
        break;
        
      case 'phantom_phase':
        // Phantom phase - passes through first ball
        cueBall.phantomPhase = true;
        cueBall.phantomUsed = false;
        for (let i = 0; i < 40; i++) {
          effectParticles.push({
            type: 'phantom',
            x: cueBall.x + (Math.random() - 0.5) * 40,
            y: cueBall.y + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 1,
            size: 2 + Math.random() * 3,
            hue: 220
          });
        }
        triggerFlash('rgb(150, 150, 200)', 0.2, 300);
        break;
    }
    
    if (effectParticles.length > 0) {
      setAbilityEffects(prev => [...prev, ...effectParticles]);
    }
    
    // Activate bullet time for dramatic effect, unless skipped
    if (!skipBulletTime && aimingData.power > MAX_POWER * 0.7) {
      activateBulletTime();
    }
    
    if (!free) {
      // Set cooldown
      setAbilityCooldowns(prev => ({
        ...prev,
        [ability]: Date.now() + abilityDef.cooldown
      }));
      
      // Consume energy
      setAbilityEnergy(prev => Math.max(0, prev - abilityDef.energyCost));
    }
  }, [aimingData.power, activateBulletTime, triggerFlash]);

  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);

  // Auto-rotate camera effect
  useEffect(() => {
    if (!autoRotate || !is3DMode) return;
    
    const rotateInterval = setInterval(() => {
      setCameraAngle(prev => ({
        ...prev,
        y: (prev.y + 0.5) % 360
      }));
    }, 50);
    
    return () => clearInterval(rotateInterval);
  }, [autoRotate, is3DMode]);
  
  // Smooth 3D mode transition animation
  useEffect(() => {
    if (!transitioning3D) return;
    
    const transitionDuration = 800; // ms
    const startTime = performance.now();
    transitionStartTimeRef.current = startTime;
    
    const animateTransition = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / transitionDuration);
      
      setTransitionProgress(progress);
      setRenderQuality(easeInOutCubic(progress));
      
      // Interpolate camera during transition
      if (is3DMode) {
        setCameraAngle({
          x: lerp(0, targetCameraAngle.x, easeOutExpo(progress)),
          y: lerp(0, targetCameraAngle.y, easeOutExpo(progress))
        });
        setCameraZoom(lerp(0.7, targetCameraZoom, easeOutExpo(progress)));
      }
      
      if (progress < 1) {
        requestAnimationFrame(animateTransition);
      } else {
        setTransitioning3D(false);
        setTransitionProgress(1);
        setRenderQuality(1);
        if (is3DMode) {
          setCameraAngle(targetCameraAngle);
          setCameraZoom(targetCameraZoom);
        }
      }
    };
    
    requestAnimationFrame(animateTransition);
  }, [transitioning3D, is3DMode, targetCameraAngle, targetCameraZoom]);

  // Camera presets - Fixed with negative X angles for correct orientation (looking down at table)
  const cameraPresets = {
    default: { x: -40, y: 0, zoom: 1.15 }, // Zoomed in for better view
    topDown: { x: -85, y: 0, zoom: 0.8 },
    dramatic: { x: -35, y: 20, zoom: 1.2 },
    side: { x: -25, y: 75, zoom: 1.0 },
    player1: { x: -45, y: -25, zoom: 1.1 },
    player2: { x: -45, y: 25, zoom: 1.1 },
    cinematic: { x: -30, y: 12, zoom: 1.2 },
    showcase: { x: -55, y: 8, zoom: 1.0 },
    overhead: { x: -75, y: 0, zoom: 0.8 },
    immersive: { x: -35, y: 5, zoom: 1.4 }
  };
  
  // Interpolation utility functions for smooth transitions
  const lerp = (start, end, t) => start + (end - start) * t;
  
  const easeInOutCubic = (t) => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  
  const easeOutExpo = (t) => {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  };
  
  const smoothstep = (edge0, edge1, x) => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  // Smooth damping function for cinematic camera follow (based on Unity's SmoothDamp)
  const smoothDamp = (current, target, velocityRef, smoothTime, maxSpeed = Infinity, deltaTime = 0.016) => {
    smoothTime = Math.max(0.0001, smoothTime);
    const omega = 2 / smoothTime;
    const x = omega * deltaTime;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    let change = current - target;
    const originalTo = target;
    
    const maxChange = maxSpeed * smoothTime;
    change = Math.max(-maxChange, Math.min(maxChange, change));
    const newTarget = current - change;
    
    const temp = (velocityRef.current + omega * change) * deltaTime;
    velocityRef.current = (velocityRef.current - omega * temp) * exp;
    let output = newTarget + (change + temp) * exp;
    
    if (originalTo - current > 0 === output > originalTo) {
      output = originalTo;
      velocityRef.current = (output - originalTo) / deltaTime;
    }
    
    return output;
  };

  // Enhanced exponential smoothing for POV camera
  const expSmooth = (current, target, smoothFactor, deltaTime = 0.016) => {
    const factor = 1 - Math.pow(smoothFactor, deltaTime * 60);
    return current + (target - current) * factor;
  };

  // Smooth angle interpolation with wrap-around handling
  const smoothAngle = (current, target, smoothFactor, deltaTime = 0.016) => {
    let diff = target - current;
    // Normalize angle difference to [-180, 180]
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    const factor = 1 - Math.pow(smoothFactor, deltaTime * 60);
    return current + diff * factor;
  };

  // Cubic ease-out for natural deceleration
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  // Smooth step with configurable edge
  const smoothStep2 = (edge0, edge1, x) => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  // Vector rotation helper for 3D ball rolling (Rodrigues' rotation formula)
  const rotateVector = useCallback((v, axis, angle) => {
    // Normalize axis
    const len = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
    if (len < 0.0001) return v;
    const nx = axis.x / len;
    const ny = axis.y / len;
    const nz = axis.z / len;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dot = v.x * nx + v.y * ny + v.z * nz;

    return {
      x: v.x * cos + (ny * v.z - nz * v.y) * sin + nx * dot * (1 - cos),
      y: v.y * cos + (nz * v.x - nx * v.z) * sin + ny * dot * (1 - cos),
      z: v.z * cos + (nx * v.y - ny * v.x) * sin + nz * dot * (1 - cos)
    };
  }, []);

  // 3D Perspective Transformation Utilities - Fortified and Robust
  const perspective3D = useCallback((x, y, z, centerX, centerY, options = {}) => {
    const { 
      applyAtmospheric = true,
      intensityMultiplier = 1 
    } = options;
    
    let effectiveAngleX = cameraAngle.x;
    let effectiveAngleY = cameraAngle.y;
    let effectiveAngleZ = 0; // Roll
    let effectiveZoom = cameraZoom;
    let offsetX = 0;
    let offsetY = 0;
    let viewShiftY = 0; // Vertical shift for Chase Cam feel
    let cameraDist = render3DRef.current.cameraDistance;

    // FPS Mode: TRUE FIRST-PERSON IN-BALL CAMERA
    if (fpsMode && gameStateRef.current) {
      const cueBall = gameStateRef.current.balls.find(b => b.type === 'cue');
      const povCam = povCameraRef.current;
      
      if (cueBall) {
        // Use transition phase for smooth entry
        const transitionMult = povCam.transitionPhase || 1;
        
        // Use pre-smoothed speed from physics update
        const speedFactor = Math.min(povCam.smoothedSpeed, 25) / 25;
        const speedFactorEased = easeOutCubic(speedFactor);
        
        // Camera position: EXACTLY at ball center
        offsetX = povCam.currentX * transitionMult;
        offsetY = povCam.currentY * transitionMult;
        
        // Yaw: Look in direction of ball travel
        effectiveAngleY = povCam.currentYaw;
        
        // Camera distance: AT ball level for true first-person
        // Low value = camera is AT the ball position looking out
        cameraDist = povCam.currentHeight + 10;
        
        // Pitch: Nearly horizontal (looking forward along table)
        effectiveAngleX = povCam.currentPitch;
        
        // Banking for steering feel
        effectiveAngleZ = povCam.currentBank;
        
        // FOV: Wide for immersive first-person
        effectiveZoom = povCam.currentFOV;
        
        // Vertical Shift: Minimal - we're looking forward, not at the table
        viewShiftY = tableDimensions.height * (0.02 + speedFactorEased * 0.02);
        
        // Ensure minimum camera distance for rendering stability
        cameraDist = Math.max(cameraDist, 20);
      }
    } else if (transitioning3D) {
      // Normal transition logic
      effectiveAngleX = lerp(previousModeRef.current ? cameraAngle.x : 0, targetCameraAngle.x, easeOutExpo(transitionProgress));
      effectiveAngleY = lerp(previousModeRef.current ? cameraAngle.y : 0, targetCameraAngle.y, easeOutExpo(transitionProgress));
      effectiveZoom = lerp(previousModeRef.current ? cameraZoom : 0.8, targetCameraZoom, easeOutExpo(transitionProgress));
    }
    
    // Reset POV camera state when not in FPS mode for clean re-entry
    if (!fpsMode && povCameraRef.current.initialized) {
      povCameraRef.current.initialized = false;
      povCameraRef.current.frameCount = 0;
    }

    // Convert to radians
    const radX = (effectiveAngleX * Math.PI) / 180; // Pitch
    const radY = (effectiveAngleY * Math.PI) / 180; // Yaw
    
    // Apply FPS offset (shift world so ball is center)
    const shiftedX = x - offsetX;
    const shiftedY = y - offsetY;

    // 1. Yaw Rotation
    const x1 = shiftedX * Math.cos(radY) - shiftedY * Math.sin(radY);
    const z1 = shiftedX * Math.sin(radY) + shiftedY * Math.cos(radY);
    const y1 = z; 
    
    // 2. Pitch Rotation
    const y2_pitch = y1 * Math.cos(radX) - z1 * Math.sin(radX);
    const z2 = y1 * Math.sin(radX) + z1 * Math.cos(radX);
    const x2_pitch = x1;
    
    // 3. Roll Rotation (Z-axis) - New for Epic Banking
    const radZ = (effectiveAngleZ * Math.PI) / 180;
    const x2 = x2_pitch * Math.cos(radZ) - y2_pitch * Math.sin(radZ);
    const y2 = x2_pitch * Math.sin(radZ) + y2_pitch * Math.cos(radZ);
    
    // 4. Camera Projection
    const depth = cameraDist + z2;
    
    // Adjusted near clip plane for FPS mode
    const nearClip = fpsMode ? 5 : 50;
    if (depth < nearClip) return { x: -9999, y: -9999, z: -9999, scale: 0, visible: false, rawDepth: depth };
    
    const fov = render3DRef.current.fov;
    const safeDepth = Math.max(depth, 0.1);
    const scale = fov / safeDepth;
    
    const finalScale = Math.max(0, scale * effectiveZoom);
    
    const screenX = centerX + x2 * finalScale;
    const screenY = centerY - y2 * finalScale + viewShiftY; // Apply vertical shift
    
    // Adjust fog for FPS mode - Much clearer visibility
    const fogStart = fpsMode ? 1200 : 500; // Push fog way back in FPS mode
    const fogDist = Math.max(0, z2 + fogStart);
    const atmosphericFade = applyAtmospheric 
      ? Math.max(0, Math.min(1, Math.exp(-fogDist * render3DRef.current.atmosphericDensity * intensityMultiplier * (fpsMode ? 0.2 : 1))))
      : 1;
      
    return {
      x: screenX,
      y: screenY,
      z: z2,
      scale: finalScale,
      atmosphericFade,
      visible: true,
      rawDepth: depth
    };
  }, [cameraAngle, cameraZoom, targetCameraAngle, targetCameraZoom, transitioning3D, transitionProgress, fpsMode, tableDimensions]);

  const calculate3DLighting = useCallback((normalX, normalY, normalZ) => {
    const r3d = render3DRef.current;
    
    // Main Key Light (Warm)
    const keyLightDir = { x: -0.5, y: -0.8, z: 1.0 }; // Top-left-front
    const keyMag = Math.sqrt(keyLightDir.x**2 + keyLightDir.y**2 + keyLightDir.z**2);
    const kx = keyLightDir.x / keyMag, ky = keyLightDir.y / keyMag, kz = keyLightDir.z / keyMag;
    
    // Rim Light (Cool/Cyan) - From behind/side
    const rimLightDir = { x: 0.8, y: -0.2, z: -0.5 };
    const rimMag = Math.sqrt(rimLightDir.x**2 + rimLightDir.y**2 + rimLightDir.z**2);
    const rx = rimLightDir.x / rimMag, ry = rimLightDir.y / rimMag, rz = rimLightDir.z / rimMag;
    
    // View Vector (Approximate as looking down Z)
    const vx = 0, vy = 0, vz = 1;
    
    // 1. Diffuse Term (Oren-Nayar approx for felt/matte, Lambert for others)
    const NdotL = Math.max(0, normalX * kx + normalY * ky + normalZ * kz);
    const diffuse = NdotL;
    
    // 2. Specular Term (Blinn-Phong)
    const hx = kx + vx, hy = ky + vy, hz = kz + vz;
    const hMag = Math.sqrt(hx**2 + hy**2 + hz**2);
    const NdotH = Math.max(0, (normalX * hx/hMag + normalY * hy/hMag + normalZ * hz/hMag));
    const specular = Math.pow(NdotH, 64);
    
    // 3. Fresnel / Rim
    const NdotV = Math.max(0, normalX * vx + normalY * vy + normalZ * vz);
    const fresnel = Math.pow(1 - NdotV, 3.0);
    
    // 4. Secondary Rim Light Contribution
    const NdotRim = Math.max(0, normalX * rx + normalY * ry + normalZ * rz);
    const rim = Math.pow(NdotRim, 4) * 0.5;
    
    // 5. Ambient Occlusion (Basic height-based)
    const ao = 0.5 + 0.5 * normalZ;

    return {
      diffuse,
      specular,
      fresnel,
      rim,
      ao,
      subsurface: diffuse * 0.5,
      combined: (diffuse * 0.8 + r3d.ambientLight) * ao
    };
  }, []);

  const sortBallsByDepth = useCallback((balls, centerX, centerY) => {
    return [...balls].sort((a, b) => {
      const aPos = perspective3D(a.x - centerX, a.y - centerY, 0, centerX, centerY);
      const bPos = perspective3D(b.x - centerX, b.y - centerY, 0, centerX, centerY);
      return bPos.z - aPos.z; // Sort back to front
    });
  }, [perspective3D]);

  const applyCameraPreset = (presetName) => {
    const preset = cameraPresets[presetName];
    if (preset) {
      setCameraPreset(presetName);
      setCameraAngle({ x: preset.x, y: preset.y });
      setCameraZoom(preset.zoom);
    }
  };

  const initializeGame = useCallback(() => {
    if (tableDimensions.width === 0) return;
    
    const TABLE_WIDTH = tableDimensions.width;
    const TABLE_HEIGHT = tableDimensions.height;
    const CUSHION_WIDTH = TABLE_WIDTH * CUSHION_RATIO;
    
    const balls = [];
    const pockets = [];

    const pocketPositions = [
      { x: CUSHION_WIDTH, y: CUSHION_WIDTH },
      { x: TABLE_WIDTH / 2, y: CUSHION_WIDTH },
      { x: TABLE_WIDTH - CUSHION_WIDTH, y: CUSHION_WIDTH },
      { x: CUSHION_WIDTH, y: TABLE_HEIGHT - CUSHION_WIDTH },
      { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT - CUSHION_WIDTH },
      { x: TABLE_WIDTH - CUSHION_WIDTH, y: TABLE_HEIGHT - CUSHION_WIDTH }
    ];

    pocketPositions.forEach((pos, index) => {
      pockets.push({
        id: index,
        x: pos.x,
        y: pos.y,
        radius: POCKET_RADIUS
      });
    });

    balls.push({
      id: 0,
      x: TABLE_WIDTH * 0.25,
      y: TABLE_HEIGHT / 2,
      vx: 0,
      vy: 0,
      radius: BALL_RADIUS,
      color: BALL_COLORS[0],
      type: 'cue',
      pocketed: false,
      pole: { x: 0, y: 0, z: 1 }, // Initialize 3D orientation (pole pointing up)
      rotationAngle: 0
    });

    const rackStartX = TABLE_WIDTH * 0.75;
    const rackStartY = TABLE_HEIGHT / 2;
    const ballSpacing = BALL_RADIUS * 2.1;

    let ballIndex = 1;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col <= row; col++) {
        if (ballIndex < 16) {
          const x = rackStartX + row * ballSpacing * Math.cos(0);
          const y = rackStartY + (col - row / 2) * ballSpacing;
          
          balls.push({
            id: ballIndex,
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            radius: BALL_RADIUS,
            color: BALL_COLORS[ballIndex],
            type: ballIndex === 8 ? 'eight' : (ballIndex <= 7 ? 'solid' : 'stripe'),
            pocketed: false,
            number: ballIndex,
            pole: { x: 0, y: 0, z: 1 }, // Initialize 3D orientation
            rotationAngle: 0
          });
          ballIndex++;
        }
      }
    }

    gameStateRef.current.balls = balls;
    gameStateRef.current.pockets = pockets;
    gameStateRef.current.gameStarted = true;
    gameStateRef.current.currentPlayer = 1;
    gameStateRef.current.pocketedBalls = [];
    gameStateRef.current.gameOver = false;
    gameStateRef.current.winner = null;

    setGameState(prev => ({
      ...prev,
      gameStarted: true,
      gameOver: false,
      winner: null,
      currentPlayer: 1,
      score: { player1: 0, player2: 0 }
    }));
  }, [tableDimensions]);

  // Restore saved game if available
  useEffect(() => {
    if (tableDimensions.width > 0 && !gameStateRef.current.gameStarted) {
      if (content?.savedGame && content.savedGame.balls && content.savedGame.balls.length > 0) {
        console.log('Restoring saved game...');
        const saved = content.savedGame;
        
        // Restore refs
        gameStateRef.current.balls = structuredClone(saved.balls);
        gameStateRef.current.pockets = saved.pockets || gameStateRef.current.pockets; // Pockets usually static but good to be safe
        gameStateRef.current.currentPlayer = saved.currentPlayer;
        gameStateRef.current.gameStarted = true;
        gameStateRef.current.pocketedBalls = saved.balls.filter(b => b.pocketed);
        
        // Restore state
        setGameState(prev => ({
          ...prev,
          gameStarted: true,
          currentPlayer: saved.currentPlayer,
          score: saved.score,
          gameOver: false
        }));
        
        // Re-initialize pockets if missing (legacy saves)
        if (!saved.pockets || saved.pockets.length === 0) {
           // Logic from initializeGame to recreate pockets if needed
           const TABLE_WIDTH = tableDimensions.width;
           const TABLE_HEIGHT = tableDimensions.height;
           const CUSHION_WIDTH = TABLE_WIDTH * CUSHION_RATIO;
           const pocketPositions = [
              { x: CUSHION_WIDTH, y: CUSHION_WIDTH },
              { x: TABLE_WIDTH / 2, y: CUSHION_WIDTH },
              { x: TABLE_WIDTH - CUSHION_WIDTH, y: CUSHION_WIDTH },
              { x: CUSHION_WIDTH, y: TABLE_HEIGHT - CUSHION_WIDTH },
              { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT - CUSHION_WIDTH },
              { x: TABLE_WIDTH - CUSHION_WIDTH, y: TABLE_HEIGHT - CUSHION_WIDTH }
            ];
            gameStateRef.current.pockets = pocketPositions.map((pos, index) => ({
              id: index, x: pos.x, y: pos.y, radius: POCKET_RADIUS
            }));
        }
      } else {
        initializeGame();
      }
    }
  }, [tableDimensions, content?.savedGame, initializeGame]);

  const checkCollisions = useCallback(() => {
    const TABLE_WIDTH = tableDimensions.width;
    const TABLE_HEIGHT = tableDimensions.height;
    const CUSHION_WIDTH = TABLE_WIDTH * CUSHION_RATIO;
    const balls = gameStateRef.current.balls.filter(ball => !ball.pocketed);
    
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const ball1 = balls[i];
        const ball2 = balls[j];
        
        const dx = ball2.x - ball1.x;
        const dy = ball2.y - ball1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < ball1.radius + ball2.radius) {
          // Exit FPS mode on first collision involving cue ball
          if (fpsMode && (ball1.type === 'cue' || ball2.type === 'cue')) {
            setFpsMode(false);
      setTimeScale(1);
            // Flash effect for impact
            triggerFlash('rgba(255, 255, 255, 0.8)', 0.8, 100);
            triggerScreenShake(10, 300);
          }

          const impactSpeed = Math.sqrt(
            Math.pow(ball1.vx - ball2.vx, 2) + Math.pow(ball1.vy - ball2.vy, 2)
          );
          
          // Special ability effects on collision - DRAMATICALLY ENHANCED
          // Handle phantom phase - pass through first ball
          if ((ball1.phantomPhase && !ball1.phantomUsed) || (ball2.phantomPhase && !ball2.phantomUsed)) {
            const phantomBall = ball1.phantomPhase ? ball1 : ball2;
            phantomBall.phantomUsed = true;
            
            // Create ghost effect but don't collide
            const impactX = (ball1.x + ball2.x) / 2;
            const impactY = (ball1.y + ball2.y) / 2;
            for (let i = 0; i < 30; i++) {
              abilityEffectsRef.current.push({
                type: 'phantom',
                x: impactX + (Math.random() - 0.5) * 30,
                y: impactY + (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                life: 0.8,
                size: 3,
                hue: 220
              });
            }
            triggerFlash('rgba(150, 150, 220, 0.3)', 0.3, 150);
            continue; // Skip collision physics for this pair
          }

          if (ball1.activeAbility === 'explosive_impact' || ball2.activeAbility === 'explosive_impact') {
            // MEGA EXPLOSION with screen shake
            const impactX = (ball1.x + ball2.x) / 2;
            const impactY = (ball1.y + ball2.y) / 2;
            const explosionParticles = [];
            
            // Main explosion burst - Optimized count
            for (let p = 0; p < 60; p++) {
              const angle = (Math.PI * 2 * p) / 60;
              const speed = 3 + Math.random() * 10;
              explosionParticles.push({
                type: 'explosion',
                x: impactX,
                y: impactY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                size: 2 + Math.random() * 8,
                hue: 10 + Math.random() * 40
              });
            }
            
            // Secondary fire waves - Optimized count
            for (let wave = 0; wave < 3; wave++) {
              for (let p = 0; p < 16; p++) {
                const angle = (Math.PI * 2 * p) / 16;
                explosionParticles.push({
                  type: 'fire_wave',
                  x: impactX,
                  y: impactY,
                  vx: Math.cos(angle) * (2 + wave),
                  vy: Math.sin(angle) * (2 + wave),
                  life: 1,
                  size: 4 + wave * 2,
                  hue: 20,
                  delay: wave * 0.05
                });
              }
            }
            
            // Smoke particles
            for (let p = 0; p < 40; p++) {
              const angle = Math.random() * Math.PI * 2;
              explosionParticles.push({
                type: 'smoke',
                x: impactX,
                y: impactY,
                vx: Math.cos(angle) * (1 + Math.random() * 2),
                vy: Math.sin(angle) * (1 + Math.random() * 2) - 1,
                life: 1,
                size: 4 + Math.random() * 6,
                hue: 0
              });
            }
            
            abilityEffectsRef.current.push(...explosionParticles);
            triggerScreenShake(8, 400);
            triggerFlash('rgba(255, 150, 50, 0.6)', 0.6, 300);
            
            // Push nearby balls away dramatically
            balls.forEach(nearBall => {
              if (nearBall !== ball1 && nearBall !== ball2 && !nearBall.pocketed) {
                const ndx = nearBall.x - impactX;
                const ndy = nearBall.y - impactY;
                const ndist = Math.sqrt(ndx * ndx + ndy * ndy);
                if (ndist < 100) {
                  const force = (100 - ndist) / 100 * 5;
                  nearBall.vx += (ndx / ndist) * force;
                  nearBall.vy += (ndy / ndist) * force;
                }
              }
            });
          }
          
          // Shockwave blast - push ALL balls outward from impact
          if (ball1.shockwaveActive || ball2.shockwaveActive) {
            const impactX = (ball1.x + ball2.x) / 2;
            const impactY = (ball1.y + ball2.y) / 2;
            
            balls.forEach(nearBall => {
              if (!nearBall.pocketed) {
                const ndx = nearBall.x - impactX;
                const ndy = nearBall.y - impactY;
                const ndist = Math.sqrt(ndx * ndx + ndy * ndy);
                if (ndist < 200 && ndist > 0) {
                  const force = (200 - ndist) / 200 * 8;
                  nearBall.vx += (ndx / ndist) * force;
                  nearBall.vy += (ndy / ndist) * force;
                }
              }
            });
            
            // Shockwave ring particles
            for (let i = 0; i < 50; i++) {
              const angle = (Math.PI * 2 * i) / 50;
              abilityEffectsRef.current.push({
                type: 'shockwave_ring',
                x: impactX,
                y: impactY,
                vx: Math.cos(angle) * 8,
                vy: Math.sin(angle) * 8,
                life: 1,
                size: 5,
                hue: 330
              });
            }
            triggerScreenShake(10, 400);
            triggerFlash('rgba(255, 100, 200, 0.5)', 0.5, 200);
          }
          
          // Earthquake - shake all balls randomly
          if (ball1.earthquakeActive || ball2.earthquakeActive) {
            balls.forEach(nearBall => {
              if (!nearBall.pocketed) {
                nearBall.vx += (Math.random() - 0.5) * 6;
                nearBall.vy += (Math.random() - 0.5) * 6;
              }
            });
            
            for (let i = 0; i < 60; i++) {
              abilityEffectsRef.current.push({
                type: 'earthquake',
                x: ball1.x + (Math.random() - 0.5) * 150,
                y: ball1.y + (Math.random() - 0.5) * 150,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 1,
                size: 3,
                hue: 35
              });
            }
            triggerScreenShake(15, 600);
            triggerFlash('rgba(200, 150, 50, 0.4)', 0.4, 300);
          }
          
          if (ball1.lightningActive || ball2.lightningActive) {
            // CHAIN LIGHTNING with visible arcs
            const impactX = (ball1.x + ball2.x) / 2;
            const impactY = (ball1.y + ball2.y) / 2;
            const lightningParticles = [];
            
            // Core lightning burst - Reduced count for performance
            for (let p = 0; p < 40; p++) {
              const angle = Math.random() * Math.PI * 2;
              const dist = Math.random() * 80;
              lightningParticles.push({
                type: 'lightning',
                x: impactX + Math.cos(angle) * dist,
                y: impactY + Math.sin(angle) * dist,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 1,
                size: 3,
                hue: 60
              });
            }
            
            // Electric arcs - Reduced segments
            for (let i = 0; i < 8; i++) {
              const angle = (Math.PI * 2 * i) / 8;
              for (let seg = 0; seg < 8; seg++) {
                lightningParticles.push({
                  type: 'lightning_arc',
                  x: impactX + Math.cos(angle) * seg * 8,
                  y: impactY + Math.sin(angle) * seg * 8,
                  vx: Math.cos(angle) * 2,
                  vy: Math.sin(angle) * 2,
                  life: 1,
                  size: 2,
                  hue: 60,
                  arcIndex: i
                });
              }
            }
            
            abilityEffectsRef.current.push(...lightningParticles);
            triggerScreenShake(4, 200);
            triggerFlash('rgba(255, 255, 100, 0.4)', 0.4, 200);
            
            // Chain to ALL nearby balls with dramatic effect
            balls.forEach(nearBall => {
              if (nearBall !== ball1 && nearBall !== ball2 && !nearBall.pocketed) {
                const ndx = nearBall.x - impactX;
                const ndy = nearBall.y - impactY;
                const ndist = Math.sqrt(ndx * ndx + ndy * ndy);
                if (ndist < 200) {
                  const force = (200 - ndist) / 200 * 3;
                  nearBall.vx += (Math.random() - 0.5) * force;
                  nearBall.vy += (Math.random() - 0.5) * force;
                  
                  // Create arc to chained ball - Reduced count
                  for (let seg = 0; seg < 8; seg++) {
                    const t = seg / 8;
                    lightningParticles.push({
                      type: 'chain_arc',
                      x: impactX + (ndx * t) + (Math.random() - 0.5) * 15,
                      y: impactY + (ndy * t) + (Math.random() - 0.5) * 15,
                      vx: 0,
                      vy: 0,
                      life: 0.8,
                      size: 2,
                      hue: 60
                    });
                  }
                }
              }
            });
            
            abilityEffectsRef.current.push(...lightningParticles);
          }
          
          if (ball1.quantumSplit || ball2.quantumSplit) {
            // QUANTUM SPLIT - create ACTUAL ghost balls
            const impactX = (ball1.x + ball2.x) / 2;
            const impactY = (ball1.y + ball2.y) / 2;
            const splitParticles = [];
            
            // Portal effect
            for (let ring = 0; ring < 8; ring++) {
              for (let p = 0; p < 24; p++) {
                const angle = (Math.PI * 2 * p) / 24 + ring * 0.3;
                const radius = ring * 10;
                splitParticles.push({
                  type: 'quantum',
                  x: impactX + Math.cos(angle) * radius,
                  y: impactY + Math.sin(angle) * radius,
                  vx: Math.cos(angle) * (1 + ring * 0.3),
                  vy: Math.sin(angle) * (1 + ring * 0.3),
                  life: 1,
                  size: 3 + ring * 0.5,
                  hue: 280
                });
              }
            }
            
            // Create ghost ball projectiles
            const newGhostBalls = [];
            for (let i = 0; i < 6; i++) {
              const angle = (Math.PI * 2 * i) / 6;
              newGhostBalls.push({
                x: impactX,
                y: impactY,
                vx: Math.cos(angle) * 4,
                vy: Math.sin(angle) * 4,
                life: 1,
                size: BALL_RADIUS * 0.8,
                hue: 280
              });
            }
            setGhostBalls(prev => [...prev, ...newGhostBalls]);
            
            abilityEffectsRef.current.push(...splitParticles);
            triggerScreenShake(3, 250);
            triggerFlash('rgba(200, 100, 255, 0.5)', 0.5, 250);
          }
          
          // Create ripple effect on collision
          rippleRef.current.push({
            x: (ball1.x + ball2.x) / 2,
            y: (ball1.y + ball2.y) / 2,
            radius: 0,
            maxRadius: 50,
            alpha: 1,
            time: 0
          });
          
          // Create impact particles
          const particleCount = Math.min(Math.floor(impactSpeed * 2), 15);
          const newParticles = [];
          for (let p = 0; p < particleCount; p++) {
            const angle = (Math.PI * 2 * p) / particleCount;
            newParticles.push({
              x: (ball1.x + ball2.x) / 2,
              y: (ball1.y + ball2.y) / 2,
              vx: Math.cos(angle) * impactSpeed * 0.5,
              vy: Math.sin(angle) * impactSpeed * 0.5,
              life: 1,
              size: 2 + Math.random() * 2,
              hue: 180 + Math.random() * 60
            });
          }
          setImpactParticles(prev => [...prev, ...newParticles]);
          
          const angle = Math.atan2(dy, dx);
          const sin = Math.sin(angle);
          const cos = Math.cos(angle);
          
          const x1 = 0;
          const y1 = 0;
          const x2 = dx * cos + dy * sin;
          const y2 = dy * cos - dx * sin;
          
          const vx1 = ball1.vx * cos + ball1.vy * sin;
          const vy1 = ball1.vy * cos - ball1.vx * sin;
          const vx2 = ball2.vx * cos + ball2.vy * sin;
          const vy2 = ball2.vy * cos - ball2.vx * sin;
          
          const newVx1 = vx2;
          const newVx2 = vx1;
          
          const overlap = ball1.radius + ball2.radius - distance;
          const separationX = (overlap * cos) / 2;
          const separationY = (overlap * sin) / 2;
          
          ball1.x -= separationX;
          ball1.y -= separationY;
          ball2.x += separationX;
          ball2.y += separationY;
          
          ball1.vx = newVx1 * cos - vy1 * sin;
          ball1.vy = vy1 * cos + newVx1 * sin;
          ball2.vx = newVx2 * cos - vy2 * sin;
          ball2.vy = vy2 * cos + newVx2 * sin;
        }
      }
    }
    
    balls.forEach(ball => {
      const minX = CUSHION_WIDTH + ball.radius;
      const maxX = TABLE_WIDTH - CUSHION_WIDTH - ball.radius;
      const minY = CUSHION_WIDTH + ball.radius;
      const maxY = TABLE_HEIGHT - CUSHION_WIDTH - ball.radius;
      
      if (ball.x < minX || ball.x > maxX) {
        ball.vx *= -BOUNCE_DAMPING;
        ball.x = ball.x < minX ? minX : maxX;
        
        // Create ripple on wall bounce
        rippleRef.current.push({
          x: ball.x,
          y: ball.y,
          radius: 0,
          maxRadius: 40,
          alpha: 1,
          time: 0
        });
      }
      
      if (ball.y < minY || ball.y > maxY) {
        ball.vy *= -BOUNCE_DAMPING;
        ball.y = ball.y < minY ? minY : maxY;
        
        // Create ripple on wall bounce
        rippleRef.current.push({
          x: ball.x,
          y: ball.y,
          radius: 0,
          maxRadius: 40,
          alpha: 1,
          time: 0
        });
      }
    });
    
    balls.forEach(ball => {
      gameStateRef.current.pockets.forEach(pocket => {
        const dx = ball.x - pocket.x;
        const dy = ball.y - pocket.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < pocket.radius) {
          ball.pocketed = true;
          ball.vx = 0;
          ball.vy = 0;
          gameStateRef.current.pocketedBalls.push(ball);
          
          // Enhanced pocket particle effects
          if (enhancedEffects) {
            const pocketParticles = [];
            for (let i = 0; i < 30; i++) {
              const angle = (Math.PI * 2 * i) / 30;
              pocketParticles.push({
                x: pocket.x,
                y: pocket.y,
                vx: Math.cos(angle) * (2 + Math.random() * 3),
                vy: Math.sin(angle) * (2 + Math.random() * 3),
                life: 1,
                size: 2 + Math.random() * 3,
                hue: ball.type === 'cue' ? 200 : (ball.type === 'eight' ? 0 : 180)
              });
            }
            setImpactParticles(prev => [...prev, ...pocketParticles]);
          }
          
          // Check for scratch (cue ball pocketed)
          if (ball.type === 'cue') {
            setCombo(0);
            setMaxComboThisGame(prev => Math.max(prev, combo));
            updateContent(TQL.set('currentCombo', 0));
            setFouls(prev => prev + 1);
            
            // Respawn cue ball at starting position
            setTimeout(() => {
              ball.pocketed = false;
              ball.x = tableDimensions.width * 0.25;
              ball.y = tableDimensions.height / 2;
            }, 1000);
            
            setGameState(prev => ({
              ...prev,
              lastPocketed: { ...ball, scratched: true }
            }));
          } else {
            // Regular ball pocketed - increment combo
            setTotalPocketedThisGame(prev => prev + 1);
            setCombo(prev => {
              const newCombo = prev + 1;
              setMaxComboThisGame(curr => Math.max(curr, newCombo));
              updateContent(TQL.set('currentCombo', newCombo));
              setShowCombo(true);
              setTimeout(() => setShowCombo(false), 2000);
              
              // Check combo achievements
              checkAchievements({
                totalPocketed: totalPocketedThisGame + 1,
                maxCombo: Math.max(maxComboThisGame, newCombo),
                totalShots: totalShots,
                gameFouls: fouls,
                currentScore: gameState.score[`player${gameStateRef.current.currentPlayer}`] + 1,
                gamesPlayed: content?.statistics?.gamesPlayed || 0
              });
              
              return newCombo;
            });
            
            setGameState(prev => ({
              ...prev,
              lastPocketed: ball,
              score: {
                ...prev.score,
                [`player${gameStateRef.current.currentPlayer}`]: prev.score[`player${gameStateRef.current.currentPlayer}`] + 1
              }
            }));
            
            if (ball.type === 'eight') {
              gameStateRef.current.gameOver = true;
              gameStateRef.current.winner = gameStateRef.current.currentPlayer;
              
              // Update statistics on game end
              setTimeout(() => {
                updateStatistics(
                  gameStateRef.current.currentPlayer,
                  totalShots,
                  maxComboThisGame,
                  fouls
                );
              }, 100);
              
              setGameState(prev => ({
                ...prev,
                gameOver: true,
                winner: gameStateRef.current.currentPlayer
              }));
            }
          }
        }
      });
    });
  }, [tableDimensions, combo, totalShots, fouls, updateStatistics]);

  const updatePhysics = useCallback(() => {
    let ballsMoving = false;
    let anyBallHasVelocity = false;
    
    // FPS Mode Logic - TRUE FIRST-PERSON IN-BALL CAMERA
    if (fpsMode) {
      // Smooth slow motion transition
      const targetTimeScale = 0.2;
      if (Math.abs(timeScale - targetTimeScale) > 0.01) {
        setTimeScale(prev => prev + (targetTimeScale - prev) * 0.15);
      }
      
      const cueBall = gameStateRef.current.balls.find(b => b.type === 'cue');
      const povCam = povCameraRef.current;
      const dt = 0.016; // Assuming 60fps
      
      if (cueBall) {
        povCam.frameCount++;
        
        // Smooth transition-in phase (0 to 1 over ~25 frames)
        if (povCam.transitionPhase < 1) {
          povCam.transitionPhase = Math.min(1, povCam.transitionPhase + 0.04);
        }
        const transitionEase = easeOutCubic(povCam.transitionPhase);
        
        const rawSpeed = Math.sqrt(cueBall.vx * cueBall.vx + cueBall.vy * cueBall.vy);
        
        // Multi-sample speed smoothing
        povCam.speedHistory.push(rawSpeed);
        if (povCam.speedHistory.length > 8) povCam.speedHistory.shift();
        const avgSpeed = povCam.speedHistory.reduce((a, b) => a + b, 0) / povCam.speedHistory.length;
        povCam.smoothedSpeed = expSmooth(povCam.smoothedSpeed, avgSpeed, 0.9, dt);
        const speed = povCam.smoothedSpeed;
        
        // Normalized speed factor
        const rawSpeedFactor = Math.min(speed, 25) / 25;
        const speedFactor = easeOutCubic(rawSpeedFactor);
        const speedFactorSlow = speedFactor * speedFactor;
        
        // === FIRST-PERSON: CAMERA LOCKED TO BALL CENTER ===
        // No lag - camera is AT the ball position
        const moveAngle = Math.atan2(cueBall.vy, cueBall.vx);
        
        // Minimal look-ahead for slight forward bias
        const lookAheadDistance = speed * 0.5;
        const lookAheadX = Math.cos(moveAngle) * lookAheadDistance;
        const lookAheadY = Math.sin(moveAngle) * lookAheadDistance;
        
        povCam.lookAheadX = expSmooth(povCam.lookAheadX, lookAheadX, 0.9, dt);
        povCam.lookAheadY = expSmooth(povCam.lookAheadY, lookAheadY, 0.9, dt);
        
        // === CAMERA POSITION: EXACTLY AT BALL ===
        povCam.targetX = cueBall.x - (tableDimensions.width / 2) + povCam.lookAheadX * 0.3;
        povCam.targetY = cueBall.y - (tableDimensions.height / 2) + povCam.lookAheadY * 0.3;
        
        // Initialize on first frame to prevent snap
        if (!povCam.initialized) {
          povCam.currentX = cueBall.x - (tableDimensions.width / 2);
          povCam.currentY = cueBall.y - (tableDimensions.height / 2);
          povCam.currentYaw = Math.atan2(cueBall.vx, cueBall.vy) * (180 / Math.PI);
          povCam.currentHeight = povCam.baseHeight;
          povCam.currentPitch = povCam.basePitch;
          povCam.currentFOV = povCam.baseFOV;
          povCam.transitionPhase = 0;
          povCam.speedHistory = [rawSpeed];
          povCam.initialized = true;
        }
        
        // Fast position tracking - camera stays with ball
        const positionSmooth = 0.85;
        povCam.currentX = expSmooth(povCam.currentX, povCam.targetX, positionSmooth, dt);
        povCam.currentY = expSmooth(povCam.currentY, povCam.targetY, positionSmooth, dt);
        
        // === CAMERA YAW: LOOK IN DIRECTION OF TRAVEL ===
        if (speed > 0.15) {
          const targetYaw = Math.atan2(cueBall.vx, cueBall.vy) * (180 / Math.PI);
          // Responsive yaw for first-person feel
          const yawSmooth = 0.92 - speedFactor * 0.1;
          povCam.currentYaw = smoothAngle(povCam.currentYaw, targetYaw, yawSmooth, dt);
        }
        
        // === CAMERA HEIGHT: STAY AT BALL LEVEL ===
        // Minimal height change - keeps view at ball elevation
        povCam.targetHeight = povCam.baseHeight + speedFactorSlow * 8;
        povCam.currentHeight = expSmooth(povCam.currentHeight, povCam.targetHeight, 0.95, dt);
        
        // === CAMERA PITCH: LOOK FORWARD (NEARLY HORIZONTAL) ===
        // Slight downward tilt at high speed to see table ahead
        povCam.targetPitch = povCam.basePitch - speedFactorSlow * 3;
        povCam.currentPitch = expSmooth(povCam.currentPitch, povCam.targetPitch, 0.95, dt);
        
        // === DYNAMIC FOV: WIDER AT SPEED ===
        povCam.targetFOV = povCam.baseFOV - speedFactorSlow * 0.06;
        povCam.currentFOV = expSmooth(povCam.currentFOV, povCam.targetFOV, 0.93, dt);
        
        // === STEERING LOGIC ===
        if (speed > 0.15) {
          let steerDirection = 0;
          if (steeringRef.current.left) steerDirection -= 1;
          if (steeringRef.current.right) steerDirection += 1;
          
          if (steerDirection !== 0) {
            // Responsive steering for first-person control
            const steerStrength = 0.04 + speedFactor * 0.04;
            const currentAngle = Math.atan2(cueBall.vy, cueBall.vx);
            const newAngle = currentAngle + (steerDirection * steerStrength);
            
            cueBall.vx = Math.cos(newAngle) * rawSpeed;
            cueBall.vy = Math.sin(newAngle) * rawSpeed;
          }
          
          // === CAMERA BANKING FOR STEERING FEEL ===
          povCam.targetBank = steerDirection * -povCam.maxBank * (0.6 + speedFactor * 0.4);
        } else {
          povCam.targetBank = 0;
        }
        
        // Responsive banking
        povCam.currentBank = expSmooth(povCam.currentBank, povCam.targetBank, 0.9, dt);
        bankingRef.current = povCam.currentBank;
        
        // === TRAIL PARTICLES ===
        if (speed > 1.5 && Math.random() < 0.25 + speedFactor * 0.2) {
          const offsetAngle = moveAngle + Math.PI + (Math.random() - 0.5) * 0.5;
          const offsetDist = 6 + Math.random() * 8;
          povCam.trailParticles.push({
            x: cueBall.x + Math.cos(offsetAngle) * offsetDist,
            y: cueBall.y + Math.sin(offsetAngle) * offsetDist,
            life: 1,
            size: 2 + Math.random() * 4,
            hue: 180 + Math.random() * 40
          });
        }
        // Limit particles
        if (povCam.trailParticles.length > 50) {
          povCam.trailParticles = povCam.trailParticles.slice(-50);
        }
        povCam.trailParticles = povCam.trailParticles.filter(p => {
          p.life -= 0.025;
          return p.life > 0;
        });
        
        // === SMOOTH AUTO-EXIT ===
        if (povCam.smoothedSpeed < 0.25 && povCam.frameCount > 35) {
          setFpsMode(false);
      setTimeScale(1);
          setTimeScale(1);
          // Reset for next use
          povCam.initialized = false;
          povCam.frameCount = 0;
          povCam.smoothedSpeed = 0;
          povCam.speedHistory = [];
          povCam.currentBank = 0;
          povCam.targetBank = 0;
          povCam.transitionPhase = 0;
          povCam.lagX = 0;
          povCam.lagY = 0;
          bankingRef.current = 0;
        }
      }
    }

    gameStateRef.current.balls.forEach(ball => {
      if (!ball.pocketed && !ball.frozen) {
        // Apply time scale for bullet time effect
        const scaledFriction = Math.pow(FRICTION, timeScale);
        ball.vx *= scaledFriction;
        ball.vy *= scaledFriction;
        
        // Check if ball has any significant velocity
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const hasVelocity = speed >= MIN_VELOCITY;
        
        if (!hasVelocity) {
          ball.vx = 0;
          ball.vy = 0;
          
          // Clear ability effects when ball stops
          if (ball.activeAbility) {
            ball.activeAbility = null;
            ball.lightningActive = false;
            ball.lightningCharge = 0;
            ball.quantumSplit = false;
            ball.quantumCharge = 0;
            ball.blackHole = null;
            ball.magneticPull = false;
            ball.vortexActive = false;
            ball.laserTrail = false;
            ball.shockwaveActive = false;
            ball.earthquakeActive = false;
            ball.phantomPhase = false;
            ball.phantomUsed = false;
          }
        } else {
          ballsMoving = true;
          anyBallHasVelocity = true;

          // --- 3D Rolling Physics ---
          // Calculate rotation axis (perpendicular to velocity)
          // Velocity (vx, vy, 0) -> Axis (-vy, vx, 0)
          // We normalize this axis
          if (ball.pole) {
            const rotAxisX = -ball.vy;
            const rotAxisY = ball.vx;
            const rotAxisLen = Math.sqrt(rotAxisX * rotAxisX + rotAxisY * rotAxisY);
            
            if (rotAxisLen > 0.001) {
              const normalizedAxis = { x: rotAxisX / rotAxisLen, y: rotAxisY / rotAxisLen, z: 0 };
              // Rotation angle = distance / radius
              // distance = speed * timeScale
              const angle = (speed * timeScale) / ball.radius;
              
              ball.pole = rotateVector(ball.pole, normalizedAxis, angle);
              
              // Normalize pole to prevent drift
              const poleLen = Math.sqrt(ball.pole.x * ball.pole.x + ball.pole.y * ball.pole.y + ball.pole.z * ball.pole.z);
              ball.pole.x /= poleLen;
              ball.pole.y /= poleLen;
              ball.pole.z /= poleLen;
            }
          }
        }
        
        // Apply time-scaled movement
        ball.x += ball.vx * timeScale;
        ball.y += ball.vy * timeScale;
        
        // Black hole gravity effect - ENHANCED
        if (ball.blackHole) {
          gameStateRef.current.balls.forEach(targetBall => {
            if (targetBall.id !== ball.id && !targetBall.pocketed && !targetBall.frozen) {
              const dx = ball.x - targetBall.x;
              const dy = ball.y - targetBall.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (distance < ball.blackHole.radius && distance > BALL_RADIUS * 2) {
                const force = (ball.blackHole.strength * 50) / Math.max(distance * distance, 100);
                targetBall.vx += (dx / distance) * force;
                targetBall.vy += (dy / distance) * force;
                
                // Add spiraling particle trail
                if (Math.random() < 0.3) {
                  abilityEffectsRef.current.push({
                    type: 'gravity_trail',
                    x: targetBall.x,
                    y: targetBall.y,
                    vx: (dx / distance) * 2,
                    vy: (dy / distance) * 2,
                    life: 1,
                    size: 2,
                    hue: 270
                  });
                }
              }
            }
          });
        }
        
        // Magnetic pull effect - attract nearby balls
        if (ball.magneticPull) {
          gameStateRef.current.balls.forEach(targetBall => {
            if (targetBall.id !== ball.id && !targetBall.pocketed && !targetBall.frozen) {
              const dx = ball.x - targetBall.x;
              const dy = ball.y - targetBall.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (distance < ball.magneticPull.radius && distance > BALL_RADIUS * 2) {
                const force = ball.magneticPull.strength * (1 - distance / ball.magneticPull.radius);
                targetBall.vx += (dx / distance) * force;
                targetBall.vy += (dy / distance) * force;
                
                if (Math.random() < 0.2) {
                  abilityEffectsRef.current.push({
                    type: 'magnetic',
                    x: targetBall.x,
                    y: targetBall.y,
                    vx: (dx / distance) * 1.5,
                    vy: (dy / distance) * 1.5,
                    life: 0.8,
                    size: 2,
                    hue: 0
                  });
                }
              }
            }
          });
        }
        
        // Vortex spin effect - curve nearby ball paths
        if (ball.vortexActive) {
          ball.vortexActive.angle += 0.1;
          gameStateRef.current.balls.forEach(targetBall => {
            if (targetBall.id !== ball.id && !targetBall.pocketed && !targetBall.frozen) {
              const dx = ball.x - targetBall.x;
              const dy = ball.y - targetBall.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (distance < ball.vortexActive.radius && distance > BALL_RADIUS * 2) {
                // Add tangential force for spinning
                const tangentX = -dy / distance;
                const tangentY = dx / distance;
                const force = ball.vortexActive.strength * (1 - distance / ball.vortexActive.radius);
                targetBall.vx += tangentX * force;
                targetBall.vy += tangentY * force;
              }
            }
          });
        }
        
        // Laser trail - record path and affect nearby balls
        if (ball.laserTrail) {
          ball.laserPoints = ball.laserPoints || [];
          if (ball.laserPoints.length === 0 || 
              Math.sqrt(Math.pow(ball.x - ball.laserPoints[ball.laserPoints.length-1]?.x || 0, 2) + 
                       Math.pow(ball.y - ball.laserPoints[ball.laserPoints.length-1]?.y || 0, 2)) > 10) {
            ball.laserPoints.push({ x: ball.x, y: ball.y, life: 1 });
          }
          
          // Laser points push nearby balls
          ball.laserPoints.forEach(point => {
            point.life -= 0.01;
            gameStateRef.current.balls.forEach(targetBall => {
              if (targetBall.id !== ball.id && !targetBall.pocketed) {
                const dx = targetBall.x - point.x;
                const dy = targetBall.y - point.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 30 && distance > 0) {
                  targetBall.vx += (dx / distance) * 0.3;
                  targetBall.vy += (dy / distance) * 0.3;
                }
              }
            });
          });
          ball.laserPoints = ball.laserPoints.filter(p => p.life > 0);
        }
      }
    });
    
    // Update ghost balls physics
    setGhostBalls(prev => prev.filter(ghost => {
      if (ghost.life <= 0) return false;
      
      ghost.x += ghost.vx;
      ghost.y += ghost.vy;
      ghost.vx *= 0.98;
      ghost.vy *= 0.98;
      ghost.life -= 0.02;
      
      // Ghost balls can push real balls
      gameStateRef.current.balls.forEach(ball => {
        if (!ball.pocketed) {
          const dx = ball.x - ghost.x;
          const dy = ball.y - ghost.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < BALL_RADIUS * 2) {
            const force = 0.5;
            ball.vx += (dx / distance) * force;
            ball.vy += (dy / distance) * force;
          }
        }
      });
      
      return true;
    }));
    
    checkCollisions();
    
    // Shot complete: all balls have stopped moving
    if (!ballsMoving && shotInProgressRef.current && !gameStateRef.current.balls.some(ball => ball.type === 'cue' && ball.pocketed)) {
      console.log('Shot complete - all balls stopped');
      
      // Update ref first for immediate synchronous checks
      shotInProgressRef.current = false;
      
      const nextPlayer = gameStateRef.current.currentPlayer === 1 ? 2 : 1;
      gameStateRef.current.currentPlayer = nextPlayer;
      
      // Save game state
      updateContent(TQL.set('savedGame', {
        balls: structuredClone(gameStateRef.current.balls),
        score: gameState.score, // Use current score from state (updated during collision)
        currentPlayer: nextPlayer,
        pockets: gameStateRef.current.pockets,
        timestamp: Date.now()
      }));

      // Then update state (async)
      setGameState(prev => ({
        ...prev,
        shotInProgress: false,
        currentPlayer: nextPlayer
      }));
      
      // Regenerate energy slowly after shot
      setAbilityEnergy(prev => Math.min(100, prev + 10));
    }
  }, [checkCollisions, timeScale, gameState.score]);

  // ==================== 3D RENDERING FUNCTIONS ====================
  
  const draw3DEnvironment = useCallback((ctx, TABLE_WIDTH, TABLE_HEIGHT) => {
    const centerX = TABLE_WIDTH / 2;
    const centerY = TABLE_HEIGHT / 2;
    const r3d = render3DRef.current;
    const floorZ = -r3d.floorDepth;
    const roomSize = r3d.roomSize;

    // 1. Draw Floor
    // Create a grid of points for the floor
    const gridSize = 200;
    const gridExtent = 6; // How many grid cells out from center

    // Draw floor tiles
    for (let x = -gridExtent; x < gridExtent; x++) {
      for (let y = -gridExtent; y < gridExtent; y++) {
        const x1 = x * gridSize;
        const y1 = y * gridSize;
        const x2 = (x + 1) * gridSize;
        const y2 = (y + 1) * gridSize;

        // Project 4 corners of tile
        const p1 = perspective3D(x1, y1, floorZ, centerX, centerY);
        const p2 = perspective3D(x2, y1, floorZ, centerX, centerY);
        const p3 = perspective3D(x2, y2, floorZ, centerX, centerY);
        const p4 = perspective3D(x1, y2, floorZ, centerX, centerY);

        if (p1.visible && p2.visible && p3.visible && p4.visible) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.lineTo(p4.x, p4.y);
          ctx.closePath();

          // Checkerboard pattern with distance fade
          const isDark = (x + y) % 2 === 0;
          const dist = Math.sqrt(x * x + y * y);
          const alpha = Math.max(0, 1 - dist / gridExtent); // Fade out at edges

          if (isDark) {
            ctx.fillStyle = `rgba(10, 15, 25, ${alpha})`;
          } else {
            ctx.fillStyle = `rgba(20, 30, 45, ${alpha})`;
          }
          ctx.fill();

          // Grid lines
          ctx.strokeStyle = `rgba(60, 100, 160, ${alpha * 0.3})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    
    // 2. Fake Reflection of Table on Floor
    const tableShadowP1 = perspective3D(-TABLE_WIDTH/2, -TABLE_HEIGHT/2, floorZ, centerX, centerY);
    const tableShadowP2 = perspective3D(TABLE_WIDTH/2, -TABLE_HEIGHT/2, floorZ, centerX, centerY);
    const tableShadowP3 = perspective3D(TABLE_WIDTH/2, TABLE_HEIGHT/2, floorZ, centerX, centerY);
    const tableShadowP4 = perspective3D(-TABLE_WIDTH/2, TABLE_HEIGHT/2, floorZ, centerX, centerY);
    
    if (tableShadowP1.visible) {
      ctx.beginPath();
      ctx.moveTo(tableShadowP1.x, tableShadowP1.y);
      ctx.lineTo(tableShadowP2.x, tableShadowP2.y);
      ctx.lineTo(tableShadowP3.x, tableShadowP3.y);
      ctx.lineTo(tableShadowP4.x, tableShadowP4.y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.filter = 'blur(20px)';
      ctx.fill();
      ctx.filter = 'none';
    }

  }, [perspective3D]);

  const draw3DTableStructure = useCallback((ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH) => {
    const centerX = TABLE_WIDTH / 2;
    const centerY = TABLE_HEIGHT / 2;
    const r3d = render3DRef.current;
    
    // Structure Dimensions
    const cabinetHeight = 25; // Height of the wooden box under cushions
    const legWidth = 18;
    const legInset = CUSHION_WIDTH * 1.5;
    const floorZ = -r3d.floorDepth;
    const cabinetBottomZ = -cabinetHeight;
    const cabinetTopZ = -r3d.tableDepth; // Meets the felt/cushions
    
    const halfW = TABLE_WIDTH / 2;
    const halfH = TABLE_HEIGHT / 2;

    // Helper to draw a 3D Quad face
    const drawFace = (corners, color, border = null) => {
      if (!corners[0].visible) return;
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      corners.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      if (border) {
        ctx.strokeStyle = border;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    // --- LEGS ---
    // Positions relative to center
    const legPositions = [
      { x: -halfW + legInset, y: -halfH + legInset }, // Top Left
      { x: halfW - legInset, y: -halfH + legInset },  // Top Right
      { x: halfW - legInset, y: halfH - legInset },   // Bottom Right
      { x: -halfW + legInset, y: halfH - legInset }   // Bottom Left
    ];

    legPositions.forEach(pos => {
      const lx = pos.x;
      const ly = pos.y;
      const lw = legWidth / 2;
      
      // Leg Vertices
      // Top (at cabinet bottom)
      const t1 = perspective3D(lx - lw, ly - lw, cabinetBottomZ, centerX, centerY);
      const t2 = perspective3D(lx + lw, ly - lw, cabinetBottomZ, centerX, centerY);
      const t3 = perspective3D(lx + lw, ly + lw, cabinetBottomZ, centerX, centerY);
      const t4 = perspective3D(lx - lw, ly + lw, cabinetBottomZ, centerX, centerY);
      
      // Bottom (at floor)
      const b1 = perspective3D(lx - lw, ly - lw, floorZ, centerX, centerY);
      const b2 = perspective3D(lx + lw, ly - lw, floorZ, centerX, centerY);
      const b3 = perspective3D(lx + lw, ly + lw, floorZ, centerX, centerY);
      const b4 = perspective3D(lx - lw, ly + lw, floorZ, centerX, centerY);

      // Draw faces (simple painter's sort for a box: draw back faces first? 
      // Actually for vertical legs viewed from above, we mostly see side faces)
      
      // Colors
      const legColorDark = '#1a0f0a';
      const legColorMid = '#2d1a12';
      const legColorLight = '#3e2419';
      
      // Draw all sides - occlusion handles itself roughly due to small size vs distance
      // Front/Back/Left/Right faces
      drawFace([t1, t2, b2, b1], legColorMid);   // North
      drawFace([t2, t3, b3, b2], legColorLight); // East
      drawFace([t3, t4, b4, b3], legColorMid);   // South
      drawFace([t4, t1, b1, b4], legColorDark);  // West
      
      // Chrome/Metal foot details
      const footHeight = 5;
      const fZ = floorZ + footHeight;
      const ft1 = perspective3D(lx - lw - 1, ly - lw - 1, fZ, centerX, centerY);
      const ft2 = perspective3D(lx + lw + 1, ly - lw - 1, fZ, centerX, centerY);
      const ft3 = perspective3D(lx + lw + 1, ly + lw + 1, fZ, centerX, centerY);
      const ft4 = perspective3D(lx - lw - 1, ly + lw + 1, fZ, centerX, centerY);
      
      const fb1 = perspective3D(lx - lw - 1, ly - lw - 1, floorZ, centerX, centerY);
      const fb2 = perspective3D(lx + lw + 1, ly - lw - 1, floorZ, centerX, centerY);
      const fb3 = perspective3D(lx + lw + 1, ly + lw + 1, floorZ, centerX, centerY);
      const fb4 = perspective3D(lx - lw - 1, ly + lw + 1, floorZ, centerX, centerY);
      
      drawFace([ft2, ft3, fb3, fb2], '#a0a0a0'); // Chrome side
      drawFace([ft3, ft4, fb4, fb3], '#808080'); // Chrome side
    });

    // --- CABINET / BODY ---
    // The main box under the table
    // Outer boundary (slightly inset from cushions)
    const cabInset = CUSHION_WIDTH * 0.5;
    const cx1 = -halfW + cabInset;
    const cx2 = halfW - cabInset;
    const cy1 = -halfH + cabInset;
    const cy2 = halfH - cabInset;
    
    // Vertices Top (meet cushions)
    const ct1 = perspective3D(cx1, cy1, cabinetTopZ, centerX, centerY);
    const ct2 = perspective3D(cx2, cy1, cabinetTopZ, centerX, centerY);
    const ct3 = perspective3D(cx2, cy2, cabinetTopZ, centerX, centerY);
    const ct4 = perspective3D(cx1, cy2, cabinetTopZ, centerX, centerY);
    
    // Vertices Bottom (meet legs)
    const cb1 = perspective3D(cx1, cy1, cabinetBottomZ, centerX, centerY);
    const cb2 = perspective3D(cx2, cy1, cabinetBottomZ, centerX, centerY);
    const cb3 = perspective3D(cx2, cy2, cabinetBottomZ, centerX, centerY);
    const cb4 = perspective3D(cx1, cy2, cabinetBottomZ, centerX, centerY);
    
    // Wood Gradient
    const woodDark = '#251208';
    const woodLight = '#4d2612';
    
    // Bottom panel (facing down, usually invisible unless looking up, but draw for completeness)
    drawFace([cb1, cb2, cb3, cb4], '#150a05');
    
    // Sides
    // North Face
    const gradN = ctx.createLinearGradient(ct1.x, ct1.y, cb1.x, cb1.y);
    gradN.addColorStop(0, woodLight); gradN.addColorStop(1, woodDark);
    drawFace([ct1, ct2, cb2, cb1], gradN);
    
    // East Face
    const gradE = ctx.createLinearGradient(ct2.x, ct2.y, cb3.x, cb3.y);
    gradE.addColorStop(0, woodLight); gradE.addColorStop(1, woodDark);
    drawFace([ct2, ct3, cb3, cb2], gradE);
    
    // South Face
    const gradS = ctx.createLinearGradient(ct3.x, ct3.y, cb4.x, cb4.y);
    gradS.addColorStop(0, woodLight); gradS.addColorStop(1, woodDark);
    drawFace([ct3, ct4, cb4, cb3], gradS);
    
    // West Face
    const gradW = ctx.createLinearGradient(ct4.x, ct4.y, cb1.x, cb1.y);
    gradW.addColorStop(0, woodLight); gradW.addColorStop(1, woodDark);
    drawFace([ct4, ct1, cb1, cb4], gradW);
    
    // Decorative trim line around cabinet
    ctx.strokeStyle = '#6b3014';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cb1.x, cb1.y); ctx.lineTo(cb2.x, cb2.y); ctx.lineTo(cb3.x, cb3.y); ctx.lineTo(cb4.x, cb4.y); ctx.closePath();
    ctx.stroke();

  }, [perspective3D]);

  const draw3DTableSurface = useCallback((ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH) => {
    const centerX = TABLE_WIDTH / 2;
    const centerY = TABLE_HEIGHT / 2;
    const r3d = render3DRef.current;
    
    // Calculate table corners
    const corners = [
      { x: CUSHION_WIDTH, y: CUSHION_WIDTH },
      { x: TABLE_WIDTH - CUSHION_WIDTH, y: CUSHION_WIDTH },
      { x: TABLE_WIDTH - CUSHION_WIDTH, y: TABLE_HEIGHT - CUSHION_WIDTH },
      { x: CUSHION_WIDTH, y: TABLE_HEIGHT - CUSHION_WIDTH }
    ];
    
    // Project corners
    const c3d = corners.map(c => 
      perspective3D(c.x - centerX, c.y - centerY, -r3d.tableDepth, centerX, centerY)
    );
    
    if (!c3d[0].visible) return; // Skip if behind camera
    
    // 1. Base Felt - Ultra High Quality Gradient with Vignette
    ctx.beginPath();
    ctx.moveTo(c3d[0].x, c3d[0].y);
    c3d.forEach(c => ctx.lineTo(c.x, c.y));
    ctx.closePath();
    
    // Create rich gradient based on projected coordinates
    const grad = ctx.createRadialGradient(
      centerX, centerY - 100, 0,
      centerX, centerY, Math.max(TABLE_WIDTH, TABLE_HEIGHT)
    );
    // Project the gradient center to 3D for correctness
    const gradCenter = perspective3D(0, 0, -r3d.tableDepth, centerX, centerY);
    const gradRadius = Math.max(TABLE_WIDTH, TABLE_HEIGHT) * gradCenter.scale;
    
    const feltGrad = ctx.createRadialGradient(
      gradCenter.x, gradCenter.y, 0,
      gradCenter.x, gradCenter.y, gradRadius
    );
    
    feltGrad.addColorStop(0, '#1a6b45'); // Brighter center (spotlight effect)
    feltGrad.addColorStop(0.4, '#0f5e3d'); // Mid tone
    feltGrad.addColorStop(0.8, '#0a4a2e'); // Shadowed edges
    feltGrad.addColorStop(1, '#022114'); // Deep corners
    
    ctx.fillStyle = feltGrad;
    ctx.fill();
    
    // 2. Enhanced Micro-texture (Noise) - Denser and more realistic
    if (renderQuality > 0.3) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.06;
      
      // Use a consistent seed for noise to prevent flickering if possible, 
      // but random is fine for static table. 
      // We draw noise in 3D space to match perspective.
      const noiseCount = renderQuality > 0.8 ? 800 : 300;
      
      ctx.beginPath();
      for (let i = 0; i < noiseCount; i++) {
         const nx = (Math.random() * (TABLE_WIDTH - 2*CUSHION_WIDTH)) + CUSHION_WIDTH;
         const ny = (Math.random() * (TABLE_HEIGHT - 2*CUSHION_WIDTH)) + CUSHION_WIDTH;
         const np = perspective3D(nx - centerX, ny - centerY, -r3d.tableDepth, centerX, centerY);
         
         if (np.visible) {
            // Draw tiny diamonds instead of rects for better anti-aliasing look
            const size = (Math.random() * 1.5 + 0.5) * np.scale;
            ctx.moveTo(np.x, np.y - size);
            ctx.lineTo(np.x + size, np.y);
            ctx.lineTo(np.x, np.y + size);
            ctx.lineTo(np.x - size, np.y);
         }
      }
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      
      // Dark noise pass
      ctx.beginPath();
      for (let i = 0; i < noiseCount / 2; i++) {
         const nx = (Math.random() * (TABLE_WIDTH - 2*CUSHION_WIDTH)) + CUSHION_WIDTH;
         const ny = (Math.random() * (TABLE_HEIGHT - 2*CUSHION_WIDTH)) + CUSHION_WIDTH;
         const np = perspective3D(nx - centerX, ny - centerY, -r3d.tableDepth, centerX, centerY);
         if (np.visible) {
            const size = (Math.random() * 1.5 + 0.5) * np.scale;
            ctx.rect(np.x, np.y, size, size);
         }
      }
      ctx.fillStyle = '#000000';
      ctx.fill();
      
      ctx.restore();
    }
    
    // 3. Dynamic Shadows from Cushions (Fake AO)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(c3d[0].x, c3d[0].y);
    c3d.forEach(c => ctx.lineTo(c.x, c.y));
    ctx.closePath();
    ctx.clip();
    
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 15 * c3d[0].scale;
    ctx.stroke(); // Inner shadow
    ctx.restore();
    
    // 4. Diamond Inlays (Markers)
    const drawDiamond = (tx, ty) => {
      const p = perspective3D(tx - centerX, ty - centerY, -r3d.tableDepth, centerX, centerY);
      if (!p.visible) return;
      const s = 4 * p.scale;
      ctx.fillStyle = '#e0e0e0';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - s);
      ctx.lineTo(p.x + s*0.6, p.y);
      ctx.lineTo(p.x, p.y + s);
      ctx.lineTo(p.x - s*0.6, p.y);
      ctx.fill();
    };
    
    // Draw diamonds on rails (approximate positions on cushion edge)
    const railOffset = CUSHION_WIDTH * 1.5;
    [0.25, 0.5, 0.75].forEach(t => {
       drawDiamond(TABLE_WIDTH * t, railOffset);
       drawDiamond(TABLE_WIDTH * t, TABLE_HEIGHT - railOffset);
    });
    [0.25, 0.5, 0.75].forEach(t => {
       drawDiamond(railOffset, TABLE_HEIGHT * t);
       drawDiamond(TABLE_WIDTH - railOffset, TABLE_HEIGHT * t);
    });
    
  }, [perspective3D, renderQuality]);

  const draw3DCushions = useCallback((ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH) => {
    const centerX = TABLE_WIDTH / 2;
    const centerY = TABLE_HEIGHT / 2;
    const r3d = render3DRef.current;
    const cushionH = r3d.cushionHeight;
    const railWidth = CUSHION_WIDTH * 1.5;

    // 1. Draw The Wood Frame (Base)
    const frameOuter = [
      perspective3D(-centerX - railWidth, -centerY - railWidth, cushionH, centerX, centerY),
      perspective3D(TABLE_WIDTH - centerX + railWidth, -centerY - railWidth, cushionH, centerX, centerY),
      perspective3D(TABLE_WIDTH - centerX + railWidth, TABLE_HEIGHT - centerY + railWidth, cushionH, centerX, centerY),
      perspective3D(-centerX - railWidth, TABLE_HEIGHT - centerY + railWidth, cushionH, centerX, centerY)
    ];
    
    const frameInner = [
      perspective3D(-centerX, -centerY, cushionH, centerX, centerY),
      perspective3D(TABLE_WIDTH - centerX, -centerY, cushionH, centerX, centerY),
      perspective3D(TABLE_WIDTH - centerX, TABLE_HEIGHT - centerY, cushionH, centerX, centerY),
      perspective3D(-centerX, TABLE_HEIGHT - centerY, cushionH, centerX, centerY)
    ];

    // Enhanced Rich Mahogany Gradient
    const woodGrad = ctx.createLinearGradient(frameOuter[0].x, frameOuter[0].y, frameOuter[2].x, frameOuter[2].y);
    woodGrad.addColorStop(0, '#2a1208');
    woodGrad.addColorStop(0.2, '#4d220e');
    woodGrad.addColorStop(0.5, '#6b3014');
    woodGrad.addColorStop(0.8, '#4d220e');
    woodGrad.addColorStop(1, '#2a1208');

    ctx.fillStyle = woodGrad;
    ctx.beginPath();
    ctx.moveTo(frameOuter[0].x, frameOuter[0].y);
    frameOuter.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(frameOuter[0].x, frameOuter[0].y);
    ctx.moveTo(frameInner[0].x, frameInner[0].y);
    for(let i = 3; i >= 0; i--) ctx.lineTo(frameInner[i].x, frameInner[i].y);
    ctx.lineTo(frameInner[0].x, frameInner[0].y);
    ctx.fill();

    // Enhanced Wood Grain
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for(let i=0; i<50; i++) {
        const t = i/50;
        const yOff = (Math.random() - 0.5) * 15;
        const p1 = perspective3D(-centerX, -centerY - railWidth * t, cushionH, centerX, centerY);
        const p2 = perspective3D(TABLE_WIDTH - centerX, -centerY - railWidth * t + yOff, cushionH, centerX, centerY);
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    }
    ctx.stroke();
    ctx.restore();

    // Strong Specular Reflection (Polished Varnish Look)
    const reflectGrad = ctx.createLinearGradient(
      frameOuter[0].x, frameOuter[0].y, 
      frameOuter[1].x, frameOuter[1].y
    );
    reflectGrad.addColorStop(0, 'rgba(255,255,255,0.05)');
    reflectGrad.addColorStop(0.2, 'rgba(255,255,255,0.25)'); // Sharp highlight
    reflectGrad.addColorStop(0.4, 'rgba(255,255,255,0.05)');
    reflectGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = reflectGrad;
    ctx.fill();

    // 2. Draw Cushions (The angled felt parts)
    const drawCushionSegment = (p1, p2, p3, p4, isHorizontal) => {
        const grad = ctx.createLinearGradient(p1.x, p1.y, p4.x, p4.y);
        grad.addColorStop(0, '#031a0e'); // Deeper shadow
        grad.addColorStop(1, '#0f6b42');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.fill();
        
        // Crisp edge highlight for definition
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
        ctx.stroke();
    };

    // Helper for cushion geometry
    const cDepth = -r3d.tableDepth; // Base of cushion (on table)
    const cTop = cushionH - r3d.tableDepth; // Top of cushion
    
    // Top Cushion
    const tc1 = perspective3D(CUSHION_WIDTH*1.5 - centerX, CUSHION_WIDTH - centerY, cDepth, centerX, centerY);
    const tc2 = perspective3D(TABLE_WIDTH - CUSHION_WIDTH*1.5 - centerX, CUSHION_WIDTH - centerY, cDepth, centerX, centerY);
    const tc3 = perspective3D(TABLE_WIDTH - CUSHION_WIDTH - centerX, 0 - centerY, cTop, centerX, centerY);
    const tc4 = perspective3D(CUSHION_WIDTH - centerX, 0 - centerY, cTop, centerX, centerY);
    drawCushionSegment(tc1, tc2, tc3, tc4, true);

    // Bottom Cushion
    const bc1 = perspective3D(CUSHION_WIDTH*1.5 - centerX, TABLE_HEIGHT - CUSHION_WIDTH - centerY, cDepth, centerX, centerY);
    const bc2 = perspective3D(TABLE_WIDTH - CUSHION_WIDTH*1.5 - centerX, TABLE_HEIGHT - CUSHION_WIDTH - centerY, cDepth, centerX, centerY);
    const bc3 = perspective3D(TABLE_WIDTH - CUSHION_WIDTH - centerX, TABLE_HEIGHT - centerY, cTop, centerX, centerY);
    const bc4 = perspective3D(CUSHION_WIDTH - centerX, TABLE_HEIGHT - centerY, cTop, centerX, centerY);
    drawCushionSegment(bc1, bc2, bc3, bc4, true);

    // Left Cushion
    const lc1 = perspective3D(CUSHION_WIDTH - centerX, CUSHION_WIDTH*1.5 - centerY, cDepth, centerX, centerY);
    const lc2 = perspective3D(CUSHION_WIDTH - centerX, TABLE_HEIGHT - CUSHION_WIDTH*1.5 - centerY, cDepth, centerX, centerY);
    const lc3 = perspective3D(0 - centerX, TABLE_HEIGHT - CUSHION_WIDTH - centerY, cTop, centerX, centerY);
    const lc4 = perspective3D(0 - centerX, CUSHION_WIDTH - centerY, cTop, centerX, centerY);
    drawCushionSegment(lc1, lc2, lc3, lc4, false);

    // Right Cushion
    const rc1 = perspective3D(TABLE_WIDTH - CUSHION_WIDTH - centerX, CUSHION_WIDTH*1.5 - centerY, cDepth, centerX, centerY);
    const rc2 = perspective3D(TABLE_WIDTH - CUSHION_WIDTH - centerX, TABLE_HEIGHT - CUSHION_WIDTH*1.5 - centerY, cDepth, centerX, centerY);
    const rc3 = perspective3D(TABLE_WIDTH - centerX, TABLE_HEIGHT - CUSHION_WIDTH - centerY, cTop, centerX, centerY);
    const rc4 = perspective3D(TABLE_WIDTH - centerX, CUSHION_WIDTH - centerY, cTop, centerX, centerY);
    drawCushionSegment(rc1, rc2, rc3, rc4, false);

  }, [perspective3D]);

  const draw3DPockets = useCallback((ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH, pockets) => {
    const centerX = TABLE_WIDTH / 2;
    const centerY = TABLE_HEIGHT / 2;
    const r3d = render3DRef.current;
    const pocketDepth = 35; // Depth of the cylinder
    
    pockets.forEach(pocket => {
      const px = pocket.x - centerX;
      const py = pocket.y - centerY;
      
      // Calculate geometry points
      // Top circle (Surface level)
      const topZ = -r3d.tableDepth;
      const topCenter = perspective3D(px, py, topZ, centerX, centerY);
      
      // Bottom circle (Deep inside)
      const bottomZ = topZ - pocketDepth;
      const bottomCenter = perspective3D(px, py, bottomZ, centerX, centerY);
      
      // If pocket is behind camera, skip
      if (!topCenter.visible) return;
      
      const topRadius = POCKET_RADIUS * topCenter.scale;
      const bottomRadius = POCKET_RADIUS * bottomCenter.scale;
      
      // 1. Draw Pocket Interior (Cylinder Walls)
      // We calculate the angle to the pocket to determine which part of the wall is visible
      const angleToCenter = Math.atan2(py, px); // Rough approximation for shading
      
      ctx.save();
      ctx.beginPath();
      // Create path for the "walls": connect the two circles
      // We approximate the cylinder by drawing the bottom circle and connecting tangents? 
      // Simpler: Draw bottom circle, then fill the gap if bottom is offset from top.
      
      // Draw Bottom (Floor of pocket)
      const bottomGrad = ctx.createRadialGradient(
        bottomCenter.x, bottomCenter.y, 0,
        bottomCenter.x, bottomCenter.y, bottomRadius
      );
      bottomGrad.addColorStop(0, '#000000');
      bottomGrad.addColorStop(0.8, '#050505');
      bottomGrad.addColorStop(1, '#0a0a0a');
      
      ctx.fillStyle = bottomGrad;
      ctx.beginPath();
      ctx.arc(bottomCenter.x, bottomCenter.y, bottomRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw Tech Grid inside bottom
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.15)';
      ctx.lineWidth = 1 * bottomCenter.scale;
      ctx.beginPath();
      // Simple crosshair pattern in 3D
      ctx.moveTo(bottomCenter.x - bottomRadius, bottomCenter.y);
      ctx.lineTo(bottomCenter.x + bottomRadius, bottomCenter.y);
      ctx.moveTo(bottomCenter.x, bottomCenter.y - bottomRadius);
      ctx.lineTo(bottomCenter.x, bottomCenter.y + bottomRadius);
      ctx.stroke();
      
      // Draw Walls (The sides connecting top and bottom)
      // We iterate around the circle to draw segments
      const segments = 16;
      for (let i = 0; i < segments; i++) {
        const theta1 = (i / segments) * Math.PI * 2;
        const theta2 = ((i + 1) / segments) * Math.PI * 2;
        
        const x1 = px + Math.cos(theta1) * POCKET_RADIUS;
        const y1 = py + Math.sin(theta1) * POCKET_RADIUS;
        const x2 = px + Math.cos(theta2) * POCKET_RADIUS;
        const y2 = py + Math.sin(theta2) * POCKET_RADIUS;
        
        const pTop1 = perspective3D(x1, y1, topZ, centerX, centerY);
        const pTop2 = perspective3D(x2, y2, topZ, centerX, centerY);
        const pBot1 = perspective3D(x1, y1, bottomZ, centerX, centerY);
        const pBot2 = perspective3D(x2, y2, bottomZ, centerX, centerY);
        
        if (pTop1.visible && pBot1.visible) {
          ctx.beginPath();
          ctx.moveTo(pTop1.x, pTop1.y);
          ctx.lineTo(pTop2.x, pTop2.y);
          ctx.lineTo(pBot2.x, pBot2.y);
          ctx.lineTo(pBot1.x, pBot1.y);
          ctx.closePath();
          
          // Wall shading based on angle relative to light/camera
          // Darker deep down
          const wallGrad = ctx.createLinearGradient(pTop1.x, pTop1.y, pBot1.x, pBot1.y);
          wallGrad.addColorStop(0, '#151515');
          wallGrad.addColorStop(1, '#000000');
          
          ctx.fillStyle = wallGrad;
          ctx.fill();
        }
      }
      
      // 2. Draw Rim/Bezel (Metallic Ring on surface)
      const rimWidth = 4;
      const outerRadius = (POCKET_RADIUS + rimWidth) * topCenter.scale;
      
      // Outer Rim Gradient
      const rimGrad = ctx.createLinearGradient(
        topCenter.x - outerRadius, topCenter.y - outerRadius,
        topCenter.x + outerRadius, topCenter.y + outerRadius
      );
      rimGrad.addColorStop(0, '#555');
      rimGrad.addColorStop(0.2, '#aaa'); // Highlight
      rimGrad.addColorStop(0.5, '#333');
      rimGrad.addColorStop(0.8, '#888'); // Secondary highlight
      rimGrad.addColorStop(1, '#222');
      
      ctx.beginPath();
      ctx.arc(topCenter.x, topCenter.y, outerRadius, 0, Math.PI * 2);
      ctx.arc(topCenter.x, topCenter.y, topRadius, 0, Math.PI * 2, true); // Cut out hole
      ctx.fillStyle = rimGrad;
      ctx.fill();
      
      // 3. Tech Glow / LED Ring
      const glowRadius = topRadius * 0.95;
      ctx.strokeStyle = 'rgba(0, 180, 255, 0.4)';
      ctx.lineWidth = 2 * topCenter.scale;
      ctx.shadowColor = 'rgba(0, 200, 255, 0.8)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(topCenter.x, topCenter.y, glowRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // 4. Ambient Glow (Floor reflection)
      const ambientGrad = ctx.createRadialGradient(
        topCenter.x, topCenter.y, topRadius,
        topCenter.x, topCenter.y, topRadius * 1.8
      );
      ambientGrad.addColorStop(0, 'rgba(0, 100, 150, 0.15)');
      ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ambientGrad;
      ctx.beginPath();
      ctx.arc(topCenter.x, topCenter.y, topRadius * 1.8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
  }, [perspective3D]);

  const draw3DBallShadows = useCallback((ctx, balls, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH) => {
    const centerX = TABLE_WIDTH / 2;
    const centerY = TABLE_HEIGHT / 2;
    const r3d = render3DRef.current;
    const quality = renderQuality;
    
    balls.filter(b => !b.pocketed).forEach(ball => {
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      
      // Calculate shadow position based on light with ball elevation
      const elevationFactor = r3d.ballElevation / 50;
      const shadowOffsetX = -lightPosition.x * (15 + r3d.ballElevation * 0.8);
      const shadowOffsetY = -lightPosition.y * (15 + r3d.ballElevation * 0.8);
      
      // Main shadow position
      const shadowPos = perspective3D(
        ball.x + shadowOffsetX - centerX,
        ball.y + shadowOffsetY - centerY,
        -r3d.tableDepth + 2,
        centerX, centerY
      );
      
      const ballPos = perspective3D(ball.x - centerX, ball.y - centerY, r3d.ballElevation, centerX, centerY);
      
      // Soft outer shadow (blur effect with optimized passes)
      if (quality > 0.3) {
        // Reduced to 2 passes for 60fps performance
        for (let pass = 1; pass >= 0; pass--) {
          const passScale = 1 + pass * 0.5; // Larger step for similar coverage
          const passAlpha = 0.2 / (pass + 1); // Adjusted alpha
          
          ctx.save();
          const outerShadowGrad = ctx.createRadialGradient(
            shadowPos.x, shadowPos.y, 0,
            shadowPos.x, shadowPos.y, BALL_RADIUS * shadowPos.scale * passScale * 1.8
          );
          outerShadowGrad.addColorStop(0, `rgba(0, 0, 0, ${passAlpha})`);
          outerShadowGrad.addColorStop(0.6, `rgba(0, 0, 0, ${passAlpha * 0.5})`);
          outerShadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          
          ctx.fillStyle = outerShadowGrad;
          ctx.beginPath();
          ctx.ellipse(
            shadowPos.x, shadowPos.y,
            BALL_RADIUS * shadowPos.scale * passScale * 1.6,
            BALL_RADIUS * shadowPos.scale * passScale * 0.9,
            Math.atan2(shadowOffsetY, shadowOffsetX),
            0, Math.PI * 2
          );
          ctx.fill();
          ctx.restore();
        }
      }
      
      // Core shadow (darker center)
      ctx.save();
      const coreShadowGrad = ctx.createRadialGradient(
        shadowPos.x, shadowPos.y, 0,
        shadowPos.x, shadowPos.y, BALL_RADIUS * shadowPos.scale * 1.2
      );
      coreShadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
      coreShadowGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.3)');
      coreShadowGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.15)');
      coreShadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = coreShadowGrad;
      ctx.beginPath();
      ctx.ellipse(
        shadowPos.x, shadowPos.y,
        BALL_RADIUS * shadowPos.scale * 1.2,
        BALL_RADIUS * shadowPos.scale * 0.7,
        Math.atan2(shadowOffsetY, shadowOffsetX),
        0, Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
      
      // Contact shadow (very close to ball base for grounding)
      const contactShadowX = ball.x - centerX + shadowOffsetX * 0.15;
      const contactShadowY = ball.y - centerY + shadowOffsetY * 0.15;
      const contactPos = perspective3D(contactShadowX, contactShadowY, -r3d.tableDepth + 1, centerX, centerY);
      
      ctx.save();
      const contactGrad = ctx.createRadialGradient(
        contactPos.x, contactPos.y, 0,
        contactPos.x, contactPos.y, BALL_RADIUS * contactPos.scale * 0.9
      );
      contactGrad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
      contactGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
      contactGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = contactGrad;
      ctx.beginPath();
      ctx.ellipse(
        contactPos.x, contactPos.y,
        BALL_RADIUS * contactPos.scale * 0.85,
        BALL_RADIUS * contactPos.scale * 0.55,
        Math.atan2(shadowOffsetY, shadowOffsetX),
        0, Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
      
      // Motion blur shadow for fast-moving balls
      if (speed > 3 && quality > 0.5) {
        const motionLength = Math.min(speed * 2, 30);
        const motionAngle = Math.atan2(-ball.vy, -ball.vx);
        
        for (let i = 0; i < 5; i++) {
          const t = i / 5;
          const trailX = ball.x - Math.cos(motionAngle) * motionLength * t + shadowOffsetX;
          const trailY = ball.y - Math.sin(motionAngle) * motionLength * t + shadowOffsetY;
          const trailPos = perspective3D(trailX - centerX, trailY - centerY, -r3d.tableDepth + 2, centerX, centerY);
          
          ctx.save();
          ctx.globalAlpha = 0.1 * (1 - t);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.beginPath();
          ctx.ellipse(
            trailPos.x, trailPos.y,
            BALL_RADIUS * trailPos.scale * (1 - t * 0.3),
            BALL_RADIUS * trailPos.scale * 0.5 * (1 - t * 0.3),
            motionAngle,
            0, Math.PI * 2
          );
          ctx.fill();
          ctx.restore();
        }
      }
    });
  }, [perspective3D, lightPosition, renderQuality]);

  const draw3DBallReflections = useCallback((ctx, balls, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH) => {
    const centerX = TABLE_WIDTH / 2;
    const centerY = TABLE_HEIGHT / 2;
    const r3d = render3DRef.current;
    
    ctx.save();
    ctx.globalAlpha = r3d.reflectionOpacity;
    
    balls.filter(b => !b.pocketed).forEach(ball => {
      // Reflection is below the ball on the table surface
      const reflectionZ = -r3d.tableDepth - r3d.ballElevation - BALL_RADIUS;
      const reflPos = perspective3D(ball.x - centerX, ball.y - centerY, reflectionZ, centerX, centerY);
      
      // Draw blurred, inverted reflection
      const reflGradient = ctx.createRadialGradient(
        reflPos.x, reflPos.y, 0,
        reflPos.x, reflPos.y, BALL_RADIUS * reflPos.scale * 0.8
      );
      
      const baseColor = ball.color || '#FFFFFF';
      reflGradient.addColorStop(0, baseColor);
      reflGradient.addColorStop(0.7, baseColor + '80');
      reflGradient.addColorStop(1, baseColor + '00');
      
      ctx.fillStyle = reflGradient;
      ctx.beginPath();
      ctx.ellipse(
        reflPos.x, reflPos.y,
        BALL_RADIUS * reflPos.scale * 0.8,
        BALL_RADIUS * reflPos.scale * 0.4,
        0, 0, Math.PI * 2
      );
      ctx.fill();
    });
    
    ctx.restore();
  }, [perspective3D]);

  const draw3DBall = useCallback((ctx, ball, TABLE_WIDTH, TABLE_HEIGHT) => {
    // In Chase Cam mode, we WANT to see the cue ball!
    if (ball.pocketed) return;
    
    const centerX = TABLE_WIDTH / 2;
    const centerY = TABLE_HEIGHT / 2;
    const r3d = render3DRef.current;
    const quality = renderQuality;
    
    // Ball position in 3D space (elevated above table)
    const ballZ = r3d.ballElevation;
    const ballPos = perspective3D(ball.x - centerX, ball.y - centerY, ballZ, centerX, centerY);
    const ballRadius = BALL_RADIUS * ballPos.scale;
    
    // Calculate comprehensive lighting for this ball position
    const lighting = calculate3DLighting(0, -0.3, 0.95, cameraAngle.x, cameraAngle.y);
    
    // Parse ball color
    let r = 255, g = 255, b = 255;
    if (ball.color && ball.color !== '#FFFFFF') {
      const hex = ball.color.replace('#', '');
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
    }
    
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    
    // Motion trail for fast balls
    if (speed > 3 && quality > 0.5) {
      const trailLength = Math.min(speed * 1.5, 25);
      const motionAngle = Math.atan2(-ball.vy, -ball.vx);
      
      for (let i = 0; i < 6; i++) {
        const t = i / 6;
        const trailX = ball.x - Math.cos(motionAngle) * trailLength * t;
        const trailY = ball.y - Math.sin(motionAngle) * trailLength * t;
        const trailPos = perspective3D(trailX - centerX, trailY - centerY, ballZ, centerX, centerY);
        
        const trailGrad = ctx.createRadialGradient(
          trailPos.x, trailPos.y, 0,
          trailPos.x, trailPos.y, ballRadius * (1 - t * 0.4)
        );
        trailGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.2 * (1 - t)})`);
        trailGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        
        ctx.fillStyle = trailGrad;
        ctx.beginPath();
        ctx.arc(trailPos.x, trailPos.y, ballRadius * (1 - t * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Speed-based motion glow
    if (speed > 2) {
      const motionGradient = ctx.createRadialGradient(
        ballPos.x, ballPos.y, ballRadius * 0.8,
        ballPos.x, ballPos.y, ballRadius + speed * 2.5
      );
      motionGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
      motionGradient.addColorStop(0.4, `rgba(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)}, ${Math.min(speed / 20, 0.35)})`);
      motionGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = motionGradient;
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, ballRadius + speed * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Enhanced sphere gradient with proper lighting
    const highlightOffsetX = -lightPosition.x * ballRadius * 0.35;
    const highlightOffsetY = -lightPosition.y * ballRadius * 0.35;
    
    // Calculate color variations based on lighting
    const lightIntensity = lighting.combined;
    const litR = Math.min(255, Math.floor(r * 0.4 + r * lightIntensity * 0.8 + 60));
    const litG = Math.min(255, Math.floor(g * 0.4 + g * lightIntensity * 0.8 + 60));
    const litB = Math.min(255, Math.floor(b * 0.4 + b * lightIntensity * 0.8 + 60));
    
    const midR = Math.floor(r * (0.7 + lightIntensity * 0.3));
    const midG = Math.floor(g * (0.7 + lightIntensity * 0.3));
    const midB = Math.floor(b * (0.7 + lightIntensity * 0.3));
    
    const subsurface = lighting.subsurface || 0;
    const darkR = Math.max(0, Math.floor(r * 0.25 + subsurface * 30));
    const darkG = Math.max(0, Math.floor(g * 0.25 + subsurface * 30));
    const darkB = Math.max(0, Math.floor(b * 0.25 + subsurface * 30));
    
    // Multi-stop gradient for realistic sphere appearance
    const ballGradient = ctx.createRadialGradient(
      ballPos.x + highlightOffsetX * 1.2,
      ballPos.y + highlightOffsetY * 1.2,
      0,
      ballPos.x - highlightOffsetX * 0.3,
      ballPos.y - highlightOffsetY * 0.3,
      ballRadius * 1.15
    );
    
    ballGradient.addColorStop(0, `rgb(${litR}, ${litG}, ${litB})`);
    ballGradient.addColorStop(0.15, `rgb(${Math.floor((litR + midR) / 2)}, ${Math.floor((litG + midG) / 2)}, ${Math.floor((litB + midB) / 2)})`);
    ballGradient.addColorStop(0.4, `rgb(${midR}, ${midG}, ${midB})`);
    ballGradient.addColorStop(0.65, `rgb(${Math.floor((midR + darkR) / 2)}, ${Math.floor((midG + darkG) / 2)}, ${Math.floor((midB + darkB) / 2)})`);
    ballGradient.addColorStop(0.85, `rgb(${darkR}, ${darkG}, ${darkB})`);
    ballGradient.addColorStop(1, `rgb(${Math.max(0, darkR - 20)}, ${Math.max(0, darkG - 20)}, ${Math.max(0, darkB - 20)})`);
    
    // Draw main ball body
    ctx.fillStyle = ballGradient;
    ctx.beginPath();
    ctx.arc(ballPos.x, ballPos.y, ballRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Subtle edge definition
    ctx.strokeStyle = `rgba(0, 0, 0, 0.15)`;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // --- NEW: 3D Rolling Number/Stripe Logic ---
    // We use the ball's `pole` vector (which rotates in physics) to position the number
    if (ball.type !== 'cue' && ball.pole) {
      // 1. Project the pole vector to screen space
      // The pole vector is a unit vector in 3D relative to ball center.
      // We scale it by the ball radius to get the world position of the "number"
      const numberWorldX = ball.x + ball.pole.x * BALL_RADIUS;
      const numberWorldY = ball.y + ball.pole.y * BALL_RADIUS;
      const numberWorldZ = ballZ + ball.pole.z * BALL_RADIUS;
      
      const numberPos = perspective3D(numberWorldX - centerX, numberWorldY - centerY, numberWorldZ, centerX, centerY);
      
      // 2. Check visibility: dot product of pole and camera view vector
      // In our coordinate system, camera looks down negative Z (or similar depending on projection)
      // Since we already have projected Z, we can just check if pole.z is somewhat positive relative to camera
      // But a simpler check is: is the numberPos closer to camera than ball center?
      // Or just check the pole's Z component rotated by camera angle?
      // Let's use a simpler heuristic: if pole.z (world) is positive, it's generally facing up.
      // But we have a 3D camera.
      // Let's use the projected z-order. If numberPos.z > ballPos.z, it's in front (closer to camera).
      
      if (numberPos.z > ballPos.z - 2) { // Tolerance for rounding
        // Draw Number Circle
        const circleRadius = ballRadius * 0.42;
        
        // Distortion based on angle (foreshortening)
        // We approximate this by distance from center of ball projection
        const distFromCenter = Math.sqrt(Math.pow(numberPos.x - ballPos.x, 2) + Math.pow(numberPos.y - ballPos.y, 2));
        const foreshortening = Math.max(0.2, 1 - (distFromCenter / ballRadius));
        
        ctx.save();
        
        // Transform to draw oval at angle
        ctx.translate(numberPos.x, numberPos.y);
        // Rotate to align with the vector from center
        const angleToCenter = Math.atan2(numberPos.y - ballPos.y, numberPos.x - ballPos.x);
        ctx.rotate(angleToCenter);
        ctx.scale(1, foreshortening); // Squash along the radial line? No, perpendicular.
        // Actually, we want to squash along the radial direction.
        // So we rotate so X axis points to center, scale X, then draw.
        // But `rotate` rotates the grid.
        
        // Simplified approach: Draw circle at projected point, it's small enough.
        // Or just use ellipse.
        
        // Reset transform for simple circle first
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        
        // Draw the white circle background
        const circleGrad = ctx.createRadialGradient(
          numberPos.x - circleRadius * 0.2,
          numberPos.y - circleRadius * 0.2,
          0,
          numberPos.x, numberPos.y,
          circleRadius
        );
        circleGrad.addColorStop(0, ball.type === 'eight' ? '#4a4a4a' : '#ffffff');
        circleGrad.addColorStop(1, ball.type === 'eight' ? '#1a1a1a' : '#e8e8e8');
        
        ctx.fillStyle = circleGrad;
        ctx.beginPath();
        // Squish it slightly based on how close to edge it is to fake perspective on the decal
        ctx.ellipse(numberPos.x, numberPos.y, circleRadius * (0.8 + 0.2*foreshortening), circleRadius * foreshortening, angleToCenter + Math.PI/2, 0, Math.PI * 2);
        ctx.fill();
        
        // Number Text
        ctx.fillStyle = ball.type === 'eight' ? '#FFFFFF' : '#000000';
        ctx.font = `bold ${Math.floor(ballRadius * 0.65 * foreshortening)}px "Orbitron", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Only draw text if not too squashed
        if (foreshortening > 0.4) {
          ctx.fillText(ball.number.toString(), numberPos.x, numberPos.y);
        }
        
        ctx.restore();
      }
      
      // Stripe drawing (if needed)
      if (ball.type === 'stripe' && ball.number > 8) {
        // Draw stripe band around the "equator" relative to the pole
        // This is complex in 2D canvas. We'll skip complex 3D stripe mapping for now 
        // and stick to the improved base gradient which hints at it, 
        // or we could draw a simplified band if the pole is perpendicular to view.
        // For now, the rolling number is the key visual cue.
      }
    } else if (ball.type !== 'cue') {
      // Fallback for 2D mode or uninitialized pole (shouldn't happen)
      // ... existing static number logic ...
    }
    
    // Primary specular highlight (main light reflection)
    const specularX = ballPos.x + highlightOffsetX * 0.9;
    const specularY = ballPos.y + highlightOffsetY * 0.9;
    
    const specularGradient = ctx.createRadialGradient(
      specularX, specularY, 0,
      specularX, specularY, ballRadius * 0.45
    );
    specularGradient.addColorStop(0, `rgba(255, 255, 255, ${0.95 * lighting.specular})`);
    specularGradient.addColorStop(0.3, `rgba(255, 255, 255, ${0.6 * lighting.specular})`);
    specularGradient.addColorStop(0.6, `rgba(255, 255, 255, ${0.2 * lighting.specular})`);
    specularGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = specularGradient;
    ctx.beginPath();
    ctx.arc(specularX, specularY, ballRadius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    
    // Sharp specular point
    const spec2X = specularX - ballRadius * 0.08;
    const spec2Y = specularY - ballRadius * 0.06;
    const sharpSpecGrad = ctx.createRadialGradient(spec2X, spec2Y, 0, spec2X, spec2Y, ballRadius * 0.15);
    sharpSpecGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    sharpSpecGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    sharpSpecGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sharpSpecGrad;
    ctx.beginPath();
    ctx.arc(spec2X, spec2Y, ballRadius * 0.15, 0, Math.PI * 2);
    ctx.fill();
    
    // Fresnel rim lighting (edge glow from backlight)
    const fresnelIntensity = lighting.fresnel * 0.7;
    if (fresnelIntensity > 0.05) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, ballRadius, 0, Math.PI * 2);
      ctx.clip();
      
      const rimX = ballPos.x - highlightOffsetX * 2;
      const rimY = ballPos.y - highlightOffsetY * 2;
      
      const rimGradient = ctx.createRadialGradient(
        rimX, rimY, ballRadius * 0.5,
        rimX, rimY, ballRadius * 1.3
      );
      rimGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      rimGradient.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
      rimGradient.addColorStop(0.85, `rgba(200, 220, 255, ${fresnelIntensity * 0.5})`);
      rimGradient.addColorStop(1, `rgba(180, 200, 255, ${fresnelIntensity})`);
      
      ctx.fillStyle = rimGradient;
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, ballRadius * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    // Secondary fill light highlight
    const fill2X = ballPos.x + secondaryLight.x * ballRadius * 0.5;
    const fill2Y = ballPos.y + secondaryLight.y * ballRadius * 0.5;
    const fill2Grad = ctx.createRadialGradient(fill2X, fill2Y, 0, fill2X, fill2Y, ballRadius * 0.3);
    fill2Grad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    fill2Grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = fill2Grad;
    ctx.beginPath();
    ctx.arc(fill2X, fill2Y, ballRadius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Environment reflection simulation (subtle table color reflection)
    const envReflectX = ballPos.x + highlightOffsetX * 0.3;
    const envReflectY = ballPos.y + Math.abs(highlightOffsetY) * 1.5;
    const envGrad = ctx.createRadialGradient(envReflectX, envReflectY, 0, envReflectX, envReflectY, ballRadius * 0.6);
    envGrad.addColorStop(0, 'rgba(20, 80, 50, 0.12)');
    envGrad.addColorStop(1, 'rgba(20, 80, 50, 0)');
    ctx.fillStyle = envGrad;
    ctx.beginPath();
    ctx.arc(envReflectX, envReflectY, ballRadius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    
    // POV Mode: Special rendering for cue ball as the "vehicle"
    if (fpsMode && ball.type === 'cue') {
      // Energy aura around the ball
      const povGlow = ctx.createRadialGradient(
        ballPos.x, ballPos.y, ballRadius * 0.8,
        ballPos.x, ballPos.y, ballRadius * 2.5
      );
      povGlow.addColorStop(0, 'rgba(34, 211, 238, 0)');
      povGlow.addColorStop(0.4, 'rgba(34, 211, 238, 0.15)');
      povGlow.addColorStop(0.7, 'rgba(59, 130, 246, 0.1)');
      povGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = povGlow;
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, ballRadius * 2.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Pulsing ring
      const pulseSize = ballRadius * (1.5 + Math.sin(timeRef.current * 4) * 0.2);
      ctx.strokeStyle = `rgba(34, 211, 238, ${0.4 + Math.sin(timeRef.current * 4) * 0.2})`;
      ctx.lineWidth = 2 * ballPos.scale;
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, pulseSize, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw POV trail particles
      const povCam = povCameraRef.current;
      povCam.trailParticles.forEach(p => {
        const pPos = perspective3D(p.x - centerX, p.y - centerY, r3d.ballElevation, centerX, centerY);
        if (pPos.visible) {
          const trailGrad = ctx.createRadialGradient(pPos.x, pPos.y, 0, pPos.x, pPos.y, p.size * pPos.scale);
          trailGrad.addColorStop(0, `hsla(${p.hue}, 80%, 60%, ${p.life * 0.6})`);
          trailGrad.addColorStop(1, `hsla(${p.hue}, 80%, 40%, 0)`);
          ctx.fillStyle = trailGrad;
          ctx.beginPath();
          ctx.arc(pPos.x, pPos.y, p.size * pPos.scale, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
    
    // Ability effects on ball (preserve existing)
    if (ball.activeAbility || ball.lightningActive || ball.quantumSplit || ball.blackHole || ball.frozen) {
      let glowColor = 'rgba(100, 200, 255, 0.5)';
      
      if (ball.activeAbility === 'explosive_impact') {
        glowColor = 'rgba(255, 150, 50, 0.6)';
      } else if (ball.lightningActive) {
        glowColor = 'rgba(255, 255, 100, 0.6)';
      } else if (ball.quantumSplit) {
        glowColor = 'rgba(200, 100, 255, 0.6)';
      } else if (ball.blackHole) {
        glowColor = 'rgba(100, 50, 200, 0.7)';
      } else if (ball.frozen) {
        glowColor = 'rgba(100, 200, 255, 0.7)';
      }
      
      const abilityGlow = ctx.createRadialGradient(
        ballPos.x, ballPos.y, ballRadius,
        ballPos.x, ballPos.y, ballRadius * 2.2
      );
      abilityGlow.addColorStop(0, glowColor);
      abilityGlow.addColorStop(0.5, glowColor.replace(/[\d.]+\)$/, '0.3)'));
      abilityGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = abilityGlow;
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, ballRadius * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [perspective3D, calculate3DLighting, lightPosition, secondaryLight, cameraAngle, renderQuality]);

  const draw3DScene = useCallback((ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH) => {
    const centerX = TABLE_WIDTH / 2;
    const centerY = TABLE_HEIGHT / 2;
    const r3d = render3DRef.current;
    
    // 1. Clear & Background
    // Deep gradient background representing the room void
    const bgGrad = ctx.createLinearGradient(0, 0, 0, TABLE_HEIGHT);
    bgGrad.addColorStop(0, '#020408');
    bgGrad.addColorStop(1, '#0a101a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
    
    // 2. Draw 3D Environment (Floor, Walls)
    draw3DEnvironment(ctx, TABLE_WIDTH, TABLE_HEIGHT);
    
    // 3. Draw Table Structure (Legs, Cabinet) - Drawn BEFORE surface
    draw3DTableStructure(ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH);
    
    // 4. Volumetric Glow (Atmosphere around table)
    const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, TABLE_WIDTH * 0.9);
    glow.addColorStop(0, 'rgba(60, 100, 180, 0.08)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0,0, TABLE_WIDTH, TABLE_HEIGHT);
    
    // 5. Draw Game Objects
    draw3DTableSurface(ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH);
    draw3DBallReflections(ctx, gameStateRef.current.balls, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH);
    draw3DBallShadows(ctx, gameStateRef.current.balls, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH);
    draw3DPockets(ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH, gameStateRef.current.pockets);
    
    // Sort balls
    const sortedBalls = sortBallsByDepth(
      gameStateRef.current.balls.filter(b => !b.pocketed),
      centerX, centerY
    );
    sortedBalls.forEach(ball => draw3DBall(ctx, ball, TABLE_WIDTH, TABLE_HEIGHT));
    
    // 5. Aiming Visuals in 3D (Ghost Ball & Trajectory)
    if (aimingData.isAiming && aimingData.cueBall) {
      // Ghost Ball
      if (showGhostBall) {
        const ghost = calculateGhostBall();
        if (ghost) {
          const gPos = perspective3D(ghost.x - centerX, ghost.y - centerY, r3d.ballElevation, centerX, centerY);
          if (gPos.visible) {
            // Ghost ball outline
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(gPos.x, gPos.y, BALL_RADIUS * gPos.scale, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Inner fill
            ctx.fillStyle = 'rgba(100, 200, 255, 0.15)';
            ctx.fill();
            
            // Connection line to target
            const tPos = perspective3D(ghost.targetBall.x - centerX, ghost.targetBall.y - centerY, r3d.ballElevation, centerX, centerY);
            if (tPos.visible) {
              ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 4]);
              ctx.beginPath();
              ctx.moveTo(gPos.x, gPos.y);
              ctx.lineTo(tPos.x, tPos.y);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        }
      }
      
      // Trajectory Line
      if (showTrajectory) {
        const trajectory = predictTrajectory();
        if (trajectory.length > 0) {
          ctx.beginPath();
          // Start from cue ball
          const startPos = perspective3D(aimingData.cueBall.x - centerX, aimingData.cueBall.y - centerY, r3d.ballElevation, centerX, centerY);
          ctx.moveTo(startPos.x, startPos.y);
          
          trajectory.forEach(point => {
            const p3d = perspective3D(point.x - centerX, point.y - centerY, r3d.ballElevation, centerX, centerY);
            if (p3d.visible) {
              ctx.lineTo(p3d.x, p3d.y);
            }
          });
          
          ctx.strokeStyle = 'rgba(255, 200, 100, 0.6)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([8, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Draw bounce points
          trajectory.filter(p => p.isBounce).forEach(point => {
            const p3d = perspective3D(point.x - centerX, point.y - centerY, r3d.ballElevation, centerX, centerY);
            if (p3d.visible) {
              ctx.fillStyle = 'rgba(255, 200, 100, 0.8)';
              ctx.beginPath();
              ctx.arc(p3d.x, p3d.y, 3 * p3d.scale, 0, Math.PI * 2);
              ctx.fill();
            }
          });
        }
      }
    }

    draw3DCushions(ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH);
    
    // 6. 3D Cue Stick
    if (aimingData.isAiming && aimingData.cueBall) {
       const cue = aimingData.cueBall;
       const cueLen = 200;
       const cueX = cue.x + Math.cos(aimingData.angle + Math.PI) * cueLen;
       const cueY = cue.y + Math.sin(aimingData.angle + Math.PI) * cueLen;
       
       const pStart = perspective3D(cueX - centerX, cueY - centerY, 40, centerX, centerY);
       const pEnd = perspective3D(cue.x - centerX - Math.cos(aimingData.angle)*15, cue.y - centerY - Math.sin(aimingData.angle)*15, 25, centerX, centerY);
       
       if (pStart.visible && pEnd.visible) {
          // Shadow
          const sStart = perspective3D(cueX - centerX, cueY - centerY, -40, centerX, centerY);
          const sEnd = perspective3D(cue.x - centerX, cue.y - centerY, -40, centerX, centerY);
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 6 * sStart.scale;
          ctx.beginPath(); ctx.moveTo(sStart.x, sStart.y); ctx.lineTo(sEnd.x, sEnd.y); ctx.stroke();
          
          // Stick
          const grad = ctx.createLinearGradient(pStart.x, pStart.y, pEnd.x, pEnd.y);
          grad.addColorStop(0, '#3e2723');
          grad.addColorStop(1, '#d7ccc8');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 6 * pStart.scale;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(pStart.x, pStart.y); ctx.lineTo(pEnd.x, pEnd.y); ctx.stroke();
       }
    }
  }, [draw3DEnvironment, draw3DTableStructure, draw3DTableSurface, draw3DCushions, draw3DPockets, draw3DBallReflections, draw3DBallShadows, draw3DBall, sortBallsByDepth, perspective3D, aimingData, calculateGhostBall, predictTrajectory, showGhostBall, showTrajectory]);

  const drawPlasmaWaves = (ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH) => {
    const time = timeRef.current;
    const cellSize = 20;
    
    for (let x = CUSHION_WIDTH * 2; x < TABLE_WIDTH - CUSHION_WIDTH * 2; x += cellSize) {
      for (let y = CUSHION_WIDTH * 2; y < TABLE_HEIGHT - CUSHION_WIDTH * 2; y += cellSize) {
        const dx = x - TABLE_WIDTH / 2;
        const dy = y - TABLE_HEIGHT / 2;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const wave1 = Math.sin(distance * 0.05 - time * 2);
        const wave2 = Math.sin(x * 0.03 + time);
        const wave3 = Math.sin(y * 0.03 - time * 1.5);
        const combined = (wave1 + wave2 + wave3) / 3;
        
        const hue = ((combined + 1) * 180 + time * 30) % 360;
        const brightness = (combined + 1) * 50;
        
        ctx.fillStyle = `hsla(${hue}, 80%, ${brightness}%, 0.4)`;
        ctx.fillRect(x, y, cellSize - 2, cellSize - 2);
      }
    }
  };

  const drawQuantumGrid = (ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH) => {
    const time = timeRef.current;
    const gridSize = 30;
    
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.2)';
    ctx.lineWidth = 1;
    
    // Horizontal lines
    for (let y = CUSHION_WIDTH * 2; y < TABLE_HEIGHT - CUSHION_WIDTH * 2; y += gridSize) {
      ctx.beginPath();
      for (let x = CUSHION_WIDTH * 2; x < TABLE_WIDTH - CUSHION_WIDTH * 2; x += 5) {
        const wave = Math.sin(x * 0.02 + y * 0.02 + time * 2) * 10;
        if (x === CUSHION_WIDTH * 2) {
          ctx.moveTo(x, y + wave);
        } else {
          ctx.lineTo(x, y + wave);
        }
      }
      ctx.stroke();
    }
    
    // Vertical lines
    for (let x = CUSHION_WIDTH * 2; x < TABLE_WIDTH - CUSHION_WIDTH * 2; x += gridSize) {
      ctx.beginPath();
      for (let y = CUSHION_WIDTH * 2; y < TABLE_HEIGHT - CUSHION_WIDTH * 2; y += 5) {
        const wave = Math.sin(x * 0.02 + y * 0.02 + time * 2) * 10;
        if (y === CUSHION_WIDTH * 2) {
          ctx.moveTo(x + wave, y);
        } else {
          ctx.lineTo(x + wave, y);
        }
      }
      ctx.stroke();
    }
    
    // Glowing nodes at intersections
    for (let x = CUSHION_WIDTH * 2; x < TABLE_WIDTH - CUSHION_WIDTH * 2; x += gridSize) {
      for (let y = CUSHION_WIDTH * 2; y < TABLE_HEIGHT - CUSHION_WIDTH * 2; y += gridSize) {
        const pulse = Math.sin(time * 3 + x * 0.01 + y * 0.01) * 0.5 + 0.5;
        const nodeGradient = ctx.createRadialGradient(x, y, 0, x, y, 5 * pulse);
        nodeGradient.addColorStop(0, `rgba(0, 255, 255, ${0.8 * pulse})`);
        nodeGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
        
        ctx.fillStyle = nodeGradient;
        ctx.beginPath();
        ctx.arc(x, y, 5 * pulse, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  };

  const drawEnergyParticles = (ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH) => {
    const time = timeRef.current;
    
    // Update particles
    particlesRef.current.forEach(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life += 0.01;
      particle.hue = (particle.hue + 2) % 360;
      
      // Bounce off walls
      if (particle.x < CUSHION_WIDTH * 2 || particle.x > TABLE_WIDTH - CUSHION_WIDTH * 2) {
        particle.vx *= -1;
        particle.x = Math.max(CUSHION_WIDTH * 2, Math.min(TABLE_WIDTH - CUSHION_WIDTH * 2, particle.x));
      }
      if (particle.y < CUSHION_WIDTH * 2 || particle.y > TABLE_HEIGHT - CUSHION_WIDTH * 2) {
        particle.vy *= -1;
        particle.y = Math.max(CUSHION_WIDTH * 2, Math.min(TABLE_HEIGHT - CUSHION_WIDTH * 2, particle.y));
      }
      
      // Respawn if life exceeds
      if (particle.life > 1) {
        particle.life = 0;
        particle.x = CUSHION_WIDTH * 2 + Math.random() * (TABLE_WIDTH - CUSHION_WIDTH * 4);
        particle.y = CUSHION_WIDTH * 2 + Math.random() * (TABLE_HEIGHT - CUSHION_WIDTH * 4);
      }
      
      // Draw particle
      const alpha = Math.sin(particle.life * Math.PI) * 0.6;
      const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.size * 3);
      gradient.addColorStop(0, `hsla(${particle.hue}, 100%, 60%, ${alpha})`);
      gradient.addColorStop(1, `hsla(${particle.hue}, 100%, 60%, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 3, 0, 2 * Math.PI);
      ctx.fill();
      
      // Core
      ctx.fillStyle = `hsla(${particle.hue}, 100%, 80%, ${alpha * 1.5})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // Connection lines between nearby particles
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < particlesRef.current.length; i++) {
      for (let j = i + 1; j < particlesRef.current.length; j++) {
        const p1 = particlesRef.current[i];
        const p2 = particlesRef.current[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 100) {
          ctx.globalAlpha = (1 - distance / 100) * 0.3;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
  };

  const drawRippleFields = (ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH) => {
    // Update and draw ripples
    rippleRef.current = rippleRef.current.filter(ripple => {
      ripple.time += 0.05;
      ripple.radius = ripple.maxRadius * ripple.time;
      ripple.alpha = 1 - ripple.time;
      
      if (ripple.alpha > 0) {
        // Multiple concentric circles
        for (let i = 0; i < 3; i++) {
          const offset = i * 15;
          const innerRadius = Math.max(0, ripple.radius - offset - 5);
          const outerRadius = Math.max(innerRadius + 1, ripple.radius - offset + 5);
          const gradient = ctx.createRadialGradient(
            ripple.x, ripple.y, innerRadius,
            ripple.x, ripple.y, outerRadius
          );
          gradient.addColorStop(0, `rgba(100, 255, 200, 0)`);
          gradient.addColorStop(0.5, `rgba(100, 255, 200, ${ripple.alpha * 0.6})`);
          gradient.addColorStop(1, `rgba(100, 255, 200, 0)`);
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, Math.max(0, ripple.radius - offset), 0, 2 * Math.PI);
          ctx.stroke();
        }
        return true;
      }
      return false;
    });
    
    // Ambient field effect
    const time = timeRef.current;
    for (let x = CUSHION_WIDTH * 2; x < TABLE_WIDTH - CUSHION_WIDTH * 2; x += 40) {
      for (let y = CUSHION_WIDTH * 2; y < TABLE_HEIGHT - CUSHION_WIDTH * 2; y += 40) {
        const pulse = Math.sin(time + x * 0.01 + y * 0.01) * 0.5 + 0.5;
        const pulseRadius = Math.max(1, 20 * pulse);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, pulseRadius);
        gradient.addColorStop(0, `rgba(50, 255, 150, ${0.2 * pulse})`);
        gradient.addColorStop(1, 'rgba(50, 255, 150, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, pulseRadius, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  };

  const drawNebulaSwirl = (ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH) => {
    const time = timeRef.current;
    const centerX = TABLE_WIDTH / 2;
    const centerY = TABLE_HEIGHT / 2;
    
    // Draw swirling nebula
    for (let i = 0; i < 200; i++) {
      const angle = (i / 200) * Math.PI * 4 + time;
      const radius = (i / 200) * Math.min(TABLE_WIDTH, TABLE_HEIGHT) * 0.4;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      const hue = (i + time * 50) % 360;
      const alpha = (1 - i / 200) * 0.3;
      
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 20);
      gradient.addColorStop(0, `hsla(${hue}, 80%, 60%, ${alpha})`);
      gradient.addColorStop(1, `hsla(${hue}, 80%, 40%, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    // Spiral arms
    for (let arm = 0; arm < 3; arm++) {
      ctx.strokeStyle = `hsla(${(arm * 120 + time * 30) % 360}, 80%, 50%, 0.2)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      for (let i = 0; i < 100; i++) {
        const t = i / 100;
        const angle = arm * (Math.PI * 2 / 3) + t * Math.PI * 4 + time * 0.5;
        const radius = t * Math.min(TABLE_WIDTH, TABLE_HEIGHT) * 0.35;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    
    // Center glow
    const centerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 80);
    centerGradient.addColorStop(0, `hsla(${(time * 50) % 360}, 80%, 70%, 0.4)`);
    centerGradient.addColorStop(0.5, `hsla(${(time * 50 + 60) % 360}, 80%, 50%, 0.2)`);
    centerGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = centerGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 80, 0, 2 * Math.PI);
    ctx.fill();
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || tableDimensions.width === 0) return;
    
    const TABLE_WIDTH = tableDimensions.width;
    const TABLE_HEIGHT = tableDimensions.height;
    const CUSHION_WIDTH = TABLE_WIDTH * CUSHION_RATIO;
    
    const ctx = canvas.getContext('2d');
    
    // Apply screen shake transform
    ctx.save();
    if (screenShake.active) {
      const shakeX = (Math.random() - 0.5) * screenShake.intensity;
      const shakeY = (Math.random() - 0.5) * screenShake.intensity;
      ctx.translate(shakeX, shakeY);
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // === 3D MODE RENDERING ===
    if (is3DMode) {
      draw3DScene(ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH);
      
      // Draw ability effects in 3D space
      abilityEffectsRef.current.forEach(effect => {
        if (effect.delay && effect.delay > 0) {
          effect.delay -= 0.02;
          return;
        }
        effect.life -= 0.02;
        effect.x += effect.vx;
        effect.y += effect.vy;
        effect.vx *= 0.95;
        effect.vy *= 0.95;
        
        if (effect.life > 0) {
          const centerX = TABLE_WIDTH / 2;
          const centerY = TABLE_HEIGHT / 2;
          const effectPos = perspective3D(effect.x - centerX, effect.y - centerY, render3DRef.current.ballElevation, centerX, centerY);
          
          const gradient = ctx.createRadialGradient(effectPos.x, effectPos.y, 0, effectPos.x, effectPos.y, effect.size * effectPos.scale);
          gradient.addColorStop(0, `hsla(${effect.hue}, 100%, 70%, ${effect.life})`);
          gradient.addColorStop(1, `hsla(${effect.hue}, 100%, 50%, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(effectPos.x, effectPos.y, effect.size * effectPos.scale, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      
      abilityEffectsRef.current = abilityEffectsRef.current.filter(p => p.life > 0 && (!p.delay || p.delay <= 0));
      
      // Draw ghost balls in 3D
      ghostBalls.forEach(ghost => {
        const centerX = TABLE_WIDTH / 2;
        const centerY = TABLE_HEIGHT / 2;
        const ghostPos = perspective3D(ghost.x - centerX, ghost.y - centerY, render3DRef.current.ballElevation, centerX, centerY);
        
        const alpha = ghost.life * 0.7;
        const gradient = ctx.createRadialGradient(ghostPos.x, ghostPos.y, 0, ghostPos.x, ghostPos.y, ghost.size * ghostPos.scale);
        gradient.addColorStop(0, `hsla(280, 100%, 80%, ${alpha})`);
        gradient.addColorStop(1, `hsla(280, 100%, 50%, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(ghostPos.x, ghostPos.y, ghost.size * ghostPos.scale, 0, Math.PI * 2);
        ctx.fill();
      });
      
      // Restore and apply flash effect
      ctx.restore();
      if (flashEffect.active) {
        ctx.save();
        ctx.fillStyle = flashEffect.color;
        ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
        ctx.restore();
      }
      
      return; // Skip 2D rendering
    }
    
    // === 2D MODE RENDERING (existing code) ===
    // Dark base
    const tableGradient = ctx.createLinearGradient(0, 0, 0, TABLE_HEIGHT);
    tableGradient.addColorStop(0, '#0a0e1a');
    tableGradient.addColorStop(0.5, '#0f1728');
    tableGradient.addColorStop(1, '#0a0e1a');
    ctx.fillStyle = tableGradient;
    ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
    
    // Draw selected visualizer
    switch(visualizerMode) {
      case 0:
        drawPlasmaWaves(ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH);
        break;
      case 1:
        drawQuantumGrid(ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH);
        break;
      case 2:
        drawEnergyParticles(ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH);
        break;
      case 3:
        drawRippleFields(ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH);
        break;
      case 4:
        drawNebulaSwirl(ctx, TABLE_WIDTH, TABLE_HEIGHT, CUSHION_WIDTH);
        break;
    }
    
    // Grid overlay
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(CUSHION_WIDTH * 2, CUSHION_WIDTH * 2, TABLE_WIDTH - CUSHION_WIDTH * 4, TABLE_HEIGHT - CUSHION_WIDTH * 4);
    ctx.setLineDash([]);
    
    // Futuristic cushions with 3D effect
    const cushionGradient = ctx.createLinearGradient(0, 0, CUSHION_WIDTH, CUSHION_WIDTH);
    cushionGradient.addColorStop(0, '#1a2332');
    cushionGradient.addColorStop(0.5, '#2a3f5f');
    cushionGradient.addColorStop(1, '#1a2332');
    
    // Top cushion
    ctx.fillStyle = cushionGradient;
    ctx.fillRect(0, 0, TABLE_WIDTH, CUSHION_WIDTH);
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, TABLE_WIDTH, CUSHION_WIDTH);
    
    // Bottom cushion
    ctx.fillRect(0, TABLE_HEIGHT - CUSHION_WIDTH, TABLE_WIDTH, CUSHION_WIDTH);
    ctx.strokeRect(0, TABLE_HEIGHT - CUSHION_WIDTH, TABLE_WIDTH, CUSHION_WIDTH);
    
    // Left cushion
    ctx.fillRect(0, 0, CUSHION_WIDTH, TABLE_HEIGHT);
    ctx.strokeRect(0, 0, CUSHION_WIDTH, TABLE_HEIGHT);
    
    // Right cushion
    ctx.fillRect(TABLE_WIDTH - CUSHION_WIDTH, 0, CUSHION_WIDTH, TABLE_HEIGHT);
    ctx.strokeRect(TABLE_WIDTH - CUSHION_WIDTH, 0, CUSHION_WIDTH, TABLE_HEIGHT);
    
    // Futuristic pockets with glowing effect
    gameStateRef.current.pockets.forEach(pocket => {
      // Outer glow
      const pocketGradient = ctx.createRadialGradient(pocket.x, pocket.y, 0, pocket.x, pocket.y, pocket.radius + 10);
      pocketGradient.addColorStop(0, 'rgba(0, 150, 255, 0.8)');
      pocketGradient.addColorStop(0.6, 'rgba(0, 100, 200, 0.4)');
      pocketGradient.addColorStop(1, 'rgba(0, 50, 150, 0)');
      
      ctx.fillStyle = pocketGradient;
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, pocket.radius + 10, 0, 2 * Math.PI);
      ctx.fill();
      
      // Inner pocket
      const innerGradient = ctx.createRadialGradient(pocket.x, pocket.y, 0, pocket.x, pocket.y, pocket.radius);
      innerGradient.addColorStop(0, '#000000');
      innerGradient.addColorStop(1, '#0a0e1a');
      
      ctx.fillStyle = innerGradient;
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, pocket.radius, 0, 2 * Math.PI);
      ctx.fill();
      
      // Rim highlight
      ctx.strokeStyle = 'rgba(0, 150, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    
    // Update ball trails
    gameStateRef.current.balls.forEach(ball => {
      if (!ball.pocketed) {
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speed > 1) {
          if (!ballTrails[ball.id]) {
            setBallTrails(prev => ({ ...prev, [ball.id]: [] }));
          }
          
          const trail = ballTrails[ball.id] || [];
          trail.push({ x: ball.x, y: ball.y, alpha: 1 });
          if (trail.length > 10) trail.shift();
          
          setBallTrails(prev => ({ ...prev, [ball.id]: trail }));
        }
      }
    });

    // Draw ball trails with special ability enhancements
    Object.entries(ballTrails).forEach(([ballId, trail]) => {
      if (trail && trail.length > 1) {
        const ball = gameStateRef.current.balls.find(b => b.id.toString() === ballId);
        
        trail.forEach((point, i) => {
          const alpha = (i / trail.length) * 0.3;
          const size = ((i / trail.length) * BALL_RADIUS) / 2;
          
          let trailColor = 'rgba(100, 200, 255, ';
          if (ball?.activeAbility === 'explosive_impact') {
            trailColor = 'rgba(255, 150, 50, ';
          } else if (ball?.lightningActive) {
            trailColor = 'rgba(255, 255, 100, ';
          } else if (ball?.quantumSplit) {
            trailColor = 'rgba(200, 100, 255, ';
          } else if (ball?.blackHole) {
            trailColor = 'rgba(100, 50, 200, ';
          } else if (ball?.frozen) {
            trailColor = 'rgba(100, 200, 255, ';
          }
          
          const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, size);
          gradient.addColorStop(0, trailColor + alpha + ')');
          gradient.addColorStop(1, trailColor + '0)');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(point.x, point.y, size, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
    });
    
    // Draw ability effect particles - ENHANCED
    abilityEffectsRef.current.forEach(effect => {
      if (effect.delay && effect.delay > 0) {
        effect.delay -= 0.02;
        return;
      }
      
      effect.life -= 0.02;
      
      // Update position based on type
      if (effect.type === 'gravity' && effect.orbit) {
        effect.orbitAngle += 0.1;
        effect.x = effect.targetX || effect.x;
        effect.y = effect.targetY || effect.y;
        effect.x += Math.cos(effect.orbitAngle) * effect.orbitRadius;
        effect.y += Math.sin(effect.orbitAngle) * effect.orbitRadius;
      } else if (effect.type === 'ice' && effect.targetX) {
        // Ice particles orbit target
        const dx = effect.x - effect.targetX;
        const dy = effect.y - effect.targetY;
        const angle = Math.atan2(dy, dx) + 0.05;
        const dist = Math.sqrt(dx * dx + dy * dy);
        effect.x = effect.targetX + Math.cos(angle) * dist;
        effect.y = effect.targetY + Math.sin(angle) * dist;
      } else {
        effect.x += effect.vx;
        effect.y += effect.vy;
      }
      
      effect.vx *= 0.95;
      effect.vy *= 0.95;
      
      if (effect.life > 0) {
        let size = effect.size;
        
        // Type-specific rendering
        if (effect.type === 'explosion') {
          size = effect.size * (1 + (1 - effect.life) * 0.5);
          const gradient = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, size);
          gradient.addColorStop(0, `hsla(${effect.hue}, 100%, 70%, ${effect.life * 0.9})`);
          gradient.addColorStop(0.5, `hsla(${effect.hue}, 90%, 50%, ${effect.life * 0.5})`);
          gradient.addColorStop(1, `hsla(${effect.hue - 20}, 80%, 30%, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, size, 0, 2 * Math.PI);
          ctx.fill();
        } else if (effect.type === 'fire_wave') {
          size = effect.size * effect.life;
          const gradient = ctx.createRadialGradient(effect.x, effect.y, size * 0.5, effect.x, effect.y, size);
          gradient.addColorStop(0, `hsla(30, 100%, 60%, ${effect.life * 0.7})`);
          gradient.addColorStop(1, `hsla(10, 100%, 40%, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, size, 0, 2 * Math.PI);
          ctx.fill();
        } else if (effect.type === 'smoke') {
          size = effect.size * (1 + (1 - effect.life) * 2);
          const gradient = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, size);
          gradient.addColorStop(0, `rgba(80, 80, 80, ${effect.life * 0.3})`);
          gradient.addColorStop(1, `rgba(50, 50, 50, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, size, 0, 2 * Math.PI);
          ctx.fill();
        } else if (effect.type === 'lightning' || effect.type === 'lightning_arc' || effect.type === 'chain_arc') {
          // Optimized Lightning bolts (No shadowBlur)
          const endX = effect.x + (Math.random() - 0.5) * 30;
          const endY = effect.y + (Math.random() - 0.5) * 30;
          
          ctx.lineCap = 'round';
          
          // Outer glow (simulated with wider stroke)
          ctx.strokeStyle = `hsla(60, 100%, 70%, ${effect.life * 0.4})`;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(effect.x, effect.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          
          // Inner core
          ctx.strokeStyle = `hsla(60, 100%, 90%, ${effect.life})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(effect.x, effect.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          
          // Core glow circle
          const gradient = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, size * 2);
          gradient.addColorStop(0, `hsla(60, 100%, 90%, ${effect.life * 0.5})`);
          gradient.addColorStop(1, `hsla(60, 100%, 50%, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, size * 2, 0, 2 * Math.PI);
          ctx.fill();
        } else if (effect.type === 'quantum') {
          size = effect.size * effect.life;
          // Pulsing quantum particles
          const pulseSize = size * (1 + Math.sin(Date.now() * 0.01 + effect.x) * 0.3);
          const gradient = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, pulseSize);
          gradient.addColorStop(0, `hsla(280, 100%, 70%, ${effect.life * 0.9})`);
          gradient.addColorStop(0.5, `hsla(280, 90%, 50%, ${effect.life * 0.6})`);
          gradient.addColorStop(1, `hsla(280, 80%, 30%, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, pulseSize, 0, 2 * Math.PI);
          ctx.fill();
          
          // Inner core
          ctx.fillStyle = `hsla(280, 100%, 90%, ${effect.life})`;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, size * 0.3, 0, 2 * Math.PI);
          ctx.fill();
        } else if (effect.type === 'gravity' || effect.type === 'gravity_trail') {
          const gradient = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, size * 2);
          gradient.addColorStop(0, `hsla(270, 100%, 60%, ${effect.life * 0.8})`);
          gradient.addColorStop(1, `hsla(270, 80%, 30%, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, size * 2, 0, 2 * Math.PI);
          ctx.fill();
        } else if (effect.type === 'ice' || effect.type === 'ice_shatter') {
          // Ice crystal shape
          ctx.save();
          ctx.translate(effect.x, effect.y);
          ctx.rotate((effect.life * 10) % (Math.PI * 2));
          
          ctx.fillStyle = `hsla(200, 100%, 70%, ${effect.life * 0.8})`;
          ctx.strokeStyle = `hsla(200, 100%, 90%, ${effect.life})`;
          ctx.lineWidth = 1;
          
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6;
            const x = Math.cos(angle) * size;
            const y = Math.sin(angle) * size;
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          
          // Cross lines
          for (let i = 0; i < 3; i++) {
            const angle = (Math.PI * i) / 3;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * size, Math.sin(angle) * size);
            ctx.lineTo(Math.cos(angle + Math.PI) * size, Math.sin(angle + Math.PI) * size);
            ctx.stroke();
          }
          
          ctx.restore();
          
          // Glow
          const gradient = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, size * 2);
          gradient.addColorStop(0, `hsla(200, 100%, 80%, ${effect.life * 0.3})`);
          gradient.addColorStop(1, `hsla(200, 100%, 60%, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, size * 2, 0, 2 * Math.PI);
          ctx.fill();
        } else {
          // Default particle
          const gradient = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, size);
          gradient.addColorStop(0, `hsla(${effect.hue}, 90%, 60%, ${effect.life})`);
          gradient.addColorStop(1, `hsla(${effect.hue}, 90%, 40%, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, size, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    });
    
    abilityEffectsRef.current = abilityEffectsRef.current.filter(p => p.life > 0 && (!p.delay || p.delay <= 0));
    
    // Draw ghost balls from quantum split
    ghostBalls.forEach(ghost => {
      const alpha = ghost.life * 0.7;
      const gradient = ctx.createRadialGradient(
        ghost.x - ghost.size * 0.3,
        ghost.y - ghost.size * 0.3,
        0,
        ghost.x,
        ghost.y,
        ghost.size
      );
      gradient.addColorStop(0, `hsla(280, 100%, 80%, ${alpha})`);
      gradient.addColorStop(0.7, `hsla(280, 90%, 60%, ${alpha * 0.7})`);
      gradient.addColorStop(1, `hsla(280, 80%, 40%, ${alpha * 0.3})`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(ghost.x, ghost.y, ghost.size, 0, 2 * Math.PI);
      ctx.fill();
      
      // Outer glow
      const outerGradient = ctx.createRadialGradient(ghost.x, ghost.y, ghost.size, ghost.x, ghost.y, ghost.size * 2);
      outerGradient.addColorStop(0, `hsla(280, 100%, 70%, ${alpha * 0.5})`);
      outerGradient.addColorStop(1, `hsla(280, 100%, 50%, 0)`);
      ctx.fillStyle = outerGradient;
      ctx.beginPath();
      ctx.arc(ghost.x, ghost.y, ghost.size * 2, 0, 2 * Math.PI);
      ctx.fill();
      
      // Quantum shimmer
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI * 2 * i) / 4 + Date.now() * 0.005;
        const shimmerX = ghost.x + Math.cos(angle) * ghost.size * 0.7;
        const shimmerY = ghost.y + Math.sin(angle) * ghost.size * 0.7;
        ctx.fillStyle = `hsla(280, 100%, 90%, ${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(shimmerX, shimmerY, 2, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // Draw impact particles
    impactParticles.forEach(particle => {
      particle.life -= 0.02;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.95;
      particle.vy *= 0.95;
      
      if (particle.life > 0) {
        const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.size);
        gradient.addColorStop(0, `hsla(${particle.hue}, 80%, 60%, ${particle.life})`);
        gradient.addColorStop(1, `hsla(${particle.hue}, 80%, 40%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
    
    setImpactParticles(prev => prev.filter(p => p.life > 0));

    // Ghost ball and trajectory prediction
    if (showGhostBall && aimingData.isAiming) {
      const ghostBall = calculateGhostBall();
      if (ghostBall) {
        // Draw line to target ball
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(aimingData.cueBall.x, aimingData.cueBall.y);
        ctx.lineTo(ghostBall.targetBall.x, ghostBall.targetBall.y);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw ghost ball
        const ghostGradient = ctx.createRadialGradient(
          ghostBall.x, ghostBall.y, 0,
          ghostBall.x, ghostBall.y, BALL_RADIUS
        );
        ghostGradient.addColorStop(0, 'rgba(100, 200, 255, 0.4)');
        ghostGradient.addColorStop(1, 'rgba(100, 200, 255, 0.1)');
        
        ctx.fillStyle = ghostGradient;
        ctx.beginPath();
        ctx.arc(ghostBall.x, ghostBall.y, BALL_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Contact point indicator
        ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
        ctx.beginPath();
        ctx.arc(ghostBall.x, ghostBall.y, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    
    if (showTrajectory && aimingData.isAiming) {
      const trajectory = predictTrajectory();
      if (trajectory.length > 0) {
        ctx.strokeStyle = 'rgba(255, 200, 100, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(aimingData.cueBall.x, aimingData.cueBall.y);
        
        trajectory.forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw bounce indicators
        trajectory.filter(p => p.isBounce).forEach(point => {
          const bounceGradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 8);
          bounceGradient.addColorStop(0, 'rgba(255, 200, 100, 0.8)');
          bounceGradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
          
          ctx.fillStyle = bounceGradient;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
    }

    // Enhanced balls with 3D effect and speed glow
    gameStateRef.current.balls.forEach(ball => {
      if (!ball.pocketed) {
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        
        // Speed-based glow
        if (speed > 2) {
          const glowRadius = ball.radius + speed * 2;
          const glowGradient = ctx.createRadialGradient(ball.x, ball.y, ball.radius, ball.x, ball.y, glowRadius);
          glowGradient.addColorStop(0, 'rgba(100, 200, 255, 0)');
          glowGradient.addColorStop(1, `rgba(100, 200, 255, ${Math.min(speed / 10, 0.4)})`);
          
          ctx.fillStyle = glowGradient;
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, glowRadius, 0, 2 * Math.PI);
          ctx.fill();
        }
        
        // Ball shadow with blur
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(ball.x + 4, ball.y + 4, ball.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // 3D ball gradient
        const ballGradient = ctx.createRadialGradient(
          ball.x - ball.radius * 0.4, ball.y - ball.radius * 0.4, 0,
          ball.x, ball.y, ball.radius * 1.4
        );
        
        if (ball.type === 'cue') {
          ballGradient.addColorStop(0, '#FFFFFF');
          ballGradient.addColorStop(0.3, '#F0F0F0');
          ballGradient.addColorStop(1, '#C0C0C0');
        } else {
          const lightColor = ball.color.replace('#', '');
          const r = parseInt(lightColor.substr(0, 2), 16);
          const g = parseInt(lightColor.substr(2, 2), 16);
          const b = parseInt(lightColor.substr(4, 2), 16);
          
          ballGradient.addColorStop(0, `rgb(${Math.min(r + 80, 255)}, ${Math.min(g + 80, 255)}, ${Math.min(b + 80, 255)})`);
          ballGradient.addColorStop(0.5, ball.color);
          ballGradient.addColorStop(1, `rgb(${Math.max(r - 60, 0)}, ${Math.max(g - 60, 0)}, ${Math.max(b - 60, 0)})`);
        }
        
        ctx.fillStyle = ballGradient;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Glossy rim
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Ball number
        if (ball.type !== 'cue') {
          ctx.fillStyle = ball.color === '#1A1A1A' ? '#FFFFFF' : '#000000';
          ctx.font = `bold ${Math.floor(ball.radius * 0.9)}px "Orbitron", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ball.number.toString(), ball.x, ball.y);
        }
        
        // Enhanced stripe rendering - diagonal stripes
        if (ball.type === 'stripe' && ball.number > 8) {
          ctx.save();
          ctx.translate(ball.x, ball.y);
          
          // Create circular clipping path
          ctx.beginPath();
          ctx.arc(0, 0, ball.radius - 2, 0, 2 * Math.PI);
          ctx.clip();
          
          // Draw diagonal stripes
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          const stripeWidth = 3;
          const stripeGap = 3;
          
          for (let i = -ball.radius * 2; i < ball.radius * 2; i += stripeWidth + stripeGap) {
            ctx.fillRect(i, -ball.radius, stripeWidth, ball.radius * 2);
          }
          
          ctx.restore();
        }
        
        // DRAMATICALLY ENHANCED ability visual indicators on ball
        if (ball.activeAbility) {
          const abilityGlowSize = ball.radius + 12;
          let glowColor = 'rgba(255, 255, 255, 0.5)';
          
          if (ball.activeAbility === 'explosive_impact') {
            glowColor = 'rgba(255, 150, 50, 0.7)';
            
            // Meteor aura - layered fire effect
            for (let layer = 0; layer < 4; layer++) {
              const layerRadius = ball.radius + 8 + layer * 6;
              const layerGradient = ctx.createRadialGradient(ball.x, ball.y, ball.radius, ball.x, ball.y, layerRadius);
              layerGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
              layerGradient.addColorStop(0.5, `rgba(255, ${150 - layer * 30}, 50, ${0.4 - layer * 0.08})`);
              layerGradient.addColorStop(1, `rgba(255, ${100 - layer * 20}, 0, 0)`);
              ctx.fillStyle = layerGradient;
              ctx.beginPath();
              ctx.arc(ball.x, ball.y, layerRadius, 0, 2 * Math.PI);
              ctx.fill();
            }
            
            // Flame particles orbiting
            for (let i = 0; i < 8; i++) {
              const angle = (Math.PI * 2 * i) / 8 + timeRef.current * 2;
              const orbitRadius = ball.radius + 12;
              const flameX = ball.x + Math.cos(angle) * orbitRadius;
              const flameY = ball.y + Math.sin(angle) * orbitRadius;
              const flameGradient = ctx.createRadialGradient(flameX, flameY, 0, flameX, flameY, 4);
              flameGradient.addColorStop(0, 'rgba(255, 200, 100, 0.9)');
              flameGradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
              ctx.fillStyle = flameGradient;
              ctx.beginPath();
              ctx.arc(flameX, flameY, 4, 0, 2 * Math.PI);
              ctx.fill();
            }
            
          } else if (ball.lightningActive) {
            glowColor = 'rgba(255, 255, 100, 0.7)';
            
            // Electric field aura
            const fieldGradient = ctx.createRadialGradient(ball.x, ball.y, ball.radius, ball.x, ball.y, ball.radius + 20);
            fieldGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            fieldGradient.addColorStop(0.5, 'rgba(255, 255, 150, 0.3)');
            fieldGradient.addColorStop(1, 'rgba(255, 255, 100, 0)');
            ctx.fillStyle = fieldGradient;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius + 20, 0, 2 * Math.PI);
            ctx.fill();
            
            // Lightning arcs shooting out
            for (let i = 0; i < 6; i++) {
              const angle = (Math.PI * 2 * i) / 6 + timeRef.current * 4;
              const boltLength = 20 + Math.sin(timeRef.current * 5 + i) * 8;
              const segments = 5;
              
              ctx.strokeStyle = `rgba(255, 255, 150, ${0.9 * (0.5 + Math.sin(timeRef.current * 8 + i) * 0.5)})`;
              ctx.lineWidth = 3;
              ctx.shadowBlur = 10;
              ctx.shadowColor = 'rgba(255, 255, 100, 0.8)';
              ctx.lineCap = 'round';
              
              ctx.beginPath();
              let currentX = ball.x + Math.cos(angle) * ball.radius;
              let currentY = ball.y + Math.sin(angle) * ball.radius;
              ctx.moveTo(currentX, currentY);
              
              for (let seg = 0; seg < segments; seg++) {
                const segmentLength = boltLength / segments;
                const targetX = ball.x + Math.cos(angle) * (ball.radius + segmentLength * (seg + 1));
                const targetY = ball.y + Math.sin(angle) * (ball.radius + segmentLength * (seg + 1));
                const offsetX = (Math.random() - 0.5) * 8;
                const offsetY = (Math.random() - 0.5) * 8;
                currentX = targetX + offsetX;
                currentY = targetY + offsetY;
                ctx.lineTo(currentX, currentY);
              }
              ctx.stroke();
              ctx.shadowBlur = 0;
            }
            
            // Electric sparks
            for (let i = 0; i < 12; i++) {
              const angle = Math.random() * Math.PI * 2;
              const dist = ball.radius + 5 + Math.random() * 15;
              const sparkX = ball.x + Math.cos(angle) * dist;
              const sparkY = ball.y + Math.sin(angle) * dist;
              ctx.fillStyle = `rgba(255, 255, 200, ${Math.random() * 0.8 + 0.2})`;
              ctx.beginPath();
              ctx.arc(sparkX, sparkY, 1 + Math.random() * 2, 0, 2 * Math.PI);
              ctx.fill();
            }
            
          } else if (ball.quantumSplit) {
            glowColor = 'rgba(200, 100, 255, 0.7)';
            
            // Quantum field distortion rings
            for (let i = 0; i < 5; i++) {
              const phase = timeRef.current * 3 + i * 1.2;
              const rippleRadius = ball.radius + 8 + (i * 10) + (Math.sin(phase) * 6);
              const alpha = (0.5 - i * 0.08) * (0.5 + Math.sin(phase) * 0.5);
              
              const gradient = ctx.createRadialGradient(ball.x, ball.y, rippleRadius - 3, ball.x, ball.y, rippleRadius + 3);
              gradient.addColorStop(0, `rgba(200, 100, 255, 0)`);
              gradient.addColorStop(0.5, `rgba(200, 100, 255, ${alpha})`);
              gradient.addColorStop(1, `rgba(200, 100, 255, 0)`);
              
              ctx.strokeStyle = gradient;
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.arc(ball.x, ball.y, rippleRadius, 0, 2 * Math.PI);
              ctx.stroke();
            }
            
            // Quantum particles orbiting
            for (let i = 0; i < 16; i++) {
              const angle = (Math.PI * 2 * i) / 16 + timeRef.current * 2;
              const orbitRadius = ball.radius + 15 + Math.sin(timeRef.current * 3 + i) * 5;
              const particleX = ball.x + Math.cos(angle) * orbitRadius;
              const particleY = ball.y + Math.sin(angle) * orbitRadius;
              const particleSize = 2 + Math.sin(timeRef.current * 4 + i) * 1;
              
              const particleGradient = ctx.createRadialGradient(particleX, particleY, 0, particleX, particleY, particleSize * 2);
              particleGradient.addColorStop(0, 'rgba(220, 120, 255, 0.9)');
              particleGradient.addColorStop(1, 'rgba(180, 80, 255, 0)');
              ctx.fillStyle = particleGradient;
              ctx.beginPath();
              ctx.arc(particleX, particleY, particleSize * 2, 0, 2 * Math.PI);
              ctx.fill();
            }
            
          } else if (ball.blackHole) {
            glowColor = 'rgba(100, 50, 200, 0.9)';
            
            // Gravity distortion - multiple spiraling rings
            const wellRadius = ball.blackHole.radius;
            for (let ring = 0; ring < 12; ring++) {
              const radius = (wellRadius / 12) * ring;
              const rotation = timeRef.current * (1 + ring * 0.1);
              const alpha = (0.4 - ring * 0.03) * (0.7 + Math.sin(timeRef.current * 2 + ring) * 0.3);
              
              ctx.save();
              ctx.translate(ball.x, ball.y);
              ctx.rotate(rotation);
              
              ctx.strokeStyle = `rgba(120, 60, 220, ${alpha})`;
              ctx.lineWidth = 3;
              ctx.beginPath();
              
              // Spiral path
              for (let i = 0; i <= 100; i++) {
                const t = i / 100;
                const angle = t * Math.PI * 4;
                const r = radius * (1 - t * 0.3);
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                
                if (i === 0) {
                  ctx.moveTo(x, y);
                } else {
                  ctx.lineTo(x, y);
                }
              }
              ctx.stroke();
              ctx.restore();
            }
            
            // Accretion disk effect
            for (let i = 0; i < 40; i++) {
              const angle = (Math.PI * 2 * i) / 40 + timeRef.current * 2;
              const dist = ball.radius + 20 + Math.sin(timeRef.current * 3 + i) * 10;
              const particleX = ball.x + Math.cos(angle) * dist;
              const particleY = ball.y + Math.sin(angle) * dist;
              
              const particleGradient = ctx.createRadialGradient(particleX, particleY, 0, particleX, particleY, 3);
              particleGradient.addColorStop(0, 'rgba(150, 80, 255, 0.8)');
              particleGradient.addColorStop(1, 'rgba(100, 50, 200, 0)');
              ctx.fillStyle = particleGradient;
              ctx.beginPath();
              ctx.arc(particleX, particleY, 3, 0, 2 * Math.PI);
              ctx.fill();
            }
            
            // Event horizon effect
            const horizonGradient = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.radius + 8);
            horizonGradient.addColorStop(0, 'rgba(50, 20, 100, 0.8)');
            horizonGradient.addColorStop(0.7, 'rgba(100, 50, 200, 0.4)');
            horizonGradient.addColorStop(1, 'rgba(100, 50, 200, 0)');
            ctx.fillStyle = horizonGradient;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius + 8, 0, 2 * Math.PI);
            ctx.fill();
            
          } else if (ball.frozen) {
            glowColor = 'rgba(100, 200, 255, 0.8)';
            
            // Ice shell with crystalline pattern
            ctx.strokeStyle = 'rgba(150, 220, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius + 4, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Frost crystals radiating out
            for (let i = 0; i < 12; i++) {
              const angle = (Math.PI * 2 * i) / 12;
              const innerRadius = ball.radius;
              const outerRadius = ball.radius + 12;
              
              ctx.strokeStyle = 'rgba(150, 220, 255, 0.7)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(ball.x + Math.cos(angle) * innerRadius, ball.y + Math.sin(angle) * innerRadius);
              ctx.lineTo(ball.x + Math.cos(angle) * outerRadius, ball.y + Math.sin(angle) * outerRadius);
              ctx.stroke();
              
              // Branch crystals
              for (let branch = -1; branch <= 1; branch += 2) {
                const branchAngle = angle + (Math.PI / 6) * branch;
                const branchLength = 6;
                ctx.beginPath();
                ctx.moveTo(ball.x + Math.cos(angle) * outerRadius, ball.y + Math.sin(angle) * outerRadius);
                ctx.lineTo(
                  ball.x + Math.cos(angle) * outerRadius + Math.cos(branchAngle) * branchLength,
                  ball.y + Math.sin(angle) * outerRadius + Math.sin(branchAngle) * branchLength
                );
                ctx.stroke();
              }
            }
            
            // Snowflake particles
            for (let i = 0; i < 20; i++) {
              const angle = Math.random() * Math.PI * 2;
              const dist = ball.radius + Math.random() * 15;
              const snowX = ball.x + Math.cos(angle) * dist;
              const snowY = ball.y + Math.sin(angle) * dist + Math.sin(timeRef.current * 2 + i) * 3;
              
              ctx.save();
              ctx.translate(snowX, snowY);
              ctx.rotate(timeRef.current + i);
              
              ctx.fillStyle = 'rgba(200, 240, 255, 0.8)';
              ctx.beginPath();
              for (let arm = 0; arm < 6; arm++) {
                const armAngle = (Math.PI * 2 * arm) / 6;
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(armAngle) * 2, Math.sin(armAngle) * 2);
              }
              ctx.stroke();
              ctx.restore();
            }
            
            // Icy glow
            const iceGradient = ctx.createRadialGradient(ball.x, ball.y, ball.radius, ball.x, ball.y, ball.radius + 15);
            iceGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            iceGradient.addColorStop(0.5, 'rgba(150, 220, 255, 0.4)');
            iceGradient.addColorStop(1, 'rgba(100, 200, 255, 0)');
            ctx.fillStyle = iceGradient;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius + 15, 0, 2 * Math.PI);
            ctx.fill();
          }
          
          // Base ability glow
          const abilityGlow = ctx.createRadialGradient(ball.x, ball.y, ball.radius, ball.x, ball.y, abilityGlowSize);
          abilityGlow.addColorStop(0, 'rgba(0, 0, 0, 0)');
          abilityGlow.addColorStop(0.7, glowColor);
          abilityGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          
          ctx.fillStyle = abilityGlow;
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, abilityGlowSize, 0, 2 * Math.PI);
          ctx.fill();
        }
        
        // Shine highlight
        const shineGradient = ctx.createRadialGradient(
          ball.x - ball.radius * 0.5, ball.y - ball.radius * 0.5, 0,
          ball.x - ball.radius * 0.5, ball.y - ball.radius * 0.5, ball.radius * 0.4
        );
        shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = shineGradient;
        ctx.beginPath();
        ctx.arc(ball.x - ball.radius * 0.4, ball.y - ball.radius * 0.4, ball.radius * 0.3, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
    
    // Restore canvas transform (end screen shake)
    ctx.restore();
    
    // Flash effect overlay (on top of everything)
    if (flashEffect.active) {
      ctx.save();
      ctx.fillStyle = flashEffect.color;
      ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
      ctx.restore();
    }
    
    // Futuristic cue stick
    if (aimingData.isAiming && aimingData.cueBall) {
      const cue = aimingData.cueBall;
      const cueLength = 100 + aimingData.power * 4;
      const cueX = cue.x + Math.cos(aimingData.angle + Math.PI) * cueLength;
      const cueY = cue.y + Math.sin(aimingData.angle + Math.PI) * cueLength;
      
      // Cue gradient with metallic look
      const cueGradient = ctx.createLinearGradient(cueX, cueY, cue.x, cue.y);
      cueGradient.addColorStop(0, '#4a5568');
      cueGradient.addColorStop(0.3, '#718096');
      cueGradient.addColorStop(0.7, '#2d3748');
      cueGradient.addColorStop(1, '#1a202c');
      
      ctx.strokeStyle = cueGradient;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(100, 150, 255, 0.5)';
      ctx.beginPath();
      ctx.moveTo(cueX, cueY);
      ctx.lineTo(cue.x + Math.cos(aimingData.angle + Math.PI) * (BALL_RADIUS + 10), cue.y + Math.sin(aimingData.angle + Math.PI) * (BALL_RADIUS + 10));
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Cue tip glow
      const tipX = cue.x + Math.cos(aimingData.angle + Math.PI) * (BALL_RADIUS + 10);
      const tipY = cue.y + Math.sin(aimingData.angle + Math.PI) * (BALL_RADIUS + 10);
      
      ctx.fillStyle = 'rgba(0, 150, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      // Aiming line with gradient
      const lineGradient = ctx.createLinearGradient(cue.x, cue.y, cue.x - Math.cos(aimingData.angle + Math.PI) * 150, cue.y - Math.sin(aimingData.angle + Math.PI) * 150);
      lineGradient.addColorStop(0, 'rgba(100, 200, 255, 0.8)');
      lineGradient.addColorStop(1, 'rgba(100, 200, 255, 0)');
      
      ctx.strokeStyle = lineGradient;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(cue.x, cue.y);
      ctx.lineTo(cue.x - Math.cos(aimingData.angle + Math.PI) * 150, cue.y - Math.sin(aimingData.angle + Math.PI) * 150);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [aimingData, tableDimensions, visualizerMode, is3DMode, cameraAngle, cameraZoom, transitioning3D, transitionProgress, draw3DScene, ghostBalls, abilityEffects, renderQuality, lightPosition, screenShake, flashEffect, ballTrails, impactParticles, enhancedEffects, showGhostBall, showTrajectory, calculateGhostBall, predictTrajectory, timeScale]);

  const gameLoop = useCallback(() => {
    updatePhysics();
    draw();
    // Do not recursively call RAF here, handled by the effect loop
  }, [updatePhysics, draw]);

  // Update the stable ref whenever gameLoop changes
  useEffect(() => {
    gameLoopRef.current = gameLoop;
  }, [gameLoop]);

  const handleMouseDown = useCallback((event) => {
    const canvas = canvasRef.current;
    
    // Defensive check: ensure we're not in the middle of a shot
    if (!canvas || !gameState.gameStarted || gameState.gameOver) return;
    
    // Critical: Use ref for synchronous check to prevent race conditions
    if (shotInProgressRef.current) {
      console.log('Shot already in progress, ignoring click');
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = tableDimensions.width / rect.width;
    const scaleY = tableDimensions.height / rect.height;
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;
    
    // Find cue ball - ensure it exists and is not pocketed
    const cueBall = gameStateRef.current.balls.find(ball => ball.type === 'cue' && !ball.pocketed);
    if (!cueBall) {
      console.log('Cue ball not found or is pocketed');
      return;
    }
    
    let hit = false;

    if (is3DMode) {
      // 3D Hit Detection: Project cue ball to screen space
      const centerX = tableDimensions.width / 2;
      const centerY = tableDimensions.height / 2;
      const pos = perspective3D(cueBall.x - centerX, cueBall.y - centerY, render3DRef.current.ballElevation, centerX, centerY);
      
      if (pos.visible) {
        const dx = mouseX - pos.x;
        const dy = mouseY - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Larger hit area in 3D for easier grabbing, scaled by perspective
        if (dist < BALL_RADIUS * pos.scale * 4) hit = true;
      }
    } else {
      // 2D Hit Detection
      const dx = mouseX - cueBall.x;
      const dy = mouseY - cueBall.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < BALL_RADIUS * 4) hit = true;
    }
    
    if (hit) {
      mouseRef.current.down = true;
      setAimingData({
        isAiming: true,
        power: 0,
        angle: is3DMode ? 0 : Math.atan2(mouseY - cueBall.y, mouseX - cueBall.x),
        cueBall: cueBall
      });
      console.log('Aiming started');
    } else if (is3DMode && !gameState.gameOver) {
      // Start Camera Drag if clicking background in 3D mode
      dragRef.current = {
        active: true,
        startX: event.clientX,
        startY: event.clientY,
        startAngleX: cameraAngle.x,
        startAngleY: cameraAngle.y
      };
    }
  }, [gameState.gameOver, gameState.gameStarted, tableDimensions, is3DMode, perspective3D, cameraAngle]);

  const handleMouseMove = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = tableDimensions.width / rect.width;
    const scaleY = tableDimensions.height / rect.height;
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;
    
    mouseRef.current.x = mouseX;
    mouseRef.current.y = mouseY;
    
    // Handle Camera Dragging
    if (is3DMode && dragRef.current.active) {
      const deltaX = event.clientX - dragRef.current.startX;
      const deltaY = event.clientY - dragRef.current.startY;
      
      const sensitivity = 0.4;
      
      // Calculate new angles
      let newAngleX = dragRef.current.startAngleX + (deltaY * sensitivity);
      let newAngleY = dragRef.current.startAngleY + (deltaX * sensitivity);
      
      // Clamp Tilt (X axis) to prevent going under table or flipping
      newAngleX = Math.max(-85, Math.min(-5, newAngleX));
      
      setCameraAngle({ x: newAngleX, y: newAngleY });
      
      // Switch to custom preset if dragging
      if (cameraPreset !== 'custom') setCameraPreset('custom');
      return;
    }

    if (mouseRef.current.down && aimingData.isAiming && aimingData.cueBall) {
      let angle = 0;
      let power = 0;

      if (is3DMode) {
        // 3D Aiming Logic: Inverse Projection
        const centerX = tableDimensions.width / 2;
        const centerY = tableDimensions.height / 2;
        const pos = perspective3D(aimingData.cueBall.x - centerX, aimingData.cueBall.y - centerY, render3DRef.current.ballElevation, centerX, centerY);
        
        const dx = mouseX - pos.x;
        const dy = mouseY - pos.y;
        
        // Convert screen vector back to table vector by reversing camera rotation
        const scale = pos.scale;
        const radY = (cameraAngle.y * Math.PI) / 180; // Yaw
        const radX = (cameraAngle.x * Math.PI) / 180; // Pitch
        
        // Prevent division by zero if pitch is exactly 0 (unlikely but safe)
        const sinPitch = Math.abs(Math.sin(radX)) < 0.1 ? 0.1 * Math.sign(Math.sin(radX)) : Math.sin(radX);
        
        // Unproject screen coordinates
        // x1 is horizontal screen delta (unscaled)
        // z1 is vertical screen delta (unscaled and un-foreshortened)
        const x1 = dx / scale;
        const z1 = dy / (scale * sinPitch);
        
        // Rotate back by Yaw to get table coordinates
        const tdx = x1 * Math.cos(radY) + z1 * Math.sin(radY);
        const tdy = -x1 * Math.sin(radY) + z1 * Math.cos(radY);
        
        angle = Math.atan2(tdy, tdx);
        
        // Calculate power based on de-projected table distance for consistency
        const tableDist = Math.sqrt(tdx * tdx + tdy * tdy);
        power = Math.min(tableDist / 8, MAX_POWER);
        
      } else {
        // 2D Aiming Logic
        const dx = mouseX - aimingData.cueBall.x;
        const dy = mouseY - aimingData.cueBall.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        power = Math.min(distance / 8, MAX_POWER);
        angle = Math.atan2(dy, dx);
      }
      
      setAimingData(prev => ({
        ...prev,
        angle: angle,
        power: power
      }));
    }
  }, [aimingData.isAiming, aimingData.cueBall, tableDimensions, is3DMode, perspective3D, cameraAngle]);

  const handleMouseUp = useCallback(() => {
    if (mouseRef.current.down && aimingData.isAiming && aimingData.cueBall) {
      // Safety check: don't start a shot if one is already in progress
      if (shotInProgressRef.current) {
        console.log('Shot already in progress, ignoring release');
        mouseRef.current.down = false;
        return;
      }
      
      const power = aimingData.power * powerMultiplier;
      const angle = aimingData.angle;
      
      // Minimum power check - don't shoot if power is too low
      if (power < 0.5) {
        console.log('Power too low, canceling shot');
        mouseRef.current.down = false;
        setAimingData({
          isAiming: false,
          power: 0,
          angle: 0,
          cueBall: null
        });
        return;
      }
      
      // Apply spin to shot
      const baseVx = Math.cos(angle) * power;
      const baseVy = Math.sin(angle) * power;
      
      // Add spin effect (perpendicular to shot direction)
      const spinX = -Math.sin(angle) * spinControl.x * power * 0.2;
      const spinY = Math.cos(angle) * spinControl.x * power * 0.2;
      
      aimingData.cueBall.vx = baseVx + spinX;
      aimingData.cueBall.vy = baseVy + spinY;
      
      // Store spin for visual feedback
      aimingData.cueBall.spin = { ...spinControl };
      
      // CHAOS MODE LOGIC - SEQUENTIAL CYCLING through all effects
      let chaosAbilityName = null;
      let triggerFps = false;

      if (chaosMode) {
        // Build the full list of chaos options (abilities + FPS mode)
        const chaosOptions = [...SPECIAL_ABILITIES.map(a => a.id), 'fps_mode'];
        
        // Get the current index and advance it
        const currentIndex = chaosIndexRef.current;
        chaosIndexRef.current = (currentIndex + 1) % chaosOptions.length;
        
        // Get the current chaos effect
        const chaosOption = chaosOptions[currentIndex];
        lastChaosEffectRef.current = chaosOption;
        
        if (chaosOption === 'fps_mode') {
           triggerFps = true;
           chaosAbilityName = "FPS Steering";
        } else {
           // Apply ability for free, skip bullet time for chaos mode
           applySpecialAbility(aimingData.cueBall, chaosOption, { free: true, skipBulletTime: true });
           const abilityDef = SPECIAL_ABILITIES.find(a => a.id === chaosOption);
           chaosAbilityName = abilityDef ? abilityDef.name : "Unknown Ability";
        }

      } else if (activeAbility) {
        // Standard ability logic (non-chaos)
        const ability = SPECIAL_ABILITIES.find(a => a.id === activeAbility);
        const cooldownTime = abilityCooldowns[activeAbility] || 0;
        const isOnCooldown = Date.now() < cooldownTime;
        
        if (ability && !isOnCooldown && abilityEnergy >= ability.energyCost) {
          applySpecialAbility(aimingData.cueBall, activeAbility);
          // Clear active ability immediately after use to remove UI overlay
          setActiveAbility(null);
        }
      }
      
      // Track shot history
      setShotHistory(prev => [...prev.slice(-9), {
        id: Date.now(),
        player: gameState.currentPlayer,
        power: aimingData.power,
        angle: aimingData.angle,
        spin: { ...spinControl },
        ability: chaosMode ? chaosAbilityName : activeAbility,
        timestamp: new Date().toISOString()
      }]);
      
      setTotalShots(prev => prev + 1);
      setCombo(0); // Reset combo on new shot
      updateContent(TQL.set('currentCombo', 0));
      
      // Check for ability unlocks
      checkAbilityUnlocks();
      
      console.log('Starting shot - setting shotInProgress to true');
      
      // Activate FPS Mode if triggered by Chaos Mode OR if POV Mode is enabled
      if (triggerFps || povModeEnabled) {
        setFpsMode(true);
        setIs3DMode(true); // Force 3D mode
        setTimeScale(0.15); // Start slow motion
      }

      // CRITICAL: Update ref FIRST for immediate synchronous access
      shotInProgressRef.current = true;
      
      // Then update state (async)
      setGameState(prev => ({
        ...prev,
        shotInProgress: true
      }));
      
      setAimingData({
        isAiming: false,
        power: 0,
        angle: 0,
        cueBall: null
      });
      
      setSpinControl({ x: 0, y: 0 }); // Reset spin after shot
    }
    
    mouseRef.current.down = false;
    dragRef.current.active = false;
  }, [aimingData, powerMultiplier, spinControl, gameState.currentPlayer, activeAbility, abilityEnergy, abilityCooldowns, applySpecialAbility, checkAbilityUnlocks, chaosMode, SPECIAL_ABILITIES, povModeEnabled]);

  const resetGame = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    console.log('Resetting game - clearing all states');
    
    // CRITICAL: Reset ref first (synchronous)
    shotInProgressRef.current = false;
    mouseRef.current.down = false;
    
    setGameState({
      score: { player1: 0, player2: 0 },
      currentPlayer: 1,
      gameStarted: false,
      gameOver: false,
      winner: null,
      lastPocketed: null,
      shotInProgress: false
    });
    
    setAimingData({
      isAiming: false,
      power: 0,
      angle: 0,
      cueBall: null
    });
    
    setCombo(0);
    setMaxComboThisGame(0);
    setTotalPocketedThisGame(0);
    setTotalShots(0);
    setFouls(0);
    setSpinControl({ x: 0, y: 0 });
    setFpsMode(false);
    setTimeScale(1);
    setBulletTimeActive(false);
    setImpactParticles([]);
    abilityEffectsRef.current = [];
    setAbilityEffects([]);
    setBallTrails({});
    updateContent(TQL.batch([TQL.set('currentCombo', 0), TQL.set('savedGame', null)]));
    
    rippleRef.current = [];
    
    setTimeout(() => initializeGame(), 100);
  }, [initializeGame]);


  // Keyboard shortcuts and Steering Control
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') steeringRef.current.left = true;
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') steeringRef.current.right = true;

      if (e.key === 'Escape') {
        setShowHelp(false);
        setSettingsOpen(false);
        setShowVisualizerMenu(false);
        setShowShotHistory(false);
        setShowCameraControls(false);
      }
      if (e.key === 'h' && !showHelp) {
        setShowHelp(true);
      }
      if (e.key === 'r' && !gameState.shotInProgress) {
        resetGame();
      }
      if (e.key === 's') {
        setSettingsOpen(prev => !prev);
      }
      if (e.key === 'p' && !gameState.shotInProgress) {
        setPracticeMode(prev => !prev);
      }
      if (e.key === 'c') {
        setControlPanelOpen(prev => !prev);
      }
      if (e.key === '3') {
        setIs3DMode(prev => !prev);
      }
      if (e.key === 'v' && is3DMode) {
        setShowCameraControls(prev => !prev);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') steeringRef.current.left = false;
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') steeringRef.current.right = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [showHelp, gameState.shotInProgress, is3DMode, resetGame]);


  useEffect(() => {
    // Only start the loop if game is valid
    if (!gameState.gameStarted || gameState.gameOver) return;

    const loop = () => {
      // Always call the freshest version of the loop function
      if (gameLoopRef.current) {
        gameLoopRef.current();
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    // Start the persistent loop
    animationFrameRef.current = requestAnimationFrame(loop);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState.gameStarted, gameState.gameOver]); // Removed gameLoop from dependency to prevent restarts

  return (
    <div 
      ref={containerRef}
      className="game-surface h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 overflow-hidden relative"
      style={{ fontFamily: '"Orbitron", sans-serif' }}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-blue-400/30 rounded-full"
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight 
            }}
            animate={{
              y: [null, Math.random() * window.innerHeight],
              opacity: [0.2, 0.5, 0.2]
            }}
            transition={{
              duration: 10 + Math.random() * 10,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
      </div>

      {/* Minimalist Floating Header */}
      <div className="game-header absolute top-4 left-0 right-0 z-10 px-6 flex justify-between items-start pointer-events-none">
        
        {/* Left: Minimal Title & Status */}
        <div className="pointer-events-auto flex flex-col items-start gap-2">
           <div className="flex items-center space-x-2 bg-slate-950/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
             <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
             <span className="text-cyan-100 font-bold tracking-widest text-xs">CYBER POOL</span>
           </div>
           
           {practiceMode && (
              <div className="bg-amber-500/20 backdrop-blur-md px-3 py-1 rounded-full border border-amber-400/30">
                <span className="text-amber-300 text-[10px] font-bold tracking-wider">PRACTICE</span>
              </div>
           )}
        </div>

        {/* Center: Floating Scoreboard */}
        <div className="pointer-events-auto bg-slate-950/60 backdrop-blur-xl rounded-2xl p-1 border border-white/5 shadow-2xl flex items-center gap-4 px-6 py-2">
            <div className="flex flex-col items-center">
                <span className={`text-2xl font-black ${gameState.currentPlayer === 1 ? 'text-cyan-400 drop-shadow-lg' : 'text-slate-500'}`}>
                    {gameState.score.player1}
                </span>
                <div className="h-1 w-8 rounded-full bg-cyan-500/30">
                    {gameState.currentPlayer === 1 && <motion.div layoutId="activePlayer" className="h-full w-full bg-cyan-400 rounded-full" />}
                </div>
            </div>

            <div className="text-slate-600 font-bold text-xs px-2">VS</div>

            <div className="flex flex-col items-center">
                <span className={`text-2xl font-black ${gameState.currentPlayer === 2 ? 'text-pink-400 drop-shadow-lg' : 'text-slate-500'}`}>
                    {gameState.score.player2}
                </span>
                <div className="h-1 w-8 rounded-full bg-pink-500/30">
                    {gameState.currentPlayer === 2 && <motion.div layoutId="activePlayer" className="h-full w-full bg-pink-400 rounded-full" />}
                </div>
            </div>
        </div>

        {/* Right: Minimal Controls */}
        <div className="pointer-events-auto flex gap-2">
            <button
              aria-label="Toggle 3D view"
              onClick={() => {
                previousModeRef.current = is3DMode;
                if (!is3DMode) {
                  // Use improved defaults (matching the updated 'default' preset)
                  setTargetCameraAngle({ x: -40, y: 0 });
                  setTargetCameraZoom(1.15);
                  setCameraAngle({ x: 0, y: 0 });
                  setTransitionProgress(0);
                  setRenderQuality(0);
                  setIs3DMode(true);
                  setTransitioning3D(true);
                  setShowCameraControls(false); // Closed by default as requested
                } else {
                  setTargetCameraAngle({ x: 0, y: 0 });
                  setTransitionProgress(0);
                  setTransitioning3D(true);
                  setTimeout(() => {
                    setIs3DMode(false);
                    setTransitioning3D(false);
                    setRenderQuality(1);
                    setCameraAngle({ x: -45, y: 0 });
                  }, 600);
                }
              }}
              className={`p-3 rounded-full transition-all border ${
                is3DMode 
                ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.5)]' 
                : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
               <CameraIcon className="w-5 h-5" />
            </button>

            <button aria-label="New game" onClick={resetGame} className="p-3 bg-slate-900/60 hover:bg-slate-800/80 rounded-full text-cyan-400 border border-slate-700 transition-all">
                <RotateCcwIcon className="w-5 h-5" />
            </button>
            
            <button aria-label="Settings" onClick={() => setSettingsOpen(true)} className="p-3 bg-slate-900/60 hover:bg-slate-800/80 rounded-full text-slate-400 border border-slate-700 transition-all">
                <InfoIcon className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* Unified Control Panel */}
      <AnimatePresence>
        {controlPanelOpen && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="absolute top-16 right-4 z-10 w-80 bg-slate-950/60 backdrop-blur-2xl rounded-2xl border border-cyan-500/20 shadow-2xl overflow-hidden"
          >
            {/* Panel Header */}
            <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 px-4 py-3 border-b border-cyan-500/20 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ZapIcon className="h-4 w-4 text-cyan-400" />
                <span className="text-cyan-300 font-bold text-sm tracking-wider">CONTROLS</span>
              </div>
              <button
                onClick={() => setControlPanelOpen(false)}
                className="p-1 hover:bg-slate-800/50 rounded transition-all text-cyan-400 hover:text-cyan-300"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Visualizer Section */}
              <div>
                <div className="text-cyan-400/80 text-xs font-medium tracking-wider mb-2 flex items-center space-x-2">
                  <WavesIcon className="h-3 w-3" />
                  <span>VISUALIZER</span>
                </div>
                <div className="space-y-2">
                  {VISUALIZER_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setVisualizerMode(mode.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all border ${
                        visualizerMode === mode.id
                          ? 'bg-slate-800/60 border-cyan-500/40'
                          : 'bg-slate-900/40 border-slate-700/40 hover:bg-slate-800/40 hover:border-slate-600/40'
                      }`}
                    >
                      <div className={`p-1.5 rounded-md bg-gradient-to-r ${mode.color}`}>
                        {React.createElement(mode.icon, { className: "h-3 w-3 text-white" })}
                      </div>
                      <span className="text-cyan-300 text-xs font-medium flex-1 text-left">{mode.name}</span>
                      {visualizerMode === mode.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-2 h-2 rounded-full bg-cyan-400"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Statistics Section */}
              <div>
                <div className="text-cyan-400/80 text-xs font-medium tracking-wider mb-2 flex items-center space-x-2">
                  <TrophyIcon className="h-3 w-3" />
                  <span>STATISTICS</span>
                </div>
                <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/40 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-cyan-300/70">High Score:</span>
                    <span className="text-amber-300 font-bold">{content?.statistics?.highScore || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-cyan-300/70">Games:</span>
                    <span className="text-cyan-100">{content?.statistics?.gamesPlayed || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-cyan-300/70">Best Combo:</span>
                    <span className="text-purple-300 font-bold">{content?.statistics?.bestCombo || 0}x</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-cyan-300/70">Current Shots:</span>
                    <span className="text-cyan-100">{totalShots}</span>
                  </div>
                </div>
              </div>

              {/* Advanced Aiming Section */}
              <div>
                <div className="text-cyan-400/80 text-xs font-medium tracking-wider mb-2 flex items-center space-x-2">
                  <CrosshairIcon className="h-3 w-3" />
                  <span>ADVANCED AIMING</span>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => setShowGhostBall(!showGhostBall)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all border ${
                      showGhostBall
                        ? 'bg-cyan-600/20 border-cyan-500/40'
                        : 'bg-slate-900/40 border-slate-700/40 hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-cyan-300 text-xs font-medium">Ghost Ball</span>
                    <div className={`w-10 h-5 rounded-full transition-all ${showGhostBall ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                      <motion.div
                        animate={{ x: showGhostBall ? 20 : 0 }}
                        className="w-4 h-4 bg-white rounded-full mt-0.5 ml-0.5 shadow-lg"
                      />
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setShowTrajectory(!showTrajectory)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all border ${
                      showTrajectory
                        ? 'bg-orange-600/20 border-orange-500/40'
                        : 'bg-slate-900/40 border-slate-700/40 hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-cyan-300 text-xs font-medium">Trajectory</span>
                    <div className={`w-10 h-5 rounded-full transition-all ${showTrajectory ? 'bg-orange-500' : 'bg-slate-700'}`}>
                      <motion.div
                        animate={{ x: showTrajectory ? 20 : 0 }}
                        className="w-4 h-4 bg-white rounded-full mt-0.5 ml-0.5 shadow-lg"
                      />
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setEnhancedEffects(!enhancedEffects)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all border ${
                      enhancedEffects
                        ? 'bg-purple-600/20 border-purple-500/40'
                        : 'bg-slate-900/40 border-slate-700/40 hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-cyan-300 text-xs font-medium">Enhanced FX</span>
                    <div className={`w-10 h-5 rounded-full transition-all ${enhancedEffects ? 'bg-purple-500' : 'bg-slate-700'}`}>
                      <motion.div
                        animate={{ x: enhancedEffects ? 20 : 0 }}
                        className="w-4 h-4 bg-white rounded-full mt-0.5 ml-0.5 shadow-lg"
                      />
                    </div>
                  </button>
                </div>
              </div>

              {/* Special Abilities Section */}
              <div>
                <div className="text-cyan-400/80 text-xs font-medium tracking-wider mb-2 flex items-center space-x-2">
                  <BoltIcon className="h-3 w-3" />
                  <span>SPECIAL ABILITIES</span>
                  <div className="flex-1"></div>
                  <span className="text-cyan-100 font-bold text-xs">{unlockedAbilities.length}/{SPECIAL_ABILITIES.length}</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {SPECIAL_ABILITIES.map((ability) => {
                    const isUnlocked = unlockedAbilities.includes(ability.id);
                    const isActive = activeAbility === ability.id;
                    const cooldownTime = abilityCooldowns[ability.id] || 0;
                    const isOnCooldown = Date.now() < cooldownTime;
                    const cooldownRemaining = Math.max(0, Math.ceil((cooldownTime - Date.now()) / 1000));
                    const canUse = isUnlocked && !isOnCooldown && abilityEnergy >= ability.energyCost;
                    
                    return (
                      <button
                        key={ability.id}
                        onClick={() => isUnlocked && setActiveAbility(isActive ? null : ability.id)}
                        disabled={!isUnlocked}
                        className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-all border relative ${
                          isActive && canUse
                            ? `bg-${ability.color}-600/30 border-${ability.color}-500/60 ring-2 ring-${ability.color}-500/40`
                            : isUnlocked
                            ? `bg-slate-900/40 border-slate-700/40 hover:bg-slate-800/50 hover:border-${ability.color}-500/30`
                            : 'bg-slate-900/20 border-slate-800/20 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className={`p-1.5 rounded-md ${
                          isUnlocked 
                            ? `bg-gradient-to-r from-${ability.color}-500 to-${ability.color}-600`
                            : 'bg-slate-700'
                        }`}>
                          {React.createElement(ability.icon, { className: "h-3 w-3 text-white" })}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="text-cyan-300 text-xs font-medium">{ability.name}</div>
                          <div className="text-cyan-100/50 text-xs">{ability.energyCost} Energy</div>
                        </div>
                        {isUnlocked && isOnCooldown && (
                          <div className="text-red-300 text-xs font-bold">{cooldownRemaining}s</div>
                        )}
                        {!isUnlocked && (
                          <div className="text-slate-500 text-xs">🔒</div>
                        )}
                        {isActive && canUse && (
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Game Mode Section */}
              <div>
                <div className="text-cyan-400/80 text-xs font-medium tracking-wider mb-2 flex items-center space-x-2">
                  <TargetIcon className="h-3 w-3" />
                  <span>GAME MODES</span>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => setPracticeMode(!practiceMode)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all border ${
                      practiceMode
                        ? 'bg-amber-600/20 border-amber-500/40'
                        : 'bg-slate-900/40 border-slate-700/40 hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-cyan-300 text-xs font-medium">Practice Mode</span>
                    <div className={`w-10 h-5 rounded-full transition-all ${practiceMode ? 'bg-amber-500' : 'bg-slate-700'}`}>
                      <motion.div
                        animate={{ x: practiceMode ? 20 : 0 }}
                        className="w-4 h-4 bg-white rounded-full mt-0.5 ml-0.5 shadow-lg"
                      />
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setAimAssist(!aimAssist)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all border ${
                      aimAssist
                        ? 'bg-blue-600/20 border-blue-500/40'
                        : 'bg-slate-900/40 border-slate-700/40 hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-cyan-300 text-xs font-medium">Aim Assist</span>
                    <div className={`w-10 h-5 rounded-full transition-all ${aimAssist ? 'bg-blue-500' : 'bg-slate-700'}`}>
                      <motion.div
                        animate={{ x: aimAssist ? 20 : 0 }}
                        className="w-4 h-4 bg-white rounded-full mt-0.5 ml-0.5 shadow-lg"
                      />
                    </div>
                  </button>

                  <button
                    onClick={() => setChaosMode(!chaosMode)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all border ${
                      chaosMode
                        ? 'bg-fuchsia-600/20 border-fuchsia-500/40'
                        : 'bg-slate-900/40 border-slate-700/40 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <SparklesIcon className={`w-3 h-3 ${chaosMode ? 'text-fuchsia-300' : 'text-slate-400'}`} />
                      <span className="text-cyan-300 text-xs font-medium">Chaos Mode</span>
                    </div>
                    <div className={`w-10 h-5 rounded-full transition-all ${chaosMode ? 'bg-fuchsia-500' : 'bg-slate-700'}`}>
                      <motion.div
                        animate={{ x: chaosMode ? 20 : 0 }}
                        className="w-4 h-4 bg-white rounded-full mt-0.5 ml-0.5 shadow-lg"
                      />
                    </div>
                  </button>

                  <button
                    onClick={() => setPovModeEnabled(!povModeEnabled)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all border ${
                      povModeEnabled
                        ? 'bg-emerald-600/20 border-emerald-500/40'
                        : 'bg-slate-900/40 border-slate-700/40 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <EyeIcon className={`w-3 h-3 ${povModeEnabled ? 'text-emerald-300' : 'text-slate-400'}`} />
                      <span className="text-cyan-300 text-xs font-medium">POV Mode</span>
                    </div>
                    <div className={`w-10 h-5 rounded-full transition-all ${povModeEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                      <motion.div
                        animate={{ x: povModeEnabled ? 20 : 0 }}
                        className="w-4 h-4 bg-white rounded-full mt-0.5 ml-0.5 shadow-lg"
                      />
                    </div>
                  </button>
                </div>
              </div>

              {/* Achievements Section */}
              <div>
                <div className="text-cyan-400/80 text-xs font-medium tracking-wider mb-2 flex items-center space-x-2">
                  <AwardIcon className="h-3 w-3" />
                  <span>ACHIEVEMENTS</span>
                  <div className="flex-1"></div>
                  <span className="text-cyan-100 font-bold">{achievements.length}/{ACHIEVEMENTS.length}</span>
                </div>
                <button
                  onClick={() => setShowAchievements(true)}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-600/30 hover:to-orange-600/30 border border-amber-500/40 rounded-lg transition-all"
                >
                  <TrophyIcon className="h-4 w-4 text-amber-400" />
                  <span className="text-amber-300 text-xs font-medium">View Achievements</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Panel Toggle Button */}
      {!controlPanelOpen && (
        <motion.button
          initial={{ x: 400 }}
          animate={{ x: 0 }}
          onClick={() => setControlPanelOpen(true)}
          className="absolute top-16 right-4 z-10 p-3 bg-slate-950/60 backdrop-blur-2xl rounded-l-2xl border border-r-0 border-cyan-500/20 shadow-2xl hover:bg-slate-900/60 transition-all"
          title="Open Controls (C)"
        >
          <motion.div
            animate={{ x: [0, -5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ZapIcon className="h-5 w-5 text-cyan-400" />
          </motion.div>
        </motion.button>
      )}

      {/* 3D Camera Controls Panel */}
      <AnimatePresence>
        {is3DMode && showCameraControls && (
          <motion.div
            initial={{ opacity: 0, x: -100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -100, scale: 0.9 }}
            transition={{ type: "spring", damping: 20 }}
            className="absolute top-20 left-4 z-20 w-72"
          >
            <div className="bg-gradient-to-br from-slate-950/95 via-purple-950/90 to-slate-950/95 backdrop-blur-2xl rounded-2xl border-2 border-purple-500/40 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600/30 via-pink-600/30 to-orange-600/30 px-4 py-3 border-b border-purple-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <motion.div
                      animate={{ rotateY: [0, 360] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    >
                      <CameraIcon className="h-5 w-5 text-purple-300" />
                    </motion.div>
                    <span className="text-purple-200 font-bold text-sm tracking-wider">3D CAMERA</span>
                  </div>
                  <button
                    onClick={() => setShowCameraControls(false)}
                    className="p-1 hover:bg-slate-800/50 rounded-lg transition-all text-purple-400 hover:text-purple-300"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Camera Presets */}
                <div>
                  <div className="text-purple-400/80 text-xs font-medium tracking-wider mb-2 flex items-center space-x-2">
                    <SwitchCameraIcon className="h-3 w-3" />
                    <span>CAMERA PRESETS</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(cameraPresets).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => applyCameraPreset(preset)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                          cameraPreset === preset
                            ? 'bg-purple-600/40 border-purple-400/60 text-purple-200'
                            : 'bg-slate-800/40 border-slate-700/40 text-purple-300/70 hover:bg-slate-700/40 hover:border-purple-500/40'
                        }`}
                      >
                        {preset.charAt(0).toUpperCase() + preset.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rotation Controls */}
                <div>
                  <div className="text-purple-400/80 text-xs font-medium tracking-wider mb-2 flex items-center space-x-2">
                    <Rotate3dIcon className="h-3 w-3" />
                    <span>ROTATION</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-purple-300/70 text-xs">Tilt (X)</span>
                        <span className="text-purple-200 text-xs font-mono font-bold">{Math.abs(cameraAngle.x)}°</span>
                      </div>
                      <input
                        type="range"
                        min="-85"
                        max="-5"
                        value={cameraAngle.x}
                        onChange={(e) => {
                          setCameraAngle(prev => ({ ...prev, x: parseInt(e.target.value) }));
                          setCameraPreset('custom');
                        }}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-purple-300/70 text-xs">Rotate (Y)</span>
                        <span className="text-purple-200 text-xs font-mono font-bold">{cameraAngle.y}°</span>
                      </div>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={cameraAngle.y}
                        onChange={(e) => {
                          setCameraAngle(prev => ({ ...prev, y: parseInt(e.target.value) }));
                          setCameraPreset('custom');
                        }}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Zoom Control */}
                <div>
                  <div className="text-purple-400/80 text-xs font-medium tracking-wider mb-2 flex items-center space-x-2">
                    <MaximizeIcon className="h-3 w-3" />
                    <span>ZOOM</span>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-purple-300/70 text-xs">Scale</span>
                    <span className="text-purple-200 text-xs font-mono font-bold">{cameraZoom.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="1.5"
                    step="0.05"
                    value={cameraZoom}
                    onChange={(e) => {
                      setCameraZoom(parseFloat(e.target.value));
                      setCameraPreset('custom');
                    }}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                </div>

                {/* Auto Rotate Toggle */}
                <div className="pt-2 border-t border-purple-500/20">
                  <button
                    onClick={() => setAutoRotate(!autoRotate)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all border ${
                      autoRotate
                        ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 border-pink-400/50'
                        : 'bg-slate-800/40 border-slate-700/40 hover:bg-slate-700/40'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <motion.div
                        animate={autoRotate ? { rotate: 360 } : {}}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      >
                        <Rotate3dIcon className="h-4 w-4 text-purple-300" />
                      </motion.div>
                      <span className="text-purple-200 text-xs font-medium">Auto Rotate</span>
                    </div>
                    <div className={`w-10 h-5 rounded-full transition-all ${autoRotate ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-slate-700'}`}>
                      <motion.div
                        animate={{ x: autoRotate ? 20 : 0 }}
                        className="w-4 h-4 bg-white rounded-full mt-0.5 ml-0.5 shadow-lg"
                      />
                    </div>
                  </button>
                </div>

                {/* Reset Camera Button */}
                <button
                  onClick={() => applyCameraPreset('default')}
                  className="w-full px-4 py-2 bg-slate-800/60 hover:bg-slate-700/60 border border-purple-500/30 hover:border-purple-400/50 rounded-lg text-purple-200 text-xs font-medium transition-all"
                >
                  Reset Camera
                </button>
                
                {/* ENHANCED: Quick preset buttons */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-purple-500/20">
                  <button
                    onClick={() => applyCameraPreset('overhead')}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      cameraPreset === 'overhead'
                        ? 'bg-purple-600/40 border-purple-400/60 text-purple-200'
                        : 'bg-slate-800/40 border-slate-700/40 text-purple-300/70 hover:bg-slate-700/40'
                    }`}
                  >
                    Overhead
                  </button>
                  <button
                    onClick={() => applyCameraPreset('immersive')}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      cameraPreset === 'immersive'
                        ? 'bg-pink-600/40 border-pink-400/60 text-pink-200'
                        : 'bg-slate-800/40 border-slate-700/40 text-purple-300/70 hover:bg-slate-700/40'
                    }`}
                  >
                    Immersive
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Camera Controls Toggle (when controls hidden) */}
      <AnimatePresence>
        {is3DMode && !showCameraControls && (
          <motion.button
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            onClick={() => setShowCameraControls(true)}
            className="absolute top-20 left-4 z-10 p-3 bg-gradient-to-r from-purple-600/40 to-pink-600/40 backdrop-blur-2xl rounded-r-2xl border border-l-0 border-purple-500/40 shadow-2xl hover:from-purple-500/50 hover:to-pink-500/50 transition-all"
            title="Camera Controls (V)"
          >
            <motion.div
              animate={{ rotateY: [0, 360] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <CameraIcon className="h-5 w-5 text-purple-200" />
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Enhanced Spin Control - Bottom Right */}
      <AnimatePresence>
        {aimingData.isAiming && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            className="absolute bottom-4 right-4 z-10 bg-slate-950/70 backdrop-blur-2xl rounded-2xl p-4 border-2 border-purple-500/30 shadow-2xl w-64"
          >
            <div className="text-purple-400 text-xs font-bold tracking-wider mb-3 flex items-center space-x-2">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <CircleIcon className="h-4 w-4" />
              </motion.div>
              <span>BALL SPIN</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-purple-300/70 text-xs">SIDE:</span>
                  <span className="text-purple-300 text-xs font-mono font-bold">{spinControl.x.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={spinControl.x}
                  onChange={(e) => setSpinControl(prev => ({ ...prev, x: parseFloat(e.target.value) }))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-purple-300/70 text-xs">TOP/BACK:</span>
                  <span className="text-purple-300 text-xs font-mono font-bold">{spinControl.y.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={spinControl.y}
                  onChange={(e) => setSpinControl(prev => ({ ...prev, y: parseFloat(e.target.value) }))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
              <div className="mt-3 pt-3 border-t border-purple-500/20">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-slate-950 to-slate-900 rounded-full border-2 border-purple-500/40 relative shadow-inner">
                  {/* Crosshair */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-px bg-purple-500/20"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-full w-px bg-purple-500/20"></div>
                  </div>
                  
                  {/* Spin Indicator */}
                  <motion.div
                    className="absolute w-4 h-4 bg-purple-400 rounded-full shadow-lg"
                    animate={{
                      boxShadow: ['0 0 10px rgba(168, 85, 247, 0.8)', '0 0 20px rgba(168, 85, 247, 1)', '0 0 10px rgba(168, 85, 247, 0.8)']
                    }}
                    transition={{ duration: 1, repeat: Infinity }}
                    style={{
                      left: `calc(50% + ${spinControl.x * 28}px - 8px)`,
                      top: `calc(50% + ${spinControl.y * 28}px - 8px)`
                    }}
                  >
                    <div className="absolute inset-0 bg-purple-300 rounded-full animate-ping"></div>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Power Control Menu - Centered & Toggleable */}
      <AnimatePresence>
        {showPowerMenu && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20"
          >
            <div className="bg-slate-950/90 backdrop-blur-2xl rounded-2xl p-4 border-2 border-cyan-500/40 shadow-2xl w-72">
              <div className="flex items-center justify-between mb-4 border-b border-cyan-500/20 pb-2">
                <div className="flex items-center space-x-2">
                  <ZapIcon className="h-4 w-4 text-cyan-400" />
                  <span className="text-cyan-300 font-bold text-sm">POWER SETTINGS</span>
                </div>
                <button
                  onClick={() => setShowPowerMenu(false)}
                  className="p-1 hover:bg-slate-800/50 rounded transition-all text-cyan-400"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center space-x-2 mb-3">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <ZapIcon className="h-5 w-5 text-cyan-400" />
                </motion.div>
                <span className="text-cyan-300 font-bold text-sm tracking-wider">MULTIPLIER</span>
                <div className="flex-1"></div>
                <span className="text-cyan-300 font-mono text-lg font-bold">{powerMultiplier.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.25"
                value={powerMultiplier}
                onChange={(e) => setPowerMultiplier(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-cyan-400/60 mt-2">
                <span>1.0x</span>
                <span>2.0x</span>
                <span>3.0x</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streamlined Bottom Toolbar */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10 w-full max-w-2xl px-4">
        <div className="game-toolbar bg-slate-950/40 backdrop-blur-md rounded-full px-6 py-3 border border-white/10 shadow-2xl flex items-center justify-between">
          
          {/* Left Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAbilityMenu(!showAbilityMenu)}
              title="Special Abilities"
              className={`p-2 rounded-full transition-all border ${
                activeAbility ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BoltIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setPracticeMode(!practiceMode)}
              title="Practice Mode"
              className={`p-2 rounded-full transition-all border ${
                practiceMode ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <TargetIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowPowerMenu(!showPowerMenu)}
              title="Power Settings"
              className={`p-2 rounded-full transition-all border ${
                showPowerMenu ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ZapIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setChaosMode(!chaosMode)}
              title="Chaos Mode"
              className={`p-2 rounded-full transition-all border ${
                chaosMode ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300' : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <SparklesIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setPovModeEnabled(!povModeEnabled)}
              title="POV Mode"
              className={`p-2 rounded-full transition-all border ${
                povModeEnabled ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <EyeIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setShowCoach(true);
                if (!coachAdvice && !coachMutation.isPending) {
                  coachMutation.mutate({
                    balls: structuredClone(gameStateRef.current.balls),
                    currentPlayer: gameStateRef.current.currentPlayer,
                    tableWidth: tableDimensions.width,
                    tableHeight: tableDimensions.height
                  });
                }
              }}
              title="AI Coach"
              className={`p-2 rounded-full transition-all border ${
                showCoach ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BrainCircuitIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Center Stats */}
          <div className="flex items-center gap-6 px-4 border-x border-white/10">
            <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">SHOTS</span>
                <span className="text-sm font-mono font-bold text-slate-200">{totalShots}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">COMBO</span>
                <span className={`text-sm font-mono font-bold ${combo > 1 ? 'text-purple-400' : 'text-slate-200'}`}>{combo}x</span>
            </div>
          </div>

          {/* Right Energy */}
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-end">
                <span className="text-[10px] text-amber-500/80 font-bold tracking-wider">ENERGY</span>
                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500" 
                        animate={{ width: `${abilityEnergy}%` }} 
                    />
                </div>
             </div>
          </div>

        </div>
      </div>
      
      {/* Ability Quick Select Menu */}
      <AnimatePresence>
        {showAbilityMenu && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20"
          >
            <div className="bg-slate-950/90 backdrop-blur-2xl rounded-2xl p-4 border-2 border-purple-500/40 shadow-2xl w-80">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <BoltIcon className="h-4 w-4 text-purple-400" />
                  <span className="text-purple-300 font-bold text-sm">SPECIAL ABILITIES</span>
                </div>
                <button
                  onClick={() => setShowAbilityMenu(false)}
                  className="p-1 hover:bg-slate-800/50 rounded transition-all text-purple-400"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-2">
                {SPECIAL_ABILITIES.map((ability) => {
                  const isUnlocked = unlockedAbilities.includes(ability.id);
                  const isActive = activeAbility === ability.id;
                  const cooldownTime = abilityCooldowns[ability.id] || 0;
                  const isOnCooldown = Date.now() < cooldownTime;
                  const cooldownRemaining = Math.max(0, Math.ceil((cooldownTime - Date.now()) / 1000));
                  const canUse = isUnlocked && !isOnCooldown && abilityEnergy >= ability.energyCost;
                  
                  return (
                    <button
                      key={ability.id}
                      onClick={() => {
                        if (isUnlocked) {
                          setActiveAbility(isActive ? null : ability.id);
                          setShowAbilityMenu(false);
                        }
                      }}
                      disabled={!isUnlocked}
                      className={`w-full p-3 rounded-lg transition-all border relative ${
                        isActive && canUse
                          ? `bg-${ability.color}-600/30 border-${ability.color}-500/60 ring-2 ring-${ability.color}-500/40`
                          : isUnlocked
                          ? `bg-slate-900/40 border-slate-700/40 hover:bg-slate-800/50 hover:border-${ability.color}-500/30`
                          : 'bg-slate-900/20 border-slate-800/20 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${
                          isUnlocked 
                            ? `bg-gradient-to-r from-${ability.color}-500 to-${ability.color}-600`
                            : 'bg-slate-700'
                        }`}>
                          {React.createElement(ability.icon, { className: "h-5 w-5 text-white" })}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="text-cyan-300 text-sm font-bold mb-1">{ability.name}</div>
                          <div className="text-cyan-100/60 text-xs mb-2">{ability.description}</div>
                          <div className="flex items-center justify-between">
                            <span className="text-amber-300 text-xs">⚡ {ability.energyCost}</span>
                            {isUnlocked && isOnCooldown && (
                              <span className="text-red-300 text-xs font-bold">CD: {cooldownRemaining}s</span>
                            )}
                            {!isUnlocked && (
                              <span className="text-slate-500 text-xs">🔒 Locked</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isActive && canUse && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shot History Panel */}
      <AnimatePresence>
        {showShotHistory && shotHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-10 w-96"
          >
            <div className="bg-slate-950/80 backdrop-blur-2xl rounded-2xl p-4 border-2 border-blue-500/30 shadow-2xl max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <InfoIcon className="h-4 w-4 text-blue-400" />
                  <h3 className="text-blue-300 font-bold text-sm tracking-wider">SHOT HISTORY</h3>
                </div>
                <button
                  onClick={() => setShowShotHistory(false)}
                  className="p-1 hover:bg-slate-800/50 rounded transition-all text-cyan-400"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {shotHistory.slice().reverse().map((shot, index) => (
                  <motion.div
                    key={shot.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/40"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                          shot.player === 1 ? 'bg-cyan-500/20 text-cyan-300' : 'bg-pink-500/20 text-pink-300'
                        }`}>
                          {shot.player}
                        </div>
                        <div>
                          <div className="text-cyan-300/70">
                            Power: <span className="text-cyan-100 font-mono">{Math.round((shot.power / MAX_POWER) * 100)}%</span>
                          </div>
                          <div className="text-purple-300/70">
                            Spin: <span className="text-purple-100 font-mono">
                              {shot.spin.x.toFixed(1)}, {shot.spin.y.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-cyan-400/50 text-xs">
                        #{shotHistory.length - index}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Power Meter with Marks */}
      <AnimatePresence>
        {aimingData.isAiming && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="absolute top-20 left-1/2 transform -translate-x-1/2 z-20"
          >
            <div className="bg-slate-950/70 backdrop-blur-2xl rounded-2xl p-5 border-2 border-cyan-500/30 min-w-[28rem] shadow-2xl">
              <div className="flex items-center space-x-4 mb-3">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="relative"
                >
                  <div className="absolute inset-0 bg-cyan-500 blur-lg opacity-50"></div>
                  <ZapIcon className="h-6 w-6 text-cyan-400 relative" />
                </motion.div>
                <span className="text-cyan-300 font-bold tracking-wider text-sm">SHOT POWER</span>
                <div className="flex-1"></div>
                <span className="text-cyan-300 font-mono text-xl font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
                  {Math.round((aimingData.power / MAX_POWER) * 100)}%
                </span>
              </div>
              
              <div className="relative">
                {/* Power Bar Container with Marks */}
                <div className="bg-slate-950/60 rounded-full h-6 overflow-hidden border-2 border-cyan-500/30 relative">
                  {/* Strength Marks */}
                  <div className="absolute inset-0 flex items-center justify-between px-1">
                    {[25, 50, 75].map((mark) => (
                      <div
                        key={mark}
                        className="w-0.5 h-4 bg-cyan-500/40"
                        style={{ left: `${mark}%` }}
                      />
                    ))}
                  </div>
                  
                  {/* Power Bar Fill */}
                  <motion.div
                    className="h-full relative"
                    style={{
                      background: `linear-gradient(90deg, 
                        rgba(34, 211, 238, 0.9) 0%, 
                        rgba(59, 130, 246, 0.9) 25%, 
                        rgba(168, 85, 247, 0.9) 50%, 
                        rgba(236, 72, 153, 0.9) 75%,
                        rgba(239, 68, 68, 0.9) 100%)`
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(aimingData.power / MAX_POWER) * 100}%` }}
                    transition={{ duration: 0.1 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-white/40 animate-pulse"></div>
                    <motion.div
                      className="absolute right-0 top-0 h-full w-1 bg-white shadow-lg"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  </motion.div>
                </div>
                
                {/* Strength Labels */}
                <div className="flex justify-between text-xs text-cyan-400/50 mt-1.5 px-1">
                  <span>SOFT</span>
                  <span>MED</span>
                  <span>HARD</span>
                  <span>MAX</span>
                </div>
              </div>
              
              <div className="mt-3 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-cyan-400/70">Multiplier:</span>
                  <span className="text-amber-300 font-bold">{powerMultiplier.toFixed(2)}x</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-cyan-400/70">Final Power:</span>
                  <span className="text-pink-300 font-bold">
                    {Math.round((aimingData.power / MAX_POWER) * 100 * powerMultiplier)}%
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FPS Mode Steering Overlay - REFINED CINEMATIC HUD */}
      <AnimatePresence>
        {fpsMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 pointer-events-none"
          >
            {/* === CINEMATIC LETTERBOX BARS - Thinner for better view === */}
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 36 }}
              exit={{ height: 0 }}
              className="absolute top-0 left-0 right-0 bg-black/90"
            />
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 36 }}
              exit={{ height: 0 }}
              className="absolute bottom-0 left-0 right-0 bg-black/90"
            />
            
            {/* === TOP HUD - Ultra Minimal === */}
            <div className="absolute top-12 left-0 right-0 flex justify-between items-start px-6">
              {/* Left: Subtle Mode Indicator */}
              <motion.div 
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5"
              >
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-cyan-400"
                  style={{ boxShadow: '0 0 8px rgba(34, 211, 238, 0.8)' }}
                />
                <span className="text-cyan-300/80 text-xs font-medium tracking-widest">FIRST PERSON</span>
              </motion.div>
              
              {/* Right: Compact Speed Display */}
              <motion.div 
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex items-center gap-3 bg-black/40 backdrop-blur-sm rounded-full px-4 py-1.5"
              >
                <div className="flex items-baseline gap-1">
                  <motion.span 
                    className="text-2xl font-black tabular-nums text-cyan-300"
                  >
                    {Math.round(Math.sqrt(
                      (gameStateRef.current?.balls.find(b => b.type === 'cue')?.vx || 0) ** 2 +
                      (gameStateRef.current?.balls.find(b => b.type === 'cue')?.vy || 0) ** 2
                    ) * 10)}
                  </motion.span>
                  <span className="text-cyan-500/60 text-xs font-medium">km/h</span>
                </div>
                
                {/* Minimal Speed Bar */}
                <div className="w-1.5 h-10 bg-slate-800/60 rounded-full overflow-hidden">
                  <motion.div 
                    className="w-full rounded-full"
                    style={{
                      height: `${Math.min(Math.sqrt((gameStateRef.current?.balls.find(b => b.type === 'cue')?.vx || 0) ** 2 + (gameStateRef.current?.balls.find(b => b.type === 'cue')?.vy || 0) ** 2) / 25 * 100, 100)}%`,
                      background: 'linear-gradient(to top, #22d3ee, #8b5cf6)',
                      marginTop: 'auto'
                    }}
                  />
                </div>
              </motion.div>
            </div>
            
            {/* === CENTER RETICLE - Minimalist === */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 pointer-events-none">
              <motion.div
                animate={{ rotate: -bankingRef.current * 0.5 }}
                className="w-full h-full relative opacity-30"
              >
                {/* Simple crosshair */}
                <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-6 h-px bg-cyan-400/60" />
                </div>
                <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-px h-6 bg-cyan-400/60" />
                </div>
                {/* Outer ring */}
                <div className="absolute inset-4 border border-cyan-400/20 rounded-full" />
              </motion.div>
            </div>
            
            {/* === STEERING INDICATOR - Compact Bottom === */}
            <motion.div 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="absolute bottom-14 left-1/2 transform -translate-x-1/2"
            >
              <div className="flex items-center gap-4 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2">
                {/* Left Key */}
                <motion.div 
                  animate={{ 
                    scale: steeringRef.current?.left ? 1.15 : 1,
                    backgroundColor: steeringRef.current?.left ? 'rgba(34, 211, 238, 0.3)' : 'rgba(0, 0, 0, 0.3)'
                  }}
                  className="w-10 h-10 rounded-lg border border-cyan-500/40 flex items-center justify-center"
                  style={{ boxShadow: steeringRef.current?.left ? '0 0 15px rgba(34, 211, 238, 0.5)' : 'none' }}
                >
                  <span className="text-sm font-bold text-cyan-400">A</span>
                </motion.div>
                
                {/* Steering Visual */}
                <div className="relative w-20 h-3 bg-slate-800/50 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute top-0 h-full w-3 bg-cyan-400 rounded-full"
                    style={{
                      left: `calc(50% - 6px + ${(povCameraRef.current?.currentBank || 0) * 0.8}px)`,
                      boxShadow: '0 0 10px rgba(34, 211, 238, 0.8)'
                    }}
                  />
                  <div className="absolute left-1/2 top-0 w-px h-full bg-cyan-500/30 transform -translate-x-1/2" />
                </div>
                
                {/* Right Key */}
                <motion.div 
                  animate={{ 
                    scale: steeringRef.current?.right ? 1.15 : 1,
                    backgroundColor: steeringRef.current?.right ? 'rgba(34, 211, 238, 0.3)' : 'rgba(0, 0, 0, 0.3)'
                  }}
                  className="w-10 h-10 rounded-lg border border-cyan-500/40 flex items-center justify-center"
                  style={{ boxShadow: steeringRef.current?.right ? '0 0 15px rgba(34, 211, 238, 0.5)' : 'none' }}
                >
                  <span className="text-sm font-bold text-cyan-400">D</span>
                </motion.div>
              </div>
            </motion.div>
            
            {/* === SPEED LINES - Reduced & Refined === */}
            <div className="absolute inset-0 overflow-hidden">
              {/* Subtle radial lines */}
              {[...Array(16)].map((_, i) => (
                <motion.div
                  key={`line-${i}`}
                  className="absolute"
                  style={{
                    left: `${25 + Math.random() * 50}%`,
                    top: `${Math.random() * 100}%`,
                    width: '180px',
                    height: '1.5px',
                    background: 'linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.25), transparent)',
                    transformOrigin: 'center center',
                    transform: `rotate(${88 + (Math.random() - 0.5) * 8}deg)`
                  }}
                  animate={{
                    y: [0, 250],
                    opacity: [0, 0.5, 0],
                    scaleX: [0.5, 1.5, 0.5]
                  }}
                  transition={{
                    duration: 0.3 + Math.random() * 0.2,
                    repeat: Infinity,
                    delay: Math.random() * 0.4,
                    ease: "linear"
                  }}
                />
              ))}
            </div>
            
            {/* === SOFT VIGNETTE === */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 80%, rgba(0,0,0,0.6) 100%)'
              }}
            />
            
            {/* === SUBTLE CORNER BRACKETS === */}
            <svg className="absolute top-10 left-4 w-12 h-12 text-cyan-500/30">
              <path d="M0 12 L0 0 L12 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <svg className="absolute top-10 right-4 w-12 h-12 text-cyan-500/30">
              <path d="M0 0 L12 0 L12 12" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <svg className="absolute bottom-10 left-4 w-12 h-12 text-cyan-500/30">
              <path d="M0 0 L0 12 L12 12" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <svg className="absolute bottom-10 right-4 w-12 h-12 text-cyan-500/30">
              <path d="M0 12 L12 12 L12 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bullet Time Visual Overlay */}
      <AnimatePresence>
        {bulletTimeActive && !fpsMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 pointer-events-none"
          >
            {/* Chromatic aberration effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-purple-500/10 animate-pulse"></div>
            
            {/* Time distortion waves */}
            <motion.div
              className="absolute inset-0"
              animate={{
                background: [
                  'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)',
                  'radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
                  'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)'
                ]
              }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            
            {/* Scanlines */}
            <div className="absolute inset-0" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
            }}></div>
            
            {/* Center text */}
            <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="bg-slate-950/80 backdrop-blur-xl rounded-2xl px-8 py-4 border-2 border-cyan-500/50 shadow-2xl"
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400"
                  style={{ textShadow: '0 0 20px rgba(59, 130, 246, 0.8)' }}
                >
                  BULLET TIME
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Game Canvas with Frame - Now with 3D Transform Support */}
      <div 
        className="absolute inset-0 pt-20 pb-24 px-4 flex items-center justify-center"
      >
        <motion.div 
          className="relative max-w-full"
          style={{ width: "min(100%, calc((100dvh - 200px) * 2))", aspectRatio: "2 / 1" }}
          animate={{
            scale: is3DMode ? cameraZoom : 1,
          }}
          transition={{ 
            type: "spring", 
            damping: 25, 
            stiffness: 120,
            mass: 1
          }}
        >
          {/* 3D Shadow Layer (rendered below the table) */}
          {is3DMode && (
            <motion.div
              className="absolute inset-0 rounded-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.8) 0%, transparent 70%)',
                filter: 'blur(30px)'
              }}
            />
          )}
          
          {/* Outer Glow Effect - Enhanced for 3D */}
          <motion.div 
            className="absolute inset-0 rounded-3xl blur-2xl"
            animate={{
              background: is3DMode 
                ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(236, 72, 153, 0.2) 50%, rgba(251, 146, 60, 0.3) 100%)'
                : 'linear-gradient(135deg, rgba(34, 211, 238, 0.1) 0%, rgba(59, 130, 246, 0.1) 50%, rgba(168, 85, 247, 0.1) 100%)'
            }}
          />
          
          {/* Canvas Container with 3D Enhancement */}
          <motion.div 
            className="relative w-full h-full rounded-3xl shadow-2xl overflow-hidden"
            animate={{
              borderColor: is3DMode ? 'rgba(168, 85, 247, 0.5)' : 'rgba(34, 211, 238, 0.3)',
              boxShadow: is3DMode 
                ? '0 50px 100px -20px rgba(168, 85, 247, 0.5), 0 30px 60px -10px rgba(236, 72, 153, 0.4), inset 0 0 60px rgba(0, 0, 0, 0.8), 0 0 120px rgba(168, 85, 247, 0.3)'
                : '0 0 80px rgba(34, 211, 238, 0.4), inset 0 0 40px rgba(0, 0, 0, 0.6)'
            }}
            style={{
              borderWidth: '4px',
              borderStyle: 'solid'
            }}
          >
            {/* Ambient Light Effect Overlay for 3D mode */}
            {is3DMode && (
              <motion.div
                className="absolute inset-0 pointer-events-none z-10"
                animate={{
                  background: [
                    'radial-gradient(ellipse at 30% 20%, rgba(168, 85, 247, 0.08) 0%, transparent 50%)',
                    'radial-gradient(ellipse at 70% 30%, rgba(236, 72, 153, 0.08) 0%, transparent 50%)',
                    'radial-gradient(ellipse at 30% 20%, rgba(168, 85, 247, 0.08) 0%, transparent 50%)'
                  ]
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            
            <canvas
              ref={canvasRef}
              width={tableDimensions.width}
              height={tableDimensions.height}
              aria-label="Pool table. Drag back from the white cue ball and release to shoot."
              onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); handleMouseDown(event); }}
              onPointerMove={handleMouseMove}
              onPointerUp={event => { handleMouseUp(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
              onPointerCancel={() => { mouseRef.current.down = false; dragRef.current.active = false; setAimingData({ isAiming: false, power: 0, angle: 0, cueBall: null }); }}
              className="w-full h-full cursor-crosshair"
              style={{ 
                aspectRatio: `${tableDimensions.width}/${tableDimensions.height}`,
                touchAction: 'none',
                objectFit: 'contain',
                transform: 'translateZ(0)'
              }}
            />
            
            {/* Corner Accents - Enhanced for 3D */}
            <motion.div 
              className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-2xl"
              animate={{ borderColor: is3DMode ? 'rgba(168, 85, 247, 0.8)' : 'rgba(34, 211, 238, 1)' }}
              style={{ transform: is3DMode ? 'translateZ(5px)' : 'none' }}
            />
            <motion.div 
              className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-2xl"
              animate={{ borderColor: is3DMode ? 'rgba(236, 72, 153, 0.8)' : 'rgba(34, 211, 238, 1)' }}
              style={{ transform: is3DMode ? 'translateZ(5px)' : 'none' }}
            />
            <motion.div 
              className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-2xl"
              animate={{ borderColor: is3DMode ? 'rgba(251, 146, 60, 0.8)' : 'rgba(34, 211, 238, 1)' }}
              style={{ transform: is3DMode ? 'translateZ(5px)' : 'none' }}
            />
            <motion.div 
              className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-2xl"
              animate={{ borderColor: is3DMode ? 'rgba(168, 85, 247, 0.8)' : 'rgba(34, 211, 238, 1)' }}
              style={{ transform: is3DMode ? 'translateZ(5px)' : 'none' }}
            />
            
            {/* Practice Mode Overlay */}
            {practiceMode && (
              <div 
                className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-amber-500/20 backdrop-blur-sm px-4 py-2 rounded-full border border-amber-400/40"
                style={{ transform: is3DMode ? 'translateX(-50%) translateZ(10px)' : 'translateX(-50%)' }}
              >
                <span className="text-amber-200 text-xs font-bold tracking-wider">⚡ PRACTICE MODE ACTIVE ⚡</span>
              </div>
            )}
            
            </motion.div>
        </motion.div>
      </div>

      {/* Enhanced 3D Mode Transition Overlay */}
      <AnimatePresence>
        {transitioning3D && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center overflow-hidden"
          >
            {/* Expanding ripple rings */}
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: 3 + i * 0.5, opacity: 0 }}
                transition={{ 
                  duration: 1.2, 
                  delay: i * 0.15,
                  ease: "easeOut"
                }}
                className="absolute rounded-full border-2"
                style={{ 
                  width: '200px', 
                  height: '200px',
                  borderColor: `rgba(168, 85, 247, ${0.6 - i * 0.1})`,
                  boxShadow: `0 0 ${20 + i * 10}px rgba(168, 85, 247, ${0.4 - i * 0.08})`
                }}
              />
            ))}
            
            {/* Central morphing shape */}
            <motion.div
              initial={{ scale: 0, rotate: 0, borderRadius: '50%' }}
              animate={{ 
                scale: [0, 1.5, 0.8, 1.2, 0],
                rotate: [0, 90, 180, 270, 360],
                borderRadius: ['50%', '30%', '50%', '20%', '50%']
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="absolute w-32 h-32"
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.7) 0%, rgba(236, 72, 153, 0.7) 50%, rgba(251, 146, 60, 0.7) 100%)',
                boxShadow: '0 0 60px rgba(168, 85, 247, 0.8), inset 0 0 30px rgba(255, 255, 255, 0.3)'
              }}
            />
            
            {/* Particle burst */}
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={`particle-${i}`}
                initial={{ 
                  x: 0, y: 0, 
                  scale: 0, 
                  opacity: 1 
                }}
                animate={{ 
                  x: Math.cos(i * Math.PI * 2 / 20) * 300,
                  y: Math.sin(i * Math.PI * 2 / 20) * 300,
                  scale: [0, 1, 0],
                  opacity: [1, 0.8, 0]
                }}
                transition={{ 
                  duration: 0.8, 
                  delay: 0.2,
                  ease: "easeOut" 
                }}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  background: `hsl(${270 + i * 5}, 70%, 60%)`,
                  boxShadow: `0 0 10px hsl(${270 + i * 5}, 70%, 60%)`
                }}
              />
            ))}
            
            {/* Flash overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.4, 0] }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 60%)'
              }}
            />
            
            {/* Text indicator */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -20], scale: [0.8, 1, 1, 0.8] }}
              transition={{ duration: 0.8, times: [0, 0.2, 0.8, 1] }}
              className="absolute bg-slate-950/80 backdrop-blur-xl px-6 py-3 rounded-xl border border-purple-500/50"
              style={{ boxShadow: '0 0 30px rgba(168, 85, 247, 0.5)' }}
            >
              <span className="text-lg font-black bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
                {is3DMode ? 'ENTERING 3D MODE' : 'EXITING 3D MODE'}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 3D Mode Info Toast - ENHANCED with cinematic feel */}
      <AnimatePresence>
        {is3DMode && !transitioning3D && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ delay: 0.5, duration: 0.5, type: "spring", damping: 20 }}
            className="absolute top-24 left-1/2 transform -translate-x-1/2 z-20"
          >
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ delay: 6, duration: 1.5 }}
              className="bg-gradient-to-r from-slate-950/98 via-purple-950/95 to-slate-950/98 backdrop-blur-2xl px-10 py-5 rounded-3xl border-2 border-purple-400/60 shadow-2xl"
              style={{ boxShadow: '0 0 60px rgba(168, 85, 247, 0.5), 0 0 120px rgba(236, 72, 153, 0.2), inset 0 0 30px rgba(255, 255, 255, 0.03)' }}
            >
              <div className="flex items-center space-x-5">
                <motion.div
                  animate={{ 
                    rotateY: [0, 360],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    rotateY: { duration: 3, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity }
                  }}
                  className="p-3 bg-gradient-to-br from-purple-500/40 to-pink-500/40 rounded-xl border border-purple-400/50 shadow-lg"
                  style={{ boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)' }}
                >
                  <CameraIcon className="h-7 w-7 text-purple-200" />
                </motion.div>
                <div>
                  <p className="text-purple-100 text-lg font-black tracking-wide mb-1">🎬 CINEMA MODE ACTIVE</p>
                  <p className="text-purple-300/80 text-sm">Use camera controls to adjust view • Press <kbd className="px-1.5 py-0.5 bg-slate-800/60 border border-purple-500/40 rounded text-purple-200 text-xs font-mono">V</kbd> to toggle panel</p>
                </div>
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 ml-3"
                  style={{ boxShadow: '0 0 12px rgba(74, 222, 128, 0.8)' }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Combo Display */}
      <AnimatePresence>
        {showCombo && combo > 1 && (
          <motion.div
            initial={{ scale: 0, opacity: 0, rotate: -180 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0, rotate: 180 }}
            transition={{ type: "spring", damping: 15 }}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
          >
            <div className="relative">
              {/* Animated Glow Rings */}
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 0, 0.5]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  background: 'radial-gradient(circle, rgba(168,85,247,0.6) 0%, transparent 70%)',
                  filter: 'blur(20px)'
                }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.7, 0, 0.7]
                }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                style={{
                  background: 'radial-gradient(circle, rgba(236,72,153,0.6) 0%, transparent 70%)',
                  filter: 'blur(20px)'
                }}
              />
              
              <div className="relative bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 rounded-3xl p-8 border-4 border-white/50 shadow-2xl">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="text-7xl font-black text-white text-center drop-shadow-2xl"
                  style={{ textShadow: '0 0 20px rgba(255,255,255,0.8)' }}
                >
                  {combo}x
                </motion.div>
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-2xl font-bold text-white text-center tracking-wider mt-2 drop-shadow-lg"
                >
                  🔥 COMBO! 🔥
                </motion.div>
                {combo >= 3 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-yellow-200 text-center mt-2 tracking-wide"
                  >
                    {combo >= 5 ? '⚡ UNSTOPPABLE! ⚡' : '✨ ON FIRE! ✨'}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      

      {/* Enhanced Victory Modal */}
      <AnimatePresence>
        {gameState.gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/85 backdrop-blur-2xl z-50 flex items-center justify-center p-4"
            onClick={resetGame}
          >
            {/* Enhanced Confetti particles */}
            {[...Array(80)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: `${Math.random() * 8 + 4}px`,
                  height: `${Math.random() * 8 + 4}px`,
                  background: `hsl(${Math.random() * 360}, 100%, 60%)`,
                  left: `${Math.random() * 100}%`,
                  top: '-5%',
                  boxShadow: `0 0 ${Math.random() * 10 + 5}px currentColor`
                }}
                animate={{
                  y: window.innerHeight + 100,
                  x: [(Math.random() - 0.5) * 300],
                  rotate: [0, Math.random() * 720 - 360],
                  opacity: [1, 0.8, 0]
                }}
                transition={{
                  duration: 4 + Math.random() * 3,
                  repeat: Infinity,
                  delay: Math.random() * 3,
                  ease: "easeIn"
                }}
              />
            ))}
            
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 100, rotateX: 45 }}
              animate={{ scale: 1, opacity: 1, y: 0, rotateX: 0 }}
              exit={{ scale: 0.5, opacity: 0, y: -100 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-gradient-to-br from-slate-950/95 via-purple-950/95 to-blue-950/95 backdrop-blur-2xl rounded-3xl p-10 max-w-xl w-full border-4 border-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 shadow-2xl relative overflow-hidden"
              style={{ boxShadow: '0 0 100px rgba(251, 191, 36, 0.6), inset 0 0 50px rgba(0, 0, 0, 0.5)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Animated light rays */}
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute top-1/2 left-1/2 w-1 h-full origin-top"
                  style={{
                    background: 'linear-gradient(to bottom, rgba(251, 191, 36, 0.3), transparent)',
                    transform: `rotate(${i * 30}deg)`,
                  }}
                  animate={{
                    opacity: [0.2, 0.5, 0.2],
                    scaleY: [0.8, 1.2, 0.8]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.1
                  }}
                />
              ))}
              
              <div className="relative z-10">
                <div className="flex flex-col items-center mb-8">
                  <motion.div
                    animate={{
                      scale: [1, 1.15, 1],
                      rotate: [0, 10, -10, 0]
                    }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    className="relative mb-6"
                  >
                    <motion.div
                      className="absolute inset-0 blur-3xl opacity-60"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.4, 0.7, 0.4]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      style={{ background: 'radial-gradient(circle, rgba(251, 191, 36, 0.8) 0%, transparent 70%)' }}
                    />
                    <TrophyIcon className="h-24 w-24 text-amber-400 relative drop-shadow-2xl" 
                      style={{ filter: 'drop-shadow(0 0 20px rgba(251, 191, 36, 0.8))' }}
                    />
                  </motion.div>
                  
                  <motion.h2
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-6xl font-black bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 bg-clip-text text-transparent tracking-wider mb-3"
                    style={{ textShadow: '0 0 30px rgba(251, 191, 36, 0.5)' }}
                  >
                    VICTORY!
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-3xl text-cyan-300 font-bold tracking-wider"
                  >
                    🏆 PLAYER {gameState.winner} WINS! 🏆
                  </motion.p>
                </div>
                
                <div className="space-y-4 mb-8">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-gradient-to-r from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border-2 border-amber-400/40"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-cyan-300 font-bold text-lg">Final Score:</span>
                      <div className="flex items-center space-x-6">
                        <span className={`text-2xl font-black ${gameState.winner === 1 ? 'text-cyan-400' : 'text-cyan-600/60'}`}>
                          P1: {gameState.score.player1}
                        </span>
                        <span className={`text-2xl font-black ${gameState.winner === 2 ? 'text-pink-400' : 'text-pink-600/60'}`}>
                          P2: {gameState.score.player2}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-gradient-to-r from-slate-900/60 to-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border-2 border-purple-400/40"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col items-center p-3 bg-slate-800/40 rounded-lg">
                        <span className="text-cyan-300/80 text-sm mb-1">Total Shots</span>
                        <span className="text-cyan-100 font-black text-2xl">{totalShots}</span>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-slate-800/40 rounded-lg">
                        <span className="text-purple-300/80 text-sm mb-1">Best Combo</span>
                        <span className="text-purple-100 font-black text-2xl">{combo}x</span>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-slate-800/40 rounded-lg">
                        <span className="text-red-300/80 text-sm mb-1">Fouls</span>
                        <span className="text-red-100 font-black text-2xl">{fouls}</span>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-slate-800/40 rounded-lg">
                        <span className="text-amber-300/80 text-sm mb-1">Accuracy</span>
                        <span className="text-amber-100 font-black text-2xl">
                          {totalShots > 0 ? Math.round(((gameState.score.player1 + gameState.score.player2) / totalShots) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  </motion.div>
                  
                  {content?.statistics?.highScore && gameState.score[`player${gameState.winner}`] >= content.statistics.highScore && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", delay: 0.6 }}
                      className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl p-4 border-3 border-amber-300 shadow-lg"
                      style={{ boxShadow: '0 0 30px rgba(251, 191, 36, 0.6)' }}
                    >
                      <div className="flex items-center justify-center space-x-3">
                        <motion.div
                          animate={{ rotate: [0, 360] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                          <SparklesIcon className="h-6 w-6 text-white" />
                        </motion.div>
                        <span className="text-white font-black text-lg tracking-wider">✨ NEW HIGH SCORE! ✨</span>
                        <motion.div
                          animate={{ rotate: [360, 0] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                          <SparklesIcon className="h-6 w-6 text-white" />
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </div>
                
                <motion.button
                  onClick={resetGame}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full px-8 py-5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl transition-all font-black text-xl tracking-wider shadow-2xl border-2 border-cyan-400/50"
                  style={{ boxShadow: '0 0 40px rgba(34, 211, 238, 0.6)' }}
                >
                  🎮 PLAY AGAIN 🎮
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-2xl z-50 flex items-center justify-center p-4"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-gradient-to-br from-slate-950/95 via-blue-950/95 to-slate-950/95 backdrop-blur-2xl rounded-3xl p-8 max-w-2xl w-full border-3 border-cyan-500/40 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{ boxShadow: '0 0 60px rgba(34, 211, 238, 0.4), inset 0 0 30px rgba(0, 0, 0, 0.5)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="relative"
                  >
                    <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-50"></div>
                    <InfoIcon className="h-7 w-7 text-cyan-400 relative" />
                  </motion.div>
                  <div>
                    <h2 className="text-3xl font-black text-cyan-300 tracking-wider">GAME GUIDE</h2>
                    <p className="text-cyan-400/60 text-sm tracking-wide">Master the quantum table</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="p-2 hover:bg-slate-800/60 rounded-lg transition-all text-cyan-400 hover:text-cyan-300 border border-transparent hover:border-cyan-500/30"
                >
                  <XIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {[
                  {
                    icon: TargetIcon,
                    color: 'cyan',
                    title: 'AIMING',
                    desc: 'Click and drag near the cue ball to aim. Drag further for more power. Holographic projection shows shot direction.'
                  },
                  {
                    icon: ZapIcon,
                    color: 'purple',
                    title: 'POWER & SPIN',
                    desc: 'Adjust power multiplier (1-3x) in controls. Use spin controls for side spin, topspin, or backspin effects on your shots.'
                  },
                  {
                    icon: SparklesIcon,
                    color: 'pink',
                    title: 'COMBOS',
                    desc: 'Pocket consecutive balls to build combos! Each successful pocket increases your combo multiplier. Fouls reset your combo.'
                  },
                  {
                    icon: WavesIcon,
                    color: 'green',
                    title: 'VISUALIZERS',
                    desc: '5 stunning visual modes: Plasma Waves, Quantum Grid, Energy Particles, Ripple Fields, and Nebula Swirl. Change anytime!'
                  },
                  {
                    icon: TargetIcon,
                    color: 'amber',
                    title: 'PRACTICE MODE',
                    desc: 'Toggle practice mode (P key) to play without turn restrictions. Perfect for learning shots and experimenting.'
                  },
                  {
                    icon: TrophyIcon,
                    color: 'orange',
                    title: 'VICTORY & STATS',
                    desc: 'First to pocket the 8-ball wins! Track high scores, combos, and accuracy. All stats are saved automatically.'
                  }
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start space-x-4 bg-slate-800/40 backdrop-blur-sm p-4 rounded-xl border border-slate-700/50 hover:border-cyan-500/30 transition-all group"
                  >
                    <div className={`bg-${item.color}-600/20 rounded-xl p-3 mt-0.5 border border-${item.color}-500/30 group-hover:scale-110 transition-transform`}>
                      {React.createElement(item.icon, { className: `h-5 w-5 text-${item.color}-400` })}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-cyan-300 mb-1.5 tracking-wider text-sm">{item.title}</h3>
                      <p className="text-sm text-cyan-100/80 leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Keyboard Shortcuts */}
              <div className="mt-6 pt-5 border-t border-cyan-500/20">
                <h3 className="text-cyan-300 font-bold text-sm mb-3 tracking-wider">⌨️ KEYBOARD SHORTCUTS</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'H', action: 'Help' },
                    { key: 'R', action: 'Reset' },
                    { key: 'S', action: 'Settings' },
                    { key: 'P', action: 'Practice' },
                    { key: 'C', action: 'Controls' },
                    { key: 'ESC', action: 'Close Panels' }
                  ].map((shortcut, i) => (
                    <div key={i} className="flex items-center space-x-2 bg-slate-800/30 px-3 py-2 rounded-lg">
                      <kbd className="px-2 py-1 bg-slate-700/50 border border-cyan-500/30 rounded text-cyan-300 font-mono font-bold">
                        {shortcut.key}
                      </kbd>
                      <span className="text-cyan-100/70">{shortcut.action}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-6">
                <motion.button
                  onClick={() => setShowHelp(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl transition-all font-bold text-lg tracking-wider shadow-lg border-2 border-cyan-400/50"
                  style={{ boxShadow: '0 0 30px rgba(34, 211, 238, 0.5)' }}
                >
                  🎮 START PLAYING
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Achievement Popup */}
      <AnimatePresence>
        {showAchievementPopup && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: -100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -100 }}
            transition={{ type: "spring", damping: 15 }}
            className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className="relative">
              {/* Animated glow rings */}
              <motion.div
                className="absolute inset-0 rounded-2xl blur-2xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  background: `radial-gradient(circle, ${
                    showAchievementPopup.color === 'cyan' ? 'rgba(34, 211, 238, 0.6)' :
                    showAchievementPopup.color === 'orange' ? 'rgba(251, 146, 60, 0.6)' :
                    showAchievementPopup.color === 'yellow' ? 'rgba(250, 204, 21, 0.6)' :
                    showAchievementPopup.color === 'purple' ? 'rgba(168, 85, 247, 0.6)' :
                    showAchievementPopup.color === 'red' ? 'rgba(239, 68, 68, 0.6)' :
                    showAchievementPopup.color === 'blue' ? 'rgba(59, 130, 246, 0.6)' :
                    'rgba(251, 191, 36, 0.6)'
                  } 0%, transparent 70%)`
                }}
              />
              
              <div className={`relative bg-gradient-to-br from-slate-950/95 to-slate-900/95 backdrop-blur-2xl rounded-2xl p-6 border-2 border-${showAchievementPopup.color}-500/50 shadow-2xl min-w-[24rem]`}>
                <div className="flex items-center space-x-4">
                  <motion.div
                    animate={{ 
                      rotate: [0, 360],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ 
                      rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                      scale: { duration: 1, repeat: Infinity }
                    }}
                    className={`p-4 rounded-xl bg-gradient-to-br from-${showAchievementPopup.color}-500/30 to-${showAchievementPopup.color}-600/30 border border-${showAchievementPopup.color}-400/50`}
                  >
                    {React.createElement(showAchievementPopup.icon, { 
                      className: `h-8 w-8 text-${showAchievementPopup.color}-400` 
                    })}
                  </motion.div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <SparklesIcon className="h-4 w-4 text-amber-400" />
                      <span className="text-amber-300 text-xs font-bold tracking-wider">ACHIEVEMENT UNLOCKED!</span>
                    </div>
                    <h3 className={`text-xl font-black text-${showAchievementPopup.color}-300 tracking-wider mb-1`}>
                      {showAchievementPopup.name}
                    </h3>
                    <p className="text-cyan-100/70 text-sm">
                      {showAchievementPopup.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Achievement Gallery */}
      <AnimatePresence>
        {showAchievements && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-2xl z-50 flex items-center justify-center p-4"
            onClick={() => setShowAchievements(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-gradient-to-br from-slate-950/95 via-purple-950/95 to-slate-950/95 backdrop-blur-2xl rounded-3xl p-8 max-w-4xl w-full border-3 border-amber-500/40 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{ boxShadow: '0 0 60px rgba(251, 191, 36, 0.4)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  >
                    <TrophyIcon className="h-7 w-7 text-amber-400" />
                  </motion.div>
                  <div>
                    <h2 className="text-3xl font-black text-amber-300 tracking-wider">ACHIEVEMENTS</h2>
                    <p className="text-amber-400/60 text-sm tracking-wide">
                      {achievements.length} of {ACHIEVEMENTS.length} Unlocked
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAchievements(false)}
                  className="p-2 hover:bg-slate-800/60 rounded-lg transition-all text-amber-400 hover:text-amber-300"
                >
                  <XIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
                {ACHIEVEMENTS.map((achievement) => {
                  const isUnlocked = achievements.includes(achievement.id);
                  return (
                    <motion.div
                      key={achievement.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        isUnlocked
                          ? `bg-gradient-to-br from-${achievement.color}-600/20 to-${achievement.color}-700/20 border-${achievement.color}-500/50 shadow-lg`
                          : 'bg-slate-800/20 border-slate-700/30'
                      }`}
                    >
                      {isUnlocked && (
                        <motion.div
                          className="absolute -top-2 -right-2"
                          animate={{ rotate: [0, 360] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        >
                          <div className="bg-amber-500 rounded-full p-1 border-2 border-slate-950">
                            <StarIcon className="h-4 w-4 text-white" />
                          </div>
                        </motion.div>
                      )}
                      
                      <div className="flex items-start space-x-3">
                        <div className={`p-3 rounded-lg ${
                          isUnlocked 
                            ? `bg-gradient-to-br from-${achievement.color}-500/30 to-${achievement.color}-600/30 border border-${achievement.color}-400/50`
                            : 'bg-slate-700/30 border border-slate-600/30'
                        }`}>
                          {React.createElement(achievement.icon, { 
                            className: `h-6 w-6 ${
                              isUnlocked ? `text-${achievement.color}-400` : 'text-slate-500'
                            }` 
                          })}
                        </div>
                        
                        <div className="flex-1">
                          <h3 className={`font-bold text-sm mb-1 ${
                            isUnlocked ? `text-${achievement.color}-300` : 'text-slate-500'
                          }`}>
                            {achievement.name}
                          </h3>
                          <p className={`text-xs ${
                            isUnlocked ? 'text-cyan-100/70' : 'text-slate-600'
                          }`}>
                            {achievement.description}
                          </p>
                        </div>
                      </div>
                      
                      {!isUnlocked && (
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
                          <div className="text-slate-400 text-xs font-bold tracking-wider">
                            🔒 LOCKED
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-6">
                <motion.button
                  onClick={() => setShowAchievements(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl transition-all font-bold text-lg tracking-wider shadow-lg"
                  style={{ boxShadow: '0 0 30px rgba(251, 191, 36, 0.5)' }}
                >
                  BACK TO GAME
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Coach Panel */}
      <AnimatePresence>
        {showCoach && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-30"
          >
            <div className="bg-slate-950/90 backdrop-blur-2xl rounded-2xl p-6 border-2 border-emerald-500/40 shadow-2xl w-96">
              <div className="flex items-center justify-between mb-4 border-b border-emerald-500/20 pb-2">
                <div className="flex items-center space-x-2">
                  <BrainCircuitIcon className="h-5 w-5 text-emerald-400" />
                  <span className="text-emerald-300 font-bold text-sm tracking-wider">AI COACH ANALYSIS</span>
                </div>
                <button
                  onClick={() => setShowCoach(false)}
                  className="p-1 hover:bg-slate-800/50 rounded transition-all text-emerald-400"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-[100px] flex items-center justify-center">
                {coachMutation.isPending ? (
                  <div className="flex flex-col items-center space-y-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <BrainCircuitIcon className="h-8 w-8 text-emerald-500/50" />
                    </motion.div>
                    <span className="text-emerald-200/60 text-xs animate-pulse">Analyzing table geometry...</span>
                  </div>
                ) : coachMutation.isError ? (
                  <p role="status" className="text-emerald-100 text-sm leading-relaxed">The AI coach is not connected in this standalone version. You can keep playing with the aiming guide.</p>
                ) : coachAdvice ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-emerald-100 text-sm leading-relaxed"
                  >
                    "{coachAdvice}"
                  </motion.div>
                ) : (
                  <div className="text-center">
                     <p className="text-slate-400 text-xs mb-3">Ready to analyze the current shot.</p>
                     <button 
                        onClick={() => coachMutation.mutate({
                          balls: structuredClone(gameStateRef.current.balls),
                          currentPlayer: gameStateRef.current.currentPlayer,
                          tableWidth: tableDimensions.width,
                          tableHeight: tableDimensions.height
                        })}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-xs font-bold"
                     >
                        ANALYZE NOW
                     </button>
                  </div>
                )}
              </div>
              
              {!coachMutation.isPending && coachAdvice && (
                 <div className="mt-4 pt-3 border-t border-emerald-500/20 flex justify-end">
                    <button 
                       onClick={() => coachMutation.mutate({
                          balls: structuredClone(gameStateRef.current.balls),
                          currentPlayer: gameStateRef.current.currentPlayer,
                          tableWidth: tableDimensions.width,
                          tableHeight: tableDimensions.height
                        })}
                       className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                       <RotateCcwIcon className="w-3 h-3" /> Refresh Analysis
                    </button>
                 </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-2xl z-50 flex items-center justify-center p-4"
            onClick={() => setSettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-gradient-to-br from-slate-950/95 via-purple-950/95 to-slate-950/95 backdrop-blur-2xl rounded-3xl p-8 max-w-md w-full border-3 border-purple-500/40 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{ boxShadow: '0 0 60px rgba(168, 85, 247, 0.4)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <motion.div
                    animate={{ rotate: 90 }}
                    transition={{ duration: 0.3 }}
                  >
                    <InfoIcon className="h-6 w-6 text-purple-400" />
                  </motion.div>
                  <h2 className="text-2xl font-black text-purple-300 tracking-wider">SETTINGS</h2>
                </div>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="p-2 hover:bg-slate-800/60 rounded-lg transition-all text-purple-400 hover:text-purple-300"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-800/40 rounded-xl p-4 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-purple-300 font-medium text-sm">Show Tooltips</span>
                    <button
                      onClick={() => setShowTooltips(!showTooltips)}
                      className={`w-12 h-6 rounded-full transition-all ${showTooltips ? 'bg-purple-500' : 'bg-slate-700'}`}
                    >
                      <motion.div
                        animate={{ x: showTooltips ? 24 : 0 }}
                        className="w-5 h-5 bg-white rounded-full mt-0.5 ml-0.5 shadow-lg"
                      />
                    </button>
                  </div>
                  <p className="text-xs text-purple-300/60">Show helpful hints and keyboard shortcuts</p>
                </div>

                <div className="bg-slate-800/40 rounded-xl p-4 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-purple-300 font-medium text-sm">Aim Assist</span>
                    <button
                      onClick={() => setAimAssist(!aimAssist)}
                      className={`w-12 h-6 rounded-full transition-all ${aimAssist ? 'bg-blue-500' : 'bg-slate-700'}`}
                    >
                      <motion.div
                        animate={{ x: aimAssist ? 24 : 0 }}
                        className="w-5 h-5 bg-white rounded-full mt-0.5 ml-0.5 shadow-lg"
                      />
                    </button>
                  </div>
                  <p className="text-xs text-purple-300/60">Extended aiming guide for easier shots</p>
                </div>

                <div className="bg-slate-800/40 rounded-xl p-4 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-purple-300 font-medium text-sm">Practice Mode</span>
                    <button
                      onClick={() => setPracticeMode(!practiceMode)}
                      className={`w-12 h-6 rounded-full transition-all ${practiceMode ? 'bg-amber-500' : 'bg-slate-700'}`}
                    >
                      <motion.div
                        animate={{ x: practiceMode ? 24 : 0 }}
                        className="w-5 h-5 bg-white rounded-full mt-0.5 ml-0.5 shadow-lg"
                      />
                    </button>
                  </div>
                  <p className="text-xs text-purple-300/60">Play without turn restrictions</p>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-purple-500/20">
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl transition-all font-bold tracking-wider shadow-lg"
                  style={{ boxShadow: '0 0 20px rgba(168, 85, 247, 0.5)' }}
                >
                  SAVE & CLOSE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PoolTable;