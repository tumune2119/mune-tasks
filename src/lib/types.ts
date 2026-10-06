export type Priority = "low" | "med" | "high";
export type ProjectStatus = "active" | "archived";

export interface AttachmentMeta {
  name: string;
  size: number;
  chars: number;
}

export interface TaskNode {
  id: string;
  sectionId: string;
  parentId: string | null;
  title: string;
  notes: string | null;
  priority: Priority | null;
  done: boolean;
  doneAt: number | null;
  position: number;
  subtasks: TaskNode[];
}

export interface SectionNode {
  id: string;
  title: string;
  position: number;
  tasks: TaskNode[];
}

export interface ProjectMeta {
  id: string;
  name: string;
  summary: string;
  prompt: string;
  detailLevel: number;
  itemCount: string;
  extraInstructions: string;
  attachments: AttachmentMeta[];
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface ProjectTree extends ProjectMeta {
  sections: SectionNode[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  summary: string;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  total: number;
  done: number;
  percent: number;
}

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  doneThisWeek: number;
  overallPercent: number;
  totalItems: number;
  doneItems: number;
}

export type ProviderMode = "auto" | "api" | "cli";
export type Effort = "low" | "medium" | "high";

export interface AppSettings {
  provider: ProviderMode;
  model: string;
  effort: Effort;
  cliPath: string;
}

export interface ExtractedFile {
  name: string;
  size: number;
  text: string;
  error?: string;
}

export interface SettingsStatus {
  settings: AppSettings;
  hasApiKey: boolean;
  cliPath: string | null;
  dbPath: string;
}
