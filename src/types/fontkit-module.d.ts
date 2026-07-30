declare module 'fontkit' {
  // Ambient modules cannot use relative imports. Keep this aligned with the
  // sync `create` API of upstream `fontkit` / structural `Fontkit` in
  // `types/fontkit.ts` (return is intentionally loose for assignability).
  const fontkit: {
    create(buffer: Uint8Array, postscriptName?: string): any;
  };
  export default fontkit;
}
