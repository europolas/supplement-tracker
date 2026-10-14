/**
 * One-time location lookup and location watch lifecycle.
 * Ask permission after user intent. Treat location as sensitive; stop watching when the screen closes.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function locate({ navigator: nav = globalThis.navigator, timeout = 10000, maximumAge = 60000, enableHighAccuracy = false } = {}) {
  if (!nav.geolocation) return Promise.reject(new Error('Vietos nustatymas nepalaikomas.'));
  return new Promise((resolve, reject) => nav.geolocation.getCurrentPosition(position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp }), reject, { timeout, maximumAge, enableHighAccuracy }));
}
export function watchLocation(onPosition, onError, { navigator: nav = globalThis.navigator, ...options } = {}) {
  if (!nav.geolocation) throw new Error('Vietos nustatymas nepalaikomas.');
  const id = nav.geolocation.watchPosition(onPosition, onError, options);
  return () => nav.geolocation.clearWatch(id);
}
