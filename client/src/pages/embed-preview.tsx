import { useEffect, useState } from "react";
import { type Presentation } from "@shared/schema";
import { PresentationViewer } from "@/components/presentation-viewer";

export default function EmbedPreview() {
    const [presentation, setPresentation] = useState<Presentation | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "INIT_PRESENTATION" && data.data) {
                    try {
                        const decodedStr = decodeURIComponent(window.atob(data.data));
                        const pres = JSON.parse(decodedStr) as Presentation;

                        if (pres && pres.slides && pres.slides.length > 0) {
                            setPresentation(pres);
                            setError(null);
                        } else {
                            setError("Presentation contains no slides");
                        }
                    } catch (e) {
                        console.error("Failed to parse INIT_PRESENTATION data", e);
                        setError("Failed to parse presentation data");
                    }
                }
            } catch (e) {
                // ignore non-json messages
            }
        };

        // Listen for incoming presentation JSON data from parent window (LMS)
        window.addEventListener("message", handleMessage);

        // Let the parent know we are ready to receive data
        window.parent.postMessage("PREVIEW_READY", "*");

        return () => window.removeEventListener("message", handleMessage);
    }, []);

    if (error) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-slate-100">
                <div className="p-6 text-center bg-white rounded-lg shadow-sm border border-red-200">
                    <p className="text-red-600 font-medium">Failed to load presentation.</p>
                    <p className="text-sm text-slate-500 mt-2">{error}</p>
                </div>
            </div>
        );
    }

    if (!presentation) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-slate-100">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm text-slate-500">Initializing preview...</p>
                </div>
            </div>
        );
    }

    // Render the PresentationViewer directly
    return (
        <div className="h-screen w-screen overflow-hidden relative bg-black">
            <PresentationViewer
                presentation={presentation}
                onClose={() => { }}
                hideCloseButton={true}
            />
        </div>
    );
}
