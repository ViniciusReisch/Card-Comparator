import { useEffect, useRef, useState } from "react";
import {
  apiClient,
  monitorEventsUrl,
  type MonitorEventPayload,
  type MonitorStatusResponse,
  type OfferItem
} from "../api/client";

type UseMonitorStatusOptions = {
  enabled?: boolean;
  onNewOffer?: (offer: OfferItem, status: MonitorStatusResponse) => void;
};

const POLL_INTERVAL_MS = 1500;

export function useMonitorStatus(options: UseMonitorStatusOptions = {}) {
  const { enabled = true, onNewOffer } = options;
  const [status, setStatus] = useState<MonitorStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const onNewOfferRef = useRef(onNewOffer);

  useEffect(() => {
    onNewOfferRef.current = onNewOffer;
  }, [onNewOffer]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;

    async function loadInitialStatus() {
      try {
        const snapshot = await apiClient.getMonitorStatus();
        if (!cancelled) {
          setStatus(snapshot);
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Falha ao carregar status do monitor.");
        }
      }
    }

    function clearPolling() {
      if (pollTimerRef.current != null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    function startPolling() {
      if (pollTimerRef.current != null) {
        return;
      }

      pollTimerRef.current = window.setInterval(() => {
        void loadInitialStatus();
      }, POLL_INTERVAL_MS);
    }

    function stopEventSource() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }

    loadInitialStatus().catch(() => undefined);

    const eventSource = new EventSource(monitorEventsUrl);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("status", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as MonitorEventPayload;
      if (cancelled || payload.type !== "status") {
        return;
      }

      setStatus(payload.status);
      setError(null);
      clearPolling();
    });

    eventSource.addEventListener("new-offer", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as MonitorEventPayload;
      if (cancelled || payload.type !== "new-offer") {
        return;
      }

      setStatus(payload.status);
      setError(null);
      onNewOfferRef.current?.(payload.offer, payload.status);
    });

    eventSource.onerror = () => {
      stopEventSource();
      startPolling();
    };

    return () => {
      cancelled = true;
      clearPolling();
      stopEventSource();
    };
  }, [enabled]);

  return {
    status,
    error
  };
}
