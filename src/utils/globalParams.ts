import { GlobalParamsVersion } from "@/app/types/globalParams";

export interface ParamsWithContext {
  currentVersion: GlobalParamsVersion | undefined;
  nextVersion: GlobalParamsVersion | undefined;
  isApprochingNextVersion: boolean;
  firstActivationHeight: number;
}
