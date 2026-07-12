// Wrapper Socket.IO : émission avec accusé de réception sous forme de promesse.

export const socket = window.io();

export function emit(event, payload = {}) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (r) => resolve(r ?? {}));
  });
}
