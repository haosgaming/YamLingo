import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { BoardSkinId } from '../engine/gamification';
import type { SimulationState } from '../engine/yamlValidator';

export interface Esp32Workbench3DProps {
  skin: BoardSkinId;
  simulation: SimulationState;
  lightOverrideOn?: boolean;
  lightBrightness?: number;
  ambientOrbit?: boolean;
  cameraPreset?: 'board' | 'desk' | 'sensor';
  className?: string;
}

const SKIN_COLORS: Record<BoardSkinId, { pcb: number; accent: number; silk: string }> = {
  'pcb-emerald': { pcb: 0x0f5c38, accent: 0x22c55e, silk: '#e2f5ea' },
  'pcb-obsidian': { pcb: 0x161920, accent: 0x38bdf8, silk: '#cbd5e1' },
  'pcb-ha-cyan': { pcb: 0x0c6b94, accent: 0x18bcf2, silk: '#e0f7ff' },
  'pcb-gold': { pcb: 0x3b1f4a, accent: 0xd4af37, silk: '#fde68a' },
};

const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createDeskGridTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#14171d';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(156, 164, 179, 0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(91, 155, 213, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, 510, 510);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function createPcbTexture(skin: BoardSkinId): THREE.CanvasTexture {
  const palette = SKIN_COLORS[skin];
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#' + palette.pcb.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, 512, 256);

  // Subtle copper traces
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(30 + i * 38, 22);
    ctx.lineTo(50 + i * 38, 56);
    ctx.lineTo(50 + i * 38, 200);
    ctx.stroke();
  }

  // Silkscreen markings
  ctx.fillStyle = palette.silk;
  ctx.font = 'bold 20px monospace';
  ctx.fillText('ESP32-S3 DEVKIT', 178, 134);
  ctx.font = '13px monospace';
  ctx.fillText('GPIO2 · I2C · OTA', 186, 158);
  ctx.fillText('EN', 70, 48);
  ctx.fillText('BOOT', 64, 218);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function Esp32Workbench3D({
  skin,
  simulation,
  lightOverrideOn,
  lightBrightness = 100,
  ambientOrbit = false,
  cameraPreset = 'desk',
  className = '',
}: Esp32Workbench3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const propsRef = useRef({
    skin,
    simulation,
    lightOverrideOn,
    lightBrightness,
    ambientOrbit,
    cameraPreset,
  });
  propsRef.current = {
    skin,
    simulation,
    lightOverrideOn,
    lightBrightness,
    ambientOrbit,
    cameraPreset,
  };

  const triggerRenderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111317);
    scene.fog = new THREE.FogExp2(0x111317, 0.042);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(4.2, 3.3, 4.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 2.4;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.target.set(0.2, 0.2, 0);

    // Studio Lighting (warm key + cool hemisphere fill + rim)
    const hemi = new THREE.HemisphereLight(0xb8d8f8, 0x161b26, 0.85);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.2);
    keyLight.position.set(4.5, 6.5, 3.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7da8d6, 0.75);
    rimLight.position.set(-4, 3.5, -4);
    scene.add(rimLight);

    // 1. Workbench Mat Surface
    const deskTex = createDeskGridTexture();
    deskTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const deskMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: deskTex,
      roughness: 0.78,
      metalness: 0.08,
    });
    const deskGeo = new THREE.BoxGeometry(16, 0.2, 12);
    const deskMesh = new THREE.Mesh(deskGeo, deskMat);
    deskMesh.position.y = -0.1;
    deskMesh.receiveShadow = true;
    scene.add(deskMesh);

    const shadowTex = createContactShadowTexture();
    const contactMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });
    const contactPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.6), contactMat);
    contactPlane.rotation.x = -Math.PI / 2;
    contactPlane.position.set(-0.35, 0.015, 0.15);
    scene.add(contactPlane);

    // 2. Composite ESP32-S3 DevKit Group (8+ parts)
    const espGroup = new THREE.Group();
    espGroup.position.set(-0.4, 0, 0.15);
    scene.add(espGroup);

    let currentSkin = propsRef.current.skin;
    let pcbTex = createPcbTexture(currentSkin);
    pcbTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const pcbMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: pcbTex,
      roughness: 0.52,
      metalness: 0.12,
    });
    const pcbMesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.09, 1.35), pcbMat);
    pcbMesh.position.y = 0.24;
    pcbMesh.castShadow = true;
    pcbMesh.receiveShadow = true;
    espGroup.add(pcbMesh);

    // RF Metal Shield Can
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0xd6dde6,
      roughness: 0.22,
      metalness: 0.92,
    });
    const rfShield = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.16, 0.88), shieldMat);
    rfShield.position.set(-0.68, 0.365, 0);
    rfShield.castShadow = true;
    espGroup.add(rfShield);

    // PCB Antenna Gold Trace Block
    const antennaMat = new THREE.MeshStandardMaterial({
      color: 0xd9a441,
      roughness: 0.28,
      metalness: 0.85,
    });
    const antennaTrace = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.72), antennaMat);
    antennaTrace.position.set(-1.14, 0.295, 0);
    espGroup.add(antennaTrace);

    // USB-C Port Housing
    const usbMat = new THREE.MeshStandardMaterial({
      color: 0xbfc7d1,
      roughness: 0.2,
      metalness: 0.9,
    });
    const usbPort = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.42), usbMat);
    usbPort.position.set(1.22, 0.35, 0);
    usbPort.castShadow = true;
    espGroup.add(usbPort);

    // UART Silicon Chip
    const chipMat = new THREE.MeshStandardMaterial({
      color: 0x16181d,
      roughness: 0.68,
      metalness: 0.05,
    });
    const uartChip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.28), chipMat);
    uartChip.position.set(0.65, 0.315, 0.08);
    espGroup.add(uartChip);

    // Tactile Buttons (EN + BOOT)
    const btnBaseMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.6 });
    const btnCapMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.1 });
    [-0.36, 0.36].forEach((zOff) => {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.14), btnBaseMat);
      base.position.set(0.95, 0.31, zOff);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 16), btnCapMat);
      cap.position.set(0.95, 0.345, zOff);
      espGroup.add(base, cap);
    });

    // InstancedMesh 30 Gold GPIO Pins (2 rows x 15)
    const pinGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.34, 8);
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xe5b94c, roughness: 0.25, metalness: 0.92 });
    const pinInst = new THREE.InstancedMesh(pinGeo, pinMat, 30);
    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 15; col++) {
        dummy.position.set(-0.98 + col * 0.145, 0.14, row === 0 ? -0.56 : 0.56);
        dummy.updateMatrix();
        pinInst.setMatrixAt(idx++, dummy.matrix);
      }
    }
    pinInst.instanceMatrix.needsUpdate = true;
    pinInst.computeBoundingSphere();
    espGroup.add(pinInst);

    // Power LED (subtle red) + GPIO2 Status LED + RGB LED
    const pwrLedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    });
    const pwrLed = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.05), pwrLedMat);
    pwrLed.position.set(0.86, 0.305, -0.2);
    espGroup.add(pwrLed);

    const gpioLedMat = new THREE.MeshStandardMaterial({
      color: 0x5b9bd5,
      emissive: 0x5b9bd5,
      emissiveIntensity: 0.1,
      roughness: 0.25,
    });
    const gpioLed = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.06), gpioLedMat);
    gpioLed.position.set(0.18, 0.31, -0.26);
    espGroup.add(gpioLed);

    const gpioPointLight = new THREE.PointLight(0x5b9bd5, 0, 2.2, 2);
    gpioPointLight.position.set(0.18, 0.55, -0.26);
    espGroup.add(gpioPointLight);

    // 3. BME280 I2C Sensor Breakout Module
    const bmeGroup = new THREE.Group();
    bmeGroup.position.set(-1.35, 0, -1.25);
    scene.add(bmeGroup);

    const bmePcbMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5, metalness: 0.15 });
    const bmePcb = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.07, 0.56), bmePcbMat);
    bmePcb.position.y = 0.08;
    bmePcb.castShadow = true;
    const bmeCap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), shieldMat);
    bmeCap.position.set(0, 0.145, 0);
    bmeGroup.add(bmePcb, bmeCap);

    // Curved I2C Jumper Wires (visible & glowing when I2C configured)
    const wireMatSda = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.45 });
    const wireMatScl = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.45 });
    const sdaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.25, 0.12, -1.0),
      new THREE.Vector3(-1.05, 0.52, -0.7),
      new THREE.Vector3(-0.7, 0.29, -0.41),
    ]);
    const sclCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.42, 0.12, -1.0),
      new THREE.Vector3(-1.2, 0.58, -0.65),
      new THREE.Vector3(-0.55, 0.29, -0.41),
    ]);
    const sdaWire = new THREE.Mesh(new THREE.TubeGeometry(sdaCurve, 20, 0.02, 8, false), wireMatSda);
    const sclWire = new THREE.Mesh(new THREE.TubeGeometry(sclCurve, 20, 0.02, 8, false), wireMatScl);
    scene.add(sdaWire, sclWire);

    // 4. Smart Desk Lamp & Relay Rig (Right side of workbench)
    const lampGroup = new THREE.Group();
    lampGroup.position.set(1.85, 0, -0.55);
    scene.add(lampGroup);

    const lampBaseMat = new THREE.MeshStandardMaterial({ color: 0x272c38, roughness: 0.48, metalness: 0.65 });
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.1, 24), lampBaseMat);
    lampBase.position.y = 0.05;
    lampBase.castShadow = true;

    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.1, 0),
      new THREE.Vector3(0.15, 0.9, -0.15),
      new THREE.Vector3(-0.18, 1.48, 0.1),
    ]);
    const lampStem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 20, 0.04, 12, false), lampBaseMat);
    lampStem.castShadow = true;

    const shadePoints = [
      new THREE.Vector2(0.06, 0.26),
      new THREE.Vector2(0.18, 0.18),
      new THREE.Vector2(0.28, 0),
    ];
    const shadeGeo = new THREE.LatheGeometry(shadePoints, 24);
    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.35,
      metalness: 0.55,
      side: THREE.DoubleSide,
    });
    const lampShade = new THREE.Mesh(shadeGeo, shadeMat);
    lampShade.position.set(-0.18, 1.24, 0.1);
    lampShade.rotation.z = 0.22;

    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff3d1,
      emissive: 0xffd275,
      emissiveIntensity: 0.05,
      roughness: 0.25,
    });
    const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), bulbMat);
    lampBulb.position.set(-0.16, 1.26, 0.1);

    const lampLight = new THREE.PointLight(0xffd275, 0, 6, 2);
    lampLight.position.set(-0.16, 1.15, 0.1);

    lampGroup.add(lampBase, lampStem, lampShade, lampBulb, lampLight);

    // Update dynamic materials/lights from React props
    const syncSceneState = () => {
      const { skin: s, simulation: sim, lightOverrideOn, lightBrightness: bright } = propsRef.current;

      if (s !== currentSkin) {
        currentSkin = s;
        const nextTex = createPcbTexture(s);
        nextTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        pcbMat.map = nextTex;
        pcbMat.needsUpdate = true;
        pcbTex.dispose();
        pcbTex = nextTex;
      }

      const hasLightConfigured = sim.lights.length > 0 || sim.switches.length > 0;
      const isLit = lightOverrideOn !== undefined ? lightOverrideOn : hasLightConfigured;
      const intensityScale = Math.max(0.1, (bright ?? 100) / 100);

      gpioLedMat.emissiveIntensity = isLit ? 2.4 * intensityScale : 0.12;
      gpioPointLight.intensity = isLit ? 1.8 * intensityScale : 0;

      bulbMat.emissiveIntensity = isLit ? 2.6 * intensityScale : 0.06;
      lampLight.intensity = isLit ? 3.5 * intensityScale : 0;

      sdaWire.visible = sim.hasI2c || sim.sensors.length > 0;
      sclWire.visible = sim.hasI2c || sim.sensors.length > 0;
      bmeGroup.visible = true;
    };

    // Rendering scheduler (software-WebGL safe!)
    let frameId = 0;
    let disposed = false;
    let renderBusy = false;
    let renderDirty = false;
    let activePresetTransition = false;
    let lastPreset = propsRef.current.cameraPreset;

    const getPresetCoords = (preset: 'board' | 'desk' | 'sensor') => {
      if (preset === 'board') {
        return { pos: [0.3, 2.35, 2.45], look: [-0.3, 0.25, 0.15] };
      }
      if (preset === 'sensor') {
        return { pos: [-1.1, 1.9, 1.1], look: [-1.2, 0.15, -1.0] };
      }
      return { pos: [3.8, 3.0, 4.3], look: [0.25, 0.35, -0.15] };
    };

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    let lastTickTime = performance.now();

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        const now = performance.now();
        const dt = Math.min((now - lastTickTime) / 1000, 0.05);
        lastTickTime = now;

        syncSceneState();

        if (propsRef.current.cameraPreset !== lastPreset) {
          lastPreset = propsRef.current.cameraPreset;
          activePresetTransition = true;
        }

        if (activePresetTransition) {
          const p = getPresetCoords(lastPreset);
          _targetPos.set(p.pos[0], p.pos[1], p.pos[2]);
          _targetLook.set(p.look[0], p.look[1], p.look[2]);
          if (isSoftwareGl) {
            camera.position.copy(_targetPos);
            controls.target.copy(_targetLook);
            activePresetTransition = false;
          } else {
            const alpha = 1 - Math.exp(-6 * dt);
            camera.position.lerp(_targetPos, alpha);
            controls.target.lerp(_targetLook, alpha);
            if (camera.position.distanceTo(_targetPos) < 0.03) {
              activePresetTransition = false;
            } else {
              renderDirty = true;
            }
          }
        }

        controls.update();
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty && !disposed) {
            requestRender();
          }
        };

        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    triggerRenderRef.current = requestRender;

    // Gentle ambient loop only when ambientOrbit (Title Screen) is true
    let ambientTimer = 0;
    const renderAmbientFrame = () => {
      const t = performance.now() * 0.00022;
      // Offset look target to -X so hardware sits squarely in right 60% of Title Screen
      camera.position.set(
        2.1 + Math.cos(t) * 2.2,
        2.75 + Math.sin(t * 1.3) * 0.2,
        3.4 + Math.sin(t) * 1.4
      );
      controls.target.set(-0.95, 0.35, -0.15);
      controls.update();
      renderer.render(scene, camera);
    };

    const runAmbientTick = () => {
      if (disposed || !propsRef.current.ambientOrbit) return;
      renderAmbientFrame();
      if (isSoftwareGl) {
        afterDraw(() => {
          ambientTimer = window.setTimeout(runAmbientTick, 140);
        });
      } else {
        frameId = requestAnimationFrame(runAmbientTick);
      }
    };

    const onControlsChange = () => {
      if (!propsRef.current.ambientOrbit) {
        requestRender();
      }
    };
    const onControlsStart = () => {
      activePresetTransition = false;
    };
    controls.addEventListener('change', onControlsChange);
    controls.addEventListener('start', onControlsStart);

    const onResize = () => {
      if (!container || disposed) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (propsRef.current.ambientOrbit) {
        renderAmbientFrame();
      } else {
        requestRender();
      }
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    syncSceneState();
    if (propsRef.current.ambientOrbit) {
      renderAmbientFrame();
      if (isSoftwareGl) {
        afterDraw(() => {
          ambientTimer = window.setTimeout(runAmbientTick, 140);
        });
      } else {
        frameId = requestAnimationFrame(runAmbientTick);
      }
    } else {
      controls.update();
      renderer.render(scene, camera);
      requestRender();
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      clearTimeout(ambientTimer);
      resizeObserver.disconnect();
      controls.removeEventListener('change', onControlsChange);
      controls.removeEventListener('start', onControlsStart);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      deskTex.dispose();
      pcbTex.dispose();
      shadowTex.dispose();
      envTex.dispose();
      renderer.dispose();
    };
  }, []);

  // Re-render on prop changes
  useEffect(() => {
    triggerRenderRef.current?.();
  }, [skin, simulation, lightOverrideOn, lightBrightness, cameraPreset, ambientOrbit]);

  if (webglUnavailable) {
    return (
      <div
        data-testid="esp32-3d-canvas"
        className={`flex h-full w-full flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center ${className}`}
        style={{
          backgroundColor: 'var(--bg-editor)',
          borderColor: 'var(--border-strong)',
          color: 'var(--text-secondary)',
        }}
      >
        <div className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Virtuální ESP32-S3 Deska ({skin})
        </div>
        <div className="text-xs">
          LED GPIO2: {lightOverrideOn || simulation.lights.length > 0 ? 'SVÍTÍ' : 'VYPNUTO'} · I2C:{' '}
          {simulation.hasI2c ? 'AKTIVNÍ' : 'NEZAPOJENO'}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      data-testid="esp32-3d-canvas"
      className={`h-full w-full overflow-hidden ${className}`}
    />
  );
}
