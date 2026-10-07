import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { StudentView } from './pages/StudentView';
import { AdminDashboard } from './pages/AdminDashboard';
import { ProjectorView } from './pages/ProjectorView';
import { ProctorView } from './pages/ProctorView';
import { GuidePage } from './pages/GuidePage';
import { useRealtimeGame } from './hooks/useRealtimeGame';

export type AppTab = 'admin' | 'projector' | 'proctor' | 'guide' | 'student';

export default function App() {
  const [currentTab, setCurrentTab] = useState<AppTab>('admin');
  const [isGuestMode, setIsGuestMode] = useState<boolean>(false);
  const [roomCode, setRoomCode] = useState<string>('RCV2510');
  const competitionId = 'comp-thpt-2510';

  const { isConnected } = useRealtimeGame({
    competitionId,
    enableSounds: false,
  });

  // Handle URL Routing & Hash navigation
  // Admin: / or /#admin -> Admin Dashboard with all management tabs
  // Guest / Student: /join?room=... or /student or /#room=... -> Guest Contestant Interface (No Admin UI)
  useEffect(() => {
    const handleRoute = () => {
      const pathname = window.location.pathname.toLowerCase();
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash.replace('#', '').trim();
      const hashParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : hash);

      const queryRoom = searchParams.get('room') || hashParams.get('room');
      const queryMode = searchParams.get('mode') || searchParams.get('role');
      const isJoinPath = pathname.startsWith('/join') || pathname.startsWith('/student');
      const isHashRoom = hash.startsWith('room=') || hash.startsWith('join') || hash.startsWith('/join');
      const isHashStudent = hash === 'student' || hash === 'guest';

      const codeFromHash = hash.startsWith('room=') ? hash.replace('room=', '').trim() : '';
      const resolvedCode = queryRoom || codeFromHash || 'RCV2510';

      if (
        isJoinPath ||
        Boolean(queryRoom) ||
        queryMode === 'student' ||
        queryMode === 'guest' ||
        isHashRoom ||
        isHashStudent
      ) {
        setIsGuestMode(true);
        setCurrentTab('student');
        if (resolvedCode) {
          setRoomCode(resolvedCode.toUpperCase());
        }
      } else if (hash === 'projector') {
        setIsGuestMode(false);
        setCurrentTab('projector');
      } else if (hash === 'proctor') {
        setIsGuestMode(false);
        setCurrentTab('proctor');
      } else if (hash === 'guide') {
        setIsGuestMode(false);
        setCurrentTab('guide');
      } else {
        // Default directly to Admin Dashboard
        setIsGuestMode(false);
        setCurrentTab('admin');
      }
    };

    handleRoute();
    window.addEventListener('popstate', handleRoute);
    window.addEventListener('hashchange', handleRoute);
    return () => {
      window.removeEventListener('popstate', handleRoute);
      window.removeEventListener('hashchange', handleRoute);
    };
  }, []);

  const handleTabChange = (tab: AppTab) => {
    setCurrentTab(tab);
    if (tab === 'student') {
      setIsGuestMode(true);
      window.location.hash = `room=${roomCode}`;
    } else {
      setIsGuestMode(false);
      window.location.hash = tab === 'admin' ? '' : tab;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Navbar with Admin tabs is ONLY visible for Admin mode (Ban tổ chức, Màn hình chiếu LED, Giám thị, Hướng dẫn).
          Guest / Người thi NEVER sees the Navbar. */}
      {!isGuestMode && currentTab !== 'projector' && (
        <Navbar
          currentTab={currentTab}
          setCurrentTab={handleTabChange}
          roomCode={roomCode}
          isConnected={isConnected}
        />
      )}

      <main className="flex-1">
        {currentTab === 'student' && (
          <StudentView
            initialRoomCode={roomCode}
            isGuestMode={isGuestMode}
            onBackToHome={isGuestMode ? undefined : () => handleTabChange('admin')}
          />
        )}

        {currentTab === 'admin' && (
          <AdminDashboard
            competitionId={competitionId}
            onOpenProjector={() => handleTabChange('projector')}
          />
        )}

        {currentTab === 'projector' && (
          <ProjectorView
            competitionId={competitionId}
            onBackToAdmin={() => handleTabChange('admin')}
            onBackToHome={() => handleTabChange('admin')}
          />
        )}

        {currentTab === 'proctor' && (
          <ProctorView competitionId={competitionId} />
        )}

        {currentTab === 'guide' && (
          <GuidePage />
        )}
      </main>
    </div>
  );
}
