// Reusable GLTF/GLB model-loading architecture. Configured once with DRACO + Meshopt
// decoding so any compressed .glb dropped into /public/models works without further setup —
// swap PLANT_MODEL_URL (or pass a url to loadModel) to bring in a real agricultural/terrain/
// plant asset later. Until then, callers fall back to a procedural placeholder.
import {
  LoadingManager,
  type Object3D,
  type Group,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

let sharedLoader: GLTFLoader | null = null;

/** one GLTFLoader, lazily created and reused across calls, with DRACO (Google's hosted
 * decoder — no local decoder files to ship) and Meshopt decoding both wired in. */
function getLoader(manager?: LoadingManager): GLTFLoader {
  if (sharedLoader && !manager) return sharedLoader;

  const draco = new DRACOLoader(manager);
  draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  draco.setDecoderConfig({ type: "wasm" });

  const loader = new GLTFLoader(manager);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);

  if (!manager) sharedLoader = loader;
  return loader;
}

export type LoadedModel = {
  scene: Group;
  /** call once the model (and its geometries/materials/textures) is no longer needed */
  dispose: () => void;
};

/** loads a compressed .glb/.gltf, returning its root scene graph plus a dispose() that
 * frees every geometry/material/texture it owns. Rejects on failure — callers should catch
 * and fall back to a procedural placeholder rather than leaving a blank scene. */
export function loadModel(url: string, onProgress?: (fraction: number) => void): Promise<LoadedModel> {
  return new Promise((resolve, reject) => {
    getLoader().load(
      url,
      (gltf) => {
        const root = gltf.scene;
        root.traverse((obj: Object3D) => {
          const mesh = obj as Object3D & { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean };
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        resolve({
          scene: root,
          dispose: () => {
            root.traverse((obj: Object3D) => {
              const mesh = obj as Object3D & {
                isMesh?: boolean;
                geometry?: { dispose?: () => void };
                material?: unknown;
              };
              if (!mesh.isMesh) return;
              mesh.geometry?.dispose?.();
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              mats.forEach((m) => {
                const mat = m as { dispose?: () => void; map?: { dispose?: () => void } } | undefined;
                mat?.map?.dispose?.();
                mat?.dispose?.();
              });
            });
          },
        });
      },
      onProgress ? (evt) => onProgress(evt.total ? evt.loaded / evt.total : 0) : undefined,
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
}
