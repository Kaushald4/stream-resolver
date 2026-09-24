export type AltchaChallenge = {
  algorithm: string;
  challenge: string;
  salt: string;
  signature: string;
  maxnumber: number;
};

export type VidukiServer = {
  name: string;
  language?: string;
};

export type VidukiPepperKey = {
  bucket: number;
  iv: string;
  ct: string;
  tag: string;
  error?: string;
};

export type VidukiEnvelope = {
  sn: string;
  tb: number;
  iv1: string;
  iv2: string;
  wk: string;
  tag1: string;
  tag2: string;
  ct: string;
  error?: string;
};

export type VidukiBootstrap = {
  n?: string;
};

export type VidukiDecryptedPayload = {
  stream?: { url?: string; file?: string; src?: string; headers?: Record<string, string> };
  url?: string;
  file?: string;
  src?: string;
  headers?: Record<string, string>;
  error?: string;
};

export type VidukiDiscoveryMeta = {
  tmdbId: string;
  kind: "movie" | "episode";
  servers: VidukiServer[];
  season?: number;
  episode?: number;
};

export type VidukiSessionMeta = VidukiDiscoveryMeta & {
  sessionNonce: string;
  altchaHeader: string;
};
