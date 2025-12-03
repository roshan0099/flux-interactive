import React, { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  BASE_VERTEX_SHADER,
  ADVECTION_SHADER,
  SPLAT_SHADER,
  DIVERGENCE_SHADER,
  PRESSURE_SHADER,
  GRADIENT_SUBTRACT_SHADER,
  DISPLAY_SHADER
} from '../constants';
import { audioService } from '../services/audioService';
import { FluidMode } from '../types';

interface FluidProps {
  mode: FluidMode;
  isMusicActive?: boolean;
  ambienceMode?: string | null;
  onInteract?: (speed: number) => void;
}

const Fluid = ({ mode, isMusicActive = false, ambienceMode, onInteract }: FluidProps) => {
  const { gl, size } = useThree();
  
  // Keep track of mode inside useFrame without stale closures
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Simulation resolution
  const simRes = 256; // Physics resolution
  const dyeRes = 1024; // Visual resolution (high quality)

  // -- Render Targets (Ping-Pong buffers) --
  const createTarget = (res: number, type: THREE.TextureDataType) => 
    new THREE.WebGLRenderTarget(res, res, {
      type: type,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    });

  const dataType = THREE.FloatType; 

  const velocity = useRef([createTarget(simRes, dataType), createTarget(simRes, dataType)]);
  const density = useRef([createTarget(dyeRes, dataType), createTarget(dyeRes, dataType)]);
  const pressure = useRef([createTarget(simRes, dataType), createTarget(simRes, dataType)]);
  const divergence = useRef(createTarget(simRes, dataType));
  
  // -- Materials (Shader Programs) --
  const advectionMat = useRef(new THREE.ShaderMaterial({
    uniforms: {
      uVelocity: { value: null },
      uSource: { value: null },
      texelSize: { value: new THREE.Vector2() },
      dt: { value: 0.016 },
      dissipation: { value: 1.0 },
    },
    vertexShader: BASE_VERTEX_SHADER,
    fragmentShader: ADVECTION_SHADER,
  }));

  const splatMat = useRef(new THREE.ShaderMaterial({
    uniforms: {
      uTarget: { value: null },
      aspectRatio: { value: 1 },
      color: { value: new THREE.Vector3() },
      point: { value: new THREE.Vector2() },
      radius: { value: 0.0025 },
    },
    vertexShader: BASE_VERTEX_SHADER,
    fragmentShader: SPLAT_SHADER,
  }));

  const divergenceMat = useRef(new THREE.ShaderMaterial({
    uniforms: {
      uVelocity: { value: null },
      texelSize: { value: new THREE.Vector2() },
    },
    vertexShader: BASE_VERTEX_SHADER,
    fragmentShader: DIVERGENCE_SHADER,
  }));

  const pressureMat = useRef(new THREE.ShaderMaterial({
    uniforms: {
      uPressure: { value: null },
      uDivergence: { value: null },
      texelSize: { value: new THREE.Vector2() },
    },
    vertexShader: BASE_VERTEX_SHADER,
    fragmentShader: PRESSURE_SHADER,
  }));

  const gradientSubtractMat = useRef(new THREE.ShaderMaterial({
    uniforms: {
      uPressure: { value: null },
      uVelocity: { value: null },
      texelSize: { value: new THREE.Vector2() },
    },
    vertexShader: BASE_VERTEX_SHADER,
    fragmentShader: GRADIENT_SUBTRACT_SHADER,
  }));

  const displayMat = useRef(new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: null },
      uVelocity: { value: null },
    },
    vertexShader: BASE_VERTEX_SHADER,
    fragmentShader: DISPLAY_SHADER,
  }));

  const quadGeometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);
  const scene = useMemo(() => new THREE.Scene(), []);
  const camera = useMemo(() => new THREE.Camera(), []);
  
  // Interaction State
  const pointer = useRef({ x: 0, y: 0, dx: 0, dy: 0, moved: false, down: false });

  // Music Viz State
  const wanderer = useRef({ x: 0.5, y: 0.5 });
  const lastBass = useRef(0);
  const movementRef = useRef(0);

  // Ambience State: Multiple independent agents with unique paths covering full screen
  const ambienceAgents = useRef(Array.from({ length: 7 }).map(() => ({
    x: Math.random(),
    y: Math.random(),
    // Compound frequencies for wide, non-repetitive movement
    xf1: 0.15 + Math.random() * 0.25,
    xf2: 0.4 + Math.random() * 0.4,
    yf1: 0.15 + Math.random() * 0.25,
    yf2: 0.4 + Math.random() * 0.4,
    // Phases
    px1: Math.random() * Math.PI * 2,
    px2: Math.random() * Math.PI * 2,
    py1: Math.random() * Math.PI * 2,
    py2: Math.random() * Math.PI * 2,
  })));

  useEffect(() => {
    const handleMove = (e: PointerEvent | TouchEvent) => {
      let x, y;
      if ('touches' in e) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
      } else {
        x = (e as PointerEvent).clientX;
        y = (e as PointerEvent).clientY;
      }

      const dx = x - pointer.current.x;
      const dy = y - pointer.current.y;
      
      pointer.current = {
        x,
        y,
        dx,
        dy,
        moved: true,
        down: true
      };
    };

    const handleUp = () => { pointer.current.down = false; };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('touchend', handleUp);
    
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, []);

  const renderPass = (target: THREE.WebGLRenderTarget | null, material: THREE.ShaderMaterial) => {
    const mesh = new THREE.Mesh(quadGeometry, material);
    scene.add(mesh);
    gl.setRenderTarget(target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    scene.remove(mesh);
    mesh.geometry.dispose(); 
  };

  const applySplat = (x: number, y: number, dx: number, dy: number, color: THREE.Vector3, radius: number) => {
      splatMat.current.uniforms.uTarget.value = velocity.current[0].texture;
      splatMat.current.uniforms.point.value.set(x, 1.0 - y);
      splatMat.current.uniforms.color.value.set(dx, -dy, 1.0);
      splatMat.current.uniforms.radius.value = radius;
      splatMat.current.uniforms.aspectRatio.value = size.width / size.height;
      renderPass(velocity.current[1], splatMat.current);
      velocity.current.reverse();

      splatMat.current.uniforms.uTarget.value = density.current[0].texture;
      splatMat.current.uniforms.color.value.copy(color);
      renderPass(density.current[1], splatMat.current);
      density.current.reverse();
  };

  useFrame((state, delta) => {
    const currentMode = modeRef.current;
    const time = state.clock.elapsedTime;
    
    // 1. Process Automated Splats (Music or Ambience)
    if (isMusicActive) {
      if (ambienceMode) {
        // --- AMBIENCE MODE (Zen, Multi-Agent) ---
        // Multiple soothing lights drifting randomly across full screen
        
        ambienceAgents.current.forEach((agent, i) => {
          const t = time;
          
          // Full screen coverage: Center(0.5) + LowFreqWave + HighFreqWave
          // Amplitude sum approx 0.55, range -0.05 to 1.05
          const tx = 0.5 
            + Math.sin(t * agent.xf1 + agent.px1) * 0.35 
            + Math.sin(t * agent.xf2 + agent.px2) * 0.20;

          const ty = 0.5 
            + Math.cos(t * agent.yf1 + agent.py1) * 0.35 
            + Math.cos(t * agent.yf2 + agent.py2) * 0.20;
          
          // Determine movement vector
          const dx = (tx - agent.x);
          const dy = (ty - agent.y);
          
          // Smooth follow
          agent.x += dx * 0.015;
          agent.y += dy * 0.015;

          // Varied Color Palette
          const color = new THREE.Vector3();
          
          if (ambienceMode === 'forest') {
             // Forest Palette: Green, Yellow-Green, Emerald, Deep Green
             const cycle = i % 4;
             if (cycle === 0) color.set(0.1, 0.8, 0.2); // Bright Green
             else if (cycle === 1) color.set(0.5, 0.7, 0.1); // Yellow-Green
             else if (cycle === 2) color.set(0.0, 0.5, 0.3); // Deep Emerald
             else color.set(0.2, 0.6, 0.1); // Leaf Green
             
             // Gentle shift
             color.y += Math.sin(t + i) * 0.05;
          } else {
             // River Palette: Cyan, Royal Blue, Purple-Blue, Teal
             const cycle = i % 4;
             if (cycle === 0) color.set(0.0, 0.6, 0.9); // Cyan-Blue
             else if (cycle === 1) color.set(0.1, 0.3, 0.8); // Royal Blue
             else if (cycle === 2) color.set(0.3, 0.2, 1.0); // Purple-ish
             else color.set(0.0, 0.8, 0.8); // Teal
             
             // Gentle shift
             color.z += Math.cos(t + i) * 0.05;
          }

          // Force aligned with movement
          const vx = dx * 15.0;
          const vy = dy * 15.0;

          applySplat(agent.x, agent.y, vx, vy, color, 0.0035);
        });

      } else {
        // --- MUSIC MODE (Chaotic, Reactive) ---
        const audioData = audioService.getAudioData();
        if (audioData) {
          let bassSum = 0; for (let i = 0; i < 15; i++) bassSum += audioData[i];
          const bassAvg = bassSum / 15;
          let volSum = 0; for (let i = 0; i < audioData.length; i++) volSum += audioData[i];
          const volAvg = volSum / audioData.length;
          
          const excitement = Math.pow(volAvg / 255.0, 2.5);
          const tVal = time * 1.2; 
          const chaos = Math.sin(tVal) * Math.cos(tVal * 2.7) + Math.sin(tVal * 1.5) * 0.5;
          const sporadicFactor = 1.2 + Math.pow(Math.abs(chaos + 0.5), 2.5) * 4.0;
          const wanderSpeed = (0.8 + excitement * 4.0) * sporadicFactor;
          
          movementRef.current += delta * wanderSpeed;
          const t = movementRef.current;
          const tx = 0.5 + Math.sin(t * 0.5) * 0.4 + Math.sin(t * 1.42) * 0.2;
          const ty = 0.5 + Math.cos(t * 0.36) * 0.4 + Math.cos(t * 1.73) * 0.2;
          const smooth = 0.1;
          wanderer.current.x += (tx - wanderer.current.x) * smooth;
          wanderer.current.y += (ty - wanderer.current.y) * smooth;

          let color = new THREE.Vector3();
          switch (currentMode) {
            case 'ignite': color.set(1.0, 0.2, 0.0); break;
            case 'frost': color.set(0.1, 0.6, 1.0); break;
            case 'mist': color.set(0.8, 0.8, 0.8); break;
            case 'flux':
            default:
              const tempColor = new THREE.Color();
              tempColor.setHSL((time * 0.5) % 1.0, 0.8, 0.5);
              color.set(tempColor.r, tempColor.g, tempColor.b);
              break;
          }

          if (volAvg > 2) {
            const trailDx = (tx - wanderer.current.x) * 40.0 * excitement;
            const trailDy = (ty - wanderer.current.y) * 40.0 * excitement;
            applySplat(wanderer.current.x, wanderer.current.y, trailDx, trailDy, color, 0.004 + (excitement * 0.005));
          }

          const isDrop = bassAvg > 110 && (bassAvg - lastBass.current) > 20;
          if (isDrop) {
            const dropParticleCount = 30;
            const intensity = 4.0;
            for (let i = 0; i < dropParticleCount; i++) {
              const rx = Math.random();
              const ry = Math.random();
              const angle = Math.random() * Math.PI * 2;
              const speed = 20.0 + Math.random() * 60.0;
              const bdx = Math.cos(angle) * speed;
              const bdy = Math.sin(angle) * speed;
              const flashColor = color.clone().multiplyScalar(intensity);
              applySplat(rx, ry, bdx, bdy, flashColor, 0.005 + Math.random() * 0.015);
            }
          }
          lastBass.current = bassAvg;
        }
      }
    }


    // 2. Input Interaction (Splat)
    if (pointer.current.moved) {
      const dx = pointer.current.dx;
      const dy = pointer.current.dy;
      const velocityMag = Math.sqrt(dx*dx + dy*dy);
      
      // Update Audio (Procedural)
      audioService.update(Math.min(velocityMag / 20, 1));
      if (onInteract) onInteract(velocityMag);

      const u = pointer.current.x / size.width;
      const v = pointer.current.y / size.height; // Flip handled in splat

      // Determine color based on mode
      let color = new THREE.Vector3();
      const rVal = Math.random();
      
      switch (currentMode) {
        case 'ignite':
          color.set(1.0, 0.1 + rVal * 0.3, 0.05);
          break;
        case 'frost':
          color.set(0.05, 0.5 + rVal * 0.4, 0.9 + rVal * 0.1);
          break;
        case 'mist':
          const grey = 0.5 + rVal * 0.5;
          color.set(grey, grey, grey);
          break;
        case 'flux':
        default:
          const r = Math.sin(time * 0.5) * 0.5 + 0.5;
          const g = Math.sin(time * 0.5 + 2.0) * 0.5 + 0.5;
          const b = Math.sin(time * 0.5 + 4.0) * 0.5 + 0.5;
          color.set(r, g, b);
          break;
      }
      
      const interactRadius = 0.001 + Math.min(velocityMag, 100) * 0.00005; 
      
      applySplat(u, v, dx * 5.0, dy * 5.0, color, interactRadius);

      pointer.current.moved = false;
      pointer.current.dx = 0;
      pointer.current.dy = 0;
    } else {
      audioService.update(0); 
    }

    // Determine dissipation based on mode
    let velocityDissipation = 0.99; 
    let densityDissipation = 0.97;

    switch (currentMode) {
      case 'ignite':
        velocityDissipation = 0.98;
        densityDissipation = 0.92; 
        break;
      case 'mist':
        velocityDissipation = 0.99; 
        densityDissipation = 0.98; 
        break;
      case 'frost':
        velocityDissipation = 0.95; 
        densityDissipation = 0.97;
        break;
      case 'flux':
      default:
        velocityDissipation = 0.99;
        densityDissipation = 0.97;
        break;
    }

    // 3. Advection (Velocity)
    advectionMat.current.uniforms.uVelocity.value = velocity.current[0].texture;
    advectionMat.current.uniforms.uSource.value = velocity.current[0].texture;
    advectionMat.current.uniforms.texelSize.value.set(1.0 / simRes, 1.0 / simRes);
    advectionMat.current.uniforms.dissipation.value = velocityDissipation; 
    renderPass(velocity.current[1], advectionMat.current);
    velocity.current.reverse();

    // 4. Advection (Density)
    advectionMat.current.uniforms.uVelocity.value = velocity.current[0].texture;
    advectionMat.current.uniforms.uSource.value = density.current[0].texture;
    advectionMat.current.uniforms.texelSize.value.set(1.0 / dyeRes, 1.0 / dyeRes);
    advectionMat.current.uniforms.dissipation.value = densityDissipation;
    renderPass(density.current[1], advectionMat.current);
    density.current.reverse();

    // 5. Divergence
    divergenceMat.current.uniforms.uVelocity.value = velocity.current[0].texture;
    divergenceMat.current.uniforms.texelSize.value.set(1.0 / simRes, 1.0 / simRes);
    renderPass(divergence.current, divergenceMat.current);

    // 6. Pressure
    pressureMat.current.uniforms.uDivergence.value = divergence.current.texture;
    pressureMat.current.uniforms.texelSize.value.set(1.0 / simRes, 1.0 / simRes);
    for (let i = 0; i < 20; i++) {
      pressureMat.current.uniforms.uPressure.value = pressure.current[0].texture;
      renderPass(pressure.current[1], pressureMat.current);
      pressure.current.reverse();
    }

    // 7. Gradient Subtract
    gradientSubtractMat.current.uniforms.uPressure.value = pressure.current[0].texture;
    gradientSubtractMat.current.uniforms.uVelocity.value = velocity.current[0].texture;
    gradientSubtractMat.current.uniforms.texelSize.value.set(1.0 / simRes, 1.0 / simRes);
    renderPass(velocity.current[1], gradientSubtractMat.current);
    velocity.current.reverse();

    // 8. Render to Screen
    displayMat.current.uniforms.uTexture.value = density.current[0].texture;
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <primitive object={displayMat.current} attach="material" />
    </mesh>
  );
};

export default Fluid;