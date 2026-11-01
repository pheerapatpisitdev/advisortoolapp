/**
 * The version of the drawing code the draw service runs (draw/server.ts): the app sends it with
 * every call and the service refuses another (409), so the app draws for itself rather than get
 * a picture from code it does not have. tests/draw/core-fingerprint.test.ts says when it must
 * change; the push to main then builds and deploys that service (draw/ship.sh).
 */
export const DRAW_CORE = "4b1fb6b2c218";
