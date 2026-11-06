/**
 * Client-side ONNX runtime inference module for Data On-Call v2.
 *
 * Implements AC9 and AC10:
 * - Loads model.onnx and config.json from VITE_MODEL_BASE_URL (defaults to '/model/').
 * - Serves WASM locally from '/ort/' (single-threaded).
 * - Exposes predictRisk(features) -> probability of chose_risky=1.
 * - Fails gracefully on any error (returns null, enabling pure v1 behavior).
 */

import * as ort from 'onnxruntime-web';
import { PlayerLevel, PlayerGoal } from './rules.ts';
import { mapLevelToCode, mapGoalToCode } from './telemetry.ts';

// Configure local WASM assets (never load from external CDN)
if (typeof ort !== 'undefined' && ort?.env?.wasm) {
  ort.env.wasm.wasmPaths = '/ort/';
  ort.env.wasm.numThreads = 1;
}

export interface ModelConfig {
  features: string[];
  target: string;
  gate_threshold: number;
  decision_cutoff: number;
  [key: string]: unknown;
}

let cachedSessionPromise: Promise<ort.InferenceSession | null> | null = null;
let cachedConfigPromise: Promise<ModelConfig | null> | null = null;
let inferenceQueue = Promise.resolve();

export function getModelBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_MODEL_BASE_URL as string | undefined)?.trim();
  const base = envUrl || '/model/';
  return base.endsWith('/') ? base : `${base}/`;
}

export async function fetchModelConfig(): Promise<ModelConfig | null> {
  if (cachedConfigPromise) {
    return cachedConfigPromise;
  }
  cachedConfigPromise = (async () => {
    try {
      const baseUrl = getModelBaseUrl();
      const res = await fetch(`${baseUrl}config.json`);
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as ModelConfig;
    } catch {
      return null;
    }
  })();
  return cachedConfigPromise;
}

export async function getInferenceSession(): Promise<ort.InferenceSession | null> {
  if (cachedSessionPromise) {
    return cachedSessionPromise;
  }
  cachedSessionPromise = (async () => {
    try {
      const baseUrl = getModelBaseUrl();
      const session = await ort.InferenceSession.create(`${baseUrl}model.onnx`, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      return session;
    } catch (err) {
      console.warn('[model] Failed to load ONNX inference session:', err);
      return null;
    }
  })();
  return cachedSessionPromise;
}

/**
 * Predict risk probability P(chose_risky = 1) for a 7-element feature vector.
 * Features must be in exact order:
 * [level, goal, scene_no, prev_hints_used, prev_risky_count, prev_timeout_count, prev_decision_time_sec]
 *
 * Calls are serialized to avoid concurrent WASM context collisions.
 * Returns null if model loading or inference fails for any reason (v1 fallback).
 */
export async function predictRisk(features: number[]): Promise<number | null> {
  if (!features || features.length !== 7) {
    return null;
  }

  return new Promise((resolve) => {
    inferenceQueue = inferenceQueue
      .then(async () => {
        try {
          const session = await getInferenceSession();
          if (!session) {
            resolve(null);
            return;
          }

          const floatArray = new Float32Array(features);
          const tensor = new ort.Tensor('float32', floatArray, [1, 7]);
          const feeds: Record<string, ort.Tensor> = { input: tensor };

          const outputMap = await session.run(feeds);
          const probTensor = outputMap['probabilities'] || Object.values(outputMap)[1];

          if (!probTensor || !probTensor.data || probTensor.data.length < 2) {
            resolve(null);
            return;
          }

          const probClass1 = Number(probTensor.data[1]);
          resolve(Number.isFinite(probClass1) ? probClass1 : null);
        } catch (err) {
          console.warn('[model] Inference execution failed:', err);
          resolve(null);
        }
      })
      .catch(() => resolve(null));
  });
}

/**
 * Reset cached session (useful in tests when simulating loading failure).
 */
export function resetModelCache(): void {
  cachedSessionPromise = null;
  cachedConfigPromise = null;
}

/**
 * Build 7-feature vector from current game state at scene start.
 * Adheres strictly to spec.md §10.2 and data/DATA_DICTIONARY.md order.
 */
export function buildSceneFeatures(params: {
  level: PlayerLevel | number;
  goal: PlayerGoal | number;
  sceneNo: number;
  prevHintsUsed: number;
  prevRiskyCount: number;
  prevTimeoutCount: number;
  prevDecisionTimeSec: number;
}): number[] {
  const levelCode =
    typeof params.level === 'number' ? params.level : mapLevelToCode(params.level);
  const goalCode =
    typeof params.goal === 'number' ? params.goal : mapGoalToCode(params.goal);

  return [
    levelCode,
    goalCode,
    params.sceneNo,
    params.prevHintsUsed,
    params.prevRiskyCount,
    params.prevTimeoutCount,
    Number(params.prevDecisionTimeSec.toFixed(2)),
  ];
}
