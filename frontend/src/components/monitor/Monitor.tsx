import React, { useEffect, useState, useRef, useCallback } from 'react';
import { BACKEND_URL } from '../../config';
import { useAudioStreamer } from '../../hooks/useAudioStreamer';
import { useAudienceWebSocket } from '../../hooks/useAudienceWebSocket';
import { authService } from '../../services/authService';
import { LoginView } from '../common/LoginView';
import { AudioInjectionModal } from '../modals/AudioInjectionModal';
import { ExportsModal } from '../modals/ExportsModal';
import { TalkGlossaryModal } from '../modals/TalkGlossaryModal';
import { MonitorHeader } from './MonitorHeader';
import { StageList } from './StageList';
import { StageTerminal } from './StageTerminal';
import { ConfirmPauseModal } from './ConfirmPauseModal';
import { ConfirmStopModal } from './ConfirmStopModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { NewStageModal } from './NewStageModal';
import { ObsOverlayModal } from './ObsOverlayModal';
import type { RoomTelemetry, StatusApiResponse } from '../../types';
import type { SpeakerLang } from '../common/SpeakerLangSelector';

export const Monitor: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    authService.isAuthenticated()
  );
  const [telemetry, setTelemetry] = useState<RoomTelemetry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [pendingRoom, setPendingRoom] = useState<string | null>(null);
  const [isObsModalOpen, setIsObsModalOpen] = useState<boolean>(false);
  const notifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string) => {
    if (notifyTimeoutRef.current) clearTimeout(notifyTimeoutRef.current);
    setActionStatus(msg);
    notifyTimeoutRef.current = setTimeout(() => {
      setActionStatus(null);
    }, 3500);
  }, []);

  const [isExportsOpen, setIsExportsOpen] = useState<boolean>(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState<boolean>(false);
  const [roomGlossaryCount, setRoomGlossaryCount] = useState<number>(0);
  const [selectedRoom, setSelectedRoom] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ropetx_selected_stage') || '';
    }
    return '';
  });

  useEffect(() => {
    if (selectedRoom) {
      localStorage.setItem('ropetx_selected_stage', selectedRoom);
    }
  }, [selectedRoom]);

  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
  const [stageToPauseConfirm, setStageToPauseConfirm] = useState<string | null>(null);
  const [stageToStopConfirm, setStageToStopConfirm] = useState<string | null>(null);
  const [isInjectionOpen, setIsInjectionOpen] = useState<boolean>(false);
  const [isNewRoomModalOpen, setIsNewRoomModalOpen] = useState<boolean>(false);
  const [newRoomInput, setNewRoomInput] = useState<string>('');
  const [isNewRoomPublic, setIsNewRoomPublic] = useState<boolean>(false);
  const [newRoomError, setNewRoomError] = useState<string | null>(null);

  const [micRoom, setMicRoom] = useState<string | null>(null);
  const [isDownloadingSrt, setIsDownloadingSrt] = useState<boolean>(false);
  const [isMobileStagesOpen, setIsMobileStagesOpen] = useState<boolean>(false);

  const previewScrollRef = useRef<HTMLDivElement | null>(null);

  // Contador de glosario por sala
  useEffect(() => {
    if (selectedRoom) {
      void authService
        .authFetch(`${BACKEND_URL}/api/rooms/${encodeURIComponent(selectedRoom)}/glossary`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.total === 'number') {
            setRoomGlossaryCount(data.total);
          }
        })
        .catch(() => {});
    }
  }, [selectedRoom]);

  const [speakerLang, setSpeakerLang] = useState<SpeakerLang>('auto');

  const {
    isStreaming: isMicStreaming,
    isMuted: isMicMuted,
    audioError: micError,
    startStreaming: startMic,
    stopStreaming: stopMic,
    toggleMute: toggleMicMute,
  } = useAudioStreamer({
      room: micRoom || selectedRoom,
      sourceLang: speakerLang,
    });

  // Alerta anti-F5 / recarga accidental mientras el micrófono está activo
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isMicStreaming) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isMicStreaming]);

  const { isLive: wsIsLive, subtitles } = useAudienceWebSocket({
    room: selectedRoom,
    role: 'monitor',
    enabled: isAuthenticated && Boolean(selectedRoom),
    maxSubtitles: 25,
  });

  // Sincronización reactiva instantánea del estado de la sala seleccionada vía WebSocket
  useEffect(() => {
    if (selectedRoom) {
      setTelemetry((prev) =>
        prev.map((r) =>
          r.room_id === selectedRoom
            ? { ...r, status: wsIsLive ? 'ONLINE' : (r.status === 'ONLINE' && !wsIsLive ? 'IDLE' : r.status) }
            : r
        )
      );
    }
  }, [wsIsLive, selectedRoom]);

  const handleLogout = useCallback(() => {
    if (isMicStreaming) {
      stopMic();
      setMicRoom(null);
    }
    authService.logout();
    setIsAuthenticated(false);
  }, [isMicStreaming, stopMic]);

  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await authService.authFetch(`${BACKEND_URL}/api/status`);
      if (res.ok) {
        const data: StatusApiResponse = await res.json();
        if (data.telemetry && Array.isArray(data.telemetry)) {
          if (data.telemetry.length > 0) {
            setTelemetry(data.telemetry);
            setSelectedRoom((prev) => {
              if (prev && data.telemetry.some((r) => r.room_id === prev)) return prev;
              const saved = typeof window !== 'undefined' ? localStorage.getItem('ropetx_selected_stage') : null;
              if (saved && data.telemetry.some((r) => r.room_id === saved)) return saved;
              return data.telemetry[0].room_id;
            });
          } else {
            // Si /api/status retorna lista vacía, consultar /api/rooms como fallback
            try {
              const roomsRes = await authService.authFetch(`${BACKEND_URL}/api/rooms?include_hidden=true`);
              if (roomsRes.ok) {
                const roomsData = await roomsRes.json();
                if (Array.isArray(roomsData) && roomsData.length > 0) {
                  const fallbackTelemetry: RoomTelemetry[] = roomsData.map((r: any) => ({
                    room_id: r.id,
                    status: r.is_live ? 'ONLINE' : 'IDLE',
                    audience_count: 0,
                    latency_ms: 0,
                    has_srt: false,
                    srt_file: '',
                    is_visible: r.is_visible !== false,
                  }));
                  setTelemetry(fallbackTelemetry);
                  setSelectedRoom((prev) => {
                    if (prev && fallbackTelemetry.some((r) => r.room_id === prev)) return prev;
                    return fallbackTelemetry[0].room_id;
                  });
                }
              }
            } catch {
              // Mantener estado previo
            }
          }
        }
        setErrorMsg(null);
      } else if (res.status === 401) {
        handleLogout();
      } else {
        setErrorMsg(`SYS_ERROR: ${res.status}`);
      }
    } catch {
      // En caso de corte momentáneo o reinicio de conexión, no limpiamos las salas previas
      setErrorMsg('SYS_DISCONNECTED');
    }
  }, [handleLogout]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;
    const initialFetch = async () => {
      if (isMounted) await fetchTelemetry();
    };
    void initialFetch();
    const interval = setInterval(fetchTelemetry, 1500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, fetchTelemetry]);

  // Autoscroll del visor de terminal
  useEffect(() => {
    if (previewScrollRef.current) {
      previewScrollRef.current.scrollTop = previewScrollRef.current.scrollHeight;
    }
  }, [subtitles]);

  const toggleRoomVisibility = async (roomId: string, makeVisible: boolean) => {
    setPendingRoom(roomId);
    try {
      const res = await authService.authFetch(
        `${BACKEND_URL}/api/rooms/${encodeURIComponent(roomId)}/visibility`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_visible: makeVisible }),
        }
      );
      if (res.ok) {
        setTelemetry((prev) =>
          prev.map((r) => (r.room_id === roomId ? { ...r, is_visible: makeVisible } : r))
        );
        notify(`${roomId} is now ${makeVisible ? 'PUBLIC' : 'BACKSTAGE'}`);
      } else {
        const data = await res.json().catch(() => ({}));
        notify(data.detail || `Failed to change visibility for ${roomId}.`);
      }
    } catch {
      notify(`Network error while changing visibility for ${roomId}.`);
    } finally {
      setPendingRoom(null);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newRoomInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-');
    if (!cleanId) {
      setNewRoomError('Enter a valid stage name.');
      return;
    }

    try {
      const res = await authService.authFetch(`${BACKEND_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: cleanId, is_visible: isNewRoomPublic }),
      });

      if (res.ok) {
        setNewRoomInput('');
        setIsNewRoomPublic(false);
        setNewRoomError(null);
        setIsNewRoomModalOpen(false);

        // Agregar inmediatamente la sala creada al estado local
        const newRoomData: RoomTelemetry = {
          room_id: cleanId,
          status: 'IDLE',
          audience_count: 0,
          latency_ms: 0,
          has_srt: false,
          srt_file: '',
          is_visible: isNewRoomPublic,
        };
        setTelemetry((prev) => {
          if (prev.some((r) => r.room_id === cleanId)) {
            return prev.map((r) => (r.room_id === cleanId ? { ...r, is_visible: isNewRoomPublic } : r));
          }
          return [...prev, newRoomData];
        });
        setSelectedRoom(cleanId);
        notify(`Stage '${cleanId}' created (${isNewRoomPublic ? 'Public' : 'Backstage'}).`);
        await fetchTelemetry();
      } else {
        const data = await res.json().catch(() => ({}));
        setNewRoomError(data.detail || 'Failed to create stage.');
      }
    } catch {
      setNewRoomError('Network error while creating stage.');
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    setPendingRoom(roomId);
    try {
      const res = await authService.authFetch(
        `${BACKEND_URL}/api/rooms/${encodeURIComponent(roomId)}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        notify(`Stage '${roomId}' deleted.`);
        setRoomToDelete(null);
        await fetchTelemetry();
      } else {
        const data = await res.json().catch(() => ({}));
        notify(data.detail || 'Failed to delete stage.');
      }
    } catch {
      notify('Network error while deleting stage.');
    } finally {
      setPendingRoom(null);
    }
  };

  const handleStopRoomStream = async (roomId: string) => {
    setPendingRoom(roomId);
    setStageToStopConfirm(null);

    // Actualización optimista inmediata en local para feedback instantáneo al operador
    setTelemetry((prev) =>
      prev.map((r) => (r.room_id === roomId ? { ...r, status: 'IDLE' as const } : r))
    );

    try {
      if (isMicStreaming && (micRoom === roomId || !micRoom)) {
        stopMic();
        setMicRoom(null);
      }

      const res = await authService.authFetch(
        `${BACKEND_URL}/api/stop-stream/${encodeURIComponent(roomId)}`,
        { method: 'POST' }
      );
      if (res.ok) {
        notify(`Stream stopped for ${roomId}. SRT compiled.`);
        await fetchTelemetry();
      } else {
        const data = await res.json().catch(() => ({}));
        notify(data.detail || `Failed to stop stream for ${roomId}.`);
        await fetchTelemetry();
      }
    } catch {
      notify('Failed to stop stream.');
    } finally {
      setPendingRoom(null);
      setStageToStopConfirm(null);
    }
  };

  const handleSpeakerLangChange = async (newLang: SpeakerLang) => {
    setSpeakerLang(newLang);
    if (selectedRoom) {
      try {
        await authService.authFetch(
          `${BACKEND_URL}/api/rooms/${encodeURIComponent(selectedRoom)}/language`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: newLang }),
          }
        );
      } catch {}
    }
  };

  const handleClearHistory = async (roomId: string) => {
    try {
      const res = await authService.authFetch(
        `${BACKEND_URL}/api/rooms/${encodeURIComponent(roomId)}/clear`,
        { method: 'POST' }
      );
      if (res.ok) {
        notify(`Live canvas cleared for ${roomId}.`);
      } else {
        notify('Failed to clear canvas.');
      }
    } catch {
      notify('Failed to clear canvas.');
    }
  };

  const handleDownloadSrt = async (roomId: string) => {
    setIsDownloadingSrt(true);
    try {
      const relativeUrl = `/api/download-srt/${encodeURIComponent(roomId)}`;
      let res = await authService.authFetch(relativeUrl);
      if (!res.ok && BACKEND_URL) {
        res = await authService.authFetch(
          `${BACKEND_URL}/api/download-srt/${encodeURIComponent(roomId)}`
        );
      }
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcripcion_${roomId}.srt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        notify(`SRT downloaded: ${roomId}.srt`);
      } else {
        notify('No SRT file found for this stage');
      }
    } catch {
      notify('No SRT file found for this stage');
    } finally {
      setIsDownloadingSrt(false);
    }
  };

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const activeRoomData = telemetry.find((r) => r.room_id === selectedRoom);
  const isSelectedLive = activeRoomData?.status === 'ONLINE';

  return (
    <div className="flex flex-col h-screen bg-black text-zinc-100 font-mono select-none overflow-hidden text-xs">
      {/* 1. HEADER OPERACIONAL MINIMALISTA */}
      <MonitorHeader
        actionStatus={actionStatus}
        errorMsg={errorMsg}
        micError={micError}
        onOpenExports={() => setIsExportsOpen(true)}
        onOpenNewStage={() => setIsNewRoomModalOpen(true)}
        onLogout={handleLogout}
        onToggleMobileStages={() => setIsMobileStagesOpen((prev) => !prev)}
        isMobileStagesOpen={isMobileStagesOpen}
        stagesCount={telemetry.length}
      />

      {/* 2. LAYOUT PRINCIPAL: STAGES & TERMINAL */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 min-w-0 relative">
        {/* Desktop / Laptop / Tablet Sidebar fijo (sm+) */}
        <div className="hidden sm:block w-56 md:w-64 lg:w-72 border-r border-zinc-800/80 h-full shrink-0">
          <StageList
            telemetry={telemetry}
            selectedRoom={selectedRoom}
            onSelectRoom={setSelectedRoom}
          />
        </div>

        {/* Mobile Drawer Deslizable (< sm) */}
        {isMobileStagesOpen && (
          <div className="sm:hidden absolute inset-0 z-40 flex">
            <div
              className="fixed inset-0 bg-black/75 transition-opacity cursor-pointer"
              onClick={() => setIsMobileStagesOpen(false)}
            />
            <div className="relative w-72 max-w-[85vw] h-full bg-black border-r border-zinc-800/80 shadow-2xl z-50 flex flex-col">
              <StageList
                telemetry={telemetry}
                selectedRoom={selectedRoom}
                onSelectRoom={(roomId) => {
                  setSelectedRoom(roomId);
                  setIsMobileStagesOpen(false);
                }}
                onCloseMobile={() => setIsMobileStagesOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Terminal Principal de Monitoreo */}
        <StageTerminal
          selectedRoom={selectedRoom}
          activeRoomData={activeRoomData}
          isSelectedLive={isSelectedLive}
          subtitles={subtitles}
          roomGlossaryCount={roomGlossaryCount}
          speakerLang={speakerLang}
          onSpeakerLangChange={handleSpeakerLangChange}
          onOpenAudioConfig={() => setIsInjectionOpen(true)}
          onStartStream={() => setIsInjectionOpen(true)}
          onOpenGlossary={() => setIsGlossaryOpen(true)}
          onOpenObsStudio={() => setIsObsModalOpen(true)}
          onDownloadSrt={handleDownloadSrt}
          isDownloadingSrt={isDownloadingSrt}
          onStopStream={() => setStageToStopConfirm(selectedRoom)}
          onClearHistory={() => handleClearHistory(selectedRoom)}
          onToggleVisibility={() => {
            setStageToPauseConfirm(selectedRoom);
          }}
          isMicStreaming={isMicStreaming}
          micRoom={micRoom}
          isMicMuted={isMicMuted}
          onToggleMicMute={toggleMicMute}
          onDeleteStage={() => setRoomToDelete(selectedRoom)}
          isPending={pendingRoom === selectedRoom}
          previewScrollRef={previewScrollRef}
        />
      </div>

      {/* 3. MODALES MODULARES */}
      <ObsOverlayModal
        isOpen={isObsModalOpen}
        onClose={() => setIsObsModalOpen(false)}
        room={selectedRoom}
      />

      <AudioInjectionModal
        isOpen={isInjectionOpen}
        onClose={() => setIsInjectionOpen(false)}
        telemetry={telemetry}
        selectedRoom={selectedRoom}
        onSelectRoom={setSelectedRoom}
        isMicStreaming={isMicStreaming}
        startMic={startMic}
        stopMic={stopMic}
        micRoom={micRoom}
        setMicRoom={setMicRoom}
        speakerLang={speakerLang}
        setSpeakerLang={setSpeakerLang}
        onStreamStarted={fetchTelemetry}
      />

      <ExportsModal
        isOpen={isExportsOpen}
        onClose={() => setIsExportsOpen(false)}
      />

      <TalkGlossaryModal
        isOpen={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
        roomId={selectedRoom}
        onGlossaryUpdated={(count) => setRoomGlossaryCount(count)}
      />

      <ConfirmPauseModal
        isOpen={Boolean(stageToPauseConfirm)}
        stageId={stageToPauseConfirm}
        isCurrentlyVisible={telemetry.find((room) => room.room_id === stageToPauseConfirm)?.is_visible !== false}
        onConfirm={() => {
          if (stageToPauseConfirm) {
            const isVisible = telemetry.find((room) => room.room_id === stageToPauseConfirm)?.is_visible !== false;
            void toggleRoomVisibility(stageToPauseConfirm, !isVisible);
            setStageToPauseConfirm(null);
          }
        }}
        onCancel={() => setStageToPauseConfirm(null)}
      />

      <ConfirmStopModal
        isOpen={Boolean(stageToStopConfirm)}
        stageId={stageToStopConfirm}
        onConfirm={() => {
          if (stageToStopConfirm) {
            void handleStopRoomStream(stageToStopConfirm);
            setStageToStopConfirm(null);
          }
        }}
        onCancel={() => setStageToStopConfirm(null)}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(roomToDelete)}
        stageId={roomToDelete}
        onConfirm={() => {
          if (roomToDelete) void handleDeleteRoom(roomToDelete);
        }}
        onCancel={() => setRoomToDelete(null)}
      />

      <NewStageModal
        isOpen={isNewRoomModalOpen}
        roomInput={newRoomInput}
        isPublic={isNewRoomPublic}
        error={newRoomError}
        onChangeInput={(val) => {
          setNewRoomInput(val);
          setNewRoomError(null);
        }}
        onChangeIsPublic={setIsNewRoomPublic}
        onSubmit={handleCreateRoom}
        onClose={() => {
          setIsNewRoomModalOpen(false);
          setNewRoomError(null);
          setNewRoomInput('');
          setIsNewRoomPublic(false);
        }}
      />
      {/* Toast Flotante con Glassmorphism y Microanimación */}
      {actionStatus && (
        <div className="fixed bottom-5 right-5 z-50 select-none animate-toast-in pointer-events-none">
          <div className="px-4 py-2.5 bg-zinc-950/95 border border-zinc-700/80 rounded-xs shadow-2xl shadow-black/80 flex items-center gap-2.5 text-xs font-mono text-zinc-100">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="font-semibold tracking-wide">{actionStatus}</span>
          </div>
        </div>
      )}
    </div>
  );
};
