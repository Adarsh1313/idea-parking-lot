import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Html, OrbitControls } from "@react-three/drei";
import { a, useSpring } from "@react-spring/three";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Group } from "three";
import { useIdeaStore } from "../store/ideaStore";
import type { Idea } from "../types";
import {
  ACTIVE_ROUTE,
  BARRIER_POSITION,
  ENTRANCE_POSITION,
  ENTRY_ROUTE,
  getEntryPathToSlot,
  getSlotPosition,
  LOT_DEPTH,
  LOT_WIDTH,
  PARKING_DRIVE_X,
  PARKING_SLOTS,
  type SlotLayout
} from "./layout";

const CAMERA_DEFAULT = new THREE.Vector3(0, 23, 20);
const CAMERA_LOOK_AT = new THREE.Vector3(0, 0, 0);
const CAR_FORWARD_OFFSET = Math.PI * 0.5;

function toVector3([x, y, z]: readonly [number, number, number]) {
  return new THREE.Vector3(x, y, z);
}

function createCurve(points: readonly (readonly [number, number, number])[], closed = false) {
  return new THREE.CatmullRomCurve3(points.map(toVector3), closed, "catmullrom", 0.18);
}

function tangentHeading(tangent: THREE.Vector3) {
  return Math.atan2(tangent.x, tangent.z) + CAR_FORWARD_OFFSET;
}

function setObjectOnCurve(object: Group, curve: THREE.CatmullRomCurve3, progress: number) {
  const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
  const point = curve.getPointAt(clampedProgress);
  const tangent = curve.getTangentAt(clampedProgress).normalize();
  object.position.copy(point);
  object.rotation.set(0, tangentHeading(tangent), 0);
}

function getEntryProgress(createdAt: string) {
  const elapsed = Date.now() - new Date(createdAt).getTime();
  return THREE.MathUtils.clamp(elapsed / 2800, 0, 1);
}

function getSkyMode() {
  const hour = new Date().getHours();

  if (hour >= 18 || hour < 6) {
    return "night";
  }

  if (hour >= 6 && hour < 11) {
    return "morning";
  }

  return "day";
}

export function ParkingLotScene() {
  const [webglLost, setWebglLost] = useState(false);
  const skyMode = useMemo(getSkyMode, []);
  const skyColor = skyMode === "night" ? "#07111d" : skyMode === "morning" ? "#cfe6ef" : "#b7c9c6";
  const fogColor = skyMode === "night" ? "#0b1622" : skyMode === "morning" ? "#dbeaf0" : "#b7c9c6";

  return (
    <>
      <div className="canvas-backdrop" aria-hidden="true" />
      <Canvas
        className="parking-canvas"
        camera={{ position: CAMERA_DEFAULT, fov: 46 }}
        shadows
        dpr={[1, 1.25]}
        gl={{ antialias: true, alpha: false, powerPreference: "default" }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
            setWebglLost(true);
          });
          canvas.addEventListener("webglcontextrestored", () => setWebglLost(false));
        }}
      >
        <color attach="background" args={[skyColor]} />
        <fog attach="fog" args={[fogColor, 24, skyMode === "night" ? 42 : 54]} />
        <ambientLight intensity={skyMode === "night" ? 0.42 : 1.05} />
        <hemisphereLight args={[skyMode === "night" ? "#37516b" : "#fff7df", "#6f7b7c", skyMode === "night" ? 0.65 : 1.15]} />
        <directionalLight position={[8, 13, 8]} intensity={skyMode === "night" ? 0.35 : 1.4} castShadow shadow-mapSize={[1024, 1024]} />
        <SkyAmbience mode={skyMode} />
        <SceneContent />
        <OrbitControls
          enablePan={false}
          minPolarAngle={0.38}
          maxPolarAngle={1.05}
          minDistance={10}
          maxDistance={46}
          target={[0, 0, 0]}
        />
      </Canvas>
      {webglLost ? <CanvasFallback /> : null}
    </>
  );
}

function SkyAmbience({ mode }: { mode: "night" | "morning" | "day" }) {
  return (
    <group>
      <CloudHaze mode={mode} />
      {mode === "night" ? (
        <>
          <mesh position={[-13, 13, -16]}>
            <sphereGeometry args={[0.72, 24, 16]} />
            <meshStandardMaterial color="#f5f0c8" emissive="#f5f0c8" emissiveIntensity={1.2} />
          </mesh>
          {Array.from({ length: 34 }).map((_, index) => {
            const x = -17 + ((index * 7) % 34);
            const z = -17 + ((index * 11) % 34);
            const y = 8.5 + (index % 7) * 0.55;

            return (
              <mesh key={index} position={[x, y, z]}>
                <sphereGeometry args={[0.035, 8, 6]} />
                <meshBasicMaterial color="#fffbd8" />
              </mesh>
            );
          })}
        </>
      ) : null}
      {mode === "morning" ? (
        <>
          <mesh position={[-14, 10.5, -15]}>
            <sphereGeometry args={[0.95, 24, 16]} />
            <meshStandardMaterial color="#ffd66f" emissive="#ffd66f" emissiveIntensity={0.7} />
          </mesh>
          <MorningBirds />
        </>
      ) : null}
    </group>
  );
}

function CloudHaze({ mode }: { mode: "night" | "morning" | "day" }) {
  const color = mode === "night" ? "#18283a" : "#e7f0ef";
  const opacity = mode === "night" ? 0.16 : 0.28;

  return (
    <group position={[0, 5.6, 0]}>
      {[
        [-14, -10, 5.4],
        [12, -8, 4.6],
        [-10, 10, 4.9],
        [14, 9, 5.2]
      ].map(([x, z, scale], index) => (
        <mesh key={index} position={[x, 0, z]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[scale, 32]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function MorningBirds() {
  const groupRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.position.x = ((clock.elapsedTime * 1.2) % 34) - 17;
    groupRef.current.position.y = 8.2 + Math.sin(clock.elapsedTime * 1.7) * 0.18;
  });

  return (
    <group ref={groupRef} position={[-16, 8.2, -10]}>
      {[0, 1, 2].map((index) => (
        <group key={index} position={[index * 0.72, index % 2 === 0 ? 0 : 0.22, index * -0.2]}>
          <mesh rotation-z={0.45}>
            <boxGeometry args={[0.36, 0.025, 0.025]} />
            <meshBasicMaterial color="#2b3940" />
          </mesh>
          <mesh rotation-z={-0.45}>
            <boxGeometry args={[0.36, 0.025, 0.025]} />
            <meshBasicMaterial color="#2b3940" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CanvasFallback() {
  return (
    <div className="canvas-fallback" role="status">
      3D renderer paused. Reloading the page usually restores the lot.
    </div>
  );
}

function SceneContent() {
  const ideas = useIdeaStore((state) => state.ideas);
  const pendingIdea = useIdeaStore((state) => state.pendingIdea);
  const selectedIdeaId = useIdeaStore((state) => state.selectedIdeaId);
  const startPendingIdea = useIdeaStore((state) => state.startPendingIdea);
  const selectIdea = useIdeaStore((state) => state.selectIdea);
  const occupiedSlots = useMemo(() => new Set(ideas.map((idea) => idea.slotIndex)), [ideas]);
  const selectedIdea = ideas.find((idea) => idea.id === selectedIdeaId) ?? null;
  const selectedActiveOrder = Math.max(0, ideas.findIndex((idea) => idea.id === selectedIdeaId));

  return (
    <>
      <CameraRig selectedIdea={selectedIdea} activeOrder={selectedActiveOrder} />
      <LotBase />
      <RoadLoop />
      <Barrier open={Boolean(pendingIdea)} />
      <EntranceProps />
      {PARKING_SLOTS.map((slot) => (
        <ParkingSpace
          key={slot.index}
          slot={slot}
          occupied={occupiedSlots.has(slot.index)}
          onClick={() => startPendingIdea(slot.index)}
        />
      ))}
      {pendingIdea ? (
        <PendingCar color={pendingIdea.carColor} slotIndex={pendingIdea.slotIndex} />
      ) : null}
      {ideas.map((idea, activeOrder) => (
        <IdeaCar
          key={idea.id}
          idea={idea}
          activeOrder={activeOrder}
          selected={idea.id === selectedIdeaId}
          onClick={() => selectIdea(idea.id)}
        />
      ))}
    </>
  );
}

function CameraRig({ selectedIdea, activeOrder }: { selectedIdea: Idea | null; activeOrder: number }) {
  const { camera } = useThree();
  const activeCurve = useMemo(() => createCurve(ACTIVE_ROUTE, true), []);
  const target = useMemo(() => {
    if (!selectedIdea) {
      return {
        position: CAMERA_DEFAULT,
        lookAt: CAMERA_LOOK_AT
      };
    }

    if (selectedIdea.status === "active") {
      const carPoint = activeCurve.getPointAt((performance.now() * 0.000035 + activeOrder * 0.13) % 1);
      return {
        position: new THREE.Vector3(carPoint.x + 5.4, 7.2, carPoint.z + 5.6),
        lookAt: new THREE.Vector3(carPoint.x, 0.34, carPoint.z)
      };
    }

    const [x, , z] = getSlotPosition(selectedIdea.slotIndex);
    return {
      position: new THREE.Vector3(x + 3.3, 5.4, z + 4.3),
      lookAt: new THREE.Vector3(x, 0.3, z)
    };
  }, [activeCurve, activeOrder, selectedIdea]);

  useFrame(({ clock }) => {
    if (selectedIdea?.status === "active") {
      const carPoint = activeCurve.getPointAt((clock.elapsedTime * 0.035 + activeOrder * 0.13) % 1);
      camera.position.lerp(new THREE.Vector3(carPoint.x + 5.4, 7.2, carPoint.z + 5.6), 0.045);
      camera.lookAt(carPoint.x, 0.34, carPoint.z);
      return;
    }

    camera.position.lerp(target.position, 0.045);
    camera.lookAt(target.lookAt);
  });

  return null;
}

function LotBase() {
  return (
    <group>
      <mesh receiveShadow position={[0, -0.12, 0]}>
        <boxGeometry args={[LOT_WIDTH, 0.22, LOT_DEPTH]} />
        <meshStandardMaterial color="#394144" roughness={0.82} />
      </mesh>
      <mesh receiveShadow position={[0, -0.03, 0]}>
        <boxGeometry args={[21.8, 0.08, 15.6]} />
        <meshStandardMaterial color="#566064" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[1.05, 0.06, 15.2]} />
        <meshStandardMaterial color="#ebe2cd" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[21.4, 0.04, 1]} />
        <meshStandardMaterial color="#ebe2cd" roughness={0.72} />
      </mesh>
      <mesh position={[0, -0.26, 0]}>
        <boxGeometry args={[LOT_WIDTH + 0.6, 0.25, LOT_DEPTH + 0.6]} />
        <meshStandardMaterial color="#5a3c2e" roughness={0.85} />
      </mesh>
    </group>
  );
}

function RoadLoop() {
  const routeCurve = useMemo(() => createCurve(ACTIVE_ROUTE, true), []);
  const routePoints = useMemo(() => routeCurve.getPoints(96), [routeCurve]);

  return (
    <group>
      <RoadRibbon points={routePoints} width={2.4} color="#283034" y={0.04} />
      {ACTIVE_ROUTE.map(([x, y, z], index) => (
        <mesh key={`joint-${index}`} receiveShadow position={[x, y - 0.27, z]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[1.22, 32]} />
          <meshStandardMaterial color="#283034" roughness={0.88} />
        </mesh>
      ))}
      <RoadRibbon points={routePoints} width={0.16} color="#e9ece6" y={0.085} dashed />
      {ENTRY_ROUTE.slice(0, -1).map(([x, y, z], index) => {
        const [nextX, , nextZ] = ENTRY_ROUTE[index + 1];
        const length = Math.hypot(nextX - x, nextZ - z);
        const centerX = (x + nextX) * 0.5;
        const centerZ = (z + nextZ) * 0.5;
        const angle = Math.atan2(nextX - x, nextZ - z);

        return (
          <group key={`${x}-${z}`} position={[centerX, y - 0.28, centerZ]} rotation-y={angle}>
            <mesh receiveShadow position={[0, 0, 0]}>
              <boxGeometry args={[2.34, 0.06, length]} />
              <meshStandardMaterial color="#283034" roughness={0.88} />
            </mesh>
            {index < 3
              ? Array.from({ length: Math.max(1, Math.floor(length / 1.25)) }).map((_, dashIndex) => (
                  <mesh key={dashIndex} position={[0, 0.04, -length * 0.5 + 0.7 + dashIndex * 1.25]}>
                    <boxGeometry args={[0.08, 0.03, 0.52]} />
                    <meshStandardMaterial color="#e9ece6" />
                  </mesh>
                ))
              : null}
          </group>
        );
      })}
      {PARKING_DRIVE_X.filter((x) => x > -6.9).map((x) => (
        <mesh key={x} position={[x, 0.09, 0]}>
          <boxGeometry args={[0.08, 0.04, 1.26]} />
          <meshStandardMaterial color="#e9ece6" />
        </mesh>
      ))}
    </group>
  );
}

function RoadRibbon({
  points,
  width,
  color,
  y,
  dashed = false
}: {
  points: THREE.Vector3[];
  width: number;
  color: string;
  y: number;
  dashed?: boolean;
}) {
  return (
    <group>
      {points.map((point, index) => {
        if (index === points.length - 1 || (dashed && index % 4 !== 0)) {
          return null;
        }

        const nextPoint = points[index + 1];
        const length = point.distanceTo(nextPoint);
        const angle = Math.atan2(nextPoint.x - point.x, nextPoint.z - point.z);
        const center = point.clone().add(nextPoint).multiplyScalar(0.5);

        return (
          <mesh key={`${point.x}-${point.z}-${index}`} receiveShadow position={[center.x, y, center.z]} rotation-y={angle}>
            <boxGeometry args={[width, 0.05, dashed ? Math.min(0.65, length * 0.65) : length + 0.05]} />
            <meshStandardMaterial color={color} roughness={0.88} />
          </mesh>
        );
      })}
    </group>
  );
}

function ParkingSpace({ slot, occupied, onClick }: { slot: SlotLayout; occupied: boolean; onClick: () => void }) {
  const color = occupied ? "#6a7377" : "#657074";

  return (
    <group position={[slot.x, 0.08, slot.z]} rotation-y={slot.rotation}>
      <mesh
        name={`parking-space-${slot.index}`}
        receiveShadow
        onPointerDown={(event) => {
          event.stopPropagation();
          if (!occupied) {
            onClick();
          }
        }}
      >
        <boxGeometry args={[2.5, 0.08, 1.56]} />
        <meshStandardMaterial color={color} roughness={0.78} />
      </mesh>
      <mesh position={[-1.22, 0.07, 0]}>
        <boxGeometry args={[0.06, 0.04, 1.45]} />
        <meshStandardMaterial color="#f1f4ef" />
      </mesh>
      <mesh position={[1.22, 0.07, 0]}>
        <boxGeometry args={[0.06, 0.04, 1.45]} />
        <meshStandardMaterial color="#f1f4ef" />
      </mesh>
      <mesh position={[0, 0.08, -0.73]}>
        <boxGeometry args={[2.42, 0.04, 0.06]} />
        <meshStandardMaterial color="#f1f4ef" />
      </mesh>
    </group>
  );
}

function Barrier({ open }: { open: boolean }) {
  const spring = useSpring({
    rotation: open ? 1.18 : 0,
    config: { tension: 155, friction: 18 }
  });

  return (
    <group position={BARRIER_POSITION}>
      <mesh castShadow position={[-0.15, 0.48, -1.05]}>
        <boxGeometry args={[0.44, 0.96, 0.44]} />
        <meshStandardMaterial color="#e8a947" roughness={0.52} />
      </mesh>
      <mesh castShadow position={[0.72, 0.56, 1.08]}>
        <boxGeometry args={[1.06, 1.12, 0.82]} />
        <meshStandardMaterial color="#e9b557" roughness={0.58} />
      </mesh>
      <mesh castShadow position={[0.72, 1.22, 1.08]}>
        <boxGeometry args={[1.22, 0.16, 0.96]} />
        <meshStandardMaterial color="#2a3436" roughness={0.5} />
      </mesh>
      <mesh position={[0.18, 0.72, 1.08]}>
        <boxGeometry args={[0.04, 0.34, 0.42]} />
        <meshStandardMaterial color="#79c6d6" roughness={0.2} />
      </mesh>
      <mesh position={[0.72, 0.72, 0.66]}>
        <boxGeometry args={[0.42, 0.34, 0.04]} />
        <meshStandardMaterial color="#79c6d6" roughness={0.2} />
      </mesh>
      <BoothAttendant />
      <a.group position={[-0.02, 0.92, -1.05]} rotation-z={spring.rotation}>
        <mesh castShadow position={[1.06, 0, 0]}>
          <boxGeometry args={[2.12, 0.08, 0.1]} />
          <meshStandardMaterial color="#f6f0df" roughness={0.44} />
        </mesh>
        {[0.12, 0.58, 1.04, 1.5, 1.96].map((x) => (
          <mesh key={x} position={[x, 0.005, 0.055]} rotation-z={0.55}>
            <boxGeometry args={[0.22, 0.085, 0.02]} />
            <meshStandardMaterial color="#e44949" />
          </mesh>
        ))}
      </a.group>
    </group>
  );
}

function BoothAttendant() {
  return (
    <group position={[0.72, 0.42, 1.05]}>
      <mesh castShadow position={[0, 0.44, 0]}>
        <sphereGeometry args={[0.14, 14, 10]} />
        <meshStandardMaterial color="#8b5f44" roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.22, 0]}>
        <boxGeometry args={[0.26, 0.28, 0.16]} />
        <meshStandardMaterial color="#2f86d8" roughness={0.55} />
      </mesh>
      <mesh castShadow position={[-0.06, -0.02, 0]}>
        <boxGeometry args={[0.08, 0.24, 0.08]} />
        <meshStandardMaterial color="#151a1f" roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0.06, -0.02, 0]}>
        <boxGeometry args={[0.08, 0.24, 0.08]} />
        <meshStandardMaterial color="#151a1f" roughness={0.7} />
      </mesh>
    </group>
  );
}

function EntranceProps() {
  return (
    <group>
      <mesh receiveShadow position={[-13.7, 0.04, 0]}>
        <boxGeometry args={[10.8, 0.08, 2.34]} />
        <meshStandardMaterial color="#2d3438" roughness={0.84} />
      </mesh>
      {[-18.0, -16.4, -14.8, -13.2, -11.6, -10.0].map((x) => (
        <mesh key={x} position={[x, 0.1, 0]}>
          <boxGeometry args={[0.72, 0.04, 0.08]} />
          <meshStandardMaterial color="#f4f1e8" />
        </mesh>
      ))}
      {[-18.4, -8.9].map((x) => (
        <mesh key={`edge-${x}`} position={[x, 0.11, -1.18]}>
          <boxGeometry args={[1.1, 0.04, 0.08]} />
          <meshStandardMaterial color="#f4f1e8" />
        </mesh>
      ))}
      {[-18.4, -8.9].map((x) => (
        <mesh key={`edge-plus-${x}`} position={[x, 0.11, 1.18]}>
          <boxGeometry args={[1.1, 0.04, 0.08]} />
          <meshStandardMaterial color="#f4f1e8" />
        </mesh>
      ))}
      {[-7, -3, 3, 7].map((x) => (
        <LampPost key={x} position={[x, 0, -8.25]} />
      ))}
      <mesh position={[-7.55, 0.12, 0.95]} rotation-x={-Math.PI / 2}>
        <boxGeometry args={[1.2, 0.02, 0.08]} />
        <meshStandardMaterial color="#f3e8c5" />
      </mesh>
    </group>
  );
}

function LampPost({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 1.5, 8]} />
        <meshStandardMaterial color="#d8ded9" metalness={0.2} roughness={0.35} />
      </mesh>
      <mesh castShadow position={[0.38, 1.48, 0]}>
        <boxGeometry args={[0.76, 0.08, 0.08]} />
        <meshStandardMaterial color="#d8ded9" />
      </mesh>
      <mesh position={[0.75, 1.42, 0]}>
        <sphereGeometry args={[0.12, 12, 8]} />
        <meshStandardMaterial color="#fff5cf" emissive="#f1d36b" emissiveIntensity={0.6} />
      </mesh>
      <pointLight position={[0.75, 1.35, 0]} intensity={0.45} distance={5.5} color="#ffe9a6" />
    </group>
  );
}

function PendingCar({ color, slotIndex }: { color: string; slotIndex: number }) {
  const spring = useSpring({
    from: { position: [ENTRANCE_POSITION[0] - 3, 0.34, ENTRANCE_POSITION[2]] as [number, number, number] },
    to: { position: [ENTRANCE_POSITION[0], 0.34, ENTRANCE_POSITION[2]] as [number, number, number] },
    config: { tension: 95, friction: 18 }
  });

  return (
    <a.group position={spring.position}>
      <Float speed={1.4} rotationIntensity={0.05} floatIntensity={0.08}>
        <LowPolyCar color={color} rotation={Math.PI} />
      </Float>
      <Html position={[0, 1.35, 0]} center className="pending-bubble">
        Waiting for save
        <span>Slot {slotIndex + 1}</span>
      </Html>
    </a.group>
  );
}

function IdeaCar({
  idea,
  activeOrder,
  selected,
  onClick
}: {
  idea: Idea;
  activeOrder: number;
  selected: boolean;
  onClick: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const slot = PARKING_SLOTS[idea.slotIndex];
  const slotPosition = getSlotPosition(idea.slotIndex);
  const parkedPosition = useMemo(() => new THREE.Vector3(...slotPosition), [slotPosition]);
  const entryCurve = useMemo(() => createCurve(getEntryPathToSlot(idea.slotIndex), false), [idea.slotIndex]);
  const activeCurve = useMemo(() => createCurve(ACTIVE_ROUTE, true), []);
  const spring = useSpring({
    scale: selected ? 1.12 : 1,
    config: { tension: 120, friction: 18 }
  });

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return;
    }

    const entryProgress = getEntryProgress(idea.createdAt);

    if (entryProgress < 1) {
      setObjectOnCurve(groupRef.current, entryCurve, entryProgress);
      return;
    }

    if (idea.status !== "active") {
      groupRef.current.position.lerp(parkedPosition, 0.09);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, slot.rotation, 0.09);
      return;
    }

    const progress = (clock.elapsedTime * 0.035 + activeOrder * 0.13) % 1;
    setObjectOnCurve(groupRef.current, activeCurve, progress);
  });

  return (
    <a.group
      ref={groupRef}
      position={ENTRY_ROUTE[0]}
      scale={spring.scale}
      rotation-y={Math.PI}
      onPointerDown={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onPointerEnter={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
    >
      <LowPolyCar color={idea.carColor} />
      {selected || hovered ? (
        <Html position={[0, 1.32, 0]} center className={idea.status === "active" ? "selected-bubble active-bubble" : "selected-bubble"}>
          {idea.title}
        </Html>
      ) : null}
    </a.group>
  );
}

function LowPolyCar({ color, rotation = 0 }: { color: string; rotation?: number }) {
  return (
    <group rotation-y={rotation}>
      <mesh receiveShadow position={[0, 0.025, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.68, 24]} />
        <meshBasicMaterial color="#1e2427" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh castShadow position={[0, 0.24, 0]}>
        <boxGeometry args={[1.35, 0.38, 0.72]} />
        <meshStandardMaterial color={color} roughness={0.58} />
      </mesh>
      <mesh castShadow position={[0.04, 0.55, -0.02]}>
        <boxGeometry args={[0.72, 0.34, 0.58]} />
        <meshStandardMaterial color={color} roughness={0.62} />
      </mesh>
      <mesh position={[0.08, 0.57, -0.31]}>
        <boxGeometry args={[0.48, 0.18, 0.03]} />
        <meshStandardMaterial color="#30464e" roughness={0.22} />
      </mesh>
      <mesh position={[0.08, 0.57, 0.31]}>
        <boxGeometry args={[0.48, 0.18, 0.03]} />
        <meshStandardMaterial color="#30464e" roughness={0.22} />
      </mesh>
      {[-0.42, 0.42].map((x) =>
        [-0.42, 0.42].map((z) => (
          <mesh key={`${x}-${z}`} castShadow position={[x, 0.07, z]} rotation-x={Math.PI * 0.5}>
            <cylinderGeometry args={[0.16, 0.16, 0.11, 16]} />
            <meshStandardMaterial color="#1e2427" roughness={0.6} />
          </mesh>
        ))
      )}
      <mesh position={[-0.71, 0.22, -0.2]}>
        <boxGeometry args={[0.035, 0.08, 0.15]} />
        <meshStandardMaterial color="#f5d778" emissive="#c69228" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[-0.71, 0.22, 0.2]}>
        <boxGeometry args={[0.035, 0.08, 0.15]} />
        <meshStandardMaterial color="#f5d778" emissive="#c69228" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
