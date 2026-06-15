import { useAppStore } from './store/useAppStore';
import { Sidebar } from './components/Sidebar';
import { StepBar } from './components/StepBar';
import { PasswordGate } from './components/PasswordGate';
import { AdminPage } from './components/AdminPage';
import { Phase0LogCollect } from './phases/Phase0LogCollect';
import { Phase1Evaluation } from './phases/Phase1Evaluation';
import { Phase2Design } from './phases/Phase2Design';
import { Phase3Reconciliation } from './phases/Phase3Reconciliation';
import { Phase4Implementation } from './phases/Phase4Implementation';
import { Report } from './phases/Report';

function App() {
  const { currentPhase } = useAppStore();

  // /admin ルート
  if (window.location.pathname === '/admin') {
    return <PasswordGate><AdminPage /></PasswordGate>;
  }
  const isReport = currentPhase === 6;

  const renderPhase = () => {
    switch (currentPhase) {
      case 1: return <Phase0LogCollect />;
      case 2: return <Phase1Evaluation />;
      case 3: return <Phase2Design />;
      case 4: return <Phase3Reconciliation />;
      case 5: return <Phase4Implementation />;
      case 6: return <Report />;
    }
  };

  return (
    <PasswordGate>
      <div className="flex min-h-screen w-full">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 print:ml-0">
          {!isReport && <StepBar />}
          <main className="flex-1 p-6 overflow-auto print:p-0">
            <div className={isReport ? 'max-w-4xl mx-auto print:max-w-none' : 'max-w-5xl mx-auto'}>
              {renderPhase()}
            </div>
          </main>
        </div>
      </div>
    </PasswordGate>
  );
}

export default App;
