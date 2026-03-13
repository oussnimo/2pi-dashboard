import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, X, Loader, Package, Layers } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import toast from "react-hot-toast";
import axios from "axios";
import SourceInputPanel from "./SourceInputPanel";

/**
 * AIQuestionGenerator Component - REDESIGNED
 *
 * Generates questions for ALL levels at once based on selected game types and ONE prompt
 * Props:
 *   - isOpen: boolean - Control visibility
 *   - onClose: function - Close the panel
 *   - numLevels: number - Total levels in quiz
 *   - onQuestionsGenerated: function - Callback when all questions are generated
 */

function AIQuestionGenerator({ isOpen, onClose, numLevels, quizData, onQuestionsGenerated }) {
  const { t } = useLanguage();

  // Form state: game types for each level + shared prompt
  const [levelGameTypes, setLevelGameTypes] = useState(
    Array(numLevels)
      .fill()
      .reduce((acc, _, i) => { // reduce is used to create an object with keys from 1 to numLevels
        acc[i + 1] = "box"; // Default to "box" // acc[i + 1] is the key of the object, which is the level number (1, 2, 3, etc.) // acc is the accumulator, which is the object that is being built
        return acc;
      }, {}) // {} is the initial value of the accumulator
  );

  const [prompt, setPrompt] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [rawUrls, setRawUrls] = useState([]);        // Raw URL chips — up to 2 (not yet fetched)
  const [rawFile, setRawFile] = useState(null);      // Raw File object (not yet extracted)
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * Handle game type change for a specific level
   */
  const handleGameTypeChange = (levelNumber, gameType) => {
    setLevelGameTypes((prev) => ({
      ...prev,
      [levelNumber]: gameType,
    }));
  };

  /**
   * Reset form to initial state
   */
  const resetForm = () => {
    setPrompt("");
    setSourceText("");
    setRawUrls([]);
    setRawFile(null);
    setLevelGameTypes(
      Array(numLevels)
        .fill()
        .reduce((acc, _, i) => {
          acc[i + 1] = "box";
          return acc;
        }, {})
    );
  };

  /**
   * Handle close with form reset
   */
  const handleClose = () => {
    resetForm();
    onClose();
  };

  /**
   * Generate questions for ALL levels at once using Bulk API
   */
  const handleGenerateAllQuestions = async () => {
    if (!prompt.trim() && !sourceText.trim() && rawUrls.length === 0 && !rawFile) {
      toast.error(t("enter_prompt") || "Please enter a prompt or provide a source (file/URL)");
      return;
    }

    if (!quizData?.course || !quizData?.topic || !quizData?.gameNumber) {
      toast.error("Please fill Course, Topic, and Game Number on the form first.");
      return;
    }

    // Check if all levels have game types selected
    const allLevelsConfigured = Array.from({ length: numLevels }, (_, i) => i + 1).every(
      (levelNum) => levelGameTypes[levelNum]
    );

    if (!allLevelsConfigured) {
      toast.error("Please select a game type for all levels");
      return;
    }

    setIsGenerating(true);

    try {
      // ── Auto-extract File if attached but not yet extracted ──
      let finalSourceText = sourceText;
      let pdfFileName = "document";
      if (rawFile && !finalSourceText.trim()) {
        toast.loading("Extracting file content…", { id: "file-extract" });
        try {
          const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api/";
          const token = localStorage.getItem("token") || sessionStorage.getItem("token");
          const fd = new FormData();
          fd.append("file", rawFile);
          const resp = await axios.post(`${apiUrl}extract-file`, fd, {
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
          });
          if (resp.data.success) {
            pdfFileName = rawFile.name || "document";
            // ✅ ADD SOURCE LABEL TO PDF (just like URLs)
            finalSourceText = `=== SOURCE 1: 📄 PDF (${pdfFileName}) ===\n${resp.data.text}`;
            setSourceText(finalSourceText);
            toast.success("📄 File content extracted!", { id: "file-extract" });
          } else {
            toast.error(resp.data.message || "Failed to extract file.", { id: "file-extract" });
            setIsGenerating(false);
            return;
          }
        } catch (fileErr) {
          toast.error(fileErr.response?.data?.message || "Failed to extract file.", { id: "file-extract" });
          setIsGenerating(false);
          return;
        }
      }

      // ── Auto-fetch URLs if chips exist (extract EVEN if file was extracted - combine sources) ──
      if (rawUrls.length > 0) {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api/";
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const combinedParts = [];

        for (let i = 0; i < rawUrls.length; i++) {
          const url = rawUrls[i].trim();
          if (!url) continue;
          const label = rawUrls.length > 1 ? `URL ${i + 1}` : "URL";
          toast.loading(`Fetching ${label} content…`, { id: `url-fetch-${i}` });
          try {
            const resp = await axios.post(
              `${apiUrl}extract-url`,
              { url },
              { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
            );
            if (resp.data.success) {
              const sourceLabel = resp.data.source === "youtube_transcript"
                ? "🎬 YouTube transcript"
                : resp.data.source === "youtube_description"
                  ? "🎬 YouTube info"
                  : "🔗 Webpage";
              // ✅ Adjust source numbering if PDF was already extracted
              const sourceNumber = finalSourceText.trim() ? (i + 2) : (i + 1);
              combinedParts.push(`=== SOURCE ${sourceNumber}: ${sourceLabel} (${url}) ===\n${resp.data.text}`);
              toast.success(`${sourceLabel} extracted! (${label})`, { id: `url-fetch-${i}` });
            } else {
              toast.error(resp.data.message || `Failed to fetch ${label}.`, { id: `url-fetch-${i}` });
              setIsGenerating(false);
              return;
            }
          } catch (fetchErr) {
            toast.error(fetchErr.response?.data?.message || `Failed to fetch ${label}.`, { id: `url-fetch-${i}` });
            setIsGenerating(false);
            return;
          }
        }

        if (combinedParts.length > 0) {
          // COMBINE with existing file content (don't replace it)
          if (finalSourceText.trim()) {
            finalSourceText = finalSourceText + "\n\n" + combinedParts.join("\n\n");
          } else {
            finalSourceText = combinedParts.join("\n\n");
          }
          setSourceText(finalSourceText);
        }
      }

      console.log("🚀 [AIQuestionGenerator] Generating in BULK MODE...");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api/";
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");

      if (!token) {
        toast.error("Authentication required. Please log in.");
        setIsGenerating(false);
        return;
      }

      // Convert levelGameTypes object to a simple array in order
      const levelTypesArray = [];
      for (let i = 1; i <= numLevels; i++) {
        levelTypesArray.push(levelGameTypes[i]);
      }

      // Prepare bulk payload
      const payload = {
        course: quizData.course,
        topic: quizData.topic,
        gameNumber: parseInt(quizData.gameNumber, 10),
        numLevels: numLevels,
        level_types: levelTypesArray,
        ai_prompt: prompt.trim() || "Generate questions based on the provided source material.",
        ...(finalSourceText.trim() && { source_text: finalSourceText.trim() }),
      };

      console.log("📦 Sending Bulk Payload:", payload);

      const response = await axios.post(
        `${apiUrl}generate-questions`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
        }
      );

      if (response.status === 200 && response.data.success) {
        console.log("🎉 [AIQuestionGenerator] Bulk generation successful!", response.data.data);
        toast.success(t("questions_generated") || `All ${numLevels} levels generated successfully!`);

        // Pass the fully structured JSON data up to the parent
        onQuestionsGenerated(response.data.data);
        handleClose();
      } else {
        console.error("❌ [AIQuestionGenerator] API Error:", response.data);
        toast.error(response.data.message || "Failed to generate questions. Please try again.");
      }

    } catch (error) {
      const errMsg = error.response?.data?.message || error.message || "An unexpected error occurred";
      console.error("❌ [AIQuestionGenerator] Network or Server Error:", errMsg);
      toast.error(`Error: ${errMsg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div
      className="glass-card p-6 h-full flex flex-col min-h-full"
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* ===== HEADER ===== */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Sparkles className="text-purple-main" size={20} />
          <h3 className="font-bold gradient-text">
            {t("ai_question_generator")}
          </h3>
        </div>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* ===== BODY (Scrollable) ===== */}
      <div className="space-y-4 flex-1 overflow-y-auto">
        {/* STEP 1: Configure Game Types for Each Level */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <label className="form-label mb-3">Configure Levels</label>
          <div className="space-y-2">
            {Array.from({ length: numLevels }, (_, i) => i + 1).map((levelNumber) => (
              <motion.div
                key={levelNumber}
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: levelNumber * 0.05 }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-purple-main" />
                    <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                      {t("level")} {levelNumber}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {/* Box Type Button */}
                    <motion.button
                      type="button"
                      onClick={() => handleGameTypeChange(levelNumber, "box")}
                      className={`px-3 py-1 rounded-lg transition-all duration-200 flex items-center gap-1 text-xs font-medium ${levelGameTypes[levelNumber] === "box"
                        ? "bg-gradient-to-r from-purple-deep to-purple-main text-white shadow-md"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                        }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Package size={12} />
                      Boxes
                    </motion.button>

                    {/* Balloon Type Button */}
                    <motion.button
                      type="button"
                      onClick={() => handleGameTypeChange(levelNumber, "balloon")}
                      className={`px-3 py-1 rounded-lg transition-all duration-200 flex items-center gap-1 text-xs font-medium ${levelGameTypes[levelNumber] === "balloon"
                        ? "bg-gradient-to-r from-orange-main to-orange-deep text-white shadow-md"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                        }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Package size={12} />
                      Balloons
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Select game type for each level
          </p>
        </motion.div>

        {/* STEP 2: Source Input (Tabbed: Prompt / File / URL) */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <label className="form-label mb-2">Source for Questions</label>
          <SourceInputPanel
            prompt={prompt}
            onPromptChange={setPrompt}
            sourceText={sourceText}
            onSourceReady={setSourceText}
            onClearSource={() => setSourceText("")}
            onUrlChipsChange={(urls) => { setRawUrls(urls); if (urls.length === 0) setSourceText(""); }}
            onFileChange={(file) => { setRawFile(file); if (!file) setSourceText(""); }}
          />
        </motion.div>

        {/* Summary */}
        <motion.div
          className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
            📋 Will generate questions for {numLevels} level
            {numLevels > 1 ? "s" : ""} using{" "}
            {Array.from({ length: numLevels }, (_, i) => i + 1)
              .map((levelNum) => `${levelGameTypes[levelNum]}`)
              .join(", ")}
          </p>
        </motion.div>
      </div>

      {/* ===== GENERATE BUTTON (sticky bottom) ===== */}
      <motion.button
        type="button"
        onClick={handleGenerateAllQuestions}
        disabled={isGenerating || (!prompt.trim() && !sourceText.trim() && rawUrls.length === 0 && !rawFile)}
        className="btn-primary w-full flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
        whileHover={{ scale: isGenerating || (!prompt.trim() && !sourceText.trim() && rawUrls.length === 0 && !rawFile) ? 1 : 1.02 }}
        whileTap={{ scale: isGenerating || (!prompt.trim() && !sourceText.trim() && rawUrls.length === 0 && !rawFile) ? 1 : 0.98 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {isGenerating ? (
          <>
            <Loader size={16} className="animate-spin" />
            Generating {numLevels} Level{numLevels > 1 ? "s" : ""}...
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Generate All Questions
          </>
        )}
      </motion.button>
    </motion.div>
  );
}

export default AIQuestionGenerator;
