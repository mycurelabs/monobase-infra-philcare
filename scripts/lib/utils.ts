/**
 * Shared utility functions for all scripts
 */

import { randomBytes } from "crypto";
import { resolve, basename, dirname } from "path";

/**
 * Generate a secure random password
 */
export function generatePassword(length: number = 32): string {
  return randomBytes(length).toString("base64").slice(0, length);
}

/**
 * Generate a secure random key (hex format)
 */
export function generateKey(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

/**
 * Infer deployment name from a secrets.yaml file path.
 *
 * Two layouts are supported:
 *   - Cluster-scoped infrastructure secrets:
 *       values/clusters/<cluster>/argocd/secrets.yaml → "infrastructure"
 *     (cluster-wide services; secrets carry their own targetNamespace, so the
 *      inferred default namespace is cross-namespace / undefined.)
 *   - Per-deployment secrets:
 *       values/deployments/<name>-<env>.yaml → <name>-<env>
 */
export function inferDeploymentName(filePath: string): string {
  const normalized = resolve(filePath);
  const dir = dirname(normalized);
  const dirName = basename(dir);
  const parentDir = basename(dirname(dir));

  // Cluster-scoped secrets: values/clusters/<cluster>/argocd/secrets.yaml
  // Treat like the old cluster-wide "infrastructure" bucket (cross-namespace).
  if (dirName === "argocd" && basename(dirname(dirname(dir))) === "clusters") {
    return "infrastructure";
  }

  // Per-deployment overlay: values/deployments/<name>-<env>.yaml
  // The deployment name is the filename (minus extension), e.g. mycure-staging.
  if (dirName === "deployments") {
    return basename(normalized).replace(/\.ya?ml$/, "");
  }

  // Fallback to directory name.
  return dirName;
}

/**
 * Infer target namespace from deployment name.
 * "infrastructure" → undefined (cross-namespace)
 * mycure-staging   → mycure-staging
 */
export function inferNamespace(deploymentName: string): string | undefined {
  if (deploymentName === "infrastructure") {
    return undefined;
  }
  return deploymentName;
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
