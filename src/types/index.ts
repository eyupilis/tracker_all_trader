// Re-export commonly used types
export type Platform = 'binance';

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    meta?: {
        total?: number;
        limit?: number;
        offset?: number;
    };
}

export interface PaginationQuery {
    limit?: number;
    offset?: number;
}

export interface PlatformQuery {
    platform?: Platform;
}
