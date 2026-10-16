/** Tracker endpoint families must bypass the authentication endpoint dispatcher.
 * Keep this boundary explicit: unknown children are rejected by TrackerApi, while
 * login/profile/security routes remain owned by AuthApi. Query strings are absent. */
export const isTrackerRoute=path=>/^\/(?:bootstrap|dashboard|settings\/(?:ai|routine))(?:\/|$)/.test(path)||/^\/(?:groups|supplements|rechecks)(?:\/|$)/.test(path);
