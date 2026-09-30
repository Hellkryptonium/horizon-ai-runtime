import { create } from "zustand";

type DeploymentWizardState = {
  currentStep: number;
  selectedModelId: string | null;
  selectedWorkerId: string | null;
  selectedWorkerIds: string[];
  deploymentName: string;
  setStep: (step: number) => void;
  selectModel: (id: string) => void;
  selectWorker: (id: string) => void;
  toggleWorker: (id: string) => void;
  setDeploymentName: (name: string) => void;
  reset: () => void;
};

const initialState = { currentStep: 1, selectedModelId: null, selectedWorkerId: null, selectedWorkerIds: [] as string[], deploymentName: "" };

export const useDeploymentWizardStore = create<DeploymentWizardState>((set) => ({
  ...initialState,
  setStep: (currentStep) => set({ currentStep }),
  selectModel: (selectedModelId) => set({ selectedModelId }),
  selectWorker: (selectedWorkerId) => set({ selectedWorkerId, selectedWorkerIds: [selectedWorkerId] }),
  toggleWorker: (id) => set((state) => {
    const selectedWorkerIds = state.selectedWorkerIds.includes(id) ? state.selectedWorkerIds.filter((workerId) => workerId !== id) : [...state.selectedWorkerIds, id];
    return { selectedWorkerIds, selectedWorkerId: selectedWorkerIds[0] || null };
  }),
  setDeploymentName: (deploymentName) => set({ deploymentName }),
  reset: () => set(initialState),
}));
