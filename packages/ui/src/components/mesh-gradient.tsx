"use client";

import { cn } from "@fuutu/utils/cn";
import { Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef } from "react";

const VERTEX = /* glsl */ `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

uniform vec2  iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uWarpStr;
uniform float uWarpFreq;
uniform float uWarpAmp;
uniform float uRotation;
uniform float uNoiseScale;
uniform float uGrain;
uniform float uContrast;
uniform float uSaturation;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;

out vec4 fragColor;

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(2127.1, 81.17)), dot(p, vec2(1269.5, 283.37)));
  return fract(sin(p) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(-1.0 + 2.0 * hash2(i),             f),
        dot(-1.0 + 2.0 * hash2(i + vec2(1,0)), f - vec2(1,0)), u.x),
    mix(dot(-1.0 + 2.0 * hash2(i + vec2(0,1)), f - vec2(0,1)),
        dot(-1.0 + 2.0 * hash2(i + vec2(1,1)), f - vec2(1,1)), u.x),
    u.y) * 0.5 + 0.5;
}

void main() {
  float t    = iTime * uSpeed;
  vec2  uv   = gl_FragCoord.xy / iResolution;
  float ar   = iResolution.x / iResolution.y;
  vec2  tuv  = uv - 0.5;
  tuv.x     *= ar;

  float deg  = noise(tuv * uNoiseScale + t * 0.1);
  tuv       *= rot(radians((deg - 0.5) * uRotation + 180.0));
  tuv.x     /= ar;

  tuv.x += sin(tuv.y * uWarpFreq + t * 1.5) / (uWarpAmp / max(uWarpStr, 0.001));
  tuv.y += sin(tuv.x * uWarpFreq * 1.5 + t * 1.5) / (uWarpAmp * 0.5 / max(uWarpStr, 0.001));

  float bx   = tuv.x;
  vec3  layA = mix(uColor3, uColor2, smoothstep(-0.35, 0.25, bx));
  vec3  layB = mix(uColor2, uColor1, smoothstep(-0.35, 0.25, bx));
  vec3  col  = mix(layA, layB, smoothstep(0.55, -0.35, tuv.y));

  float grain = fract(sin(dot(uv * max(2.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
  col += (grain - 0.5) * uGrain;

  col  = (col - 0.5) * uContrast + 0.5;
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col  = mix(vec3(luma), col, uSaturation);
  col  = clamp(col, 0.0, 1.0);

  fragColor = vec4(col, 1.0);
}`;

function hexToVec3(hex: string): [number, number, number] {
	const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!r?.[1] || !r[2] || !r[3]) return [0.47, 0.15, 0.87];
	return [
		Number.parseInt(r[1], 16) / 255,
		Number.parseInt(r[2], 16) / 255,
		Number.parseInt(r[3], 16) / 255,
	];
}

function cssVarToHex(varName: string, fallback: string): string {
	if (typeof window === "undefined") return fallback;
	const raw = getComputedStyle(document.documentElement)
		.getPropertyValue(varName)
		.trim();
	return raw || fallback;
}

export interface MeshGradientProps {
	/**
	 * Primary color (hex or CSS custom property, e.g. `"var(--primary)"`).
	 * Defaults to the `--primary` theme token resolved at runtime.
	 */
	color1?: string;
	/** Secondary color (hex). Defaults to `--secondary` theme token. */
	color2?: string;
	/** Third color (hex). Defaults to `--background` theme token. */
	color3?: string;
	/** Animation speed multiplier. @default 0.25 */
	speed?: number;
	/** Warp distortion strength. @default 1 */
	warpStrength?: number;
	/** Warp frequency. @default 5 */
	warpFrequency?: number;
	/** Warp amplitude. @default 50 */
	warpAmplitude?: number;
	/** Rotation noise amount. @default 500 */
	rotation?: number;
	/** Noise scale. @default 2 */
	noiseScale?: number;
	/** Film grain amount (0–1). @default 0.08 */
	grain?: number;
	/** Contrast boost. @default 1.4 */
	contrast?: number;
	/** Color saturation. @default 1 */
	saturation?: number;
	/** Overall opacity (0–1). @default 1 */
	opacity?: number;
	/** className for position/size/z-index. */
	className?: string;
}

/**
 * MeshGradient — WebGL2 animated gradient with film grain.
 *
 * ```tsx
 * <section className="relative overflow-hidden">
 *   <MeshGradient className="absolute inset-0 -z-10" />
 * </section>
 *
 * <Card className="relative overflow-hidden">
 *   <MeshGradient className="absolute inset-0 -z-10" grain={0.05} opacity={0.6} />
 * </Card>
 * ```
 */
export function MeshGradient({
	color1,
	color2,
	color3,
	speed = 0.25,
	warpStrength = 1,
	warpFrequency = 5,
	warpAmplitude = 50,
	rotation = 500,
	noiseScale = 2,
	grain = 0.08,
	contrast = 1.4,
	saturation = 1,
	opacity = 1,
	className,
}: MeshGradientProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const renderer = new Renderer({
			webgl: 2,
			alpha: true,
			antialias: false,
			dpr: Math.min(window.devicePixelRatio || 1, 2),
		});

		const gl = renderer.gl;
		const canvas = gl.canvas as HTMLCanvasElement;
		canvas.style.display = "block";
		container.appendChild(canvas);

		const geometry = new Triangle(gl);

		type Uniforms = {
			iTime: { value: number };
			iResolution: { value: Float32Array };
			uSpeed: { value: number };
			uWarpStr: { value: number };
			uWarpFreq: { value: number };
			uWarpAmp: { value: number };
			uRotation: { value: number };
			uNoiseScale: { value: number };
			uGrain: { value: number };
			uContrast: { value: number };
			uSaturation: { value: number };
			uColor1: { value: Float32Array };
			uColor2: { value: Float32Array };
			uColor3: { value: Float32Array };
		};

		const uniforms: Uniforms = {
			iTime: { value: 0 },
			iResolution: { value: new Float32Array([1, 1]) },
			uSpeed: { value: speed },
			uWarpStr: { value: warpStrength },
			uWarpFreq: { value: warpFrequency },
			uWarpAmp: { value: warpAmplitude },
			uRotation: { value: rotation },
			uNoiseScale: { value: noiseScale },
			uGrain: { value: grain },
			uContrast: { value: contrast },
			uSaturation: { value: saturation },
			uColor1: {
				value: new Float32Array(
					hexToVec3(color1 ?? cssVarToHex("--primary", "#7c3aed")),
				),
			},
			uColor2: {
				value: new Float32Array(
					hexToVec3(color2 ?? cssVarToHex("--secondary", "#ec4899")),
				),
			},
			uColor3: {
				value: new Float32Array(
					hexToVec3(color3 ?? cssVarToHex("--background", "#4f46e5")),
				),
			},
		};

		const program = new Program(gl, {
			vertex: VERTEX,
			fragment: FRAGMENT,
			uniforms,
		});

		const mesh = new Mesh(gl, { geometry, program });

		const setSize = () => {
			const rect = container.getBoundingClientRect();
			const w = Math.max(1, Math.floor(rect.width));
			const h = Math.max(1, Math.floor(rect.height));
			renderer.setSize(w, h);
			// ogl overwrites canvas CSS size on setSize — restore fluid sizing
			canvas.style.width = "100%";
			canvas.style.height = "100%";
			uniforms.iResolution.value[0] = gl.drawingBufferWidth;
			uniforms.iResolution.value[1] = gl.drawingBufferHeight;
		};

		const ro = new ResizeObserver(setSize);
		ro.observe(container);
		setSize();
		// Re-measure after first paint so layout is fully resolved
		requestAnimationFrame(setSize);

		let raf = 0;
		const t0 = performance.now();

		const loop = (t: number) => {
			uniforms.iTime.value = (t - t0) * 0.001;
			renderer.render({ scene: mesh });
			raf = requestAnimationFrame(loop);
		};

		raf = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			try {
				container.removeChild(canvas);
			} catch {
				// already removed
			}
		};
	}, [
		color1 ?? null,
		color2 ?? null,
		color3 ?? null,
		speed,
		warpStrength,
		warpFrequency,
		warpAmplitude,
		rotation,
		noiseScale,
		grain,
		contrast,
		saturation,
	]);

	return (
		<div
			ref={containerRef}
			aria-hidden
			className={cn(
				"pointer-events-none select-none overflow-hidden",
				className,
			)}
			style={{
				opacity,
				position: "absolute",
				inset: 0,
			}}
		/>
	);
}
