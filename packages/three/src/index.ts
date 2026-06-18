// This is the only package allowed to expose Three.js. Replace its dependency
// with the maintained fork without changing app or engine imports.
export * from "three"
export { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js"
