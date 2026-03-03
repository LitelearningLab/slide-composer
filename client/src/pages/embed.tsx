import { useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { type Presentation } from "@shared/schema";
import { PresentationViewer } from "@/components/presentation-viewer";

export default function Embed() {
  const [, params] = useRoute("/embed/:id");
  const id = params?.id;

  const { data: presentation, isLoading, error } = useQuery<Presentation>({
    queryKey: ["/api/presentations", id],
    enabled: !!id,
  });

  if (!id) {
    return <div className="p-4 text-center text-red-500">No presentation ID provided.</div>;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-slate-500">Loading presentation...</p>
        </div>
      </div>
    );
  }

  if (error || !presentation) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100">
        <div className="p-6 text-center bg-white rounded-lg shadow-sm border border-red-200">
          <p className="text-red-600 font-medium">Failed to load presentation.</p>
          <p className="text-sm text-slate-500 mt-2">The presentation may have been deleted or the URL is incorrect.</p>
        </div>
      </div>
    );
  }

  // Render the PresentationViewer directly (which is full-screen by default)
  // We pass a no-op onClose since embed mode shouldn't have a close button
  return (
    <div className="h-screen w-screen overflow-hidden relative bg-black">
      <PresentationViewer
        presentation={presentation}
        onClose={() => {}}
      />
    </div>
  );
}
