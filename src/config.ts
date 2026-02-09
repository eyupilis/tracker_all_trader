import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const config = {
    // Server
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/copytrade?schema=public',

    // Security
    ingestApiKey: process.env.INGEST_API_KEY || 'development-key',

    // Rate limiting
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),

    // Feature flags
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',

    // Position timing estimation
    positioning: {
        /** Use estimatedOpenTime (midpoint estimation) or firstSeenAt (conservative) for open time */
        useEstimatedOpenTime: process.env.USE_ESTIMATED_OPEN_TIME !== 'false',

        /** Default sort order for active positions: 'newest' (most recent first) or 'oldest' */
        defaultSortOrder: (process.env.POSITION_SORT_ORDER || 'newest') as 'newest' | 'oldest',

        /** Maximum age in hours to consider a position as "recently opened" for filtering */
        recentlyOpenedMaxHours: parseInt(process.env.RECENTLY_OPENED_MAX_HOURS || '24', 10),
    },

    // ─── Binance Scraper ───────────────────────────────────
    scraper: {
        /** Enable the built-in scraper scheduler (set SCRAPER_ENABLED=false to disable) */
        enabled: process.env.SCRAPER_ENABLED !== 'false',

        /** Interval between scrape cycles in ms (default 60s) */
        intervalMs: parseInt(process.env.SCRAPER_INTERVAL_MS || '60000', 10),

        /** Max traders scraped in parallel per batch */
        concurrency: parseInt(process.env.SCRAPER_CONCURRENCY || '5', 10),

        /** Order history page size per trader (max 100) */
        orderPageSize: parseInt(process.env.SCRAPER_ORDER_PAGE_SIZE || '100', 10),

        /** Per-endpoint timeout in ms */
        timeoutMs: parseInt(process.env.SCRAPER_TIMEOUT_MS || '15000', 10),

        /** Comma-separated list of Binance portfolio IDs to track */
        leadIds: (process.env.SCRAPER_LEAD_IDS || [
            // Original 9 traders
            '4897589091850209025',
            '4708220152086930177',
            '4657853710421943296',
            '4778647677431223297',
            '4881493257880589312',
            '4681698170884314113',
            '4532994172262753536',
            '4734328346700544769',
            '4734249513132666368',
            // Expanded trader list (2026-02-07)
            '4793901578758362113',
            '4698261622839206144',
            '4851272736332748545',
            '4505733544990608128',
            '4841986027234384896',
            '4879293784208593920',
            '4768243352467533824',
            '4235245655188894209',
            '4512404768792222208',
            '4423799055974246144',
            '3949937759288284416',
            '4488480120442302976',
            '4886565611217597440',
            '4731947863382279169',
            '4842069554616809729',
            '4803171336444105729',
            '4815589150336799232',
            '4836321228180622336',
            '4769404923586051329',
            '4649626508338132480',
            '4783360547583601664',
            '3954677596262108161',
            '4801890389089005057',
            '4859997976044388608',
            '4279939113666937345',
            '4429195329895473153',
            '4501518026782794497',
            '4865489134417515008',
            '4894728451293951232',
            '4897090721709798657',
            '4788776444236355328',
            '4326059289542684929',
            '4791779875208079872',
            '4751838302089254401',
            '4438679961865098497',
            '4300516091842181632',
            '4759017024314581760',
            '4837877556232171777',
            '4579524444897972736',
            '4683709462520824832',
            '4158362121576449024',
            '4627938648819109120',
            '4881409414442024961',
            '4890000034290737920',
            '4878630112238695169',
            '4883532511353488896',
            '4881564666184406016',
            '4830050053430302464',
            '4471406909032852992',
            '4875229259023361281',
            '4895494799357975040',
            '4886667834866876929',
            '4841704300243177985',
            '4902950048889782784',
            '4899901094164259584',
            '4898640067072865537',
            '4569726087630958593',
            '4862082707640291585',
            '4029832356711067392',
            '4878728898728751360',
            '4620948363713219584',
            '4892968344214480129',
            '4279122899189493249',
            '4796939777858201600',
            '3866185209767867392',
            '4582747764589851648',
            '4369965709399729152',
            '4897219097480087297',
            '4730898437142060288',
            '4691753341711792385',
            '4833673165489996544',
            '4743297218068030720',
            '3753031993319956224',
            '4872767084124315648',
            '4882976541237795328',
            '3900006255302672128',
            '4789934847563545856',
            '4520644381136785152',
            '4734274187381923585',
            '4663844595370966528',
            '4848189286189162241',
            '4174913719175507969',
            '4613096879255692033',
            '4855029212053702401',
            '4734208975505413121',
            '4187364380033162753',
            '4601272841042714369',
            '4840062587444706817',
            '4790469828689935617',
            '4590247183832389376',
            '4861841538971448065',
            '4788361461093458944',
            '4858547154370080256',
            '4734236985151411201',
            '4741215546774332672',
            '4744301548936284929',
            '4746642567314945281',
            '3977981893335066369',
        ].join(',')).split(',').map(s => s.trim()).filter(Boolean),
    },
} as const;

// Validate required config in production
if (config.isProduction) {
    if (config.ingestApiKey === 'development-key') {
        throw new Error('INGEST_API_KEY must be set in production');
    }
}
