import { create } from 'zustand';
import type {
  AppState, PhaseId, LogEntry, AppearanceStats,
  TheoryDesign, ReconciliationResult, ImplementationReport,
  Phase1Result, Phase2Result, Phase3Result, Phase4Result,
  CompetitorAnalysisResult,
  AislePageResult, GeneratedPage, ExternalUrlItem, EntityType,
  EvidenceStore, EvidenceCandidateStatus, EvidenceItem,
} from '../types';

// ── Phase0（ログ取得）の入力データ ───────────────────────────────

export interface Phase0PromptItem {
  id: string;
  promptText: string;
  promptTypeId: string;           // 問いの型 P-01〜P-06（M-ID制約に使用）
  promptTypeSecondary: string[];  // 補助P-ID
  promptTypeReason: string;       // 判定理由
}

export interface Phase0Data {
  companyName: string;
  category: string;
  keywords: string;
  prompts: Phase0PromptItem[];
}

// ── ストア定義 ────────────────────────────────────────────────────

interface AppStore extends AppState {
  phase0Data: Phase0Data | null;
  setPhase0Data: (data: Phase0Data) => void;
  setPhase: (phase: PhaseId) => void;
  setLogEntries: (entries: LogEntry[]) => void;
  setStats: (stats: AppearanceStats) => void;
  setPhase1Result: (result: Phase1Result) => void;
  setPhase2Result: (result: Phase2Result) => void;
  setPhase3Result: (result: Phase3Result | null) => void;
  setPhase4Result: (result: Phase4Result | null) => void;
  setCompetitorAnalysis: (result: CompetitorAnalysisResult | null) => void;
  setSelectedPId: (pId: string) => void;
  setSelectedAId: (aId: string) => void;
  setTheoryDesign: (design: TheoryDesign) => void;
  setReconciliation: (result: ReconciliationResult) => void;
  setImplementationReport: (report: ImplementationReport) => void;
  setAppearedChoiceMap: (map: Record<string, 'reinforce' | 'skip'>) => void;
  setAisleResult: (result: AislePageResult | null) => void;
  setGeneratedPage: (page: GeneratedPage | null) => void;
  setExternalUrls: (urls: ExternalUrlItem[]) => void;
  setEntityType: (type: EntityType) => void;
  evidenceStore: EvidenceStore | null;
  setEvidenceStore: (store: EvidenceStore) => void;
  updateCandidateStatus: (id: string, status: EvidenceCandidateStatus) => void;
  adoptAllPending: () => void;
  clearEvidenceStore: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  phase0Data: null,
  currentPhase: 1,
  logEntries: [],
  stats: null,
  phase1Result: null,
  phase2Result: null,
  phase3Result: null,
  phase4Result: null,
  competitorAnalysis: null,
  selectedPId: '',
  selectedAId: '',
  theoryDesign: null,
  reconciliation: null,
  implementationReport: null,
  appearedChoiceMap: {},
  aisleResult: null,
  generatedPage: null,
  externalUrls: [{ type: 'note', url: '' }],
  entityType: 'company',
  evidenceStore: null,

  setPhase0Data: (data) => set({ phase0Data: data }),
  setPhase: (phase) => set({ currentPhase: phase }),
  setLogEntries: (entries) => set({ logEntries: entries }),
  setStats: (stats) => set({ stats }),
  setPhase1Result: (result) => set({ phase1Result: result }),
  setPhase2Result: (result) => set({ phase2Result: result }),
  setPhase3Result: (result) => set({ phase3Result: result }),
  setPhase4Result: (result) => set({ phase4Result: result }),
  setCompetitorAnalysis: (result) => set({ competitorAnalysis: result }),
  setSelectedPId: (pId) => set({ selectedPId: pId }),
  setSelectedAId: (aId) => set({ selectedAId: aId }),
  setTheoryDesign: (design) => set({ theoryDesign: design }),
  setReconciliation: (result) => set({ reconciliation: result }),
  setImplementationReport: (report) => set({ implementationReport: report }),
  setAppearedChoiceMap: (map) => set({ appearedChoiceMap: map }),
  setAisleResult: (result) => set({ aisleResult: result }),
  setGeneratedPage: (page) => set({ generatedPage: page }),
  setExternalUrls: (urls) => set({ externalUrls: urls }),
  setEntityType: (type) => set({ entityType: type }),

  setEvidenceStore: (store) => set({ evidenceStore: store }),

  updateCandidateStatus: (id, status) => set((state) => {
    if (!state.evidenceStore) return {};
    const updatedItems = state.evidenceStore.candidates.items.map(item =>
      item.id === id ? { ...item, status } : item
    );
    const adoptedItems: EvidenceItem[] = updatedItems
      .filter(item => item.status === 'adopted')
      .map(({ status: _s, sourceLabel: _l, ...rest }) => rest);
    return {
      evidenceStore: {
        candidates: { ...state.evidenceStore.candidates, items: updatedItems },
        adopted: {
          extractedAt: state.evidenceStore.adopted.extractedAt,
          sourceDescription: state.evidenceStore.adopted.sourceDescription,
          items: adoptedItems,
        },
      },
    };
  }),

  adoptAllPending: () => set((state) => {
    if (!state.evidenceStore) return {};
    const updatedItems = state.evidenceStore.candidates.items.map(item =>
      item.status === 'pending' ? { ...item, status: 'adopted' as EvidenceCandidateStatus } : item
    );
    const adoptedItems: EvidenceItem[] = updatedItems
      .filter(item => item.status === 'adopted')
      .map(({ status: _s, sourceLabel: _l, ...rest }) => rest);
    return {
      evidenceStore: {
        candidates: { ...state.evidenceStore.candidates, items: updatedItems },
        adopted: {
          extractedAt: state.evidenceStore.adopted.extractedAt,
          sourceDescription: state.evidenceStore.adopted.sourceDescription,
          items: adoptedItems,
        },
      },
    };
  }),

  clearEvidenceStore: () => set({ evidenceStore: null }),
}));
