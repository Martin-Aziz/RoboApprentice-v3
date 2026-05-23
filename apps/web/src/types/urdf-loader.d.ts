declare module "urdf-loader" {
  import type { LoadingManager, Object3D } from "three";

  export default class URDFLoader {
    constructor(manager?: LoadingManager);
    packages: string | Record<string, string>;
    load(url: string, onLoad: (robot: Object3D & { joints?: Record<string, URDFJoint> }) => void, onProgress?: (event: ProgressEvent) => void, onError?: (event: unknown) => void): void;
  }

  export interface URDFJoint extends Object3D {
    jointType: string;
    limit?: { lower?: number; upper?: number };
    setJointValue: (value: number) => void;
    jointValue?: number[];
  }
}
