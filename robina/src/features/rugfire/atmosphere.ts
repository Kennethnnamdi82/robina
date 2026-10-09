import * as T from 'three';

/** Small procedural sky supplies both the horizon and reflections for metal assets. */
export function districtSky(scene: T.Scene) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#263c54'); sky.addColorStop(.35, '#70848c');
  sky.addColorStop(.51, '#c4b49d'); sky.addColorStop(.58, '#6a756a'); sky.addColorStop(1, '#202c30');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 256);
  const sun = ctx.createRadialGradient(375, 108, 0, 375, 108, 72);
  sun.addColorStop(0, '#fff0c1'); sun.addColorStop(.08, '#e9d5b3'); sun.addColorStop(1, '#e9d5b300');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, 512, 256);
  const texture = new T.CanvasTexture(canvas); texture.mapping = T.EquirectangularReflectionMapping; texture.colorSpace = T.SRGBColorSpace;
  scene.background = texture; scene.environment = texture; scene.environmentIntensity = .45;
  scene.fog = new T.FogExp2(0x88918d, .009);
  return texture;
}
