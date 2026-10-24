export type SincIntroMode = "auto" | "welcome" | "intro";
export type SincIntroResult = "played" | "skipped" | "not-needed";

export interface SincIntroOptions {
  /** "auto" (default): welcome film on this browser's first login, short intro once per session after. */
  mode?: SincIntroMode;
  /** Folder (URL) holding sinc-piece-1..6.webp. Default "/sinc-intro/". */
  assetsBase?: string;
  ext?: string;
  zIndex?: number;
  background?: string;
  fontFamily?: string;
  /** Inject the Inter stylesheet from Google Fonts. Set false if self-hosting Inter or CSP blocks it. */
  loadGoogleFont?: boolean;
  welcomeKey?: string;
  sessionKey?: string;
  respectReducedMotion?: boolean;
  onDone?: (result: SincIntroResult) => void;
}

export function playSincIntro(options?: SincIntroOptions): Promise<SincIntroResult>;

export function createSincIntroRenderer(
  images: CanvasImageSource[],
  options?: {
    mode?: "welcome" | "intro";
    fontFamily?: string;
    background?: string;
    makeCanvas?: (w: number, h: number) => HTMLCanvasElement | OffscreenCanvas;
  }
): {
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, timeSeconds: number): void;
  duration: number;
  mode: "welcome" | "intro";
};
