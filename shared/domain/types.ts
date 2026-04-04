export type MatchType = "singles" | "doubles";
export type MatchCategory = "rec" | "league" | "tournament";
export type MatchFormat = "standard" | "rally" | "mto";
export type MatchEnvironment = "indoor" | "outdoor";
export type GenderFormat = "open" | "mens" | "womens" | "mixed";
export type MatchResult = "win" | "loss";
export type ScoreLabel = "Go compete" | "Good for rec" | "Light session" | "Rest day";
export type ReadinessConfidence = "high" | "medium" | "low";
export type PhysicalReadinessSource = "whoop" | "checkin" | "fallback";

export interface ChangeExplanation {
  factor: string;
  impact: number;
  description: string;
}

export interface MatchPerson {
  name: string;
  duprId?: string;
  userId?: string;
  rating?: number;
}

export interface MatchGame {
  myScore: number;
  opponentScore: number;
}

export interface MatchRecord {
  id: string;
  date: string;
  matchType: MatchType;
  category: MatchCategory;
  format: MatchFormat;
  environment: MatchEnvironment;
  genderFormat: GenderFormat;
  opponents: MatchPerson[];
  partner?: MatchPerson;
  games: MatchGame[];
  result: MatchResult;
  notes: string;
  verified: boolean;
  verifiedBy: string[];
  readinessAtTime: number;
  postMatchInsight: string;
  createdAt: string;
  opponentAverageRating?: number;
  recScoreDelta?: number;
  recScoreAfter?: number;
}

export interface WhoopMetrics {
  recoveryScore: number;
  hrvRmssd: number;
  restingHeartRate: number;
  sleepPerformance: number;
  sleepDurationMs: number;
  strain: number;
  cycleId: string;
  steps?: number;
}

export interface WhoopBaseline {
  avgHrvRmssd7d: number;
  avgRestingHeartRate7d: number;
  avgStrain7d: number;
  avgSleepDurationMs7d: number;
  avgRecovery7d: number;
  weeklyActivityScore: number;
  observedDays: number;
}

export interface DuprSnapshot {
  singlesRating?: number;
  doublesRating?: number;
  ratingTrend14d?: number;
}

export interface DailyCheckIn {
  dateString: string;
  submittedAt: string;
  source: "manual";
  sleepHours: number;
  sleepQuality: number;
  energy: number;
  soreness: number;
  stress: number;
  mentalSharpness: number;
  illness: boolean;
  alcohol: boolean;
  travel: boolean;
  painAreas: string[];
  note: string;
  physicalEstimate: number;
  confidence: Extract<ReadinessConfidence, "medium">;
}

export interface MatchAggregate {
  recentMatchCount: number;
  recentWinRate: number;
  daysSinceLastMatch: number | null;
  avgMargin: number;
}

export interface ReadinessInput {
  dateString: string;
  calculatedAt?: string;
  userTimeZone?: string;
  whoop?: WhoopMetrics | null;
  baseline?: WhoopBaseline | null;
  checkIn?: DailyCheckIn | null;
  dupr?: DuprSnapshot | null;
  matches?: MatchRecord[];
  userCreatedAt?: string;
}

export interface ReadinessScore {
  dateString: string;
  overall: number;
  physical: number;
  performance: number;
  activity: number;
  whoopData: Partial<WhoopMetrics>;
  checkInData?: Partial<DailyCheckIn>;
  duprData: {
    singlesRating?: number;
    doublesRating?: number;
    ratingTrend?: number;
  };
  matchData: MatchAggregate;
  changeExplanations: ChangeExplanation[];
  calculatedAt: string;
  label: ScoreLabel;
  confidence: ReadinessConfidence;
  physicalSource: PhysicalReadinessSource;
}

export interface RatingEntry {
  dateString: string;
  duprSingles?: number;
  duprDoubles?: number;
  recScore: number;
  recScoreChangeExplanations: ChangeExplanation[];
  updatedAt: string;
}

export interface OpponentProfile {
  id: string;
  name: string;
  duprId?: string;
  userId?: string;
  rating?: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  lastPlayed: string;
  avgMargin: number;
  lastFiveMatches: MatchRecord[];
}

export interface UserProfile {
  displayName: string;
  email: string;
  photoURL: string;
  duprId: string;
  duprPlayerId: string;
  whoopConnected: boolean;
  whoopUserId: string;
  timeZone: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecScoreInput {
  currentRating: number;
  opponentRating?: number | null;
  matchCount: number;
  verified: boolean;
  category: MatchCategory;
  result: MatchResult;
  averageMargin: number;
  opponentName: string;
  gameCount: number;
}

export interface RecScoreResult {
  previousRating: number;
  newRating: number;
  delta: number;
  expectedOutcome: number;
  actualOutcome: number;
  kFactor: number;
  effectiveK: number;
  explanations: ChangeExplanation[];
}

export interface InsightContext {
  match: MatchRecord;
  readiness: ReadinessScore;
  previousRecScore: number;
  newRecScore: number;
  opponentRating?: number | null;
  h2hMatchesBefore: number;
  h2hWinsBefore: number;
  h2hLossesBefore: number;
}
