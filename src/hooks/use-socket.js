import { useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket";

/**
 * Subscribes to a socket event for the lifetime of the component.
 *
 * The handler is read through a ref, so callers can pass a fresh closure on
 * every render without the listener being torn down and re-attached. The
 * listener is also detached by reference rather than by event name — the
 * previous code called `socket.off("flowmeter")`, so unmounting a single
 * port card silently deafened every other port on the screen.
 */
export function useSocketEvent(event, handler) {
  const handlerRef = useRef(handler);

  // Synced in an effect rather than during render: mutating a ref while
  // rendering is unsafe under concurrent React.
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const listener = (...args) => handlerRef.current?.(...args);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [event]);
}

/** Live connection state of the shared gateway socket. */
export function useSocketStatus() {
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onDisconnect);
    };
  }, []);

  return connected;
}
