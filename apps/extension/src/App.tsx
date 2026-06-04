import React from "react";
import { ReadLaterProvider } from "./context/ReadLaterContext";
import { Header } from "./components/Header";
import { SettingsPanel } from "./components/SettingsPanel";
import { FilterBar } from "./components/FilterBar";
import { LinkList } from "./components/LinkList";
import { StatusFooter } from "./components/StatusFooter";
import { useReadLater } from "./context/ReadLaterContext";

/**
 * Main app content – rendered inside ReadLaterProvider so it has access to context.
 */
function AppContent() {
  const { showSettings } = useReadLater();

  return (
    <div className="w-[500px] min-h-[500px] max-h-[600px] bg-background text-foreground antialiased flex flex-col overflow-x-hidden transition-colors duration-300">
      <Header />

      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        {showSettings ? <SettingsPanel /> : <MainView />}
      </main>

      <StatusFooter />
    </div>
  );
}

/**
 * The main view (non-settings): filter bar, link list.
 */
function MainView() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <FilterBar />
      <LinkList />
    </div>
  );
}

/**
 * Root App component – wraps everything in the ReadLaterProvider.
 */
export default function App() {
  return (
    <ReadLaterProvider>
      <AppContent />
    </ReadLaterProvider>
  );
}
