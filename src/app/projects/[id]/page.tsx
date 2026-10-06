import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectTree } from "@/lib/projects";
import { getProjectUsage } from "@/lib/usage";
import { ProjectPage } from "@/components/project/project-page";

export async function generateMetadata(props: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: getProjectTree(id)?.name ?? "Project" };
}

export default async function Page(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const project = getProjectTree(id);
  if (!project) notFound();
  // Keyed by id so switching projects resets all client state.
  return <ProjectPage key={project.id} initial={project} usage={getProjectUsage(project.id)} />;
}
