interface IKeyPairs {
  prKey: string;
  pbKey: string;
  RC: string;
  uniqueString: string;
}

/** The owner-set room limits as served by GET/PATCH /api/limits. */
interface IRoomLimits {
  paused: boolean;
  imagesEnabled: boolean;
  maxMessageLength: number;
  rateLimitCount: number;
  rateLimitPeriod: string;
}

export type { IKeyPairs, IRoomLimits };
