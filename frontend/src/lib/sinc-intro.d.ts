export type SincIntroMode = "auto" | "welcome" | "intro" | "quick";
export type SincIntroResult = "played" | "skipped" | "not-needed";

export interface SincIntroOptions {
  /** "auto" (default): welcome film on this browser's very first visit, then `returningMode` once per tab session. */
  mode?: SincIntroMode;
  /** What "auto" plays on every visit after the first. Default "quick" (2 s); "intro" = 5.2 s. */
  returningMode?: "quick" | "intro";
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

/** Call on logout so the next login in the same tab plays the animation again. */
export function resetSincIntroSession(options?: Pick<SincIntroOptions, "sessionKey">): void;

export function createSincIntroRenderer(
  images: CanvasImageSource[],
  options?: {
    mode?: "welcome" | "intro" | "quick";
    fontFamily?: string;
    background?: string;
    makeCanvas?: (w: number, h: number) => HTMLCanvasElement | OffscreenCanvas;
  }
): {
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, timeSeconds: number): void;
  duration: number;
  mode: "welcome" | "intro" | "quick";
};
