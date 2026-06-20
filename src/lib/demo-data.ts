import type { AnalysisResult } from "@/lib/types";

export const showcaseResult: AnalysisResult = {
  summary:
    "A practical walkthrough of a creative production workflow, showing how structured tools and repeatable steps turn source material into a finished visual asset.",
  chapters: [
    { start: 0, title: "Set up the project", summary: "Prepare the source material and establish the working canvas." },
    { start: 41, title: "Build the composition", summary: "Arrange the core elements and refine the hierarchy." },
    { start: 89, title: "Polish and export", summary: "Review details and prepare the final output." },
  ],
  transcript: [
    { id: "showcase-1", start: 0, end: 17, text: "We begin by setting up the source files and defining what the finished composition needs to communicate." },
    { id: "showcase-2", start: 17, end: 41, text: "The first practical step is organizing the workspace so every important asset is easy to find." },
    { id: "showcase-3", start: 41, end: 64, text: "Now the main elements can be placed, scaled, and compared directly inside the composition." },
    { id: "showcase-4", start: 64, end: 89, text: "Small alignment and spacing decisions make the visual hierarchy much clearer." },
    { id: "showcase-5", start: 89, end: 113, text: "The final pass focuses on consistency, contrast, and removing anything that does not support the idea." },
    { id: "showcase-6", start: 113, end: 131, text: "Before exporting, check the output dimensions and review the result at its intended size." },
    { id: "showcase-7", start: 131, end: 145.4, text: "The workflow ends with a reusable file that can be adjusted quickly for the next variation." },
  ],
  viralClips: [
    { id: "showcase-clip-1", start: 17, end: 47, title: "Organize before you create", hook: "A clean workspace makes every creative decision faster.", score: 94 },
    { id: "showcase-clip-2", start: 64, end: 96, title: "Hierarchy is built in the details", hook: "Small spacing changes can transform the entire composition.", score: 91 },
    { id: "showcase-clip-3", start: 113, end: 141, title: "Review at the real output size", hook: "The final check most creators skip.", score: 88 },
  ],
  analysisMode: "demo",
  duration: 145.425,
};
