import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

import { Spinner } from '@/src/components/ui/spinner';

const { width: W, height: H } = Dimensions.get('window');
const CONTAINER = Math.min(W * 0.85, 320);
const S = CONTAINER / 520;
const BOOT_BACKGROUND = '#08060F';

interface AnimatedSplashProps {
  readonly onFinish: () => void;
}

// ── Planet Arm ───────────────────────────────────────────────────────────
// Uses setInterval + setState for reliable cross-platform rotation.

function PlanetArm({
  orbitRadius,
  duration,
  startDeg,
  planetSize,
  planetColor,
  glowColor,
  containerSize,
}: {
  readonly orbitRadius: number;
  readonly duration: number;
  readonly startDeg: number;
  readonly planetSize: number;
  readonly planetColor: string;
  readonly glowColor: string;
  readonly containerSize: number;
}) {
  const [deg, setDeg] = useState(startDeg);
  const degRef = useRef(startDeg);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const degsPerMs = 360 / duration;

    const id = setInterval(() => {
      const now = Date.now();
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
        return;
      }
      const elapsed = now - lastTimeRef.current;
      lastTimeRef.current = now;
      degRef.current = (degRef.current + degsPerMs * elapsed) % 360;
      setDeg(degRef.current);
    }, 16);

    return () => clearInterval(id);
  }, [duration]);

  const rad = (deg * Math.PI) / 180;
  const x = orbitRadius * Math.cos(rad);
  const y = orbitRadius * Math.sin(rad);

  return (
    <View
      style={{
        backgroundColor: planetColor,
        borderRadius: planetSize / 2,
        elevation: 8,
        height: planetSize,
        left: containerSize / 2 + x - planetSize / 2,
        position: 'absolute',
        shadowColor: glowColor,
        shadowOffset: { height: 0, width: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 8,
        top: containerSize / 2 + y - planetSize / 2,
        width: planetSize,
      }}
    />
  );
}

// ── Nolancode screen ───────────────────────────────────────────────────────
// Daniel's cross-app developer bumper -- kept visually identical to the one
// in Gym Buddies rather than reinvented per app.

function NolancodeScreen({ opacity }: { readonly opacity: Animated.Value }) {
  const startDegs = useMemo(
    () => [
      Math.random() * 360,
      Math.random() * 360,
      Math.random() * 360,
      Math.random() * 360,
    ],
    [],
  );

  const sunSize = Math.round(160 * S);
  const sunR = sunSize / 2;
  const fontSize = Math.round(34 * S);

  const sunScreenCx = W / 2;
  const sunScreenCy = H / 2;

  const orbits = [
    { bOpacity: 0.45, color: '#67E8F9', dur: 13000, glow: '#67E8F9', pSize: Math.round(14 * S), r: Math.round(115 * S) },
    { bOpacity: 0.3, color: '#94A3B8', dur: 21000, glow: '#94A3B8', pSize: Math.round(18 * S), r: Math.round(160 * S) },
    { bOpacity: 0.2, color: '#22D3EE', dur: 32000, glow: '#22D3EE', pSize: Math.round(14 * S), r: Math.round(205 * S) },
    { bOpacity: 0.13, color: '#94A3B8', dur: 46000, glow: '#adb5bd', pSize: Math.round(10 * S), r: Math.round(255 * S) },
  ];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: BOOT_BACKGROUND, opacity }]}>
      <View
        style={{
          alignItems: 'center',
          height: CONTAINER,
          justifyContent: 'center',
          left: sunScreenCx - CONTAINER / 2,
          position: 'absolute',
          top: sunScreenCy - CONTAINER / 2,
          transform: [{ skewX: '-20deg' }],
          width: CONTAINER,
        }}
      >
        {orbits.map((o, i) => (
          <View
            key={`ring-${i}`}
            style={{
              borderColor: `rgba(103,232,249,${o.bOpacity})`,
              borderRadius: o.r,
              borderWidth: 1,
              height: o.r * 2,
              position: 'absolute',
              width: o.r * 2,
            }}
          />
        ))}

        {orbits.map((o, i) => (
          <PlanetArm
            containerSize={CONTAINER}
            duration={o.dur}
            glowColor={o.glow}
            key={`arm-${i}`}
            orbitRadius={o.r}
            planetColor={o.color}
            planetSize={o.pSize}
            startDeg={startDegs[i]}
          />
        ))}

        <View
          style={{
            borderRadius: sunR,
            elevation: 10,
            height: sunSize,
            overflow: 'hidden',
            position: 'absolute',
            shadowColor: '#67E8F9',
            shadowOffset: { height: 0, width: 0 },
            shadowOpacity: 1,
            shadowRadius: 35,
            transform: [{ skewX: '20deg' }],
            width: sunSize,
          }}
        >
          <View style={{ backgroundColor: '#1BB8CC', height: sunSize, position: 'absolute', width: sunSize }} />
          <View style={{ backgroundColor: 'rgba(180,245,255,0.12)', borderRadius: sunSize * 0.5, height: sunSize, left: 0, position: 'absolute', top: 0, width: sunSize }} />
          <View style={{ backgroundColor: 'rgba(200,250,255,0.15)', borderRadius: sunSize * 0.41, height: sunSize * 0.82, left: sunSize * 0.08, position: 'absolute', top: sunSize * 0.04, width: sunSize * 0.82 }} />
          <View style={{ backgroundColor: 'rgba(220,252,255,0.18)', borderRadius: sunSize * 0.32, height: sunSize * 0.64, left: sunSize * 0.14, position: 'absolute', top: sunSize * 0.1, width: sunSize * 0.64 }} />
          <View style={{ backgroundColor: 'rgba(240,254,255,0.2)', borderRadius: sunSize * 0.23, height: sunSize * 0.46, left: sunSize * 0.2, position: 'absolute', top: sunSize * 0.17, width: sunSize * 0.46 }} />
          <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: sunSize * 0.15, height: sunSize * 0.3, left: sunSize * 0.26, position: 'absolute', top: sunSize * 0.24, width: sunSize * 0.3 }} />
          <View style={{ backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: sunSize * 0.075, height: sunSize * 0.15, left: sunSize * 0.31, position: 'absolute', top: sunSize * 0.31, width: sunSize * 0.15 }} />
        </View>
      </View>

      <Text
        style={{
          color: 'rgba(248,250,252,0.98)',
          fontFamily: 'DuneRise',
          fontSize,
          position: 'absolute',
          right: W - sunScreenCx + sunR + Math.round(6 * S),
          textShadowColor: 'rgba(103,232,249,0.9)',
          textShadowOffset: { height: 0, width: 0 },
          textShadowRadius: 10,
          top: sunScreenCy - fontSize * 0.65,
        }}
      >
        N
      </Text>

      <Text
        style={{
          color: 'rgba(248,250,252,0.98)',
          fontFamily: 'DuneRise',
          fontSize,
          left: sunScreenCx + Math.round(4 * S),
          position: 'absolute',
          textShadowColor: 'rgba(103,232,249,0.9)',
          textShadowOffset: { height: 0, width: 0 },
          textShadowRadius: 10,
          top: sunScreenCy - fontSize * 0.65,
        }}
      >
        LANCODE
      </Text>

      <Text
        style={{
          bottom: H * 0.16,
          color: 'rgba(103,232,249,0.5)',
          fontFamily: 'DuneRise',
          fontSize: 9,
          left: 0,
          letterSpacing: 6,
          position: 'absolute',
          right: 0,
          textAlign: 'center',
        }}
      >
        BUILD · SHIP · REPEAT
      </Text>
    </Animated.View>
  );
}

// ── Brand screen ─────────────────────────────────────────────────────────

function BrandSplashScreen({ opacity }: { readonly opacity: Animated.Value }) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: BOOT_BACKGROUND, opacity }]}>
      <View style={styles.brandContent}>
        <View style={styles.cactusScale}>
          <Spinner aria-label="eLLVate" size="xlarge" />
        </View>
        <Text style={styles.brandTitle}>
          e<Text style={styles.brandTitleAccent}>LLV</Text>ate
        </Text>
        <Text style={styles.brandTagline}>Connect. Discover. Belong.</Text>
      </View>
    </Animated.View>
  );
}

// ── Main splash ──────────────────────────────────────────────────────────

// The boot-time brand sequence: a beat on the dancing-cactus/eLLVate
// mark, a crossfade into the Nolancode bumper, then a fade to the
// real app. Assumes its fonts (DuneRise included) are already loaded by the
// caller -- see useAppFonts -- so it has nothing to gate on itself.
export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const brandOpacity = useRef(new Animated.Value(1)).current;
  const nolanOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Both holds are equal (1650ms) so eLLVate and the Nolancode bumper get
    // even screen time -- they previously didn't (1500ms vs 1800ms).
    Animated.sequence([
      Animated.delay(1650),
      Animated.parallel([
        Animated.timing(brandOpacity, { duration: 400, toValue: 0, useNativeDriver: true }),
        Animated.timing(nolanOpacity, { duration: 400, toValue: 1, useNativeDriver: true }),
      ]),
      Animated.delay(1650),
      Animated.timing(nolanOpacity, { duration: 350, toValue: 0, useNativeDriver: true }),
    ]).start(() => onFinish());
    // Runs once: the sequence owns its own lifecycle from mount to onFinish.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: BOOT_BACKGROUND }]}>
      <BrandSplashScreen opacity={brandOpacity} />
      <NolancodeScreen opacity={nolanOpacity} />
    </View>
  );
}

const styles = StyleSheet.create({
  brandContent: {
    alignItems: 'center',
    flex: 1,
    gap: 20,
    justifyContent: 'center',
  },
  brandTagline: {
    color: 'rgba(201,138,58,0.7)',
    fontFamily: 'Fraunces_300Light_Italic',
    fontSize: 15,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  brandTitle: {
    color: 'rgb(244,239,224)',
    fontFamily: 'Rye_400Regular',
    fontSize: 30,
    letterSpacing: 0.5,
  },
  brandTitleAccent: {
    color: '#7fc3c7',
  },
  cactusScale: {
    transform: [{ scale: 1.8 }],
  },
});
