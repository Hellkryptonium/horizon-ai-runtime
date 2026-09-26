import { create } from "zustand";

type DeploymentWizardState = {
  currentStep: number;
  selectedModelId: string | null;
  selectedWorkerId: string | null;
  deploymentName: string;
  setStep: (step: number) => void;
  selectModel: (id: string) => void;
  selectWorker: (id: string) => void;
  setDeploymentName: (name: string) => void;
  reset: () => void;
};

const initialState = { currentStep: 1, selectedModelId: null, selectedWorkerId: null, deploymentName: "" };

export const useDeploymentWizardStore = create<DeploymentWizardState>((set) => ({
  ...initialState,
  setStep: (currentStep) => set({ currentStep }),
  selectModel: (selectedModelId) => set({ selectedModelId }),
  selectWorker: (selectedWorkerId) => set({ selectedWorkerId }),
  setDeploymentName: (deploymentName) => set({ deploymentName }),
  reset: () => set(initialState),
}));
