import { create } from 'zustand';
import { CandidateVisibleTask, TaskFile, TestResultItem } from '@proctor-forge/shared';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  blocked?: boolean;
}

export interface ExamState {
  assessmentId: string | null;
  tasks: CandidateVisibleTask[];
  activeTaskIndex: number;
  fileBuffers: Record<string, string>; // path -> edited content
  activeFilePath: string;
  visibleTestResults: TestResultItem[];
  isRunningTests: boolean;
  testOutputConsole: { stdout: string; stderr: string; executionTimeMs: number };
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  unlockedHintLevel: number;
  remainingSeconds: number;
  isTimerRunning: boolean;
  autosaveState: 'saved' | 'saving' | 'dirty';

  // Actions
  initExam: (assessmentId: string, tasks: CandidateVisibleTask[], durationMinutes: number) => void;
  setActiveTask: (index: number) => void;
  setActiveFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  setRunningTests: (running: boolean) => void;
  setTestResults: (results: TestResultItem[], consoleOut: { stdout: string; stderr: string; executionTimeMs: number }) => void;
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setChatLoading: (loading: boolean) => void;
  setUnlockedHintLevel: (level: number) => void;
  decrementTimer: () => void;
  setAutosaveState: (state: 'saved' | 'saving' | 'dirty') => void;
  resetCurrentFileToStarter: () => void;
}

export const useExamStore = create<ExamState>((set, get) => ({
  assessmentId: null,
  tasks: [],
  activeTaskIndex: 0,
  fileBuffers: {},
  activeFilePath: '',
  visibleTestResults: [],
  isRunningTests: false,
  testOutputConsole: { stdout: '', stderr: '', executionTimeMs: 0 },
  chatMessages: [
    {
      id: 'sys_init',
      sender: 'system',
      content: 'Proctor-Forge Technical Mentor connected. Ask questions or request hints for Adept & Master tier tasks.',
      timestamp: Date.now()
    }
  ],
  isChatLoading: false,
  unlockedHintLevel: 1,
  remainingSeconds: 3600,
  isTimerRunning: false,
  autosaveState: 'saved',

  initExam: (assessmentId, tasks, durationMinutes) => {
    const buffers: Record<string, string> = {};
    if (tasks.length > 0 && tasks[0]) {
      for (const file of tasks[0].files) {
        buffers[file.path] = file.content;
      }
    }
    const initialFilePath = tasks[0]?.files[0]?.path || '';

    set({
      assessmentId,
      tasks,
      activeTaskIndex: 0,
      fileBuffers: buffers,
      activeFilePath: initialFilePath,
      remainingSeconds: durationMinutes * 60,
      isTimerRunning: true,
      visibleTestResults: tasks[0]?.visibleTests.map((t) => ({
        id: t.id,
        name: t.name,
        passed: false,
        durationMs: 0,
        category: t.category,
        weight: t.weight
      })) || []
    });
  },

  setActiveTask: (index) => {
    const { tasks } = get();
    const task = tasks[index];
    if (!task) return;

    const buffers: Record<string, string> = {};
    for (const file of task.files) {
      buffers[file.path] = file.content;
    }

    set({
      activeTaskIndex: index,
      fileBuffers: buffers,
      activeFilePath: task.files[0]?.path || '',
      visibleTestResults: task.visibleTests.map((t) => ({
        id: t.id,
        name: t.name,
        passed: false,
        durationMs: 0,
        category: t.category,
        weight: t.weight
      })),
      testOutputConsole: { stdout: '', stderr: '', executionTimeMs: 0 }
    });
  },

  setActiveFile: (path) => set({ activeFilePath: path }),

  updateFileContent: (path, content) => {
    set((state) => ({
      fileBuffers: { ...state.fileBuffers, [path]: content },
      autosaveState: 'dirty'
    }));
  },

  setRunningTests: (running) => set({ isRunningTests: running }),

  setTestResults: (results, consoleOut) => set({
    visibleTestResults: results,
    testOutputConsole: consoleOut
  }),

  addChatMessage: (msg) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: `msg_${Date.now()}_${Math.random()}`,
      timestamp: Date.now()
    };
    set((state) => ({ chatMessages: [...state.chatMessages, newMsg] }));
  },

  setChatLoading: (loading) => set({ isChatLoading: loading }),

  setUnlockedHintLevel: (level) => set({ unlockedHintLevel: level }),

  decrementTimer: () => {
    set((state) => {
      const next = Math.max(0, state.remainingSeconds - 1);
      return {
        remainingSeconds: next,
        isTimerRunning: next > 0
      };
    });
  },

  setAutosaveState: (state) => set({ autosaveState: state }),

  resetCurrentFileToStarter: () => {
    const { tasks, activeTaskIndex, activeFilePath } = get();
    const currentTask = tasks[activeTaskIndex];
    if (!currentTask) return;

    const originalFile = currentTask.files.find((f) => f.path === activeFilePath);
    if (originalFile) {
      get().updateFileContent(activeFilePath, originalFile.content);
    }
  }
}));

